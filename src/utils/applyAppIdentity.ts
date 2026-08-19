/**
 * La app del huésped y el panel de administración comparten un solo index.html, pero
 * deben poder instalarse en el teléfono como DOS aplicaciones separadas: al tocar el
 * icono del panel tiene que abrir directo en /admin, no en la app del huésped.
 *
 * Lo que decide qué se instala son las etiquetas del <head>. Como el HTML es único, hay
 * que reescribirlas según la ruta:
 *
 *  - Android/Chrome se guía por el `manifest`. Dos manifests con `id` distinto ('/' y
 *    '/admin') cuentan como dos apps y se pueden instalar las dos a la vez.
 *  - iOS ignora el manifest: usa `apple-touch-icon` y `apple-mobile-web-app-title`, y
 *    toma como punto de arranque la URL que esté abierta al añadir a pantalla de inicio.
 */

interface Identity {
  manifest: string
  appleIcon: string
  appleTitle: string
  themeColor: string
  title: string
}

const GUEST: Identity = {
  manifest: '/manifest.webmanifest',
  appleIcon: '/apple-touch-icon.png',
  appleTitle: 'La Cañada',
  themeColor: '#A65D47',
  title: 'Estancia La Cañada',
}

const ADMIN: Identity = {
  manifest: '/admin.webmanifest',
  appleIcon: '/admin-apple-touch-icon.png',
  appleTitle: 'Admin',
  themeColor: '#3D2B1F',
  title: 'Administración · La Cañada',
}

export const isAdminPath = (pathname: string) =>
  pathname === '/admin' || pathname.startsWith('/admin/')

function setLink(rel: string, href: string) {
  let el = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement('link')
    el.rel = rel
    document.head.appendChild(el)
  }
  // Reasignar el mismo href haría que Chrome reevalúe el manifest sin necesidad.
  if (el.getAttribute('href') !== href) el.setAttribute('href', href)
}

function setMeta(name: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.name = name
    document.head.appendChild(el)
  }
  if (el.content !== content) el.content = content
}

/** Ajusta el <head> a la sección en la que está el usuario. */
export function applyAppIdentity(pathname: string = window.location.pathname) {
  const id = isAdminPath(pathname) ? ADMIN : GUEST
  setLink('manifest', id.manifest)
  setLink('apple-touch-icon', id.appleIcon)
  setMeta('apple-mobile-web-app-title', id.appleTitle)
  setMeta('theme-color', id.themeColor)
  if (document.title !== id.title) document.title = id.title
}
