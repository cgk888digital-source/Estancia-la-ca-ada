import { supabase } from '../lib/supabase'

/**
 * Las dos cajas chicas de la posada.
 *
 * La de DOLARES se llena sola con el efectivo en dolares que entra en el hotel, y de ella
 * salen los gastos que hay que pagar en efectivo. La de BOLIVARES la repone la propiedad
 * desde la cuenta del hotel cada semana o cada quincena, y de ella salen los pagos en
 * bolivares.
 *
 * Una caja NO es una categoria de gasto. Reponerla no es gastar —el dinero solo cambia de
 * sitio— y la compra que se paga desde ella sigue siendo alimentos, o mantenimiento, o lo
 * que sea. La caja es DE DONDE SALIO el dinero. Por eso el saldo no se guarda en ningun
 * lado: se calcula, y asi no puede quedarse desfasado.
 */

export type Caja = 'usd' | 'bs'
export type TipoMovimiento = 'reposicion' | 'retiro' | 'ajuste'

export interface MovimientoDeCaja {
  id: string
  box: Caja
  kind: TipoMovimiento
  /** En la moneda de la caja. Positivo suma al saldo, negativo lo resta. */
  amount: number
  date: string
  source: string
  notes: string
}

/** Lo minimo que hace falta de un movimiento de la contabilidad para cuadrar las cajas. */
export interface ApunteParaCaja {
  type: string
  amount: number
  amountBs?: number | null
  paymentMethod?: string | null
  cashBox?: Caja | null
}

interface DbMovimiento {
  id: string
  box: string
  kind: string
  amount: number | string
  date: string
  source: string | null
  notes: string | null
}

const mapear = (db: DbMovimiento): MovimientoDeCaja => ({
  id: db.id,
  box: db.box as Caja,
  kind: db.kind as TipoMovimiento,
  amount: Number(db.amount),
  date: db.date,
  source: db.source ?? '',
  notes: db.notes ?? '',
})

export async function cargarMovimientosDeCaja(): Promise<{
  movimientos: MovimientoDeCaja[]
  error: string | null
}> {
  const { data, error } = await supabase
    .from('cash_box_movements')
    .select('id, box, kind, amount, date, source, notes')
    .order('date', { ascending: false })

  if (error) return { movimientos: [], error: error.message }
  return { movimientos: (data || []).map(mapear), error: null }
}

export async function crearMovimientoDeCaja(m: {
  box: Caja
  kind: TipoMovimiento
  amount: number
  date: string
  source?: string
  notes?: string
}): Promise<{ movimiento: MovimientoDeCaja | null; error: string | null }> {
  const { data, error } = await supabase
    .from('cash_box_movements')
    .insert([{
      box: m.box,
      kind: m.kind,
      amount: m.amount,
      date: m.date,
      source: m.source?.trim() || null,
      notes: m.notes?.trim() || null,
    }])
    .select('id, box, kind, amount, date, source, notes')

  if (error) return { movimiento: null, error: error.message }
  if (!data || !data[0]) return { movimiento: null, error: 'No se pudo guardar el movimiento.' }
  return { movimiento: mapear(data[0]), error: null }
}

export async function borrarMovimientoDeCaja(id: string): Promise<string | null> {
  const { error } = await supabase.from('cash_box_movements').delete().eq('id', id)
  return error ? error.message : null
}

/** Un ingreso en efectivo con bolivares apuntados entro en la caja de bolivares; sin
 *  ellos, en la de dolares. */
export const cajaQueAlimenta = (apunte: ApunteParaCaja): Caja | null => {
  if (apunte.type !== 'ingreso') return null
  if ((apunte.paymentMethod ?? '') !== 'efectivo') return null
  return apunte.amountBs && apunte.amountBs > 0 ? 'bs' : 'usd'
}

export interface SaldosDeCaja {
  usd: number
  bs: number
  /** Egresos marcados como pagados desde la caja en bolivares pero sin los bolivares
   *  apuntados: no se pueden restar y hay que avisarlo en vez de callarlo. */
  egresosBsSinImporte: number
}

/**
 * Saldo de cada caja. Se calcula entero cada vez a partir de los apuntes y de los
 * movimientos: no hay un numero guardado que pueda quedarse viejo.
 */
export function calcularSaldos(
  apuntes: ApunteParaCaja[],
  movimientos: MovimientoDeCaja[]
): SaldosDeCaja {
  let usd = 0
  let bs = 0
  let egresosBsSinImporte = 0

  for (const a of apuntes) {
    const entra = cajaQueAlimenta(a)
    if (entra === 'usd') usd += a.amount
    else if (entra === 'bs') bs += a.amountBs || 0

    if (a.type === 'egreso' && a.cashBox === 'usd') usd -= a.amount
    if (a.type === 'egreso' && a.cashBox === 'bs') {
      if (a.amountBs && a.amountBs > 0) bs -= a.amountBs
      else egresosBsSinImporte++
    }
  }

  for (const m of movimientos) {
    if (m.box === 'usd') usd += m.amount
    else bs += m.amount
  }

  return {
    usd: Math.round(usd * 100) / 100,
    bs: Math.round(bs * 100) / 100,
    egresosBsSinImporte,
  }
}

export const etiquetaDeCaja: Record<Caja, string> = {
  usd: 'Caja chica en dólares',
  bs: 'Caja chica en bolívares',
}

export const etiquetaDeMovimiento: Record<TipoMovimiento, string> = {
  reposicion: 'Reposición',
  retiro: 'Retiro',
  ajuste: 'Ajuste por conteo',
}
