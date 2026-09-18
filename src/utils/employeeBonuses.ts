import { supabase } from '../lib/supabase'
import type { EmployeeBonus } from '../admin/types'

/**
 * Bonos extras de la nomina.
 *
 * La dueña reparte de vez en cuando un bono a un empleado —por un buen servicio, por una
 * temporada fuerte— y hasta ahora no habia donde apuntarlo: o se sumaba a mano al sueldo,
 * perdiendo el rastro de cuanto se va en bonos, o se olvidaba entre el dia que se promete
 * y el dia que se paga.
 *
 * El bono se apunta cuando se decide y queda PENDIENTE. El dia que se paga la nomina se
 * cobran todos los pendientes de ese empleado dentro del mismo pago (ver pagoNomina.ts):
 * en Egresos cada forma de pago es un apunte, y los bonos se ven desglosados en la ficha
 * del empleado y en su recibo. Cuanto se va en bonos sale de esta tabla.
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
