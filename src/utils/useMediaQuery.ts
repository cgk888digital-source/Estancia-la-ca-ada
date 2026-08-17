import { useCallback, useSyncExternalStore } from 'react'

/**
 * Se suscribe a una media query de CSS y devuelve si coincide ahora mismo.
 * Usa useSyncExternalStore para que React lea el valor sin un setState en efecto.
 */
export function useMediaQuery(query: string) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    [query]
  )

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false // en SSR/prerender se asume escritorio
  )
}

/** Ancho por debajo del breakpoint `sm` de Tailwind: telefono en vertical. */
export const useIsMobile = () => useMediaQuery('(max-width: 639px)')
