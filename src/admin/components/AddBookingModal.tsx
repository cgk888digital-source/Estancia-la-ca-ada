import React, { useState, useEffect } from 'react'
import { X, Check } from 'lucide-react'
import { accommodationOptions, activeAccommodationOptions, getMaxCapacity } from '../../data/accommodations'
import { repartirNoches, precioEstancia } from '../../utils/seasonNights'
import { supabase } from '../../lib/supabase'
import type { Booking } from '../types'
import { parseLocalDate, fechaLocalISO as formatLocalDate } from '../../utils/dateUtils'
import { syncMarketingCustomer } from '../../utils/syncMarketingCustomer'
import CobroEnBolivares from './CobroEnBolivares'
import { sendBookingConfirmationEmail } from '../../utils/sendBookingConfirmationEmail'
import { sendBookingVoucherEmail } from '../../utils/sendBookingVoucherEmail'
import { splitPersonName } from '../../utils/personName'
import { registrarIngresoDeAbono } from '../../utils/bookingIncome'

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

const calculateNights = (startStr: string, endStr: string) => {
  if (!startStr || !endStr) return 1
  const start = new Date(startStr)
  const end = new Date(endStr)
  const diffTime = end.getTime() - start.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays > 0 ? diffDays : 1
}

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
  paymentMethod: (db.payment_method || 'transferencia') as 'efectivo' | 'transferencia' | 'tarjeta' | 'cheque' | 'zelle' | 'pago_movil',
  paymentReference: db.payment_reference || '',
  status: (db.status || 'confirmado') as 'checkout_hoy' | 'checkin_hoy' | 'ocupado' | 'confirmado' | 'limpieza',
  confirmed: db.confirmed ?? true,
  specialNotes: db.special_notes || '',
  locator: db.locator || ''
})

const DEFAULT_SPECIAL_NOTES = 'Hospedaje con cena y desayuno incluido.'

interface AddBookingModalProps {
  isOpen: boolean
  onClose: () => void
  bookings: Booking[]
  dbAccommodations: DbAccommodation[]
  bcvEuro: number | null
  mealRates: { perAdult: number; perAdultNavidad: number; perChild: number }
  initialAccId?: number
  initialCheckIn?: string
  initialCheckOut?: string
  onBookingCreated: (newBookings: Booking[]) => void
}

export default function AddBookingModal({
  isOpen,
  onClose,
  bookings,
  dbAccommodations,
  bcvEuro,
  mealRates,
  initialAccId,
  initialCheckIn,
  initialCheckOut,
  onBookingCreated
}: AddBookingModalProps) {
  const todayDate = new Date()
  const todayStr = formatLocalDate(todayDate)
  const defaultCheckOutStr = formatLocalDate(addDays(todayDate, 3))

  const [useCustomRate, setUseCustomRate] = useState(false)
  const [discountPercent, setDiscountPercent] = useState(0)
  const [locatorCode, setLocatorCode] = useState('')
  const [selectedAccommodationIds, setSelectedAccommodationIds] = useState<number[]>([2])
  const [roomGuestsMap, setRoomGuestsMap] = useState<Record<number, { adults: number; children: number; babies: number }>>({
    2: { adults: 2, children: 0, babies: 0 }
  })

  const [abonoInicialBs, setAbonoInicialBs] = useState({ activo: false, bolivares: '', tasa: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)

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
    paymentDate: todayStr,
    paymentMethod: 'transferencia' as 'transferencia' | 'efectivo' | 'tarjeta' | 'cheque' | 'zelle' | 'pago_movil',
    paymentReference: '',
    specialNotes: DEFAULT_SPECIAL_NOTES
  })

  // Autocomplete state
  const [guestSuggestions, setGuestSuggestions] = useState<GuestSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const shouldShowGuestSuggestions = (form.guestFirstName.length >= 3 || form.guestLastName.length >= 3) && showSuggestions

  const getAccommodation = (id: number) => accommodationOptions.find(o => o.id === id)

  // Initialize or reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setUseCustomRate(false)
      setDiscountPercent(0)
      const accId = initialAccId || 2
      const checkInVal = initialCheckIn || todayStr
      const checkOutVal = initialCheckOut || defaultCheckOutStr
      setSelectedAccommodationIds([accId])
      const cap = getMaxCapacity(accId) || 2
      const defaultPax = Math.min(2, cap) || 1
      setRoomGuestsMap({ [accId]: { adults: defaultPax, children: 0, babies: 0 } })

      const newLocator = 'LC-' + Math.random().toString(36).substring(2, 7).toUpperCase()
      setLocatorCode(newLocator)

      setForm({
        guestFirstName: '',
        guestLastName: '',
        guestPhone: '',
        guestEmail: '',
        guestCi: '',
        companions: '',
        accommodationId: accId,
        checkIn: checkInVal,
        checkOut: checkOutVal,
        adults: defaultPax,
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
      setIsSubmitting(false)
    }
  }, [isOpen, initialAccId, initialCheckIn, initialCheckOut])

  // Autocomplete effect
  useEffect(() => {
    if (!shouldShowGuestSuggestions) return
    let active = true

    const timer = setTimeout(async () => {
      const terms = [form.guestFirstName, form.guestLastName]
        .map(term => term.trim().replace(/[%,()]/g, ''))
        .filter(term => term.length >= 2)
      if (terms.length === 0) return
      const bookingFilter = terms.map(term => `guest_name.ilike.%${term}%`).join(',')
      const customerFilter = terms.map(term => `full_name.ilike.%${term}%`).join(',')

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

  const standardRate = isOpen ? getGroupStandardRate(selectedAccommodationIds) : 0

  const calculatedTotal = useCustomRate
    ? (discountPercent > 0 ? Math.round(standardRate * (1 - discountPercent / 100)) : form.totalAmount)
    : standardRate

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

    setIsSubmitting(true)

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
      setIsSubmitting(false)
      return
    } else if (data && data.length > 0) {
      const createdReactBookings = data.map(mapDbBookingToReact)
      onBookingCreated(createdReactBookings)

      if (Number(form.amountPaid) > 0) {
        const paymentRow = {
          booking_id: data[0].id,
          payment_date: form.paymentDate || todayStr,
          amount: initialPaidTotal,
          currency: 'USD',
          method: form.paymentMethod,
          reference: form.paymentReference.trim() || null,
          status: 'verificado',
          exchange_rate: abonoInicialBs.activo
            ? Number(String(abonoInicialBs.tasa).replace(',', '.'))
            : null,
          amount_bs: abonoInicialBs.activo
            ? Number(String(abonoInicialBs.bolivares).replace(',', '.'))
            : null,
        }

        const { data: pagosIniciales, error: paymentError } = await supabase
          .from('booking_payments')
          .insert(paymentRow)
          .select('id, booking_id, amount, exchange_rate, amount_bs')

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
              exchangeRate: payment.exchange_rate ?? null,
              amountBs: payment.amount_bs ?? null,
            })
            if (ingreso.error) console.error('El abono inicial no llegó a Ingresos:', ingreso.error)
          }
        }
      }

      if (form.guestEmail.trim()) {
        syncMarketingCustomer(supabase, {
          fullName: fullGuestName,
          email: form.guestEmail.trim(),
          phone: form.guestPhone.trim(),
          bookingAmount: finalTotal,
          stayDate: form.checkIn
        }).catch(err => console.error('Error sincronizando cliente de marketing:', err))

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

    setIsSubmitting(false)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />
      
      <div className="relative bg-white rounded-t-[2rem] sm:rounded-[2.5rem] shadow-2xl w-full max-w-lg p-5 sm:p-6 space-y-5 overflow-y-auto max-h-[92dvh] sm:max-h-[90dvh] z-10 animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <h2 className="text-xl font-bold font-serif text-gray-800">Registrar Nueva Reserva</h2>
          <button
            onClick={onClose}
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
              {/* Autocomplete Dropdown */}
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
                            })
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
            onClick={onClose}
            className="flex-1 py-3 border border-gray-200 text-gray-500 font-bold rounded-2xl text-xs uppercase tracking-wider hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleAddBooking}
            disabled={
              isSubmitting ||
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
            <Check size={16} /> {isSubmitting ? 'Registrando...' : 'Registrar Reserva'}
          </button>
        </div>
      </div>
    </div>
  )
}
