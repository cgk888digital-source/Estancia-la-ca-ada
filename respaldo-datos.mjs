/**
 * Copia de seguridad de los datos de la posada a ficheros JSON.
 *
 * Guarda reservas, abonos, movimientos, alojamientos y comandas en la carpeta que se
 * indique. Sirve para tener una foto antes de tocar nada, y para poder reconstruir si
 * algo se borra por error.
 *
 *   CLAVE_PROPIEDAD=xxx node respaldo-datos.mjs                 -> guarda en ./respaldos/<fecha>
 *   CLAVE_PROPIEDAD=xxx node respaldo-datos.mjs ruta/carpeta     -> guarda donde se le diga
 *
 * La clave va por variable de entorno, nunca escrita aqui.
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'

const TABLAS = ['bookings', 'booking_payments', 'transactions', 'accommodations',
  'comandas', 'employees', 'menu_sections', 'menu_items', 'hotel_settings']

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').filter(Boolean).map(l => {
    const i = l.indexOf('=')
    return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
  })
)

if (!process.env.CLAVE_PROPIEDAD) {
  console.log('Falta la clave. Ejecuta:  CLAVE_PROPIEDAD=<clave> node respaldo-datos.mjs')
  process.exit(1)
}

const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
const { error: eLogin } = await sb.auth.signInWithPassword({
  email: 'propiedad@estancialacanada.com',
  password: process.env.CLAVE_PROPIEDAD,
})
if (eLogin) { console.log('No se pudo entrar:', eLogin.message); process.exit(1) }

const sello = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
const destino = process.argv[2] || path.join('respaldos', sello)
fs.mkdirSync(destino, { recursive: true })

let total = 0
for (const tabla of TABLAS) {
  const { data, error } = await sb.from(tabla).select('*')
  if (error) {
    console.log(String(tabla).padEnd(20), 'no se pudo leer:', error.code)
    continue
  }
  fs.writeFileSync(path.join(destino, tabla + '.json'), JSON.stringify(data, null, 2))
  console.log(String(tabla).padEnd(20), String(data.length).padStart(5), 'filas')
  total += data.length
}

console.log('\n' + total + ' filas guardadas en ' + destino)
