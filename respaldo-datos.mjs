/**
 * Copia de seguridad de los datos de la posada a ficheros JSON.
 *
 * Guarda reservas, abonos, movimientos, alojamientos y comandas en la carpeta que se
 * indique. Sirve para tener una foto antes de tocar nada, y para poder reconstruir si
 * algo se borra por error.
 *
 *   PIN_PROPIEDAD=1234 node respaldo-datos.mjs                -> guarda en ./respaldos/<fecha>
 *   PIN_PROPIEDAD=1234 node respaldo-datos.mjs ruta/carpeta    -> guarda donde se le diga
 *
 * Entra con el PIN, igual que el panel: la contraseña ya no la conoce nadie fuera del
 * servidor, asi que no hay ninguna que escribir aqui ni en el historial de la terminal.
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'

const TABLAS = ['bookings', 'booking_payments', 'transactions', 'accommodations',
  'comandas', 'employees', 'menu_sections', 'menu_items', 'hotel_settings',
  'employee_bonuses', 'cash_box_movements']

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').filter(Boolean).map(l => {
    const i = l.indexOf('=')
    return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
  })
)

const PIN = process.env.PIN_PROPIEDAD
if (!PIN) {
  console.log('Falta el PIN. Ejecuta:  PIN_PROPIEDAD=<pin> node respaldo-datos.mjs')
  process.exit(1)
}

const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)

// El mismo camino que usa el panel: se manda el PIN y vuelve una sesion. La contraseña
// vive solo en el servidor y no hace falta conocerla para nada.
const { data: sesion, error: eFuncion } = await sb.functions.invoke('admin-login', {
  body: { pin: PIN },
})
if (eFuncion || !sesion?.access_token) {
  console.log('No se pudo entrar con ese PIN.')
  process.exit(1)
}

const { error: eLogin } = await sb.auth.setSession({
  access_token: sesion.access_token,
  refresh_token: sesion.refresh_token,
})
if (eLogin) { console.log('No se pudo montar la sesion:', eLogin.message); process.exit(1) }

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
