import { parseLocalDate } from './dateUtils'

/**
 * Reparte las noches de una estadía entre temporada navideña y resto del año, y calcula
 * el precio cobrando cada noche a la tarifa que le toca.
 *
 * Hubo dos fallos encadenados aquí. El primero: la temporada se decidía con la fecha de
 * entrada y se aplicaba a TODAS las noches, así que entrar el 18 de diciembre salía a
 * tarifa normal aunque se durmiera hasta después de Navidad.
 *
 * El segundo aparecio al cotejar la migración de Paxer: en navidad la pensión del adulto
 * sube de 56 a 62, y el precio de habitación era 6 más alto de lo que debía. Los dos
 * errores se anulaban con un solo adulto —por eso el precio de "1 adulto" del grid de
 * Paxer cuadraba— y se separaban en cuanto había dos o más. Con dos adultos se cobraban
 * 6 de menos por noche; con seis, 30.
 *
 * La noche pertenece al día en que se duerme: cuenta el check-in y no cuenta el
 * check-out, que es el criterio de cualquier hotel y el que usa Paxer.
 */

/** Temporada navideña: 21 de diciembre al 7 de enero, ambos incluidos.
 *  Verificada contra el grid de Paxer en los dos extremos: el 20 de diciembre todavía
 *  cobra tarifa normal y el 8 de enero ya ha vuelto a la normal. */
export const esNocheNavidena = (d: Date) =>
  (d.getMonth() === 11 && d.getDate() >= 21) || (d.getMonth() === 0 && d.getDate() <= 7)

export interface RepartoDeNoches {
  /** Noches de la estadía. Cero si las fechas no son válidas. */
  total: number
  navidenas: number
  normales: number
}

const VACIO: RepartoDeNoches = { total: 0, navidenas: 0, normales: 0 }

export function repartirNoches(checkIn: string, checkOut: string): RepartoDeNoches {
  if (!checkIn || !checkOut) return VACIO
  return repartirNochesEntre(parseLocalDate(checkIn), parseLocalDate(checkOut))
}

/** Igual que `repartirNoches`, para cuando ya se tienen objetos Date (app del huésped). */
export function repartirNochesEntre(entrada: Date | null, salida: Date | null): RepartoDeNoches {
  if (!entrada || !salida) return VACIO
  const total = Math.round((salida.getTime() - entrada.getTime()) / 86_400_000)
  if (!Number.isFinite(total) || total <= 0) return VACIO

  let navidenas = 0
  for (let i = 0; i < total; i++) {
    const noche = new Date(entrada)
    noche.setDate(noche.getDate() + i)
    if (esNocheNavidena(noche)) navidenas++
  }
  return { total, navidenas, normales: total - navidenas }
}

/** Precio de la habitación por noche en cada temporada. */
export interface TarifasHabitacion {
  normal: number
  navidena: number
}

/** Alimentación por persona y noche. El niño cuesta igual todo el año; el adulto sube
 *  en navidad. */
export interface TarifasPension {
  adulto: number
  adultoNavideno: number
  nino: number
}

export interface DesglosePrecio {
  alojamiento: number
  pension: number
  total: number
}

/**
 * Precio de toda la estadía, noche a noche.
 *
 * Cada noche lleva su tarifa de habitación y su pensión según la temporada en que cae,
 * así que una estadía a caballo entre diciembre y enero se cobra bien sin que nadie
 * tenga que partirla a mano.
 */
export function precioEstancia(
  noches: RepartoDeNoches,
  habitacion: TarifasHabitacion,
  pension: TarifasPension,
  adultos: number,
  ninos: number
): DesglosePrecio {
  const alojamiento = (noches.normales * habitacion.normal)
    + (noches.navidenas * habitacion.navidena)

  const pensionNormal = (adultos * pension.adulto) + (ninos * pension.nino)
  const pensionNavidena = (adultos * pension.adultoNavideno) + (ninos * pension.nino)
  const totalPension = (noches.normales * pensionNormal)
    + (noches.navidenas * pensionNavidena)

  return { alojamiento, pension: totalPension, total: alojamiento + totalPension }
}
