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
import { parseLocalDate, fechaLocalISO as formatLocalDate } from '../../utils/dateUtils'
import { syncMarketingCustomer } from '../../utils/syncMarketingCustomer'
import CobroEnBolivares from './CobroEnBolivares'
import { useEnvioUnico } from '../../utils/useEnvioUnico'
import { dolaresDeBolivares, textoEnBolivares } from '../../utils/bolivares'
import { getBcvEuroRate } from '../../utils/exchangeRate'
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
  exchange_rate?: number | string | null
  amount_bs?: number | string | null
}

const mapDbPaymentToReact = (db: DbBookingPayment): BookingPayment => ({
  id: db.id,
  bookingId: db.booking_id,
  paymentDate: db.payment_date,
  amount: Number(db.amount) || 0,
  currency: db.currency || 'USD',
  method: (db.method || 'transferencia') as BookingPayment['method'],
  reference: db.reference || '',
  status: (db.status || 'verificado') as BookingPayment['status'],
  exchangeRate: db.exchange_rate == null ? null : Number(db.exchange_rate),
  amountBs: db.amount_bs == null ? null : Number(db.amount_bs),
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

const addDays = (date: Date, days: number) => {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + days)
  return nextDate
}

const todayDate = new Date()
const todayStr = formatLocalDate(todayDate)
const defaultCheckOutStr = formatLocalDate(addDays(todayDate, 3))
const todayLongLabel = todayDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
const DEFAULT_SPECIAL_NOTES = 'Hospedaje con cena y desayuno incluido.'

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
  paymentMethod: (db.payment_method || 'transferencia') as 'efectivo' | 'transferencia' | 'tarjeta' | 'cheque' | 'zelle' | 'pago_movil',
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
  const [savingDates, setSavingDates] = useState(false)
  const envioAbono = useEnvioUnico()

  // Cobro en bolivares. La tasa del euro del BCV es la que usa la posada, pero se
  // ofrece como referencia de un toque, no como valor impuesto: quien cobra escribe
  // la que aplico de verdad.
  const [bcvEuro, setBcvEuro] = useState<number | null>(null)
  const [nuevoAbonoBs, setNuevoAbonoBs] = useState({ activo: false, bolivares: '', tasa: '' })
  const [abonoInicialBs, setAbonoInicialBs] = useState({ activo: false, bolivares: '', tasa: '' })
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
    method: 'transferencia' as 'transferencia' | 'efectivo' | 'tarjeta' | 'cheque' | 'zelle' | 'pago_movil',
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
  // Distribución de personas por habitación para reservas grupales o individuales
  const [roomGuestsMap, setRoomGuestsMap] = useState<Record<number, { adults: number; children: number; babies: number }>>({
    2: { adults: 2, children: 0, babies: 0 }
  })
  
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
    paymentMethod: 'transferencia' as 'transferencia' | 'efectivo' | 'tarjeta' | 'cheque' | 'zelle' | 'pago_movil',
    paymentReference: '',
    specialNotes: DEFAULT_SPECIAL_NOTES
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

  const updateRoomGuests = (
    accId: number,
    field: 'adults' | 'children' | 'babies',
    deltaOrValue: number,
    isAbsolute = false
  ) => {
    setRoomGuestsMap(prev => {
      const current = prev[accId] || { adults: 2, children: 0, babies: 0 }
      const oldVal = current[field]
      const newVal = Math.max(0, isAbsolute ? deltaOrValue : oldVal + deltaOrValue)
      const nextMap = {
        ...prev,
        [accId]: {
          ...current,
          [field]: newVal
        }
      }

      // Sync form totals across selected rooms
      let totalAdults = 0
      let totalChildren = 0
      let totalBabies = 0
      selectedAccommodationIds.forEach(id => {
        const r = nextMap[id] || { adults: 2, children: 0, babies: 0 }
        totalAdults += r.adults
        totalChildren += r.children
        totalBabies += r.babies
      })
      setForm(f => ({
        ...f,
        adults: totalAdults,
        children: totalChildren,
        babies: totalBabies
      }))

      return nextMap
    })
  }

  const allocateGuestsAcrossAccommodations = (ids: number[]) => {
    if (ids.length === 1) {
      const singleId = ids[0]
      const room = roomGuestsMap[singleId] || { adults: Number(form.adults) || 2, children: Number(form.children) || 0, babies: Number(form.babies) || 0 }
      return [{
        id: singleId,
        adults: room.adults,
        children: room.children,
        babies: room.babies,
        pets: Number(form.pets) || 0
      }]
    }

    return ids.map((id, index) => {
      const room = roomGuestsMap[id] || { adults: 2, children: 0, babies: 0 }
      return {
        id,
        adults: Number(room.adults) || 0,
        children: Number(room.children) || 0,
        babies: Number(room.babies) || 0,
        pets: index === 0 ? (Number(form.pets) || 0) : 0
      }
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
    setRoomGuestsMap({ 2: { adults: 2, children: 0, babies: 0 } })
    
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
      specialNotes: DEFAULT_SPECIAL_NOTES
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

    // Referencia para cobrar en bolivares. Si falla se queda en null y el bloque de
    // bolivares sigue funcionando: solo se pierde el atajo de la tasa del dia.
    getBcvEuroRate()
      .then(tasa => { if (active && tasa > 0) setBcvEuro(tasa) })
      .catch(() => { /* sin referencia, se escribe a mano */ })

    return () => {
      active = false
    }
  }, [])

  // 1. Dynamic states calculation for TODAY's Day View
  const cabinStatesToday = useMemo(() => {
    return activeAccommodationOptions.map(acc => {
      const accId = Number(acc.id)
      const accBookings = bookings.filter(b => Number(b.accommodationId) === accId)

      // 1) Explicit cleaning status (room needs cleaning / disinfection)
      const cleaningBooking = accBookings.find(b => b.status === 'limpieza')
      if (cleaningBooking) {
        return {
          accommodation: acc,
          booking: cleaningBooking,
          status: 'limpieza' as const
        }
      }

      // 2) Outgoing guest leaving today who has NOT completed checkout/cleaning
      const checkoutBooking = accBookings.find(
        b => b.checkOut === todayStr && b.status !== 'limpieza' && b.status !== 'checkout_hoy'
      )
      if (checkoutBooking) {
        return {
          accommodation: acc,
          booking: checkoutBooking,
          status: 'checkout_hoy' as const
        }
      }

      // 3) Incoming guest arriving today
      const checkinBooking = accBookings.find(b => b.checkIn === todayStr)
      if (checkinBooking) {
        const isOccupied = checkinBooking.status === 'ocupado'
        return {
          accommodation: acc,
          booking: checkinBooking,
          status: (isOccupied ? 'ocupado' : 'checkin_hoy') as 'ocupado' | 'checkin_hoy'
        }
      }

      // 4) Guest currently staying through today (arrived before today, leaves after today)
      const stayBooking = accBookings.find(
        b => todayStr > b.checkIn && todayStr < b.checkOut
      )
      if (stayBooking) {
        return {
          accommodation: acc,
          booking: stayBooking,
          status: 'ocupado' as const
        }
      }

      // 5) Otherwise: cabin is free and available
      return {
        accommodation: acc,
        booking: null,
        status: 'disponible' as const
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
    
    // Check-ins today: all bookings arriving today that haven't checked in yet
    const checkins = bookings.filter(
      b => b.checkIn === todayStr && b.status !== 'ocupado'
    ).length

    // Check-outs today: all bookings scheduled to leave today that haven't completed checkout
    const checkouts = bookings.filter(
      b => b.checkOut === todayStr && b.status !== 'limpieza' && b.status !== 'checkout_hoy'
    ).length

    // Cleaning: cabins currently in cleaning
    const cleaning = cabinStatesToday.filter(c => c.status === 'limpieza').length

    // Occupied tonight: unique active cabins where a guest is staying tonight
    // (includes both guests currently in-house and guests arriving today)
    const activeAccIdSet = new Set(activeAccommodationOptions.map(a => Number(a.id)))
    const occupiedCabinIds = new Set(
      bookings
        .filter(b => activeAccIdSet.has(Number(b.accommodationId)) && todayStr >= b.checkIn && todayStr < b.checkOut)
        .map(b => Number(b.accommodationId))
    )
    const occupiedCount = occupiedCabinIds.size

    // Free/available: active cabins that are neither occupied tonight nor in cleaning
    const available = Math.max(0, totalCabins - occupiedCount - cleaning)

    const occupancyRate = totalCabins > 0 ? Math.round((occupiedCount / totalCabins) * 100) : 0

    return {
      occupancyRate,
      checkins,
      checkouts,
      cleaning,
      available
    }
  }, [bookings, cabinStatesToday])

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
        .delete()
        .eq('id', cleaningBooking.id)

      if (error) {
        console.error('Error deleting cleaning record:', error)
      } else {
        setBookings(prev => prev.filter(b => b.id !== cleaningBooking.id))
      }
    }
  }

  const handleSaveGuestInfo = async () => {
    if (!selectedBooking) return
    const fullName = joinPersonName(editGuestForm.firstName, editGuestForm.lastName)
    if (!fullName) return
    setSavingGuest(true)

    // Si la reserva tiene localizador, el cambio de nombre/contacto se replica en todas
    // las habitaciones del grupo para mantener la ficha consistente.
    const groupBookings = getBookingGroup(selectedBooking)
    const isGroup = groupBookings.length > 1
    const targetIds = groupBookings.map(b => b.id)

    // Se actualizan una por una para conservar el sufijo (1/3), (2/3)... en cada habitacion
    const updates = groupBookings.map((b, idx) => {
      const nameWithIndex = isGroup ? `${fullName} (${idx + 1}/${groupBookings.length})` : fullName
      return supabase
        .from('bookings')
        .update({
          guest_name: nameWithIndex,
          guest_phone: editGuestForm.phone.trim() || null,
          guest_email: editGuestForm.email.trim() || null,
          guest_ci: editGuestForm.ci.trim() || null,
          companions: editGuestForm.companions.trim() || null
        })
        .eq('id', b.id)
    })

    const results = await Promise.all(updates)
    const failed = results.find(r => r.error)

    if (failed?.error) {
      console.error('Error al actualizar huésped:', failed.error)
      alert('No se pudo guardar la información del huésped: ' + failed.error.message)
    } else {
      const idSet = new Set(targetIds)
      const phoneVal = editGuestForm.phone.trim()
      const emailVal = editGuestForm.email.trim()
      const ciVal = editGuestForm.ci.trim()
      const compVal = editGuestForm.companions.trim()

      setBookings(prev => prev.map(b => {
        if (!idSet.has(b.id)) return b
        const idx = groupBookings.findIndex(g => g.id === b.id)
        const nameWithIndex = isGroup ? `${fullName} (${idx + 1}/${groupBookings.length})` : fullName
        return {
          ...b,
          guestName: nameWithIndex,
          guestPhone: phoneVal,
          guestEmail: emailVal,
          guestCi: ciVal,
          companions: compVal
        }
      }))

      // Mantiene sincronizada la ficha abierta
      setSelectedBooking(prev => prev ? {
        ...prev,
        guestName: isGroup ? `${fullName} (1/${groupBookings.length})` : fullName,
        guestPhone: phoneVal,
        guestEmail: emailVal,
        guestCi: ciVal,
        companions: compVal
      } : null)

      // Actualiza o crea el contacto en la libreta de clientes de marketing
      if (emailVal) {
        syncMarketingCustomer(supabase, {
          fullName,
          email: emailVal,
          phone: phoneVal,
          bookingAmount: selectedBooking.totalAmount,
          stayDate: selectedBooking.checkIn
        }).catch(err => console.error('Error sincronizando cliente de marketing tras edición:', err))
      }

      setEditingGuest(false)
    }
    setSavingGuest(false)
  }

  const handleUpdatePaymentStatus = async (bookingId: string, newStatus: 'completo' | 'parcial' | 'pendiente') => {
    // Si la reserva tiene localizador, el estado de pago debe ser el mismo en todas
    // sus habitaciones (no tiene sentido que una habitacion del grupo quede "pagada"
    // y otra "sin pago" si el abono fue por el total).
    const target = bookings.find(b => b.id === bookingId)
    const groupBookings = target ? getBookingGroup(target) : []
    const targetIds = groupBookings.length > 0 ? groupBookings.map(b => b.id) : [bookingId]

    const { error } = await supabase
      .from('bookings')
      .update({ payment_status: newStatus })
      .in('id', targetIds)

    if (error) {
      console.error('Error updating payment status:', error)
    } else {
      const idSet = new Set(targetIds)
      setBookings(prev => prev.map(b => idSet.has(b.id) ? { ...b, paymentStatus: newStatus } : b))
      if (selectedBooking && idSet.has(selectedBooking.id)) {
        setSelectedBooking(prev => prev ? { ...prev, paymentStatus: newStatus } : null)
      }
    }
  }

  const handleAddPayment = async () => {
    if (!selectedBooking) return
    const numAmount = parseFloat(paymentForm.amount)
    if (isNaN(numAmount) || numAmount <= 0) {
      alert('Ingresa un monto válido para el pago.')
      return
    }
    // Un segundo toque mientras el primer abono viaja duplicaría el cobro en caja.
    if (!envioAbono.empezar()) return
    setAddingPayment(true)

    // Se asocia a la habitacion principal del grupo para que quede en el historial
    // general del localizador.
    const group = getBookingGroup(selectedBooking)
    const primaryBookingId = group[0]?.id || selectedBooking.id
    const currentPaidTotal = group.reduce((sum, room) => sum + room.amountPaid, 0)
    const groupTotalAmount = group.reduce((sum, room) => sum + room.totalAmount, 0)

    const newPaymentDb: {
      booking_id: string
      payment_date: string
      amount: number
      currency: string
      method: string
      reference: string | null
      status: string
      exchange_rate?: number | null
      amount_bs?: number | null
    } = {
      booking_id: primaryBookingId,
      payment_date: paymentForm.date || todayStr,
      amount: numAmount,
      currency: 'USD',
      method: paymentForm.method,
      reference: paymentForm.reference.trim() || null,
      status: 'verificado'
    }

    if (nuevoAbonoBs.activo) {
      const bs = parseLocalDateBs(nuevoAbonoBs.bolivares)
      const tasa = parseLocalDateBs(nuevoAbonoBs.tasa)
      if (bs > 0) newPaymentDb.amount_bs = bs
      if (tasa > 0) newPaymentDb.exchange_rate = tasa
    }

    const { data: payData, error: payError } = await supabase
      .from('booking_payments')
      .insert([newPaymentDb])
      .select('*')

    if (payError) {
      console.error('Error registrando abono:', payError)
      alert('No se pudo guardar el abono: ' + payError.message)
      envioAbono.terminar()
      setAddingPayment(false)
      return
    }

    // Actualiza el monto pagado de la habitacion principal y el payment_status de
    // todas las habitaciones del grupo para que el color del planner se refresque.
    const newPaidTotal = Math.round((currentPaidTotal + numAmount) * 100) / 100
    const newStatus: Booking['paymentStatus'] = newPaidTotal >= groupTotalAmount && groupTotalAmount > 0
      ? 'completo'
      : newPaidTotal > 0 ? 'parcial' : 'pendiente'

    const primaryOldPaid = Number(group[0]?.amountPaid || 0)
    const primaryNewPaid = Math.round((primaryOldPaid + numAmount) * 100) / 100

    await Promise.all([
      supabase
        .from('bookings')
        .update({ amount_paid: primaryNewPaid, payment_status: newStatus })
        .eq('id', primaryBookingId),
      group.length > 1
        ? supabase
            .from('bookings')
            .update({ payment_status: newStatus })
            .in('id', group.slice(1).map(r => r.id))
        : Promise.resolve()
    ])

    // Espejo contable: cada abono que entra por la ficha de una reserva alimenta la
    // caja o el banco en Ingresos con la fecha real del pago.
    const primaryRow = group[0]
    const detalleAlojamiento = group.length > 1
      ? `${group.length} habitaciones`
      : getAccommodation(Number(primaryRow?.accommodationId))?.title
    const ingreso = await registrarIngresoDeAbono(supabase, {
      bookingId: primaryBookingId,
      guestName: selectedBooking.guestName,
      locator: selectedBooking.locator || undefined,
      accommodationTitle: detalleAlojamiento,
      amount: numAmount,
      date: paymentForm.date || todayStr,
      method: paymentForm.method,
      reference: paymentForm.reference.trim() || null,
      exchangeRate: newPaymentDb.exchange_rate ?? null,
      amountBs: newPaymentDb.amount_bs ?? null,
    })
    if (ingreso.error) {
      console.error('El abono se guardó en la reserva pero falló el registro en Ingresos:', ingreso.error)
    }

    // Actualiza el estado local de la app
    if (payData && payData[0]) {
      setBookingPayments(prev => [...prev, mapDbPaymentToReact(payData[0])])
    }

    const groupIdsSet = new Set(group.map(r => r.id))
    setBookings(prev => prev.map(b => {
      if (!groupIdsSet.has(b.id)) return b
      return {
        ...b,
        paymentStatus: newStatus,
        amountPaid: b.id === primaryBookingId ? primaryNewPaid : b.amountPaid
      }
    }))

    setSelectedBooking(prev => prev ? {
      ...prev,
      paymentStatus: newStatus,
      amountPaid: prev.id === primaryBookingId ? primaryNewPaid : prev.amountPaid
    } : null)

    setPaymentForm({
      amount: '',
      date: todayStr,
      method: 'transferencia',
      reference: ''
    })
    setNuevoAbonoBs({ activo: false, bolivares: '', tasa: '' })
    envioAbono.terminar()
    setAddingPayment(false)
  }

  const handleDeletePayment = async (paymentId: string) => {
    if (!selectedBooking) return
    const payment = bookingPayments.find(p => p.id === paymentId)
    if (!payment) return
    if (!confirm(`¿Eliminar este abono de ${fmt(payment.amount)} registrado el ${payment.paymentDate}?`)) return

    const { error: delError } = await supabase
      .from('booking_payments')
      .delete()
      .eq('id', paymentId)

    if (delError) {
      console.error('Error eliminando abono:', delError)
      alert('No se pudo eliminar el abono: ' + delError.message)
      return
    }

    // Retira también el movimiento espejo que se creó en la tabla de Ingresos, para
    // que la contabilidad no quede descuadrada con dinero que nunca entró.
    const retiro = await retirarIngresoDeAbono(supabase, {
      bookingId: payment.bookingId,
      amount: payment.amount,
      date: payment.paymentDate,
    })
    if (retiro.error) {
      console.error('El abono se borró de la reserva pero no se pudo retirar de Ingresos:', retiro.error)
    }

    // Descuenta el monto de la habitacion a la que estaba asociado
    const group = getBookingGroup(selectedBooking)
    const currentPaidTotal = group.reduce((sum, room) => sum + room.amountPaid, 0)
    const groupTotalAmount = group.reduce((sum, room) => sum + room.totalAmount, 0)
    const newPaidTotal = Math.max(0, Math.round((currentPaidTotal - payment.amount) * 100) / 100)
    const newStatus: Booking['paymentStatus'] = newPaidTotal >= groupTotalAmount && groupTotalAmount > 0
      ? 'completo'
      : newPaidTotal > 0 ? 'parcial' : 'pendiente'

    const targetRoom = group.find(r => r.id === payment.bookingId) || group[0]
    const targetRoomNewPaid = Math.max(0, Math.round((Number(targetRoom?.amountPaid || 0) - payment.amount) * 100) / 100)

    if (targetRoom) {
      await Promise.all([
        supabase
          .from('bookings')
          .update({ amount_paid: targetRoomNewPaid, payment_status: newStatus })
          .eq('id', targetRoom.id),
        group.length > 1
          ? supabase
              .from('bookings')
              .update({ payment_status: newStatus })
              .in('id', group.filter(r => r.id !== targetRoom.id).map(r => r.id))
          : Promise.resolve()
      ])
    }

    setBookingPayments(prev => prev.filter(p => p.id !== paymentId))

    const groupIdsSet = new Set(group.map(r => r.id))
    setBookings(prev => prev.map(b => {
      if (!groupIdsSet.has(b.id)) return b
      return {
        ...b,
        paymentStatus: newStatus,
        amountPaid: targetRoom && b.id === targetRoom.id ? targetRoomNewPaid : b.amountPaid
      }
    }))

    setSelectedBooking(prev => prev ? {
      ...prev,
      paymentStatus: newStatus,
      amountPaid: targetRoom && prev.id === targetRoom.id ? targetRoomNewPaid : prev.amountPaid
    } : null)
  }

  const handleSendBookingVoucher = async () => {
    if (!selectedBooking) return
    const group = getBookingGroup(selectedBooking)
    const primary = group[0] || selectedBooking
    const email = (primary.guestEmail || '').trim()

    if (!email || email === 'cliente@estancialacanada.com') {
      alert('Para enviar el comprobante hace falta anotar el correo del huésped en "Datos del huésped".')
      return
    }

    const titles = group
      .map(r => getAccommodation(r.accommodationId)?.title)
      .filter(Boolean)
      .join(' + ')

    const totalAmount = group.reduce((sum, r) => sum + r.totalAmount, 0)
    const amountPaid = group.reduce((sum, r) => sum + r.amountPaid, 0)

    setSendingVoucher(true)
    const res = await sendBookingVoucherEmail(supabase, {
      email,
      guestName: cleanGuestSuggestionName(primary.guestName),
      locator: primary.locator || undefined,
      accommodationTitle: titles || 'Hospedaje',
      checkIn: primary.checkIn,
      checkOut: primary.checkOut,
      adults: group.reduce((sum, r) => sum + r.guestsCount.adults, 0),
      children: group.reduce((sum, r) => sum + r.guestsCount.children, 0),
      babies: group.reduce((sum, r) => sum + r.guestsCount.babies, 0),
      totalAmount,
      amountPaid,
      payments: bookingPayments.map(p => ({
        date: p.paymentDate,
        amount: p.amount,
        method: p.method,
        reference: p.reference,
        amountBs: p.amountBs,
        exchangeRate: p.exchangeRate,
      })),
      notes: primary.specialNotes || undefined,
    })
    setSendingVoucher(false)

    if (res.success) {
      setVoucherSentFor(primary.id)
      setTimeout(() => setVoucherSentFor(null), 4000)
    } else {
      alert('No se pudo enviar el correo: ' + (res.error || 'Error desconocido'))
    }
  }

  const handleDeleteBooking = async (bookingId: string) => {
    const target = bookings.find(b => b.id === bookingId)
    if (!target) return
    const group = getBookingGroup(target)
    const isGroup = group.length > 1

    const confirmMsg = isGroup
      ? `Esta reserva tiene ${group.length} habitaciones asociadas (Localizador ${target.locator}). ¿Deseas eliminar todo el grupo de la reserva?`
      : '¿Estás seguro de que deseas eliminar esta reserva?'

    if (!confirm(confirmMsg)) return

    const targetIds = isGroup ? group.map(b => b.id) : [bookingId]
    const { error } = await supabase
      .from('bookings')
      .delete()
      .in('id', targetIds)

    if (error) {
      console.error('Error deleting booking:', error)
      alert('No se pudo eliminar la reserva: ' + error.message)
    } else {
      const idSet = new Set(targetIds)
      setBookings(prev => prev.filter(b => !idSet.has(b.id)))
      setSelectedBooking(null)
    }
  }

  const handleStartEditDates = () => {
    if (!selectedBooking) return
    setEditDatesForm({
      checkIn: selectedBooking.checkIn,
      checkOut: selectedBooking.checkOut
    })
    setEditingDates(true)
  }

  const handleSaveDates = async () => {
    if (!selectedBooking) return
    const { checkIn, checkOut } = editDatesForm

    if (!checkIn || !checkOut || checkOut <= checkIn) {
      alert('La fecha de check-out debe ser posterior a la fecha de check-in.')
      return
    }

    const group = getBookingGroup(selectedBooking)
    const groupIds = group.map(b => b.id)

    // Revisa colisiones de cada habitacion del grupo en las nuevas fechas
    for (const room of group) {
      const collision = bookings.find(b =>
        !groupIds.includes(b.id) &&
        b.accommodationId === room.accommodationId &&
        checkIn < b.checkOut && checkOut > b.checkIn
      )
      if (collision) {
        const roomName = getAccommodation(room.accommodationId)?.title || 'Una habitación'
        alert(`No se pueden cambiar las fechas: ${roomName} ya está reservada para "${collision.guestName}" del ${collision.checkIn} al ${collision.checkOut}.`)
        return
      }
    }

    setSavingDates(true)

    // Recalcula el precio de cada habitacion respetando temporada normal vs navideña
    // de las nuevas fechas y el descuento particular que ya tenia la reserva.
    const updates = group.map(room => {
      const standardRate = getStandardRate(
        room.accommodationId,
        checkIn,
        checkOut,
        room.guestsCount.adults,
        room.guestsCount.children
      )
      const adjustedRate = getAdjustedBookingTotal(standardRate, room.specialNotes)
      return supabase
        .from('bookings')
        .update({
          check_in: checkIn,
          check_out: checkOut,
          total_amount: adjustedRate
        })
        .eq('id', room.id)
    })

    const results = await Promise.all(updates)
    const failed = results.find(r => r.error)

    if (failed?.error) {
      console.error('Error actualizando fechas de la reserva:', failed.error)
      alert('No se pudieron actualizar las fechas: ' + failed.error.message)
    } else {
      const idSet = new Set(groupIds)
      setBookings(prev => prev.map(b => {
        if (!idSet.has(b.id)) return b
        const standardRate = getStandardRate(
          b.accommodationId,
          checkIn,
          checkOut,
          b.guestsCount.adults,
          b.guestsCount.children
        )
        const adjustedRate = getAdjustedBookingTotal(standardRate, b.specialNotes)
        return {
          ...b,
          checkIn,
          checkOut,
          totalAmount: adjustedRate
        }
      }))

      setSelectedBooking(prev => {
        if (!prev) return null
        const standardRate = getStandardRate(
          prev.accommodationId,
          checkIn,
          checkOut,
          prev.guestsCount.adults,
          prev.guestsCount.children
        )
        return {
          ...prev,
          checkIn,
          checkOut,
          totalAmount: getAdjustedBookingTotal(standardRate, prev.specialNotes)
        }
      })

      setEditingDates(false)
    }
    setSavingDates(false)
  }

  const handleStartEditRoom = (room: Booking) => {
    setEditingRoomId(room.id)
    setEditRoomForm({
      accommodationId: room.accommodationId,
      adults: room.guestsCount.adults,
      children: room.guestsCount.children,
      babies: room.guestsCount.babies,
      pets: room.guestsCount.pets
    })
  }

  const handleSaveRoom = async () => {
    if (!selectedBooking || !editingRoomId) return
    const roomBooking = bookings.find(item => item.id === editingRoomId)
    if (!roomBooking) return

    const newAccId = Number(editRoomForm.accommodationId)
    const maxCapacity = getMaxCapacity(newAccId)
    const totalGuests = Number(editRoomForm.adults) + Number(editRoomForm.children)

    if (totalGuests <= 0) {
      alert('Debe haber al menos un huésped asignado a la habitación.')
      return
    }

    if (maxCapacity > 0 && totalGuests > maxCapacity) {
      alert(`La habitación seleccionada admite hasta ${maxCapacity} personas y se ingresaron ${totalGuests}.`)
      return
    }

    // Validar disponibilidad si se cambió de habitación
    if (newAccId !== roomBooking.accommodationId) {
      const groupIds = getBookingGroup(selectedBooking).map(item => item.id)
      const collision = bookings.find(b =>
        !groupIds.includes(b.id) &&
        b.accommodationId === newAccId &&
        roomBooking.checkIn < b.checkOut && roomBooking.checkOut > b.checkIn
      )
      if (collision) {
        alert(`${getAccommodation(newAccId)?.title || 'Esa habitación'} ya está reservada para "${collision.guestName}" en esas fechas.`)
        return
      }
    }

    setSavingRoom(true)

    // Recalcular tarifa con la nueva habitación y ocupantes
    const standardRate = getStandardRate(
      newAccId,
      roomBooking.checkIn,
      roomBooking.checkOut,
      editRoomForm.adults,
      editRoomForm.children
    )
    const finalAmount = getAdjustedBookingTotal(standardRate, roomBooking.specialNotes)

    const { error } = await supabase
      .from('bookings')
      .update({
        accommodation_id: newAccId,
        adults: editRoomForm.adults,
        children: editRoomForm.children,
        babies: editRoomForm.babies,
        pets: editRoomForm.pets,
        total_amount: finalAmount
      })
      .eq('id', editingRoomId)

    if (error) {
      console.error('Error actualizando habitación de la reserva:', error)
      alert('No se pudo guardar el cambio: ' + error.message)
    } else {
      setBookings(prev => prev.map(item => {
        if (item.id !== editingRoomId) return item
        return {
          ...item,
          accommodationId: newAccId,
          guestsCount: {
            adults: editRoomForm.adults,
            children: editRoomForm.children,
            babies: editRoomForm.babies,
            pets: editRoomForm.pets
          },
          totalAmount: finalAmount
        }
      }))

      if (selectedBooking.id === editingRoomId) {
        setSelectedBooking(prev => prev ? {
          ...prev,
          accommodationId: newAccId,
          guestsCount: {
            adults: editRoomForm.adults,
            children: editRoomForm.children,
            babies: editRoomForm.babies,
            pets: editRoomForm.pets
          },
          totalAmount: finalAmount
        } : null)
      }

      setEditingRoomId(null)
    }

    setSavingRoom(false)
  }

  const handleRemoveRoomFromGroup = async (roomBookingId: string) => {
    if (!selectedBooking) return
    const group = getBookingGroup(selectedBooking)
    if (group.length <= 1) {
      alert('Esta es la única habitación de la reserva. Si deseas borrarla, usa el botón "Eliminar Reserva".')
      return
    }

    const roomToRemove = group.find(item => item.id === roomBookingId)
    const roomTitle = getAccommodation(roomToRemove?.accommodationId || 0)?.title || 'esta habitación'

    if (!confirm(`¿Quitar ${roomTitle} de la reserva grupal? Se mantendrán las demás habitaciones.`)) return

    const { error } = await supabase
      .from('bookings')
      .delete()
      .eq('id', roomBookingId)

    if (error) {
      console.error('Error quitando habitación del grupo:', error)
      alert('No se pudo quitar la habitación: ' + error.message)
      return
    }

    const remaining = group.filter(item => item.id !== roomBookingId)
    setBookings(prev => prev.filter(item => item.id !== roomBookingId))

    // Si cerramos la que estaba seleccionada, enfocamos otra del grupo
    if (selectedBooking.id === roomBookingId) {
      setSelectedBooking(remaining[0] || null)
    }
  }

  const handleStartAddRooms = () => {
    setAdditionalAccommodationIds([])
    setAdditionalGuests({ adults: 2, children: 0, babies: 0, pets: 0 })
    setAddingRoomsToBooking(true)
  }

  const handleSaveAdditionalRooms = async () => {
    if (!selectedBooking || additionalAccommodationIds.length === 0) return

    // Validar disponibilidad de cada habitación a añadir
    const groupIds = getBookingGroup(selectedBooking).map(item => item.id)
    const collision = bookings.find(b =>
      !groupIds.includes(b.id) &&
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

    // Si la reserva original no tenía localizador, se le asigna uno ahora
    if (!selectedBooking.locator) {
      await supabase
        .from('bookings')
        .update({ locator })
        .eq('id', selectedBooking.id)
    }

    setSavingAdditionalRooms(true)

    const baseName = cleanGuestSuggestionName(selectedBooking.guestName)
    const existingGroup = getBookingGroup(selectedBooking)
    const totalRoomsCount = existingGroup.length + additionalAccommodationIds.length

    const rowsToInsert = allocations.map((room, idx) => {
      const standardRate = getStandardRate(
        room.id,
        selectedBooking.checkIn,
        selectedBooking.checkOut,
        room.adults,
        room.children
      )
      const adjustedRate = discount > 0
        ? Math.round(standardRate * (1 - discount / 100))
        : standardRate

      const roomIndex = existingGroup.length + idx + 1
      return {
        guest_name: `${baseName} (${roomIndex}/${totalRoomsCount})`,
        guest_phone: selectedBooking.guestPhone || null,
        guest_email: selectedBooking.guestEmail || null,
        guest_ci: selectedBooking.guestCi || null,
        companions: selectedBooking.companions || null,
        accommodation_id: room.id,
        check_in: selectedBooking.checkIn,
        check_out: selectedBooking.checkOut,
        adults: room.adults,
        children: room.children,
        babies: room.babies,
        pets: room.pets,
        total_amount: adjustedRate,
        amount_paid: 0,
        payment_status: selectedBooking.paymentStatus,
        payment_method: selectedBooking.paymentMethod,
        payment_reference: selectedBooking.paymentReference || null,
        status: selectedBooking.status,
        confirmed: true,
        special_notes: selectedBooking.specialNotes,
        locator
      }
    })

    const { data, error } = await supabase
      .from('bookings')
      .insert(rowsToInsert)
      .select('*')

    if (error) {
      console.error('Error añadiendo habitaciones a la reserva:', error)
      alert('No se pudieron añadir las habitaciones: ' + error.message)
    } else if (data) {
      const newCreatedBookings = data.map(mapDbBookingToReact)
      setBookings(prev => [
        ...prev.map(item => item.id === selectedBooking.id && !item.locator ? { ...item, locator } : item),
        ...newCreatedBookings
      ])
      setAddingRoomsToBooking(false)
      setAdditionalAccommodationIds([])
    }

    setSavingAdditionalRooms(false)
  }

  const handleStartEditFinancials = () => {
    if (!selectedBooking) return
    setEditDiscountPercent(getBookingDiscountPercent(selectedBooking.specialNotes))
    setEditFixedDiscountAmount(getBookingFixedDiscountAmount(selectedBooking.specialNotes))
    setEditingFinancials(true)
  }

  const handleSaveFinancials = async () => {
    if (!selectedBooking) return
    const group = getBookingGroup(selectedBooking)
    setSavingFinancials(true)

    // El descuento fijo se reparte equitativamente entre las habitaciones para que el total
    // de la reserva coincida con la rebaja pactada.
    const fixedPerRoom = group.length > 0
      ? Math.round((editFixedDiscountAmount / group.length) * 100) / 100
      : 0

    // Se actualiza cada habitacion con el nuevo descuento
    const updates = group.map((room, index) => {
      // Ajuste de centavos al último cuarto si hace falta
      const currentFixed = index === group.length - 1
        ? Math.max(0, Math.round((editFixedDiscountAmount - fixedPerRoom * (group.length - 1)) * 100) / 100)
        : fixedPerRoom

      const standardRate = getStandardRate(
        room.accommodationId,
        room.checkIn,
        room.checkOut,
        room.guestsCount.adults,
        room.guestsCount.children
      )
      const afterPercent = standardRate * (1 - editDiscountPercent / 100)
      const finalAmount = Math.max(0, Math.round((afterPercent - currentFixed) * 100) / 100)

      let updatedNotes = withBookingDiscountNote(room.specialNotes, editDiscountPercent)
      updatedNotes = withBookingFixedDiscountNote(updatedNotes, currentFixed)

      return supabase
        .from('bookings')
        .update({
          total_amount: finalAmount,
          special_notes: updatedNotes
        })
        .eq('id', room.id)
    })

    const results = await Promise.all(updates)
    const failed = results.find(r => r.error)

    if (failed?.error) {
      console.error('Error guardando descuento:', failed.error)
      alert('No se pudo aplicar el descuento: ' + failed.error.message)
    } else {
      const idSet = new Set(group.map(r => r.id))
      setBookings(prev => prev.map(b => {
        if (!idSet.has(b.id)) return b
        const roomIdx = group.findIndex(g => g.id === b.id)
        const currentFixed = roomIdx === group.length - 1
          ? Math.max(0, Math.round((editFixedDiscountAmount - fixedPerRoom * (group.length - 1)) * 100) / 100)
          : fixedPerRoom
        const standardRate = getStandardRate(
          b.accommodationId,
          b.checkIn,
          b.checkOut,
          b.guestsCount.adults,
          b.guestsCount.children
        )
        const afterPercent = standardRate * (1 - editDiscountPercent / 100)
        const finalAmount = Math.max(0, Math.round((afterPercent - currentFixed) * 100) / 100)

        let updatedNotes = withBookingDiscountNote(b.specialNotes, editDiscountPercent)
        updatedNotes = withBookingFixedDiscountNote(updatedNotes, currentFixed)

        return {
          ...b,
          totalAmount: finalAmount,
          specialNotes: updatedNotes
        }
      }))

      setSelectedBooking(prev => {
        if (!prev) return null
        const roomIdx = group.findIndex(g => g.id === prev.id)
        const currentFixed = roomIdx === group.length - 1
          ? Math.max(0, Math.round((editFixedDiscountAmount - fixedPerRoom * (group.length - 1)) * 100) / 100)
          : fixedPerRoom
        const standardRate = getStandardRate(
          prev.accommodationId,
          prev.checkIn,
          prev.checkOut,
          prev.guestsCount.adults,
          prev.guestsCount.children
        )
        const afterPercent = standardRate * (1 - editDiscountPercent / 100)
        const finalAmount = Math.max(0, Math.round((afterPercent - currentFixed) * 100) / 100)

        let updatedNotes = withBookingDiscountNote(prev.specialNotes, editDiscountPercent)
        updatedNotes = withBookingFixedDiscountNote(updatedNotes, currentFixed)

        return {
          ...prev,
          totalAmount: finalAmount,
          specialNotes: updatedNotes
        }
      })

      setEditingFinancials(false)
    }
    setSavingFinancials(false)
  }

  const handleStartEditNotes = () => {
    if (!selectedBooking) return
    setEditNotes(selectedBooking.specialNotes || '')
    setEditingNotes(true)
  }

  const handleSaveNotes = async () => {
    if (!selectedBooking) return
    setSavingNotes(true)
    const targetIds = getBookingGroup(selectedBooking).map(b => b.id)

    const { error } = await supabase
      .from('bookings')
      .update({ special_notes: editNotes.trim() || null })
      .in('id', targetIds)

    if (error) {
      console.error('Error guardando notas:', error)
      alert('No se pudieron guardar las notas: ' + error.message)
    } else {
      const idSet = new Set(targetIds)
      const trimmed = editNotes.trim()
      setBookings(prev => prev.map(b => idSet.has(b.id) ? { ...b, specialNotes: trimmed } : b))
      setSelectedBooking(prev => prev ? { ...prev, specialNotes: trimmed } : null)
      setEditingNotes(false)
    }
    setSavingNotes(false)
  }

  // Permite arrastrar reservas en el planner: mover toda la estadía o estirar los bordes
  // para cambiar check-in o check-out, con validación de colisión y actualización
  // reactiva de tarifas.
  useEffect(() => {
    if (!dragInfo) return

    const handlePointerMove = (e: PointerEvent) => {
      // Evita disparar el arrastre con el simple temblor de la mano al hacer click.
      if (!hasDraggedRef.current) {
        const start = dragStartPosRef.current
        if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) < DRAG_THRESHOLD_PX) return
        hasDraggedRef.current = true
      }

      // En táctil los pointer events quedan capturados en el elemento de origen:
      // elementsFromPoint nos dice sobre qué celda está el dedo en este instante.
      const stack = document.elementsFromPoint(e.clientX, e.clientY)
      const cellEl = stack.find((el): el is HTMLElement => el instanceof HTMLElement && !!el.dataset.plannerCell)
      const key = cellEl?.dataset.plannerCell || null
      if (key && dragOverCellRef.current !== key) {
        dragOverCellRef.current = key
        setDragOverCell(key)
      }
    }

    const handlePointerUp = async () => {
      const targetKey = dragOverCellRef.current
      const wasDrag = hasDraggedRef.current
      dragStartPosRef.current = null
      hasDraggedRef.current = false
      dragOverCellRef.current = null
      setDragOverCell(null)

      if (!targetKey || !wasDrag) {
        setDragInfo(null)
        return
      }

      const [targetAccIdStr, targetDateStr] = targetKey.split('|')
      const targetAccId = Number(targetAccIdStr)
      const booking = bookings.find(b => b.id === dragInfo.bookingId)

      if (!booking || !targetAccId || !targetDateStr) {
        setDragInfo(null)
        return
      }

      const nights = calculateNights(booking.checkIn, booking.checkOut)
      let newCheckIn = booking.checkIn
      let newCheckOut = booking.checkOut
      const newAccId = targetAccId

      if (dragInfo.mode === 'move') {
        newCheckIn = targetDateStr
        newCheckOut = formatLocalDate(addDays(parseLocalDate(targetDateStr), nights))
      } else if (dragInfo.mode === 'resize-left') {
        if (targetDateStr >= booking.checkOut) {
          setDragInfo(null)
          return
        }
        newCheckIn = targetDateStr
      } else if (dragInfo.mode === 'resize-right') {
        // En el planner la columna representa la noche. Al soltar sobre el día D, el
        // check-out es la mañana siguiente (D + 1).
        const checkOutDate = formatLocalDate(addDays(parseLocalDate(targetDateStr), 1))
        if (checkOutDate <= booking.checkIn) {
          setDragInfo(null)
          return
        }
        newCheckOut = checkOutDate
      }

      // Si no hubo cambio real, salir sin tocar nada
      if (newCheckIn === booking.checkIn && newCheckOut === booking.checkOut && newAccId === booking.accommodationId) {
        setDragInfo(null)
        return
      }

      // Revisa que la nueva posición no pise otra reserva
      const collision = bookings.find(b =>
        b.id !== booking.id &&
        b.accommodationId === newAccId &&
        newCheckIn < b.checkOut && newCheckOut > b.checkIn
      )

      if (collision) {
        const roomName = getAccommodation(newAccId)?.title || 'Esa habitación'
        alert(`No se puede mover la reserva: ${roomName} ya está reservada para "${collision.guestName}" del ${collision.checkIn} al ${collision.checkOut}.`)
        setDragInfo(null)
        return
      }

      // Recalcula la tarifa para las nuevas noches
      const standardRate = getStandardRate(
        newAccId,
        newCheckIn,
        newCheckOut,
        booking.guestsCount.adults,
        booking.guestsCount.children
      )
      const adjustedRate = getAdjustedBookingTotal(standardRate, booking.specialNotes)

      // Actualiza en Supabase
      const { error } = await supabase
        .from('bookings')
        .update({
          accommodation_id: newAccId,
          check_in: newCheckIn,
          check_out: newCheckOut,
          total_amount: adjustedRate
        })
        .eq('id', booking.id)

      if (error) {
        console.error('Error al mover la reserva:', error)
        alert('No se pudo mover la reserva: ' + error.message)
      } else {
        setBookings(prev => prev.map(b => b.id === booking.id ? {
          ...b,
          accommodationId: newAccId,
          checkIn: newCheckIn,
          checkOut: newCheckOut,
          totalAmount: adjustedRate
        } : b))
      }

      setDragInfo(null)
    }

    const handlePointerCancel = () => {
      dragStartPosRef.current = null
      hasDraggedRef.current = false
      dragOverCellRef.current = null
      setDragOverCell(null)
      setDragInfo(null)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerCancel)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerCancel)
    }
  }, [dragInfo, bookings])

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
    if (totalGuests === 0) {
      alert('Error: Debes ingresar al menos 1 huésped (adulto o niño).')
      return
    }
    if (maxCapacity > 0 && totalGuests > maxCapacity) {
      alert(`Error: Las ${selectedAccommodationIds.length} unidades seleccionadas admiten hasta ${maxCapacity} personas y se ingresaron ${totalGuests}.`)
      return
    }

    if (selectedAccommodationIds.length > 1) {
      for (const id of selectedAccommodationIds) {
        const room = roomGuestsMap[id] || { adults: 0, children: 0, babies: 0 }
        const roomTotal = (room.adults || 0) + (room.children || 0)
        const roomCap = getMaxCapacity(id)
        const roomTitle = getAccommodation(id)?.title || `Habitación ${id}`
        if (roomTotal === 0) {
          alert(`Error: La habitación "${roomTitle}" no tiene huéspedes asignados. Asigna al menos 1 adulto o niño, o deselecciona la habitación.`)
          return
        }
        if (roomCap > 0 && roomTotal > roomCap) {
          alert(`Error: La habitación "${roomTitle}" admite un máximo de ${roomCap} personas y tiene asignadas ${roomTotal}.`)
          return
        }
      }
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
      // También registra el abono inicial en booking_payments si se indicó un monto
      if (initialPaidTotal > 0) {
        const primaryBookingId = data[0].id
        const payment: {
          booking_id: string
          payment_date: string
          amount: number
          currency: string
          method: string
          reference: string | null
          status: string
          exchange_rate?: number | null
          amount_bs?: number | null
        } = {
          booking_id: primaryBookingId,
          payment_date: form.paymentDate || todayStr,
          amount: initialPaidTotal,
          currency: 'USD',
          method: form.paymentMethod,
          reference: form.paymentReference.trim() || null,
          status: 'verificado'
        }

        if (abonoInicialBs.activo) {
          const bs = parseLocalDateBs(abonoInicialBs.bolivares)
          const tasa = parseLocalDateBs(abonoInicialBs.tasa)
          if (bs > 0) payment.amount_bs = bs
          if (tasa > 0) payment.exchange_rate = tasa
        }

        const { error: paymentError } = await supabase
          .from('booking_payments')
          .insert([payment])

        if (paymentError) {
          console.error('No se pudo registrar el abono inicial en el historial:', paymentError)
        } else {
          // El abono inicial también alimenta la caja en Ingresos
          const bookingRow = data[0]
          if (bookingRow) {
            const ingreso = await registrarIngresoDeAbono(supabase, {
              bookingId: primaryBookingId,
              guestName: fullGuestName,
              locator: locatorCode || undefined,
              accommodationTitle: data.length > 1 ? `${data.length} habitaciones` : getAccommodation(Number(bookingRow?.accommodation_id))?.title,
              amount: Number(payment.amount),
              date: form.paymentDate || todayStr,
              method: form.paymentMethod,
              reference: form.paymentReference.trim() || null,
              exchangeRate: payment.exchange_rate ?? null,
              amountBs: payment.amount_bs ?? null,
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

      setBookings(prev => [...data.map(mapDbBookingToReact), ...prev])
      closeAddModal()
    }
  }

  // Parse helper for comma decimals
  const parseLocalDateBs = (val: string) => {
    if (!val) return 0
    const clean = val.replace(/\./g, '').replace(',', '.')
    return parseFloat(clean) || 0
  }

  return (
    <>
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* 1. Header & Title Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-800 tracking-tight flex items-center gap-2">
            <span>Reservas</span>
            <span className="text-xs bg-[#C5A059]/10 text-[#C5A059] px-2.5 py-0.5 rounded-full font-bold">
              {bookings.length} {bookings.length === 1 ? 'reserva activa' : 'reservas activas'}
            </span>
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Recepción y control diario de disponibilidad, asignación de cabañas y huéspedes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Botón Imprimir Planner */}
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-2xl text-xs font-bold hover:bg-gray-50 transition-all shadow-xs cursor-pointer active:scale-95"
            title="Imprimir vista actual del planner"
          >
            <Printer size={15} className="text-gray-500" />
            <span className="hidden sm:inline">Imprimir</span>
          </button>

          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#C5A059] hover:bg-[#b8904a] text-white rounded-2xl text-xs font-bold transition-all shadow-sm shadow-[#C5A059]/20 cursor-pointer active:scale-95"
          >
            <Plus size={16} />
            <span>Nueva Reserva</span>
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
            <span className={`text-3xl font-extrabold ${stats.checkins > 0 ? 'text-amber-600' : 'text-gray-800'}`}>
              {stats.checkins}
            </span>
            <span className="text-[11px] text-gray-400 font-medium">por recibir</span>
          </div>
          <p className="text-[10px] text-gray-400 mt-2 truncate">Pendientes de check-in</p>
        </div>

        {/* Check-Outs Card */}
        <div className={`rounded-3xl p-5 shadow-sm border flex flex-col justify-between transition-colors ${stats.checkouts > 0 ? 'bg-orange-50/50 border-orange-100' : 'bg-white border-gray-100'}`}>
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Salen Hoy 🧳</span>
          <div className="mt-3 flex items-baseline gap-1">
            <span className={`text-3xl font-extrabold ${stats.checkouts > 0 ? 'text-orange-600' : 'text-gray-800'}`}>
              {stats.checkouts}
            </span>
            <span className="text-[11px] text-gray-400 font-medium">salidas</span>
          </div>
          <p className="text-[10px] text-gray-400 mt-2 truncate">Por desocupar habitación</p>
        </div>

        {/* Cleaning Card */}
        <div className={`rounded-3xl p-5 shadow-sm border flex flex-col justify-between transition-colors ${stats.cleaning > 0 ? 'bg-rose-50/50 border-rose-100' : 'bg-white border-gray-100'}`}>
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Limpieza 🧹</span>
          <div className="mt-3 flex items-baseline gap-1">
            <span className={`text-3xl font-extrabold ${stats.cleaning > 0 ? 'text-rose-600' : 'text-gray-800'}`}>
              {stats.cleaning}
            </span>
            <span className="text-[11px] text-gray-400 font-medium">habitaciones</span>
          </div>
          <p className="text-[10px] text-gray-400 mt-2 truncate">Requieren aseo</p>
        </div>

        {/* Available Today Card */}
        <div className="bg-emerald-50/40 rounded-3xl p-5 shadow-sm border border-emerald-100 flex flex-col justify-between col-span-2 lg:col-span-1">
          <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-widest block">Disponibles ✨</span>
          <div className="mt-3 flex items-baseline gap-1">
            <span className="text-3xl font-extrabold text-emerald-600">{stats.available}</span>
            <span className="text-[11px] text-emerald-700/60 font-medium">libres hoy</span>
          </div>
          <p className="text-[10px] text-emerald-700/70 mt-2 truncate">Listas para alojar</p>
        </div>
      </div>

      {/* 3. Navigation View Switcher (Día / Semana / Mes) & Global Search */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-2.5 rounded-3xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-1.5 p-1 bg-gray-50 rounded-2xl w-full md:w-auto">
          <button
            onClick={() => setActiveTab('dia')}
            className={`flex-1 md:flex-none px-5 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'dia'
                ? 'bg-white text-gray-800 shadow-xs'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            Vista Hoy
          </button>
          <button
            onClick={() => setActiveTab('semana')}
            className={`flex-1 md:flex-none px-5 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'semana'
                ? 'bg-white text-gray-800 shadow-xs'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            Planner (Semana)
          </button>
          <button
            onClick={() => setActiveTab('mes')}
            className={`flex-1 md:flex-none px-5 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'mes'
                ? 'bg-white text-gray-800 shadow-xs'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            Lista de Reservas (Mes)
          </button>
        </div>

        {/* Live Search Bar */}
        <div className="relative w-full md:w-80">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por huésped, localizador o cabaña..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-gray-50 border-0 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-gray-700 outline-none focus:ring-2 focus:ring-[#C5A059]/20 transition-all placeholder:text-gray-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* 4. Tab 1: VISTA HOY (Day View) */}
      {activeTab === 'dia' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              Estado de las Cabañas — {todayLongLabel}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {cabinStatesToday.map(({ accommodation, booking, status }) => {
              const conf = statusConfig[status]
              let badgeBg = conf.badge

              if (status === 'checkin_hoy') {
                badgeBg = 'bg-amber-50 text-amber-800 border-amber-200 shadow-sm'
              } else if (status === 'checkout_hoy') {
                badgeBg = 'bg-orange-50 text-orange-800 border-orange-200 shadow-sm'
              } else if (status === 'limpieza') {
                badgeBg = 'bg-rose-50 text-rose-800 border-rose-200 shadow-sm'
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
                      <h3 className="text-base font-black text-white leading-tight">
                        {accommodation.title}
                      </h3>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    {booking ? (
                      <div className="space-y-3">
                        {/* Guest info card */}
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Huésped Titular</span>
                          <p className="text-sm font-black text-gray-800 flex items-center gap-1.5">
                            <span>{cleanGuestSuggestionName(booking.guestName)}</span>
                            {getBookingGroup(booking).length > 1 && (
                              <span className="text-[10px] font-bold bg-[#C5A059]/10 text-[#C5A059] px-1.5 py-0.5 rounded-full">
                                Grupo ({getBookingGroup(booking).length})
                              </span>
                            )}
                          </p>
                          {booking.locator && (
                            <span className="inline-block text-[10px] font-mono font-bold text-[#8c6b2d] bg-[#C5A059]/10 px-2 py-0.5 rounded-md mt-0.5">
                              {booking.locator}
                            </span>
                          )}
                        </div>

                        {/* Stay Dates */}
                        <div className="bg-gray-50 rounded-2xl p-3 grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block">Entrada</span>
                            <span className="font-bold text-gray-700">{booking.checkIn}</span>
                          </div>
                          <div>
                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block">Salida</span>
                            <span className="font-bold text-gray-700">{booking.checkOut}</span>
                          </div>
                        </div>

                        {/* Occupants badge */}
                        <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
                          <Users size={14} className="text-gray-400" />
                          <span>{booking.guestsCount.adults} adultos, {booking.guestsCount.children} niños</span>
                          {booking.guestsCount.pets > 0 && (
                            <span className="text-[11px] font-bold text-emerald-700">🐾 {booking.guestsCount.pets}</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="py-6 text-center space-y-2">
                        <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center mx-auto">
                          <Check size={20} />
                        </div>
                        <p className="text-xs font-bold text-gray-600">Totalmente libre para alojar hoy</p>
                        <p className="text-[10px] text-gray-400">Capacidad para {accommodation.maxCapacity} personas</p>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="pt-2 border-t border-gray-100 flex items-center gap-2">
                      {status === 'checkin_hoy' && booking && (
                        <button
                          onClick={() => handleCheckIn(booking.id)}
                          className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-2xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm shadow-amber-500/20 active:scale-95 cursor-pointer"
                        >
                          <LogIn size={14} /> Registrar Check-In
                        </button>
                      )}

                      {status === 'ocupado' && booking && (
                        <button
                          onClick={() => handleCheckOut(booking.id)}
                          className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-2xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm shadow-orange-500/20 active:scale-95 cursor-pointer"
                        >
                          <LogOut size={14} /> Registrar Check-Out
                        </button>
                      )}

                      {status === 'limpieza' && (
                        <button
                          onClick={() => handleMarkClean(accommodation.id)}
                          className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-600/20 active:scale-95 cursor-pointer"
                        >
                          <Sparkles size={14} /> Habitación Lista
                        </button>
                      )}

                      {status === 'disponible' && (
                        <button
                          onClick={() => {
                            openAddModal()
                            setSelectedAccommodationIds([accommodation.id])
                            setForm(f => ({ ...f, accommodationId: accommodation.id }))
                          }}
                          className="flex-1 py-2.5 bg-gray-50 hover:bg-[#C5A059] text-gray-600 hover:text-white font-bold rounded-2xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Plus size={14} /> Crear Reserva
                        </button>
                      )}

                      {booking && (
                        <button
                          onClick={() => setSelectedBooking(booking)}
                          className="p-2.5 bg-gray-50 hover:bg-gray-100 text-gray-500 rounded-2xl transition-all cursor-pointer"
                          title="Ver ficha completa"
                        >
                          <Info size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 5. Tab 2: PLANNER SEMANAL / CUADRÍCULA DE RESERVAS */}
      {activeTab === 'semana' && (
        <div className={`space-y-4 ${plannerFullscreen ? 'fixed inset-0 z-50 bg-[#FDFBF7] p-4 overflow-y-auto' : ''}`}>
          {/* Controls bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-3xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3">
              {/* Botón Pantalla Completa (especialmente útil en móviles para ver la rejilla cómoda) */}
              <button
                type="button"
                onClick={() => setPlannerFullscreen(f => !f)}
                className={`p-2 rounded-2xl border transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold ${
                  plannerFullscreen
                    ? 'bg-[#C5A059] text-white border-[#C5A059]'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
                title={plannerFullscreen ? 'Salir de pantalla completa' : 'Ver planner en pantalla completa'}
              >
                {plannerFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                <span className="hidden sm:inline">{plannerFullscreen ? 'Reducir' : 'Pantalla completa'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setWeekViewMode('semana')
                  setWeekAnchor(new Date(todayDate))
                }}
                className={`px-4 py-2 border rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                  weekViewMode === 'semana'
                    ? 'border-[#C5A059] text-[#C5A059] bg-[#C5A059]/10'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                Hoy
              </button>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setWeekViewMode('semana')
                    setWeekAnchor(prev => {
                      const d = new Date(prev)
                      d.setDate(d.getDate() - 7)
                      return d
                    })
                  }}
                  className="w-8 h-8 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-600 flex items-center justify-center font-bold text-sm cursor-pointer"
                  title="7 días atrás"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setWeekViewMode('semana')
                    setWeekAnchor(prev => {
                      const d = new Date(prev)
                      d.setDate(d.getDate() + 7)
                      return d
                    })
                  }}
                  className="w-8 h-8 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-600 flex items-center justify-center font-bold text-sm cursor-pointer"
                  title="7 días adelante"
                >
                  →
                </button>
              </div>

              <span className="text-sm font-black text-gray-800">
                {weekRangeLabel}
              </span>
            </div>

            {/* Selector de Rango Personalizado (estilo Paxer "Buscar por fecha") */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Rango libre:
              </span>
              <input
                type="date"
                value={weekRangeFrom}
                onChange={e => {
                  setWeekRangeFrom(e.target.value)
                  if (e.target.value && weekRangeTo) setWeekViewMode('personalizado')
                }}
                className="border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs outline-none focus:border-[#C5A059]"
                title="Fecha inicial del planner"
              />
              <span className="text-gray-400 text-xs">→</span>
              <input
                type="date"
                value={weekRangeTo}
                onChange={e => {
                  setWeekRangeTo(e.target.value)
                  if (weekRangeFrom && e.target.value) setWeekViewMode('personalizado')
                }}
                className="border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs outline-none focus:border-[#C5A059]"
                title="Fecha final del planner"
              />
              {weekViewMode === 'personalizado' && (
                <button
                  type="button"
                  onClick={() => {
                    setWeekViewMode('semana')
                    setWeekRangeFrom('')
                    setWeekRangeTo('')
                  }}
                  className="text-xs font-bold text-gray-400 hover:text-gray-600 underline cursor-pointer"
                >
                  Volver a semanas
                </button>
              )}
            </div>

            {/* Leyenda de colores calcada de Paxer */}
            <div className="flex items-center gap-3 flex-wrap">
              {(['reservado', 'sin_pago', 'parcial', 'pagado'] as EffectivePaymentState[]).map(state => {
                const sampleColors = getPaymentColorClasses({ confirmed: state !== 'reservado', paymentStatus: state === 'pagado' ? 'completo' : state === 'parcial' ? 'parcial' : 'pendiente' })
                return (
                  <div key={state} className="flex items-center gap-1.5 text-[11px] font-bold text-gray-600">
                    <span className={`w-2.5 h-2.5 rounded-full ${sampleColors.bullet}`} />
                    <span>{paymentStateLabels[state]}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Banner de ayuda: arrastrar vs dos toques con el dedo */}
          <div className="rounded-2xl border border-gray-200/80 bg-white/70 px-4 py-2 text-[11px] text-gray-500 flex items-center justify-between flex-wrap gap-2">
            <span>
              💡 En computadora: <strong className="font-semibold text-gray-700">arrastra</strong> en un día libre para marcar la estadía.
              En teléfono: <strong className="font-semibold text-gray-700">toca el día de entrada y luego el de salida</strong> para abrir Nueva Reserva.
            </span>
            {pendingCheckIn && (
              <span className="font-bold text-[#8c6b2d] bg-[#C5A059]/20 px-2 py-0.5 rounded-full">
                Entrada marcada: {pendingCheckIn.dateStr} (toca el día de salida)
              </span>
            )}
          </div>

          {/* Grid Container */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-x-auto select-none touch-pan-x">
            <table className="w-full min-w-[1200px] border-collapse">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="p-3.5 text-left text-xs font-bold text-gray-400 uppercase tracking-widest sticky left-0 bg-gray-50 z-10 w-56 border-r border-gray-100">
                    Habitación
                  </th>
                  {weekDays.map(d => {
                    const isToday = d.dateStr === todayStr
                    return (
                      <th
                        key={d.dateStr}
                        className={`p-2.5 text-center text-xs font-bold border-r border-gray-100 min-w-[70px] ${
                          isToday ? 'bg-amber-50/80 text-amber-900' : 'text-gray-500'
                        }`}
                      >
                        <span className="block text-[10px] uppercase tracking-wider text-gray-400">
                          {d.label}
                        </span>
                        <span className={`text-sm ${isToday ? 'font-black text-amber-700' : 'font-bold'}`}>
                          {d.dayNum}
                        </span>
                        <span className="block text-[9px] text-gray-400">
                          {d.monthLabel}
                        </span>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {activeAccommodationOptions.map(acc => {
                  const accId = acc.id
                  const dbPrice = dbAccommodations.find(o => Number(o.id) === accId)?.price
                  return (
                    <tr key={accId} className="border-b border-gray-100 hover:bg-gray-50/30 transition-colors">
                      {/* Accommodation info sticky cell */}
                      <td className="p-3 sticky left-0 bg-white z-10 border-r border-gray-100 shadow-xs">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={acc.image}
                            alt={acc.title}
                            className="w-10 h-10 rounded-xl object-cover"
                          />
                          <div className="truncate">
                            <span className="text-[10px] uppercase tracking-wider text-[#C5A059] font-bold block">
                              {acc.type}
                            </span>
                            <span className="text-xs font-black text-gray-800 truncate block">
                              {acc.title}
                            </span>
                            <span className="text-[10px] text-gray-400">
                              ${Number(dbPrice ?? acc.price)}/noche · Máx. {acc.maxCapacity} pax
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Day cells */}
                      {weekDays.map(d => {
                        const dateStr = d.dateStr
                        const cellKey = `${accId}|${dateStr}`
                        const isDragOver = dragOverCell === cellKey

                        // Find booking that covers this night (checkIn <= dateStr < checkOut)
                        const booking = bookings.find(b =>
                          b.accommodationId === accId &&
                          dateStr >= b.checkIn &&
                          dateStr < b.checkOut
                        )

                        const isFirstDay = booking && booking.checkIn === dateStr
                        const isToday = dateStr === todayStr

                        // Detección de selección arrastrando
                        const isSelectedRange = rangeSelect &&
                          rangeSelect.accId === accId &&
                          ((dateStr >= rangeSelect.startDateStr && dateStr <= rangeSelect.endDateStr) ||
                           (dateStr >= rangeSelect.endDateStr && dateStr <= rangeSelect.startDateStr))

                        const isPendingStart = pendingCheckIn &&
                          pendingCheckIn.accId === accId &&
                          pendingCheckIn.dateStr === dateStr

                        return (
                          <td
                            key={dateStr}
                            data-planner-cell={cellKey}
                            className={`p-1 border-r border-gray-100 relative h-16 transition-colors ${
                              isDragOver
                                ? 'bg-amber-100/70 ring-2 ring-[#C5A059] ring-inset'
                                : isSelectedRange || isPendingStart
                                  ? 'bg-[#C5A059]/20'
                                  : isToday
                                    ? 'bg-amber-50/30'
                                    : ''
                            }`}
                            onPointerDown={e => {
                              // Solo si la celda está vacía
                              if (booking) return
                              rangeStartPosRef.current = { x: e.clientX, y: e.clientY }
                              rangeDraggedRef.current = false
                              rangePointerTypeRef.current = e.pointerType || 'mouse'
                              setRangeSelect({
                                accId,
                                startDateStr: dateStr,
                                endDateStr: dateStr
                              })
                            }}
                          >
                            {booking ? (
                              <div
                                onPointerDown={e => {
                                  // Inicia arrastre para mover toda la reserva.
                                  dragStartPosRef.current = { x: e.clientX, y: e.clientY }
                                  hasDraggedRef.current = false
                                  dragOverCellRef.current = cellKey
                                  setDragInfo({ bookingId: booking.id, mode: 'move' })
                                }}
                                onClick={e => {
                                  // Si el usuario arrastró no queremos abrir la ficha al soltar
                                  if (hasDraggedRef.current) {
                                    e.stopPropagation()
                                    return
                                  }
                                  setSelectedBooking(booking)
                                }}
                                className={`w-full h-full rounded-xl border p-1.5 flex flex-col justify-between text-left transition-all hover:scale-[1.02] cursor-grab active:cursor-grabbing ${
                                  getBookingPaymentColors(booking).bg
                                }`}
                              >
                                {isFirstDay ? (
                                  <>
                                    <div className="flex items-center justify-between gap-1">
                                      <span className="text-[10px] font-black truncate text-gray-800">
                                        {cleanGuestSuggestionName(booking.guestName)}
                                      </span>
                                      <span className={`w-2 h-2 rounded-full shrink-0 ${getBookingPaymentColors(booking).bullet}`} />
                                    </div>
                                    <div className="flex items-center justify-between text-[9px] text-gray-500">
                                      <span>{calculateNights(booking.checkIn, booking.checkOut)}n</span>
                                      <span className="font-bold">{fmt(booking.totalAmount)}</span>
                                    </div>
                                  </>
                                ) : (
                                  <div className="flex items-center justify-center h-full">
                                    <span className="text-[9px] font-bold text-gray-400">···</span>
                                  </div>
                                )}
                              </div>
                            ) : null}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. Tab 3: LISTA MENSUAL DE RESERVAS */}
      {activeTab === 'mes' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-3xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setMesMode('mes')
                  setMonthAnchor(new Date(todayDate.getFullYear(), todayDate.getMonth(), 1))
                  setMonthPage(1)
                }}
                className={`px-4 py-2 border rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                  mesMode === 'mes'
                    ? 'border-[#C5A059] text-[#C5A059] bg-[#C5A059]/10'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                Mes Actual
              </button>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setMesMode('mes')
                    setMonthAnchor(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
                    setMonthPage(1)
                  }}
                  className="w-8 h-8 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-600 flex items-center justify-center font-bold text-sm cursor-pointer"
                  title="Mes anterior"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMesMode('mes')
                    setMonthAnchor(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
                    setMonthPage(1)
                  }}
                  className="w-8 h-8 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-600 flex items-center justify-center font-bold text-sm cursor-pointer"
                  title="Mes siguiente"
                >
                  →
                </button>
              </div>

              <span className="text-sm font-black text-gray-800">
                {mesMode === 'personalizado' ? `Del ${customFrom || '—'} al ${customTo || '—'}` : monthAnchorLabel}
              </span>
            </div>

            {/* Selector de Rango Personalizado */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Rango libre:
              </span>
              <input
                type="date"
                value={customFrom}
                onChange={e => {
                  setCustomFrom(e.target.value)
                  if (e.target.value && customTo) {
                    setMesMode('personalizado')
                    setMonthPage(1)
                  }
                }}
                className="border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs outline-none focus:border-[#C5A059]"
                title="Fecha inicial"
              />
              <span className="text-gray-400 text-xs">→</span>
              <input
                type="date"
                value={customTo}
                onChange={e => {
                  setCustomTo(e.target.value)
                  if (customFrom && e.target.value) {
                    setMesMode('personalizado')
                    setMonthPage(1)
                  }
                }}
                className="border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs outline-none focus:border-[#C5A059]"
                title="Fecha final"
              />
              {mesMode === 'personalizado' && (
                <button
                  type="button"
                  onClick={() => {
                    setMesMode('mes')
                    setCustomFrom('')
                    setCustomTo('')
                    setMonthPage(1)
                  }}
                  className="text-xs font-bold text-gray-400 hover:text-gray-600 underline cursor-pointer"
                >
                  Volver a meses
                </button>
              )}
            </div>

            <div className="flex items-center gap-4 text-xs">
              <span className="font-bold text-gray-500">
                {monthListBookings.length} {monthListBookings.length === 1 ? 'reserva' : 'reservas'}
              </span>
              <span className="font-extrabold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                Total: {fmt(totalMonthlyRevenue)}
              </span>
            </div>
          </div>

          {/* Bookings Table */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    <th className="p-4">Localizador</th>
                    <th className="p-4">Huésped Titular</th>
                    <th className="p-4">Habitación</th>
                    <th className="p-4">Entrada / Salida</th>
                    <th className="p-4">Ocupantes</th>
                    <th className="p-4">Total</th>
                    <th className="p-4">Estado Pago</th>
                    <th className="p-4 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {monthListBookings
                    .slice((monthPage - 1) * PAGE_SIZE, monthPage * PAGE_SIZE)
                    .map(b => {
                      const acc = getAccommodation(b.accommodationId)
                      const isGroup = getBookingGroup(b).length > 1
                      return (
                        <tr
                          key={b.id}
                          onClick={() => setSelectedBooking(b)}
                          className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                        >
                          <td className="p-4 font-mono font-bold text-gray-700">
                            {b.locator ? (
                              <span className="bg-[#C5A059]/10 text-[#8c6b2d] px-2 py-0.5 rounded-md">
                                {b.locator}
                              </span>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                          <td className="p-4">
                            <span className="font-extrabold text-gray-800 block">
                              {cleanGuestSuggestionName(b.guestName)}
                            </span>
                            {isGroup && (
                              <span className="text-[10px] font-bold text-[#C5A059]">
                                Grupo ({getBookingGroup(b).length} hab)
                              </span>
                            )}
                          </td>
                          <td className="p-4 font-medium text-gray-600">
                            {acc?.title || `Habitación ${b.accommodationId}`}
                          </td>
                          <td className="p-4">
                            <span className="font-bold text-gray-700 block">{b.checkIn}</span>
                            <span className="text-[10px] text-gray-400">al {b.checkOut} ({calculateNights(b.checkIn, b.checkOut)}n)</span>
                          </td>
                          <td className="p-4 text-gray-600">
                            {b.guestsCount.adults} ad, {b.guestsCount.children} niñ
                            {b.guestsCount.pets > 0 && <span className="ml-1 text-emerald-700 font-bold">🐾 {b.guestsCount.pets}</span>}
                          </td>
                          <td className="p-4 font-black text-gray-800">
                            {fmt(b.totalAmount)}
                          </td>
                          <td className="p-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                              getBookingPaymentColors(b).badge
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${getBookingPaymentColors(b).bullet}`} />
                              {paymentStateLabels[getBookingPaymentState(b)]}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <button
                              onClick={e => {
                                e.stopPropagation()
                                setSelectedBooking(b)
                              }}
                              className="px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-xl font-bold text-xs transition-colors"
                            >
                              Ver ficha
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {monthListBookings.length > PAGE_SIZE && (
              <div className="flex items-center justify-between p-4 border-t border-gray-100 bg-gray-50/30 text-xs">
                <span className="text-gray-400 font-medium">
                  Mostrando {((monthPage - 1) * PAGE_SIZE) + 1} - {Math.min(monthPage * PAGE_SIZE, monthListBookings.length)} de {monthListBookings.length} reservas
                </span>
                <div className="flex items-center gap-1">
                  <button
                    disabled={monthPage === 1}
                    onClick={() => setMonthPage(p => Math.max(1, p - 1))}
                    className="px-3 py-1 rounded-xl border border-gray-200 text-gray-600 font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Anterior
                  </button>
                  <span className="px-3 py-1 text-gray-700 font-bold">
                    Página {monthPage} de {Math.ceil(monthListBookings.length / PAGE_SIZE)}
                  </span>
                  <button
                    disabled={monthPage >= Math.ceil(monthListBookings.length / PAGE_SIZE)}
                    onClick={() => setMonthPage(p => p + 1)}
                    className="px-3 py-1 rounded-xl border border-gray-200 text-gray-600 font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 7. MODAL DETALLE DE RESERVA (Guest Card + Financial History) */}
      {selectedBooking && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-[2.5rem] shadow-2xl border border-gray-100 max-w-2xl w-full p-6 space-y-6 animate-scale-in my-8 max-h-[90vh] overflow-y-auto custom-scrollbar">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-gray-100">
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">
                  Ficha de Reserva {selectedBooking.locator && `· ${selectedBooking.locator}`}
                </span>
                <h2 className="text-xl font-black text-gray-800">
                  {cleanGuestSuggestionName(selectedBooking.guestName)}
                </h2>
              </div>
              <button
                onClick={() => setSelectedBooking(null)}
                className="p-2 rounded-2xl bg-gray-50 hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick Status Bar */}
            <div className="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-2xl flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-500">Estado de Pago:</span>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider border ${
                  getBookingPaymentColors(selectedBooking).badge
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${getBookingPaymentColors(selectedBooking).bullet}`} />
                  {paymentStateLabels[getBookingPaymentState(selectedBooking)]}
                </span>
              </div>

              {/* Selector directo de estado de pago */}
              <div className="flex items-center gap-1">
                {(['pendiente', 'parcial', 'completo'] as const).map(st => (
                  <button
                    key={st}
                    onClick={() => handleUpdatePaymentStatus(selectedBooking.id, st)}
                    className={`px-2.5 py-1 rounded-xl text-[10px] font-bold uppercase transition-all cursor-pointer ${
                      selectedBooking.paymentStatus === st
                        ? 'bg-gray-800 text-white shadow-xs'
                        : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {st === 'completo' ? 'Pagado' : st === 'parcial' ? 'Parcial' : 'Sin Pago'}
                  </button>
                ))}
              </div>
            </div>

            {/* Section 1: Guest Contact Info */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  Datos del Huésped
                </span>
                {!editingGuest && (
                  <button
                    onClick={() => {
                      const { firstName, lastName } = splitPersonName(cleanGuestSuggestionName(selectedBooking.guestName))
                      setEditGuestForm({
                        firstName,
                        lastName,
                        ci: selectedBooking.guestCi || '',
                        phone: cleanSavedGuestPhone(selectedBooking.guestPhone),
                        email: cleanSavedGuestEmail(selectedBooking.guestEmail),
                        companions: selectedBooking.companions || ''
                      })
                      setEditingGuest(true)
                    }}
                    className="text-xs font-bold text-[#C5A059] hover:underline cursor-pointer"
                  >
                    Editar datos
                  </button>
                )}
              </div>

              {editingGuest ? (
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200/80 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Nombre</label>
                      <input
                        type="text"
                        value={editGuestForm.firstName}
                        onChange={e => setEditGuestForm(f => ({ ...f, firstName: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs bg-white outline-none focus:border-[#C5A059]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Apellido</label>
                      <input
                        type="text"
                        value={editGuestForm.lastName}
                        onChange={e => setEditGuestForm(f => ({ ...f, lastName: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs bg-white outline-none focus:border-[#C5A059]"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Cédula / Pasaporte</label>
                      <input
                        type="text"
                        placeholder="V-12345678"
                        value={editGuestForm.ci}
                        onChange={e => setEditGuestForm(f => ({ ...f, ci: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs bg-white outline-none focus:border-[#C5A059]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Teléfono</label>
                      <input
                        type="text"
                        placeholder="+58 412..."
                        value={editGuestForm.phone}
                        onChange={e => setEditGuestForm(f => ({ ...f, phone: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs bg-white outline-none focus:border-[#C5A059]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Correo</label>
                      <input
                        type="email"
                        placeholder="correo@ejemplo.com"
                        value={editGuestForm.email}
                        onChange={e => setEditGuestForm(f => ({ ...f, email: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs bg-white outline-none focus:border-[#C5A059]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Acompañantes</label>
                    <input
                      type="text"
                      placeholder="Nombres de otros huéspedes del grupo"
                      value={editGuestForm.companions}
                      onChange={e => setEditGuestForm(f => ({ ...f, companions: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs bg-white outline-none focus:border-[#C5A059]"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      onClick={() => setEditingGuest(false)}
                      className="px-3 py-1.5 border border-gray-200 text-gray-500 rounded-xl text-xs font-bold hover:bg-gray-100"
                    >
                      Cancelar
                    </button>
                    <button
                      disabled={savingGuest}
                      onClick={handleSaveGuestInfo}
                      className="px-4 py-1.5 bg-[#C5A059] text-white rounded-xl text-xs font-bold hover:bg-[#b8904a] disabled:opacity-40"
                    >
                      {savingGuest ? 'Guardando...' : 'Guardar'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 p-4 rounded-2xl grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Cédula</span>
                    <span className="font-semibold text-gray-700">{selectedBooking.guestCi || 'No registrada'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Teléfono</span>
                    <span className="font-semibold text-gray-700 flex items-center gap-1">
                      <Phone size={12} className="text-gray-400" />
                      {cleanSavedGuestPhone(selectedBooking.guestPhone) || 'No registrado'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Correo</span>
                    <span className="font-semibold text-gray-700 flex items-center gap-1 truncate">
                      <Mail size={12} className="text-gray-400 shrink-0" />
                      <span className="truncate">{cleanSavedGuestEmail(selectedBooking.guestEmail) || 'No registrado'}</span>
                    </span>
                  </div>
                  {selectedBooking.companions && (
                    <div className="col-span-1 sm:col-span-3 pt-2 border-t border-gray-200/60">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Acompañantes</span>
                      <p className="text-gray-700 font-medium">{selectedBooking.companions}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Section 2: Habitaciones de la Reserva (Soporta Reservas Grupales) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  Habitaciones Asignadas ({getBookingGroup(selectedBooking).length})
                </span>
                {!addingRoomsToBooking && (
                  <button
                    onClick={handleStartAddRooms}
                    className="text-xs font-bold text-[#C5A059] hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <Plus size={13} /> Añadir habitación a este grupo
                  </button>
                )}
              </div>

              {/* Formulario para añadir más habitaciones al grupo */}
              {addingRoomsToBooking && (
                <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-amber-900">
                      Selecciona las habitaciones a incorporar al localizador {selectedBooking.locator || 'nuevo'}
                    </span>
                    <button
                      onClick={() => setAddingRoomsToBooking(false)}
                      className="text-xs font-bold text-gray-400 hover:text-gray-600"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="max-h-40 overflow-y-auto space-y-1.5 p-1 bg-white rounded-xl border border-gray-200">
                    {activeAccommodationOptions
                      .filter(acc => !getBookingGroup(selectedBooking).some(r => r.accommodationId === acc.id))
                      .map(acc => {
                        const collision = bookings.find(b =>
                          b.accommodationId === acc.id &&
                          selectedBooking.checkIn < b.checkOut && selectedBooking.checkOut > b.checkIn
                        )
                        const isSelected = additionalAccommodationIds.includes(acc.id)
                        return (
                          <label
                            key={acc.id}
                            className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer border ${
                              collision
                                ? 'bg-rose-50/50 border-rose-100 opacity-50 cursor-not-allowed'
                                : isSelected
                                  ? 'bg-[#C5A059]/10 border-[#C5A059]/40'
                                  : 'hover:bg-gray-50 border-transparent'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                disabled={!!collision}
                                checked={isSelected}
                                onChange={e => {
                                  if (e.target.checked) {
                                    setAdditionalAccommodationIds(prev => [...prev, acc.id])
                                  } else {
                                    setAdditionalAccommodationIds(prev => prev.filter(id => id !== acc.id))
                                  }
                                }}
                                className="rounded text-[#C5A059]"
                              />
                              <span className="font-bold text-gray-700">{acc.title}</span>
                            </div>
                            <span className="text-[10px] text-gray-400">
                              {collision ? 'Ocupada en esas fechas' : `Máx. ${acc.maxCapacity} pax`}
                            </span>
                          </label>
                        )
                      })}
                  </div>

                  {additionalAccommodationIds.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 bg-white p-3 rounded-xl border border-gray-200 text-xs">
                      <div>
                        <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Adultos extras</label>
                        <input
                          type="number"
                          min={1}
                          value={additionalGuests.adults}
                          onChange={e => setAdditionalGuests(g => ({ ...g, adults: Number(e.target.value) }))}
                          className="w-full border border-gray-200 rounded-lg p-1.5 font-bold"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Niños extras</label>
                        <input
                          type="number"
                          min={0}
                          value={additionalGuests.children}
                          onChange={e => setAdditionalGuests(g => ({ ...g, children: Number(e.target.value) }))}
                          className="w-full border border-gray-200 rounded-lg p-1.5 font-bold"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Bebés extras</label>
                        <input
                          type="number"
                          min={0}
                          value={additionalGuests.babies}
                          onChange={e => setAdditionalGuests(g => ({ ...g, babies: Number(e.target.value) }))}
                          className="w-full border border-gray-200 rounded-lg p-1.5 font-bold"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setAddingRoomsToBooking(false)}
                      className="px-3 py-1.5 border border-gray-200 text-gray-500 rounded-xl text-xs font-bold hover:bg-gray-100"
                    >
                      Cancelar
                    </button>
                    <button
                      disabled={additionalAccommodationIds.length === 0 || savingAdditionalRooms}
                      onClick={handleSaveAdditionalRooms}
                      className="px-4 py-1.5 bg-[#C5A059] text-white rounded-xl text-xs font-bold hover:bg-[#b8904a] disabled:opacity-40"
                    >
                      {savingAdditionalRooms ? 'Añadiendo...' : `Añadir ${additionalAccommodationIds.length} habitación(es)`}
                    </button>
                  </div>
                </div>
              )}

              {/* Lista de habitaciones asignadas con sus opciones de edición */}
              <div className="space-y-2">
                {getBookingGroup(selectedBooking).map(roomBooking => {
                  const acc = getAccommodation(roomBooking.accommodationId)
                  const isEditing = editingRoomId === roomBooking.id

                  return (
                    <div
                      key={roomBooking.id}
                      className="bg-gray-50 p-3.5 rounded-2xl border border-gray-100 flex flex-col gap-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <img
                            src={acc?.image}
                            alt={acc?.title}
                            className="w-9 h-9 rounded-xl object-cover"
                          />
                          <div>
                            <span className="text-xs font-extrabold text-gray-800 block">
                              {acc?.title || `Habitación ${roomBooking.accommodationId}`}
                            </span>
                            <span className="text-[10px] text-gray-400">
                              {roomBooking.guestsCount.adults} adultos, {roomBooking.guestsCount.children} niños
                              {roomBooking.guestsCount.babies > 0 && ` (${roomBooking.guestsCount.babies} bebés)`}
                              {roomBooking.guestsCount.pets > 0 && ` · 🐾 ${roomBooking.guestsCount.pets} mascota`}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-gray-800">
                            {fmt(roomBooking.totalAmount)}
                          </span>
                          {!isEditing && (
                            <button
                              onClick={() => handleStartEditRoom(roomBooking)}
                              className="text-[11px] font-bold text-[#C5A059] hover:underline ml-2"
                            >
                              Cambiar
                            </button>
                          )}
                          {getBookingGroup(selectedBooking).length > 1 && (
                            <button
                              onClick={() => handleRemoveRoomFromGroup(roomBooking.id)}
                              className="text-gray-300 hover:text-rose-500 p-1"
                              title="Quitar esta habitación del grupo"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Sub-formulario de edición de esta habitación */}
                      {isEditing && (
                        <div className="bg-white p-3 rounded-xl border border-gray-200 mt-1 space-y-2.5">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            <div className="sm:col-span-2">
                              <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Mover a otra habitación</label>
                              <select
                                value={editRoomForm.accommodationId}
                                onChange={e => setEditRoomForm(f => ({ ...f, accommodationId: Number(e.target.value) }))}
                                className="w-full border border-gray-200 rounded-lg p-1.5 font-bold bg-white text-xs"
                              >
                                {activeAccommodationOptions.map(o => (
                                  <option key={o.id} value={o.id}>
                                    {o.title} (Máx. {o.maxCapacity} pax) — ${o.price}/n
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Adultos</label>
                              <input
                                type="number"
                                min={1}
                                value={editRoomForm.adults}
                                onChange={e => setEditRoomForm(f => ({ ...f, adults: Number(e.target.value) }))}
                                className="w-full border border-gray-200 rounded-lg p-1.5 font-bold text-xs"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Niños</label>
                              <input
                                type="number"
                                min={0}
                                value={editRoomForm.children}
                                onChange={e => setEditRoomForm(f => ({ ...f, children: Number(e.target.value) }))}
                                className="w-full border border-gray-200 rounded-lg p-1.5 font-bold text-xs"
                              />
                            </div>
                          </div>

                          <div className="flex justify-end gap-2 pt-1">
                            <button
                              onClick={() => setEditingRoomId(null)}
                              className="px-2.5 py-1 border border-gray-200 text-gray-500 rounded-lg text-xs font-bold"
                            >
                              Cancelar
                            </button>
                            <button
                              disabled={savingRoom}
                              onClick={handleSaveRoom}
                              className="px-3 py-1 bg-[#C5A059] text-white rounded-lg text-xs font-bold hover:bg-[#b8904a]"
                            >
                              {savingRoom ? 'Guardando...' : 'Aplicar cambio'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Section 3: Stay Dates with Edit option */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  Fechas de Estadía
                </span>
                {!editingDates && (
                  <button
                    onClick={handleStartEditDates}
                    className="text-xs font-bold text-[#C5A059] hover:underline cursor-pointer"
                  >
                    Cambiar fechas
                  </button>
                )}
              </div>

              {editingDates ? (
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200/80 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest block mb-1">Check-In</label>
                      <input
                        type="date"
                        value={editDatesForm.checkIn}
                        onChange={e => setEditDatesForm(f => ({ ...f, checkIn: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-[#C5A059] bg-white font-medium"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest block mb-1">Check-Out</label>
                      <input
                        type="date"
                        value={editDatesForm.checkOut}
                        onChange={e => setEditDatesForm(f => ({ ...f, checkOut: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-[#C5A059] bg-white font-medium"
                      />
                    </div>
                  </div>

                  {/* Resumen en vivo de noches y tarifas recalculadas */}
                  {(() => {
                    const { checkIn, checkOut } = editDatesForm
                    if (!checkIn || !checkOut || checkOut <= checkIn) return null
                    const group = getBookingGroup(selectedBooking)
                    const nNights = calculateNights(checkIn, checkOut)
                    const newTotal = group.reduce((sum, r) => {
                      const std = getStandardRate(r.accommodationId, checkIn, checkOut, r.guestsCount.adults, r.guestsCount.children)
                      return sum + getAdjustedBookingTotal(std, r.specialNotes)
                    }, 0)
                    return (
                      <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-xs flex items-center justify-between text-amber-900">
                        <span>{nNights} noche(s) seleccionadas</span>
                        <span className="font-extrabold">Nuevo total: {fmt(newTotal)}</span>
                      </div>
                    )
                  })()}

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      onClick={() => setEditingDates(false)}
                      className="px-3 py-1.5 border border-gray-200 text-gray-500 rounded-xl text-xs font-bold hover:bg-gray-100"
                    >
                      Cancelar
                    </button>
                    <button
                      disabled={savingDates}
                      onClick={handleSaveDates}
                      className="px-4 py-1.5 bg-[#C5A059] text-white rounded-xl text-xs font-bold hover:bg-[#b8904a] disabled:opacity-40"
                    >
                      {savingDates ? 'Guardando...' : 'Aplicar nuevas fechas'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 p-4 rounded-2xl grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Entrada</span>
                    <span className="font-bold text-gray-800 text-sm">{selectedBooking.checkIn}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Salida</span>
                    <span className="font-bold text-gray-800 text-sm">{selectedBooking.checkOut}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Section 4: Financial Summary & Discount Editor */}
            <div className="bg-[#FAF7F0] p-5 rounded-3xl border border-[#C5A059]/20 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-gray-800">
                  Resumen Económico {getBookingGroup(selectedBooking).length > 1 && '(Total Grupo)'}
                </span>
                {!editingFinancials && (
                  <button
                    onClick={handleStartEditFinancials}
                    className="text-xs font-bold text-[#C5A059] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Percent size={13} /> Modificar tarifa o descuento
                  </button>
                )}
              </div>

              {/* Editor de Descuento (Porcentual o Monto Fijo) */}
              {editingFinancials ? (
                <div className="bg-white p-4 rounded-2xl border border-gray-200 space-y-3 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">
                        Descuento (%)
                      </label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={editDiscountPercent}
                          onChange={e => setEditDiscountPercent(Math.max(0, Math.min(100, Number(e.target.value))))}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-[#C5A059]"
                        />
                        <span className="text-gray-400 font-bold">%</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">
                        Descuento Fijo (USD)
                      </label>
                      <div className="flex items-center gap-1">
                        <span className="text-gray-400 font-bold">$</span>
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={editFixedDiscountAmount}
                          onChange={e => setEditFixedDiscountAmount(Math.max(0, Number(e.target.value)))}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-[#C5A059]"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      onClick={() => setEditingFinancials(false)}
                      className="px-3 py-1.5 border border-gray-200 text-gray-500 rounded-xl text-xs font-bold hover:bg-gray-50"
                    >
                      Cancelar
                    </button>
                    <button
                      disabled={savingFinancials}
                      onClick={handleSaveFinancials}
                      className="px-4 py-1.5 bg-[#C5A059] text-white rounded-xl text-xs font-bold hover:bg-[#b8904a] disabled:opacity-40"
                    >
                      {savingFinancials ? 'Guardando...' : 'Aplicar Descuento'}
                    </button>
                  </div>
                </div>
              ) : (
                (() => {
                  const group = getBookingGroup(selectedBooking)
                  const total = group.reduce((sum, r) => sum + r.totalAmount, 0)
                  const paid = group.reduce((sum, r) => sum + r.amountPaid, 0)
                  const pending = Math.max(0, total - paid)
                  const discountPct = getBookingDiscountPercent(selectedBooking.specialNotes)
                  const fixedDesc = getBookingFixedDiscountAmount(selectedBooking.specialNotes)

                  return (
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-2xs">
                          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block">Total</span>
                          <span className="text-base font-black text-gray-800">{fmt(total)}</span>
                        </div>
                        <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-2xs">
                          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block">Abonado</span>
                          <span className="text-base font-black text-emerald-600">{fmt(paid)}</span>
                        </div>
                        <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-2xs">
                          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block">Por Cobrar</span>
                          <span className={`text-base font-black ${pending > 0 ? 'text-amber-700' : 'text-gray-400'}`}>
                            {fmt(pending)}
                          </span>
                        </div>
                      </div>

                      {(discountPct > 0 || fixedDesc > 0) && (
                        <p className="text-[11px] text-[#8c6b2d] font-bold flex items-center gap-1">
                          <span>✨</span>
                          <span>
                            Beneficio aplicado: {discountPct > 0 ? `${discountPct}% de descuento` : ''}
                            {discountPct > 0 && fixedDesc > 0 ? ' + ' : ''}
                            {fixedDesc > 0 ? `$${fixedDesc.toFixed(2)} USD de rebaja fija` : ''}
                          </span>
                        </p>
                      )}
                    </div>
                  )
                })()
              )}
            </div>

            {/* Section 5: Historial de Abonos (Estilo Paxer) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  Historial de Abonos y Pagos ({bookingPayments.length})
                </span>
                {!addingPayment && (
                  <button
                    onClick={() => setAddingPayment(true)}
                    className="text-xs font-bold text-[#C5A059] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={13} /> Registrar Nuevo Abono
                  </button>
                )}
              </div>

              {/* Formulario de Registro de Nuevo Abono */}
              {addingPayment && (
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200/80 space-y-3">
                  <span className="text-xs font-extrabold text-gray-800 block">
                    Registrar Cobro / Abono
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest block mb-1">Monto en USD ($)</label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        placeholder="Ej. 50.00"
                        value={paymentForm.amount}
                        onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 bg-white font-bold outline-none focus:border-[#C5A059]"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest block mb-1">Fecha del Pago</label>
                      <input
                        type="date"
                        value={paymentForm.date}
                        onChange={e => setPaymentForm(f => ({ ...f, date: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 bg-white font-medium outline-none focus:border-[#C5A059]"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest block mb-1">Método</label>
                      <select
                        value={paymentForm.method}
                        onChange={e => setPaymentForm(f => ({ ...f, method: e.target.value as any }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 bg-white font-medium outline-none focus:border-[#C5A059]"
                      >
                        <option value="transferencia">Transferencia</option>
                        <option value="pago_movil">Pago Móvil</option>
                        <option value="zelle">Zelle</option>
                        <option value="efectivo">Efectivo</option>
                        <option value="tarjeta">Tarjeta</option>
                        <option value="cheque">Cheque</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest block mb-1">Número de Referencia</label>
                      <input
                        type="text"
                        placeholder="Ej. 12345678"
                        value={paymentForm.reference}
                        onChange={e => setPaymentForm(f => ({ ...f, reference: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 bg-white font-medium outline-none focus:border-[#C5A059]"
                      />
                    </div>
                  </div>

                  {/* Cobro en bolivares para este abono */}
                  <CobroEnBolivares
                    value={nuevoAbonoBs}
                    onChange={setNuevoAbonoBs}
                    onUsdCalculated={usd => setPaymentForm(f => ({ ...f, amount: String(usd) }))}
                    bcvRate={bcvEuro}
                    usdTarget={parseFloat(paymentForm.amount) || 0}
                  />

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      onClick={() => setAddingPayment(false)}
                      className="px-3 py-1.5 border border-gray-200 text-gray-500 rounded-xl text-xs font-bold hover:bg-gray-100"
                    >
                      Cancelar
                    </button>
                    <button
                      disabled={addingPayment}
                      onClick={handleAddPayment}
                      className="px-4 py-1.5 bg-[#C5A059] text-white rounded-xl text-xs font-bold hover:bg-[#b8904a] disabled:opacity-40"
                    >
                      {addingPayment ? 'Guardando...' : 'Guardar Abono'}
                    </button>
                  </div>
                </div>
              )}

              {/* Lista de Abonos */}
              {loadingPayments ? (
                <p className="text-xs text-gray-400 py-2">Cargando historial de pagos...</p>
              ) : bookingPayments.length === 0 ? (
                <div className="p-4 bg-gray-50 rounded-2xl text-center text-xs text-gray-400">
                  No hay pagos registrados para esta reserva aún.
                </div>
              ) : (
                <div className="space-y-2">
                  {bookingPayments.map((p, idx) => (
                    <div
                      key={p.id}
                      className="bg-white p-3 rounded-2xl border border-gray-100 flex items-center justify-between text-xs hover:border-gray-200 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-600 font-bold flex items-center justify-center text-[10px]">
                          {idx + 1}
                        </span>
                        <div>
                          <span className="font-extrabold text-gray-800 block">
                            {fmt(p.amount)}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {p.paymentDate} · {p.method}
                            {p.reference && ` · Ref: ${p.reference}`}
                          </span>
                          {p.amountBs && p.exchangeRate && (
                            <span className="block text-[10px] text-amber-700 font-semibold">
                              {textoEnBolivares(p.amountBs, p.exchangeRate)}
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeletePayment(p.id)}
                        className="text-gray-300 hover:text-rose-500 p-1.5 rounded-lg transition-colors cursor-pointer"
                        title="Eliminar este abono"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section 6: Special Notes */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  Notas Especiales / Observaciones
                </span>
                {!editingNotes && (
                  <button
                    onClick={handleStartEditNotes}
                    className="text-xs font-bold text-[#C5A059] hover:underline cursor-pointer"
                  >
                    Editar notas
                  </button>
                )}
              </div>

              {editingNotes ? (
                <div className="bg-gray-50 p-3 rounded-2xl border border-gray-200/80 space-y-2">
                  <textarea
                    rows={3}
                    value={editNotes}
                    onChange={e => setEditNotes(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl p-2.5 text-xs bg-white outline-none focus:border-[#C5A059] font-medium"
                    placeholder="Instrucciones especiales para cocina, llaves o solicitudes del huésped..."
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setEditingNotes(false)}
                      className="px-3 py-1 border border-gray-200 text-gray-500 rounded-lg text-xs font-bold"
                    >
                      Cancelar
                    </button>
                    <button
                      disabled={savingNotes}
                      onClick={handleSaveNotes}
                      className="px-3 py-1 bg-[#C5A059] text-white rounded-lg text-xs font-bold hover:bg-[#b8904a] disabled:opacity-40"
                    >
                      {savingNotes ? 'Guardando...' : 'Guardar notas'}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-600 bg-gray-50 p-3.5 rounded-2xl font-medium">
                  {selectedBooking.specialNotes || 'Sin notas especiales registradas.'}
                </p>
              )}
            </div>

            {/* Modal Footer / Delete & Close */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-100 flex-wrap gap-2">
              <button
                onClick={() => handleDeleteBooking(selectedBooking.id)}
                className="flex items-center gap-1.5 text-xs font-bold text-rose-600 hover:text-rose-700 cursor-pointer"
              >
                <Trash2 size={14} /> Eliminar Reserva
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={sendingVoucher}
                  onClick={handleSendBookingVoucher}
                  className="px-3 py-2 bg-white border border-[#C5A059] text-[#8c6b2d] font-bold rounded-2xl text-xs hover:bg-[#C5A059]/10 transition-colors flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
                  title="Enviar comprobante de pago con desglose al correo del huésped"
                >
                  <Mail size={13} />
                  <span>{voucherSentFor === selectedBooking.id ? '¡Enviado! ✓' : sendingVoucher ? 'Enviando...' : 'Enviar Comprobante'}</span>
                </button>

                <button
                  onClick={() => setSelectedBooking(null)}
                  className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl text-xs transition-colors cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 8. MODAL NUEVA RESERVA MANUAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-[2.5rem] shadow-2xl border border-gray-100 max-w-xl w-full p-6 space-y-5 animate-scale-in my-8 max-h-[90vh] overflow-y-auto custom-scrollbar">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <h3 className="text-base font-extrabold text-gray-800">Nueva Reserva Manual</h3>
                <p className="text-[10px] text-gray-400">
                  Localizador único: <span className="font-mono font-bold text-[#8c6b2d] bg-[#C5A059]/10 px-1.5 py-0.5 rounded">{locatorCode}</span>
                </p>
              </div>
              <button
                onClick={() => closeAddModal()}
                className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Form */}
            <div className="space-y-4">
              {/* Guest Names with Autocomplete */}
              <div className="relative">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Nombre</label>
                    <input
                      type="text"
                      autoComplete="off"
                      placeholder="Ej. Roberto"
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
                    {guestSuggestions.map((g, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onMouseDown={() => {
                          const { firstName, lastName } = splitPersonName(g.name)
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
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center justify-between text-xs border-b border-gray-50 last:border-0"
                      >
                        <div>
                          <p className="font-bold text-gray-800">{g.name}</p>
                          <p className="text-[10px] text-gray-400">{g.phone || g.email || 'Sin contacto'}</p>
                        </div>
                        {g.ci && <span className="text-[10px] font-mono text-gray-400">{g.ci}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Guest CI, Phone, Email & Companions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Cédula / Pasaporte</label>
                  <input
                    type="text"
                    autoComplete="off"
                    placeholder="Ej. V-12345678"
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
                    placeholder="+58 412-123-4567"
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
              <div className="space-y-3">
                <div>
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
                                setForm(f => {
                                  let totalAdults = 0
                                  let totalChildren = 0
                                  let totalBabies = 0
                                  next.forEach(id => {
                                    const r = roomGuestsMap[id] || { adults: 2, children: 0, babies: 0 }
                                    totalAdults += r.adults
                                    totalChildren += r.children
                                    totalBabies += r.babies
                                  })
                                  return {
                                    ...f,
                                    accommodationId: next[0],
                                    adults: totalAdults,
                                    children: totalChildren,
                                    babies: totalBabies
                                  }
                                })
                              } else {
                                if (selectedAccommodationIds.length >= 4) {
                                  alert('Puedes seleccionar hasta 4 habitaciones o cabañas por reserva.')
                                  return
                                }
                                const next = [...selectedAccommodationIds, acc.id]
                                const roomCap = getMaxCapacity(acc.id) || 2
                                const defaultPax = Math.min(2, roomCap) || 1
                                const updatedMap = {
                                  ...roomGuestsMap,
                                  [acc.id]: roomGuestsMap[acc.id] || { adults: defaultPax, children: 0, babies: 0 }
                                }
                                setRoomGuestsMap(updatedMap)
                                setSelectedAccommodationIds(next)
                                setForm(f => {
                                  let totalAdults = 0
                                  let totalChildren = 0
                                  let totalBabies = 0
                                  next.forEach(id => {
                                    const r = updatedMap[id] || { adults: defaultPax, children: 0, babies: 0 }
                                    totalAdults += r.adults
                                    totalChildren += r.children
                                    totalBabies += r.babies
                                  })
                                  return {
                                    ...f,
                                    accommodationId: next[0],
                                    adults: totalAdults,
                                    children: totalChildren,
                                    babies: totalBabies
                                  }
                                }})
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

                {/* Check-In and Check-Out */}
                <div className="grid grid-cols-2 gap-3">
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
                </div>
              </div>

              {/* Collision / Date range / Capacity warnings */}
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
                      <span className="font-bold">⚠️ Capacidad Total Excedida</span>
                      <span>Las unidades seleccionadas admiten hasta <strong>{maxCapacity} personas</strong> y se ingresaron <strong>{totalGuests}</strong>.</span>
                    </div>
                  )
                }
                if (selectedAccommodationIds.length > 1) {
                  const overRoom = selectedAccommodationIds.find(id => {
                    const r = roomGuestsMap[id] || { adults: 0, children: 0, babies: 0 }
                    const cap = getMaxCapacity(id)
                    return cap > 0 && (r.adults + r.children) > cap
                  })
                  if (overRoom) {
                    const cap = getMaxCapacity(overRoom)
                    const r = roomGuestsMap[overRoom] || { adults: 0, children: 0, babies: 0 }
                    return (
                      <div className="bg-rose-50 border border-rose-100 text-rose-800 text-xs p-3.5 rounded-2xl flex flex-col gap-0.5 animate-fade-in">
                        <span className="font-bold">⚠️ Capacidad Excedida en {getAccommodation(overRoom)?.title}</span>
                        <span>Esta habitación admite máx. <strong>{cap} personas</strong> y tiene asignadas <strong>{r.adults + r.children}</strong>.</span>
                      </div>
                    )
                  }
                  const emptyRoom = selectedAccommodationIds.find(id => {
                    const r = roomGuestsMap[id] || { adults: 0, children: 0, babies: 0 }
                    return (r.adults + r.children) === 0
                  })
                  if (emptyRoom) {
                    return (
                      <div className="bg-amber-50 border border-amber-200 text-amber-900 text-xs p-3.5 rounded-2xl flex flex-col gap-0.5 animate-fade-in">
                        <span className="font-bold">⚠️ Habitación sin huéspedes asignados</span>
                        <span>La unidad <strong>{getAccommodation(emptyRoom)?.title}</strong> no tiene ningún adulto o niño asignado.</span>
                      </div>
                    )
                  }
                }
                return null
              })()}

              {/* Distribución de Huéspedes */}
              {selectedAccommodationIds.length > 1 ? (
                <div className="bg-amber-50/50 border border-amber-200/80 rounded-2xl p-3.5 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div>
                      <h4 className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                        <span>👥</span> Distribución de Huéspedes por Habitación
                      </h4>
                      <p className="text-[10px] text-gray-500">
                        Indica cuántos adultos, niños y bebés van en cada habitación
                      </p>
                    </div>
                    <span className="text-[10px] font-bold text-[#8c6b2d] bg-[#C5A059]/20 px-2 py-0.5 rounded-full self-start sm:self-auto">
                      Total: {form.adults} ad · {form.children} niñ{form.babies > 0 ? ` · ${form.babies} beb` : ''}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {selectedAccommodationIds.map((accId, idx) => {
                      const acc = getAccommodation(accId)
                      const cap = getMaxCapacity(accId)
                      const roomDist = roomGuestsMap[accId] || { adults: 2, children: 0, babies: 0 }
                      const roomPax = roomDist.adults + roomDist.children
                      const isOver = cap > 0 && roomPax > cap
                      const isEmpty = roomPax === 0

                      return (
                        <div
                          key={accId}
                          className={`bg-white rounded-xl border p-2.5 transition-all ${
                            isOver
                              ? 'border-rose-300 ring-1 ring-rose-300 bg-rose-50/20'
                              : isEmpty
                                ? 'border-amber-300 ring-1 ring-amber-300 bg-amber-50/20'
                                : 'border-gray-200 shadow-sm'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-gray-100">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-5 h-5 rounded-full bg-[#C5A059]/20 text-[#8c6b2d] text-[10px] font-black flex items-center justify-center shrink-0">
                                {idx + 1}
                              </span>
                              <div className="truncate">
                                <p className="text-xs font-bold text-gray-800 truncate">{acc?.title || `Habitación ${accId}`}</p>
                                <p className="text-[10px] text-gray-400">
                                  Máximo: <strong className={isOver ? 'text-rose-600' : 'text-gray-600'}>{cap} pax</strong>
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {isOver && (
                                <span className="text-[9px] font-bold text-rose-600 bg-rose-100 px-1.5 py-0.5 rounded-full uppercase">
                                  Excede máx
                                </span>
                              )}
                              {isEmpty && (
                                <span className="text-[9px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full uppercase">
                                  Vacía
                                </span>
                              )}
                              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                                isOver ? 'bg-rose-100 text-rose-700' : 'bg-gray-100 text-gray-700'
                              }`}>
                                {roomPax} pax
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            {/* Adultos */}
                            <div className="bg-gray-50 rounded-lg p-1 flex flex-col items-center">
                              <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wide mb-1">Adultos</span>
                              <div className="flex items-center gap-1 w-full justify-center">
                                <button
                                  type="button"
                                  onClick={() => updateRoomGuests(accId, 'adults', -1)}
                                  disabled={roomDist.adults <= 0}
                                  className="w-5 h-5 rounded bg-white border border-gray-200 text-gray-700 font-bold text-xs flex items-center justify-center hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  min={0}
                                  value={roomDist.adults}
                                  onChange={e => updateRoomGuests(accId, 'adults', Number(e.target.value), true)}
                                  className="w-9 text-center text-xs font-bold text-gray-800 bg-white border border-gray-200 rounded py-0.5"
                                />
                                <button
                                  type="button"
                                  onClick={() => updateRoomGuests(accId, 'adults', 1)}
                                  className="w-5 h-5 rounded bg-white border border-gray-200 text-gray-700 font-bold text-xs flex items-center justify-center hover:bg-gray-100"
                                >
                                  +
                                </button>
                              </div>
                            </div>

                            {/* Niños */}
                            <div className="bg-gray-50 rounded-lg p-1 flex flex-col items-center">
                              <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wide mb-1">Niños (4-11)</span>
                              <div className="flex items-center gap-1 w-full justify-center">
                                <button
                                  type="button"
                                  onClick={() => updateRoomGuests(accId, 'children', -1)}
                                  disabled={roomDist.children <= 0}
                                  className="w-5 h-5 rounded bg-white border border-gray-200 text-gray-700 font-bold text-xs flex items-center justify-center hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  min={0}
                                  value={roomDist.children}
                                  onChange={e => updateRoomGuests(accId, 'children', Number(e.target.value), true)}
                                  className="w-9 text-center text-xs font-bold text-gray-800 bg-white border border-gray-200 rounded py-0.5"
                                />
                                <button
                                  type="button"
                                  onClick={() => updateRoomGuests(accId, 'children', 1)}
                                  className="w-5 h-5 rounded bg-white border border-gray-200 text-gray-700 font-bold text-xs flex items-center justify-center hover:bg-gray-100"
                                >
                                  +
                                </button>
                              </div>
                            </div>

                            {/* Bebés */}
                            <div className="bg-gray-50 rounded-lg p-1 flex flex-col items-center">
                              <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wide mb-1">Bebés (&lt;4)</span>
                              <div className="flex items-center gap-1 w-full justify-center">
                                <button
                                  type="button"
                                  onClick={() => updateRoomGuests(accId, 'babies', -1)}
                                  disabled={roomDist.babies <= 0}
                                  className="w-5 h-5 rounded bg-white border border-gray-200 text-gray-700 font-bold text-xs flex items-center justify-center hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  min={0}
                                  value={roomDist.babies}
                                  onChange={e => updateRoomGuests(accId, 'babies', Number(e.target.value), true)}
                                  className="w-9 text-center text-xs font-bold text-gray-800 bg-white border border-gray-200 rounded py-0.5"
                                />
                                <button
                                  type="button"
                                  onClick={() => updateRoomGuests(accId, 'babies', 1)}
                                  className="w-5 h-5 rounded bg-white border border-gray-200 text-gray-700 font-bold text-xs flex items-center justify-center hover:bg-gray-100"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Mascotas del grupo */}
                  <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 p-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🐾</span>
                      <div>
                        <span className="text-xs font-bold text-gray-700">Mascotas en la reserva grupal</span>
                        <p className="text-[10px] text-gray-400">Total de mascotas que acompañan al grupo</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setForm(f => ({ ...f, pets: Math.max(0, f.pets - 1) }))}
                        disabled={form.pets <= 0}
                        className="w-6 h-6 rounded bg-gray-100 border border-gray-200 text-gray-600 font-bold text-xs flex items-center justify-center hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min={0}
                        value={form.pets}
                        onChange={e => setForm(f => ({ ...f, pets: Math.max(0, Number(e.target.value)) }))}
                        className="w-10 text-center text-xs font-bold text-gray-800 bg-white border border-gray-200 rounded py-0.5"
                      />
                      <button
                        type="button"
                        onClick={() => setForm(f => ({ ...f, pets: f.pets + 1 }))}
                        className="w-6 h-6 rounded bg-gray-100 border border-gray-200 text-gray-600 font-bold text-xs flex items-center justify-center hover:bg-gray-200"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Adultos</label>
                    <input
                      type="number"
                      min={1}
                      value={form.adults}
                      onChange={e => {
                        const val = Math.max(1, Number(e.target.value))
                        setForm(f => ({ ...f, adults: val }))
                        if (selectedAccommodationIds[0]) {
                          setRoomGuestsMap(prev => ({
                            ...prev,
                            [selectedAccommodationIds[0]]: {
                              ...(prev[selectedAccommodationIds[0]] || { adults: 2, children: 0, babies: 0 }),
                              adults: val
                            }
                          }))
                        }
                      }}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-[#C5A059]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Niños</label>
                    <input
                      type="number"
                      min={0}
                      value={form.children}
                      onChange={e => {
                        const val = Math.max(0, Number(e.target.value))
                        setForm(f => ({ ...f, children: val }))
                        if (selectedAccommodationIds[0]) {
                          setRoomGuestsMap(prev => ({
                            ...prev,
                            [selectedAccommodationIds[0]]: {
                              ...(prev[selectedAccommodationIds[0]] || { adults: 2, children: 0, babies: 0 }),
                              children: val
                            }
                          }))
                        }
                      }}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-[#C5A059]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Bebés</label>
                    <input
                      type="number"
                      min={0}
                      value={form.babies}
                      onChange={e => {
                        const val = Math.max(0, Number(e.target.value))
                        setForm(f => ({ ...f, babies: val }))
                        if (selectedAccommodationIds[0]) {
                          setRoomGuestsMap(prev => ({
                            ...prev,
                            [selectedAccommodationIds[0]]: {
                              ...(prev[selectedAccommodationIds[0]] || { adults: 2, children: 0, babies: 0 }),
                              babies: val
                            }
                          }))
                        }
                      }}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-[#C5A059]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">🐾 Mascotas</label>
                    <input
                      type="number"
                      min={0}
                      value={form.pets}
                      onChange={e => setForm(f => ({ ...f, pets: Math.max(0, Number(e.target.value)) }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-[#C5A059]"
                    />
                  </div>
                </div>
              )}

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
                  <label htmlFor="useCustomRate" className="text-xs font-bold text-gray-700 cursor-pointer">
                    Tarifa Especial / Descuento Manual
                  </label>
                </div>

                {useCustomRate && (
                  <div className="space-y-3 pt-2 border-t border-gray-200/40 animate-fade-in">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">
                          Descuento (%)
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={discountPercent}
                          onChange={e => setDiscountPercent(Number(e.target.value))}
                          placeholder="Ej. 10"
                          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#C5A059] bg-white font-medium"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">
                          Total Cobrado (USD)
                        </label>
                        <input
                          type="number"
                          value={calculatedTotal}
                          onChange={e => {
                            setDiscountPercent(0)
                            setForm(f => ({ ...f, totalAmount: Number(e.target.value) }))
                          }}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#C5A059] bg-white font-bold text-gray-800"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-center text-sm font-extrabold text-gray-900 pt-2 border-t border-gray-100">
                  <span>Monto Total a Pagar:</span>
                  <span className="text-base text-[#C5A059]">${calculatedTotal} USD</span>
                </div>
              </div>

              {/* Registro de Abono Inicial */}
              <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100 space-y-3">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">
                  Abono o Pago Inicial (Opcional)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Monto Abonado (USD)</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="0.00"
                      value={form.amountPaid || ''}
                      onChange={e => setForm(f => ({ ...f, amountPaid: Number(e.target.value) }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#C5A059] bg-white font-medium"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Fecha del Abono</label>
                    <input
                      type="date"
                      value={form.paymentDate}
                      onChange={e => setForm(f => ({ ...f, paymentDate: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#C5A059] bg-white font-medium"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Método de Pago</label>
                    <select
                      value={form.paymentMethod}
                      onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value as any }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#C5A059] bg-white font-medium"
                    >
                      <option value="transferencia">Transferencia Bancaria</option>
                      <option value="pago_movil">Pago Móvil</option>
                      <option value="zelle">Zelle</option>
                      <option value="efectivo">Efectivo (USD)</option>
                      <option value="tarjeta">Punto de Venta / Tarjeta</option>
                    </select>
                  </div>
                </div>

                {/* Cobro en bolivares para el abono inicial */}
                <CobroEnBolivares
                  value={abonoInicialBs}
                  onChange={setAbonoInicialBs}
                  onUsdCalculated={usd => setForm(f => ({ ...f, amountPaid: usd }))}
                  bcvRate={bcvEuro}
                  usdTarget={Number(form.amountPaid) || 0}
                />
              </div>

              {/* Referencia de pago */}
              {(form.paymentMethod === 'transferencia' || form.paymentMethod === 'zelle' || form.paymentMethod === 'pago_movil') && (
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">
                    Código de Pago / Referencia {form.paymentMethod === 'zelle' ? '(Zelle)' : form.paymentMethod === 'pago_movil' ? '(Pago Móvil)' : '(Transferencia)'}
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
                  placeholder="Agrega aquí cualquier solicitud especial."
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
                  (Number(form.adults) + Number(form.children)) === 0 ||
                  bookings.some(b => selectedAccommodationIds.includes(b.accommodationId) && form.checkIn < b.checkOut && form.checkOut > b.checkIn) ||
                  (selectedAccommodationIds.reduce((sum, id) => sum + getMaxCapacity(id), 0) > 0 &&
                    (Number(form.adults) + Number(form.children)) > selectedAccommodationIds.reduce((sum, id) => sum + getMaxCapacity(id), 0)) ||
                  (selectedAccommodationIds.length > 1 && selectedAccommodationIds.some(id => {
                    const r = roomGuestsMap[id] || { adults: 0, children: 0, babies: 0 }
                    const cap = getMaxCapacity(id)
                    return (r.adults + r.children === 0) || (cap > 0 && (r.adults + r.children) > cap)
                  }))
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
