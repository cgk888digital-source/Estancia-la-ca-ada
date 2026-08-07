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
 * el huésped debe aparecer automáticamente en Clientes / Email Marketing — sin esto, cada
 * reserva quedaba aislada y había que cargar los contactos a mano o por Excel.
 */
export async function syncMarketingCustomer(supabase: SupabaseClient, params: SyncParams) {
  const email = params.email.trim().toLowerCase()
  if (!email) return

  const { data: existing } = await supabase
    .from('marketing_customers')
    .select('id, total_bookings, total_spent, last_stay_date')
    .eq('email', email)
    .maybeSingle()

  if (existing) {
    await supabase
      .from('marketing_customers')
      .update({
        full_name: params.fullName,
        phone: params.phone,
        total_bookings: (existing.total_bookings || 0) + 1,
        total_spent: (Number(existing.total_spent) || 0) + params.bookingAmount,
        last_stay_date: !existing.last_stay_date || params.stayDate > existing.last_stay_date
          ? params.stayDate
          : existing.last_stay_date
      })
      .eq('id', existing.id)
  } else {
    await supabase.from('marketing_customers').insert([{
      full_name: params.fullName,
      email,
      phone: params.phone,
      source: 'reserva',
      status: 'subscribed',
      consent_email: true,
      last_stay_date: params.stayDate,
      total_bookings: 1,
      total_spent: params.bookingAmount
    }])
  }
}
