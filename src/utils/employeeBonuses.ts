import { supabase } from '../lib/supabase'
import type { Employee, EmployeeBonus } from '../admin/types'

/**
 * Bonos extras de la nomina.
 *
 * La dueña reparte de vez en cuando un bono a un empleado —por un buen servicio, por una
 * temporada fuerte— y hasta ahora no habia donde apuntarlo: o se sumaba a mano al sueldo,
 * perdiendo el rastro de cuanto se va en bonos, o se olvidaba entre el dia que se promete
 * y el dia que se paga.
 *
 * El bono se apunta cuando se decide y queda PENDIENTE. El dia que se paga la nomina se
 * cobran todos los pendientes de ese empleado, cada uno con su propio apunte en Egresos,
 * para que en cualquier momento se pueda ver cuanto se va en sueldos y cuanto en bonos.
 */

interface DbBonus {
  id: string
  employee_id: string
  amount: number | string
  concept: string | null
  bonus_date: string
  paid: boolean
  paid_at: string | null
}

/** Marca que enlaza el egreso con su bono. Es lo que impide pagarlo dos veces y lo que
 *  permite reconocer los apuntes de bono entre los de nomina. */
export const marcaDeBono = (id: string) => `bono:${id}`

export const esApunteDeBono = (notes?: string | null) =>
  String(notes ?? '').startsWith('bono:')

const mapear = (db: DbBonus): EmployeeBonus => ({
  id: db.id,
  employeeId: db.employee_id,
  amount: Number(db.amount),
  concept: db.concept ?? '',
  bonusDate: db.bonus_date,
  paid: db.paid,
  paidAt: db.paid_at,
})

export async function cargarBonos(): Promise<{ bonos: EmployeeBonus[]; error: string | null }> {
  const { data, error } = await supabase
    .from('employee_bonuses')
    .select('id, employee_id, amount, concept, bonus_date, paid, paid_at')
    .order('bonus_date', { ascending: false })

  if (error) return { bonos: [], error: error.message }
  return { bonos: (data || []).map(mapear), error: null }
}

export async function crearBono(
  employeeId: string,
  amount: number,
  concept: string,
  bonusDate: string
): Promise<{ bono: EmployeeBonus | null; error: string | null }> {
  const { data, error } = await supabase
    .from('employee_bonuses')
    .insert([{
      employee_id: employeeId,
      amount,
      concept: concept.trim() || null,
      bonus_date: bonusDate,
    }])
    .select('id, employee_id, amount, concept, bonus_date, paid, paid_at')

  if (error) return { bono: null, error: error.message }
  if (!data || !data[0]) return { bono: null, error: 'No se pudo guardar el bono.' }
  return { bono: mapear(data[0]), error: null }
}

/** Solo se borran los que todavia no se han pagado: uno ya pagado tiene su apunte en
 *  Egresos y borrarlo dejaria la contabilidad descuadrada. */
export async function borrarBonoPendiente(id: string): Promise<string | null> {
  const { error } = await supabase
    .from('employee_bonuses')
    .delete()
    .eq('id', id)
    .eq('paid', false)
  return error ? error.message : null
}

export const sumaDeBonos = (bonos: EmployeeBonus[]) =>
  bonos.reduce((s, b) => s + b.amount, 0)

export interface ResultadoPagoBonos {
  /** Bonos que han quedado pagados. Vacio si no habia ninguno pendiente. */
  pagados: EmployeeBonus[]
  total: number
  /** Mensaje para enseñar al usuario. Null si todo fue bien. */
  error: string | null
}

/**
 * Cobra los bonos pendientes de un empleado: los marca pagados y crea un egreso por cada
 * uno, aparte del de la nomina.
 *
 * Se marcan pagados ANTES de escribir en Egresos a proposito. Si fallara al reves, el
 * bono seguiria pendiente y se volveria a pagar en la siguiente nomina: se pagaria dos
 * veces. Asi el peor caso es que falte el apunte contable, que se avisa en pantalla y se
 * arregla a mano sin que nadie cobre de mas.
 */
export async function pagarBonosPendientes(
  emp: Employee,
  pendientes: EmployeeBonus[],
  fecha: string,
  bcvRate: number
): Promise<ResultadoPagoBonos> {
  if (pendientes.length === 0) return { pagados: [], total: 0, error: null }

  const ids = pendientes.map(b => b.id)

  // El `.eq('paid', false)` es lo que impide cobrar dos veces: si se pulsa Pagar dos
  // veces seguidas, o si la nomina se paga desde otro dispositivo a la vez, la segunda
  // pasada no encuentra ninguna fila sin pagar y no escribe nada en Egresos. Solo se
  // apunta lo que esta llamada ha cambiado de verdad, no lo que creia tener pendiente.
  const { data: cambiados, error: eMarcar } = await supabase
    .from('employee_bonuses')
    .update({ paid: true, paid_at: fecha })
    .in('id', ids)
    .eq('paid', false)
    .select('id, employee_id, amount, concept, bonus_date, paid, paid_at')

  if (eMarcar) {
    return { pagados: [], total: 0, error: `No se pudieron registrar los bonos: ${eMarcar.message}` }
  }

  const cobrados = (cambiados || []).map(mapear)
  if (cobrados.length === 0) return { pagados: [], total: 0, error: null }

  const total = sumaDeBonos(cobrados)

  const apuntes = cobrados.map(b => ({
    date: fecha,
    type: 'egreso',
    category: 'empleados',
    description: b.concept
      ? `Bono — ${emp.name} (${b.concept}) (Tasa BCV: ${bcvRate} Bs/€)`
      : `Bono — ${emp.name} (Tasa BCV: ${bcvRate} Bs/€)`,
    amount: b.amount,
    payment_method: 'transferencia',
    related_to: emp.name,
    notes: marcaDeBono(b.id),
  }))

  const { error: eApunte } = await supabase.from('transactions').insert(apuntes)

  const pagados = cobrados.map(b => ({ ...b, paid: true, paidAt: fecha }))

  if (eApunte) {
    return {
      pagados,
      total,
      error: `Los bonos de ${emp.name} quedaron marcados como pagados, pero NO se pudieron`
        + ` anotar en Egresos (${eApunte.message}). Apunte a mano un egreso de`
        + ` ${total.toFixed(2)} USD en la categoria Empleados.`,
    }
  }

  return { pagados, total, error: null }
}

/** Bonos que se cobraron el dia de un pago concreto, para poder reconstruir el recibo. */
export async function bonosPagadosEn(
  employeeId: string,
  fecha: string
): Promise<EmployeeBonus[]> {
  const { data, error } = await supabase
    .from('employee_bonuses')
    .select('id, employee_id, amount, concept, bonus_date, paid, paid_at')
    .eq('employee_id', employeeId)
    .eq('paid_at', fecha)

  if (error) return []
  return (data || []).map(mapear)
}
