import { parseLocalDate } from './dateUtils'

/**
 * Reparte las noches de una estadía entre temporada navideña y resto del año.
 *
 * Antes la temporada se decidía con la fecha de entrada y se aplicaba a TODAS las
 * noches. Una estadía del 18 al 26 de diciembre se cobraba entera a tarifa normal
 * aunque cinco de sus noches fueran de temporada alta, y una del 28 de diciembre al
 * 12 de enero se cobraba entera a tarifa alta aunque cuatro noches ya fueran de enero.
 * Cobraba de menos en un caso y de más en el otro.
 *
 * La noche pertenece al día en que se duerme: cuenta el check-in y no cuenta el
 * check-out, que es el criterio de cualquier hotel y el que usa Paxer.
 */

/** Temporada navideña: 21 de diciembre al 7 de enero, ambos incluidos. */
export const esNocheNavidena = (d: Date) =>
  (d.getMonth() === 11 && d.getDate() >= 21) || (d.getMonth() === 0 && d.getDate() <= 7)

export interface RepartoDeNoches {
  /** Noches de la estadía. Cero si las fechas no son válidas. */
  total: number
  navidenas: number
  normales: number
}

export function repartirNoches(checkIn: string, checkOut: string): RepartoDeNoches {
  if (!checkIn || !checkOut) return { total: 0, navidenas: 0, normales: 0 }
  return repartirNochesEntre(parseLocalDate(checkIn), parseLocalDate(checkOut))
}

/** Igual que `repartirNoches`, para cuando ya se tienen objetos Date (app del huésped). */
export function repartirNochesEntre(entrada: Date | null, salida: Date | null): RepartoDeNoches {
  if (!entrada || !salida) return { total: 0, navidenas: 0, normales: 0 }
  const total = Math.round((salida.getTime() - entrada.getTime()) / 86_400_000)
  if (!Number.isFinite(total) || total <= 0) return { total: 0, navidenas: 0, normales: 0 }

  let navidenas = 0
  for (let i = 0; i < total; i++) {
    const noche = new Date(entrada)
    noche.setDate(noche.getDate() + i)
    if (esNocheNavidena(noche)) navidenas++
  }
  return { total, navidenas, normales: total - navidenas }
}

/** Precio del alojamiento por toda la estadía, cobrando cada noche a su temporada. */
export function totalPorNoches(
  checkIn: string,
  checkOut: string,
  precioNormal: number,
  precioNavideno: number
): number {
  const { navidenas, normales } = repartirNoches(checkIn, checkOut)
  return normales * precioNormal + navidenas * precioNavideno
}
