import type { SupabaseClient } from '@supabase/supabase-js'

export type EstadoDePago = 'completo' | 'parcial' | 'pendiente'

export interface PagoSincronizado {
  id: string
  amountPaid: number
  paymentStatus: EstadoDePago
}

/**
 * Deja lo pagado y el estado de pago de una reserva —todas sus habitaciones— tal como
 * dicen los abonos guardados en la base de datos.
 *
 * Antes cada pantalla lo calculaba por su cuenta: sumaba el abono nuevo a lo que tenía en
 * memoria y decidía el estado mirando solo la habitación. Si la memoria estaba atrasada,
 * lo pagado quedaba mal. Si un paso fallaba a medias, el abono existía pero no contaba.
 * En un grupo, una habitación salía «Pagada» y las demás «Sin pago» aunque el grupo
 * estuviera a medias.
 *
 * Ahora:
 * - lo pagado de cada habitación es la suma de SUS abonos (el abono va a una sola fila);
 * - el estado es el del grupo entero y es igual en todas sus habitaciones.
 *
 * Las habitaciones anuladas no cuentan: sus abonos se trasladan al anular.
 */
export async function sincronizarPagosDelGrupo(
  supabase: SupabaseClient,
  ids: string[]
): Promise<{ error: string | null; filas: PagoSincronizado[] }> {
  if (ids.length === 0) return { error: null, filas: [] }

  const [reservas, abonos] = await Promise.all([
    supabase.from('bookings').select('id, total_amount, amount_paid, payment_status, status').in('id', ids),
    supabase.from('booking_payments').select('booking_id, amount').in('booking_id', ids),
  ])
  if (reservas.error) return { error: reservas.error.message, filas: [] }
  if (abonos.error) return { error: abonos.error.message, filas: [] }

  const activas = (reservas.data || []).filter(r => r.status !== 'anulada')
  const pagadoPorFila = new Map<string, number>()
  for (const a of abonos.data || []) {
    pagadoPorFila.set(a.booking_id, (pagadoPorFila.get(a.booking_id) || 0) + Number(a.amount || 0))
  }

  const redondear = (n: number) => Math.round(n * 100) / 100
  const totalGrupo = redondear(activas.reduce((s, r) => s + Number(r.total_amount || 0), 0))
  const pagadoGrupo = redondear(activas.reduce((s, r) => s + (pagadoPorFila.get(r.id) || 0), 0))
  const estado: EstadoDePago = totalGrupo > 0 && pagadoGrupo >= totalGrupo - 0.009
    ? 'completo'
    : pagadoGrupo > 0 ? 'parcial' : 'pendiente'

  const filas: PagoSincronizado[] = []
  for (const r of activas) {
    const pagado = redondear(pagadoPorFila.get(r.id) || 0)
    filas.push({ id: r.id, amountPaid: pagado, paymentStatus: estado })
    if (Math.abs(Number(r.amount_paid || 0) - pagado) > 0.009 || r.payment_status !== estado) {
      const { error } = await supabase
        .from('bookings')
        .update({ amount_paid: pagado, payment_status: estado })
        .eq('id', r.id)
      if (error) return { error: error.message, filas }
    }
  }
  return { error: null, filas }
}
