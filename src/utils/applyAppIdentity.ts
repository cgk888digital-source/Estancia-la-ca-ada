/**
 * La app del huésped y el panel de administración se instalan como DOS aplicaciones
 * separadas: al tocar el icono del panel tiene que abrir directo en /admin.
 *
 * Lo que decide qué se instala son las etiquetas del <head>, y cada sección tiene su
 * propio documento con ellas ya escritas: index.html para el huésped, admin.html para el
 * panel (ver vite.config.ts y las rewrites de vercel.json). Es obligatorio que sean
 * estáticas porque Safari lee el <head> al parsear y NO lo relee si JavaScript lo cambia
 * después: con un solo html, el iPhone instalaba siempre la app del huésped.
 *
 * Esta función es el respaldo para la navegación interna, donde no hay recarga y el
 * documento no cambia. Hoy el huésped nunca enlaza a /admin, así que en la práctica solo
 * confirma lo que el html ya declara.
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
