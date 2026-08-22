/**
 * Cambia un PIN por una sesión, sin que el navegador vea nunca las contraseñas.
 *
 * Hoy el mapa PIN -> correo + contraseña vive en el JavaScript del panel, así que las
 * tres contraseñas viajan al navegador de cualquiera que abra la web. Aquí el mapa vive
 * en los secretos de la función: el navegador manda el PIN, recibe una sesión, y las
 * contraseñas no salen nunca del servidor.
 *
 * Además limita los intentos por IP. Un PIN de cuatro cifras son diez mil
 * combinaciones; el limite del navegador se salta llamando a la API directamente, este
 * no.
 *
 * DESPLIEGUE
 *   supabase secrets set ADMIN_PIN_MAP='{"1234":{"email":"propiedad@estancialacanada.com","password":"..."},"2222":{...},"3333":{...}}'
 *   supabase functions deploy admin-login --no-verify-jwt
 *
 * El flag --no-verify-jwt hace falta: quien llama todavía no tiene sesión.
 */

interface Credencial {
  email: string
  password: string
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const INTENTOS_MAXIMOS = 10
const VENTANA_MS = 5 * 60 * 1000

/** Intentos recientes por IP. Se pierde si la función se reinicia, y no pasa nada:
 *  es un freno contra el que prueba en bucle, no un registro de auditoría. */
const intentos = new Map<string, number[]>()

function demasiadosIntentos(ip: string): boolean {
  const ahora = Date.now()
  const recientes = (intentos.get(ip) || []).filter(t => ahora - t < VENTANA_MS)
  intentos.set(ip, recientes)
  return recientes.length >= INTENTOS_MAXIMOS
}

function anotarIntento(ip: string) {
  const recientes = intentos.get(ip) || []
  recientes.push(Date.now())
  intentos.set(ip, recientes)
}

const responder = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return responder({ error: 'Método no permitido' }, 405)

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'desconocida'
  if (demasiadosIntentos(ip)) {
    return responder({ error: 'Demasiados intentos. Espere unos minutos.' }, 429)
  }

  let pin = ''
  try {
    const cuerpo = await req.json()
    pin = String(cuerpo?.pin ?? '')
  } catch {
    return responder({ error: 'Petición inválida' }, 400)
  }

  const crudo = Deno.env.get('ADMIN_PIN_MAP')
  if (!crudo) {
    console.error('Falta el secreto ADMIN_PIN_MAP')
    return responder({ error: 'Configuración incompleta del servidor' }, 500)
  }

  let mapa: Record<string, Credencial>
  try {
    mapa = JSON.parse(crudo)
  } catch {
    console.error('ADMIN_PIN_MAP no es un JSON válido')
    return responder({ error: 'Configuración incompleta del servidor' }, 500)
  }

  const credencial = mapa[pin]

  // Se anota el intento siempre, acierte o falle: si solo se contaran los fallos,
  // bastaría con intercalar un acierto para seguir probando sin límite.
  anotarIntento(ip)

  // La misma respuesta para "PIN que no existe" y "PIN que existe pero falló":
  // así no se puede averiguar cuáles son válidos probando.
  const rechazo = () => responder({ error: 'PIN incorrecto' }, 401)
  if (!credencial) return rechazo()

  const url = Deno.env.get('SUPABASE_URL')
  const anon = Deno.env.get('SUPABASE_ANON_KEY')
  if (!url || !anon) {
    console.error('Faltan SUPABASE_URL o SUPABASE_ANON_KEY')
    return responder({ error: 'Configuración incompleta del servidor' }, 500)
  }

  const auth = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anon, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: credencial.email, password: credencial.password }),
  })

  if (!auth.ok) {
    console.error('Supabase rechazó la credencial del PIN:', auth.status)
    return rechazo()
  }

  const sesion = await auth.json()

  // Solo lo que el navegador necesita para montar la sesión. Ni el correo ni la
  // contraseña salen de aquí.
  return responder({
    access_token: sesion.access_token,
    refresh_token: sesion.refresh_token,
    expires_in: sesion.expires_in,
  })
})
