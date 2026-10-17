/**
 * Reparte un descuento fijo de toda la reserva entre sus habitaciones.
 *
 * Cada habitación guarda en sus notas la parte del descuento que le toca ("Descuento fijo
 * aplicado: USD x"), y su total se calcula restando esa parte. Por eso el descuento del
 * grupo se tiene que repartir. Antes se escribía el descuento entero en cada habitación y
 * se restaba entero en cada una: un descuento de 2.500 $ en una boda de 19 habitaciones
 * restaba 47.500 $, y la reserva se quedaba a cero.
 *
 * El reparto es en proporción a lo que cuesta cada habitación, en céntimos, y ninguna
 * baja de cero. Lo que no cabe por redondeo se reparte entre las que aún tienen margen.
 */
export function repartirDescuentoFijo(totales: number[], descuento: number): number[] {
  const centimos = totales.map(t => Math.max(0, Math.round(t * 100)))
  const totalGrupo = centimos.reduce((s, c) => s + c, 0)
  const aRepartir = Math.min(Math.max(0, Math.round(descuento * 100)), totalGrupo)
  if (aRepartir === 0 || totalGrupo === 0) return totales.map(() => 0)

  const partes = centimos.map(c => Math.floor((aRepartir * c) / totalGrupo))
  let resto = aRepartir - partes.reduce((s, p) => s + p, 0)
  // Los céntimos sueltos van a las habitaciones más caras, que son las que más margen tienen.
  const orden = centimos.map((_, i) => i).sort((a, b) => centimos[b] - centimos[a])
  while (resto > 0) {
    let colocado = false
    for (const i of orden) {
      if (resto === 0) break
      if (partes[i] < centimos[i]) {
        partes[i] += 1
        resto -= 1
        colocado = true
      }
    }
    if (!colocado) break
  }
  return partes.map(p => p / 100)
}

/**
 * El descuento de una habitación vive en sus columnas `discount_percent` y `discount_fixed`.
 * Antes iba como texto dentro de las notas y se volvía a leer en cada recálculo. Editar las
 * notas de un grupo copiaba el texto de una habitación en todas, borrarlo quitaba el
 * descuento, y una frase como «descuento del 15%» se aplicaba como descuento real.
 */
export interface ConDescuento {
  discountPercent?: number | null
  discountFixed?: number | null
}

export const porcentajeDe = (b: ConDescuento) => Math.min(100, Math.max(0, Number(b.discountPercent) || 0))

export const fijoDe = (b: ConDescuento) => Math.max(0, Number(b.discountFixed) || 0)

/** Lo que cuesta una habitación con su descuento: primero el porcentaje, luego el fijo. */
export const totalConDescuento = (estandar: number, b: ConDescuento) =>
  Math.max(0, Math.round((estandar * (1 - porcentajeDe(b) / 100) - fijoDe(b)) * 100) / 100)

/** Quita de las notas los textos de descuento que escribía la app. Las notas son solo notas. */
export const sinMarcasDeDescuento = (notas?: string | null) =>
  (notas || '')
    .replace(/\s*Descuento aplicado:\s*\d+(?:[.,]\d+)?%\.?/gi, '')
    .replace(/\s*Descuento fijo aplicado:\s*USD\s*\d+(?:[.,]\d+)?\.?/gi, '')
    .trim()
