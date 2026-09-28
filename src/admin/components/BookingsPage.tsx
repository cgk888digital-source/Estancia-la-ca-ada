import { useState, useMemo, useEffect } from 'react'
import {
  Calendar, Users, Check, LogIn, LogOut, Search, Plus, X,
  RefreshCw, Printer
} from 'lucide-react'
import { accommodationOptions, activeAccommodationOptions, getMaxCapacity } from '../../data/accommodations'
import LoadErrorBanner from './LoadErrorBanner'
import { repartirNoches, precioEstancia } from '../../utils/seasonNights'
import { supabase } from '../../lib/supabase'
import type { Booking } from '../types'
import PrintableReservationsReport from './PrintableReservationsReport'
import { parseLocalDate, fechaLocalISO as formatLocalDate } from '../../utils/dateUtils'
import { getBcvEuroRate } from '../../utils/exchangeRate'
import { useHotelSettings, getMealRates } from '../../utils/useHotelSettings'
import AddBookingModal from './AddBookingModal'
import BookingDetailModal from './BookingDetailModal'
import BookingsWeekView from './BookingsWeekView'

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

interface DbAccommodation {
  id: number | string
  price: number | string
  december_price: number | string
  discount_percent?: number | string | null
}

const todayDate = new Date()
const todayStr = formatLocalDate(todayDate)
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
  paymentMethod: (db.payment_method || 'transferencia') as 'efectivo' | 'transferencia' | 'tarjeta' | 'cheque' | 'zelle' | 'pago_movil',
  paymentReference: db.payment_reference || '',
  status: (db.status || 'confirmado') as 'checkout_hoy' | 'checkin_hoy' | 'ocupado' | 'confirmado' | 'limpieza',
  confirmed: db.confirmed ?? true,
  specialNotes: db.special_notes || '',
  locator: db.locator || ''
})

const getBookingDiscountPercent = (notes?: string) => {
  const matches = [...(notes || '').matchAll(/descuento(?:\s+aplicado)?(?:\s+(?:del|de))?\s*:?\s*(\d+(?:[.,]\d+)?)\s*%/gi)]
  const lastMatch = matches.at(-1)
  if (!lastMatch) return 0
  const value = Number(lastMatch[1].replace(',', '.'))
  return Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0
}

const getBookingFixedDiscountAmount = (notes?: string) => {
  const matches = [...(notes || '').matchAll(/Descuento fijo aplicado:\s*USD\s*(\d+(?:[.,]\d+)?)/gi)]
  const lastMatch = matches.at(-1)
  if (!lastMatch) return 0
  const value = Number(lastMatch[1].replace(',', '.'))
  return Number.isFinite(value) ? Math.max(0, value) : 0
}

const getAdjustedBookingTotal = (standardTotal: number, notes?: string) => {
  const percent = getBookingDiscountPercent(notes)
  const fixedAmount = getBookingFixedDiscountAmount(notes)
  const afterPercent = standardTotal * (1 - percent / 100)
  return Math.max(0, Math.round((afterPercent - fixedAmount) * 100) / 100)
}

// Paleta calcada de Paxer: Reservado (azul cielo) → Sin pago (azul) → Pago parcial (naranja) → Pagado (verde)
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
  const [loadError, setLoadError] = useState<string | null>(null)
  const [monthPage, setMonthPage] = useState(1)
  const PAGE_SIZE = 20
  const [activeTab, setActiveTab] = useState<'dia' | 'semana' | 'mes'>('dia')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)

  const [bcvEuro, setBcvEuro] = useState<number | null>(null)
  const [monthAnchor, setMonthAnchor] = useState(() => new Date(todayDate.getFullYear(), todayDate.getMonth(), 1))
  const [mesMode, setMesMode] = useState<'mes' | 'personalizado'>('mes')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  // Modals
  const [showAddModal, setShowAddModal] = useState(false)
  const [addModalInitialAccId, setAddModalInitialAccId] = useState<number | undefined>(undefined)
  const [addModalInitialCheckIn, setAddModalInitialCheckIn] = useState<string | undefined>(undefined)
  const [addModalInitialCheckOut, setAddModalInitialCheckOut] = useState<string | undefined>(undefined)
  const [dbAccommodations, setDbAccommodations] = useState<DbAccommodation[]>([])

  const openAddModal = (accId?: number, checkIn?: string, checkOut?: string) => {
    setAddModalInitialAccId(accId)
    setAddModalInitialCheckIn(checkIn)
    setAddModalInitialCheckOut(checkOut)
    setShowAddModal(true)
  }

  const closeAddModal = () => {
    setShowAddModal(false)
  }

  // Accommodation lookup helper
  const getAccommodation = (id: number) => accommodationOptions.find(o => o.id === id)

  const getBookingGroup = (booking: Booking) => booking.locator
    ? bookings.filter(item => item.locator === booking.locator)
    : [booking]

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

  const { settings: hotelSettings } = useHotelSettings()
  const mealRates = getMealRates(hotelSettings)

  const getStandardRate = (accId: number, checkIn: string, checkOut: string, adults: number, children: number) => {
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
      const acc = accommodationOptions.find(o => o.id === accId)
      if (!acc) return 0
      precioNormal = acc.price
      precioNavideno = acc.price
      if (accId === 1 || accId === 6 || accId === 7 || accId === 50 || accId === 51 || accId === 52) precioNavideno = 190
      else if (accId === 2 || accId === 4) precioNavideno = 344
      else if (accId >= 30 && accId <= 35) precioNavideno = 78
      else if (accId >= 36 && accId <= 41) precioNavideno = 86
    }

    return precioEstancia(
      noches,
      { normal: precioNormal, navidena: precioNavideno },
      { adulto: mealRates.perAdult, adultoNavideno: mealRates.perAdultNavidad, nino: mealRates.perChild },
      adults,
      children
    ).total
  }

  useEffect(() => {
    let active = true

    const fetchBookings = async () => {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const cutoffDate = thirtyDaysAgo.toISOString().substring(0, 10)

      const [accommodationsResult, bookingsResult] = await Promise.all([
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
        console.error('No se pudieron cargar las tarifas de accommodations:', accommodationsResult.error)
      }

      const { data, error } = bookingsResult
      if (!active) return

      if (error) {
        console.error('Error fetching bookings from Supabase:', error)
        setLoadError(error.message)
      } else {
        setLoadError(null)
        setBookings((data || []).map(mapDbBookingToReact))
      }
    }

    fetchBookings()

    getBcvEuroRate()
      .then(tasa => { if (active && tasa > 0) setBcvEuro(tasa) })
      .catch(() => {})

    return () => {
      active = false
    }
  }, [])

  // 1. Dynamic states calculation for TODAY's Day View
  const cabinStatesToday = useMemo(() => {
    return activeAccommodationOptions.map(acc => {
      const accId = Number(acc.id)
      const accBookings = bookings.filter(b => Number(b.accommodationId) === accId)

      const cleaningBooking = accBookings.find(b => b.status === 'limpieza')
      if (cleaningBooking) {
        return {
          accommodation: acc,
          booking: cleaningBooking,
          status: 'limpieza' as const
        }
      }

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

      const checkinBooking = accBookings.find(b => b.checkIn === todayStr)
      if (checkinBooking) {
        const isOccupied = checkinBooking.status === 'ocupado'
        return {
          accommodation: acc,
          booking: checkinBooking,
          status: (isOccupied ? 'ocupado' : 'checkin_hoy') as 'ocupado' | 'checkin_hoy'
        }
      }

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

      return {
        accommodation: acc,
        booking: null,
        status: 'disponible' as const
      }
    })
  }, [bookings])

  const monthAnchorLabel = useMemo(() => {
    const label = monthAnchor.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
    return label.charAt(0).toUpperCase() + label.slice(1)
  }, [monthAnchor])

  // Filters and Search Results
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

  // "Mes" tab list
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
      ? 'Vista Semanal'
      : mesMode === 'personalizado'
        ? `Del ${customFrom || '—'} al ${customTo || '—'}`
        : `Mes de ${monthAnchorLabel}`

  const totalMonthlyRevenue = useMemo(() => {
    return monthListBookings.reduce((s, b) => s + b.totalAmount, 0)
  }, [monthListBookings])

  const stats = useMemo(() => {
    const totalCabins = activeAccommodationOptions.length
    
    const checkins = bookings.filter(
      b => b.checkIn === todayStr && b.status !== 'ocupado'
    ).length

    const checkouts = bookings.filter(
      b => b.checkOut === todayStr && b.status !== 'limpieza' && b.status !== 'checkout_hoy'
    ).length

    const cleaning = cabinStatesToday.filter(c => c.status === 'limpieza').length

    const activeAccIdSet = new Set(activeAccommodationOptions.map(a => Number(a.id)))
    const occupiedCabinIds = new Set(
      bookings
        .filter(b => activeAccIdSet.has(Number(b.accommodationId)) && todayStr >= b.checkIn && todayStr < b.checkOut)
        .map(b => Number(b.accommodationId))
    )
    const occupiedCount = occupiedCabinIds.size
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

      const { error: movePaymentsError } = await supabase
        .from('booking_payments')
        .update({ booking_id: paymentTarget.id })
        .eq('booking_id', bookingId)

      if (movePaymentsError) {
        console.error('No se pudieron trasladar los abonos de la habitación:', movePaymentsError)
        alert('No se pudo conservar correctamente el historial de abonos. No se anuló la habitación.')
        return
      }

      const normalizedPaidTotal = Math.round(groupPaidTotal * 100) / 100
      const groupTotal = remainingBookings.reduce((sum, room) => sum + room.totalAmount, 0)
      const paymentStatus: Booking['paymentStatus'] = normalizedPaidTotal >= groupTotal
        ? 'completo'
        : normalizedPaidTotal > 0 ? 'parcial' : 'pendiente'

      await Promise.all(remainingBookings.map((room, index) => supabase
        .from('bookings')
        .update({ amount_paid: index === 0 ? normalizedPaidTotal : 0, payment_status: paymentStatus })
        .eq('id', room.id)
      ))

      const { error: deleteRoomError } = await supabase.from('bookings').delete().eq('id', bookingId)
      if (deleteRoomError) {
        console.error('Error deleting room from group booking:', deleteRoomError)
        alert('No se pudo anular la habitación.')
        return
      }

      setBookings(prev => prev.filter(room => room.id !== bookingId).map(room => {
        if (room.id === paymentTarget.id) {
          return { ...room, amountPaid: normalizedPaidTotal, paymentStatus }
        }
        if (remainingBookings.some(r => r.id === room.id)) {
          return { ...room, amountPaid: 0, paymentStatus }
        }
        return room
      }))
      setSelectedBooking(null)
      return
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

  const reassignBooking = async (
    bookingId: string,
    newAccId: number,
    newCheckIn: string,
    newCheckOut: string,
    guestsOverride?: { adults: number; children: number; babies: number; pets: number }
  ) => {
    const booking = bookings.find(b => b.id === bookingId)
    if (!booking) return false

    const adults = guestsOverride ? guestsOverride.adults : booking.guestsCount.adults
    const children = guestsOverride ? guestsOverride.children : booking.guestsCount.children
    const babies = guestsOverride ? guestsOverride.babies : booking.guestsCount.babies
    const pets = guestsOverride ? guestsOverride.pets : booking.guestsCount.pets
    const totalGuests = adults + children

    if (newAccId !== booking.accommodationId || guestsOverride) {
      const maxCapacity = getMaxCapacity(newAccId)
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

    const newStandardTotal = getStandardRate(
      newAccId,
      newCheckIn,
      newCheckOut,
      adults,
      children
    )
    const newTotalAmount = getAdjustedBookingTotal(newStandardTotal, booking.specialNotes)
    const newPaymentStatus: Booking['paymentStatus'] = booking.amountPaid >= newTotalAmount
      ? 'completo'
      : booking.amountPaid > 0
        ? 'parcial'
        : 'pendiente'

    const updatePayload: Record<string, any> = {
      accommodation_id: newAccId,
      check_in: newCheckIn,
      check_out: newCheckOut,
      total_amount: newTotalAmount,
      payment_status: newPaymentStatus
    }
    if (guestsOverride) {
      updatePayload.adults = adults
      updatePayload.children = children
      updatePayload.babies = babies
      updatePayload.pets = pets
    }

    const { error } = await supabase
      .from('bookings')
      .update(updatePayload)
      .eq('id', bookingId)

    if (error) {
      console.error('Error reassigning booking:', error)
      alert('Error al actualizar la reserva. Intenta de nuevo.')
      return false
    }

    const updatedFields: Partial<Booking> = {
      accommodationId: newAccId,
      checkIn: newCheckIn,
      checkOut: newCheckOut,
      totalAmount: newTotalAmount,
      paymentStatus: newPaymentStatus
    }
    if (guestsOverride) {
      updatedFields.guestsCount = { adults, children, babies, pets }
    }
    setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, ...updatedFields } : b))
    setSelectedBooking(prev => prev && prev.id === bookingId ? { ...prev, ...updatedFields } : prev)
    return true
  }

  return (
    <>
    <div className="space-y-8 print:hidden">
      {/* 1. Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase tracking-widest text-[#C5A059] font-extrabold block mb-1">
            Recepción & Administración
          </span>
          <h1 className="text-3xl font-bold font-serif text-gray-800">Control de Ocupación</h1>
          <p className="text-xs text-gray-400 mt-1">
            Visualiza el estatus de las cabañas y habitaciones en tiempo real.
          </p>
        </div>

        {/* Action Button: Open Create Booking Modal */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-700 px-4 py-3 rounded-2xl border border-gray-200 text-xs font-bold uppercase tracking-wider transition-all active:scale-95 shadow-sm"
            title="Descargar o imprimir reporte de ocupación"
          >
            <Printer size={15} />
            <span className="hidden sm:inline">Descargar PDF</span>
          </button>
          <button
            onClick={() => openAddModal()}
            className="flex items-center gap-2 bg-[#C5A059] hover:bg-[#b08d48] text-white px-5 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all active:scale-95 shadow-lg shadow-[#C5A059]/20"
          >
            <Plus size={16} />
            <span>Nueva Reserva</span>
          </button>
        </div>
      </div>

      <LoadErrorBanner message={loadError} />

      {/* 2. Key Metrics Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Occupancy Card */}
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Ocupación Hoy 🌙</span>
          <div className="mt-3 flex items-baseline gap-1">
            <span className="text-3xl font-extrabold text-gray-800">{stats.occupancyRate}%</span>
          </div>
          <span className="text-[10px] text-gray-400 mt-2 block font-medium">Huéspedes esta noche</span>
        </div>

        {/* Check-ins Today Card */}
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Check-Ins Pendientes 📥</span>
          <div className="mt-3 flex items-baseline gap-1">
            <span className="text-3xl font-extrabold text-amber-500">{stats.checkins}</span>
            <span className="text-xs text-gray-400">llegadas</span>
          </div>
          <span className="text-[10px] text-gray-400 mt-2 block font-medium">Esperados el día de hoy</span>
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
            const conf = statusConfig[status] || statusConfig.disponible
            let badgeBg = conf.bg
            
            if (status === 'disponible') {
              badgeBg = 'bg-emerald-50 text-emerald-800 border-emerald-200 shadow-sm'
            } else if (status === 'checkin_hoy') {
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
                <div className="relative h-44 w-full bg-gray-100 overflow-hidden flex-none">
                  <img
                    src={accommodation.image}
                    alt={accommodation.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                  
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

                <div className="p-6 flex-1 flex flex-col justify-between gap-6">
                  {booking ? (
                    <div
                      className="space-y-4 cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => setSelectedBooking(booking)}
                      title="Clic para ver detalles de la reserva"
                    >
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
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Entrada</span>
                          <span className="font-semibold text-gray-700 mt-0.5 block">{booking.checkIn}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Salida</span>
                          <span className="font-semibold text-gray-700 mt-0.5 block">{booking.checkOut}</span>
                        </div>
                      </div>

                      {booking.specialNotes && (
                        <div className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-100/60 text-[11px] text-amber-900 leading-relaxed font-sans">
                          <span className="font-bold block uppercase text-[9px] tracking-wider text-amber-700/80 mb-0.5">Notas especiales:</span>
                          {booking.specialNotes}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="py-6 text-center text-gray-300">
                      <Check size={28} className="mx-auto mb-2 text-emerald-400" />
                      <p className="text-xs font-medium text-gray-400">Cabaña lista y disponible</p>
                    </div>
                  )}

                  <div className="pt-4 border-t border-gray-100 flex gap-2">
                    {status === 'checkin_hoy' && booking && (
                      <div className="flex gap-2 w-full">
                        <button
                          onClick={() => setSelectedBooking(booking)}
                          className="flex-1 py-3 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 font-bold rounded-xl text-xs uppercase tracking-wider transition-all active:scale-95 shadow-sm"
                        >
                          Ver Ficha
                        </button>
                        <button
                          onClick={() => handleCheckIn(booking.id)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all active:scale-95 shadow-sm"
                        >
                          <LogIn size={14} /> Registrar Entrada
                        </button>
                      </div>
                    )}

                    {status === 'checkout_hoy' && booking && (
                      <div className="flex gap-2 w-full">
                        <button
                          onClick={() => setSelectedBooking(booking)}
                          className="flex-1 py-3 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 font-bold rounded-xl text-xs uppercase tracking-wider transition-all active:scale-95 shadow-sm"
                        >
                          Ver Ficha
                        </button>
                        <button
                          onClick={() => handleCheckOut(booking.id)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all active:scale-95 shadow-sm"
                        >
                          <LogOut size={14} /> Registrar Salida
                        </button>
                      </div>
                    )}

                    {status === 'ocupado' && booking && (
                      <button
                        onClick={() => setSelectedBooking(booking)}
                        className={`w-full py-3 font-bold rounded-xl text-xs uppercase tracking-wider transition-all border shadow-sm ${getBookingPaymentColors(booking).badge}`}
                      >
                        Ver Detalles
                      </button>
                    )}

                    {status === 'limpieza' && (
                      <button
                        onClick={() => handleMarkClean(accommodation.id)}
                        className="w-full flex items-center justify-center gap-1.5 py-3 bg-white hover:bg-gray-50 text-rose-700 border border-rose-200 font-bold rounded-xl text-xs uppercase tracking-wider transition-all active:scale-95 shadow-sm"
                      >
                        <RefreshCw size={14} /> Marcar como Limpia
                      </button>
                    )}

                    {status === 'disponible' && (
                      <button
                        onClick={() => openAddModal(accommodation.id)}
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

      {/* TAB B: SEMANA VIEW (Encapsulated Component) */}
      {activeTab === 'semana' && (
        <BookingsWeekView
          bookings={bookings}
          todayStr={todayStr}
          todayDate={todayDate}
          onSelectBooking={(b) => setSelectedBooking(b)}
          onOpenAddModalWithDates={(accId, checkIn, checkOut) => openAddModal(accId, checkIn, checkOut)}
          reassignBooking={reassignBooking}
          getBookingPaymentColors={getBookingPaymentColors}
        />
      )}

      {/* TAB C: MES VIEW */}
      {activeTab === 'mes' && (
        <div className="space-y-6">
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

      {/* 5. SIDE DRAWER MODAL: Detailed Booking Information Card (Encapsulated Component) */}
      <BookingDetailModal
        selectedBooking={selectedBooking}
        onClose={() => setSelectedBooking(null)}
        bookings={bookings}
        setBookings={setBookings}
        setSelectedBooking={setSelectedBooking}
        dbAccommodations={dbAccommodations}
        bcvEuro={bcvEuro}
        mealRates={mealRates}
        todayStr={todayStr}
        onCheckIn={handleCheckIn}
        onCheckOut={handleCheckOut}
        onDeleteBooking={handleDeleteBooking}
      />

      {/* 6. CREATE BOOKING MODAL (Administrador Form - Encapsulated Component) */}
      <AddBookingModal
        isOpen={showAddModal}
        onClose={closeAddModal}
        bookings={bookings}
        dbAccommodations={dbAccommodations}
        bcvEuro={bcvEuro}
        mealRates={mealRates}
        initialAccId={addModalInitialAccId}
        initialCheckIn={addModalInitialCheckIn}
        initialCheckOut={addModalInitialCheckOut}
        onBookingCreated={(newBookings) => {
          setBookings(prev => [...newBookings, ...prev])
        }}
      />
    </div>

    <PrintableReservationsReport 
      bookings={filteredBookings} 
      dateText={reportDateText}
    />
    </>
  )
}
