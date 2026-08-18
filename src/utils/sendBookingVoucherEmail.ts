import type { SupabaseClient } from '@supabase/supabase-js'
import { buildBookingVoucherHtml, type VoucherData } from './bookingVoucher'

/**
 * Comprobante de pago de una reserva, con la misma estructura del voucher de Paxer.
 *
 * Es distinto del correo de "gracias por su reservación", que sale al crear la reserva:
 * este solo se envía cuando hay dinero verificado. El "Abonado" que muestra viene de los
 * pagos registrados en `booking_payments`, nunca de un depósito calculado — si no, el
 * huésped recibiría un documento que dice haber pagado algo que todavía no pagó.
 */
export async function sendBookingVoucherEmail(supabase: SupabaseClient, data: VoucherData) {
  const email = data.guestEmail.trim()
  if (!email) return

  const firstName = data.guestName.trim().split(' ')[0]
  const pending = data.totalAmount - data.amountPaid

  const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 640px; margin: 0 auto; color: #2E2118;">
      <div style="padding: 24px 20px 8px; background: #F9F7F3;">
        <p style="font-size: 16px; margin: 0 0 8px;">Hola ${firstName},</p>
        <p style="font-size: 14px; line-height: 1.6; margin: 0 0 4px;">
          Hemos recibido su pago. ¡Gracias!
        </p>
        <p style="font-size: 13px; line-height: 1.6; color: #5A4C3E; margin: 0;">
          Le dejamos su comprobante de reserva. Consérvelo para su llegada.${
            pending > 0
              ? ' El saldo restante puede cancelarlo al momento del check-in.'
              : ''
          }
        </p>
      </div>
      ${buildBookingVoucherHtml(data)}
      <div style="padding: 18px 20px 28px; background: #F9F7F3;">
        <p style="font-size: 13px; color: #5A4C3E; line-height: 1.6; margin: 0;">
          Cualquier duda, respóndenos por WhatsApp. ¡Los esperamos en el páramo!
        </p>
      </div>
    </div>
  `

  try {
    const { error } = await supabase.functions.invoke('send-campaign', {
      body: {
        subject: `Comprobante de pago · ${data.locator} · Estancia La Cañada`,
        html,
        recipients: [{ email, name: data.guestName }]
      }
    })
    if (error) console.error('Error enviando el comprobante de pago:', error)
  } catch (err) {
    console.error('Error enviando el comprobante de pago:', err)
  }
}
