import { supabase } from '../lib/supabase'
import type { Employee, EmployeeBonus } from '../admin/types'
import { dolaresDeBolivares } from './bolivares'

/**
 * El pago de la nómina de un empleado, partido en renglones.
 *
 * En Venezuela un mismo sueldo se paga a menudo por trozos: cien dólares en billetes y el
 * resto en bolívares por pago móvil, por ejemplo. Antes la app apuntaba un único pago por
 * transferencia por el sueldo entero, y la contabilidad no decía cómo había salido el
 * dinero de verdad — ni de qué caja, ni en qué moneda.
 *
 * Cada renglón es su propio apunte en Egresos, porque cada uno mueve dinero de un sitio
 * distinto: el efectivo en dólares sale de la caja chica en dólares, los bolívares del
 * fondo o de la cuenta del hotel. Los bonos pendientes van dentro de lo que se paga; ya no
 * tienen apunte aparte, pero siguen desglosados en la ficha del empleado y en su recibo.
 */

export type Moneda = 'usd' | 'bs'
export type MetodoDePago = 'efectivo' | 'transferencia' | 'pago_movil'
/** De dónde sale el dinero de un renglón en bolívares. */
export type OrigenBs = 'fondo' | 'cuenta'

export interface RenglonDePago {
  id: string
  moneda: Moneda
  metodo: MetodoDePago
  /** Solo en dólares. */
  dolares: string
  /** Solo en bolívares. */
  bolivares: string
  tasa: string
  origenBs: OrigenBs
}

/** Lo que el recibo necesita saber de cada parte del pago. */
export interface ParteDePago {
  metodo: string
  dolares: number
  bolivares: number | null
  tasa: number | null
}

export const metodosPorMoneda: Record<Moneda, MetodoDePago[]> = {
  usd: ['efectivo', 'transferencia'],
  bs: ['pago_movil', 'transferencia'],
}

export const etiquetaDeParte = (metodo: string, enBolivares: boolean) => {
  if (metodo === 'efectivo') return enBolivares ? 'Efectivo en bolívares' : 'Efectivo en dólares'
  if (metodo === 'pago_movil') return 'Pago móvil'
  if (metodo === 'transferencia') return enBolivares ? 'Transferencia en bolívares' : 'Transferencia en dólares'
  return metodo
}

let contador = 0
const nuevoId = () => `r${Date.now()}-${contador++}`

export const renglonVacio = (moneda: Moneda, tasaDeReferencia: number): RenglonDePago => ({
  id: nuevoId(),
  moneda,
  metodo: moneda === 'usd' ? 'efectivo' : 'pago_movil',
  dolares: '',
  bolivares: '',
  tasa: moneda === 'bs' && tasaDeReferencia > 0 ? String(tasaDeReferencia) : '',
  origenBs: 'cuenta',
})

/**
 * El pago de siempre, en un solo renglón: bolívares por transferencia desde la cuenta del
 * hotel, a la tasa del euro. Es lo que hacía la app antes sin preguntar; se deja como
 * punto de partida para que el caso normal siga siendo un solo clic.
 */
export const renglonPorDefecto = (total: number, tasa: number): RenglonDePago => {
  if (!(tasa > 0)) {
    return { ...renglonVacio('usd', 0), metodo: 'transferencia', dolares: total.toFixed(2) }
  }
  return {
    ...renglonVacio('bs', tasa),
    metodo: 'transferencia',
    bolivares: (Math.round(total * tasa * 100) / 100).toFixed(2),
  }
}

/** Dólares que cubre un renglón. En bolívares salen de dividir por la tasa. */
export const dolaresDeRenglon = (r: RenglonDePago): number => {
  if (r.moneda === 'bs') return dolaresDeBolivares(r.bolivares, r.tasa)
  const n = Number(String(r.dolares).replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0
}

export const sumaDeRenglones = (renglones: RenglonDePago[]) =>
  Math.round(renglones.reduce((s, r) => s + dolaresDeRenglon(r), 0) * 100) / 100

/** Un céntimo de margen: dividir bolívares entre una tasa con ocho decimales casi nunca
 *  da la cifra exacta, y exigir la exactitud dejaría el botón bloqueado sin motivo. */
export const TOLERANCIA = 0.01

export const renglonCompleto = (r: RenglonDePago) => {
  if (r.moneda === 'usd') return dolaresDeRenglon(r) > 0
  const bs = Number(String(r.bolivares).replace(',', '.'))
  const t = Number(String(r.tasa).replace(',', '.'))
  return bs > 0 && t > 0
}

/** Caja chica de la que sale un renglón, o null si sale del banco. El efectivo en dólares
 *  sale siempre de la caja chica en dólares: es la única caja con billetes. */
export const cajaDeRenglon = (r: RenglonDePago): 'usd' | 'bs' | null => {
  if (r.moneda === 'usd') return r.metodo === 'efectivo' ? 'usd' : null
  return r.origenBs === 'fondo' ? 'bs' : null
}

export interface ResultadoPagoNomina {
  partes: ParteDePago[]
  bonosCobrados: EmployeeBonus[]
  total: number
  error: string | null
}

/**
 * Registra el pago de un empleado.
 *
 * El orden importa. Primero se «reclama» el pago —para un fijo, pasar de pendiente a
 * pagado solo si seguía pendiente—: así un doble clic, o dos dispositivos a la vez, no
 * pagan dos veces. Luego se escriben los apuntes, y si fallan se devuelve el reclamo para
 * que el empleado siga pendiente. Los bonos se marcan pagados al final, cuando el dinero
 * ya está apuntado.
 */
export async function registrarPagoDeNomina(opciones: {
  emp: Employee
  renglones: RenglonDePago[]
  concepto: string
  fecha: string
  bonosPendientes: EmployeeBonus[]
  /** Lo que se le debía. Si los renglones se quedan a un céntimo por el redondeo de la
   *  tasa, el último renglón lo absorbe para que la suma apuntada sea exacta. */
  totalEsperado: number
}): Promise<ResultadoPagoNomina> {
  const { emp, renglones, concepto, fecha, bonosPendientes, totalEsperado } = opciones
  const vacio = { partes: [], bonosCobrados: [], total: 0 }
  const esFijo = emp.employeeType === 'fijo'
  const pagoAnterior = emp.lastPayment || null

  // 1. Reclamar el pago
  const reclamo = supabase
    .from('employees')
    .update({ pending_payment: false, last_payment: fecha })
    .eq('id', emp.id)
  const { data: reclamados, error: eReclamo } = esFijo
    ? await reclamo.eq('pending_payment', true).select('id')
    : await reclamo.select('id')

  if (eReclamo) return { ...vacio, error: 'No se pudo registrar el pago: ' + eReclamo.message }
  if (!reclamados || reclamados.length === 0) {
    return { ...vacio, error: `El pago de ${emp.name} ya estaba registrado. No se ha apuntado nada otra vez.` }
  }

  // 2. Un apunte por renglón
  const varios = renglones.length > 1
  const apuntes = renglones.map(r => {
    const enBs = r.moneda === 'bs'
    const dolares = dolaresDeRenglon(r)
    return {
      date: fecha,
      type: 'egreso',
      category: 'empleados',
      description: varios
        ? `${concepto} — ${emp.name} · ${etiquetaDeParte(r.metodo, enBs).toLowerCase()}`
        : `${concepto} — ${emp.name}`,
      amount: dolares,
      payment_method: r.metodo,
      related_to: emp.name,
      exchange_rate: enBs ? Number(String(r.tasa).replace(',', '.')) : null,
      amount_bs: enBs ? Number(String(r.bolivares).replace(',', '.')) : null,
      cash_box: cajaDeRenglon(r),
    }
  })

  const suma = apuntes.reduce((s, a) => s + a.amount, 0)
  const descuadre = Math.round((totalEsperado - suma) * 100) / 100
  if (descuadre !== 0 && Math.abs(descuadre) <= TOLERANCIA && apuntes.length > 0) {
    const ultimo = apuntes[apuntes.length - 1]
    ultimo.amount = Math.round((ultimo.amount + descuadre) * 100) / 100
  }

  const { error: eApuntes } = await supabase.from('transactions').insert(apuntes)
  if (eApuntes) {
    // Se devuelve el reclamo: sin apuntes, el empleado no está pagado.
    await supabase
      .from('employees')
      .update({ pending_payment: esFijo ? true : emp.pendingPayment, last_payment: pagoAnterior })
      .eq('id', emp.id)
    return { ...vacio, error: 'No se pudo apuntar el pago en Egresos: ' + eApuntes.message + '. No se ha registrado nada.' }
  }

  const partes: ParteDePago[] = apuntes.map(a => ({
    metodo: a.payment_method,
    dolares: a.amount,
    bolivares: a.amount_bs,
    tasa: a.exchange_rate,
  }))
  const total = Math.round(apuntes.reduce((s, a) => s + a.amount, 0) * 100) / 100

  // 3. Los bonos pendientes quedan pagados con este pago
  let bonosCobrados: EmployeeBonus[] = []
  let error: string | null = null
  if (bonosPendientes.length > 0) {
    const { data, error: eBonos } = await supabase
      .from('employee_bonuses')
      .update({ paid: true, paid_at: fecha })
      .in('id', bonosPendientes.map(b => b.id))
      .eq('paid', false)
      .select('id')
    if (eBonos) {
      error = `El pago de ${emp.name} quedó apuntado, pero los bonos no se pudieron marcar como `
        + `pagados (${eBonos.message}). Márquelos a mano o se volverán a sumar en la próxima nómina.`
    } else {
      const ids = new Set((data || []).map(b => b.id))
      bonosCobrados = bonosPendientes
        .filter(b => ids.has(b.id))
        .map(b => ({ ...b, paid: true, paidAt: fecha }))
    }
  }

  return { partes, bonosCobrados, total, error }
}
