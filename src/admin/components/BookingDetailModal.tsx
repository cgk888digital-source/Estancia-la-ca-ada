import { useState, useEffect, type Dispatch, type SetStateAction } from 'react'
import {
  X, Check, LogIn, LogOut, Trash2, Plus, Phone, Mail,
  Info, Baby, Users, Percent
} from 'lucide-react'
import { accommodationOptions, activeAccommodationOptions, getMaxCapacity } from '../../data/accommodations'
import { supabase } from '../../lib/supabase'
import type { Booking, BookingPayment } from '../types'
import { repartirNoches, precioEstancia } from '../../utils/seasonNights'
import { parseLocalDate } from '../../utils/dateUtils'
import CobroEnBolivares from './CobroEnBolivares'
import { dolaresDeBolivares, textoEnBolivares } from '../../utils/bolivares'
import { useEnvioUnico } from '../../utils/useEnvioUnico'
import { sendBookingVoucherEmail } from '../../utils/sendBookingVoucherEmail'
import { splitPersonName, joinPersonName } from '../../utils/personName'
import { registrarIngresoDeAbono, retirarIngresoDeAbono } from '../../utils/bookingIncome'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-VE', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2
  }).format(n)

const calculateNights = (startStr: string, endStr: string) => {
  if (!startStr || !endStr) return 1
  const start = new Date(startStr)
  const end = new Date(endStr)
  const diffTime = end.getTime() - start.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays > 0 ? diffDays : 1
}

const getBookingDiscountPercent = (notes?: string) => {
  const matches = [...(notes || '').matchAll(/descuento(?:\s+aplicado)?(?:\s+(?:del|de))?\s*:?\s*(\d+(?:[.,]\d+)?)\s*%/gi)]
  const lastMatch = matches.at(-1)
  if (!lastMatch) return 0
  const value = Number(lastMatch[1].replace(',', '.'))
  return Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0
}

const withBookingDiscountNote = (notes: string | undefined, percent: number) => {
  const withoutAppMarker = (notes || '')
    .replace(/\s*Descuento aplicado:\s*\d+(?:[.,]\d+)?%\.?/gi, '')
    .trim()
  return [withoutAppMarker, `Descuento aplicado: ${percent}%.`].filter(Boolean).join(' ')
}

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

const mapDbPaymentToReact = (db: any): BookingPayment => ({
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

const mapDbBookingToReact = (db: any): Booking => ({
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
  paymentMethod: (db.payment_method || 'transferencia') as any,
  paymentReference: db.payment_reference || '',
  status: (db.status || 'confirmado') as any,
  confirmed: db.confirmed ?? true,
  specialNotes: db.special_notes || '',
  locator: db.locator || ''
})

interface DbAccommodation {
  id: number | string
  price: number | string
  december_price: number | string
  discount_percent?: number | string | null
}

interface BookingDetailModalProps {
  selectedBooking: Booking | null
  onClose: () => void
  bookings: Booking[]
  setBookings: Dispatch<SetStateAction<Booking[]>>
  setSelectedBooking: Dispatch<SetStateAction<Booking | null>>
  dbAccommodations: DbAccommodation[]
  bcvEuro: number | null
  mealRates: { perAdult: number; perAdultNavidad: number; perChild: number }
  todayStr: string
  onCheckIn: (bookingId: string) => void
  onCheckOut: (bookingId: string) => void
  onDeleteBooking: (bookingId: string) => void
}

export default function BookingDetailModal({
  selectedBooking,
  onClose,
  bookings,
  setBookings,
  setSelectedBooking,
  dbAccommodations,
  bcvEuro,
  mealRates,
  todayStr,
  onCheckIn,
  onCheckOut,
  onDeleteBooking
}: BookingDetailModalProps) {
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
  const [editDatesForm, setEditDatesForm] = useState({ checkIn: '', checkOut: '' })
  const [editingFinancials, setEditingFinancials] = useState(false)
  const [savingFinancials, setSavingFinancials] = useState(false)
  const [editDiscountPercent, setEditDiscountPercent] = useState(0)
  const [editFixedDiscountAmount, setEditFixedDiscountAmount] = useState(0)
  const [editingNotes, setEditingNotes] = useState(false)
  const [savingNotes, setSavingNotes] = useState(false)
  const [editNotes, setEditNotes] = useState('')

  const [bookingPayments, setBookingPayments] = useState<BookingPayment[]>([])
  const [loadingPayments, setLoadingPayments] = useState(false)
  const [addingPayment, setAddingPayment] = useState(false)
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    date: todayStr,
    method: 'transferencia' as 'transferencia' | 'efectivo' | 'tarjeta' | 'cheque' | 'zelle' | 'pago_movil',
    reference: ''
  })
  const [nuevoAbonoBs, setNuevoAbonoBs] = useState({ activo: false, bolivares: '', tasa: '' })
  const [sendingVoucher, setSendingVoucher] = useState(false)
  const [voucherSentFor, setVoucherSentFor] = useState<string | null>(null)

  const envioAbono = useEnvioUnico()
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

  // Load payments for group
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

  if (!selectedBooking) return null

  const handleSaveGuestDetails = async () => {
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
    if (!editingRoomId) return
    const roomBooking = bookings.find(item => item.id === editingRoomId)
    if (!roomBooking) return

    const totalGuests = editRoomForm.adults + editRoomForm.children
    const maxCapacity = getMaxCapacity(editRoomForm.accommodationId)
    if (maxCapacity > 0 && totalGuests > maxCapacity) {
      alert(`Esta habitación admite hasta ${maxCapacity} personas y se ingresaron ${totalGuests}.`)
      return
    }

    const hasValidEditDates = editingDates && Boolean(editDatesForm.checkIn && editDatesForm.checkOut && editDatesForm.checkOut > editDatesForm.checkIn)
    const effectiveCheckIn = hasValidEditDates ? editDatesForm.checkIn : roomBooking.checkIn
    const effectiveCheckOut = hasValidEditDates ? editDatesForm.checkOut : roomBooking.checkOut

    const collision = bookings.find(item =>
      item.id !== roomBooking.id &&
      item.accommodationId === editRoomForm.accommodationId &&
      effectiveCheckIn < item.checkOut && effectiveCheckOut > item.checkIn
    )
    if (collision) {
      alert(`${getAccommodation(editRoomForm.accommodationId)?.title || 'La habitación'} ya está ocupada en esas fechas.`)
      return
    }

    const standardTotal = getStandardRate(
      editRoomForm.accommodationId,
      effectiveCheckIn,
      effectiveCheckOut,
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
        check_in: effectiveCheckIn,
        check_out: effectiveCheckOut,
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

    const updatedFields: Partial<Booking> = {
      accommodationId: editRoomForm.accommodationId,
      checkIn: effectiveCheckIn,
      checkOut: effectiveCheckOut,
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

  const handleSaveDates = async () => {
    if (!editDatesForm.checkIn || !editDatesForm.checkOut || editDatesForm.checkOut <= editDatesForm.checkIn) {
      alert('Error: la fecha de check-out debe ser posterior al check-in.')
      return
    }

    setSavingDates(true)
    try {
      const group = getBookingGroup(selectedBooking)
      for (const room of group) {
        const isRoomBeingEdited = editingRoomId === room.id
        const accId = isRoomBeingEdited ? editRoomForm.accommodationId : room.accommodationId
        const adults = isRoomBeingEdited ? editRoomForm.adults : room.guestsCount.adults
        const children = isRoomBeingEdited ? editRoomForm.children : room.guestsCount.children
        const babies = isRoomBeingEdited ? editRoomForm.babies : room.guestsCount.babies
        const pets = isRoomBeingEdited ? editRoomForm.pets : room.guestsCount.pets

        const collision = bookings.find(b =>
          b.id !== room.id &&
          b.accommodationId === accId &&
          editDatesForm.checkIn < b.checkOut && editDatesForm.checkOut > b.checkIn
        )
        if (collision) {
          alert(`Error: Conflicto de fechas para ${getAccommodation(accId)?.title || 'la habitación'}. Ya está reservada del ${collision.checkIn} al ${collision.checkOut}.`)
          return
        }

        const newStandardTotal = getStandardRate(accId, editDatesForm.checkIn, editDatesForm.checkOut, adults, children)
        const newTotalAmount = getAdjustedBookingTotal(newStandardTotal, room.specialNotes)
        const newPaymentStatus: Booking['paymentStatus'] = room.amountPaid >= newTotalAmount
          ? 'completo'
          : room.amountPaid > 0 ? 'parcial' : 'pendiente'

        const { error } = await supabase
          .from('bookings')
          .update({
            accommodation_id: accId,
            check_in: editDatesForm.checkIn,
            check_out: editDatesForm.checkOut,
            total_amount: newTotalAmount,
            payment_status: newPaymentStatus,
            adults,
            children,
            babies,
            pets
          })
          .eq('id', room.id)

        if (error) {
          console.error('Error updating dates:', error)
          alert('Error al actualizar las fechas.')
          return
        }

        const updatedFields: Partial<Booking> = {
          accommodationId: accId,
          checkIn: editDatesForm.checkIn,
          checkOut: editDatesForm.checkOut,
          totalAmount: newTotalAmount,
          paymentStatus: newPaymentStatus,
          guestsCount: { adults, children, babies, pets }
        }
        setBookings(prev => prev.map(b => b.id === room.id ? { ...b, ...updatedFields } : b))
        setSelectedBooking(prev => prev && prev.id === room.id ? { ...prev, ...updatedFields } : prev)
      }

      setEditingDates(false)
      setEditingRoomId(null)
    } finally {
      setSavingDates(false)
    }
  }

  const handleAddRoomsToBooking = async () => {
    if (additionalAccommodationIds.length === 0) return
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

    const locator = selectedBooking.locator || ('LC-' + Math.random().toString(36).substring(2, 7).toUpperCase())
    const discountPercent = getBookingDiscountPercent(selectedBooking.specialNotes)

    const rows = additionalAccommodationIds.map((accId) => {
      const standardTotal = getStandardRate(accId, selectedBooking.checkIn, selectedBooking.checkOut, additionalGuests.adults, additionalGuests.children)
      const totalAmount = discountPercent > 0 ? Math.round(standardTotal * (1 - discountPercent / 100)) : standardTotal
      const specialNotes = withBookingDiscountNote(selectedBooking.specialNotes, discountPercent)

      return {
        guest_name: `${selectedBooking.guestName.replace(/\s+\(\d+\/\d+\)$/, '')} (${resultingGroupSize}/${resultingGroupSize})`,
        guest_phone: selectedBooking.guestPhone || '+58 412-000-0000',
        guest_email: selectedBooking.guestEmail || 'cliente@estancialacanada.com',
        guest_ci: selectedBooking.guestCi || null,
        companions: selectedBooking.companions || null,
        accommodation_id: accId,
        check_in: selectedBooking.checkIn,
        check_out: selectedBooking.checkOut,
        adults: additionalGuests.adults,
        children: additionalGuests.children,
        babies: additionalGuests.babies,
        pets: additionalGuests.pets,
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
      await supabase.from('bookings').update({ locator }).eq('id', selectedBooking.id)
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

  const handleSaveBookingDiscount = async () => {
    const groupBookings = getBookingGroup(selectedBooking)
    setSavingFinancials(true)
    try {
      for (const room of groupBookings) {
        const standard = getStandardRate(room.accommodationId, room.checkIn, room.checkOut, room.guestsCount.adults, room.guestsCount.children)
        let note = withBookingDiscountNote(room.specialNotes, editDiscountPercent)
        note = withBookingFixedDiscountNote(note, editFixedDiscountAmount)
        const newTotal = getAdjustedBookingTotal(standard, note)
        const newPaymentStatus: Booking['paymentStatus'] = room.amountPaid >= newTotal ? 'completo' : room.amountPaid > 0 ? 'parcial' : 'pendiente'

        await supabase.from('bookings').update({
          total_amount: newTotal,
          payment_status: newPaymentStatus,
          special_notes: note
        }).eq('id', room.id)

        setBookings(prev => prev.map(b => b.id === room.id ? { ...b, totalAmount: newTotal, paymentStatus: newPaymentStatus, specialNotes: note } : b))
        setSelectedBooking(prev => prev && prev.id === room.id ? { ...prev, totalAmount: newTotal, paymentStatus: newPaymentStatus, specialNotes: note } : prev)
      }
      setEditingFinancials(false)
    } finally {
      setSavingFinancials(false)
    }
  }

  const handleAddPayment = async () => {
    const amountVal = nuevoAbonoBs.activo
      ? Number(dolaresDeBolivares(nuevoAbonoBs.bolivares, nuevoAbonoBs.tasa))
      : Number(paymentForm.amount)
    if (!amountVal || amountVal <= 0) {
      alert('Ingresa un monto válido para el abono.')
      return
    }

    if (!envioAbono.empezar()) return
    try {
      const group = getBookingGroup(selectedBooking)
      const targetBooking = group[0]

      const paymentRow = {
        booking_id: targetBooking.id,
        payment_date: paymentForm.date || todayStr,
        amount: amountVal,
        currency: 'USD',
        method: paymentForm.method,
        reference: paymentForm.reference.trim() || null,
        status: 'verificado',
        exchange_rate: nuevoAbonoBs.activo ? Number(String(nuevoAbonoBs.tasa).replace(',', '.')) : null,
        amount_bs: nuevoAbonoBs.activo ? Number(String(nuevoAbonoBs.bolivares).replace(',', '.')) : null
      }

      const { data, error } = await supabase.from('booking_payments').insert(paymentRow).select('*').single()
      if (error || !data) {
        console.error('Error adding payment:', error)
        alert('No se pudo registrar el abono.')
        return
      }

      const reactPayment = mapDbPaymentToReact(data)
      setBookingPayments(prev => [...prev, reactPayment])

      // Update amount_paid on target booking
      const newPaid = Number(targetBooking.amountPaid) + amountVal
      const newStatus = newPaid >= targetBooking.totalAmount ? 'completo' : 'parcial'
      await supabase.from('bookings').update({ amount_paid: newPaid, payment_status: newStatus }).eq('id', targetBooking.id)
      setBookings(prev => prev.map(b => b.id === targetBooking.id ? { ...b, amountPaid: newPaid, paymentStatus: newStatus } : b))
      setSelectedBooking(prev => prev && prev.id === targetBooking.id ? { ...prev, amountPaid: newPaid, paymentStatus: newStatus } : prev)

      // Register income
      await registrarIngresoDeAbono(supabase, {
        paymentId: data.id,
        bookingId: targetBooking.id,
        guestName: selectedBooking.guestName,
        locator: selectedBooking.locator || '',
        accommodationTitle: group.length > 1 ? `${group.length} habitaciones` : getAccommodation(targetBooking.accommodationId)?.title,
        amount: amountVal,
        date: paymentForm.date || todayStr,
        method: paymentForm.method,
        reference: paymentForm.reference.trim() || null,
        exchangeRate: data.exchange_rate,
        amountBs: data.amount_bs
      })

      setAddingPayment(false)
      setPaymentForm({ amount: '', date: todayStr, method: 'transferencia', reference: '' })
      setNuevoAbonoBs({ activo: false, bolivares: '', tasa: '' })
    } finally {
      envioAbono.terminar()
    }
  }

  const handleDeletePayment = async (payment: BookingPayment) => {
    if (!confirm(`¿Eliminar este abono de ${fmt(payment.amount)}?`)) return
    const { error } = await supabase.from('booking_payments').delete().eq('id', payment.id)
    if (error) {
      alert('No se pudo eliminar el abono.')
      return
    }
    await retirarIngresoDeAbono(supabase, payment.id)
    setBookingPayments(prev => prev.filter(p => p.id !== payment.id))

    const target = bookings.find(b => b.id === payment.bookingId)
    if (target) {
      const newPaid = Math.max(0, target.amountPaid - payment.amount)
      const newStatus = newPaid >= target.totalAmount ? 'completo' : newPaid > 0 ? 'parcial' : 'pendiente'
      await supabase.from('bookings').update({ amount_paid: newPaid, payment_status: newStatus }).eq('id', target.id)
      setBookings(prev => prev.map(b => b.id === target.id ? { ...b, amountPaid: newPaid, paymentStatus: newStatus } : b))
      setSelectedBooking(prev => prev && prev.id === target.id ? { ...prev, amountPaid: newPaid, paymentStatus: newStatus } : prev)
    }
  }

  const handleSendVoucher = async (booking: Booking) => {
    if (!booking.guestEmail?.trim()) {
      alert('Esta reserva no tiene correo registrado.')
      return
    }
    setSendingVoucher(true)
    const group = getBookingGroup(booking)
    const totalAmount = group.reduce((sum, r) => sum + r.totalAmount, 0)
    const amountPaid = group.reduce((sum, r) => sum + r.amountPaid, 0)
    const totalGuests = group.reduce((sum, r) => sum + r.guestsCount.adults + r.guestsCount.children, 0)

    try {
      await sendBookingVoucherEmail(supabase, {
        locator: booking.locator || 'S/L',
        guestName: booking.guestName,
        guestEmail: booking.guestEmail.trim(),
        guestPhone: booking.guestPhone,
        guestCi: booking.guestCi,
        companions: booking.companions,
        channel: 'Local',
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        nights: calculateNights(booking.checkIn, booking.checkOut),
        guestsCount: totalGuests,
        paymentMethod: booking.paymentMethod,
        totalAmount,
        amountPaid,
        rooms: group.map(r => ({
          title: getAccommodation(r.accommodationId)?.title || `Habitación ${r.accommodationId}`,
          capacity: getMaxCapacity(r.accommodationId),
          nights: calculateNights(r.checkIn, r.checkOut),
          adults: r.guestsCount.adults,
          children: r.guestsCount.children,
          cost: r.totalAmount
        })),
        payments: bookingPayments.map(p => ({
          date: p.paymentDate,
          amount: p.amount,
          method: p.method,
          status: p.status === 'verificado' ? 'Verificado' : 'Pendiente',
          reference: p.reference
        }))
      })
      setVoucherSentFor(booking.id)
    } catch (err) {
      console.error('Error enviando voucher:', err)
      alert('Error enviando el comprobante por correo.')
    } finally {
      setSendingVoucher(false)
    }
  }

  const handleConfirmBooking = async (bookingId: string) => {
    await supabase.from('bookings').update({ confirmed: true }).eq('id', bookingId)
    setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, confirmed: true } : b))
    setSelectedBooking(prev => prev && prev.id === bookingId ? { ...prev, confirmed: true } : prev)
  }

  return (
    <div className="fixed inset-0 z-[130] flex items-end sm:items-center justify-end p-0 bg-black/40 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />
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
              onClick={onClose}
              className="p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
          </div>

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
                  const hasValidEditDates = editingDates && Boolean(editDatesForm.checkIn && editDatesForm.checkOut && editDatesForm.checkOut > editDatesForm.checkIn)
                  const effectiveCheckIn = hasValidEditDates ? editDatesForm.checkIn : roomBooking.checkIn
                  const effectiveCheckOut = hasValidEditDates ? editDatesForm.checkOut : roomBooking.checkOut
                  const effectiveNights = calculateNights(effectiveCheckIn, effectiveCheckOut)

                  const previewStandard = isEditing
                    ? getStandardRate(editRoomForm.accommodationId, effectiveCheckIn, effectiveCheckOut, editRoomForm.adults, editRoomForm.children)
                    : getStandardRate(roomBooking.accommodationId, effectiveCheckIn, effectiveCheckOut, roomBooking.guestsCount.adults, roomBooking.guestsCount.children)
                  const previewTotal = getAdjustedBookingTotal(previewStandard, roomBooking.specialNotes)
                  const datesDiffer = hasValidEditDates && (editDatesForm.checkIn !== roomBooking.checkIn || editDatesForm.checkOut !== roomBooking.checkOut)

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
                          <div className="flex justify-between items-center rounded-xl bg-amber-50/70 border border-amber-200/50 px-3 py-2 text-xs">
                            <div className="flex flex-col">
                              <span className="font-semibold text-gray-700">Precio recalculado</span>
                              <span className="text-[10px] text-gray-500">
                                {effectiveNights} {effectiveNights === 1 ? 'noche' : 'noches'}
                                {hasValidEditDates ? ' (según fechas en edición)' : ''}
                              </span>
                            </div>
                            <span className="font-extrabold text-[#8A6D33] text-sm">{fmt(previewTotal)}</span>
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
                            <p className="text-[10px] text-gray-400 mt-0.5">
                              {roomBooking.guestsCount.adults} adultos · {roomBooking.guestsCount.children} niños
                              {roomBooking.guestsCount.babies > 0 && ` · ${roomBooking.guestsCount.babies} bebés`}
                            </p>
                            {datesDiffer ? (
                              <div className="flex items-baseline gap-1.5 mt-1">
                                <span className="text-xs font-extrabold text-emerald-700">{fmt(previewTotal)}</span>
                                <span className="text-[10px] text-gray-400 line-through">{fmt(roomBooking.totalAmount)}</span>
                                <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 rounded-full">
                                  {previewTotal - roomBooking.totalAmount >= 0 ? `+${fmt(previewTotal - roomBooking.totalAmount)}` : fmt(previewTotal - roomBooking.totalAmount)}
                                </span>
                              </div>
                            ) : (
                              <p className="text-xs font-bold text-[#8A6D33] mt-1">{fmt(roomBooking.totalAmount)}</p>
                            )}
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
                              <button onClick={() => onDeleteBooking(roomBooking.id)} className="text-[9px] font-bold text-rose-500 uppercase hover:underline">
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
                <div className="space-y-3 bg-amber-50/40 p-3.5 border border-amber-200/60 rounded-2xl">
                  <div className="grid grid-cols-2 gap-3">
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

                  {(() => {
                    const isValidRange = Boolean(editDatesForm.checkIn && editDatesForm.checkOut && editDatesForm.checkOut > editDatesForm.checkIn)
                    if (!isValidRange) {
                      return (
                        <p className="text-[11px] font-semibold text-rose-600 bg-rose-50 border border-rose-200 p-2.5 rounded-xl">
                          La fecha de check-out debe ser posterior al check-in.
                        </p>
                      )
                    }

                    const currentGroup = getBookingGroup(selectedBooking)
                    const oldNights = calculateNights(selectedBooking.checkIn, selectedBooking.checkOut)
                    const newNights = calculateNights(editDatesForm.checkIn, editDatesForm.checkOut)
                    const diffNights = newNights - oldNights

                    const oldTotal = currentGroup.reduce((sum, r) => sum + r.totalAmount, 0)
                    const totalPaid = currentGroup.reduce((sum, r) => sum + r.amountPaid, 0)

                    const newTotal = currentGroup.reduce((sum, room) => {
                      const isRoomBeingEdited = editingRoomId === room.id
                      const accId = isRoomBeingEdited ? editRoomForm.accommodationId : room.accommodationId
                      const adults = isRoomBeingEdited ? editRoomForm.adults : room.guestsCount.adults
                      const children = isRoomBeingEdited ? editRoomForm.children : room.guestsCount.children
                      const standard = getStandardRate(accId, editDatesForm.checkIn, editDatesForm.checkOut, adults, children)
                      return sum + getAdjustedBookingTotal(standard, room.specialNotes)
                    }, 0)

                    const diffAmount = newTotal - oldTotal
                    const pendingBalance = Math.max(0, newTotal - totalPaid)

                    return (
                      <div className="bg-white border border-[#C5A059]/30 rounded-xl p-3 space-y-2 shadow-xs">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500 font-medium">Estadía:</span>
                          <div className="flex items-center gap-1.5 font-bold">
                            <span className="text-gray-800">{newNights} {newNights === 1 ? 'noche' : 'noches'}</span>
                            {diffNights !== 0 && (
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${diffNights > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                                {diffNights > 0 ? `+${diffNights} ${diffNights === 1 ? 'noche' : 'noches'}` : `${diffNights} noches`}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs pt-1.5 border-t border-gray-100">
                          <span className="text-gray-500 font-medium">Nueva tarifa recalculada:</span>
                          <div className="flex items-center gap-2">
                            {diffAmount !== 0 && (
                              <span className="text-[11px] text-gray-400 line-through">{fmt(oldTotal)}</span>
                            )}
                            <span className="font-extrabold text-[#8A6D33] text-sm">{fmt(newTotal)}</span>
                          </div>
                        </div>

                        {diffAmount !== 0 && (
                          <div className="flex items-center justify-between text-[11px] text-gray-600 bg-amber-500/10 px-2.5 py-1.5 rounded-lg font-medium">
                            <span>{diffAmount > 0 ? 'Diferencia a cobrar:' : 'Diferencia a favor del huésped:'}</span>
                            <span className={`font-bold ${diffAmount > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                              {diffAmount > 0 ? `+${fmt(diffAmount)}` : fmt(diffAmount)}
                            </span>
                          </div>
                        )}

                        <div className="flex items-center justify-between text-xs pt-1.5 border-t border-gray-100 text-[11px]">
                          <span className="text-gray-500">Ya pagado: <strong className="text-gray-700">{fmt(totalPaid)}</strong></span>
                          <span className="text-gray-500">Saldo pendiente: <strong className={pendingBalance > 0 ? 'text-rose-600' : 'text-emerald-600'}>{fmt(pendingBalance)}</strong></span>
                        </div>
                      </div>
                    )
                  })()}

                  <div className="flex items-center gap-3 pt-1">
                    <button
                      onClick={handleSaveDates}
                      disabled={savingDates}
                      className="text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-2 rounded-xl uppercase tracking-wider transition-colors disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {savingDates ? (
                        <>
                          <div className="w-3 h-3 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                          Guardando nuevas fechas...
                        </>
                      ) : (
                        'Guardar en toda la reserva'
                      )}
                    </button>
                    <button
                      onClick={() => setEditingDates(false)}
                      disabled={savingDates}
                      className="text-[10px] font-bold text-gray-400 uppercase tracking-wider hover:underline disabled:opacity-40"
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

            {/* 7. Historial de Pagos */}
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
                          {textoEnBolivares(p.amountBs, p.exchangeRate) && (
                            <span className="block text-[10px] text-gray-400">
                              {textoEnBolivares(p.amountBs, p.exchangeRate)}
                            </span>
                          )}
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
                    Este pago se registrará como un abono global de la reserva.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Monto ($)</label>
                      <input
                        type="number"
                        min={0}
                        value={nuevoAbonoBs.activo
                          ? (dolaresDeBolivares(nuevoAbonoBs.bolivares, nuevoAbonoBs.tasa) || '')
                          : paymentForm.amount}
                        onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))}
                        disabled={nuevoAbonoBs.activo}
                        placeholder="0"
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#C5A059] disabled:bg-gray-50 disabled:text-gray-500"
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
                        onChange={e => setPaymentForm(f => ({ ...f, method: e.target.value as any }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#C5A059] bg-white capitalize"
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
                  <CobroEnBolivares
                    compacto
                    activo={nuevoAbonoBs.activo}
                    onActivo={v => {
                      setNuevoAbonoBs(prev => ({ ...prev, activo: v }))
                      if (v) setPaymentForm(prev => ({ ...prev, amount: '' }))
                    }}
                    bolivares={nuevoAbonoBs.bolivares}
                    onBolivares={v => setNuevoAbonoBs(prev => ({ ...prev, bolivares: v }))}
                    tasa={nuevoAbonoBs.tasa}
                    onTasa={v => setNuevoAbonoBs(prev => ({ ...prev, tasa: v }))}
                    referencia={bcvEuro}
                  />

                  <div className="flex items-center gap-3 pt-1">
                    <button onClick={handleAddPayment} disabled={envioAbono.ocupado} className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider hover:underline disabled:opacity-40">
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

          {(selectedBooking.status === 'checkin_hoy' || (selectedBooking.status === 'confirmado' && todayStr >= selectedBooking.checkIn && todayStr < selectedBooking.checkOut)) && (
            <button
              onClick={() => onCheckIn(selectedBooking.id)}
              className="w-full flex items-center justify-center gap-1.5 py-3.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-2xl text-xs uppercase tracking-wider transition-all active:scale-95 shadow-lg shadow-amber-500/10"
            >
              <LogIn size={15} /> Completar Check-In
            </button>
          )}

          {(selectedBooking.status === 'checkout_hoy' || (selectedBooking.status === 'ocupado' && selectedBooking.checkOut === todayStr)) && (
            <button
              onClick={() => onCheckOut(selectedBooking.id)}
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
              onClick={() => onDeleteBooking(selectedBooking.id)}
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
  )
}
