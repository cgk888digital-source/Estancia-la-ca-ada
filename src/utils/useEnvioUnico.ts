import { useCallback, useRef, useState } from 'react'

/**
 * Que un botón de guardar no dispare dos veces.
 *
 * Mientras la base de datos responde, el botón seguía activo, y cada toque en ese rato
 * creaba otra fila. Así se crearon tres Aida Rondón idénticas con 30 milésimas de
 * diferencia entre una y otra: no fue nadie guardando tres veces, fue un toque que el
 * botón dejó pasar tres.
 *
 * El candado va en un `ref` y no solo en el estado: el estado no cambia hasta el siguiente
 * render, y dos toques seguidos llegan antes. `ocupado` es para pintar el botón apagado.
 */
export function useEnvioUnico() {
  const enCurso = useRef(false)
  const [ocupado, setOcupado] = useState(false)

  /** Devuelve false si ya hay un guardado en marcha: en ese caso no hay que hacer nada. */
  const empezar = useCallback(() => {
    if (enCurso.current) return false
    enCurso.current = true
    setOcupado(true)
    return true
  }, [])

  const terminar = useCallback(() => {
    enCurso.current = false
    setOcupado(false)
  }, [])

  return { ocupado, empezar, terminar }
}
