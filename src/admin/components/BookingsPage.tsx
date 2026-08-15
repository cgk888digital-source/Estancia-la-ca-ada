import { useState, useMemo, useEffect, useRef } from 'react'
import {
  Calendar, Users, Check, LogIn, LogOut, Trash2, Search, Plus, X, Phone, Mail,
  Info, Baby, Sparkles, RefreshCw, Printer
} from 'lucide-react'
import { accommodationOptions, activeAccommodationOptions, getMaxCapacity } from '../../data/accommodations'
import { mockBookings } from '../data/mockBookings'
import { supabase } from '../../lib/supabase'
import type { Booking, BookingPayment } from '../types'
import PrintableReservationsReport from './PrintableReservationsReport'
import { parseLocalDate } from '../../utils/dateUtils'
import { syncMarketingCustomer } from '../../utils/syncMarketingCustomer'
import { useHotelSettings, getMealRates } from '../../utils/useHotelSettings'
import { sendBookingConfirmationEmail } from '../../utils/sendBookingConfirmationEmail'

// Helper to format currency
const fmt = (n: number) =>
  new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

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
}

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
  const [monthPage, setMonthPage] = useState(1)
  const PAGE_SIZE = 20
  const [activeTab, setActiveTab] = useState<'dia' | 'semana' | 'mes'>('dia')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [editingAccommodation, setEditingAccommodation] = useState(false)
  const [editingDates, setEditingDates] = useState(false)
  const [editDatesForm, setEditDatesForm] = useState({ checkIn: '', checkOut: '' })
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

  // Modals
  const [showAddModal, setShowAddModal] = useState(false)

  // Custom rate states for manual bookings
  const [useCustomRate, setUseCustomRate] = useState(false)
  const [discountPercent, setDiscountPercent] = useState(0)
  const [locatorCode, setLocatorCode] = useState('')
  const [dbAccommodations, setDbAccommodations] = useState<DbAccommodation[]>([])
  
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

  // Desayuno + cena por noche, configurables desde Tarifas y Descuentos.
  const { settings: hotelSettings } = useHotelSettings()
  const mealRates = getMealRates(hotelSettings)

  const getStandardRate = (accId: number, checkIn: string, checkOut: string, adults: number, children: number) => {
    const nights = calculateNights(checkIn, checkOut)
    const d = parseLocalDate(checkIn)
    // Temporada navideña Dic 21 - Ene 07 (mismo criterio que la app del huésped, verificado en Paxer).
    const isDecember = (d.getMonth() === 11 && d.getDate() >= 21) || (d.getMonth() === 0 && d.getDate() <= 7)

    const dbAcc = dbAccommodations.find(o => Number(o.id) === accId)
    let roomPrice: number
    if (dbAcc) {
      const basePrice = isDecember ? Number(dbAcc.december_price) : Number(dbAcc.price)
      const discount = Number(dbAcc.discount_percent || 0)
      roomPrice = discount > 0 ? Math.round(basePrice * (1 - discount / 100)) : basePrice
    } else {
      // Fallback con las tarifas navideñas del grid de Paxer.
      const acc = accommodationOptions.find(o => o.id === accId)
      if (!acc) return 0
      roomPrice = acc.price
      if (isDecember) {
        if (accId === 1 || accId === 6 || accId === 7 || accId === 50 || accId === 51 || accId === 52) roomPrice = 196
        else if (accId === 2 || accId === 4) roomPrice = 350
        else if (accId >= 30 && accId <= 35) roomPrice = 84 // Galería La Manita
        else if (accId >= 36 && accId <= 41) roomPrice = 92 // Galería Llano Grande
      }
    }
    
    const mealsPrice = (adults * mealRates.perAdult) + (children * mealRates.perChild)
    return (roomPrice + mealsPrice) * nights
  }

  // Helper functions to open/close the manual booking modal safely
  const openAddModal = () => {
    setUseCustomRate(false)
    setDiscountPercent(0)
    
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
    ? getStandardRate(form.accommodationId, form.checkIn, form.checkOut, form.adults, form.children)
    : 0

  const calculatedTotal = useCustomRate
    ? (discountPercent > 0 ? Math.round(standardRate * (1 - discountPercent / 100)) : form.totalAmount)
    : standardRate

  // Autocomplete effect
  useEffect(() => {
    if (!shouldShowGuestSuggestions) return

    const timer = setTimeout(async () => {
      // Busca coincidencias tanto por nombre como por apellido, para que la administradora
      // pueda encontrar al huésped aunque solo recuerde uno de los dos.
      const terms = [form.guestFirstName, form.guestLastName].filter(t => t.trim().length >= 2)
      if (terms.length === 0) return
      const orFilter = terms.map(t => `guest_name.ilike.%${t}%`).join(',')
      const { data } = await supabase
        .from('bookings')
        .select('guest_name, guest_phone, guest_email')
        .or(orFilter)
        .limit(10)

      if (data) {
        const unique = new Map<string, GuestSuggestion>()
        data.forEach(d => {
          if (!unique.has(d.guest_name)) {
            unique.set(d.guest_name, { name: d.guest_name, phone: d.guest_phone, email: d.guest_email })
          }
        })
        setGuestSuggestions(Array.from(unique.values()))
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [form.guestFirstName, form.guestLastName, shouldShowGuestSuggestions])

  // Al soltar el mouse tras seleccionar un rango de días vacíos en la Semana, abre
  // "Nueva Reserva" con el check-in/check-out ya llenos según lo seleccionado.
  useEffect(() => {
    if (!rangeSelect) return

    const handleMouseUp = () => {
      const [fromStr, toStr] = rangeSelect.startDateStr <= rangeSelect.endDateStr
        ? [rangeSelect.startDateStr, rangeSelect.endDateStr]
        : [rangeSelect.endDateStr, rangeSelect.startDateStr]
      const checkOutStr = formatLocalDate(addDays(parseLocalDate(toStr), 1))

      openAddModal()
      setForm(f => ({ ...f, accommodationId: rangeSelect.accId, checkIn: fromStr, checkOut: checkOutStr }))
      setRangeSelect(null)
    }

    window.addEventListener('mouseup', handleMouseUp)
    return () => window.removeEventListener('mouseup', handleMouseUp)
  }, [rangeSelect])

  // Carga el historial de abonos cada vez que se abre la ficha de una reserva.
  useEffect(() => {
    let active = true

    const loadPayments = async () => {
      if (!selectedBooking) {
        setBookingPayments([])
        return
      }
      setLoadingPayments(true)
      const { data, error } = await supabase
        .from('booking_payments')
        .select('*')
        .eq('booking_id', selectedBooking.id)
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
  }, [selectedBooking?.id])

  const dragOverCellRef = useRef<string | null>(null)
  // Un simple click siempre dispara mousedown + mouseup, casi nunca con el mouse 100%
  // quieto — sin este umbral, ese jitter mínimo se leía como "mover la reserva a la celda
  // vecina" y corría las fechas al abrir la ficha con solo hacer click.
  const dragStartPosRef = useRef<{ x: number; y: number } | null>(null)
  const hasDraggedRef = useRef(false)
  const DRAG_THRESHOLD_PX = 6

  useEffect(() => {
    let active = true

    const fetchBookings = async () => {
      // Build a 30-day-ago cutoff so we only fetch current & recent bookings
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const cutoffDate = thirtyDaysAgo.toISOString().substring(0, 10)

      // Run both queries in parallel for faster loading
      const [accommodationsResult, bookingsResult] = await Promise.all([
        supabase
          .from('accommodations')
          .select('id, name, price, december_price, discount_percent, capacity, type'),
        supabase
          .from('bookings')
          .select('*')
          .gte('check_out', cutoffDate)
          .order('created_at', { ascending: false })
      ])

      if (active && accommodationsResult.data) {
        setDbAccommodations(accommodationsResult.data)
      }

      const { data, error } = bookingsResult

      if (!active) return

      if (error) {
        console.error('Error fetching bookings from Supabase:', error)
        setBookings(mockBookings)
      } else if (data && data.length > 0) {
        setBookings(data.map(mapDbBookingToReact))
      } else {
        setBookings([])
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

  const handleDeleteBooking = async (bookingId: string) => {
    if (confirm('¿Estás segura de que deseas eliminar esta reserva?')) {
      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', bookingId)

      if (error) {
        console.error('Error deleting booking:', error)
      } else {
        setBookings(prev => prev.filter(b => b.id !== bookingId))
      }
      setSelectedBooking(null)
    }
  }

  // Suma todos los abonos de una reserva y actualiza el monto/estatus de pago de la reserva
  // para que "Monto Abonado" siempre refleje la suma real del historial de pagos.
  const syncBookingPaidAmount = async (booking: Booking, payments: BookingPayment[]) => {
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)
    const paymentStatus = totalPaid >= booking.totalAmount ? 'completo' : totalPaid > 0 ? 'parcial' : 'pendiente'

    const { error } = await supabase
      .from('bookings')
      .update({ amount_paid: totalPaid, payment_status: paymentStatus })
      .eq('id', booking.id)

    if (error) {
      console.error('Error syncing booking paid amount:', error)
      return
    }

    setBookings(prev => prev.map(b => b.id === booking.id ? { ...b, amountPaid: totalPaid, paymentStatus } : b))
    setSelectedBooking(prev => prev && prev.id === booking.id ? { ...prev, amountPaid: totalPaid, paymentStatus } : prev)
  }

  const handleAddPayment = async () => {
    if (!selectedBooking) return
    const amount = Number(paymentForm.amount)
    if (!amount || amount <= 0) {
      alert('Error: ingresa un monto de abono válido.')
      return
    }

    const newPayment = {
      booking_id: selectedBooking.id,
      payment_date: paymentForm.date,
      amount,
      currency: 'USD',
      method: paymentForm.method,
      reference: paymentForm.reference.trim() || null,
      status: 'verificado'
    }

    const { data, error } = await supabase
      .from('booking_payments')
      .insert([newPayment])
      .select('*')

    if (error || !data) {
      console.error('Error adding payment:', error)
      alert('Error al registrar el abono. Intenta de nuevo.')
      return
    }

    const updatedPayments = [...bookingPayments, mapDbPaymentToReact(data[0])]
      .sort((a, b) => a.paymentDate.localeCompare(b.paymentDate))
    setBookingPayments(updatedPayments)
    await syncBookingPaidAmount(selectedBooking, updatedPayments)

    setAddingPayment(false)
    setPaymentForm({ amount: '', date: todayStr, method: 'transferencia', reference: '' })
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

    const updatedPayments = bookingPayments.filter(p => p.id !== payment.id)
    setBookingPayments(updatedPayments)
    await syncBookingPaidAmount(selectedBooking, updatedPayments)
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

    const { error } = await supabase
      .from('bookings')
      .update({ accommodation_id: newAccId, check_in: newCheckIn, check_out: newCheckOut })
      .eq('id', bookingId)

    if (error) {
      console.error('Error reassigning booking:', error)
      alert('Error al actualizar la reserva. Intenta de nuevo.')
      return false
    }

    setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, accommodationId: newAccId, checkIn: newCheckIn, checkOut: newCheckOut } : b))
    setSelectedBooking(prev => prev && prev.id === bookingId ? { ...prev, accommodationId: newAccId, checkIn: newCheckIn, checkOut: newCheckOut } : prev)
    return true
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

  // Mover/estirar una reserva existente en la Semana. Usa la posición real del mouse
  // (document.elementsFromPoint) en vez de los eventos nativos de drag&drop de HTML5:
  // así detecta la celda de fecha que está DEBAJO aunque la propia barra la tape
  // visualmente — con drag&drop nativo, encoger una reserva (arrastrar el borde hacia
  // adentro) no soltaba sobre nada porque el mouse quedaba sobre la barra, no la celda.
  useEffect(() => {
    if (!dragInfo) return
    hasDraggedRef.current = false

    const handleMouseMove = (e: MouseEvent) => {
      // Ignora el jitter de un simple click: solo cuenta como arrastre real una vez que
      // el mouse se aleja más de unos pocos píxeles del punto donde se hizo mousedown.
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

    const handleMouseUp = () => {
      const key = dragOverCellRef.current
      const wasRealDrag = hasDraggedRef.current
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
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

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [dragInfo])

  const handleAddBooking = async () => {
    const fullGuestName = `${form.guestFirstName.trim()} ${form.guestLastName.trim()}`.trim()
    if (!fullGuestName) return

    if (form.checkOut <= form.checkIn) {
      alert('Error: La fecha de check-out debe ser posterior a la fecha de check-in.')
      return
    }

    const collision = bookings.find(b => {
      if (b.accommodationId !== Number(form.accommodationId)) return false
      return form.checkIn < b.checkOut && form.checkOut > b.checkIn
    })

    if (collision) {
      alert(`Error: Conflicto de fechas. La cabaña ya está reservada para el huésped "${collision.guestName}" desde el ${collision.checkIn} hasta el ${collision.checkOut}.`)
      return
    }

    const maxCapacity = getMaxCapacity(Number(form.accommodationId))
    const totalGuests = Number(form.adults) + Number(form.children)
    if (maxCapacity > 0 && totalGuests > maxCapacity) {
      alert(`Error: Capacidad excedida. Esta habitación/cabaña admite hasta ${maxCapacity} personas (adultos + niños) y se ingresaron ${totalGuests}.`)
      return
    }

    const finalTotal = useCustomRate
      ? (discountPercent > 0 ? Math.round(standardRate * (1 - discountPercent / 100)) : form.totalAmount)
      : standardRate

    const initialStatus = form.checkIn === todayStr ? 'checkin_hoy' : 'confirmado'
    const newBooking = {
      guest_name: fullGuestName,
      guest_phone: form.guestPhone.trim() || '+58 412-000-0000',
      guest_email: form.guestEmail.trim() || 'cliente@estancialacanada.com',
      guest_ci: form.guestCi.trim() || null,
      companions: form.companions.trim() || null,
      accommodation_id: Number(form.accommodationId),
      check_in: form.checkIn,
      check_out: form.checkOut,
      adults: Number(form.adults),
      children: Number(form.children),
      babies: Number(form.babies),
      pets: Number(form.pets),
      total_amount: finalTotal,
      amount_paid: Number(form.amountPaid),
      payment_status: Number(form.amountPaid) >= finalTotal 
        ? 'completo' 
        : Number(form.amountPaid) > 0 ? 'parcial' : 'pendiente',
      payment_method: form.paymentMethod,
      payment_reference: form.paymentReference.trim() || null,
      status: initialStatus,
      confirmed: true, // reserva creada directamente por el staff, no requiere revisión aparte
      special_notes: form.specialNotes.trim() || null,
      locator: locatorCode
    }

    const { data, error } = await supabase
      .from('bookings')
      .insert([newBooking])
      .select('*')

    if (error) {
      console.error('Error adding booking:', error)
    } else if (data && data[0]) {
      setBookings(prev => [mapDbBookingToReact(data[0]), ...prev])

      // Si se registró un abono inicial, queda como el primer pago del historial.
      if (Number(form.amountPaid) > 0) {
        const { error: paymentError } = await supabase.from('booking_payments').insert([{
          booking_id: data[0].id,
          payment_date: todayStr,
          amount: Number(form.amountPaid),
          currency: 'USD',
          method: form.paymentMethod,
          reference: form.paymentReference.trim() || null,
          status: 'verificado'
        }])
        if (paymentError) console.error('Error adding initial payment:', paymentError)
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

        // Correo automático de confirmación para reservas creadas manualmente por el staff.
        sendBookingConfirmationEmail(supabase, {
          email: form.guestEmail.trim(),
          guestName: fullGuestName,
          locator: locatorCode,
          accommodationTitle: getAccommodation(Number(form.accommodationId))?.title || '',
          checkIn: form.checkIn,
          checkOut: form.checkOut,
          totalAmount: finalTotal,
          amountPaid: Number(form.amountPaid)
        })
      }
    }

    closeAddModal()
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
              badgeBg = getPaymentColorClasses(booking).badge
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
                        className={`w-full py-3 font-bold rounded-xl text-xs uppercase tracking-wider transition-all border ${getPaymentColorClasses(booking).badge}`}
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
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-3 border-b border-gray-100 bg-gray-50/40">
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
          <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-3 border-b border-gray-100 bg-gray-50/40">
            {weekViewMode === 'semana' ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setWeekAnchor(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n })}
                  className="p-1.5 rounded-lg border border-gray-200 hover:bg-white text-gray-500"
                >
                  ←
                </button>
                <span className="text-xs font-bold text-gray-700 min-w-[140px] text-center">{weekRangeLabel}</span>
                <button
                  onClick={() => setWeekAnchor(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n })}
                  className="p-1.5 rounded-lg border border-gray-200 hover:bg-white text-gray-500"
                >
                  →
                </button>
                <button
                  onClick={() => setWeekAnchor(new Date(todayDate))}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-white text-[10px] font-bold text-gray-500 uppercase tracking-wider"
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
          </div>
          <div className="overflow-auto max-h-[70vh]">
            <div className="min-w-fit divide-y divide-gray-100">
              {/* Header row (Dates) — fijo arriba al hacer scroll para siempre ver a qué día corresponde cada columna */}
              <div className="flex bg-gray-50 sticky top-0 z-20 border-b border-gray-100 shadow-sm">
                {/* Cabin column header spacer */}
                <div className="w-24 shrink-0 p-2 font-bold text-[9px] text-gray-400 uppercase tracking-widest flex items-center justify-center border-r border-gray-100 bg-gray-50">
                  Cabaña
                </div>
                {/* Columnas de días (21 en la vista amplia, o las que tenga el rango personalizado) */}
                <div className="flex-1 grid divide-x divide-gray-100" style={{ gridTemplateColumns: `repeat(${weekDays.length}, minmax(40px, 1fr))` }}>
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
                  <div className="w-24 shrink-0 p-2 border-r border-gray-100 flex flex-col justify-center gap-0.5">
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
                    <div className="grid divide-x divide-gray-100 h-10" style={{ gridTemplateColumns: `repeat(${weekDays.length}, minmax(40px, 1fr))` }}>
                      {weekDays.map(day => {
                        // No incluye el estatus de la reserva: así ella siempre ve quién sale ese día,
                        // aunque todavía no haya marcado la limpieza, y aunque otro huésped entre ese mismo día.
                        const isOccupied = rowBookings.some(b => day.dateStr >= b.checkIn && day.dateStr < b.checkOut)
                        const isDragTarget = dragOverCell === `${acc.id}|${day.dateStr}`
                        const isRangeSelected = !!rangeSelect && rangeSelect.accId === acc.id &&
                          day.dateStr >= (rangeSelect.startDateStr <= rangeSelect.endDateStr ? rangeSelect.startDateStr : rangeSelect.endDateStr) &&
                          day.dateStr <= (rangeSelect.startDateStr <= rangeSelect.endDateStr ? rangeSelect.endDateStr : rangeSelect.startDateStr)

                        return (
                          <div
                            key={day.dateStr}
                            data-planner-cell={`${acc.id}|${day.dateStr}`}
                            className={`p-0.5 h-10 flex items-center justify-center relative transition-colors ${isDragTarget || isRangeSelected ? 'bg-[#C5A059]/10' : ''}`}
                          >
                            {!isOccupied && (
                              <button
                                onMouseDown={() => setRangeSelect({ accId: acc.id, startDateStr: day.dateStr, endDateStr: day.dateStr })}
                                onMouseEnter={() => {
                                  setRangeSelect(prev => (prev && prev.accId === acc.id) ? { ...prev, endDateStr: day.dateStr } : prev)
                                }}
                                title="Clic para un día, o arrastra hasta el día de salida"
                                className={`w-full h-full rounded-lg border transition-all flex items-center justify-center group select-none
                                  ${isRangeSelected ? 'border-[#C5A059] bg-[#C5A059]/10 text-[#C5A059]' : 'border-dashed border-gray-100 hover:border-[#C5A059]/40 hover:bg-[#C5A059]/5 text-gray-300 hover:text-[#C5A059]'}`}
                              >
                                <Plus size={11} className="group-hover:scale-110 transition-transform" />
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
                      const colors = getPaymentColorClasses(b)
                      const isBeingDragged = dragInfo?.bookingId === b.id

                      return (
                        <div
                          key={b.id}
                          style={{ left: `calc(${leftPct}% + 2px)`, width: `calc(${widthPct}% - 4px)` }}
                          className={`absolute top-1 bottom-1 rounded-lg border flex items-stretch overflow-hidden ${colors.bg} ${isBeingDragged ? 'opacity-40' : ''}`}
                        >
                          {/* Borde izquierdo: arrastrar para cambiar solo el check-in */}
                          <div
                            onMouseDown={e => { e.preventDefault(); dragStartPosRef.current = { x: e.clientX, y: e.clientY }; setDragInfo({ bookingId: b.id, mode: 'resize-left' }) }}
                            title="Arrastra para cambiar el check-in"
                            className="w-1.5 shrink-0 cursor-ew-resize hover:bg-black/10 transition-colors select-none"
                          />

                          {/* Cuerpo: arrastrar para mover toda la reserva, click (sin arrastrar) para ver detalle */}
                          <button
                            onMouseDown={e => { dragStartPosRef.current = { x: e.clientX, y: e.clientY }; setDragInfo({ bookingId: b.id, mode: 'move' }) }}
                            onClick={() => setSelectedBooking(b)}
                            title="Arrastra para mover la reserva"
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
                            onMouseDown={e => { e.preventDefault(); dragStartPosRef.current = { x: e.clientX, y: e.clientY }; setDragInfo({ bookingId: b.id, mode: 'resize-right' }) }}
                            title="Arrastra para cambiar el check-out"
                            className="w-1.5 shrink-0 cursor-ew-resize hover:bg-black/10 transition-colors select-none"
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
                            <span className={`block text-[9px] font-bold mt-0.5 ${getPaymentColorClasses(b).text}`}>
                              {paymentStateLabels[getEffectivePaymentState(b)].toUpperCase()}
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
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-end p-0 bg-black/40 backdrop-blur-sm">
          {/* Overlay click to close */}
          <div className="absolute inset-0" onClick={() => { setSelectedBooking(null); setEditingAccommodation(false); setEditingDates(false); setAddingPayment(false) }} />
          
          <div className="relative w-full max-w-md h-[90vh] sm:h-screen bg-white rounded-t-3xl sm:rounded-l-3xl sm:rounded-tr-none shadow-2xl p-6 flex flex-col justify-between overflow-y-auto animate-in slide-in-from-bottom sm:slide-in-from-right duration-300">
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
                  <span className={`inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full border text-[9px] font-extrabold uppercase tracking-widest ${getPaymentColorClasses(selectedBooking).badge}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${getPaymentColorClasses(selectedBooking).bullet}`} />
                    {paymentStateLabels[getEffectivePaymentState(selectedBooking)]}
                  </span>
                </div>
                <button
                  onClick={() => { setSelectedBooking(null); setEditingAccommodation(false); setEditingDates(false); setAddingPayment(false) }}
                  className="p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Guest profile card layout */}
              <div className="py-6 space-y-6">
                {/* 1. Guest profile banner */}
                <div className="flex items-center gap-4 bg-gray-50/50 p-4 rounded-3xl border border-gray-100">
                  <div className="w-14 h-14 bg-[#C5A059]/15 text-[#C5A059] border border-[#C5A059]/10 rounded-2xl flex items-center justify-center text-xl font-bold font-serif">
                    {selectedBooking.guestName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-800 leading-tight">{selectedBooking.guestName}</h3>
                    {selectedBooking.guestCi && (
                      <span className="text-[11px] text-gray-400 font-semibold">CI {selectedBooking.guestCi}</span>
                    )}
                    <div className="flex flex-col gap-1 mt-1.5 text-xs text-gray-500">
                      <a href={`tel:${selectedBooking.guestPhone}`} className="flex items-center gap-1 hover:text-[#C5A059]"><Phone size={12} /> {selectedBooking.guestPhone}</a>
                      <a href={`mailto:${selectedBooking.guestEmail}`} className="flex items-center gap-1 hover:text-[#C5A059]"><Mail size={12} /> {selectedBooking.guestEmail}</a>
                    </div>
                  </div>
                </div>

                {/* 2. Cabin detail */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Estadía Asignada</span>
                    {!editingAccommodation && (
                      <button
                        onClick={() => setEditingAccommodation(true)}
                        className="text-[10px] font-bold text-[#C5A059] uppercase tracking-wider hover:underline"
                      >
                        Cambiar
                      </button>
                    )}
                  </div>
                  {editingAccommodation ? (
                    <div className="space-y-2">
                      <select
                        value={selectedBooking.accommodationId}
                        onChange={e => {
                          const newAccId = Number(e.target.value)
                          reassignBooking(selectedBooking.id, newAccId, selectedBooking.checkIn, selectedBooking.checkOut)
                            .then(ok => { if (ok) setEditingAccommodation(false) })
                        }}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-[#C5A059] bg-white"
                      >
                        {activeAccommodationOptions.map(acc => (
                          <option key={acc.id} value={acc.id}>{acc.title} ({acc.type} - Máx. {acc.maxCapacity} pax)</option>
                        ))}
                      </select>
                      <button
                        onClick={() => setEditingAccommodation(false)}
                        className="text-[10px] font-bold text-gray-400 uppercase tracking-wider hover:underline"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (() => {
                    const acc = getAccommodation(selectedBooking.accommodationId)
                    return (
                      <div className="flex items-center gap-3 bg-white p-3 border border-gray-100 rounded-2xl">
                        <img
                          src={acc?.image}
                          alt={acc?.title}
                          className="w-16 h-16 object-cover rounded-xl"
                        />
                        <div>
                          <h4 className="text-sm font-bold text-gray-800">{acc?.title}</h4>
                          <span className="text-[10px] uppercase tracking-widest text-[#C5A059] font-bold block mt-0.5">{acc?.type}</span>
                          <span className="text-[11px] text-gray-400 mt-1 block">Capacidad: {acc?.capacity}</span>
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
                          onClick={() => {
                            if (editDatesForm.checkOut <= editDatesForm.checkIn) {
                              alert('Error: la fecha de check-out debe ser posterior al check-in.')
                              return
                            }
                            reassignBooking(selectedBooking.id, selectedBooking.accommodationId, editDatesForm.checkIn, editDatesForm.checkOut)
                              .then(ok => { if (ok) setEditingDates(false) })
                          }}
                          className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider hover:underline"
                        >
                          Guardar
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
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Lista de Acompañantes</span>
                  <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-gray-600">
                    <div className="flex items-center gap-2">
                      <Users size={16} className="text-gray-400" />
                      <span>{selectedBooking.guestsCount.adults} Adultos</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Baby size={16} className="text-gray-400" />
                      <span>{selectedBooking.guestsCount.children} Niños {selectedBooking.guestsCount.babies > 0 && `(${selectedBooking.guestsCount.babies} bebés)`}</span>
                    </div>
                    {selectedBooking.guestsCount.pets > 0 && (
                      <div className="flex items-center gap-2 col-span-2 text-emerald-700 font-bold">
                        <span>🐾 Traen {selectedBooking.guestsCount.pets} mascota(s)</span>
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
                {selectedBooking.specialNotes && (
                  <div className="bg-amber-500/5 border border-amber-500/10 p-4 rounded-2xl space-y-1.5">
                    <div className="flex items-center gap-1.5 text-amber-800 font-bold text-xs">
                      <Info size={14} /> Notas de la Administración
                    </div>
                    <p className="text-xs text-amber-700/80 leading-relaxed font-medium">
                      "{selectedBooking.specialNotes}"
                    </p>
                  </div>
                )}

                {/* 6. Finanzas */}
                <div className="bg-gray-50/50 p-4 border border-gray-100 rounded-2xl space-y-2">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Estado Financiero</span>
                  <div className="flex justify-between text-xs py-1 border-b border-gray-100/50">
                    <span className="text-gray-500 font-semibold">Costo Total</span>
                    <span className="font-bold text-gray-800">{fmt(selectedBooking.totalAmount)}</span>
                  </div>
                  <div className="flex justify-between text-xs py-1 border-b border-gray-100/50">
                    <span className="text-gray-500 font-semibold">Monto Abonado</span>
                    <span className="font-bold text-emerald-600">{fmt(selectedBooking.amountPaid)}</span>
                  </div>
                  <div className="flex justify-between text-xs py-1 font-bold">
                    <span className="text-gray-800">Saldo Pendiente</span>
                    <span className={selectedBooking.totalAmount - selectedBooking.amountPaid > 0 ? 'text-rose-500' : 'text-emerald-600'}>
                      {fmt(selectedBooking.totalAmount - selectedBooking.amountPaid)}
                    </span>
                  </div>
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

                  {addingPayment && (
                    <div className="space-y-2 pt-2 border-t border-gray-100">
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

              <div className="flex gap-2">
                <button
                  onClick={() => handleDeleteBooking(selectedBooking.id)}
                  className="flex-1 py-3 border border-rose-100 hover:bg-rose-50 text-rose-500 font-bold rounded-2xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
                >
                  <Trash2 size={14} /> Eliminar Reserva
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. CREATE BOOKING MODAL (Administrador Form) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          {/* Overlay click to close */}
          <div className="absolute inset-0" onClick={() => closeAddModal()} />
          
          <div className="relative bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg p-6 space-y-5 overflow-y-auto max-h-[90vh] z-10 animate-in zoom-in-95 duration-200">
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
                            const parts = g.name.trim().split(/\s+/)
                            setForm(f => ({
                              ...f,
                              guestFirstName: parts[0] || '',
                              guestLastName: parts.slice(1).join(' '),
                              guestPhone: g.phone || f.guestPhone,
                              guestEmail: g.email || f.guestEmail
                            }))
                            setShowSuggestions(false)
                          }}
                          className="px-4 py-2 hover:bg-[#C5A059]/10 cursor-pointer flex flex-col gap-0.5 border-b border-gray-50 last:border-0"
                        >
                          <span className="text-xs font-bold text-gray-800">{g.name}</span>
                          {(g.phone || g.email) && (
                            <span className="text-[10px] text-gray-400">
                              {g.phone} {g.phone && g.email && '•'} {g.email}
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
                    placeholder="Nombres y apellidos de los demás huéspedes"
                    value={form.companions}
                    onChange={e => setForm(f => ({ ...f, companions: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-[#C5A059]"
                  />
                </div>
              </div>

              {/* Cabin Assignment */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="col-span-1 sm:col-span-3">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Cabaña Asignada</label>
                  <select
                    value={form.accommodationId}
                    onChange={e => {
                      const id = Number(e.target.value)
                      setForm(f => ({
                        ...f,
                        accommodationId: id
                      }))
                    }}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-[#C5A059] bg-white"
                  >
                    {activeAccommodationOptions.map(acc => {
                      // Muestra el precio vigente de la base de datos (lo que edita "Tarifas y
                      // Descuentos"), no el del catálogo en código — antes quedaba desactualizado.
                      const dbPrice = dbAccommodations.find(o => Number(o.id) === acc.id)?.price
                      return (
                        <option key={acc.id} value={acc.id}>{acc.title} ({acc.type} - ${Number(dbPrice ?? acc.price)}/noche) — Máx. {acc.maxCapacity} pax</option>
                      )
                    })}
                  </select>
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
                const collision = bookings.find(b => {
                  if (b.accommodationId !== Number(form.accommodationId)) return false
                  return form.checkIn < b.checkOut && form.checkOut > b.checkIn
                })
                if (collision) {
                  return (
                    <div className="bg-rose-50 border border-rose-100 text-rose-800 text-xs p-3.5 rounded-2xl flex flex-col gap-0.5 animate-pulse">
                      <span className="font-bold">⚠️ Conflicto de Fechas Encontrado</span>
                      <span>La cabaña ya está reservada por <strong>"{collision.guestName}"</strong> del <strong>{collision.checkIn}</strong> al <strong>{collision.checkOut}</strong>.</span>
                    </div>
                  )
                }
                const maxCapacity = getMaxCapacity(Number(form.accommodationId))
                const totalGuests = Number(form.adults) + Number(form.children)
                if (maxCapacity > 0 && totalGuests > maxCapacity) {
                  return (
                    <div className="bg-rose-50 border border-rose-100 text-rose-800 text-xs p-3.5 rounded-2xl flex flex-col gap-0.5 animate-fade-in">
                      <span className="font-bold">⚠️ Capacidad Excedida</span>
                      <span>Esta habitación/cabaña admite hasta <strong>{maxCapacity} personas</strong> (adultos + niños) y se ingresaron <strong>{totalGuests}</strong>.</span>
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
                  bookings.some(b => b.accommodationId === Number(form.accommodationId) && form.checkIn < b.checkOut && form.checkOut > b.checkIn) ||
                  (getMaxCapacity(Number(form.accommodationId)) > 0 && (Number(form.adults) + Number(form.children)) > getMaxCapacity(Number(form.accommodationId)))
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
