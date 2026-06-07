import { useState, useMemo, useEffect } from 'react'
import {
  Calendar, Users, Check, LogIn, LogOut, Trash2, Search, Plus, X, Phone, Mail,
  Info, DollarSign, Baby, Sparkles, RefreshCw
} from 'lucide-react'
import { accommodationOptions } from '../../data/accommodations'
import { mockBookings } from '../data/mockBookings'
import { supabase } from '../../lib/supabase'
import type { Booking } from '../types'

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

// Mappers between DB format (snake_case) and React format (camelCase)
const mapDbBookingToReact = (db: any): Booking => ({
  id: db.id,
  guestName: db.guest_name,
  guestPhone: db.guest_phone || '',
  guestEmail: db.guest_email || '',
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
  paymentStatus: db.payment_status || 'pendiente',
  paymentMethod: db.payment_method || 'transferencia',
  status: db.status || 'confirmado',
  specialNotes: db.special_notes || ''
})

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'dia' | 'semana' | 'mes'>('dia')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false)
  
  // Selected date (anchored to 2026-06-02 as today's date for realistic representation)
  const todayStr = '2026-06-02'
  const todayDate = new Date(2026, 5, 2) // June 2, 2026

  // Form State for creating a new booking
  const [form, setForm] = useState({
    guestName: '',
    guestPhone: '',
    guestEmail: '',
    accommodationId: 2,
    checkIn: '2026-06-02',
    checkOut: '2026-06-05',
    adults: 2,
    children: 0,
    babies: 0,
    pets: 0,
    totalAmount: 180,
    amountPaid: 90,
    paymentMethod: 'transferencia' as const,
    specialNotes: ''
  })

  // Accommodation lookup helper
  const getAccommodation = (id: number) => accommodationOptions.find(o => o.id === id)

  // Fetch bookings from Supabase
  const fetchBookings = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching bookings from Supabase:', error)
      setBookings(mockBookings)
    } else if (data && data.length > 0) {
      setBookings(data.map(mapDbBookingToReact))
    } else {
      // Seed the database with mockBookings if completely empty so the hotel looks populated
      const dbMocks = mockBookings.map(b => ({
        guest_name: b.guestName,
        guest_phone: b.guestPhone,
        guest_email: b.guestEmail,
        accommodation_id: b.accommodationId,
        check_in: b.checkIn,
        check_out: b.checkOut,
        adults: b.guestsCount.adults,
        children: b.guestsCount.children,
        babies: b.guestsCount.babies,
        pets: b.guestsCount.pets,
        total_amount: b.totalAmount,
        amount_paid: b.amountPaid,
        payment_status: b.paymentStatus,
        payment_method: b.paymentMethod,
        status: b.status,
        special_notes: b.specialNotes || null
      }))
      
      const { data: insertedData, error: insertError } = await supabase.from('bookings').insert(dbMocks).select('*')
      if (insertError) {
        console.error('Error seeding mock bookings:', insertError)
        setBookings(mockBookings)
      } else if (insertedData) {
        setBookings(insertedData.map(mapDbBookingToReact))
      } else {
        setBookings(mockBookings)
      }
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchBookings()
  }, [])

  // 1. Dynamic states calculation for TODAY's Day View
  const cabinStatesToday = useMemo(() => {
    return accommodationOptions.map(acc => {
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

  // 2. Weekly grid calculation (Next 7 days starting today)
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(todayDate)
      d.setDate(todayDate.getDate() + i)
      const yr = d.getFullYear()
      const mo = String(d.getMonth() + 1).padStart(2, '0')
      const dy = String(d.getDate()).padStart(2, '0')
      const dateStr = `${yr}-${mo}-${dy}`
      return {
        dateStr,
        label: d.toLocaleDateString('es-ES', { weekday: 'short' }),
        dayNum: d.getDate(),
        monthLabel: d.toLocaleDateString('es-ES', { month: 'short' })
      }
    })
  }, [bookings])

  // 3. Filters and Search Results
  const filteredBookings = useMemo(() => {
    return bookings.filter(b => {
      const acc = getAccommodation(b.accommodationId)
      const cabinName = acc ? acc.title.toLowerCase() : ''
      const guestName = b.guestName.toLowerCase()
      const q = searchQuery.toLowerCase()
      return guestName.includes(q) || cabinName.includes(q)
    })
  }, [bookings, searchQuery])

  // Key stats today
  const stats = useMemo(() => {
    const totalCabins = accommodationOptions.length
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

  const handleRegisterPayment = async (bookingId: string, totalAmount: number) => {
    const { error } = await supabase
      .from('bookings')
      .update({ amount_paid: totalAmount, payment_status: 'completo' })
      .eq('id', bookingId)

    if (error) {
      console.error('Error registering payment:', error)
    } else {
      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, amountPaid: totalAmount, paymentStatus: 'completo' } : b))
    }
    setSelectedBooking(null)
  }

  const handleAddBooking = async () => {
    if (!form.guestName.trim()) return

    const initialStatus = form.checkIn === todayStr ? 'checkin_hoy' : 'confirmado'
    const newBooking = {
      guest_name: form.guestName.trim(),
      guest_phone: form.guestPhone.trim() || '+58 412-000-0000',
      guest_email: form.guestEmail.trim() || 'cliente@estancialacanada.com',
      accommodation_id: Number(form.accommodationId),
      check_in: form.checkIn,
      check_out: form.checkOut,
      adults: Number(form.adults),
      children: Number(form.children),
      babies: Number(form.babies),
      pets: Number(form.pets),
      total_amount: Number(form.totalAmount),
      amount_paid: Number(form.amountPaid),
      payment_status: Number(form.amountPaid) >= Number(form.totalAmount) 
        ? 'completo' 
        : Number(form.amountPaid) > 0 ? 'parcial' : 'pendiente',
      payment_method: form.paymentMethod,
      status: initialStatus,
      special_notes: form.specialNotes.trim() || null
    }

    const { data, error } = await supabase
      .from('bookings')
      .insert([newBooking])
      .select('*')

    if (error) {
      console.error('Error adding booking:', error)
    } else if (data && data[0]) {
      setBookings(prev => [mapDbBookingToReact(data[0]), ...prev])
    }

    setShowAddModal(false)
    setForm({
      guestName: '',
      guestPhone: '',
      guestEmail: '',
      accommodationId: 2,
      checkIn: '2026-06-02',
      checkOut: '2026-06-05',
      adults: 2,
      children: 0,
      babies: 0,
      pets: 0,
      totalAmount: 180,
      amountPaid: 90,
      paymentMethod: 'transferencia',
      specialNotes: ''
    })
  }

  // Visual state labels helper
  const getBulletColor = (status: keyof typeof statusConfig) => statusConfig[status]?.bullet || 'bg-gray-400'

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] gap-3">
        <div className="w-10 h-10 border-4 border-[#C5A059] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-bold text-gray-500 uppercase tracking-widest animate-pulse">Cargando reservas...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 1. Header with dynamic greetings */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-serif text-gray-900 flex items-center gap-2.5">
            Planner de Reservas <Sparkles className="text-[#C5A059] fill-[#C5A059]/10" size={24} />
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Supervisa la ocupación del hotel de la manera más sencilla e intuitiva. Hoy es 2 de Junio, 2026.
          </p>
        </div>
        
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center justify-center gap-2 px-5 py-3 bg-[#C5A059] hover:bg-[#b8904a] text-white rounded-2xl text-sm font-bold transition-all shadow-md shadow-[#C5A059]/20 self-start md:self-auto active:scale-95"
        >
          <Plus size={18} />
          Registrar Nueva Reserva
        </button>
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
              onClick={() => setActiveTab(tab)}
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
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full text-xs outline-none bg-transparent text-gray-700 placeholder-gray-400 font-medium"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-gray-400 hover:text-gray-600">
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
                  <div className={`absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[9px] font-extrabold uppercase tracking-widest ${conf.bg}`}>
                    {conf.icon}
                    {conf.label}
                  </div>

                  <div className="absolute bottom-4 left-5">
                    <span className="text-[9px] uppercase tracking-widest text-[#C5A059] font-extrabold block mb-0.5">
                      {accommodation.type}
                    </span>
                    <h3 className="text-xl font-bold font-serif text-white leading-tight">
                      {accommodation.title}
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
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Huésped</p>
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
                          <span className="font-semibold text-gray-600">{new Date(booking.checkIn).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</span>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Salida</p>
                          <span className="font-semibold text-gray-600">{new Date(booking.checkOut).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</span>
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
                        className="w-full flex items-center justify-center gap-1.5 py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all active:scale-95 shadow-sm shadow-amber-500/10"
                      >
                        <LogIn size={14} /> Registrar Entrada
                      </button>
                    )}

                    {status === 'checkout_hoy' && booking && (
                      <button
                        onClick={() => handleCheckOut(booking.id)}
                        className="w-full flex items-center justify-center gap-1.5 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all active:scale-95 shadow-sm shadow-orange-500/10"
                      >
                        <LogOut size={14} /> Registrar Salida
                      </button>
                    )}

                    {status === 'ocupado' && booking && (
                      <button
                        onClick={() => setSelectedBooking(booking)}
                        className="w-full py-3 bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-100 font-bold rounded-xl text-xs uppercase tracking-wider transition-all"
                      >
                        Ver Detalles
                      </button>
                    )}

                    {status === 'limpieza' && (
                      <button
                        onClick={() => handleMarkClean(accommodation.id)}
                        className="w-full flex items-center justify-center gap-1.5 py-3 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all active:scale-95 shadow-sm shadow-rose-500/10"
                      >
                        <RefreshCw size={14} /> Marcar como Limpia
                      </button>
                    )}

                    {status === 'disponible' && (
                      <button
                        onClick={() => {
                          setForm(f => ({ ...f, accommodationId: accommodation.id }))
                          setShowAddModal(true)
                        }}
                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all shadow-sm"
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
          <div className="overflow-x-auto">
            <div className="min-w-[800px] divide-y divide-gray-100">
              {/* Header row (Dates) */}
              <div className="flex bg-gray-50/50">
                {/* Cabin column header spacer */}
                <div className="w-56 shrink-0 p-4 font-bold text-[10px] text-gray-400 uppercase tracking-widest flex items-center border-r border-gray-100">
                  Cabaña
                </div>
                {/* 7 Days columns */}
                <div className="flex-1 grid grid-cols-7 divide-x divide-gray-100">
                  {weekDays.map(day => {
                    const isToday = day.dateStr === todayStr
                    return (
                      <div
                        key={day.dateStr}
                        className={`p-3 text-center flex flex-col items-center justify-center ${isToday ? 'bg-amber-500/10 text-amber-800' : 'text-gray-500'}`}
                      >
                        <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">{day.label}</span>
                        <span className="text-lg font-extrabold leading-none mt-1">{day.dayNum}</span>
                        <span className="text-[9px] font-medium uppercase tracking-widest opacity-60 mt-0.5">{day.monthLabel}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Rows per Cabin */}
              {accommodationOptions.map(acc => (
                <div key={acc.id} className="flex hover:bg-gray-50/40 transition-colors">
                  {/* Cabin Details Info */}
                  <div className="w-56 shrink-0 p-4 border-r border-gray-100 flex items-center gap-3">
                    <img
                      src={acc.image}
                      alt={acc.title}
                      className="w-12 h-12 object-cover rounded-xl bg-gray-100 shrink-0"
                    />
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-gray-800 truncate leading-tight">{acc.title}</h4>
                      <span className="text-[9px] uppercase tracking-widest text-[#C5A059] font-bold block mt-0.5">{acc.type}</span>
                    </div>
                  </div>

                  {/* 7 columns showing booking segments */}
                  <div className="flex-1 grid grid-cols-7 divide-x divide-gray-100 relative">
                    {weekDays.map(day => {
                      // Check if there is an active booking on this date
                      const currentBooking = bookings.find(b => {
                        if (b.accommodationId !== acc.id) return false
                        return day.dateStr >= b.checkIn && day.dateStr < b.checkOut
                      })

                      // Special check: check out today
                      const checkOutBooking = bookings.find(b => {
                        return b.accommodationId === acc.id && b.checkOut === day.dateStr && b.status === 'checkout_hoy'
                      })

                      return (
                        <div key={day.dateStr} className="p-2 h-20 flex items-center justify-center relative">
                          {currentBooking ? (
                            <button
                              onClick={() => setSelectedBooking(currentBooking)}
                              className={`w-full h-full rounded-2xl p-2 text-left flex flex-col justify-between border transition-all hover:brightness-95 active:scale-98 ${
                                currentBooking.status === 'ocupado'
                                  ? 'bg-sky-500/10 border-sky-300 text-sky-900'
                                  : currentBooking.status === 'checkin_hoy'
                                    ? 'bg-amber-500/10 border-amber-300 text-amber-900'
                                    : 'bg-indigo-500/10 border-indigo-300 text-indigo-900'
                              }`}
                            >
                              <div className="flex items-center gap-1">
                                <span className={`w-1.5 h-1.5 rounded-full ${getBulletColor(currentBooking.status)} shrink-0`} />
                                <span className="text-[10px] font-extrabold truncate max-w-full block leading-none">
                                  {currentBooking.guestName.split(' ')[0]}
                                </span>
                              </div>
                              <span className="text-[8px] font-bold text-gray-400 tracking-wider">
                                {currentBooking.guestsCount.adults} Huésp.
                              </span>
                            </button>
                          ) : checkOutBooking ? (
                            <button
                              onClick={() => setSelectedBooking(checkOutBooking)}
                              className="w-full h-full rounded-2xl p-2 text-left flex flex-col justify-between border bg-orange-500/10 border-orange-300 text-orange-900 transition-all hover:brightness-95"
                            >
                              <div className="flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" />
                                <span className="text-[10px] font-extrabold truncate block leading-none">
                                  Sale: {checkOutBooking.guestName.split(' ')[0]}
                                </span>
                              </div>
                              <span className="text-[8px] font-bold text-orange-400">Checkout Hoy</span>
                            </button>
                          ) : (
                            // Empty cell (available)
                            <button
                              onClick={() => {
                                setForm(f => ({ ...f, accommodationId: acc.id, checkIn: day.dateStr }))
                                setShowAddModal(true)
                              }}
                              className="w-full h-full rounded-2xl border-2 border-dashed border-gray-100 hover:border-[#C5A059]/40 hover:bg-[#C5A059]/5 transition-all flex items-center justify-center text-gray-300 hover:text-[#C5A059] group"
                            >
                              <Plus size={16} className="group-hover:scale-110 transition-transform" />
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB C: MES VIEW (Month Analytics & Detailed Lists) */}
      {activeTab === 'mes' && (
        <div className="space-y-6">
          {/* Monthly KPI card summaries */}
          <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center md:text-left">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Periodo</span>
              <h3 className="text-2xl font-bold font-serif text-gray-800 mt-1">Junio 2026</h3>
              <p className="text-xs text-gray-400 mt-0.5">Estadísticas estimadas</p>
            </div>
            
            <div className="flex flex-col justify-center border-t md:border-t-0 md:border-l border-gray-100 pt-4 md:pt-0 md:pl-6">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Reservas del Mes</span>
              <p className="text-2xl font-bold text-[#C5A059] mt-1">{bookings.length} Reservas</p>
              <p className="text-xs text-gray-400 mt-0.5">Ocupación total programada</p>
            </div>

            <div className="flex flex-col justify-center border-t md:border-t-0 md:border-l border-gray-100 pt-4 md:pt-0 md:pl-6">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Ingresos del Mes</span>
              <p className="text-2xl font-bold text-emerald-600 mt-1">{fmt(bookings.reduce((s, b) => s + b.totalAmount, 0))}</p>
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
              <span className="text-xs text-gray-400 font-medium">Mostrando {filteredBookings.length} reservas</span>
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
                  {filteredBookings.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-16">
                        <Calendar size={32} className="text-gray-200 mx-auto mb-3" />
                        <p className="text-sm text-gray-400 font-medium">No se encontraron reservas coincidentes</p>
                      </td>
                    </tr>
                  ) : (
                    filteredBookings.map(b => {
                      const acc = getAccommodation(b.accommodationId)
                      const conf = statusConfig[b.status]
                      return (
                        <tr
                          key={b.id}
                          onClick={() => setSelectedBooking(b)}
                          className="hover:bg-gray-50/50 cursor-pointer transition-colors"
                        >
                          <td className="px-6 py-4">
                            <p className="text-sm font-bold text-gray-800">{b.guestName}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{b.guestPhone}</p>
                          </td>
                          <td className="px-4 py-4">
                            <p className="text-sm font-semibold text-gray-700">{acc?.title}</p>
                            <span className="text-[9px] uppercase tracking-widest text-[#C5A059] font-bold block mt-0.5">{acc?.type}</span>
                          </td>
                          <td className="px-4 py-4 text-xs font-medium text-gray-600">
                            {new Date(b.checkIn).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                            {' al '}
                            {new Date(b.checkOut).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: '2-digit' })}
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
                            <span className={`block text-[9px] font-bold mt-0.5 ${b.paymentStatus === 'completo' ? 'text-emerald-600' : b.paymentStatus === 'parcial' ? 'text-amber-500' : 'text-rose-500'}`}>
                              {b.paymentStatus === 'completo' ? 'PAGADO' : b.paymentStatus === 'parcial' ? 'ABONADO' : 'PENDIENTE'}
                            </span>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 5. SIDE DRAWER MODAL: Detailed Booking Information Card */}
      {selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-end p-0 bg-black/40 backdrop-blur-sm">
          {/* Overlay click to close */}
          <div className="absolute inset-0" onClick={() => setSelectedBooking(null)} />
          
          <div className="relative w-full max-w-md h-[90vh] sm:h-screen bg-white rounded-t-3xl sm:rounded-l-3xl sm:rounded-tr-none shadow-2xl p-6 flex flex-col justify-between overflow-y-auto animate-in slide-in-from-bottom sm:slide-in-from-right duration-300">
            <div>
              {/* Header card details */}
              <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                <div>
                  <span className="text-[9px] uppercase tracking-widest text-[#C5A059] font-extrabold block">Ficha de Reserva</span>
                  <h2 className="text-xl font-bold font-serif text-gray-800 mt-1">Detalle del Huésped</h2>
                </div>
                <button
                  onClick={() => setSelectedBooking(null)}
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
                    <div className="flex flex-col gap-1 mt-1.5 text-xs text-gray-500">
                      <a href={`tel:${selectedBooking.guestPhone}`} className="flex items-center gap-1 hover:text-[#C5A059]"><Phone size={12} /> {selectedBooking.guestPhone}</a>
                      <a href={`mailto:${selectedBooking.guestEmail}`} className="flex items-center gap-1 hover:text-[#C5A059]"><Mail size={12} /> {selectedBooking.guestEmail}</a>
                    </div>
                  </div>
                </div>

                {/* 2. Cabin detail */}
                <div className="space-y-3">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Estadía Asignada</span>
                  {(() => {
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50/50 p-4 border border-gray-100 rounded-2xl">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Check-In</span>
                    <span className="text-sm font-bold text-gray-700">{new Date(selectedBooking.checkIn).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  </div>
                  <div className="bg-gray-50/50 p-4 border border-gray-100 rounded-2xl">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Check-Out</span>
                    <span className="text-sm font-bold text-gray-700">{new Date(selectedBooking.checkOut).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  </div>
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
              </div>
            </div>

            {/* Quick Actions Drawer Footer */}
            <div className="border-t border-gray-100 pt-4 space-y-2">
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
                {selectedBooking.amountPaid < selectedBooking.totalAmount && (
                  <button
                    onClick={() => handleRegisterPayment(selectedBooking.id, selectedBooking.totalAmount)}
                    className="flex-1 py-3 border border-emerald-500/30 hover:bg-emerald-50 text-emerald-700 font-bold rounded-2xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
                  >
                    <DollarSign size={14} /> Registrar Pago
                  </button>
                )}
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
          <div className="absolute inset-0" onClick={() => setShowAddModal(false)} />
          
          <div className="relative bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg p-6 space-y-5 overflow-y-auto max-h-[90vh] z-10 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h2 className="text-xl font-bold font-serif text-gray-800">Registrar Nueva Reserva</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 hover:bg-gray-100 rounded-xl transition-colors text-gray-500"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Guest details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="col-span-1 sm:col-span-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Nombre Completo del Huésped</label>
                  <input
                    type="text"
                    placeholder="Ej. Familia Rodríguez o Sra. Ana Peralta"
                    value={form.guestName}
                    onChange={e => setForm(f => ({ ...f, guestName: e.target.value }))}
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
              </div>

              {/* Cabin Assignment */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="col-span-1 sm:col-span-3">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Cabaña Asignada</label>
                  <select
                    value={form.accommodationId}
                    onChange={e => {
                      const id = Number(e.target.value)
                      const acc = getAccommodation(id)
                      setForm(f => ({ 
                        ...f, 
                        accommodationId: id,
                        totalAmount: acc ? acc.price * 2 : 150 // default estimate 2 nights
                      }))
                    }}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-[#C5A059] bg-white"
                  >
                    {accommodationOptions.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.title} ({acc.type} - ${acc.price}/noche)</option>
                    ))}
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

              {/* Finance details */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Costo Total ($)</label>
                  <input
                    type="number"
                    min={0}
                    value={form.totalAmount}
                    onChange={e => setForm(f => ({ ...f, totalAmount: Number(e.target.value) }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-[#C5A059]"
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
                    onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value as any }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-[#C5A059] bg-white capitalize"
                  >
                    <option value="transferencia">Transferencia</option>
                    <option value="efectivo">Efectivo</option>
                    <option value="tarjeta">Tarjeta</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>
              </div>

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
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-3 border border-gray-200 text-gray-500 font-bold rounded-2xl text-xs uppercase tracking-wider hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAddBooking}
                disabled={!form.guestName.trim()}
                className="flex-1 py-3 bg-[#C5A059] hover:bg-[#b8904a] text-white font-bold rounded-2xl text-xs uppercase tracking-wider disabled:opacity-40 transition-all flex items-center justify-center gap-1.5 active:scale-95"
              >
                <Check size={16} /> Registrar Reserva
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
