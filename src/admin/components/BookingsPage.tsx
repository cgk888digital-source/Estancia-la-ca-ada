import { useState, useMemo, useEffect, useRef } from 'react'
import {
  Calendar, Users, Check, LogIn, LogOut, Trash2, Search, Plus, X, Phone, Mail,
  Info, Baby, Sparkles, RefreshCw, Printer, Maximize2, Minimize2, Percent
} from 'lucide-react'
import { accommodationOptions, activeAccommodationOptions, getMaxCapacity } from '../../data/accommodations'
import LoadErrorBanner from './LoadErrorBanner'
import { registrarIngresoDeAbono, retirarIngresoDeAbono } from '../../utils/bookingIncome'
import { repartirNoches, precioEstancia } from '../../utils/seasonNights'
import { supabase } from '../../lib/supabase'
import type { Booking, BookingPayment } from '../types'
import PrintableReservationsReport from './PrintableReservationsReport'
import { parseLocalDate } from '../../utils/dateUtils'
import { syncMarketingCustomer } from '../../utils/syncMarketingCustomer'
import { useHotelSettings, getMealRates } from '../../utils/useHotelSettings'
import { sendBookingConfirmationEmail } from '../../utils/sendBookingConfirmationEmail'
import { sendBookingVoucherEmail } from '../../utils/sendBookingVoucherEmail'
import { useIsMobile } from '../../utils/useMediaQuery'
import { joinPersonName, splitPersonName } from '../../utils/personName'

// Helper to format currency
const fmt = (n: number) =>
  new Intl.NumberFormat('es-VE', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2
  }).format(n)

// Define status categories and their corresponding styling (premium design tokens)
const statusConfig = {
  checkin_hoy: {
    label: 'Check-In Hoy',
    bg: 'bg-amber-50 border-amber-200 text-amber-800',
    badge: 'bg-amber-100 text-amber-800 border-amber-300',
    bullet: 'bg-amber-500',
    icon: <LogIn size={15} />
  },
  checkout_hoy: {
    label: 'Check-Out Hoy',
    bg: 'bg-orange-50 border-orange-200 text-orange-800',
    badge: 'bg-orange-100 text-orange-800 border-orange-300',
    bullet: 'bg-orange-500',
    icon: <LogOut size={15} />
  },
  ocupado: {
    label: 'Ocupada',
    bg: 'bg-sky-50 border-sky-200 text-sky-800',
    badge: 'bg-sky-100 text-sky-800 border-sky-300',
    bullet: 'bg-sky-500',
    icon: <Users size={15} />
  },
  confirmado: {
    label: 'Confirmada (Futura)',
    bg: 'bg-indigo-50 border-indigo-200 text-indigo-800',
    badge: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    bullet: 'bg-indigo-500',
    icon: <Calendar size={15} />
  },
  limpieza: {
    label: 'Necesita Limpieza',
    bg: 'bg-rose-50 border-rose-200 text-rose-800',
    badge: 'bg-rose-100 text-rose-800 border-rose-300',
    bullet: 'bg-rose-500',
    icon: <RefreshCw size={15} />
  },
  disponible: {
    label: 'Disponible',
    bg: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    bullet: 'bg-emerald-500',
    icon: <Check size={15} />
  }
}

interface DbBooking {
  id: string
  guest_name: string
  guest_phone?: string | null
  guest_email?: string | null
  guest_ci?: string | null
  companions?: string | null
  accommodation_id: number
  check_in: string
  check_out: string
  adults?: number | null
  children?: number | null
  babies?: number | null
  pets?: number | null
  total_amount?: number | string | null
  amount_paid?: number | string | null
  payment_status?: string | null
  payment_method?: string | null
  payment_reference?: string | null
  status?: string | null
  confirmed?: boolean | null
  special_notes?: string | null
  locator?: string | null
}

interface DbBookingPayment {
  id: string
  booking_id: string
  payment_date: string
  amount: number | string
  currency: string
  method: string
  reference?: string | null
  status: string
}

const mapDbPaymentToReact = (db: DbBookingPayment): BookingPayment => ({
  id: db.id,
  bookingId: db.booking_id,
  paymentDate: db.payment_date,
  amount: Number(db.amount) || 0,
  currency: db.currency || 'USD',
  method: (db.method || 'transferencia') as BookingPayment['method'],
  reference: db.reference || '',
  status: (db.status || 'verificado') as BookingPayment['status']
})

interface DbAccommodation {
  id: number | string
  price: number | string
  december_price: number | string
  discount_percent?: number | string | null
}

interface GuestSuggestion {
  name: string
  phone: string
  email: string
  ci: string
  companions: string
}

const cleanGuestSuggestionName = (name: string) =>
  name.replace(/\s+\((?:Habitaci[oó]n\s+)?\d+\/\d+\)$/i, '').trim()

const cleanSavedGuestPhone = (phone?: string | null) =>
  phone === '+58 412-000-0000' ? '' : phone || ''

const cleanSavedGuestEmail = (email?: string | null) =>
  email === 'cliente@estancialacanada.com' ? '' : email || ''

const formatLocalDate = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const addDays = (date: Date, days: number) => {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + days)
  return nextDate
}

const todayDate = new Date()
const todayStr = formatLocalDate(todayDate)
const defaultCheckOutStr = formatLocalDate(addDays(todayDate, 3))
const todayLongLabel = todayDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })

// Mappers between DB format (snake_case) and React format (camelCase)
const mapDbBookingToReact = (db: DbBooking): Booking => ({
  id: db.id,
  guestName: db.guest_name,
  guestPhone: db.guest_phone || '',
  guestEmail: db.guest_email || '',
  guestCi: db.guest_ci || '',
  companions: db.companions || '',
  accommodationId: db.accommodation_id,
  checkIn: db.check_in,
  checkOut: db.check_out,
  guestsCount: {
    adults: db.adults || 1,
    children: db.children || 0,
    babies: db.babies || 0,
    pets: db.pets || 0
  },
  totalAmount: Number(db.total_amount) || 0,
  amountPaid: Number(db.amount_paid) || 0,
  paymentStatus: (db.payment_status || 'pendiente') as 'completo' | 'parcial' | 'pendiente',
  paymentMethod: (db.payment_method || 'transferencia') as 'efectivo' | 'transferencia' | 'tarjeta' | 'cheque' | 'zelle',
  paymentReference: db.payment_reference || '',
  status: (db.status || 'confirmado') as 'checkout_hoy' | 'checkin_hoy' | 'ocupado' | 'confirmado' | 'limpieza',
  confirmed: db.confirmed ?? true,
  specialNotes: db.special_notes || '',
  locator: db.locator || ''
})

const calculateNights = (startStr: string, endStr: string) => {
  if (!startStr || !endStr) return 1
  const start = new Date(startStr)
  const end = new Date(endStr)
  const diffTime = end.getTime() - start.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays > 0 ? diffDays : 1
}

/**
 * Las reservas migradas de Paxer guardan el descuento particular en las notas
 * (por ejemplo: "descuento del 10% exacto"). Las reservas nuevas creadas desde el
 * panel usan "Descuento aplicado: 10%". Reconocer ambos formatos permite conservar
 * el beneficio del huésped cuando se cambian fechas o alojamiento.
 */
const getBookingDiscountPercent = (notes?: string) => {
  const matches = [...(notes || '').matchAll(/descuento(?:\s+aplicado)?(?:\s+(?:del|de))?\s*:?\s*(\d+(?:[.,]\d+)?)\s*%/gi)]
  const lastMatch = matches.at(-1)
  if (!lastMatch) return 0
  const value = Number(lastMatch[1].replace(',', '.'))
  return Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0
}

const withBookingDiscountNote = (notes: string | undefined, percent: number) => {
  // El marcador administrado por la app va al final y prevalece sobre cualquier nota
  // histórica de Paxer. Se conserva incluso en 0% para poder quitar un descuento viejo.
  const withoutAppMarker = (notes || '')
    .replace(/\s*Descuento aplicado:\s*\d+(?:[.,]\d+)?%\.?/gi, '')
    .trim()
  return [withoutAppMarker, `Descuento aplicado: ${percent}%.`].filter(Boolean).join(' ')
}

/**
 * El descuento fijo se guarda por habitación para que una reserva grupal conserve
 * exactamente el mismo descuento total sin duplicarlo en cada fila de Supabase.
 */
const getBookingFixedDiscountAmount = (notes?: string) => {
  const matches = [...(notes || '').matchAll(/Descuento fijo aplicado:\s*USD\s*(\d+(?:[.,]\d+)?)/gi)]
  const lastMatch = matches.at(-1)
  if (!lastMatch) return 0
  const value = Number(lastMatch[1].replace(',', '.'))
  return Number.isFinite(value) ? Math.max(0, value) : 0
}

const withBookingFixedDiscountNote = (notes: string | undefined, amount: number) => {
  const withoutAppMarker = (notes || '')
    .replace(/\s*Descuento fijo aplicado:\s*USD\s*\d+(?:[.,]\d+)?\.?/gi, '')
    .trim()
  if (amount <= 0) return withoutAppMarker
  return [withoutAppMarker, `Descuento fijo aplicado: USD ${amount.toFixed(2)}.`].filter(Boolean).join(' ')
}

const getAdjustedBookingTotal = (standardTotal: number, notes?: string) => {
  const percent = getBookingDiscountPercent(notes)
  const fixedAmount = getBookingFixedDiscountAmount(notes)
  const afterPercent = standardTotal * (1 - percent / 100)
  return Math.max(0, Math.round((afterPercent - fixedAmount) * 100) / 100)
}

// Paleta calcada de Paxer (el software que la clienta ya usa) para que el color de cada
// reserva se vea igual en ambos sistemas: Reservado (azul cielo) → Sin pago (azul) →
// Pago parcial (naranja) → Pagado (verde).
type EffectivePaymentState = 'reservado' | 'sin_pago' | 'parcial' | 'pagado'

const getEffectivePaymentState = (booking: Pick<Booking, 'confirmed' | 'paymentStatus'>): EffectivePaymentState => {
  if (!booking.confirmed) return 'reservado'
  if (booking.paymentStatus === 'completo') return 'pagado'
  if (booking.paymentStatus === 'parcial') return 'parcial'
  return 'sin_pago'
}

const paymentStateLabels: Record<EffectivePaymentState, string> = {
  reservado: 'Reservado',
  sin_pago: 'Sin Pago',
  parcial: 'Pago Parcial',
  pagado: 'Pagado'
}

/** Píxeles que hay que recorrer para que un gesto cuente como arrastre y no como un toque. */
const DRAG_THRESHOLD_PX = 6

const getPaymentColorClasses = (booking: Pick<Booking, 'confirmed' | 'paymentStatus'>) => {
  const state = getEffectivePaymentState(booking)
  if (state === 'pagado') return { bg: 'bg-emerald-500/10 border-emerald-300 text-emerald-900', bullet: 'bg-emerald-500', text: 'text-emerald-600', badge: 'bg-emerald-100 border-emerald-300 text-emerald-800' }
  if (state === 'parcial') return { bg: 'bg-orange-500/10 border-orange-300 text-orange-900', bullet: 'bg-orange-500', text: 'text-orange-600', badge: 'bg-orange-100 border-orange-300 text-orange-800' }
  if (state === 'sin_pago') return { bg: 'bg-blue-500/10 border-blue-400 text-blue-900', bullet: 'bg-blue-600', text: 'text-blue-700', badge: 'bg-blue-100 border-blue-400 text-blue-900' }
  return { bg: 'bg-sky-500/10 border-sky-300 text-sky-900', bullet: 'bg-sky-400', text: 'text-sky-600', badge: 'bg-sky-100 border-sky-300 text-sky-800' }
}

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [monthPage, setMonthPage] = useState(1)
  const PAGE_SIZE = 20
  const [activeTab, setActiveTab] = useState<'dia' | 'semana' | 'mes'>('dia')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [editingGuest, setEditingGuest] = useState(false)
  const [savingGuest, setSavingGuest] = useState(false)
  const [editGuestForm, setEditGuestForm] = useState({
    firstName: '',
    lastName: '',
    ci: '',
    phone: '',
    email: '',
    companions: ''
  })
  const [addingRoomsToBooking, setAddingRoomsToBooking] = useState(false)
  const [additionalAccommodationIds, setAdditionalAccommodationIds] = useState<number[]>([])
  const [savingAdditionalRooms, setSavingAdditionalRooms] = useState(false)
  const [additionalGuests, setAdditionalGuests] = useState({ adults: 2, children: 0, babies: 0, pets: 0 })
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null)
  const [savingRoom, setSavingRoom] = useState(false)
  const [editRoomForm, setEditRoomForm] = useState({ accommodationId: 0, adults: 0, children: 0, babies: 0, pets: 0 })
  const [editingDates, setEditingDates] = useState(false)
  const [editDatesForm, setEditDatesForm] = useState({ checkIn: '', checkOut: '' })
  const [editingFinancials, setEditingFinancials] = useState(false)
  const [savingFinancials, setSavingFinancials] = useState(false)
  const [editDiscountPercent, setEditDiscountPercent] = useState(0)
  const [editFixedDiscountAmount, setEditFixedDiscountAmount] = useState(0)
  const [editingNotes, setEditingNotes] = useState(false)
  const [savingNotes, setSavingNotes] = useState(false)
  const [editNotes, setEditNotes] = useState('')
  // Historial de abonos de la reserva abierta (como en Paxer): cada pago con su fecha,
  // monto, método y número de operación, en vez de un solo monto acumulado.
  const [bookingPayments, setBookingPayments] = useState<BookingPayment[]>([])
  const [loadingPayments, setLoadingPayments] = useState(false)
  const [addingPayment, setAddingPayment] = useState(false)
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    date: todayStr,
    method: 'transferencia' as 'transferencia' | 'efectivo' | 'tarjeta' | 'cheque' | 'zelle',
    reference: ''
  })
  const [weekAnchor, setWeekAnchor] = useState(() => new Date(todayDate))
  // Como en Paxer: la administradora puede elegir un rango de fechas cualquiera (no solo semanas
  // de 7 días) y ver el planner con esas columnas exactas.
  const [weekViewMode, setWeekViewMode] = useState<'semana' | 'personalizado'>('semana')
  const [weekRangeFrom, setWeekRangeFrom] = useState('')
  const [weekRangeTo, setWeekRangeTo] = useState('')
  const [monthAnchor, setMonthAnchor] = useState(() => new Date(todayDate.getFullYear(), todayDate.getMonth(), 1))
  const [mesMode, setMesMode] = useState<'mes' | 'personalizado'>('mes')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [dragInfo, setDragInfo] = useState<{ bookingId: string; mode: 'move' | 'resize-left' | 'resize-right' } | null>(null)
  const [dragOverCell, setDragOverCell] = useState<string | null>(null)
  // Seleccionar un rango vacío arrastrando (mousedown en un día + hasta soltar en otro) para
  // abrir "Nueva Reserva" con check-in/check-out ya llenos, igual que en Paxer.
  const [rangeSelect, setRangeSelect] = useState<{ accId: number; startDateStr: string; endDateStr: string } | null>(null)
  // Modo "dos toques" del planner en táctil: día de entrada ya elegido, esperando el de salida.
  const [pendingCheckIn, setPendingCheckIn] = useState<{ accId: number; dateStr: string } | null>(null)
  // El planner ocupando toda la pantalla, para poder recorrerlo con el dedo desde el móvil.
  const [plannerFullscreen, setPlannerFullscreen] = useState(false)
  // Envío del comprobante de reserva por correo desde la ficha.
  const [sendingVoucher, setSendingVoucher] = useState(false)
  const [voucherSentFor, setVoucherSentFor] = useState<string | null>(null)

  // Modals
  const [showAddModal, setShowAddModal] = useState(false)

  // Custom rate states for manual bookings
  const [useCustomRate, setUseCustomRate] = useState(false)
  const [discountPercent, setDiscountPercent] = useState(0)
  const [locatorCode, setLocatorCode] = useState('')
  const [dbAccommodations, setDbAccommodations] = useState<DbAccommodation[]>([])
  const [selectedAccommodationIds, setSelectedAccommodationIds] = useState<number[]>([2])
  
  // Form State for creating a new booking
  const [form, setForm] = useState({
    guestFirstName: '',
    guestLastName: '',
    guestPhone: '',
    guestEmail: '',
    guestCi: '',
    companions: '',
    accommodationId: 2,
    checkIn: todayStr,
    checkOut: defaultCheckOutStr,
    adults: 2,
    children: 0,
    babies: 0,
    pets: 0,
    totalAmount: 180,
    amountPaid: 0,
    // Cuando se carga una reserva vieja (una migracion, un cobro de la semana pasada) el
    // dinero NO entro hoy. Sin este campo todos los abonos caian con la fecha de carga y
    // el mes en que se hizo la migracion aparecia inflado en Ingresos.
    paymentDate: todayStr,
    paymentMethod: 'transferencia' as 'transferencia' | 'efectivo' | 'tarjeta' | 'cheque' | 'zelle',
    paymentReference: '',
    specialNotes: ''
  })

  // Autocomplete state
  const [guestSuggestions, setGuestSuggestions] = useState<GuestSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const shouldShowGuestSuggestions = (form.guestFirstName.length >= 3 || form.guestLastName.length >= 3) && showSuggestions

  // Accommodation lookup helper
  const getAccommodation = (id: number) => accommodationOptions.find(o => o.id === id)

  const getBookingGroup = (booking: Booking) => booking.locator
    ? bookings.filter(item => item.locator === booking.locator)
    : [booking]

  // En el planner una reserva con varias habitaciones debe tener un solo estado visual.
  // El color se calcula con el costo y los abonos globales del localizador, no con la
  // columna de pago aislada de cada habitación.
  const getGroupPaymentView = (booking: Booking): Pick<Booking, 'confirmed' | 'paymentStatus'> => {
    const group = getBookingGroup(booking)
    const totalAmount = group.reduce((sum, room) => sum + room.totalAmount, 0)
    const amountPaid = group.reduce((sum, room) => sum + room.amountPaid, 0)
    const paymentStatus: Booking['paymentStatus'] = amountPaid >= totalAmount && totalAmount > 0
      ? 'completo'
      : amountPaid > 0 ? 'parcial' : 'pendiente'

    return {
      confirmed: group.every(room => room.confirmed),
      paymentStatus
    }
  }

  const getBookingPaymentColors = (booking: Booking) => getPaymentColorClasses(getGroupPaymentView(booking))
  const getBookingPaymentState = (booking: Booking) => getEffectivePaymentState(getGroupPaymentView(booking))

  // Desayuno + cena por noche, configurables desde Tarifas y Descuentos.
  const { settings: hotelSettings } = useHotelSettings()
  const mealRates = getMealRates(hotelSettings)

  const isMobile = useIsMobile()

  const getStandardRate = (accId: number, checkIn: string, checkOut: string, adults: number, children: number) => {
    // Cada noche se cobra a su propia temporada, habitacion y pension incluidas. La
    // navideña (21 dic - 7 ene, verificada en Paxer) puede cubrir solo parte de la
    // estadia, y en ella la pension del adulto sube.
    const noches = repartirNoches(checkIn, checkOut)

    const dbAcc = dbAccommodations.find(o => Number(o.id) === accId)
    let precioNormal: number
    let precioNavideno: number

    if (dbAcc) {
      const descuento = Number(dbAcc.discount_percent || 0)
      const conDescuento = (p: number) => descuento > 0 ? Math.round(p * (1 - descuento / 100)) : p
      precioNormal = conDescuento(Number(dbAcc.price))
      precioNavideno = conDescuento(Number(dbAcc.december_price))
    } else {
      // Fallback con las tarifas del grid de Paxer, ya sin los 6 de mas que llevaban.
      const acc = accommodationOptions.find(o => o.id === accId)
      if (!acc) return 0
      precioNormal = acc.price
      precioNavideno = acc.price
      if (accId === 1 || accId === 6 || accId === 7 || accId === 50 || accId === 51 || accId === 52) precioNavideno = 190
      else if (accId === 2 || accId === 4) precioNavideno = 344
      else if (accId >= 30 && accId <= 35) precioNavideno = 78 // Galería La Manita
      else if (accId >= 36 && accId <= 41) precioNavideno = 86 // Galería Llano Grande
    }

    return precioEstancia(
      noches,
      { normal: precioNormal, navidena: precioNavideno },
      { adulto: mealRates.perAdult, adultoNavideno: mealRates.perAdultNavidad, nino: mealRates.perChild },
      adults,
      children
    ).total
  }

  const allocateGuestsAcrossAccommodations = (ids: number[]) => {
    let adultsLeft = Number(form.adults)
    let childrenLeft = Number(form.children)
    let babiesLeft = Number(form.babies)
    let petsLeft = Number(form.pets)

    return ids.map((id, index) => {
      const capacity = getMaxCapacity(id) || adultsLeft + childrenLeft
      const adults = Math.min(adultsLeft, capacity)
      adultsLeft -= adults
      const children = Math.min(childrenLeft, Math.max(0, capacity - adults))
      childrenLeft -= children
      const babies = index === 0 ? babiesLeft : 0
      const pets = index === 0 ? petsLeft : 0
      babiesLeft -= babies
      petsLeft -= pets
      return { id, adults, children, babies, pets }
    })
  }

  const getGroupStandardRate = (ids: number[]) =>
    allocateGuestsAcrossAccommodations(ids).reduce(
      (sum, room) => sum + getStandardRate(room.id, form.checkIn, form.checkOut, room.adults, room.children),
      0
    )

  // Helper functions to open/close the manual booking modal safely
  const openAddModal = () => {
    setUseCustomRate(false)
    setDiscountPercent(0)
    setSelectedAccommodationIds([2])
    
    // Generate a unique booking locator code (e.g. LC-A4B7D)
    const newLocator = 'LC-' + Math.random().toString(36).substring(2, 7).toUpperCase()
    setLocatorCode(newLocator)
    
    setForm({
      guestFirstName: '',
      guestLastName: '',
      guestPhone: '',
      guestEmail: '',
      guestCi: '',
      companions: '',
      accommodationId: 2,
      checkIn: todayStr,
      checkOut: defaultCheckOutStr,
      adults: 2,
      children: 0,
      babies: 0,
      pets: 0,
      totalAmount: 180,
      amountPaid: 0,
      paymentDate: todayStr,
      paymentMethod: 'transferencia',
      paymentReference: '',
      specialNotes: ''
    })
    setShowSuggestions(false)
    setShowAddModal(true)
  }

  const closeAddModal = () => {
    setUseCustomRate(false)
    setDiscountPercent(0)
    setLocatorCode('')
    setShowAddModal(false)
  }

  // Derive rates on the fly to avoid useEffect sync triggers (React best practices)
  const standardRate = showAddModal
    ? getGroupStandardRate(selectedAccommodationIds)
    : 0

  const calculatedTotal = useCustomRate
    ? (discountPercent > 0 ? Math.round(standardRate * (1 - discountPercent / 100)) : form.totalAmount)
    : standardRate

  // Autocomplete effect
  useEffect(() => {
    if (!shouldShowGuestSuggestions) return
    let active = true

    const timer = setTimeout(async () => {
      // Busca coincidencias tanto por nombre como por apellido, para que la administradora
      // pueda encontrar al huésped aunque solo recuerde uno de los dos.
      const terms = [form.guestFirstName, form.guestLastName]
        .map(term => term.trim().replace(/[%,()]/g, ''))
        .filter(term => term.length >= 2)
      if (terms.length === 0) return
      const bookingFilter = terms.map(term => `guest_name.ilike.%${term}%`).join(',')
      const customerFilter = terms.map(term => `full_name.ilike.%${term}%`).join(',')

      // Reservas aporta cédula y acompañantes; Clientes aporta los datos de contacto
      // que pudieron actualizarse después. Se combinan para mostrar la ficha más completa.
      const [bookingsResult, customersResult] = await Promise.all([
        supabase
          .from('bookings')
          .select('guest_name, guest_phone, guest_email, guest_ci, companions, created_at')
          .or(bookingFilter)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('marketing_customers')
          .select('full_name, phone, email, updated_at')
          .or(customerFilter)
          .order('updated_at', { ascending: false })
          .limit(25)
      ])

      if (bookingsResult.error) console.error('No se pudo buscar huéspedes anteriores:', bookingsResult.error)
      if (customersResult.error) console.error('No se pudo buscar en Clientes:', customersResult.error)

      const unique = new Map<string, GuestSuggestion>()
      const mergeSuggestion = (incoming: GuestSuggestion, preferIncomingContact = false) => {
        const name = cleanGuestSuggestionName(incoming.name)
        const key = name.toLocaleLowerCase('es')
        const current = unique.get(key)
        if (!current) {
          unique.set(key, { ...incoming, name })
          return
        }
        unique.set(key, {
          name: current.name,
          phone: preferIncomingContact ? incoming.phone || current.phone : current.phone || incoming.phone,
          email: preferIncomingContact ? incoming.email || current.email : current.email || incoming.email,
          ci: current.ci || incoming.ci,
          companions: current.companions || incoming.companions
        })
      }

      for (const booking of bookingsResult.data || []) {
        mergeSuggestion({
          name: booking.guest_name,
          phone: cleanSavedGuestPhone(booking.guest_phone),
          email: cleanSavedGuestEmail(booking.guest_email),
          ci: booking.guest_ci || '',
          companions: booking.companions || ''
        })
      }

      for (const customer of customersResult.data || []) {
        mergeSuggestion({
          name: customer.full_name,
          phone: cleanSavedGuestPhone(customer.phone),
          email: cleanSavedGuestEmail(customer.email),
          ci: '',
          companions: ''
        }, true)
      }

      if (active) setGuestSuggestions(Array.from(unique.values()).slice(0, 10))
    }, 300)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [form.guestFirstName, form.guestLastName, shouldShowGuestSuggestions])

  // Seleccionar días libres en la Semana para abrir "Nueva Reserva" ya con las fechas
  // puestas. Conviven dos gestos, según cómo se use el planner:
  //
  //   ARRASTRAR (dedo o mouse) — se recorren las noches ocupadas y al soltar se abre el
  //   formulario. El último día arrastrado es la última NOCHE, así que el check-out es
  //   el día siguiente.
  //
  //   TOCAR CON EL DEDO — dos toques, como en Paxer: el primero fija el día de entrada
  //   y el segundo el día de SALIDA (ese mismo día es el check-out, no el siguiente).
  //   Arrastrar en un teléfono compite con el scroll de la página, así que este es el
  //   camino cómodo cuando la dueña está en la calle.
  //
  //   HACER CLIC CON EL MOUSE — un solo clic sigue abriendo una reserva de una noche,
  //   como funcionaba antes; no se le cambia el flujo a quien ya usa la computadora.
  //
  // Se usan pointer events (no mouse) para que el mismo código sirva con dedo y mouse. En
  // táctil el navegador captura el puntero en el elemento donde empezó el gesto, así que
  // `pointerenter` nunca llega a las demás celdas: hay que ubicar la celda de debajo con
  // elementsFromPoint.
  useEffect(() => {
    if (!rangeSelect) return

    const handlePointerMove = (e: PointerEvent) => {
      // Igual que al mover una reserva: unos pocos píxeles de temblor no son un arrastre.
      if (!rangeDraggedRef.current) {
        const start = rangeStartPosRef.current
        if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) < DRAG_THRESHOLD_PX) return
        rangeDraggedRef.current = true
      }

      const stack = document.elementsFromPoint(e.clientX, e.clientY)
      const cellEl = stack.find((el): el is HTMLElement => el instanceof HTMLElement && !!el.dataset.plannerCell)
      const key = cellEl?.dataset.plannerCell
      if (!key) return
      const [accIdStr, dateStr] = key.split('|')
      setRangeSelect(prev =>
        prev && prev.accId === Number(accIdStr) && prev.endDateStr !== dateStr
          ? { ...prev, endDateStr: dateStr }
          : prev
      )
    }

    const handlePointerUp = () => {
      const { accId, startDateStr, endDateStr } = rangeSelect
      const wasDrag = rangeDraggedRef.current
      const wasTouch = rangePointerTypeRef.current === 'touch'
      rangeStartPosRef.current = null
      rangeDraggedRef.current = false
      setRangeSelect(null)

      // `checkOutStr` es la fecha de salida real que se guarda en la reserva.
      const openWith = (checkInStr: string, checkOutStr: string) => {
        openAddModal()
        setSelectedAccommodationIds([accId])
        setForm(f => ({ ...f, accommodationId: accId, checkIn: checkInStr, checkOut: checkOutStr }))
        setPendingCheckIn(null)
      }

      if (wasDrag) {
        const [fromStr, toStr] = startDateStr <= endDateStr
          ? [startDateStr, endDateStr]
          : [endDateStr, startDateStr]
        openWith(fromStr, formatLocalDate(addDays(parseLocalDate(toStr), 1)))
        return
      }

      if (!wasTouch) {
        openWith(startDateStr, formatLocalDate(addDays(parseLocalDate(startDateStr), 1)))
        return
      }

      // Toque con el dedo: primer toque marca la entrada, segundo marca la salida.
      if (pendingCheckIn && pendingCheckIn.accId === accId) {
        if (startDateStr === pendingCheckIn.dateStr) {
          setPendingCheckIn(null) // tocar otra vez el mismo día cancela la selección
          return
        }
        if (startDateStr > pendingCheckIn.dateStr) {
          openWith(pendingCheckIn.dateStr, startDateStr)
          return
        }
      }
      // Primer toque, otra cabaña, o un día anterior: se reinicia desde aquí.
      setPendingCheckIn({ accId, dateStr: startDateStr })
    }

    // El navegador cancela el puntero cuando decide que el gesto era un desplazamiento
    // de la rejilla. Eso NO es un toque: si se tratara como tal, cada vez que ella
    // deslizara para ver más días quedaría marcado un día de entrada sin querer.
    const handlePointerCancel = () => {
      rangeStartPosRef.current = null
      rangeDraggedRef.current = false
      setRangeSelect(null)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerCancel)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerCancel)
    }
  }, [rangeSelect, pendingCheckIn])

  // Carga los abonos de todas las habitaciones que comparten el localizador. Así la
  // ficha financiera representa la reserva completa, no solo la fila que se tocó.
  useEffect(() => {
    let active = true

    const loadPayments = async () => {
      if (!selectedBooking) {
        setBookingPayments([])
        return
      }
      setLoadingPayments(true)
      const groupIds = selectedBooking.locator
        ? bookings.filter(item => item.locator === selectedBooking.locator).map(item => item.id)
        : [selectedBooking.id]
      const { data, error } = await supabase
        .from('booking_payments')
        .select('*')
        .in('booking_id', groupIds)
        .order('payment_date', { ascending: true })

      if (!active) return
      if (error) {
        console.error('Error fetching booking payments:', error)
        setBookingPayments([])
      } else {
        setBookingPayments((data || []).map(mapDbPaymentToReact))
      }
      setLoadingPayments(false)
    }

    loadPayments()
    return () => { active = false }
  }, [selectedBooking?.id, selectedBooking?.locator, bookings.length])

  const dragOverCellRef = useRef<string | null>(null)
  // Un simple click siempre dispara mousedown + mouseup, casi nunca con el mouse 100%
  // quieto — sin este umbral, ese jitter mínimo se leía como "mover la reserva a la celda
  // vecina" y corría las fechas al abrir la ficha con solo hacer click.
  const dragStartPosRef = useRef<{ x: number; y: number } | null>(null)
  const hasDraggedRef = useRef(false)

  // Equivalentes para la selección de días libres: distinguen arrastrar de tocar, y con
  // qué se hizo el gesto (el dedo abre el modo de dos toques, el mouse no).
  const rangeStartPosRef = useRef<{ x: number; y: number } | null>(null)
  const rangeDraggedRef = useRef(false)
  const rangePointerTypeRef = useRef<string>('mouse')

  useEffect(() => {
    let active = true

    const fetchBookings = async () => {
      // Build a 30-day-ago cutoff so we only fetch current & recent bookings
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const cutoffDate = thirtyDaysAgo.toISOString().substring(0, 10)

      // Run both queries in parallel for faster loading
      const [accommodationsResult, bookingsResult] = await Promise.all([
        // Solo las columnas que existen de verdad en la tabla. Pedir columnas
        // inexistentes (name, capacity, type) hacía que PostgREST rechazara la consulta
        // entera con 400 y dbAccommodations quedara siempre vacío: el planner terminaba
        // usando los precios del catálogo en código en vez de los que edita la clienta.
        supabase
          .from('accommodations')
          .select('id, price, december_price, discount_percent'),
        supabase
          .from('bookings')
          .select('*')
          .gte('check_out', cutoffDate)
          .order('created_at', { ascending: false })
      ])

      if (active && accommodationsResult.data) {
        setDbAccommodations(accommodationsResult.data)
      } else if (accommodationsResult.error) {
        // Si esto falla, las tarifas mostradas son las del código y no las de la base:
        // conviene que quede rastro en consola en vez de fallar en silencio.
        console.error('No se pudieron cargar las tarifas de accommodations:', accommodationsResult.error)
      }

      const { data, error } = bookingsResult

      if (!active) return

      if (error) {
        // Un planner lleno de reservas inventadas es peor que uno vacio: se avisa.
        console.error('Error fetching bookings from Supabase:', error)
        setLoadError(error.message)
      } else {
        setLoadError(null)
        setBookings((data || []).map(mapDbBookingToReact))
      }
      setLoading(false)
    }

    fetchBookings()

    return () => {
      active = false
    }
  }, [])

  // 1. Dynamic states calculation for TODAY's Day View
  const cabinStatesToday = useMemo(() => {
    return activeAccommodationOptions.map(acc => {
      // Find any booking affecting this cabin today
      // A booking occupies checkIn (inclusive) to checkOut (exclusive) or is checked out today
      const todayBooking = bookings.find(b => {
        if (b.accommodationId !== acc.id) return false
        
        // Match explicit status first
        if (b.status === 'checkout_hoy' && b.checkOut === todayStr) return true
        if (b.status === 'checkin_hoy' && b.checkIn === todayStr) return true
        if (b.status === 'limpieza' && b.checkOut === todayStr) return true
        
        // Dates boundaries check
        return todayStr >= b.checkIn && todayStr < b.checkOut
      })

      if (todayBooking) {
        return {
          accommodation: acc,
          booking: todayBooking,
          status: todayBooking.status
        }
      } else {
        return {
          accommodation: acc,
          booking: null,
          status: 'disponible' as const
        }
      }
    })
  }, [bookings])

  // 2. Grid calculation: 7 días fijos desde weekAnchor, o un rango de fechas cualquiera elegido
  // a mano ("Rango Personalizado", igual que el "Buscar por fecha" de Paxer).
  const dayInfoFromDate = (d: Date) => {
    const yr = d.getFullYear()
    const mo = String(d.getMonth() + 1).padStart(2, '0')
    const dy = String(d.getDate()).padStart(2, '0')
    return {
      dateStr: `${yr}-${mo}-${dy}`,
      label: d.toLocaleDateString('es-ES', { weekday: 'short' }),
      dayNum: d.getDate(),
      monthLabel: d.toLocaleDateString('es-ES', { month: 'short' })
    }
  }

  const weekDays = useMemo(() => {
    if (weekViewMode === 'personalizado' && weekRangeFrom && weekRangeTo && weekRangeFrom <= weekRangeTo) {
      const start = parseLocalDate(weekRangeFrom)
      const dayCount = Math.min(60, Math.round((parseLocalDate(weekRangeTo).getTime() - start.getTime()) / 86400000) + 1)
      return Array.from({ length: dayCount }, (_, i) => {
        const d = new Date(start)
        d.setDate(start.getDate() + i)
        return dayInfoFromDate(d)
      })
    }
    // Como en Paxer: se ven varias semanas de un vistazo (21 días) en vez de solo 7.
    // Son 21 también en el teléfono: recortarlo a 7 escondía las reservas que sí se ven
    // en la computadora. En pantalla chica las columnas se mantienen legibles y la
    // rejilla se desplaza de lado, con la columna de habitaciones fija a la izquierda.
    return Array.from({ length: 21 }, (_, i) => {
      const d = new Date(weekAnchor)
      d.setDate(weekAnchor.getDate() + i)
      return dayInfoFromDate(d)
    })
  }, [weekAnchor, weekViewMode, weekRangeFrom, weekRangeTo])

  const weekRangeLabel = useMemo(() => {
    const start = weekDays[0]
    const end = weekDays[weekDays.length - 1]
    if (!start || !end) return ''
    const startD = parseLocalDate(start.dateStr)
    const endD = parseLocalDate(end.dateStr)
    return `${startD.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} - ${endD.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}`
  }, [weekDays])

  const monthAnchorLabel = useMemo(() => {
    const label = monthAnchor.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
    return label.charAt(0).toUpperCase() + label.slice(1)
  }, [monthAnchor])

  // 3. Filters and Search Results
  const filteredBookings = useMemo(() => {
    return bookings.filter(b => {
      const acc = getAccommodation(b.accommodationId)
      const cabinName = acc ? acc.title.toLowerCase() : ''
      const guestName = b.guestName.toLowerCase()
      const locator = b.locator ? b.locator.toLowerCase() : ''
      const q = searchQuery.toLowerCase()
      return guestName.includes(q) || cabinName.includes(q) || locator.includes(q)
    })
  }, [bookings, searchQuery])

  // 3.b. "Mes" tab list: further narrowed to the selected month, or a custom date range
  const monthListBookings = useMemo(() => {
    let rangeStart: string | null = null
    let rangeEnd: string | null = null

    if (mesMode === 'personalizado') {
      if (!customFrom || !customTo) return []
      rangeStart = customFrom
      rangeEnd = customTo
    } else {
      const y = monthAnchor.getFullYear()
      const m = monthAnchor.getMonth()
      rangeStart = `${y}-${String(m + 1).padStart(2, '0')}-01`
      const lastDay = new Date(y, m + 1, 0).getDate()
      rangeEnd = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    }

    return filteredBookings.filter(b => b.checkIn <= rangeEnd! && b.checkOut >= rangeStart!)
  }, [filteredBookings, mesMode, monthAnchor, customFrom, customTo])

  const reportDateText = activeTab === 'dia'
    ? `Hoy, ${todayLongLabel}`
    : activeTab === 'semana'
      ? `Semana del ${weekRangeLabel}`
      : mesMode === 'personalizado'
        ? `Del ${customFrom || '—'} al ${customTo || '—'}`
        : `Mes de ${monthAnchorLabel}`

  // Memoized monthly revenue total (avoids inline reduce on every render)
  const totalMonthlyRevenue = useMemo(() => {
    return monthListBookings.reduce((s, b) => s + b.totalAmount, 0)
  }, [monthListBookings])

  // Key stats today
  const stats = useMemo(() => {
    const totalCabins = activeAccommodationOptions.length
    const occupied = cabinStatesToday.filter(c => c.status === 'ocupado').length
    const checkins = cabinStatesToday.filter(c => c.status === 'checkin_hoy').length
    const checkouts = cabinStatesToday.filter(c => c.status === 'checkout_hoy').length
    const cleaning = cabinStatesToday.filter(c => c.status === 'limpieza').length
    const available = cabinStatesToday.filter(c => c.status === 'disponible').length

    return {
      occupancyRate: Math.round(((occupied + checkouts) / totalCabins) * 100),
      checkins,
      checkouts,
      cleaning,
      available
    }
  }, [cabinStatesToday])

  // Interactive operations
  const handleCheckIn = async (bookingId: string) => {
    const { error } = await supabase
      .from('bookings')
      .update({ status: 'ocupado' })
      .eq('id', bookingId)

    if (error) {
      console.error('Error checking in:', error)
    } else {
      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: 'ocupado' } : b))
    }
    setSelectedBooking(null)
  }

  const handleCheckOut = async (bookingId: string) => {
    const { error } = await supabase
      .from('bookings')
      .update({ status: 'limpieza' })
      .eq('id', bookingId)

    if (error) {
      console.error('Error checking out:', error)
    } else {
      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: 'limpieza' } : b))
    }
    setSelectedBooking(null)
  }

  const handleMarkClean = async (accommodationId: number) => {
    const cleaningBooking = bookings.find(b => b.accommodationId === accommodationId && b.status === 'limpieza')
    if (cleaningBooking) {
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'checkout_hoy' })
        .eq('id', cleaningBooking.id)

      if (error) {
        console.error('Error marking clean:', error)
        return
      }
    }

    setBookings(prev => prev.map(b => 
      b.accommodationId === accommodationId && b.status === 'limpieza' 
        ? { ...b, status: 'checkout_hoy' }
        : b
    ))
  }

  /**
   * En una reserva grupal se anula solo la habitación: el precio del grupo baja, pero
   * el dinero que entregó el cliente no se toca. Los abonos que apuntaban a esa fila se
   * trasladan a otra habitación del mismo localizador y el total pagado se redistribuye.
   * Solo cuando se elimina la última habitación se eliminan también abonos e ingresos.
   */
  const handleDeleteBooking = async (bookingId: string) => {
    const booking = bookings.find(b => b.id === bookingId)
    if (!booking) return

    const groupBookings = booking.locator
      ? bookings.filter(b => b.locator === booking.locator)
      : [booking]
    const isGroupBooking = groupBookings.length > 1
    const accommodationTitle = getAccommodation(booking.accommodationId)?.title || 'la habitación seleccionada'
    const confirmationMessage = isGroupBooking
      ? `¿Anular solamente ${accommodationTitle}?\n\nSe restará ${fmt(booking.totalAmount)} del costo total. Las otras ${groupBookings.length - 1} ${groupBookings.length - 1 === 1 ? 'habitación permanecerá' : 'habitaciones permanecerán'} activas y todos los abonos del cliente se conservarán.`
      : '¿Estás segura de que deseas eliminar esta reserva? Se borrarán también sus abonos y los ingresos que generaron.'

    if (!confirm(confirmationMessage)) return

    if (isGroupBooking) {
      const remainingBookings = groupBookings.filter(room => room.id !== bookingId)
      const paymentTarget = remainingBookings[0]
      const groupPaidTotal = groupBookings.reduce((sum, room) => sum + room.amountPaid, 0)
      const { data: roomPaymentRows, error: readPaymentsError } = await supabase
        .from('booking_payments')
        .select('id')
        .eq('booking_id', bookingId)

      if (readPaymentsError) {
        console.error('No se pudieron comprobar los abonos de la habitación:', readPaymentsError)
        alert('No se pudo comprobar el historial de abonos. No se anuló la habitación.')
        return
      }

      const movedPaymentIds = (roomPaymentRows || []).map(payment => payment.id)
      const restoreRemainingPaidAmounts = async () => {
        await Promise.all(remainingBookings.map(room => supabase
          .from('bookings')
          .update({ amount_paid: room.amountPaid, payment_status: room.paymentStatus })
          .eq('id', room.id)
        ))
        setBookings(prev => prev.map(current => {
          const original = remainingBookings.find(room => room.id === current.id)
          return original ? { ...current, amountPaid: original.amountPaid, paymentStatus: original.paymentStatus } : current
        }))
        setSelectedBooking(prev => {
          if (!prev) return prev
          const original = remainingBookings.find(room => room.id === prev.id)
          return original ? { ...prev, amountPaid: original.amountPaid, paymentStatus: original.paymentStatus } : prev
        })
      }

      // El historial y su transacción de caja permanecen intactos. Solo cambia la fila
      // de habitación a la que apunta el abono para evitar pagos huérfanos.
      const { error: movePaymentsError } = await supabase
        .from('booking_payments')
        .update({ booking_id: paymentTarget.id })
        .eq('booking_id', bookingId)

      if (movePaymentsError) {
        console.error('No se pudieron trasladar los abonos de la habitación:', movePaymentsError)
        alert('No se pudo conservar correctamente el historial de abonos. No se anuló la habitación.')
        return
      }

      const paidAmountsSynced = await syncGroupPaidTotal(remainingBookings, groupPaidTotal)
      if (!paidAmountsSynced) {
        await restoreRemainingPaidAmounts()
        if (movedPaymentIds.length > 0) {
          await supabase.from('booking_payments').update({ booking_id: bookingId }).in('id', movedPaymentIds)
        }
        alert('No se pudo redistribuir el depósito. No se anuló la habitación.')
        return
      }

      const { error: deleteRoomError } = await supabase.from('bookings').delete().eq('id', bookingId)
      if (deleteRoomError) {
        console.error('Error deleting room from group booking:', deleteRoomError)
        await restoreRemainingPaidAmounts()
        if (movedPaymentIds.length > 0) {
          await supabase
            .from('booking_payments')
            .update({ booking_id: bookingId })
            .in('id', movedPaymentIds)
        }
        alert('No se pudo anular la habitación. Los abonos se conservaron.')
        return
      }

      setBookingPayments(prev => prev.map(payment => payment.bookingId === bookingId
        ? { ...payment, bookingId: paymentTarget.id }
        : payment
      ))
      setBookings(prev => prev.filter(room => room.id !== bookingId))
      setSelectedBooking(null)
      return
    }

    const { data: abonos, error: errorAbonos } = await supabase
      .from('booking_payments')
      .select('id')
      .eq('booking_id', bookingId)

    if (errorAbonos) {
      console.error('No se pudieron leer los abonos de la reserva:', errorAbonos)
      alert('No se pudo comprobar si la reserva tiene abonos. No se borró nada.')
      return
    }

    for (const abono of abonos || []) {
      const { error } = await retirarIngresoDeAbono(supabase, abono.id)
      if (error) {
        console.error('No se pudo retirar el ingreso del abono:', error)
        alert('No se pudo retirar de Ingresos el dinero de esta reserva. No se borró nada.')
        return
      }
    }

    if ((abonos || []).length > 0) {
      const { error } = await supabase.from('booking_payments').delete().eq('booking_id', bookingId)
      if (error) {
        console.error('No se pudieron borrar los abonos:', error)
        alert('No se pudieron borrar los abonos de la reserva. No se borró la reserva.')
        return
      }
    }

    const { error } = await supabase.from('bookings').delete().eq('id', bookingId)
    if (error) {
      console.error('Error deleting booking:', error)
      alert('No se pudo borrar la reserva. Vuelva a intentarlo.')
      return
    }

    setBookings(prev => prev.filter(b => b.id !== bookingId))
    setSelectedBooking(null)
  }

  // El abono pertenece a la reserva completa. Se distribuye entre las habitaciones solo
  // para mantener compatibles las columnas existentes, sin cambiar nunca el total pagado.
  const syncGroupPaidTotal = async (group: Booking[], paidTotal: number) => {
    const normalizedPaidTotal = Math.round(paidTotal * 100) / 100
    const groupTotal = group.reduce((sum, room) => sum + room.totalAmount, 0)
    const paymentStatus: Booking['paymentStatus'] = normalizedPaidTotal >= groupTotal
      ? 'completo'
      : normalizedPaidTotal > 0 ? 'parcial' : 'pendiente'

    // El depósito es global: se conserva una sola vez en la fila principal del grupo.
    // Las demás habitaciones no reciben porciones ficticias del pago.
    const updates = group.map((room, index) => ({
      id: room.id,
      amountPaid: index === 0 ? normalizedPaidTotal : 0,
      paymentStatus
    }))

    const results = await Promise.all(updates.map(update => supabase
      .from('bookings')
      .update({ amount_paid: update.amountPaid, payment_status: update.paymentStatus })
      .eq('id', update.id)
    ))
    const failed = results.find(result => result.error)
    if (failed?.error) {
      console.error('Error syncing group paid amounts:', failed.error)
      return false
    }

    const updatesById = new Map(updates.map(update => [update.id, update]))
    setBookings(prev => prev.map(room => {
      const update = updatesById.get(room.id)
      return update ? { ...room, ...update } : room
    }))
    setSelectedBooking(prev => {
      if (!prev) return prev
      const update = updatesById.get(prev.id)
      return update ? { ...prev, ...update } : prev
    })
    return true
  }

  const syncGroupPaidAmounts = async (group: Booking[], payments: BookingPayment[]) => {
    const paidTotal = payments.reduce((sum, payment) => sum + payment.amount, 0)
    await syncGroupPaidTotal(group, paidTotal)
  }

  const handleSaveBookingDiscount = async () => {
    if (!selectedBooking) return

    const percent = Math.min(100, Math.max(0, Number(editDiscountPercent) || 0))
    const groupBookings = getBookingGroup(selectedBooking)
    const standardTotals = groupBookings.map(room => getStandardRate(
      room.accommodationId,
      room.checkIn,
      room.checkOut,
      room.guestsCount.adults,
      room.guestsCount.children
    ))
    const totalsAfterPercent = standardTotals.map(total =>
      Math.max(0, Math.round(total * (1 - percent / 100) * 100) / 100)
    )
    const totalAfterPercent = totalsAfterPercent.reduce((sum, total) => sum + total, 0)
    const fixedDiscount = Math.min(
      totalAfterPercent,
      Math.max(0, Math.round((Number(editFixedDiscountAmount) || 0) * 100) / 100)
    )

    let remainingDiscountCents = Math.round(fixedDiscount * 100)
    const fixedDiscounts = totalsAfterPercent.map((total, index) => {
      const cents = index === totalsAfterPercent.length - 1
        ? remainingDiscountCents
        : Math.min(
          remainingDiscountCents,
          Math.round(fixedDiscount * 100 * (totalAfterPercent > 0 ? total / totalAfterPercent : 1 / totalsAfterPercent.length))
        )
      remainingDiscountCents -= cents
      return cents / 100
    })
    const newGroupTotal = Math.max(0, Math.round((totalAfterPercent - fixedDiscount) * 100) / 100)
    const groupPaid = groupBookings.reduce((sum, room) => sum + room.amountPaid, 0)
    const groupPaymentStatus: Booking['paymentStatus'] = groupPaid >= newGroupTotal
      ? 'completo'
      : groupPaid > 0 ? 'parcial' : 'pendiente'

    const updates = groupBookings.map((room, index) => {
      const totalAmount = Math.max(0, Math.round((totalsAfterPercent[index] - fixedDiscounts[index]) * 100) / 100)
      const notesWithPercent = withBookingDiscountNote(room.specialNotes, percent)
      return {
        id: room.id,
        totalAmount,
        paymentStatus: groupPaymentStatus,
        specialNotes: withBookingFixedDiscountNote(notesWithPercent, fixedDiscounts[index])
      }
    })

    setSavingFinancials(true)
    const results = await Promise.all(updates.map(update => supabase
      .from('bookings')
      .update({
        total_amount: update.totalAmount,
        payment_status: update.paymentStatus,
        special_notes: update.specialNotes
      })
      .eq('id', update.id)
    ))
    setSavingFinancials(false)

    const failed = results.find(result => result.error)
    if (failed?.error) {
      console.error('Error updating booking discount:', failed.error)
      alert('No se pudo actualizar el descuento. Intenta de nuevo.')
      return
    }

    const updatesById = new Map(updates.map(update => [update.id, update]))
    setBookings(prev => prev.map(room => {
      const update = updatesById.get(room.id)
      return update ? { ...room, ...update } : room
    }))
    setSelectedBooking(prev => {
      if (!prev) return prev
      const update = updatesById.get(prev.id)
      return update ? { ...prev, ...update } : prev
    })
    setEditingFinancials(false)
  }

  const handleAddPayment = async () => {
    if (!selectedBooking) return
    const amount = Number(paymentForm.amount)
    if (!amount || amount <= 0) {
      alert('Error: ingresa un monto de abono válido.')
      return
    }

    const groupBookings = getBookingGroup(selectedBooking)
    const groupTotal = groupBookings.reduce((sum, room) => sum + room.totalAmount, 0)
    const groupPaid = groupBookings.reduce((sum, room) => sum + room.amountPaid, 0)
    const pendingTotal = Math.max(0, groupTotal - groupPaid)
    if (amount > pendingTotal + 0.009) {
      alert(`El abono supera el saldo pendiente de la reserva (${fmt(pendingTotal)}).`)
      return
    }

    const newPayment = {
      booking_id: groupBookings[0].id,
      payment_date: paymentForm.date,
      amount: Math.round(amount * 100) / 100,
      currency: 'USD',
      method: paymentForm.method,
      reference: paymentForm.reference.trim() || null,
      status: 'verificado'
    }

    const { data, error } = await supabase
      .from('booking_payments')
      .insert(newPayment)
      .select('*')

    if (error || !data) {
      console.error('Error adding payment:', error)
      alert('Error al registrar el abono. Intenta de nuevo.')
      return
    }

    const insertedPayments = data.map(mapDbPaymentToReact)
    const updatedPayments = [...bookingPayments, ...insertedPayments]
      .sort((a, b) => a.paymentDate.localeCompare(b.paymentDate))
    setBookingPayments(updatedPayments)
    await syncGroupPaidAmounts(groupBookings, updatedPayments)

    for (const payment of insertedPayments) {
      const ingreso = await registrarIngresoDeAbono(supabase, {
        paymentId: payment.id,
        bookingId: payment.bookingId,
        guestName: selectedBooking.guestName,
        locator: selectedBooking.locator,
        accommodationTitle: groupBookings.length > 1 ? `${groupBookings.length} habitaciones` : getAccommodation(groupBookings[0].accommodationId)?.title,
        amount: payment.amount,
        date: paymentForm.date,
        method: paymentForm.method,
        reference: paymentForm.reference.trim() || null,
      })
      if (ingreso.error) {
        console.error('El abono se guardó pero no llegó a Ingresos:', ingreso.error)
        alert('El abono quedó registrado, pero no llegó a Ingresos. Avise a soporte antes de cerrar la caja.')
      }
    }

    setAddingPayment(false)
    setPaymentForm({ amount: '', date: todayStr, method: 'transferencia', reference: '' })

    if (selectedBooking.guestEmail.trim()) {
      const totalAmount = groupBookings.reduce((sum, room) => sum + room.totalAmount, 0)
      const amountPaid = updatedPayments.reduce((sum, payment) => sum + payment.amount, 0)
      sendBookingVoucherEmail(supabase, {
        locator: selectedBooking.locator || selectedBooking.id.slice(0, 6).toUpperCase(),
        guestName: selectedBooking.guestName.replace(/\s+\(\d+\/\d+\)$/, ''),
        guestEmail: selectedBooking.guestEmail,
        guestPhone: selectedBooking.guestPhone,
        guestCi: selectedBooking.guestCi,
        companions: selectedBooking.companions,
        channel: 'Local',
        checkIn: selectedBooking.checkIn,
        checkOut: selectedBooking.checkOut,
        nights: calculateNights(selectedBooking.checkIn, selectedBooking.checkOut),
        guestsCount: groupBookings.reduce((sum, room) => sum + room.guestsCount.adults + room.guestsCount.children, 0),
        paymentMethod: paymentForm.method,
        totalAmount,
        amountPaid,
        rooms: groupBookings.map(room => ({
          title: getAccommodation(room.accommodationId)?.title || `Alojamiento ${room.accommodationId}`,
          capacity: getMaxCapacity(room.accommodationId),
          nights: calculateNights(room.checkIn, room.checkOut),
          adults: room.guestsCount.adults,
          children: room.guestsCount.children,
          cost: room.totalAmount
        })),
        payments: updatedPayments.map(payment => ({
          date: payment.paymentDate,
          amount: payment.amount,
          method: payment.method,
          status: payment.status,
          reference: payment.reference
        }))
      }).catch(err => console.error('Error enviando el comprobante grupal:', err))
    }
  }

  const handleDeletePayment = async (payment: BookingPayment) => {
    if (!selectedBooking) return
    if (!confirm(`¿Eliminar el abono de ${fmt(payment.amount)} del ${payment.paymentDate}?`)) return

    const { error } = await supabase
      .from('booking_payments')
      .delete()
      .eq('id', payment.id)

    if (error) {
      console.error('Error deleting payment:', error)
      alert('Error al eliminar el abono. Intenta de nuevo.')
      return
    }

    // Si el abono desaparece, su ingreso también: si no, la caja cuadraría de más.
    const retirado = await retirarIngresoDeAbono(supabase, payment.id)
    if (retirado.error) {
      console.error('No se pudo retirar el ingreso del abono eliminado:', retirado.error)
      alert('El abono se eliminó, pero su ingreso sigue en la contabilidad. Avise a soporte.')
    }

    const updatedPayments = bookingPayments.filter(p => p.id !== payment.id)
    setBookingPayments(updatedPayments)
    await syncGroupPaidAmounts(getBookingGroup(selectedBooking), updatedPayments)
  }

  const handleConfirmBooking = async (bookingId: string) => {
    const { error } = await supabase
      .from('bookings')
      .update({ confirmed: true })
      .eq('id', bookingId)

    if (error) {
      console.error('Error confirming booking:', error)
    } else {
      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, confirmed: true } : b))
      setSelectedBooking(prev => prev && prev.id === bookingId ? { ...prev, confirmed: true } : prev)
    }
  }

  // Arrastrar una reserva en la vista Semana: mover el bloque completo o estirar un borde
  // para cambiar solo el check-in o el check-out. Valida colisión antes de guardar.
  // Núcleo compartido: valida capacidad + colisión y persiste un cambio de fechas y/o
  // de habitación/cabaña asignada. Lo usan tanto el arrastre en la Semana como el
  // desplegable de "cambiar habitación" en el detalle de la reserva.
  const reassignBooking = async (bookingId: string, newAccId: number, newCheckIn: string, newCheckOut: string) => {
    const booking = bookings.find(b => b.id === bookingId)
    if (!booking) return false

    if (newAccId !== booking.accommodationId) {
      const maxCapacity = getMaxCapacity(newAccId)
      const totalGuests = booking.guestsCount.adults + booking.guestsCount.children
      if (maxCapacity > 0 && totalGuests > maxCapacity) {
        alert(`Error: Capacidad excedida. Esa habitación/cabaña admite hasta ${maxCapacity} personas y esta reserva tiene ${totalGuests}.`)
        return false
      }
    }

    const collision = bookings.find(b =>
      b.id !== bookingId &&
      b.accommodationId === newAccId &&
      newCheckIn < b.checkOut && newCheckOut > b.checkIn
    )
    if (collision) {
      alert(`Error: Conflicto de fechas. Ya está reservada por "${collision.guestName}" del ${collision.checkIn} al ${collision.checkOut}.`)
      return false
    }

    // Las fechas, la habitación y la cantidad de huéspedes determinan el precio. Al
    // modificar una reserva se recalcula la estancia completa con las mismas tarifas
    // que usa "Nueva Reserva". También permite reparar reservas cuya fecha ya cambió
    // con la versión anterior: basta abrir "Cambiar" y volver a guardar el mismo rango.
    const newStandardTotal = getStandardRate(
      newAccId,
      newCheckIn,
      newCheckOut,
      booking.guestsCount.adults,
      booking.guestsCount.children
    )
    const newTotalAmount = getAdjustedBookingTotal(newStandardTotal, booking.specialNotes)
    const newPaymentStatus: Booking['paymentStatus'] = booking.amountPaid >= newTotalAmount
      ? 'completo'
      : booking.amountPaid > 0
        ? 'parcial'
        : 'pendiente'

    const { error } = await supabase
      .from('bookings')
      .update({
        accommodation_id: newAccId,
        check_in: newCheckIn,
        check_out: newCheckOut,
        total_amount: newTotalAmount,
        payment_status: newPaymentStatus
      })
      .eq('id', bookingId)

    if (error) {
      console.error('Error reassigning booking:', error)
      alert('Error al actualizar la reserva. Intenta de nuevo.')
      return false
    }

    const updatedFields = {
      accommodationId: newAccId,
      checkIn: newCheckIn,
      checkOut: newCheckOut,
      totalAmount: newTotalAmount,
      paymentStatus: newPaymentStatus
    }
    setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, ...updatedFields } : b))
    setSelectedBooking(prev => prev && prev.id === bookingId ? { ...prev, ...updatedFields } : prev)
    return true
  }

  const handleSaveGuestDetails = async () => {
    if (!selectedBooking) return
    const guestName = joinPersonName(editGuestForm.firstName, editGuestForm.lastName)
    if (!editGuestForm.firstName.trim() || !editGuestForm.lastName.trim()) {
      alert('El nombre y el apellido del huésped son obligatorios.')
      return
    }

    const payload = {
      guest_name: guestName,
      guest_ci: editGuestForm.ci.trim() || null,
      guest_phone: editGuestForm.phone.trim(),
      guest_email: editGuestForm.email.trim(),
      companions: editGuestForm.companions.trim() || null
    }

    setSavingGuest(true)
    let query = supabase.from('bookings').update(payload)
    query = selectedBooking.locator
      ? query.eq('locator', selectedBooking.locator)
      : query.eq('id', selectedBooking.id)
    const { error } = await query
    setSavingGuest(false)

    if (error) {
      console.error('Error updating guest details:', error)
      alert('No se pudieron actualizar los datos del huésped. Intenta de nuevo.')
      return
    }

    const appliesToBooking = (booking: Booking) => selectedBooking.locator
      ? booking.locator === selectedBooking.locator
      : booking.id === selectedBooking.id
    const updatedFields = {
      guestName,
      guestCi: editGuestForm.ci.trim(),
      guestPhone: editGuestForm.phone.trim(),
      guestEmail: editGuestForm.email.trim(),
      companions: editGuestForm.companions.trim()
    }
    setBookings(prev => prev.map(booking => appliesToBooking(booking) ? { ...booking, ...updatedFields } : booking))
    setSelectedBooking(prev => prev ? { ...prev, ...updatedFields } : prev)
    setEditingGuest(false)
  }

  const handleSaveBookingNotes = async () => {
    if (!selectedBooking) return
    const notes = editNotes.trim()
    setSavingNotes(true)
    let query = supabase.from('bookings').update({ special_notes: notes || null })
    query = selectedBooking.locator
      ? query.eq('locator', selectedBooking.locator)
      : query.eq('id', selectedBooking.id)
    const { error } = await query
    setSavingNotes(false)
    if (error) {
      console.error('Error updating booking notes:', error)
      alert('No se pudieron actualizar las notas.')
      return
    }

    const appliesToBooking = (booking: Booking) => selectedBooking.locator
      ? booking.locator === selectedBooking.locator
      : booking.id === selectedBooking.id
    setBookings(prev => prev.map(booking => appliesToBooking(booking) ? { ...booking, specialNotes: notes } : booking))
    setSelectedBooking(prev => prev ? { ...prev, specialNotes: notes } : prev)
    setEditingNotes(false)
  }

  const handleSaveRoomDetails = async () => {
    if (!selectedBooking || !editingRoomId) return
    const roomBooking = bookings.find(item => item.id === editingRoomId)
    if (!roomBooking) return

    const totalGuests = editRoomForm.adults + editRoomForm.children
    const maxCapacity = getMaxCapacity(editRoomForm.accommodationId)
    if (maxCapacity > 0 && totalGuests > maxCapacity) {
      alert(`Esta habitación admite hasta ${maxCapacity} personas y se ingresaron ${totalGuests}.`)
      return
    }

    const collision = bookings.find(item =>
      item.id !== roomBooking.id &&
      item.accommodationId === editRoomForm.accommodationId &&
      roomBooking.checkIn < item.checkOut && roomBooking.checkOut > item.checkIn
    )
    if (collision) {
      alert(`${getAccommodation(editRoomForm.accommodationId)?.title || 'La habitación'} ya está ocupada en esas fechas.`)
      return
    }

    const standardTotal = getStandardRate(
      editRoomForm.accommodationId,
      roomBooking.checkIn,
      roomBooking.checkOut,
      editRoomForm.adults,
      editRoomForm.children
    )
    const totalAmount = getAdjustedBookingTotal(standardTotal, roomBooking.specialNotes)
    const paymentStatus: Booking['paymentStatus'] = roomBooking.amountPaid >= totalAmount
      ? 'completo'
      : roomBooking.amountPaid > 0 ? 'parcial' : 'pendiente'

    setSavingRoom(true)
    const { error } = await supabase
      .from('bookings')
      .update({
        accommodation_id: editRoomForm.accommodationId,
        adults: editRoomForm.adults,
        children: editRoomForm.children,
        babies: editRoomForm.babies,
        pets: editRoomForm.pets,
        total_amount: totalAmount,
        payment_status: paymentStatus
      })
      .eq('id', roomBooking.id)
    setSavingRoom(false)

    if (error) {
      console.error('Error updating room details:', error)
      alert('No se pudo actualizar la habitación.')
      return
    }

    const updatedFields = {
      accommodationId: editRoomForm.accommodationId,
      guestsCount: {
        adults: editRoomForm.adults,
        children: editRoomForm.children,
        babies: editRoomForm.babies,
        pets: editRoomForm.pets
      },
      totalAmount,
      paymentStatus
    }
    setBookings(prev => prev.map(item => item.id === roomBooking.id ? { ...item, ...updatedFields } : item))
    setSelectedBooking(prev => prev && prev.id === roomBooking.id ? { ...prev, ...updatedFields } : prev)
    setEditingRoomId(null)
  }

  const handleAddRoomsToBooking = async () => {
    if (!selectedBooking || additionalAccommodationIds.length === 0) return

    const groupBookings = selectedBooking.locator
      ? bookings.filter(b => b.locator === selectedBooking.locator)
      : [selectedBooking]
    const resultingGroupSize = groupBookings.length + additionalAccommodationIds.length
    if (resultingGroupSize > 4) {
      alert(`Esta reserva ya tiene ${groupBookings.length} alojamiento(s). El máximo por reserva grupal es 4.`)
      return
    }

    const collision = bookings.find(b =>
      additionalAccommodationIds.includes(b.accommodationId) &&
      selectedBooking.checkIn < b.checkOut && selectedBooking.checkOut > b.checkIn
    )
    if (collision) {
      alert(`${getAccommodation(collision.accommodationId)?.title || 'Una unidad'} ya no está disponible para esas fechas.`)
      return
    }

    const totalGuests = additionalGuests.adults + additionalGuests.children
    const totalCapacity = additionalAccommodationIds.reduce((sum, id) => sum + getMaxCapacity(id), 0)
    if (totalCapacity > 0 && totalGuests > totalCapacity) {
      alert(`Las habitaciones nuevas admiten hasta ${totalCapacity} personas y se ingresaron ${totalGuests}.`)
      return
    }

    let adultsLeft = additionalGuests.adults
    let childrenLeft = additionalGuests.children
    const allocations = additionalAccommodationIds.map((id, index) => {
      const capacity = getMaxCapacity(id) || totalGuests
      const adults = Math.min(adultsLeft, capacity)
      adultsLeft -= adults
      const children = Math.min(childrenLeft, Math.max(0, capacity - adults))
      childrenLeft -= children
      return {
        id,
        adults,
        children,
        babies: index === 0 ? additionalGuests.babies : 0,
        pets: index === 0 ? additionalGuests.pets : 0
      }
    })

    const discount = getBookingDiscountPercent(selectedBooking.specialNotes)
    const locator = selectedBooking.locator || `LC-${Math.random().toString(36).substring(2, 7).toUpperCase()}`
    const baseGuestName = selectedBooking.guestName.replace(/\s+\(\d+\/\d+\)$/, '')
    const groupNote = `Reserva grupal ampliada a ${resultingGroupSize} alojamientos bajo el localizador ${locator}.`
    // El descuento fijo pertenece al total que ya existía. La habitación nueva hereda
    // el porcentaje, pero no vuelve a restar una porción fija que ya fue aplicada.
    const notesWithoutFixedDiscount = withBookingFixedDiscountNote(selectedBooking.specialNotes, 0)
    const specialNotes = [notesWithoutFixedDiscount, groupNote].filter(Boolean).join(' ')

    const rows = allocations.map(room => {
      const standardTotal = getStandardRate(
        room.id,
        selectedBooking.checkIn,
        selectedBooking.checkOut,
        room.adults,
        room.children
      )
      const totalAmount = Math.round(standardTotal * (1 - discount / 100) * 100) / 100
      return {
        guest_name: baseGuestName,
        guest_phone: selectedBooking.guestPhone,
        guest_email: selectedBooking.guestEmail,
        guest_ci: selectedBooking.guestCi || null,
        companions: selectedBooking.companions || null,
        accommodation_id: room.id,
        check_in: selectedBooking.checkIn,
        check_out: selectedBooking.checkOut,
        adults: room.adults,
        children: room.children,
        babies: room.babies,
        pets: room.pets,
        total_amount: totalAmount,
        amount_paid: 0,
        payment_status: 'pendiente',
        payment_method: selectedBooking.paymentMethod,
        payment_reference: null,
        status: selectedBooking.status,
        confirmed: selectedBooking.confirmed,
        special_notes: specialNotes,
        locator
      }
    })

    setSavingAdditionalRooms(true)
    if (!selectedBooking.locator) {
      const { error: locatorError } = await supabase
        .from('bookings')
        .update({ locator })
        .eq('id', selectedBooking.id)
      if (locatorError) {
        setSavingAdditionalRooms(false)
        alert('No se pudo preparar el localizador de la reserva.')
        return
      }
    }

    const { data, error } = await supabase.from('bookings').insert(rows).select('*')
    setSavingAdditionalRooms(false)
    if (error || !data) {
      console.error('Error adding rooms to existing booking:', error)
      alert('No se pudieron agregar las habitaciones. Intenta de nuevo.')
      return
    }

    const inserted = data.map(mapDbBookingToReact)
    setBookings(prev => [
      ...inserted,
      ...prev.map(b => b.id === selectedBooking.id && !b.locator ? { ...b, locator } : b)
    ])
    setSelectedBooking(prev => prev ? { ...prev, locator } : prev)
    setAdditionalAccommodationIds([])
    setAdditionalGuests({ adults: 2, children: 0, babies: 0, pets: 0 })
    setAddingRoomsToBooking(false)
  }

  const handleDropOnCell = async (accId: number, dropDateStr: string) => {
    if (!dragInfo) return
    const info = dragInfo
    setDragInfo(null)
    setDragOverCell(null)

    const booking = bookings.find(b => b.id === info.bookingId)
    if (!booking) return

    let newCheckIn = booking.checkIn
    let newCheckOut = booking.checkOut
    let newAccId = booking.accommodationId

    if (info.mode === 'move') {
      // Arrastrar el cuerpo permite soltarlo en otra fila: reasigna de habitación/cabaña.
      const nights = calculateNights(booking.checkIn, booking.checkOut)
      newCheckIn = dropDateStr
      newCheckOut = formatLocalDate(addDays(parseLocalDate(dropDateStr), nights))
      newAccId = accId
    } else {
      // Estirar un borde solo cambia fechas, dentro de la misma fila.
      if (accId !== booking.accommodationId) return
      if (info.mode === 'resize-left') {
        newCheckIn = dropDateStr
        if (newCheckIn >= booking.checkOut) {
          alert('Error: la fecha de check-in debe ser anterior al check-out.')
          return
        }
      } else if (info.mode === 'resize-right') {
        newCheckOut = dropDateStr
        if (newCheckOut <= booking.checkIn) {
          alert('Error: la fecha de check-out debe ser posterior al check-in.')
          return
        }
      }
    }

    if (newCheckIn === booking.checkIn && newCheckOut === booking.checkOut && newAccId === booking.accommodationId) return

    await reassignBooking(booking.id, newAccId, newCheckIn, newCheckOut)
  }

  // Mover/estirar una reserva existente en la Semana. Usa la posición real del puntero
  // (document.elementsFromPoint) en vez de los eventos nativos de drag&drop de HTML5:
  // así detecta la celda de fecha que está DEBAJO aunque la propia barra la tape
  // visualmente — con drag&drop nativo, encoger una reserva (arrastrar el borde hacia
  // adentro) no soltaba sobre nada porque el mouse quedaba sobre la barra, no la celda.
  //
  // Son pointer events, no mouse: el mismo código sirve para dedo, mouse y lápiz. El
  // drag&drop de HTML5 no existe en móvil, y `mousemove` no se dispara al arrastrar con
  // el dedo, por lo que antes el planner solo se podía usar desde una computadora.
  useEffect(() => {
    if (!dragInfo) return
    hasDraggedRef.current = false

    const handlePointerMove = (e: PointerEvent) => {
      // Ignora el jitter de un simple toque/click: solo cuenta como arrastre real una vez
      // que el puntero se aleja más de unos pocos píxeles del punto donde empezó.
      if (!hasDraggedRef.current) {
        const start = dragStartPosRef.current
        const movedEnough = !start || Math.hypot(e.clientX - start.x, e.clientY - start.y) >= DRAG_THRESHOLD_PX
        if (!movedEnough) return
        hasDraggedRef.current = true
      }

      const stack = document.elementsFromPoint(e.clientX, e.clientY)
      const cellEl = stack.find((el): el is HTMLElement => el instanceof HTMLElement && !!el.dataset.plannerCell)
      const key = cellEl?.dataset.plannerCell ?? null
      if (dragOverCellRef.current !== key) {
        dragOverCellRef.current = key
        setDragOverCell(key)
      }
    }

    const handlePointerUp = () => {
      const key = dragOverCellRef.current
      const wasRealDrag = hasDraggedRef.current
      dragOverCellRef.current = null
      dragStartPosRef.current = null
      hasDraggedRef.current = false
      setDragInfo(null)
      setDragOverCell(null)
      if (wasRealDrag && key) {
        const [accIdStr, dateStr] = key.split('|')
        handleDropOnCell(Number(accIdStr), dateStr)
      }
    }

    // Un puntero cancelado (el navegador se llevó el gesto) no debe guardar nada:
    // se descarta el arrastre y la reserva se queda donde estaba.
    const handlePointerCancel = () => {
      dragOverCellRef.current = null
      dragStartPosRef.current = null
      hasDraggedRef.current = false
      setDragInfo(null)
      setDragOverCell(null)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerCancel)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerCancel)
    }
  }, [dragInfo])

  const handleAddBooking = async () => {
    const fullGuestName = `${form.guestFirstName.trim()} ${form.guestLastName.trim()}`.trim()
    if (!fullGuestName) return

    if (selectedAccommodationIds.length === 0) {
      alert('Selecciona al menos una habitación o cabaña.')
      return
    }

    if (form.checkOut <= form.checkIn) {
      alert('Error: La fecha de check-out debe ser posterior a la fecha de check-in.')
      return
    }

    const collision = bookings.find(b =>
      selectedAccommodationIds.includes(b.accommodationId) &&
      form.checkIn < b.checkOut && form.checkOut > b.checkIn
    )

    if (collision) {
      alert(`Error: ${getAccommodation(collision.accommodationId)?.title || 'Una unidad'} ya está reservada para "${collision.guestName}" desde el ${collision.checkIn} hasta el ${collision.checkOut}.`)
      return
    }

    const maxCapacity = selectedAccommodationIds.reduce((sum, id) => sum + getMaxCapacity(id), 0)
    const totalGuests = Number(form.adults) + Number(form.children)
    if (maxCapacity > 0 && totalGuests > maxCapacity) {
      alert(`Error: Las ${selectedAccommodationIds.length} unidades seleccionadas admiten hasta ${maxCapacity} personas y se ingresaron ${totalGuests}.`)
      return
    }

    const finalTotal = useCustomRate
      ? (discountPercent > 0 ? Math.round(standardRate * (1 - discountPercent / 100)) : form.totalAmount)
      : standardRate

    const allocateMoney = (amount: number, weights: number[]) => {
      let centsLeft = Math.round(amount * 100)
      const weightTotal = weights.reduce((sum, value) => sum + value, 0)
      return weights.map((weight, index) => {
        const cents = index === weights.length - 1
          ? centsLeft
          : Math.round((amount * 100 * (weightTotal > 0 ? weight / weightTotal : 1 / weights.length)))
        centsLeft -= cents
        return cents / 100
      })
    }

    const initialStatus = form.checkIn === todayStr ? 'checkin_hoy' : 'confirmado'
    const discountNote = useCustomRate && discountPercent > 0
      ? `Descuento aplicado: ${discountPercent}%.`
      : ''
    const groupNote = selectedAccommodationIds.length > 1
      ? `Reserva grupal: ${selectedAccommodationIds.length} alojamientos bajo el localizador ${locatorCode}.`
      : ''
    const specialNotes = [form.specialNotes.trim(), groupNote, discountNote].filter(Boolean).join(' ')
    const roomAllocations = allocateGuestsAcrossAccommodations(selectedAccommodationIds)
    const roomStandardTotals = roomAllocations.map(room =>
      getStandardRate(room.id, form.checkIn, form.checkOut, room.adults, room.children)
    )
    const roomFinalTotals = allocateMoney(finalTotal, roomStandardTotals)
    const initialPaidTotal = Math.round(Number(form.amountPaid) * 100) / 100
    const globalPaymentStatus: Booking['paymentStatus'] = initialPaidTotal >= finalTotal
      ? 'completo'
      : initialPaidTotal > 0 ? 'parcial' : 'pendiente'

    const newBookings = roomAllocations.map((room, index) => ({
      guest_name: `${fullGuestName}${roomAllocations.length > 1 ? ` (${index + 1}/${roomAllocations.length})` : ''}`,
      guest_phone: form.guestPhone.trim() || '+58 412-000-0000',
      guest_email: form.guestEmail.trim() || 'cliente@estancialacanada.com',
      guest_ci: form.guestCi.trim() || null,
      companions: form.companions.trim() || null,
      accommodation_id: room.id,
      check_in: form.checkIn,
      check_out: form.checkOut,
      adults: room.adults,
      children: room.children,
      babies: room.babies,
      pets: room.pets,
      total_amount: roomFinalTotals[index],
      amount_paid: index === 0 ? initialPaidTotal : 0,
      payment_status: globalPaymentStatus,
      payment_method: form.paymentMethod,
      payment_reference: form.paymentReference.trim() || null,
      status: initialStatus,
      confirmed: true,
      special_notes: specialNotes || null,
      locator: locatorCode
    }))

    const { data, error } = await supabase
      .from('bookings')
      .insert(newBookings)
      .select('*')

    if (error) {
      console.error('Error adding booking:', error)
      alert('No se pudo guardar la reserva. Intenta de nuevo.')
      return
    } else if (data && data.length > 0) {
      setBookings(prev => [...data.map(mapDbBookingToReact), ...prev])

      if (Number(form.amountPaid) > 0) {
        const paymentRow = {
          booking_id: data[0].id,
          payment_date: form.paymentDate || todayStr,
          amount: initialPaidTotal,
          currency: 'USD',
          method: form.paymentMethod,
          reference: form.paymentReference.trim() || null,
          status: 'verificado'
        }

        const { data: pagosIniciales, error: paymentError } = await supabase
          .from('booking_payments')
          .insert(paymentRow)
          .select('id, booking_id, amount')

        if (paymentError) {
          console.error('Error adding initial payment:', paymentError)
        } else {
          for (const payment of pagosIniciales || []) {
            const bookingRow = data.find(row => row.id === payment.booking_id)
            const ingreso = await registrarIngresoDeAbono(supabase, {
              paymentId: payment.id,
              bookingId: payment.booking_id,
              guestName: fullGuestName,
              locator: locatorCode,
              accommodationTitle: data.length > 1 ? `${data.length} habitaciones` : getAccommodation(Number(bookingRow?.accommodation_id))?.title,
              amount: Number(payment.amount),
              date: form.paymentDate || todayStr,
              method: form.paymentMethod,
              reference: form.paymentReference.trim() || null,
            })
            if (ingreso.error) console.error('El abono inicial no llegó a Ingresos:', ingreso.error)
          }
        }
      }

      // Que el huésped de una reserva manual también quede disponible para Email Marketing,
      // igual que cuando reserva por su cuenta desde la app.
      if (form.guestEmail.trim()) {
        syncMarketingCustomer(supabase, {
          fullName: fullGuestName,
          email: form.guestEmail.trim(),
          phone: form.guestPhone.trim(),
          bookingAmount: finalTotal,
          stayDate: form.checkIn
        }).catch(err => console.error('Error sincronizando cliente de marketing:', err))

        // Correo de "gracias por su reservación" (no es comprobante de pago).
        sendBookingConfirmationEmail(supabase, {
          email: form.guestEmail.trim(),
          guestName: fullGuestName,
          locator: locatorCode,
          accommodationTitle: selectedAccommodationIds.map(id => getAccommodation(id)?.title).filter(Boolean).join(' + '),
          checkIn: form.checkIn,
          checkOut: form.checkOut,
          totalAmount: finalTotal,
          amountPaid: Number(form.amountPaid)
        })
      }

      if (Number(form.amountPaid) > 0 && form.guestEmail.trim()) {
        sendBookingVoucherEmail(supabase, {
          locator: locatorCode,
          guestName: fullGuestName,
          guestEmail: form.guestEmail.trim(),
          guestPhone: form.guestPhone.trim(),
          guestCi: form.guestCi.trim(),
          companions: form.companions.trim(),
          channel: 'Local',
          checkIn: form.checkIn,
          checkOut: form.checkOut,
          nights: calculateNights(form.checkIn, form.checkOut),
          guestsCount: Number(form.adults) + Number(form.children),
          paymentMethod: form.paymentMethod,
          totalAmount: finalTotal,
          amountPaid: Number(form.amountPaid),
          rooms: roomAllocations.map((room, index) => ({
            title: getAccommodation(room.id)?.title || `Alojamiento ${room.id}`,
            capacity: getMaxCapacity(room.id),
            nights: calculateNights(form.checkIn, form.checkOut),
            adults: room.adults,
            children: room.children,
            cost: roomFinalTotals[index]
          })),
          payments: [{
            date: form.paymentDate || todayStr,
            amount: Number(form.amountPaid),
            method: form.paymentMethod,
            status: 'Verificado',
            reference: form.paymentReference.trim()
          }]
        }).catch(err => console.error('Error enviando el comprobante grupal:', err))
      }
    }

    closeAddModal()
  }

  /**
   * Envía el comprobante de pago de una reserva. Los abonos se leen SIEMPRE de
   * `booking_payments`, nunca del monto que trae la reserva en pantalla: el voucher solo
   * puede declarar dinero efectivamente registrado. Si no hay ningún pago, no se envía.
   */
  const sendVoucherForBooking = async (booking: Booking) => {
    const email = booking.guestEmail?.trim()
    if (!email) return { sent: false, reason: 'sin-correo' as const }
    const groupBookings = getBookingGroup(booking)
    const groupIds = groupBookings.map(room => room.id)

    const { data: paymentRows } = await supabase
      .from('booking_payments')
      .select('*')
      .in('booking_id', groupIds)
      .order('payment_date', { ascending: true })

    const verified = (paymentRows ?? []).filter(p => p.status === 'verificado')
    if (verified.length === 0) return { sent: false, reason: 'sin-pagos' as const }

    const paidVerified = verified.reduce((sum, p) => sum + Number(p.amount), 0)
    const nights = calculateNights(booking.checkIn, booking.checkOut)

    await sendBookingVoucherEmail(supabase, {
      locator: booking.locator || booking.id.slice(0, 6).toUpperCase(),
      guestName: booking.guestName.replace(/\s+\(\d+\/\d+\)$/, ''),
      guestEmail: email,
      guestPhone: booking.guestPhone,
      guestCi: booking.guestCi,
      companions: booking.companions,
      channel: booking.confirmed ? 'Local' : 'App web',
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      nights,
      guestsCount: groupBookings.reduce((sum, room) => sum + room.guestsCount.adults + room.guestsCount.children, 0),
      paymentMethod: booking.paymentMethod,
      totalAmount: groupBookings.reduce((sum, room) => sum + room.totalAmount, 0),
      amountPaid: paidVerified,
      rooms: groupBookings.map(room => ({
        title: getAccommodation(room.accommodationId)?.title || '',
        capacity: getMaxCapacity(room.accommodationId),
        nights,
        adults: room.guestsCount.adults,
        children: room.guestsCount.children,
        plan: 'Temporadas',
        cost: room.totalAmount,
      })),
      payments: verified.map(p => ({
        date: p.payment_date,
        amount: Number(p.amount),
        method: p.method,
        status: 'Verificado',
        reference: p.reference || undefined,
      })),
    })
    return { sent: true as const, reason: null }
  }

  /** Botón "Enviar comprobante" de la ficha, con su estado de carga y su aviso. */
  const handleSendVoucher = async (booking: Booking) => {
    if (sendingVoucher) return
    setSendingVoucher(true)
    const result = await sendVoucherForBooking(booking)
    setSendingVoucher(false)
    if (result.sent) {
      setVoucherSentFor(booking.id)
    } else if (result.reason === 'sin-pagos') {
      alert('Esta reserva todavía no tiene ningún abono registrado. Registre el pago en "Historial de Pagos" y el comprobante se enviará solo.')
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] gap-3">
        <div className="w-10 h-10 border-4 border-[#C5A059] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-bold text-gray-500 uppercase tracking-widest animate-pulse">Cargando reservas...</p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-6 print:hidden">
        <LoadErrorBanner message={loadError} />
        {/* 1. Header with dynamic greetings */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-serif text-gray-900 flex items-center gap-2.5">
            Planner de Reservas <Sparkles className="text-[#C5A059] fill-[#C5A059]/10" size={24} />
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Supervisa la ocupación del hotel de la manera más sencilla e intuitiva. Hoy es {todayLongLabel}.
          </p>
        </div>
        <div className="flex items-center gap-3 self-start md:self-auto print:hidden">
          <button
            onClick={() => window.print()}
            className="flex items-center justify-center gap-2 px-5 py-3 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-2xl text-sm font-bold transition-all shadow-sm active:scale-95"
          >
            <Printer size={18} />
            <span className="hidden sm:inline">Generar Reporte PDF</span>
            <span className="sm:hidden">PDF</span>
          </button>
          <button
            onClick={() => openAddModal()}
            className="flex items-center justify-center gap-2 px-5 py-3 bg-[#C5A059] hover:bg-[#b8904a] text-white rounded-2xl text-sm font-bold transition-all shadow-md shadow-[#C5A059]/20 active:scale-95"
          >
            <Plus size={18} />
            <span className="hidden sm:inline">Registrar Nueva Reserva</span>
            <span className="sm:hidden">Nueva</span>
          </button>
        </div>
      </div>

      {/* 2. Interactive KPI Cards (Infant-level ease of reading) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Occupancy Card */}
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Ocupación Hoy</span>
          <div className="flex items-baseline gap-1 mt-3">
            <span className="text-3xl font-extrabold text-gray-800">{stats.occupancyRate}%</span>
          </div>
          <div className="w-full bg-gray-100 h-2 rounded-full mt-2.5 overflow-hidden">
            <div className="bg-[#C5A059] h-full rounded-full transition-all duration-500" style={{ width: `${stats.occupancyRate}%` }} />
          </div>
        </div>

        {/* Check-Ins Card */}
        <div className={`rounded-3xl p-5 shadow-sm border flex flex-col justify-between transition-colors ${stats.checkins > 0 ? 'bg-amber-50/50 border-amber-100' : 'bg-white border-gray-100'}`}>
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Llegan Hoy 👋</span>
          <div className="mt-3 flex items-baseline gap-1">
            <span className={`text-3xl font-extrabold ${stats.checkins > 0 ? 'text-amber-600' : 'text-gray-800'}`}>{stats.checkins}</span>
            <span className="text-xs text-gray-400">cabañas</span>
          </div>
          <span className="text-[10px] text-gray-400 mt-2 block font-medium">Check-ins pendientes</span>
        </div>

        {/* Check-Outs Card */}
        <div className={`rounded-3xl p-5 shadow-sm border flex flex-col justify-between transition-colors ${stats.checkouts > 0 ? 'bg-orange-50/50 border-orange-100' : 'bg-white border-gray-100'}`}>
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Se van Hoy 🚶</span>
          <div className="mt-3 flex items-baseline gap-1">
            <span className={`text-3xl font-extrabold ${stats.checkouts > 0 ? 'text-orange-600' : 'text-gray-800'}`}>{stats.checkouts}</span>
            <span className="text-xs text-gray-400">cabañas</span>
          </div>
          <span className="text-[10px] text-gray-400 mt-2 block font-medium">Check-outs por realizar</span>
        </div>

        {/* Cleaning Card */}
        <div className={`rounded-3xl p-5 shadow-sm border flex flex-col justify-between transition-colors ${stats.cleaning > 0 ? 'bg-rose-50/50 border-rose-100' : 'bg-white border-gray-100'}`}>
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">En Limpieza 🧼</span>
          <div className="mt-3 flex items-baseline gap-1">
            <span className={`text-3xl font-extrabold ${stats.cleaning > 0 ? 'text-rose-600' : 'text-gray-800'}`}>{stats.cleaning}</span>
            <span className="text-xs text-gray-400">cuartos</span>
          </div>
          <span className="text-[10px] text-gray-400 mt-2 block font-medium">Requieren desinfección</span>
        </div>

        {/* Free/Available Card */}
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 flex flex-col justify-between col-span-2 lg:col-span-1">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Disponibles 🟢</span>
          <div className="mt-3 flex items-baseline gap-1">
            <span className="text-3xl font-extrabold text-emerald-600">{stats.available}</span>
            <span className="text-xs text-gray-400">libres</span>
          </div>
          <span className="text-[10px] text-gray-400 mt-2 block font-medium">Listas para habitar</span>
        </div>
      </div>

      {/* 3. Navigation Tabs & Search Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-2 rounded-2xl shadow-sm border border-gray-100">
        {/* Navigation Tabs */}
        <div className="flex gap-1.5 w-full sm:w-auto">
          {(['dia', 'semana', 'mes'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab)
                setMonthPage(1)
              }}
              className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all active:scale-95 ${
                activeTab === tab
                  ? 'bg-[#3D2B1F] text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {tab === 'dia' ? 'Hoy (Día)' : tab === 'semana' ? 'Esta Semana' : 'Este Mes'}
            </button>
          ))}
        </div>

        {/* Interactive search bar */}
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-xl px-4 py-2.5 w-full sm:max-w-xs">
          <Search size={16} className="text-gray-400 shrink-0" />
          <input
            type="text"
            placeholder="Buscar por huésped o cabaña..."
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value)
              setMonthPage(1)
            }}
            className="w-full text-xs outline-none bg-transparent text-gray-700 placeholder-gray-400 font-medium"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('')
                setMonthPage(1)
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* 4. Core Views Section */}

      {/* TAB A: DIA VIEW */}
      {activeTab === 'dia' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {cabinStatesToday.map(({ accommodation, booking, status }) => {
            const conf = statusConfig[status]
            let badgeBg = conf.bg
            
            if (['checkin_hoy', 'checkout_hoy', 'disponible', 'limpieza'].includes(status)) {
              badgeBg = 'bg-white border-gray-200 text-gray-800 shadow-sm'
            } else if (booking) {
              badgeBg = getBookingPaymentColors(booking).badge
            }

            return (
              <div
                key={accommodation.id}
                className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden flex flex-col justify-between transition-all hover:shadow-md"
              >
                {/* Cabin Image header */}
                <div className="relative h-44 w-full bg-gray-100 overflow-hidden flex-none">
                  <img
                    src={accommodation.image}
                    alt={accommodation.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                  
                  {/* Status badge in corner */}
                  <div className={`absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[9px] font-extrabold uppercase tracking-widest ${badgeBg}`}>
                    {conf.icon}
                    {conf.label}
                  </div>

                  <div className="absolute bottom-4 left-5">
                    <span className="text-[9px] uppercase tracking-widest text-[#C5A059] font-extrabold block mb-0.5">
                      {accommodation.type}
                    </span>
                    <h3 className="text-xl font-bold font-serif text-white leading-tight">
                      {accommodation.title} <span className="text-white/70 font-sans font-semibold text-sm">({accommodation.maxCapacity} pax)</span>
                    </h3>
                  </div>
                </div>

                {/* Status Detail Content */}
                <div className="p-6 flex-1 flex flex-col justify-between gap-6">
                  {booking ? (
                    // Display current guest details
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-gray-50 pb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Huésped</p>
                            {booking.locator && (
                              <span className="font-mono text-[8px] font-extrabold text-[#C5A059] bg-[#C5A059]/10 px-2 py-0.5 rounded-md tracking-wider">
                                {booking.locator}
                              </span>
                            )}
                          </div>
                          <h4 className="text-base font-bold text-gray-800 leading-tight mt-0.5">{booking.guestName}</h4>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Huéspedes</p>
                          <span className="text-xs font-semibold text-gray-600 block mt-0.5">
                            {booking.guestsCount.adults} Ad. {booking.guestsCount.children > 0 && `+ ${booking.guestsCount.children} Niñ.`}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Entrada</p>
                          <span className="font-semibold text-gray-600">{parseLocalDate(booking.checkIn).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</span>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Salida</p>
                          <span className="font-semibold text-gray-600">{parseLocalDate(booking.checkOut).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</span>
                        </div>
                      </div>

                      {booking.specialNotes && (
                        <div className="bg-gray-50/80 border border-gray-100 rounded-xl p-3 text-[11px] text-gray-500 leading-relaxed italic">
                          "{booking.specialNotes.slice(0, 75)}{booking.specialNotes.length > 75 ? '...' : ''}"
                        </div>
                      )}
                    </div>
                  ) : (
                    // Display Available info
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                      <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center mb-3">
                        <Check size={24} />
                      </div>
                      <h4 className="text-sm font-bold text-gray-800">Cabaña Disponible</h4>
                      <p className="text-[11px] text-gray-400 max-w-xs mt-1">Listo para recibir huéspedes o asignar reservas de último minuto.</p>
                    </div>
                  )}

                  {/* Actions Section */}
                  <div className="border-t border-gray-50 pt-4 flex gap-2">
                    {status === 'checkin_hoy' && booking && (
                      <button
                        onClick={() => handleCheckIn(booking.id)}
                        className="w-full flex items-center justify-center gap-1.5 py-3 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 font-bold rounded-xl text-xs uppercase tracking-wider transition-all active:scale-95 shadow-sm"
                      >
                        <LogIn size={14} /> Registrar Entrada
                      </button>
                    )}

                    {status === 'checkout_hoy' && booking && (
                      <button
                        onClick={() => handleCheckOut(booking.id)}
                        className="w-full flex items-center justify-center gap-1.5 py-3 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 font-bold rounded-xl text-xs uppercase tracking-wider transition-all active:scale-95 shadow-sm"
                      >
                        <LogOut size={14} /> Registrar Salida
                      </button>
                    )}

                    {status === 'ocupado' && booking && (
                      <button
                        onClick={() => setSelectedBooking(booking)}
                        className={`w-full py-3 font-bold rounded-xl text-xs uppercase tracking-wider transition-all border ${getBookingPaymentColors(booking).badge}`}
                      >
                        Ver Detalles
                      </button>
                    )}

                    {status === 'limpieza' && (
                      <button
                        onClick={() => handleMarkClean(accommodation.id)}
                        className="w-full flex items-center justify-center gap-1.5 py-3 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 font-bold rounded-xl text-xs uppercase tracking-wider transition-all active:scale-95 shadow-sm"
                      >
                        <RefreshCw size={14} /> Marcar como Limpia
                      </button>
                    )}

                    {status === 'disponible' && (
                      <button
                        onClick={() => {
                          openAddModal()
                          setForm(f => ({ ...f, accommodationId: accommodation.id }))
                        }}
                        className="w-full py-3 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 font-bold rounded-xl text-xs uppercase tracking-wider transition-all active:scale-95 shadow-sm"
                      >
                        Hospedar Ahora
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* TAB B: SEMANA VIEW (Highly intuitive visual board / Gantt-like) */}
      {activeTab === 'semana' && (
        <div className={plannerFullscreen
          ? 'fixed inset-0 z-[120] bg-white flex flex-col'
          : 'bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden'}>
          {/* En pantalla completa la leyenda y el resto de controles sobran: lo que hace
              falta en el teléfono es que el calendario ocupe todo el alto disponible. */}
          <div className={`flex flex-wrap items-center justify-between gap-4 px-5 py-3 border-b border-gray-100 bg-gray-50/40 ${plannerFullscreen ? 'hidden' : ''}`}>
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Estatus de reserva</span>
              {(['reservado', 'sin_pago', 'parcial', 'pagado'] as const).map(state => (
                <div key={state} className="flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${getPaymentColorClasses({ confirmed: state !== 'reservado', paymentStatus: state === 'pagado' ? 'completo' : state === 'parcial' ? 'parcial' : 'pendiente' }).bullet}`} />
                  <span className="text-[10px] font-semibold text-gray-500">{paymentStateLabels[state]}</span>
                </div>
              ))}
            </div>
            <div className="flex rounded-xl overflow-hidden border border-gray-200 text-[10px] font-bold uppercase tracking-wider">
              <button
                onClick={() => setWeekViewMode('semana')}
                className={`px-3 py-1.5 transition-colors ${weekViewMode === 'semana' ? 'bg-[#3D2B1F] text-white' : 'text-gray-400 hover:bg-white'}`}
              >
                Semana
              </button>
              <button
                onClick={() => setWeekViewMode('personalizado')}
                className={`px-3 py-1.5 transition-colors ${weekViewMode === 'personalizado' ? 'bg-[#3D2B1F] text-white' : 'text-gray-400 hover:bg-white'}`}
              >
                Rango Personalizado
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 px-3 sm:px-5 py-3 border-b border-gray-100 bg-gray-50/40 shrink-0">
            {weekViewMode === 'semana' ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setWeekAnchor(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n })}
                  className="p-2 rounded-lg border border-gray-200 hover:bg-white text-gray-500 active:scale-95"
                >
                  ←
                </button>
                <span className="text-xs font-bold text-gray-700 min-w-[120px] sm:min-w-[140px] text-center">{weekRangeLabel}</span>
                <button
                  onClick={() => setWeekAnchor(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n })}
                  className="p-2 rounded-lg border border-gray-200 hover:bg-white text-gray-500 active:scale-95"
                >
                  →
                </button>
                <button
                  onClick={() => setWeekAnchor(new Date(todayDate))}
                  className="px-3 py-2 rounded-lg border border-gray-200 hover:bg-white text-[10px] font-bold text-gray-500 uppercase tracking-wider active:scale-95"
                >
                  Hoy
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Desde</label>
                <input
                  type="date"
                  value={weekRangeFrom}
                  onChange={e => setWeekRangeFrom(e.target.value)}
                  className="border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#C5A059]"
                />
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Hasta</label>
                <input
                  type="date"
                  value={weekRangeTo}
                  onChange={e => setWeekRangeTo(e.target.value)}
                  className="border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#C5A059]"
                />
                {weekRangeFrom && weekRangeTo && weekRangeFrom <= weekRangeTo && (
                  <span className="text-xs font-bold text-gray-700">{weekRangeLabel}</span>
                )}
              </div>
            )}

            {/* Pantalla completa: en el teléfono el calendario cabía en 465px de una
                pantalla de 844px, así que se veían 8 habitaciones y el recuadro peleaba
                con el scroll de la página. Así ocupa todo y se desliza en las 4 direcciones. */}
            <button
              onClick={() => setPlannerFullscreen(v => !v)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 bg-white text-[10px] font-bold uppercase tracking-wider text-gray-600 active:scale-95"
            >
              {plannerFullscreen
                ? <><Minimize2 size={14} /> Salir</>
                : <><Maximize2 size={14} /> Pantalla completa</>}
            </button>
          </div>
          {/* Guía del modo de dos toques: sin esto no hay forma de saber que el planner
              está esperando el segundo toque. Solo aparece cuando se usó el dedo. */}
          {pendingCheckIn && (() => {
            const acc = activeAccommodationOptions.find(o => o.id === pendingCheckIn.accId)
            const d = parseLocalDate(pendingCheckIn.dateStr)
            return (
              <div className="flex items-center gap-3 px-5 py-3 bg-[#C5A059]/10 border-b border-[#C5A059]/20">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#C5A059]">
                    Entrada · {acc ? `Hab. ${acc.roomNumber ?? '—'}` : ''}
                  </p>
                  <p className="text-xs font-bold text-gray-700 leading-tight">
                    {d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
                    <span className="font-medium text-gray-500"> — ahora toca el día de salida</span>
                  </p>
                </div>
                <button
                  onClick={() => setPendingCheckIn(null)}
                  className="shrink-0 px-3 py-2 rounded-xl border border-gray-200 bg-white text-[10px] font-bold uppercase tracking-wider text-gray-500 active:scale-95"
                >
                  Cancelar
                </button>
              </div>
            )
          })()}

          {/* overscroll-contain: sin esto, al llegar al final de la rejilla el gesto se
              lo lleva la página y parece que el calendario "se traba". */}
          <div
            className={plannerFullscreen ? 'overflow-auto flex-1 min-h-0' : 'overflow-auto max-h-[70dvh]'}
            style={{ overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}
          >
            <div className="min-w-fit divide-y divide-gray-100">
              {/* Header row (Dates) — fijo arriba al hacer scroll para siempre ver a qué día corresponde cada columna */}
              <div className="flex bg-gray-50 sticky top-0 z-20 border-b border-gray-100 shadow-sm">
                {/* Cabin column header spacer */}
                <div className="w-20 sm:w-24 shrink-0 sticky left-0 z-30 p-2 font-bold text-[9px] text-gray-400 uppercase tracking-widest flex items-center justify-center border-r border-gray-100 bg-gray-50">
                  Cabaña
                </div>
                {/* Columnas de días (21 en la vista amplia, o las que tenga el rango personalizado) */}
                <div className="flex-1 grid divide-x divide-gray-100" style={{ gridTemplateColumns: `repeat(${weekDays.length}, minmax(${isMobile ? 44 : 40}px, 1fr))` }}>
                  {weekDays.map(day => {
                    const isToday = day.dateStr === todayStr
                    return (
                      <div
                        key={day.dateStr}
                        className={`py-1.5 text-center flex flex-col items-center justify-center ${isToday ? 'bg-amber-500/10 text-amber-800' : 'text-gray-500'}`}
                      >
                        <span className="text-[8px] font-bold uppercase tracking-wider opacity-60 leading-none">{day.label}</span>
                        <span className="text-xs font-extrabold leading-none mt-0.5">{day.dayNum}</span>
                        <span className="text-[7px] font-medium uppercase tracking-widest opacity-60 leading-none mt-0.5">{day.monthLabel}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Rows per Cabin */}
              {activeAccommodationOptions.map(acc => {
                const weekStartStr = weekDays[0].dateStr
                const weekEndStr = weekDays[weekDays.length - 1].dateStr
                // Reservas de este cuarto que tocan la semana visible, como una sola barra continua
                const rowBookings = bookings.filter(b =>
                  b.accommodationId === acc.id && b.checkIn <= weekEndStr && b.checkOut > weekStartStr
                )

                return (
                <div key={acc.id} className="flex hover:bg-gray-50/40 transition-colors">
                  {/* Cabin Details Info — nombre de la galería arriba, número de habitación abajo */}
                  <div className="w-20 sm:w-24 shrink-0 sticky left-0 z-10 bg-white p-2 border-r border-gray-100 flex flex-col justify-center gap-0.5">
                    <span className="text-[8px] uppercase tracking-wider text-[#C5A059] font-bold leading-tight truncate">
                      {acc.title.replace('Galería ', '').split(' — ')[0]}
                    </span>
                    <span className="text-[11px] font-extrabold text-gray-800 leading-none">
                      Hab. {acc.roomNumber ?? '—'}
                    </span>
                    <span className="text-[10px] text-gray-400 font-semibold leading-none">
                      {acc.maxCapacity} pax
                    </span>
                  </div>

                  {/* Columnas: fondo con zonas de drop + barras de reserva superpuestas */}
                  <div className="flex-1 relative">
                    <div className="grid divide-x divide-gray-100 h-12 sm:h-10" style={{ gridTemplateColumns: `repeat(${weekDays.length}, minmax(${isMobile ? 44 : 40}px, 1fr))` }}>
                      {weekDays.map(day => {
                        // No incluye el estatus de la reserva: así ella siempre ve quién sale ese día,
                        // aunque todavía no haya marcado la limpieza, y aunque otro huésped entre ese mismo día.
                        const isOccupied = rowBookings.some(b => day.dateStr >= b.checkIn && day.dateStr < b.checkOut)
                        const isDragTarget = dragOverCell === `${acc.id}|${day.dateStr}`
                        const isRangeSelected = !!rangeSelect && rangeSelect.accId === acc.id &&
                          day.dateStr >= (rangeSelect.startDateStr <= rangeSelect.endDateStr ? rangeSelect.startDateStr : rangeSelect.endDateStr) &&
                          day.dateStr <= (rangeSelect.startDateStr <= rangeSelect.endDateStr ? rangeSelect.endDateStr : rangeSelect.startDateStr)
                        // Modo dos toques: el día de entrada ya elegido, y los días posteriores
                        // de esa misma cabaña que se pueden tocar como día de salida.
                        const isPendingCheckIn = !!pendingCheckIn && pendingCheckIn.accId === acc.id &&
                          pendingCheckIn.dateStr === day.dateStr
                        const isPendingCheckOutCandidate = !!pendingCheckIn && pendingCheckIn.accId === acc.id &&
                          day.dateStr > pendingCheckIn.dateStr

                        return (
                          <div
                            key={day.dateStr}
                            data-planner-cell={`${acc.id}|${day.dateStr}`}
                            className={`p-0.5 h-12 sm:h-10 flex items-center justify-center relative transition-colors ${isDragTarget || isRangeSelected ? 'bg-[#C5A059]/10' : ''}`}
                          >
                            {!isOccupied && (
                              <button
                                onPointerDown={e => {
                                  rangeStartPosRef.current = { x: e.clientX, y: e.clientY }
                                  rangeDraggedRef.current = false
                                  rangePointerTypeRef.current = e.pointerType
                                  setRangeSelect({ accId: acc.id, startDateStr: day.dateStr, endDateStr: day.dateStr })
                                }}
                                // Sin touch-action: none, para que el dedo pueda deslizar
                                // la rejilla de lado y ver los 21 días. En táctil la reserva
                                // se crea con dos toques (entrada y salida), no arrastrando.
                                title="Toca el día de entrada y luego el de salida, o arrastra sobre las noches"
                                className={`w-full h-full rounded-lg border transition-all flex items-center justify-center group select-none
                                  ${isPendingCheckIn
                                    ? 'border-[#C5A059] border-solid bg-[#C5A059] text-white shadow-sm'
                                    : isPendingCheckOutCandidate
                                      ? 'border-[#C5A059]/50 bg-[#C5A059]/10 text-[#C5A059]'
                                      : isRangeSelected
                                        ? 'border-[#C5A059] bg-[#C5A059]/10 text-[#C5A059]'
                                        : 'border-dashed border-gray-100 hover:border-[#C5A059]/40 hover:bg-[#C5A059]/5 text-gray-300 hover:text-[#C5A059]'}`}
                              >
                                {isPendingCheckIn
                                  ? <span className="text-[8px] font-extrabold uppercase tracking-wider leading-none">Entra</span>
                                  : <Plus size={11} className="group-hover:scale-110 transition-transform" />}
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    {/* Barras arrastrables: mueve el bloque o estira un borde para cambiar fechas */}
                    {rowBookings.map(b => {
                      const occupiedIdx = weekDays.reduce<number[]>((acc2, day, i) => {
                        if (day.dateStr >= b.checkIn && day.dateStr < b.checkOut) acc2.push(i)
                        return acc2
                      }, [])
                      if (occupiedIdx.length === 0) return null
                      const startIdx = occupiedIdx[0]
                      const endIdx = occupiedIdx[occupiedIdx.length - 1]
                      // Como en un hotel real: el check-in es de tarde y el check-out de mañana. Si el
                      // día de llegada o de salida está dentro de la semana visible, la barra empieza o
                      // termina a la MITAD de esa columna (no en el borde completo), para que dos
                      // reservas de la misma habitación el mismo día (una sale, otra entra) se vean
                      // como dos mitades que se juntan, en vez de un cuadrito de aviso aparte.
                      const checkInVisible = b.checkIn >= weekDays[0].dateStr
                      const checkOutVisible = b.checkOut <= weekDays[weekDays.length - 1].dateStr
                      const leftEdgeIdx = checkInVisible ? startIdx + 0.5 : startIdx
                      const rightEdgeIdx = checkOutVisible ? endIdx + 1.5 : endIdx + 1
                      const leftPct = (leftEdgeIdx / weekDays.length) * 100
                      const widthPct = ((rightEdgeIdx - leftEdgeIdx) / weekDays.length) * 100
                      const colors = getBookingPaymentColors(b)
                      const isBeingDragged = dragInfo?.bookingId === b.id

                      return (
                        <div
                          key={b.id}
                          style={{ left: `calc(${leftPct}% + 2px)`, width: `calc(${widthPct}% - 4px)` }}
                          className={`absolute top-1 bottom-1 rounded-lg border flex items-stretch overflow-hidden ${colors.bg} ${isBeingDragged ? 'opacity-40' : ''}`}
                        >
                          {/* Borde izquierdo: arrastrar para cambiar solo el check-in.
                              Más ancho en táctil: 6px no se puede agarrar con el dedo. */}
                          <div
                            onPointerDown={e => { e.preventDefault(); dragStartPosRef.current = { x: e.clientX, y: e.clientY }; setDragInfo({ bookingId: b.id, mode: 'resize-left' }) }}
                            title="Arrastra para cambiar el check-in"
                            style={{ touchAction: 'none' }}
                            className="w-3 sm:w-1.5 shrink-0 cursor-ew-resize hover:bg-black/10 active:bg-black/15 transition-colors select-none"
                          />

                          {/* Cuerpo: arrastrar para mover toda la reserva, toque simple para ver detalle */}
                          <button
                            onPointerDown={e => { dragStartPosRef.current = { x: e.clientX, y: e.clientY }; setDragInfo({ bookingId: b.id, mode: 'move' }) }}
                            onClick={() => setSelectedBooking(b)}
                            title="Arrastra para mover la reserva"
                            style={{ touchAction: 'none' }}
                            className="flex-1 min-w-0 px-1.5 text-left flex items-center gap-1 cursor-grab active:cursor-grabbing hover:brightness-95 transition-all select-none"
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${colors.bullet} shrink-0`} />
                            <span className="text-[9px] font-extrabold truncate max-w-full block leading-none">
                              {b.guestName.split(' ')[0]}
                            </span>
                            <span className="text-[10px] font-bold opacity-60 shrink-0 leading-none">
                              · {b.guestsCount.adults + b.guestsCount.children}p
                            </span>
                          </button>

                          {/* Borde derecho: arrastrar para cambiar solo el check-out */}
                          <div
                            onPointerDown={e => { e.preventDefault(); dragStartPosRef.current = { x: e.clientX, y: e.clientY }; setDragInfo({ bookingId: b.id, mode: 'resize-right' }) }}
                            title="Arrastra para cambiar el check-out"
                            style={{ touchAction: 'none' }}
                            className="w-3 sm:w-1.5 shrink-0 cursor-ew-resize hover:bg-black/10 active:bg-black/15 transition-colors select-none"
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB C: MES VIEW (Month Analytics & Detailed Lists) */}
      {activeTab === 'mes' && (
        <div className="space-y-6">
          {/* Period navigation */}
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            {mesMode === 'mes' ? (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setMonthAnchor(d => new Date(d.getFullYear(), d.getMonth() - 1, 1)); setMonthPage(1) }}
                  className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-500"
                >
                  ←
                </button>
                <span className="text-sm font-bold text-gray-800 min-w-[160px] text-center">{monthAnchorLabel}</span>
                <button
                  onClick={() => { setMonthAnchor(d => new Date(d.getFullYear(), d.getMonth() + 1, 1)); setMonthPage(1) }}
                  className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-500"
                >
                  →
                </button>
                <button
                  onClick={() => { setMonthAnchor(new Date(todayDate.getFullYear(), todayDate.getMonth(), 1)); setMonthPage(1) }}
                  className="px-3 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider"
                >
                  Hoy
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Desde</label>
                <input
                  type="date"
                  value={customFrom}
                  onChange={e => { setCustomFrom(e.target.value); setMonthPage(1) }}
                  className="border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#C5A059]"
                />
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Hasta</label>
                <input
                  type="date"
                  value={customTo}
                  onChange={e => { setCustomTo(e.target.value); setMonthPage(1) }}
                  className="border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#C5A059]"
                />
              </div>
            )}
            <div className="flex rounded-xl overflow-hidden border border-gray-200 text-xs font-bold uppercase tracking-wider">
              <button
                onClick={() => { setMesMode('mes'); setMonthPage(1) }}
                className={`px-4 py-2 transition-colors ${mesMode === 'mes' ? 'bg-[#3D2B1F] text-white' : 'text-gray-400 hover:bg-gray-50'}`}
              >
                Por Mes
              </button>
              <button
                onClick={() => { setMesMode('personalizado'); setMonthPage(1) }}
                className={`px-4 py-2 transition-colors ${mesMode === 'personalizado' ? 'bg-[#3D2B1F] text-white' : 'text-gray-400 hover:bg-gray-50'}`}
              >
                Rango Personalizado
              </button>
            </div>
          </div>

          {/* Monthly KPI card summaries */}
          <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center md:text-left">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Periodo</span>
              <h3 className="text-2xl font-bold font-serif text-gray-800 mt-1">
                {mesMode === 'personalizado' ? (customFrom && customTo ? `${customFrom} → ${customTo}` : 'Selecciona un rango') : monthAnchorLabel}
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">Estadísticas estimadas</p>
            </div>

            <div className="flex flex-col justify-center border-t md:border-t-0 md:border-l border-gray-100 pt-4 md:pt-0 md:pl-6">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Reservas del Periodo</span>
              <p className="text-2xl font-bold text-[#C5A059] mt-1">{monthListBookings.length} Reservas</p>
              <p className="text-xs text-gray-400 mt-0.5">Ocupación total programada</p>
            </div>

            <div className="flex flex-col justify-center border-t md:border-t-0 md:border-l border-gray-100 pt-4 md:pt-0 md:pl-6">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Ingresos del Mes</span>
              <p className="text-2xl font-bold text-emerald-600 mt-1">{fmt(totalMonthlyRevenue)}</p>
              <p className="text-xs text-gray-400 mt-0.5">Pagos totales estimados</p>
            </div>

            <div className="flex flex-col justify-center border-t md:border-t-0 md:border-l border-gray-100 pt-4 md:pt-0 md:pl-6">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Cabaña Estrella</span>
              <p className="text-2xl font-bold text-indigo-700 mt-1">Mitibibó 🪵</p>
              <p className="text-xs text-gray-400 mt-0.5">Mayor tasa de ocupación</p>
            </div>
          </div>

          {/* Bookings table list */}
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-700 uppercase tracking-widest">Lista Detallada de Reservas</h3>
              <span className="text-xs text-gray-400 font-medium">Mostrando {Math.min(monthPage * PAGE_SIZE, monthListBookings.length)} de {monthListBookings.length} reservas</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="text-left text-xs font-bold text-gray-400 uppercase tracking-widest px-6 py-4">Huésped</th>
                    <th className="text-left text-xs font-bold text-gray-400 uppercase tracking-widest px-4 py-4">Cabaña</th>
                    <th className="text-left text-xs font-bold text-gray-400 uppercase tracking-widest px-4 py-4">Fecha Estadía</th>
                    <th className="text-left text-xs font-bold text-gray-400 uppercase tracking-widest px-4 py-4">Huéspedes</th>
                    <th className="text-left text-xs font-bold text-gray-400 uppercase tracking-widest px-4 py-4">Estado</th>
                    <th className="text-right text-xs font-bold text-gray-400 uppercase tracking-widest px-6 py-4">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {monthListBookings.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-16">
                        <Calendar size={32} className="text-gray-200 mx-auto mb-3" />
                        <p className="text-sm text-gray-400 font-medium">
                          {mesMode === 'personalizado' && (!customFrom || !customTo)
                            ? 'Selecciona una fecha de inicio y fin.'
                            : 'No se encontraron reservas en este periodo.'}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    monthListBookings.slice((monthPage - 1) * PAGE_SIZE, monthPage * PAGE_SIZE).map(b => {
                      const acc = getAccommodation(b.accommodationId)
                      const conf = statusConfig[b.status]
                      return (
                        <tr
                          key={b.id}
                          onClick={() => setSelectedBooking(b)}
                          className="hover:bg-gray-50/50 cursor-pointer transition-colors"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-bold text-gray-800">{b.guestName}</p>
                              {b.locator && (
                                <span className="font-mono text-[8px] font-extrabold text-[#C5A059] bg-[#C5A059]/10 px-2 py-0.5 rounded-md tracking-wider">
                                  {b.locator}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">{b.guestPhone}</p>
                          </td>
                          <td className="px-4 py-4">
                            <p className="text-sm font-semibold text-gray-700">{acc?.title}</p>
                            <span className="text-[9px] uppercase tracking-widest text-[#C5A059] font-bold block mt-0.5">{acc?.type}</span>
                          </td>
                          <td className="px-4 py-4 text-xs font-medium text-gray-600">
                            {parseLocalDate(b.checkIn).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                            {' al '}
                            {parseLocalDate(b.checkOut).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: '2-digit' })}
                          </td>
                          <td className="px-4 py-4">
                            <span className="text-xs font-medium text-gray-600 flex items-center gap-1">
                              <Users size={14} className="text-gray-400" />
                              {b.guestsCount.adults} Ad. {b.guestsCount.children > 0 && `+ ${b.guestsCount.children} Niñ.`}
                            </span>
                            {b.guestsCount.pets > 0 && (
                              <span className="text-[9px] uppercase tracking-widest bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full font-bold inline-block mt-1">
                                🐾 {b.guestsCount.pets} {b.guestsCount.pets === 1 ? 'Mascota' : 'Mascotas'}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[9px] font-extrabold uppercase tracking-widest ${conf.bg}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${conf.bullet}`} />
                              {conf.label}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="text-sm font-bold text-gray-900">{fmt(b.totalAmount)}</span>
                            <span className={`block text-[9px] font-bold mt-0.5 ${getBookingPaymentColors(b).text}`}>
                              {paymentStateLabels[getBookingPaymentState(b)].toUpperCase()}
                            </span>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {monthListBookings.length > PAGE_SIZE && (
              <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
                <button
                  onClick={() => setMonthPage(p => Math.max(1, p - 1))}
                  disabled={monthPage === 1}
                  className="px-4 py-2 border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
                >
                  ← Anterior
                </button>
                <span className="text-xs font-semibold text-gray-500">
                  Página {monthPage} de {Math.ceil(monthListBookings.length / PAGE_SIZE)}
                </span>
                <button
                  onClick={() => setMonthPage(p => Math.min(Math.ceil(monthListBookings.length / PAGE_SIZE), p + 1))}
                  disabled={monthPage >= Math.ceil(monthListBookings.length / PAGE_SIZE)}
                  className="px-4 py-2 border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
                >
                  Siguiente →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. SIDE DRAWER MODAL: Detailed Booking Information Card */}
      {selectedBooking && (
        <div className="fixed inset-0 z-[130] flex items-end sm:items-center justify-end p-0 bg-black/40 backdrop-blur-sm">
          {/* Overlay click to close */}
          <div className="absolute inset-0" onClick={() => { setSelectedBooking(null); setEditingGuest(false); setEditingRoomId(null); setAddingRoomsToBooking(false); setAdditionalAccommodationIds([]); setEditingDates(false); setEditingFinancials(false); setEditingNotes(false); setAddingPayment(false) }} />
          
          {/* En teléfonos, el detalle ocupa todo el viewport. El antiguo 90dvh dejaba
              visible una franja gris del overlay en la parte superior. Los insets
              mantienen el encabezado y las acciones fuera del notch y del indicador
              de inicio cuando el panel se abre desde la app instalada en iPhone. */}
          <div className="relative w-full max-w-none sm:max-w-md h-[100dvh] sm:h-screen bg-white rounded-none sm:rounded-l-3xl sm:rounded-tr-none shadow-2xl px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] sm:p-6 flex flex-col justify-between overflow-y-auto overscroll-contain animate-in slide-in-from-bottom sm:slide-in-from-right duration-300">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] uppercase tracking-widest text-[#C5A059] font-extrabold block">Ficha de Reserva</span>
                    {selectedBooking.locator && (
                      <span className="font-mono text-[9px] font-extrabold text-[#C5A059] bg-[#C5A059]/10 px-2 py-0.5 rounded-md tracking-wider">
                        {selectedBooking.locator}
                      </span>
                    )}
                  </div>
                  <h2 className="text-xl font-bold font-serif text-gray-800 mt-1">Detalle del Huésped</h2>
                  <span className={`inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full border text-[9px] font-extrabold uppercase tracking-widest ${getBookingPaymentColors(selectedBooking).badge}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${getBookingPaymentColors(selectedBooking).bullet}`} />
                    {paymentStateLabels[getBookingPaymentState(selectedBooking)]}
                  </span>
                </div>
                <button
                  onClick={() => { setSelectedBooking(null); setEditingGuest(false); setEditingRoomId(null); setAddingRoomsToBooking(false); setAdditionalAccommodationIds([]); setEditingDates(false); setEditingFinancials(false); setEditingNotes(false); setAddingPayment(false) }}
                  className="p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Guest profile card layout */}
              <div className="py-6 space-y-6">
                {/* 1. Guest profile banner */}
                <div className="bg-gray-50/50 p-4 rounded-3xl border border-gray-100">
                  {editingGuest ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Editar datos del huésped</span>
                        {selectedBooking.locator && bookings.filter(b => b.locator === selectedBooking.locator).length > 1 && (
                          <span className="text-[9px] font-bold text-sky-600">Se actualiza todo el grupo</span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[9px] font-bold text-gray-400 uppercase block mb-1">Nombre</label>
                          <input
                            value={editGuestForm.firstName}
                            onChange={e => setEditGuestForm(f => ({ ...f, firstName: e.target.value }))}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs bg-white outline-none focus:border-[#C5A059]"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-gray-400 uppercase block mb-1">Apellido</label>
                          <input
                            value={editGuestForm.lastName}
                            onChange={e => setEditGuestForm(f => ({ ...f, lastName: e.target.value }))}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs bg-white outline-none focus:border-[#C5A059]"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-gray-400 uppercase block mb-1">Cédula</label>
                          <input
                            value={editGuestForm.ci}
                            onChange={e => setEditGuestForm(f => ({ ...f, ci: e.target.value }))}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs bg-white outline-none focus:border-[#C5A059]"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-gray-400 uppercase block mb-1">Teléfono</label>
                          <input
                            value={editGuestForm.phone}
                            onChange={e => setEditGuestForm(f => ({ ...f, phone: e.target.value }))}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs bg-white outline-none focus:border-[#C5A059]"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="text-[9px] font-bold text-gray-400 uppercase block mb-1">Correo electrónico</label>
                          <input
                            type="email"
                            value={editGuestForm.email}
                            onChange={e => setEditGuestForm(f => ({ ...f, email: e.target.value }))}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs bg-white outline-none focus:border-[#C5A059]"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="text-[9px] font-bold text-gray-400 uppercase block mb-1">Acompañantes</label>
                          <textarea
                            rows={2}
                            value={editGuestForm.companions}
                            onChange={e => setEditGuestForm(f => ({ ...f, companions: e.target.value }))}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs bg-white outline-none focus:border-[#C5A059] resize-none"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={handleSaveGuestDetails}
                          disabled={savingGuest || !editGuestForm.firstName.trim() || !editGuestForm.lastName.trim()}
                          className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider hover:underline disabled:opacity-40"
                        >
                          {savingGuest ? 'Guardando...' : 'Guardar datos'}
                        </button>
                        <button
                          onClick={() => setEditingGuest(false)}
                          disabled={savingGuest}
                          className="text-[10px] font-bold text-gray-400 uppercase tracking-wider hover:underline"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 shrink-0 bg-[#C5A059]/15 text-[#C5A059] border border-[#C5A059]/10 rounded-2xl flex items-center justify-center text-xl font-bold font-serif">
                        {selectedBooking.guestName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base font-bold text-gray-800 leading-tight">{selectedBooking.guestName}</h3>
                        {selectedBooking.guestCi && (
                          <span className="text-[11px] text-gray-400 font-semibold">CI {selectedBooking.guestCi}</span>
                        )}
                        <div className="flex flex-col gap-1 mt-1.5 text-xs text-gray-500">
                          <a href={`tel:${selectedBooking.guestPhone}`} className="flex items-center gap-1 hover:text-[#C5A059]"><Phone size={12} /> {selectedBooking.guestPhone}</a>
                          <a href={`mailto:${selectedBooking.guestEmail}`} className="flex items-center gap-1 hover:text-[#C5A059] truncate"><Mail size={12} className="shrink-0" /> {selectedBooking.guestEmail}</a>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          const { firstName, lastName } = splitPersonName(selectedBooking.guestName.replace(/\s+\(\d+\/\d+\)$/, ''))
                          setEditGuestForm({
                            firstName,
                            lastName,
                            ci: selectedBooking.guestCi || '',
                            phone: selectedBooking.guestPhone || '',
                            email: selectedBooking.guestEmail || '',
                            companions: selectedBooking.companions || ''
                          })
                          setEditingGuest(true)
                        }}
                        className="shrink-0 text-[10px] font-bold text-[#C5A059] uppercase tracking-wider hover:underline"
                      >
                        Editar datos
                      </button>
                    </div>
                  )}
                </div>

                {/* 2. Cabin detail */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">
                      Habitaciones de la reserva ({getBookingGroup(selectedBooking).length})
                    </span>
                    {!addingRoomsToBooking && (
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setAddingRoomsToBooking(true)}
                          className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider hover:underline flex items-center gap-1"
                        >
                          <Plus size={11} /> Añadir habitación
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    {getBookingGroup(selectedBooking).map(roomBooking => {
                      const acc = getAccommodation(roomBooking.accommodationId)
                      const isEditing = editingRoomId === roomBooking.id
                      const previewStandard = isEditing
                        ? getStandardRate(editRoomForm.accommodationId, roomBooking.checkIn, roomBooking.checkOut, editRoomForm.adults, editRoomForm.children)
                        : 0
                      const previewTotal = getAdjustedBookingTotal(previewStandard, roomBooking.specialNotes)
                      return (
                        <div key={roomBooking.id} className="bg-white p-3 border border-gray-100 rounded-2xl">
                          {isEditing ? (
                            <div className="space-y-3">
                              <select
                                value={editRoomForm.accommodationId}
                                onChange={e => setEditRoomForm(f => ({ ...f, accommodationId: Number(e.target.value) }))}
                                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-[#C5A059] bg-white"
                              >
                                {activeAccommodationOptions.map(option => (
                                  <option key={option.id} value={option.id}>{option.title} — Máx. {option.maxCapacity} pax</option>
                                ))}
                              </select>
                              <div className="grid grid-cols-4 gap-2">
                                {(['adults', 'children', 'babies', 'pets'] as const).map(key => (
                                  <div key={key}>
                                    <label className="text-[8px] font-bold text-gray-400 uppercase block mb-1">
                                      {key === 'adults' ? 'Adultos' : key === 'children' ? 'Niños' : key === 'babies' ? 'Bebés' : 'Mascotas'}
                                    </label>
                                    <input
                                      type="number"
                                      min={0}
                                      value={editRoomForm[key]}
                                      onChange={e => setEditRoomForm(f => ({ ...f, [key]: Math.max(0, Number(e.target.value)) }))}
                                      className="w-full border border-gray-200 rounded-lg px-2 py-2 text-xs outline-none focus:border-[#C5A059]"
                                    />
                                  </div>
                                ))}
                              </div>
                              <div className="flex justify-between rounded-xl bg-gray-50 px-3 py-2 text-xs">
                                <span className="font-semibold text-gray-500">Precio recalculado</span>
                                <span className="font-bold text-gray-800">{fmt(previewTotal)}</span>
                              </div>
                              <div className="flex gap-3">
                                <button onClick={handleSaveRoomDetails} disabled={savingRoom} className="text-[10px] font-bold text-emerald-600 uppercase hover:underline disabled:opacity-40">
                                  {savingRoom ? 'Guardando...' : 'Guardar habitación'}
                                </button>
                                <button onClick={() => setEditingRoomId(null)} disabled={savingRoom} className="text-[10px] font-bold text-gray-400 uppercase hover:underline">Cancelar</button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3">
                              <img src={acc?.image} alt={acc?.title} className="w-14 h-14 object-cover rounded-xl" />
                              <div className="min-w-0 flex-1">
                                <h4 className="text-xs font-bold text-gray-800">{acc?.title}</h4>
                                <p className="text-[10px] text-gray-400 mt-1">
                                  {roomBooking.guestsCount.adults} adultos · {roomBooking.guestsCount.children} niños
                                  {roomBooking.guestsCount.babies > 0 && ` · ${roomBooking.guestsCount.babies} bebés`}
                                </p>
                                <p className="text-xs font-bold text-[#8A6D33] mt-1">{fmt(roomBooking.totalAmount)}</p>
                              </div>
                              <div className="flex flex-col items-end gap-2">
                                <button
                                  onClick={() => {
                                    setEditRoomForm({
                                      accommodationId: roomBooking.accommodationId,
                                      adults: roomBooking.guestsCount.adults,
                                      children: roomBooking.guestsCount.children,
                                      babies: roomBooking.guestsCount.babies,
                                      pets: roomBooking.guestsCount.pets
                                    })
                                    setEditingRoomId(roomBooking.id)
                                  }}
                                  className="text-[9px] font-bold text-[#C5A059] uppercase hover:underline"
                                >
                                  Editar
                                </button>
                                {getBookingGroup(selectedBooking).length > 1 && (
                                  <button onClick={() => handleDeleteBooking(roomBooking.id)} className="text-[9px] font-bold text-rose-500 uppercase hover:underline">
                                    Anular
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {addingRoomsToBooking && (() => {
                    const groupBookings = selectedBooking.locator
                      ? bookings.filter(b => b.locator === selectedBooking.locator)
                      : [selectedBooking]
                    const assignedIds = new Set(groupBookings.map(b => b.accommodationId))
                    const remainingSlots = Math.max(0, 4 - groupBookings.length)
                    const capacity = additionalAccommodationIds.reduce((sum, id) => sum + getMaxCapacity(id), 0)
                    const guests = additionalGuests.adults + additionalGuests.children
                    const selectedAdditionalId = additionalAccommodationIds[0]
                    const additionalStandardTotal = selectedAdditionalId
                      ? getStandardRate(selectedAdditionalId, selectedBooking.checkIn, selectedBooking.checkOut, additionalGuests.adults, additionalGuests.children)
                      : 0
                    const additionalDiscount = getBookingDiscountPercent(selectedBooking.specialNotes)
                    const additionalTotal = Math.round(additionalStandardTotal * (1 - additionalDiscount / 100) * 100) / 100
                    return (
                      <div className="border border-emerald-100 bg-emerald-50/40 rounded-2xl p-3 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-bold text-emerald-800">Agregar a esta reserva</p>
                            <p className="text-[10px] text-emerald-700/70">Agrega una por vez para asignar correctamente sus ocupantes.</p>
                          </div>
                          <span className="text-[10px] font-bold text-emerald-700">Quedan {remainingSlots} cupos</span>
                        </div>

                        <div className="max-h-44 overflow-y-auto custom-scrollbar space-y-1.5">
                          {activeAccommodationOptions.map(acc => {
                            if (assignedIds.has(acc.id)) return null
                            const occupied = bookings.some(b =>
                              b.accommodationId === acc.id &&
                              selectedBooking.checkIn < b.checkOut && selectedBooking.checkOut > b.checkIn
                            )
                            const selected = additionalAccommodationIds.includes(acc.id)
                            return (
                              <label key={acc.id} className={`flex items-center gap-2 rounded-xl border p-2 ${occupied ? 'opacity-50 bg-rose-50 border-rose-100' : selected ? 'bg-white border-emerald-300' : 'bg-white border-gray-100'}`}>
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  disabled={occupied}
                                  onChange={() => {
                                    if (selected) {
                                      setAdditionalAccommodationIds([])
                                    } else if (remainingSlots > 0) {
                                      setAdditionalAccommodationIds([acc.id])
                                    }
                                  }}
                                  className="rounded text-emerald-600 focus:ring-emerald-500"
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="text-[11px] font-bold text-gray-700 truncate">{acc.title}</p>
                                  <p className="text-[9px] text-gray-400">Máx. {acc.maxCapacity} pax</p>
                                </div>
                                {occupied && <span className="text-[8px] font-bold text-rose-500 uppercase">Ocupada</span>}
                              </label>
                            )
                          })}
                        </div>

                        <div className="grid grid-cols-4 gap-2">
                          {(['adults', 'children', 'babies', 'pets'] as const).map(key => (
                            <div key={key}>
                              <label className="text-[8px] font-bold text-gray-400 uppercase block mb-1">
                                {key === 'adults' ? 'Adultos' : key === 'children' ? 'Niños' : key === 'babies' ? 'Bebés' : 'Mascotas'}
                              </label>
                              <input
                                type="number"
                                min={0}
                                value={additionalGuests[key]}
                                onChange={e => setAdditionalGuests(prev => ({ ...prev, [key]: Math.max(0, Number(e.target.value)) }))}
                                className="w-full border border-gray-200 rounded-lg px-2 py-2 text-xs bg-white outline-none focus:border-emerald-400"
                              />
                            </div>
                          ))}
                        </div>
                        {capacity > 0 && guests > capacity && (
                          <p className="text-[10px] font-semibold text-rose-600">Capacidad excedida: {guests} huéspedes para {capacity} plazas.</p>
                        )}
                        {selectedAdditionalId && (
                          <div className="flex items-center justify-between rounded-xl border border-emerald-100 bg-white px-3 py-2.5 text-xs">
                            <span className="font-semibold text-gray-600">Precio de esta habitación</span>
                            <span className="font-bold text-emerald-700">{fmt(additionalTotal)}</span>
                          </div>
                        )}

                        <div className="flex items-center gap-3">
                          <button
                            onClick={handleAddRoomsToBooking}
                            disabled={savingAdditionalRooms || additionalAccommodationIds.length === 0 || guests > capacity}
                            className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider hover:underline disabled:opacity-40"
                          >
                            {savingAdditionalRooms ? 'Agregando...' : 'Agregar a la reserva'}
                          </button>
                          <button
                            onClick={() => { setAddingRoomsToBooking(false); setAdditionalAccommodationIds([]) }}
                            disabled={savingAdditionalRooms}
                            className="text-[10px] font-bold text-gray-400 uppercase tracking-wider hover:underline"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )
                  })()}
                </div>

                {/* 3. Dates and Guests */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Fechas de la Estadía</span>
                    {!editingDates && (
                      <button
                        onClick={() => {
                          setEditDatesForm({ checkIn: selectedBooking.checkIn, checkOut: selectedBooking.checkOut })
                          setEditingDates(true)
                        }}
                        className="text-[10px] font-bold text-[#C5A059] uppercase tracking-wider hover:underline"
                      >
                        Cambiar
                      </button>
                    )}
                  </div>
                  {editingDates ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Check-In</label>
                          <input
                            type="date"
                            value={editDatesForm.checkIn}
                            onChange={e => setEditDatesForm(f => ({ ...f, checkIn: e.target.value }))}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-[#C5A059]"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Check-Out</label>
                          <input
                            type="date"
                            value={editDatesForm.checkOut}
                            onChange={e => setEditDatesForm(f => ({ ...f, checkOut: e.target.value }))}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-[#C5A059]"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={async () => {
                            if (editDatesForm.checkOut <= editDatesForm.checkIn) {
                              alert('Error: la fecha de check-out debe ser posterior al check-in.')
                              return
                            }
                            const results = []
                            for (const room of getBookingGroup(selectedBooking)) {
                              results.push(await reassignBooking(room.id, room.accommodationId, editDatesForm.checkIn, editDatesForm.checkOut))
                            }
                            if (results.every(Boolean)) setEditingDates(false)
                          }}
                          className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider hover:underline"
                        >
                          Guardar en toda la reserva
                        </button>
                        <button
                          onClick={() => setEditingDates(false)}
                          className="text-[10px] font-bold text-gray-400 uppercase tracking-wider hover:underline"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-50/50 p-4 border border-gray-100 rounded-2xl">
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Check-In</span>
                        <span className="text-sm font-bold text-gray-700">{parseLocalDate(selectedBooking.checkIn).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                      </div>
                      <div className="bg-gray-50/50 p-4 border border-gray-100 rounded-2xl">
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Check-Out</span>
                        <span className="text-sm font-bold text-gray-700">{parseLocalDate(selectedBooking.checkOut).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. Guests count list */}
                <div className="bg-gray-50/30 p-4 border border-gray-100 rounded-2xl space-y-3">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Resumen de ocupantes</span>
                  <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-gray-600">
                    <div className="flex items-center gap-2">
                      <Users size={16} className="text-gray-400" />
                      <span>{getBookingGroup(selectedBooking).reduce((sum, room) => sum + room.guestsCount.adults, 0)} Adultos</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Baby size={16} className="text-gray-400" />
                      <span>
                        {getBookingGroup(selectedBooking).reduce((sum, room) => sum + room.guestsCount.children, 0)} Niños
                        {getBookingGroup(selectedBooking).reduce((sum, room) => sum + room.guestsCount.babies, 0) > 0 && ` (${getBookingGroup(selectedBooking).reduce((sum, room) => sum + room.guestsCount.babies, 0)} bebés)`}
                      </span>
                    </div>
                    {getBookingGroup(selectedBooking).reduce((sum, room) => sum + room.guestsCount.pets, 0) > 0 && (
                      <div className="flex items-center gap-2 col-span-2 text-emerald-700 font-bold">
                        <span>🐾 Traen {getBookingGroup(selectedBooking).reduce((sum, room) => sum + room.guestsCount.pets, 0)} mascota(s)</span>
                      </div>
                    )}
                  </div>
                  {selectedBooking.companions && (
                    <div className="pt-2 border-t border-gray-100 text-xs text-gray-600">
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Nombres de Acompañantes</span>
                      {selectedBooking.companions}
                    </div>
                  )}
                </div>

                {/* 5. Special Notes */}
                <div className="bg-amber-500/5 border border-amber-500/10 p-4 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-amber-800 font-bold text-xs">
                      <Info size={14} /> Notas de la Administración
                    </div>
                    {!editingNotes && (
                      <button
                        onClick={() => { setEditNotes(selectedBooking.specialNotes || ''); setEditingNotes(true) }}
                        className="text-[9px] font-bold text-amber-700 uppercase hover:underline"
                      >
                        Editar
                      </button>
                    )}
                  </div>
                  {editingNotes ? (
                    <div className="space-y-2">
                      <textarea
                        rows={4}
                        value={editNotes}
                        onChange={e => setEditNotes(e.target.value)}
                        className="w-full border border-amber-200 rounded-xl px-3 py-2.5 text-xs bg-white outline-none focus:border-amber-400 resize-none"
                        placeholder="Notas internas, solicitudes especiales, referencias..."
                      />
                      <div className="flex gap-3">
                        <button onClick={handleSaveBookingNotes} disabled={savingNotes} className="text-[9px] font-bold text-emerald-600 uppercase hover:underline disabled:opacity-40">
                          {savingNotes ? 'Guardando...' : 'Guardar notas'}
                        </button>
                        <button onClick={() => setEditingNotes(false)} disabled={savingNotes} className="text-[9px] font-bold text-gray-400 uppercase hover:underline">Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-amber-700/80 leading-relaxed font-medium">
                      {selectedBooking.specialNotes ? '"' + selectedBooking.specialNotes + '"' : 'Sin notas registradas.'}
                    </p>
                  )}
                </div>

                {/* 6. Finanzas */}
                <div className="bg-gray-50/50 p-4 border border-gray-100 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Estado Financiero</span>
                    {!editingFinancials && (
                      <button
                        onClick={() => {
                          const group = getBookingGroup(selectedBooking)
                          setEditDiscountPercent(getBookingDiscountPercent(selectedBooking.specialNotes))
                          setEditFixedDiscountAmount(group.reduce(
                            (sum, room) => sum + getBookingFixedDiscountAmount(room.specialNotes),
                            0
                          ))
                          setEditingFinancials(true)
                        }}
                        className="text-[10px] font-bold text-[#C5A059] uppercase tracking-wider hover:underline flex items-center gap-1"
                      >
                        <Percent size={11} /> Editar tarifa / descuento
                      </button>
                    )}
                  </div>

                  {editingFinancials ? (() => {
                    const groupBookings = getBookingGroup(selectedBooking)
                    const standardTotal = groupBookings.reduce((sum, room) => sum + getStandardRate(
                      room.accommodationId,
                      room.checkIn,
                      room.checkOut,
                      room.guestsCount.adults,
                      room.guestsCount.children
                    ), 0)
                    const totalAfterPercent = standardTotal * (1 - editDiscountPercent / 100)
                    const normalizedFixedDiscount = Math.min(
                      totalAfterPercent,
                      Math.max(0, Number(editFixedDiscountAmount) || 0)
                    )
                    const previewTotal = Math.max(0, Math.round((totalAfterPercent - normalizedFixedDiscount) * 100) / 100)
                    return (
                      <div className="pt-2 space-y-3 border-t border-gray-200/70">
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500 font-semibold">Tarifa estándar calculada</span>
                          <span className="font-bold text-gray-700">{fmt(standardTotal)}</span>
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Descuento individual (%)</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step="0.01"
                              value={editDiscountPercent}
                              onChange={e => setEditDiscountPercent(Math.min(100, Math.max(0, Number(e.target.value))))}
                              className="w-24 border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#C5A059] bg-white"
                            />
                            {[0, 10, 15, 20].map(value => (
                              <button
                                key={value}
                                type="button"
                                onClick={() => setEditDiscountPercent(value)}
                                className={`px-2 py-2 rounded-lg text-[9px] font-bold border transition-colors ${editDiscountPercent === value ? 'bg-[#C5A059] text-white border-[#C5A059]' : 'bg-white text-gray-500 border-gray-200'}`}
                              >
                                {value}%
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Descuento fijo (USD)</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">$</span>
                            <input
                              type="number"
                              min={0}
                              max={totalAfterPercent}
                              step="0.01"
                              value={editFixedDiscountAmount}
                              onChange={e => setEditFixedDiscountAmount(Math.min(
                                totalAfterPercent,
                                Math.max(0, Number(e.target.value))
                              ))}
                              className="w-full border border-gray-200 rounded-xl pl-7 pr-3 py-2 text-xs outline-none focus:border-[#C5A059] bg-white"
                              placeholder="Ejemplo: 5"
                            />
                          </div>
                          <p className="text-[9px] text-gray-400 mt-1">Se resta directamente del total, después del porcentaje.</p>
                        </div>
                        <div className="flex justify-between text-xs bg-white border border-[#C5A059]/20 rounded-xl p-3">
                          <span className="text-gray-600 font-semibold">Nuevo total de toda la reserva</span>
                          <span className="font-bold text-[#8A6D33]">{fmt(previewTotal)}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={handleSaveBookingDiscount}
                            disabled={savingFinancials}
                            className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider hover:underline disabled:opacity-50"
                          >
                            {savingFinancials ? 'Guardando...' : 'Guardar cambios'}
                          </button>
                          <button
                            onClick={() => setEditingFinancials(false)}
                            disabled={savingFinancials}
                            className="text-[10px] font-bold text-gray-400 uppercase tracking-wider hover:underline disabled:opacity-50"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )
                  })() : (() => {
                    const groupBookings = getBookingGroup(selectedBooking)
                    const percent = getBookingDiscountPercent(selectedBooking.specialNotes)
                    const fixedDiscount = groupBookings.reduce(
                      (sum, room) => sum + getBookingFixedDiscountAmount(room.specialNotes),
                      0
                    )
                    const standardTotals = groupBookings.map(room => getStandardRate(
                      room.accommodationId,
                      room.checkIn,
                      room.checkOut,
                      room.guestsCount.adults,
                      room.guestsCount.children
                    ))
                    const totalAfterPercent = standardTotals.reduce(
                      (sum, total) => sum + Math.max(0, Math.round(total * (1 - percent / 100) * 100) / 100),
                      0
                    )
                    const percentageDiscount = Math.max(
                      0,
                      Math.round((standardTotals.reduce((sum, total) => sum + total, 0) - totalAfterPercent) * 100) / 100
                    )
                    const hasDiscount = percentageDiscount > 0 || fixedDiscount > 0
                    const finalTotal = groupBookings.reduce((sum, room) => sum + room.totalAmount, 0)

                    return (
                      <>
                        {hasDiscount && (
                          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block pt-1">
                            Tarifa estándar por alojamiento
                          </span>
                        )}
                        {groupBookings.map((room, index) => (
                          <div key={room.id} className="flex justify-between gap-3 text-[10px] py-1 border-b border-gray-100/50">
                            <span className="text-gray-500 truncate">{getAccommodation(room.accommodationId)?.title}</span>
                            <span className="font-bold text-gray-700 shrink-0">
                              {fmt(hasDiscount ? standardTotals[index] : room.totalAmount)}
                            </span>
                          </div>
                        ))}
                        {percentageDiscount > 0 && (
                          <div className="flex justify-between gap-3 text-xs py-1 border-b border-gray-100/50">
                            <span className="text-gray-500 font-semibold">Descuento individual ({percent}%)</span>
                            <span className="font-bold text-emerald-600 shrink-0">-{fmt(percentageDiscount)}</span>
                          </div>
                        )}
                        {fixedDiscount > 0 && (
                          <div className="flex justify-between text-xs py-1 border-b border-gray-100/50">
                            <span className="text-gray-500 font-semibold">Descuento fijo</span>
                            <span className="font-bold text-emerald-600">-{fmt(fixedDiscount)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-xs py-1 border-b border-gray-100/50">
                          <span className="text-gray-500 font-semibold">Costo total de la reserva</span>
                          <span className="font-bold text-gray-800">{fmt(finalTotal)}</span>
                        </div>
                      </>
                    )
                  })()}
                </div>

                {/* 7. Historial de Pagos: cada abono con su fecha, método y número de operación */}
                <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Historial de Pagos</span>
                    {!addingPayment && (
                      <button
                        onClick={() => setAddingPayment(true)}
                        className="text-[10px] font-bold text-[#C5A059] uppercase tracking-wider hover:underline flex items-center gap-1"
                      >
                        <Plus size={12} /> Agregar Pago
                      </button>
                    )}
                  </div>

                  {loadingPayments ? (
                    <p className="text-xs text-gray-400 text-center py-2">Cargando...</p>
                  ) : bookingPayments.length === 0 && !addingPayment ? (
                    <p className="text-xs text-gray-400 text-center py-2">Todavía no hay abonos registrados.</p>
                  ) : (
                    <div className="space-y-2">
                      {bookingPayments.map(p => (
                        <div key={p.id} className="flex items-center justify-between gap-2 bg-gray-50/50 border border-gray-100 rounded-xl px-3 py-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-gray-800">{fmt(p.amount)}</span>
                              <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-full px-1.5 py-0.5">
                                {p.status === 'verificado' ? 'Verificado' : 'Pendiente'}
                              </span>
                            </div>
                            <p className="text-[10px] text-gray-400 mt-0.5 truncate">
                              {parseLocalDate(p.paymentDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                              {' · '}<span className="capitalize">{p.method}</span>
                              {p.reference && <> · <span className="select-all">{p.reference}</span></>}
                            </p>
                          </div>
                          <button
                            onClick={() => handleDeletePayment(p)}
                            className="p-1.5 text-gray-300 hover:text-rose-500 transition-colors shrink-0"
                            title="Eliminar abono"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {(() => {
                    const group = getBookingGroup(selectedBooking)
                    const totalCost = group.reduce((sum, room) => sum + room.totalAmount, 0)
                    const totalPaid = group.reduce((sum, room) => sum + room.amountPaid, 0)
                    const balance = Math.max(0, totalCost - totalPaid)
                    const credit = Math.max(0, totalPaid - totalCost)
                    return (
                      <div className="mt-3 pt-3 border-t-2 border-gray-200 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-gray-600">Costo total</span>
                          <span className="font-bold text-gray-900">{fmt(totalCost)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-gray-600">Monto abonado</span>
                          <span className="font-bold text-emerald-600">{fmt(totalPaid)}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm pt-1">
                          <span className="font-bold text-gray-900">Deuda del cliente</span>
                          <span className={balance > 0 ? 'font-bold text-rose-500' : 'font-bold text-emerald-600'}>{fmt(balance)}</span>
                        </div>
                        {credit > 0 && (
                          <div className="flex items-center justify-between text-xs pt-1 border-t border-emerald-100">
                            <span className="font-bold text-emerald-700">Saldo a favor del cliente</span>
                            <span className="font-bold text-emerald-600">{fmt(credit)}</span>
                          </div>
                        )}
                      </div>
                    )
                  })()}

                  {addingPayment && (
                    <div className="space-y-2 pt-2 border-t border-gray-100">
                      <p className="text-[10px] text-sky-700 bg-sky-50 border border-sky-100 rounded-xl px-3 py-2">
                        Este pago se registrará como un abono global de la reserva. Deuda actual: <strong>{fmt(Math.max(0, getBookingGroup(selectedBooking).reduce((sum, room) => sum + room.totalAmount, 0) - getBookingGroup(selectedBooking).reduce((sum, room) => sum + room.amountPaid, 0)))}</strong>.
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Monto ($)</label>
                          <input
                            type="number"
                            min={0}
                            value={paymentForm.amount}
                            onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))}
                            placeholder="0"
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#C5A059]"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Fecha</label>
                          <input
                            type="date"
                            value={paymentForm.date}
                            onChange={e => setPaymentForm(f => ({ ...f, date: e.target.value }))}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#C5A059]"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Método</label>
                          <select
                            value={paymentForm.method}
                            onChange={e => setPaymentForm(f => ({ ...f, method: e.target.value as typeof paymentForm.method }))}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#C5A059] bg-white capitalize"
                          >
                            <option value="transferencia">Transferencia</option>
                            <option value="zelle">Zelle</option>
                            <option value="efectivo">Efectivo</option>
                            <option value="tarjeta">Tarjeta</option>
                            <option value="cheque">Cheque</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-1">N° de Operación</label>
                          <input
                            type="text"
                            value={paymentForm.reference}
                            onChange={e => setPaymentForm(f => ({ ...f, reference: e.target.value }))}
                            placeholder="Ej. 30226263971"
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#C5A059]"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-3 pt-1">
                        <button onClick={handleAddPayment} className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider hover:underline">
                          Guardar Abono
                        </button>
                        <button
                          onClick={() => { setAddingPayment(false); setPaymentForm({ amount: '', date: todayStr, method: 'transferencia', reference: '' }) }}
                          className="text-[10px] font-bold text-gray-400 uppercase tracking-wider hover:underline"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Actions Drawer Footer */}
            <div className="border-t border-gray-100 pt-4 space-y-2">
              {/* Reenviar el comprobante: sirve tanto si el huésped lo perdió como para
                  las reservas viejas, que se crearon antes de que existiera el voucher. */}
              <button
                onClick={() => handleSendVoucher(selectedBooking)}
                disabled={sendingVoucher || !selectedBooking.guestEmail?.trim()}
                title={selectedBooking.guestEmail?.trim() ? '' : 'Esta reserva no tiene correo cargado'}
                className="w-full flex items-center justify-center gap-1.5 py-3.5 border border-[#C5A059]/40 bg-[#C5A059]/10 hover:bg-[#C5A059]/20 text-[#8A6D33] font-bold rounded-2xl text-xs uppercase tracking-wider transition-all active:scale-95 disabled:opacity-40"
              >
                <Mail size={15} />
                {sendingVoucher
                  ? 'Enviando…'
                  : voucherSentFor === selectedBooking.id
                    ? '✓ Comprobante enviado'
                    : 'Enviar comprobante por correo'}
              </button>

              {!selectedBooking.confirmed && (
                <button
                  onClick={() => handleConfirmBooking(selectedBooking.id)}
                  className="w-full flex items-center justify-center gap-1.5 py-3.5 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-2xl text-xs uppercase tracking-wider transition-all active:scale-95 shadow-lg shadow-sky-500/10"
                >
                  <Check size={15} /> Confirmar Reserva
                </button>
              )}

              {selectedBooking.status === 'checkin_hoy' && (
                <button
                  onClick={() => handleCheckIn(selectedBooking.id)}
                  className="w-full flex items-center justify-center gap-1.5 py-3.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-2xl text-xs uppercase tracking-wider transition-all active:scale-95 shadow-lg shadow-amber-500/10"
                >
                  <LogIn size={15} /> Completar Check-In
                </button>
              )}

              {selectedBooking.status === 'checkout_hoy' && (
                <button
                  onClick={() => handleCheckOut(selectedBooking.id)}
                  className="w-full flex items-center justify-center gap-1.5 py-3.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-2xl text-xs uppercase tracking-wider transition-all active:scale-95 shadow-lg shadow-orange-500/10"
                >
                  <LogOut size={15} /> Completar Check-Out
                </button>
              )}

              {selectedBooking.locator && bookings.filter(b => b.locator === selectedBooking.locator).length > 1 && (
                <div className="rounded-2xl border border-sky-100 bg-sky-50 p-3 text-[11px] leading-relaxed text-sky-800">
                  <strong>Reserva grupal:</strong> esta habitación forma parte de un grupo de {bookings.filter(b => b.locator === selectedBooking.locator).length} unidades. Puedes anularla sin afectar las demás ni modificar los abonos entregados por el cliente.
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => handleDeleteBooking(selectedBooking.id)}
                  className="flex-1 py-3 border border-rose-100 hover:bg-rose-50 text-rose-500 font-bold rounded-2xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
                >
                  <Trash2 size={14} />
                  {selectedBooking.locator && bookings.filter(b => b.locator === selectedBooking.locator).length > 1
                    ? 'Anular esta habitación'
                    : 'Eliminar reserva'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. CREATE BOOKING MODAL (Administrador Form) */}
      {showAddModal && (
        <div className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          {/* Overlay click to close */}
          <div className="absolute inset-0" onClick={() => closeAddModal()} />
          
          {/* dvh, no vh: con el teclado del telefono abierto, 90vh deja los botones de
              Cancelar/Registrar fuera de la pantalla y no se puede guardar la reserva. */}
          <div className="relative bg-white rounded-t-[2rem] sm:rounded-[2.5rem] shadow-2xl w-full max-w-lg p-5 sm:p-6 space-y-5 overflow-y-auto max-h-[92dvh] sm:max-h-[90dvh] z-10 animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h2 className="text-xl font-bold font-serif text-gray-800">Registrar Nueva Reserva</h2>
              <button
                onClick={() => closeAddModal()}
                className="p-1.5 hover:bg-gray-100 rounded-xl transition-colors text-gray-500"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Localizador pre-generado */}
              <div className="bg-brand-neutral/60 border border-gray-100 rounded-2xl p-3.5 flex justify-between items-center text-xs">
                <span className="text-gray-500 font-semibold uppercase tracking-wider text-[10px]">Localizador de Reserva</span>
                <span className="font-mono font-bold text-[#C5A059] tracking-widest bg-[#C5A059]/10 px-3.5 py-1.5 rounded-xl text-sm select-all">
                  {locatorCode}
                </span>
              </div>

              {/* Guest details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="col-span-1 sm:col-span-2 relative">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Nombre</label>
                      <input
                        type="text"
                        autoComplete="off"
                        placeholder="Ej. Ana"
                        value={form.guestFirstName}
                        onFocus={() => setShowSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                        onChange={e => {
                          setForm(f => ({ ...f, guestFirstName: e.target.value }))
                          setShowSuggestions(true)
                        }}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-[#C5A059]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Apellido</label>
                      <input
                        type="text"
                        autoComplete="off"
                        placeholder="Ej. Peralta"
                        value={form.guestLastName}
                        onFocus={() => setShowSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                        onChange={e => {
                          setForm(f => ({ ...f, guestLastName: e.target.value }))
                          setShowSuggestions(true)
                        }}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-[#C5A059]"
                      />
                    </div>
                  </div>
                  {/* Autocomplete Dropdown — busca coincidencias por nombre o por apellido */}
                  {shouldShowGuestSuggestions && guestSuggestions.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden max-h-48 custom-scrollbar">
                      {guestSuggestions.map((g, i) => (
                        <div
                          key={i}
                          onClick={() => {
                            const { firstName, lastName } = splitPersonName(cleanGuestSuggestionName(g.name))
                            setForm(f => ({
                              ...f,
                              guestFirstName: firstName,
                              guestLastName: lastName,
                              guestPhone: g.phone || f.guestPhone,
                              guestEmail: g.email || f.guestEmail,
                              guestCi: g.ci || f.guestCi,
                              companions: g.companions || f.companions
                            }))
                            setShowSuggestions(false)
                          }}
                          className="px-4 py-2 hover:bg-[#C5A059]/10 cursor-pointer flex flex-col gap-0.5 border-b border-gray-50 last:border-0"
                        >
                          <span className="text-xs font-bold text-gray-800">{g.name}</span>
                          {(g.ci || g.phone || g.email) && (
                            <span className="text-[10px] text-gray-400">
                              {[g.ci, g.phone, g.email].filter(Boolean).join(' • ')}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Cédula de Identidad (CI)</label>
                  <input
                    type="text"
                    autoComplete="off"
                    placeholder="Ej. V-15395394"
                    value={form.guestCi}
                    onChange={e => setForm(f => ({ ...f, guestCi: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-[#C5A059]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Teléfono</label>
                  <input
                    type="text"
                    autoComplete="off"
                    placeholder="+58 412-000-0000"
                    value={form.guestPhone}
                    onChange={e => setForm(f => ({ ...f, guestPhone: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-[#C5A059]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Correo Electrónico</label>
                  <input
                    type="email"
                    autoComplete="off"
                    placeholder="email@correo.com"
                    value={form.guestEmail}
                    onChange={e => setForm(f => ({ ...f, guestEmail: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-[#C5A059]"
                  />
                </div>
                <div className="col-span-1 sm:col-span-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Acompañantes</label>
                  <input
                    type="text"
                    autoComplete="off"
                    placeholder="Nombres y apellidos de los demás huéspedes"
                    value={form.companions}
                    onChange={e => setForm(f => ({ ...f, companions: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-[#C5A059]"
                  />
                </div>
              </div>

              {/* Selección de uno o varios alojamientos bajo el mismo localizador */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="col-span-1 sm:col-span-3">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Habitaciones o cabañas</label>
                    <span className="text-[10px] font-bold text-[#C5A059]">{selectedAccommodationIds.length}/4 seleccionadas</span>
                  </div>
                  <div className="max-h-56 overflow-y-auto custom-scrollbar border border-gray-200 rounded-2xl bg-white p-2 space-y-1.5">
                    {activeAccommodationOptions.map(acc => {
                      const dbPrice = dbAccommodations.find(o => Number(o.id) === acc.id)?.price
                      const selected = selectedAccommodationIds.includes(acc.id)
                      const collision = bookings.find(b =>
                        b.accommodationId === acc.id && form.checkIn < b.checkOut && form.checkOut > b.checkIn
                      )
                      return (
                        <label
                          key={acc.id}
                          className={`flex items-center gap-3 rounded-xl border p-2.5 transition-colors ${
                            collision
                              ? 'bg-rose-50/60 border-rose-100 opacity-60 cursor-not-allowed'
                              : selected
                                ? 'bg-[#C5A059]/10 border-[#C5A059]/40 cursor-pointer'
                                : 'bg-white border-gray-100 hover:bg-gray-50 cursor-pointer'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            disabled={!!collision && !selected}
                            onChange={() => {
                              if (selected) {
                                if (selectedAccommodationIds.length === 1) return
                                const next = selectedAccommodationIds.filter(id => id !== acc.id)
                                setSelectedAccommodationIds(next)
                                setForm(f => ({ ...f, accommodationId: next[0] }))
                              } else {
                                if (selectedAccommodationIds.length >= 4) {
                                  alert('Puedes seleccionar hasta 4 habitaciones o cabañas por reserva.')
                                  return
                                }
                                const next = [...selectedAccommodationIds, acc.id]
                                setSelectedAccommodationIds(next)
                                setForm(f => ({ ...f, accommodationId: next[0] }))
                              }
                            }}
                            className="rounded text-[#C5A059] focus:ring-[#C5A059]"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-gray-700 truncate">{acc.title}</p>
                            <p className="text-[10px] text-gray-400">${Number(dbPrice ?? acc.price)}/noche · Máx. {acc.maxCapacity} pax</p>
                          </div>
                          {collision && <span className="text-[9px] font-bold text-rose-500 uppercase">Ocupada</span>}
                        </label>
                      )
                    })}
                  </div>
                  {selectedAccommodationIds.length > 1 && (
                    <p className="mt-2 text-[10px] text-emerald-700 font-semibold">
                      Reserva grupal: las {selectedAccommodationIds.length} unidades compartirán el localizador {locatorCode} y el pago se distribuirá sin duplicarse.
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Check-In</label>
                  <input
                    type="date"
                    value={form.checkIn}
                    onChange={e => setForm(f => ({ ...f, checkIn: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-[#C5A059]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Check-Out</label>
                  <input
                    type="date"
                    value={form.checkOut}
                    onChange={e => setForm(f => ({ ...f, checkOut: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-[#C5A059]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Adultos</label>
                  <input
                    type="number"
                    min={1}
                    value={form.adults}
                    onChange={e => setForm(f => ({ ...f, adults: Number(e.target.value) }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-[#C5A059]"
                  />
                </div>
              </div>

              {/* Collision / Date range warning */}
              {(() => {
                if (form.checkOut <= form.checkIn) {
                  return (
                    <div className="bg-rose-50 border border-rose-100 text-rose-800 text-xs p-3.5 rounded-2xl flex flex-col gap-0.5 animate-fade-in">
                      <span className="font-bold">⚠️ Rango de Fechas Inválido</span>
                      <span>La fecha de Check-Out debe ser posterior al Check-In.</span>
                    </div>
                  )
                }
                const collision = bookings.find(b =>
                  selectedAccommodationIds.includes(b.accommodationId) &&
                  form.checkIn < b.checkOut && form.checkOut > b.checkIn
                )
                if (collision) {
                  return (
                    <div className="bg-rose-50 border border-rose-100 text-rose-800 text-xs p-3.5 rounded-2xl flex flex-col gap-0.5 animate-pulse">
                      <span className="font-bold">⚠️ Conflicto de Fechas Encontrado</span>
                      <span><strong>{getAccommodation(collision.accommodationId)?.title}</strong> ya está reservada por <strong>"{collision.guestName}"</strong> del <strong>{collision.checkIn}</strong> al <strong>{collision.checkOut}</strong>.</span>
                    </div>
                  )
                }
                const maxCapacity = selectedAccommodationIds.reduce((sum, id) => sum + getMaxCapacity(id), 0)
                const totalGuests = Number(form.adults) + Number(form.children)
                if (maxCapacity > 0 && totalGuests > maxCapacity) {
                  return (
                    <div className="bg-rose-50 border border-rose-100 text-rose-800 text-xs p-3.5 rounded-2xl flex flex-col gap-0.5 animate-fade-in">
                      <span className="font-bold">⚠️ Capacidad Excedida</span>
                      <span>Las unidades seleccionadas admiten hasta <strong>{maxCapacity} personas</strong> y se ingresaron <strong>{totalGuests}</strong>.</span>
                    </div>
                  )
                }
                return null
              })()}

              {/* Extras count */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Niños</label>
                  <input
                    type="number"
                    min={0}
                    value={form.children}
                    onChange={e => setForm(f => ({ ...f, children: Number(e.target.value) }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-[#C5A059]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Bebés</label>
                  <input
                    type="number"
                    min={0}
                    value={form.babies}
                    onChange={e => setForm(f => ({ ...f, babies: Number(e.target.value) }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-[#C5A059]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">🐾 Mascotas</label>
                  <input
                    type="number"
                    min={0}
                    value={form.pets}
                    onChange={e => setForm(f => ({ ...f, pets: Number(e.target.value) }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-[#C5A059]"
                  />
                </div>
              </div>

              {/* Tarifa y Descuento */}
              <div className="bg-brand-neutral/40 p-4 rounded-2xl border border-gray-100 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500 font-medium">Tarifa Estándar calculada:</span>
                  <span className="font-bold text-gray-800">${standardRate} USD</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="useCustomRate"
                    checked={useCustomRate}
                    onChange={e => {
                      setUseCustomRate(e.target.checked)
                      if (!e.target.checked) {
                        setDiscountPercent(0)
                      }
                    }}
                    className="text-[#C5A059] focus:ring-[#C5A059] rounded"
                  />
                  <label htmlFor="useCustomRate" className="text-xs font-semibold text-gray-700 cursor-pointer">
                    Modificar tarifa o aplicar descuento
                  </label>
                </div>

                {useCustomRate && (
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-200/50 animate-fade-in">
                    <div>
                      <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-1 text-gray-500">Descuento (%)</label>
                      <select
                        value={discountPercent}
                        onChange={e => setDiscountPercent(Number(e.target.value))}
                        className="w-full border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs outline-none focus:border-[#C5A059] bg-white text-gray-700"
                      >
                        <option value={0}>Sin Descuento</option>
                        <option value={10}>10% OFF</option>
                        <option value={15}>15% OFF</option>
                        <option value={20}>20% OFF</option>
                        <option value={25}>25% OFF</option>
                        <option value={50}>50% OFF (Cortesía)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-1 text-gray-500">Descuento Manual (%)</label>
                      <input
                        type="number"
                        placeholder="%"
                        min={0}
                        max={100}
                        value={discountPercent || ''}
                        onChange={e => setDiscountPercent(Math.min(100, Math.max(0, Number(e.target.value))))}
                        className="w-full border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs outline-none focus:border-[#C5A059] text-gray-700"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Finance details */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Costo Total ($)</label>
                  <input
                    type="number"
                    min={0}
                    value={calculatedTotal}
                    onChange={e => setForm(f => ({ ...f, totalAmount: Number(e.target.value) }))}
                    readOnly={!useCustomRate}
                    className={`w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-[#C5A059] transition-colors ${
                      !useCustomRate 
                        ? 'bg-gray-50 text-gray-500 cursor-not-allowed' 
                        : 'bg-white text-gray-800'
                    }`}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Abonado ($)</label>
                  <input
                    type="number"
                    min={0}
                    value={form.amountPaid}
                    onChange={e => setForm(f => ({ ...f, amountPaid: Number(e.target.value) }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-[#C5A059]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">
                    Fecha del abono
                  </label>
                  <input
                    type="date"
                    value={form.paymentDate}
                    onChange={e => setForm(f => ({ ...f, paymentDate: e.target.value }))}
                    disabled={Number(form.amountPaid) <= 0}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-[#C5A059] disabled:bg-gray-50 disabled:text-gray-400"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Método</label>
                  <select
                    value={form.paymentMethod}
                    onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value as 'transferencia' | 'efectivo' | 'tarjeta' | 'cheque' | 'zelle' }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-[#C5A059] bg-white capitalize"
                  >
                    <option value="transferencia">Transferencia</option>
                    <option value="zelle">Zelle</option>
                    <option value="efectivo">Efectivo</option>
                    <option value="tarjeta">Tarjeta</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>
              </div>

              {/* Código de pago — solo aplica a métodos bancarios que se puedan verificar contra el banco */}
              {(form.paymentMethod === 'transferencia' || form.paymentMethod === 'zelle') && (
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">
                    Código de Pago / Referencia {form.paymentMethod === 'zelle' ? '(Zelle)' : '(Transferencia)'}
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Número de confirmación o referencia bancaria"
                    value={form.paymentReference}
                    onChange={e => setForm(f => ({ ...f, paymentReference: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-[#C5A059]"
                  />
                </div>
              )}

              {/* Special Notes */}
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Notas Especiales / Solicitudes</label>
                <textarea
                  placeholder="Ej. Traen su propia comida, requieren cuna para bebé, etc."
                  value={form.specialNotes}
                  onChange={e => setForm(f => ({ ...f, specialNotes: e.target.value }))}
                  rows={2}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-[#C5A059] resize-none"
                />
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex gap-3 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => closeAddModal()}
                className="flex-1 py-3 border border-gray-200 text-gray-500 font-bold rounded-2xl text-xs uppercase tracking-wider hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAddBooking}
                disabled={
                  !(form.guestFirstName.trim() && form.guestLastName.trim()) ||
                  form.checkOut <= form.checkIn ||
                  selectedAccommodationIds.length === 0 ||
                  bookings.some(b => selectedAccommodationIds.includes(b.accommodationId) && form.checkIn < b.checkOut && form.checkOut > b.checkIn) ||
                  (selectedAccommodationIds.reduce((sum, id) => sum + getMaxCapacity(id), 0) > 0 &&
                    (Number(form.adults) + Number(form.children)) > selectedAccommodationIds.reduce((sum, id) => sum + getMaxCapacity(id), 0))
                }
                className="flex-1 py-3 bg-[#C5A059] hover:bg-[#b8904a] text-white font-bold rounded-2xl text-xs uppercase tracking-wider disabled:opacity-40 transition-all flex items-center justify-center gap-1.5 active:scale-95"
              >
                <Check size={16} /> Registrar Reserva
              </button>
            </div>
          </div>
        </div>
      )}
    </div>

    <PrintableReservationsReport 
      bookings={filteredBookings} 
      dateText={reportDateText}
    />
    </>
  )
}
