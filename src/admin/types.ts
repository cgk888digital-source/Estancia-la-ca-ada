export type TransactionType = 'ingreso' | 'egreso'

export type IncomeCategory = 'alojamiento' | 'restaurante' | 'bebidas' | 'almuerzos' | 'pasapalos' | 'excursiones' | 'bar_cava' | 'otros_ingresos'
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
  paymentFrequency: 'mensual' | 'semanal' | 'por_dias'
  dailyRate: number
  contractedDays: number
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
  specialNotes?: string
  locator?: string
}

