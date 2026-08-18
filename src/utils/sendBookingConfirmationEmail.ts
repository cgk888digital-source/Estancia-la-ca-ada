import type { SupabaseClient } from '@supabase/supabase-js'
import { parseLocalDate } from './dateUtils'

interface ConfirmationParams {
  email: string
  guestName: string
  locator: string
  accommodationTitle: string
  checkIn: string
  checkOut: string
  totalAmount: number
  /** Dinero REALMENTE recibido y verificado. Nunca un depósito calculado. */
  amountPaid: number
  /** Adelanto que el huésped todavía debe pagar para que la reserva quede firme. */
  depositDue?: number
  depositPercent?: number
}

const fmtDate = (dateStr: string) =>
  parseLocalDate(dateStr).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })

const fmtMoney = (n: number) =>
  new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

/**
 * Correo de confirmación automático apenas se crea una reserva (huésped o admin) — la
 * confirmación "real" sigue siendo por WhatsApp, esto es un respaldo por correo que llega
 * solo si hay un email real cargado. Un fallo aquí nunca debe tumbar el flujo de reserva.
 */
export async function sendBookingConfirmationEmail(supabase: SupabaseClient, params: ConfirmationParams) {
  const email = params.email.trim()
  if (!email) return

  const balance = params.totalAmount - params.amountPaid
  const firstName = params.guestName.trim().split(' ')[0]

  // Cuando todavía no ha entrado dinero, este correo NO puede hablar de "abonado":
  // solo del adelanto que hace falta pagar. El comprobante real se envía aparte,
  // cuando el pago quede registrado y verificado.
  const awaitingDeposit = params.amountPaid <= 0 && (params.depositDue ?? 0) > 0

  const moneyRows = awaitingDeposit
    ? `
          <p style="margin: 4px 0; font-size: 13px;"><strong>Costo Total:</strong> ${fmtMoney(params.totalAmount)}</p>
          <p style="margin: 4px 0; font-size: 13px;"><strong>A pagar para confirmar (${params.depositPercent ?? 50}%):</strong> ${fmtMoney(params.depositDue ?? 0)}</p>`
    : `
          <p style="margin: 4px 0; font-size: 13px;"><strong>Costo Total:</strong> ${fmtMoney(params.totalAmount)}</p>
          <p style="margin: 4px 0; font-size: 13px;"><strong>Abonado:</strong> ${fmtMoney(params.amountPaid)}</p>
          <p style="margin: 4px 0; font-size: 13px;"><strong>Saldo Pendiente:</strong> ${fmtMoney(balance)}</p>`

  const html = `
    <div style="font-family: Georgia, 'Times New Roman', serif; max-width: 480px; margin: 0 auto; color: #2E2118;">
      <div style="background: #3D2B1F; padding: 24px; text-align: center;">
        <h1 style="color: #fff; font-size: 20px; margin: 0; letter-spacing: 0.05em;">ESTANCIA LA CAÑADA</h1>
      </div>
      <div style="padding: 28px 24px; background: #F9F7F3;">
        <p style="font-size: 16px;">Hola ${firstName},</p>
        <p style="font-size: 14px; line-height: 1.6;">¡Gracias por su reservación!</p>
        <div style="background: #fff; border: 1px solid #E6DCC9; border-radius: 12px; padding: 16px; margin: 16px 0;">
          <p style="margin: 4px 0; font-size: 13px;"><strong>Localizador:</strong> ${params.locator}</p>
          <p style="margin: 4px 0; font-size: 13px;"><strong>Alojamiento:</strong> ${params.accommodationTitle}</p>
          <p style="margin: 4px 0; font-size: 13px;"><strong>Check-in:</strong> ${fmtDate(params.checkIn)}</p>
          <p style="margin: 4px 0; font-size: 13px;"><strong>Check-out:</strong> ${fmtDate(params.checkOut)}</p>
          <hr style="border: none; border-top: 1px solid #E6DCC9; margin: 10px 0;" />${moneyRows}
        </div>
        ${awaitingDeposit ? `<p style="font-size: 13px; color: #5A4C3E; line-height: 1.6; background: #FBF3E4; border-left: 3px solid #C5A059; padding: 10px 12px; margin: 0 0 14px;">Su cabaña queda apartada. Al recibir su pago le enviaremos el comprobante de reserva.</p>` : ''}
        <p style="font-size: 13px; color: #5A4C3E; line-height: 1.6;">Cualquier duda, respóndenos por WhatsApp. ¡Los esperamos en el páramo!</p>
      </div>
    </div>
  `

  try {
    const { error } = await supabase.functions.invoke('send-campaign', {
      body: {
        // Sin pago recibido la reserva no está confirmada todavía: el asunto no puede decir
        // que lo está, o el huésped se presenta creyendo que ya quedó firme.
        subject: awaitingDeposit
          ? `Solicitud de reserva recibida · ${params.locator} · Estancia La Cañada`
          : `Reserva confirmada · ${params.locator} · Estancia La Cañada`,
        html,
        recipients: [{ email, name: params.guestName }]
      }
    })
    if (error) console.error('Error enviando correo de confirmación:', error)
  } catch (err) {
    console.error('Error enviando correo de confirmación:', err)
  }
}
