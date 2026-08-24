import { parseLocalDate } from './dateUtils'

/**
 * Voucher de reserva en HTML, con la misma estructura del comprobante de Paxer que ya
 * conoce la clienta: datos de la reserva, del huésped, de la habitación, el desglose de
 * costos, los pagos recibidos y las condiciones del hotel.
 *
 * Va como cuerpo del correo (no como PDF adjunto): así se abre directo en el teléfono
 * sin descargar nada, y el mismo HTML sirve para imprimir desde el navegador.
 */

const HOTEL = {
  name: 'Estancia La Cañada',
  phone: '+58 414-129-4308',
  email: 'escagueyelc@gmail.com',
  address: 'Escagüey 5129, Mucurubá, Mérida, Venezuela',
}

/** Condiciones tal como aparecen en el voucher que emite el hotel hoy. */
const CONDITIONS = [
  'En caso de que el cliente no se presente en la posada (no show), salidas anticipadas, o no avise con tiempo la asistencia, el monto total pagado no será reembolsado y no podrá ser utilizado como crédito para una futura reserva.',
  'En caso de realizar cambios en la reserva, hasta 15 días antes de la fecha de llegada, no se generará ningún cargo al depósito realizado, el cual se mantendrá como crédito a favor del cliente para usarlo en un lapso de 1 año a partir de la fecha de la reserva.',
]

export interface VoucherRoom {
  title: string
  capacity?: number
  nights: number
  adults: number
  children?: number
  /** Tarifa aplicada, p. ej. "Temporadas" o "Temporada Navideña". */
  plan?: string
  cost: number
}

export interface VoucherPayment {
  date: string
  amount: number
  method: string
  status?: string
  /** Número de operación / referencia bancaria. */
  reference?: string
}

export interface VoucherData {
  locator: string
  guestName: string
  guestEmail: string
  guestPhone?: string
  guestCi?: string
  companions?: string
  /** De dónde vino la reserva: "Local" (la carga el hotel) o "App web" (la hace el huésped). */
  channel?: string
  createdAt?: Date
  checkIn: string
  checkOut: string
  nights: number
  guestsCount: number
  paymentMethod?: string
  totalAmount: number
  amountPaid: number
  rooms: VoucherRoom[]
  payments?: VoucherPayment[]
}

/** Los nombres y notas los escribe una persona: hay que escaparlos o rompen el HTML. */
const esc = (s: string | number | undefined | null) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const fmtDate = (dateStr: string) =>
  parseLocalDate(dateStr).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })

const fmtDateTime = (d: Date) =>
  `${d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })} - ${d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`

const fmtMoney = (n: number) =>
  `US$ ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const methodLabels: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta',
  cheque: 'Cheque',
  zelle: 'Zelle',
}

/** Mismo criterio que usa el hotel en Paxer para la línea de "Estatus". */
export function voucherStatusLabel(totalAmount: number, amountPaid: number) {
  if (amountPaid >= totalAmount && totalAmount > 0) return 'Pagada (Reserva confirmada)'
  if (amountPaid > 0) return 'Abonada (Reserva confirmada)'
  return 'Pendiente de pago'
}

// --- Piezas de la tabla, en HTML de correo (todo en línea, sin clases) ---

const C = {
  ink: '#2E2118',
  muted: '#6B5D4F',
  line: '#E6DCC9',
  head: '#3D2B1F',
  gold: '#C5A059',
  soft: '#F4EFE6',
}

const sectionTitle = (text: string) => `
  <tr><td colspan="2" style="background:${C.soft};padding:8px 12px;font-size:13px;font-weight:bold;color:${C.ink};border-top:1px solid ${C.line};border-bottom:1px solid ${C.line};">
    ${esc(text)}
  </td></tr>`

const row = (label: string, value: string, highlight = false) => `
  <tr>
    <td style="padding:6px 12px;font-size:12px;color:${C.muted};text-align:right;width:45%;vertical-align:top;font-weight:bold;">${esc(label)}</td>
    <td style="padding:6px 12px;font-size:12px;color:${C.ink};vertical-align:top;${highlight ? `background:${C.gold};color:#fff;font-weight:bold;` : ''}">${value}</td>
  </tr>`

export function buildBookingVoucherHtml(data: VoucherData): string {
  const created = data.createdAt ?? new Date()
  const balance = Math.max(0, data.totalAmount - data.amountPaid)
  const credit = Math.max(0, data.amountPaid - data.totalAmount)
  const payments = data.payments ?? []

  const roomsHtml = data.rooms.map(r => `
    ${sectionTitle(`Habitación ${r.title}${r.capacity ? ` (${r.capacity} pax)` : ''}`)}
    <tr><td colspan="2" style="padding:6px 12px;font-size:11px;color:${C.muted};text-align:right;">
      ${esc(fmtDate(data.checkIn))} - ${esc(fmtDate(data.checkOut))} &nbsp;|&nbsp; Noches: ${esc(r.nights)} &nbsp;|&nbsp; Adultos ${esc(r.adults)}${r.children ? ` &nbsp;|&nbsp; Niños ${esc(r.children)}` : ''}
    </td></tr>
    ${r.plan ? row('Plan seleccionado', esc(r.plan)) : ''}
    ${row('Costo', esc(fmtMoney(r.cost)))}
  `).join('')

  const paymentsHtml = payments.length
    ? `<tr><td colspan="2" style="padding:10px 12px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
          <thead>
            <tr style="background:#F8F8F8;">
              <th style="padding:8px 6px;text-align:left;font-size:11px;color:${C.muted};border-bottom:1px solid ${C.line};">Monto</th>
              <th style="padding:8px 6px;text-align:left;font-size:11px;color:${C.muted};border-bottom:1px solid ${C.line};">Fecha</th>
              <th style="padding:8px 6px;text-align:left;font-size:11px;color:${C.muted};border-bottom:1px solid ${C.line};">Método</th>
            </tr>
          </thead>
          <tbody>
            ${payments.map(p => `
              <tr>
                <td style="padding:9px 6px;font-size:11px;font-weight:bold;color:${C.ink};border-bottom:1px solid ${C.line};">${esc(fmtMoney(p.amount))}</td>
                <td style="padding:9px 6px;font-size:11px;color:${C.ink};border-bottom:1px solid ${C.line};">${esc(fmtDate(p.date))}</td>
                <td style="padding:9px 6px;font-size:11px;color:${C.ink};border-bottom:1px solid ${C.line};">${esc(methodLabels[p.method] ?? p.method)}${p.reference ? `<br><span style="font-size:9px;color:${C.muted};">Ref. ${esc(p.reference)}</span>` : ''}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </td></tr>`
    : `<tr><td colspan="2" style="padding:8px 12px;font-size:12px;color:${C.muted};">Aún no se han registrado pagos.</td></tr>`

  return `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:${C.ink};background:#fff;">

  <!-- Encabezado del hotel -->
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
    <tr>
      <td style="background:${C.head};padding:20px 16px;text-align:center;">
        <div style="color:#fff;font-size:19px;font-weight:bold;letter-spacing:0.06em;">ESTANCIA LA CAÑADA</div>
        <div style="color:#D8C9AE;font-size:11px;margin-top:6px;">Teléfono: ${esc(HOTEL.phone)} &nbsp;·&nbsp; ${esc(HOTEL.email)}</div>
        <div style="color:#D8C9AE;font-size:11px;">${esc(HOTEL.address)}</div>
      </td>
    </tr>
  </table>

  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;border:1px solid ${C.line};border-top:none;">

    ${sectionTitle('Reserva')}
    ${row('Estatus', esc(voucherStatusLabel(data.totalAmount, data.amountPaid)), true)}
    ${row('Localizador', `<strong style="letter-spacing:0.08em;">${esc(data.locator)}</strong>`)}
    ${row('Canal', esc(data.channel ?? 'Local'))}
    ${row('Método de pago seleccionado', esc(data.paymentMethod ? (methodLabels[data.paymentMethod] ?? data.paymentMethod) : '—'))}
    ${row('Fecha entrada - salida', `${esc(fmtDate(data.checkIn))} - ${esc(fmtDate(data.checkOut))}`)}
    ${row('Noches', esc(data.nights))}
    ${row('Cantidad de pasajeros', esc(data.guestsCount))}
    ${row('Fecha creación', esc(fmtDateTime(created)))}

    <tr><td colspan="2" style="border-top:1px solid ${C.line};"></td></tr>
    ${row('Cliente', `<strong>${esc(data.guestName)}</strong>`)}
    ${row('Email', esc(data.guestEmail))}
    ${data.guestCi ? row('ID / Pasaporte', esc(data.guestCi)) : ''}
    ${data.guestPhone ? row('Teléfono', esc(data.guestPhone)) : ''}
    ${row('País', 'Venezuela')}
    ${data.companions ? row('Pasajeros', esc(data.companions)) : ''}

    ${roomsHtml}

    ${sectionTitle('Pagos recibidos')}
    ${paymentsHtml}

    ${sectionTitle('Resumen financiero')}
    ${row('Costo total', `<strong>${esc(fmtMoney(data.totalAmount))}</strong>`)}
    ${row('Monto abonado', `<strong style="color:#2F7A4E;">${esc(fmtMoney(data.amountPaid))}</strong>`)}
    ${row('Deuda del cliente', `<strong style="color:${balance > 0 ? '#B4462F' : '#2F7A4E'};">${esc(fmtMoney(balance))}</strong>`)}
    ${credit > 0 ? row('Saldo a favor del cliente', `<strong style="color:#2F7A4E;">${esc(fmtMoney(credit))}</strong>`) : ''}

    ${sectionTitle('Condiciones del Hotel')}
    <tr><td colspan="2" style="padding:10px 12px;">
      ${CONDITIONS.map(c => `<p style="margin:0 0 8px;font-size:11px;line-height:1.6;color:${C.muted};">${esc(c)}</p>`).join('')}
    </td></tr>

  </table>
</div>`
}
