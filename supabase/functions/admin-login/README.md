# admin-login — sacar las contraseñas del navegador

## El problema

Hoy `src/admin/context/AuthContext.tsx` lleva escrito el mapa de PIN a credenciales:

```ts
'1234': { email: 'propiedad@estancialacanada.com', pass: 'password1234', ... }
```

Eso se compila dentro del JavaScript del panel, así que las tres contraseñas viajan al
navegador de cualquiera que abra la web. Se ven buscando `password1234` en el bundle.

## El orden de los pasos

**Importante: no cambies el cliente antes de desplegar la función.** Si el panel deja de
tener las contraseñas y la función todavía no responde, nadie puede entrar.

### 1. Guardar el mapa como secreto

```bash
supabase secrets set ADMIN_PIN_MAP='{
  "1234": {"email":"propiedad@estancialacanada.com","password":"LA_CLAVE_REAL"},
  "2222": {"email":"admin@estancialacanada.com","password":"LA_CLAVE_REAL"},
  "3333": {"email":"restaurante@estancialacanada.com","password":"LA_CLAVE_REAL"}
}'
```

### 2. Desplegar

```bash
supabase functions deploy admin-login --no-verify-jwt
```

`--no-verify-jwt` es obligatorio: quien llama todavía no tiene sesión.

### 3. Comprobar antes de tocar nada

```bash
curl -s -X POST "https://<tu-proyecto>.supabase.co/functions/v1/admin-login" \
  -H "Content-Type: application/json" -d '{"pin":"1234"}'
```

Debe devolver `access_token` y `refresh_token`. Con un PIN falso, `401 PIN incorrecto`.

### 4. Recién entonces, cambiar el cliente

`login()` pasa a llamar a la función y montar la sesión con lo que devuelve:

```ts
const { data, error } = await supabase.functions.invoke('admin-login', { body: { pin } })
if (error || !data?.access_token) return null
await supabase.auth.setSession({
  access_token: data.access_token,
  refresh_token: data.refresh_token,
})
```

Y se borra el objeto `PINS` con las contraseñas. El rol se puede seguir guardando en
`localStorage`, pero **ya no hay que guardar el PIN**: la sesión se restaura sola con el
`refresh_token` que Supabase mantiene.

## Qué resuelve y qué no

**Resuelve:** las contraseñas dejan de publicarse, y los intentos quedan limitados en el
servidor (10 cada 5 minutos por IP), que es el único sitio donde el límite cuenta — el
del navegador se salta llamando a la API directamente.

**No resuelve:** un PIN de cuatro cifras sigue siendo un PIN de cuatro cifras. Con el
límite del servidor, recorrer las diez mil combinaciones lleva días en vez de segundos,
pero si algún día esto guarda algo más delicado que una nómina, toca login de verdad con
usuario y contraseña por persona.
