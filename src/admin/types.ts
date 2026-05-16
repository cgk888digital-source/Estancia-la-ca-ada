export type TransactionType = 'ingreso' | 'egreso'

export type IncomeCategory = 'alojamiento' | 'restaurante' | 'excursiones' | 'bar_cava' | 'otros_ingresos'
export type ExpenseCategory = 'empleados' | 'alimentos' | 'mantenimiento' | 'servicios' | 'comisiones' | 'otros_egresos'
export type TransactionCategory = IncomeCategory | ExpenseCategory

export type PaymentMethod = 'efectivo' | 'transferencia' | 'tarjeta' | 'cheque'

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
}

export interface MonthlyData {
  month: string
  ingresos: number
  egresos: number
}
