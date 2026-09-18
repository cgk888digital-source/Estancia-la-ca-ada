/**
 * Cambia un PIN por una sesión, sin que el navegador vea nunca las contraseñas.
 *
 * Antes el mapa PIN -> correo + contraseña vivía en el JavaScript del panel, así que las
 * tres contraseñas viajaban al navegador de cualquiera que abriera la web: se veían en la
 * pestaña de red, sin necesidad de saber nada. Ahora el mapa vive en la tabla
 * `admin_pin_map`, que tiene RLS y cero políticas y ningún permiso para anon ni
 * authenticated: solo la lee esta función, con la clave de servicio. El navegador manda el
 * PIN y recibe una sesión; las contraseñas no salen del servidor.
 *
 * Además limita los intentos por IP. Un PIN de cuatro cifras son diez mil combinaciones, y
 * el límite que hay en el navegador se salta llamando a la API directamente. Este no.
 *
 * DESPLIEGUE: sin verificación de JWT, porque quien llama todavía no tiene sesión. Es la
 * excepción normal de un endpoint de login: la autorización la hace la propia función.
 */

interface Credencial {
  email: string
  password: string
  role: string
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const INTENTOS_MAXIMOS = 10
const VENTANA_MS = 5 * 60 * 1000

/** Intentos recientes por IP. Se pierde si la función se reinicia, y no pasa nada: es un
 *  freno contra quien prueba en bucle, no un registro de auditoría. */
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

  const url = Deno.env.get('SUPABASE_URL')
  const anon = Deno.env.get('SUPABASE_ANON_KEY')
  const servicio = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !anon || !servicio) {
    console.error('Faltan variables de entorno de Supabase')
    return responder({ error: 'Configuración incompleta del servidor' }, 500)
  }

  // Se anota el intento siempre, acierte o falle: si solo se contaran los fallos, bastaría
  // con intercalar un acierto para seguir probando sin límite.
  anotarIntento(ip)

  // La misma respuesta para "PIN que no existe" y "PIN que existe pero falló": así no se
  // puede averiguar cuáles son válidos probando.
  const rechazo = () => responder({ error: 'PIN incorrecto' }, 401)

  // El PIN va como parámetro de filtro, no concatenado en ninguna consulta: PostgREST lo
  // trata como valor. Y solo se piden las tres columnas que hacen falta.
  const consulta = await fetch(
    `${url}/rest/v1/admin_pin_map?pin=eq.${encodeURIComponent(pin)}&select=email,password,role`,
    { headers: { apikey: servicio, Authorization: `Bearer ${servicio}` } },
  )

  if (!consulta.ok) {
    console.error('No se pudo leer el mapa de PINes:', consulta.status)
    return responder({ error: 'Configuración incompleta del servidor' }, 500)
  }

  const filas = await consulta.json() as Credencial[]
  const credencial = Array.isArray(filas) ? filas[0] : undefined
  if (!credencial) return rechazo()

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

  // Solo lo que el navegador necesita para montar la sesión y saber qué puede ver. Ni el
  // correo ni la contraseña salen de aquí.
  return responder({
    access_token: sesion.access_token,
    refresh_token: sesion.refresh_token,
    expires_in: sesion.expires_in,
    role: credencial.role,
  })
})
