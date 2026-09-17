/**
 * Cobros en bolivares.
 *
 * El precio de la habitacion esta siempre en dolares y ahi se queda: es lo que leen los
 * totales de la reserva y la contabilidad. Pero el huesped puede pagar en bolivares por
 * pago movil o transferencia, y entonces hay que guardar tambien lo que entro de verdad
 * —cuantos bolivares y a que tasa— o se pierde el rastro en cuanto pasa una semana.
 *
 * La tasa la elige quien cobra. La posada suele usar la del euro del BCV, pero no se da
 * por hecha: se enseña como referencia de un toque y se puede escribir otra.
 */

const aNumero = (valor: string | number) => Number(String(valor).replace(',', '.'))

/** Equivalente en dolares de unos bolivares a una tasa. Cero si falta algo. */
export const dolaresDeBolivares = (bolivares: string | number, tasa: string | number): number => {
  const bs = aNumero(bolivares)
  const t = aNumero(tasa)
  if (!Number.isFinite(bs) || !Number.isFinite(t) || bs <= 0 || t <= 0) return 0
  return Math.round((bs / t) * 100) / 100
}

const conDecimales = (n: number) =>
  n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** "Bs. 48.884,00 a 977,68" — como se enseña un cobro hecho en bolivares. */
export const textoEnBolivares = (bolivares?: number | null, tasa?: number | null) => {
  if (!bolivares || !tasa || bolivares <= 0 || tasa <= 0) return null
  return `Bs. ${conDecimales(bolivares)} a ${conDecimales(tasa)}`
}

export const formatoBolivares = (n: number) => `Bs. ${conDecimales(n)}`
