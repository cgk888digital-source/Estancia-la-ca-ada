export type TransactionType = 'ingreso' | 'egreso'

export type IncomeCategory = 'alojamiento' | 'restaurante' | 'bebidas' | 'almuerzos' | 'pasapalos' | 'excursiones' | 'bar_cava' | 'otros_ingresos' | 'propinas'
export type ExpenseCategory = 'empleados' | 'alimentos' | 'mantenimiento' | 'servicios' | 'comisiones' | 'otros_egresos'
export type TransactionCategory = IncomeCategory | ExpenseCategory

export type PaymentMethod = 'efectivo' | 'transferencia' | 'pago_movil' | 'tarjeta' | 'cheque' | 'débito automático'

export interface Transaction {
  id: string
  date: string
  type: TransactionType
  category: TransactionCategory
  description: string
  amount: number
  paymentMethod: PaymentMethod
  relatedTo?: string
  /** Bolivares por dolar a los que se cambio. Null cuando se pago en dolares. */
  exchangeRate?: number | null
  /** Importe original en bolivares. `amount` es siempre el equivalente en dolares. */
  amountBs?: number | null
  /** Caja chica de la que salio el dinero, si salio de una. */
  cashBox?: 'usd' | 'bs' | null
}

export interface Employee {
  id: string
  name: string
  role: string
  salary: number
  status: 'activo' | 'inactivo'
  hireDate: string
  lastPayment: string
  pendingPayment: boolean
  employeeType: 'fijo' | 'eventual'
  paymentFrequency: 'quincenal' | 'mensual' | 'semanal' | 'por_dias'
  dailyRate: number
  contractedDays: number
  accumulatedTips?: number
}

/** Bono extra que se paga a un empleado junto con la nomina. Se apunta cuando se decide
 *  y queda pendiente hasta el dia del pago. */
export interface EmployeeBonus {
  id: string
  employeeId: string
  amount: number
  /** Motivo del bono. Puede ir vacio. */
  concept: string
  /** Dia en que se concede. */
  bonusDate: string
  paid: boolean
  /** Dia en que se cobro, null mientras siga pendiente. */
  paidAt: string | null
}

export interface MonthlyData {
  month: string
  ingresos: number
  egresos: number
}

export interface Booking {
  id: string
  guestName: string
  guestPhone: string
  guestEmail: string
  guestCi?: string
  companions?: string
  accommodationId: number
  checkIn: string
  checkOut: string
  guestsCount: {
    adults: number
    children: number
    babies: number
    pets: number
  }
  totalAmount: number
  amountPaid: number
  paymentStatus: 'completo' | 'parcial' | 'pendiente'
  paymentMethod: 'efectivo' | 'transferencia' | 'tarjeta' | 'cheque' | 'zelle' | 'pago_movil'
  paymentReference?: string
  status: 'checkout_hoy' | 'checkin_hoy' | 'ocupado' | 'confirmado' | 'limpieza'
  /** false = reserva recién creada por el huésped (BookingFlow), aún no revisada por el staff. */
  confirmed: boolean
  specialNotes?: string
  locator?: string
}

export interface BookingPayment {
  id: string
  bookingId: string
  paymentDate: string
  amount: number
  currency: string
  method: 'efectivo' | 'transferencia' | 'tarjeta' | 'cheque' | 'zelle' | 'pago_movil'
  reference?: string
  status: 'verificado' | 'pendiente'
  /** Tasa aplicada si el abono se cobro en bolivares. Null si se cobro en dolares. */
  exchangeRate?: number | null
  /** Bolivares que entraron de verdad. `amount` es siempre el equivalente en dolares. */
  amountBs?: number | null
}

export type CustomerStatus = 'subscribed' | 'unsubscribed' | 'prospect' | 'vip'
export type CampaignStatus = 'draft' | 'scheduled' | 'sent' | 'paused'
export type CampaignSegment = 'all' | 'subscribed' | 'vip' | 'prospect' | 'recent_guests' | 'no_recent_stay'

export interface MarketingCustomer {
  id: string
  fullName: string
  email: string
  phone: string
  source: string
  status: CustomerStatus
  tags: string[]
  consentEmail: boolean
  lastStayDate: string
  totalBookings: number
  totalSpent: number
  notes: string
  createdAt: string
}

export interface EmailTemplate {
  id: string
  name: string
  subject: string
  previewText: string
  body: string
  category: string
}

export interface EmailCampaign {
  id: string
  name: string
  subject: string
  previewText: string
  body: string
  segment: CampaignSegment
  status: CampaignStatus
  scheduledAt: string
  sentAt: string
  recipientCount: number
  openedCount: number
  clickedCount: number
  createdAt: string
}

