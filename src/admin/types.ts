export type TransactionType = 'ingreso' | 'egreso'

export type IncomeCategory = 'alojamiento' | 'restaurante' | 'bebidas' | 'almuerzos' | 'pasapalos' | 'excursiones' | 'bar_cava' | 'otros_ingresos' | 'propinas'
export type ExpenseCategory = 'empleados' | 'alimentos' | 'mantenimiento' | 'servicios' | 'comisiones' | 'otros_egresos'
export type TransactionCategory = IncomeCategory | ExpenseCategory

export type PaymentMethod = 'efectivo' | 'transferencia' | 'tarjeta' | 'cheque' | 'débito automático'

export interface Transaction {
  id: string
  date: string
  type: TransactionType
  category: TransactionCategory
  description: string
  amount: number
  paymentMethod: PaymentMethod
  relatedTo?: string
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
  paymentMethod: 'efectivo' | 'transferencia' | 'tarjeta' | 'cheque'
  status: 'checkout_hoy' | 'checkin_hoy' | 'ocupado' | 'confirmado' | 'limpieza'
  /** false = reserva recién creada por el huésped (BookingFlow), aún no revisada por el staff. */
  confirmed: boolean
  specialNotes?: string
  locator?: string
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

