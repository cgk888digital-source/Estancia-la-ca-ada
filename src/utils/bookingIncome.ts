import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Lleva a Ingresos el dinero cobrado por hospedaje.
 *
 * El restaurante ya lo hacía —al cerrar una mesa se crea el ingreso— pero las reservas
 * no: los abonos se guardaban en `booking_payments` y ahí se quedaban. El resultado era
 * que TODO el dinero de hospedaje quedaba fuera de la contabilidad de la app, y el panel
 * mostraba meses con ingresos de restaurante y cero de alojamiento aunque hubiera
 * entrado dinero de reservas.
 *
 * Solo se contabiliza dinero verificado: las filas de `booking_payments`. El campo
 * `amount_paid` de la reserva no sirve, porque el huésped que reserva desde la app lo
 * rellena con el depósito que *promete* pagar, no con dinero recibido.
 */

/** Enlaza el ingreso con el abono que lo originó. Permite no duplicarlo y poder retirarlo. */
export const marcaDeAbono = (paymentId: string) => `abono:${paymentId}`

export interface BookingPaymentIncome {
  paymentId: string
  bookingId: string
  guestName: string
  locator?: string | null
  accommodationTitle?: string | null
  amount: number
  /** Fecha en que entró el dinero, no la de la estadía. */
  date: string
  method: string
  reference?: string | null
}

/**
 * Registra el ingreso de un abono. Si ese abono ya tiene su ingreso, no hace nada:
 * así se puede reintentar sin duplicar dinero en la contabilidad.
 */
export async function registrarIngresoDeAbono(
  supabase: SupabaseClient,
  p: BookingPaymentIncome
): Promise<{ error: string | null }> {
  const marca = marcaDeAbono(p.paymentId)

  const { data: yaExiste, error: errorBusqueda } = await supabase
    .from('transactions')
    .select('id')
    .eq('notes', marca)
    .limit(1)

  if (errorBusqueda) return { error: errorBusqueda.message }
  if (yaExiste && yaExiste.length > 0) return { error: null }

  const alojamiento = p.accommodationTitle?.trim()
  const referencia = p.locator?.trim() || p.bookingId.slice(0, 6).toUpperCase()

  const { error } = await supabase.from('transactions').insert({
    type: 'ingreso',
    category: 'alojamiento',
    description: alojamiento
      ? `Abono reserva ${referencia} — ${p.guestName} (${alojamiento})`
      : `Abono reserva ${referencia} — ${p.guestName}`,
    amount: p.amount,
    date: p.date,
    payment_method: p.method,
    reference: p.reference || null,
    reservation_id: p.bookingId,
    notes: marca,
  })

  return { error: error ? error.message : null }
}

/** Retira el ingreso de un abono que se elimina, para que la caja no cuadre de más. */
export async function retirarIngresoDeAbono(
  supabase: SupabaseClient,
  paymentId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('notes', marcaDeAbono(paymentId))

  return { error: error ? error.message : null }
}
