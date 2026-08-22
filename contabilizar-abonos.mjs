/**
 * Lleva a Ingresos los abonos de reservas que se cobraron ANTES de que la app supiera
 * hacerlo. De aqui en adelante lo hace sola (src/utils/bookingIncome.ts); esto es solo
 * para ponerse al dia una vez.
 *
 * La clave va por variable de entorno. Ejemplos:
 *   CLAVE_PROPIEDAD=xxx node contabilizar-abonos.mjs                  -> ensayo, no escribe
 *   CLAVE_PROPIEDAD=xxx node contabilizar-abonos.mjs --sin-migracion  -> ensayo, sin los 17 de Paxer
 *   CLAVE_PROPIEDAD=xxx node contabilizar-abonos.mjs --sin-migracion --aplicar
 *   CLAVE_PROPIEDAD=xxx node contabilizar-abonos.mjs --aplicar        -> escribe TODOS
 *
 * Es seguro repetirlo: cada ingreso queda marcado con el id de su abono en `notes`, y
 * los que ya existen se saltan. Ejecutarlo dos veces no duplica dinero.
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const APLICAR = process.argv.includes('--aplicar')
// Los 17 abonos cargados el 2026-07-30 entre las 20:18 y las 20:34 son la migracion de
// Paxer: su payment_date es el dia de la carga, no el dia en que entro el dinero.
const SIN_MIGRACION = process.argv.includes('--sin-migracion')
const DIA_MIGRACION = '2026-07-30'

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').filter(Boolean).map(l => {
    const i = l.indexOf('=')
    return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
  })
)
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)

// La clave se pasa por variable de entorno, no se escribe aqui:
//   CLAVE_PROPIEDAD=... node contabilizar-abonos.mjs
if (!process.env.CLAVE_PROPIEDAD) {
  console.log('Falta la clave. Ejecuta:  CLAVE_PROPIEDAD=<clave> node contabilizar-abonos.mjs')
  process.exit(1)
}
const { error: eLogin } = await sb.auth.signInWithPassword({
  email: 'propiedad@estancialacanada.com',
  password: process.env.CLAVE_PROPIEDAD,
})
if (eLogin) { console.log('No se pudo entrar:', eLogin.message); process.exit(1) }

const marca = id => `abono:${id}`

const { data: pagos, error: ePagos } = await sb.from('booking_payments')
  .select('*').eq('status', 'verificado')
if (ePagos) { console.log('No se pudieron leer los abonos:', ePagos.message); process.exit(1) }

const { data: reservas } = await sb.from('bookings')
  .select('id,locator,guest_name,accommodation_id')
const { data: alojamientos } = await sb.from('accommodations').select('*')
const { data: yaHechas } = await sb.from('transactions').select('notes').not('notes', 'is', null)

const tituloDe = id => {
  const a = (alojamientos || []).find(x => String(x.id) === String(id))
  return a ? (a.title || a.nombre || a.name || null) : null
}
const hechas = new Set((yaHechas || []).map(t => t.notes))

let yaContabilizados = 0
let omitidosPorMigracion = 0
const filas = []

for (const p of pagos) {
  if (hechas.has(marca(p.id))) { yaContabilizados++; continue }
  if (SIN_MIGRACION && (p.created_at || '').startsWith(DIA_MIGRACION)) {
    omitidosPorMigracion++
    continue
  }
  const b = (reservas || []).find(r => r.id === p.booking_id)
  if (!b) { console.log('AVISO: abono sin reserva, se omite:', p.id); continue }

  const referencia = (b.locator || '').trim() || b.id.slice(0, 6).toUpperCase()
  const alojamiento = tituloDe(b.accommodation_id)
  filas.push({
    type: 'ingreso',
    category: 'alojamiento',
    description: alojamiento
      ? `Abono reserva ${referencia} — ${b.guest_name} (${alojamiento})`
      : `Abono reserva ${referencia} — ${b.guest_name}`,
    amount: Number(p.amount),
    date: p.payment_date,
    payment_method: p.method,
    reference: p.reference || null,
    reservation_id: b.id,
    notes: marca(p.id),
  })
}

console.log('abonos verificados:', pagos.length)
console.log('  ya estaban en Ingresos:', yaContabilizados)
if (SIN_MIGRACION) console.log('  omitidos (migracion de Paxer):', omitidosPorMigracion)
console.log('  a crear:', filas.length, '| suma:', filas.reduce((s, f) => s + f.amount, 0).toFixed(2))

if (filas.length) {
  console.table(filas.map(f => ({
    fecha: f.date, desc: f.description.slice(0, 54), monto: f.amount, metodo: f.payment_method,
  })))
  const porMes = {}
  for (const f of filas) { const m = f.date.slice(0, 7); porMes[m] = (porMes[m] || 0) + f.amount }
  console.log('por mes:'); console.table(porMes)
}

if (!APLICAR) {
  console.log('\n(ensayo en seco — no se escribio nada. Añade --aplicar para crearlos)')
  process.exit(0)
}
if (!filas.length) { console.log('\nNo hay nada que crear.'); process.exit(0) }

const { error: eIns, count } = await sb.from('transactions').insert(filas, { count: 'exact' })
if (eIns) {
  console.log('\nERROR al insertar:', eIns.code, eIns.message, eIns.details || '')
  process.exit(1)
}
console.log('\ningresos creados:', count)

const { data: fin } = await sb.from('transactions').select('date,amount').eq('category', 'alojamiento')
console.log('ingresos de alojamiento ahora:', fin.length,
  '| suma:', fin.reduce((s, t) => s + Number(t.amount), 0).toFixed(2))
