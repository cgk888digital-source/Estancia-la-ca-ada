import type { SupabaseClient } from '@supabase/supabase-js'

interface SyncParams {
  fullName: string
  email: string
  phone: string
  bookingAmount: number
  /** Fecha de check-in de la reserva, para actualizar "última estadía". */
  stayDate: string
}

/**
 * Cada vez que se crea una reserva (desde la app del huésped o desde el Planner del admin),
 * el huésped debe aparecer automáticamente en Clientes / Email Marketing.
 *
 * Va por la función `sync_marketing_customer` de la base y no escribiendo en la tabla:
 *
 * 1. Desde la app del huésped la sesión es anónima, y el rol anónimo no tiene privilegios
 *    sobre `marketing_customers`. Escribiendo directo fallaba en silencio y esos clientes
 *    nunca entraban en la lista.
 * 2. Darle esos privilegios habría dejado la lista completa de clientes —nombres, correos
 *    y teléfonos— legible por cualquiera con la clave pública del sitio. La función solo
 *    se puede ejecutar: hace el alta por dentro y no devuelve datos.
 */
export async function syncMarketingCustomer(supabase: SupabaseClient, params: SyncParams) {
  const email = params.email.trim().toLowerCase()
  if (!email) return

  const { error } = await supabase.rpc('sync_marketing_customer', {
    p_full_name: params.fullName,
    p_email: email,
    p_phone: params.phone,
    p_booking_amount: params.bookingAmount,
    p_stay_date: params.stayDate,
  })

  // No debe tumbar la reserva, pero tampoco puede desaparecer sin dejar rastro.
  if (error) console.error('No se pudo registrar al huésped en Email Marketing:', error)
}
