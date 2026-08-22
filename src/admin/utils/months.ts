import type { Transaction, TransactionType } from '../types'

/**
 * Meses del panel, en un solo sitio.
 *
 * Antes cada pantalla llevaba su propia tabla de meses escrita a mano
 * ('Nov' -> '2025-11', ... 'May' -> '2026-05') y sus propias etiquetas fijas: el
 * panel anunciaba "Mayo" mientras sumaba las cifras del mes en curso, y las
 * graficas seguian clavadas en un rango que ya habia pasado. Aqui se calcula
 * todo a partir de la fecha real para que no vuelva a divergir.
 */

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

/** '2026-08' — la clave con la que se comparan las fechas de las transacciones. */
export const monthKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

/** 'Agosto' o 'Ago' — el nombre que ve la dueña. */
export const monthName = (d: Date, style: 'long' | 'short' = 'long') =>
  cap(d.toLocaleDateString('es-VE', { month: style }).replace('.', ''))

export const shiftMonth = (d: Date, delta: number) =>
  new Date(d.getFullYear(), d.getMonth() + delta, 1)

/** Suma los ingresos o los egresos de un mes concreto. */
export const sumMonth = (list: Transaction[], prefix: string, type: TransactionType) =>
  list.filter(t => t.date.startsWith(prefix) && t.type === type)
    .reduce((s, t) => s + t.amount, 0)

/**
 * Los ultimos `count` meses terminando en `end` (hoy por defecto), con las cifras
 * reales de cada uno. Un mes sin movimientos vale cero: antes se rellenaba con
 * datos de demostracion y la dueña veia ingresos que nunca existieron.
 */
export const lastMonths = (list: Transaction[], count = 7, end: Date = new Date()) =>
  Array.from({ length: count }, (_, i) => {
    const d = shiftMonth(end, i - (count - 1))
    const prefix = monthKey(d)
    return {
      month: monthName(d, 'short'),
      ingresos: sumMonth(list, prefix, 'ingreso'),
      egresos: sumMonth(list, prefix, 'egreso'),
    }
  })
