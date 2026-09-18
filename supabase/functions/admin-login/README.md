# admin-login — las contraseñas fuera del navegador

**Hecho y en producción el 17 de septiembre de 2026.** Este documento describe cómo quedó,
no lo que hay que hacer.

## Qué pasaba

`src/admin/context/AuthContext.tsx` llevaba escrito el mapa de PIN a credenciales:

```ts
'1234': { email: 'propiedad@estancialacanada.com', pass: 'password1234', ... }
```

Eso se compila dentro del JavaScript del panel, así que las tres contraseñas viajaban al
navegador de cualquiera que abriera la web. No hacía falta saber nada: se veían en la
pestaña de red. Comprobado en producción antes de arreglarlo — el fichero
`AuthContext-B7Hn2GIT.js` contenía el correo y la contraseña de la propiedad.

Las tres eran además del tipo que sale en cualquier lista de contraseñas filtradas.

## Cómo quedó

El mapa vive en la tabla **`public.admin_pin_map`** (`pin`, `email`, `password`, `role`,
`label`), con **RLS activo, cero políticas y ningún permiso para `anon` ni
`authenticated`**. Solo la lee esta función, que corre en el servidor con
`SUPABASE_SERVICE_ROLE_KEY` — la clave de servicio se salta RLS y es la única que entra.

El navegador manda `{ pin }` y recibe `{ access_token, refresh_token, expires_in, role }`.
`AuthContext` monta la sesión con `supabase.auth.setSession()`. Ninguna contraseña ni
ninguno de los tres correos aparece ya en el bundle.

Comprobado que la tabla no se puede leer:

| Quién | Resultado |
|---|---|
| Llave pública (`anon`) | `42501 permission denied` |
| Sesión de administrador iniciada (`authenticated`) | `42501 permission denied` |

## Contra la fuerza bruta

Un PIN de cuatro cifras son diez mil combinaciones. El límite que hay en la pantalla de
login sirve de poco: se salta llamando a la API directamente. Este no.

- **10 intentos por IP cada 5 minutos**, y luego 429.
- Se cuentan **también los aciertos**. Si solo contara los fallos, bastaría con intercalar
  un PIN bueno para seguir probando sin límite.
- Un PIN que no existe y un PIN que existe pero falla dan **la misma respuesta**, para que
  no se puedan descubrir cuáles son válidos probando.

El contador vive en memoria y se pierde si la función se reinicia. Es un freno contra quien
prueba en bucle, no un registro de auditoría.

## Por qué va sin verificación de JWT

Se desplegó con `verify_jwt: false`. Es la excepción normal de un endpoint de login: quien
llama todavía no tiene sesión, y la autorización la hace la propia función.

## Las contraseñas se rotaron

Sacarlas del bundle no arregla lo que ya pasó: llevaban meses descargables y quien las
guardara podía seguir entrando. El mismo día se cambiaron las tres por cadenas aleatorias
de 24 bytes, generadas **dentro de Postgres** (`gen_random_bytes` + `crypt`), de modo que
el texto plano nunca salió de la base de datos.

Comprobado después: las tres contraseñas viejas devuelven `400` contra
`/auth/v1/token`, y los tres PINes siguen entrando por la función.

## Si hay que cambiar un PIN o una contraseña

Todo está en la tabla; no hay que tocar código ni volver a desplegar:

```sql
-- Cambiar el PIN de un acceso
update public.admin_pin_map set pin = '4321', updated_at = now() where role = 'propiedad';

-- Rotar una contraseña (genera la nueva dentro de Postgres y la pone en los dos sitios)
with nueva as (
  select email, encode(extensions.gen_random_bytes(24), 'base64') as clave
  from public.admin_pin_map where role = 'propiedad'
), u as (
  update auth.users set encrypted_password = extensions.crypt(n.clave, extensions.gen_salt('bf')),
         updated_at = now()
  from nueva n where auth.users.email = n.email returning 1
)
update public.admin_pin_map m set password = n.clave, updated_at = now()
from nueva n where m.email = n.email;
```

## Lo que sigue sin estar resuelto

Un PIN de cuatro cifras es un PIN de cuatro cifras. El límite por IP lo hace lento, pero
quien tenga muchas IPs tiene tiempo. Si en algún momento importa de verdad, el paso
siguiente es un PIN más largo o un segundo factor; el sitio donde tocarlo es esta función y
la tabla, no el cliente.
