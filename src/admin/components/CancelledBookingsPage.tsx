import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  ArchiveX, Search, RotateCcw, Trash2, Eye,
  CheckCircle2, AlertTriangle, RefreshCw, X, ShieldCheck
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { accommodationOptions } from '../../data/accommodations'
import type { Booking } from '../types'
import { fechaLocalISO } from '../../utils/dateUtils'

// Formateador de moneda
const fmt = (n: number) =>
  new Intl.NumberFormat('es-VE', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2
  }).format(n)

interface DbBookingRaw {
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
  created_at: string
  cancelled_at?: string | null
  cancellation_reason?: string | null
}

const mapDbToBooking = (db: DbBookingRaw): Booking => ({
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
  paymentStatus: (db.payment_status || 'pendiente') as any,
  paymentMethod: (db.payment_method || 'transferencia') as any,
  paymentReference: db.payment_reference || '',
  status: (db.status || 'anulada') as any,
  confirmed: db.confirmed ?? true,
  specialNotes: db.special_notes || '',
  locator: db.locator || '',
  createdAt: db.created_at,
  cancelledAt: db.cancelled_at || null,
  cancellationReason: db.cancellation_reason || 'Anulada sin motivo'
})

const REASON_PRESETS = [
  'Todos',
  'Anulada por el hotel',
  'Anulada por el huésped',
  'Error al registrar reserva',
  'Vencida / Sin pago',
  'Cambio de fechas / planes'
]

export default function CancelledBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedReason, setSelectedReason] = useState('Todos')

  // Date filters: default last 60 days
  const defaultFrom = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - 60)
    return fechaLocalISO(d)
  }, [])
  const [dateFrom, setDateFrom] = useState(defaultFrom)
  const [dateTo, setDateTo] = useState('')

  // Modal / Action states
  const [detailBooking, setDetailBooking] = useState<Booking | null>(null)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [purgingId, setPurgingId] = useState<string | null>(null)
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const fetchCancelledBookings = useCallback(async () => {
    setLoading(true)
    setLoadError(null)

    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .or('status.eq.anulada,cancelled_at.not.is.null')
        .order('cancelled_at', { ascending: false, nullsFirst: false })

      if (error) throw error

      setBookings((data || []).map(mapDbToBooking))
    } catch (err: any) {
      console.error('Error fetching cancelled bookings:', err)
      setLoadError(err.message || 'No se pudieron cargar las reservas anuladas.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCancelledBookings()
  }, [fetchCancelledBookings])

  const getAccommodation = (id: number) => accommodationOptions.find(o => o.id === id)

  // Quick preset helper
  const applyPresetDays = (days: number) => {
    const d = new Date()
    d.setDate(d.getDate() - days)
    setDateFrom(fechaLocalISO(d))
    setDateTo('')
  }

  // Filtered list
  const filteredBookings = useMemo(() => {
    return bookings.filter(b => {
      // Reason filter
      if (selectedReason !== 'Todos') {
        const r = (b.cancellationReason || '').toLowerCase()
        if (!r.includes(selectedReason.toLowerCase())) return false
      }

      // Date range filter based on cancelledAt or checkIn
      const dateToCompare = b.cancelledAt ? b.cancelledAt.substring(0, 10) : b.checkIn
      if (dateFrom && dateToCompare < dateFrom) return false
      if (dateTo && dateToCompare > dateTo) return false

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const acc = getAccommodation(b.accommodationId)
        const matchesName = b.guestName.toLowerCase().includes(q)
        const matchesLocator = (b.locator || '').toLowerCase().includes(q)
        const matchesPhone = (b.guestPhone || '').toLowerCase().includes(q)
        const matchesEmail = (b.guestEmail || '').toLowerCase().includes(q)
        const matchesAcc = acc ? acc.title.toLowerCase().includes(q) : false
        const matchesReason = (b.cancellationReason || '').toLowerCase().includes(q)
        if (!matchesName && !matchesLocator && !matchesPhone && !matchesEmail && !matchesAcc && !matchesReason) {
          return false
        }
      }

      return true
    })
  }, [bookings, selectedReason, dateFrom, dateTo, searchQuery])

  // Reactivate / Restore booking
  const handleReactivate = async (booking: Booking) => {
    setActionNotice(null)
    const acc = getAccommodation(booking.accommodationId)
    const accTitle = acc?.title || `Habitación #${booking.accommodationId}`

    setRestoringId(booking.id)

    try {
      // 1. Verify availability: check if there's any active booking on the same room and overlapping dates
      const { data: collisions, error: checkError } = await supabase
        .from('bookings')
        .select('id, guest_name, check_in, check_out, status')
        .eq('accommodation_id', booking.accommodationId)
        .neq('status', 'anulada')
        .lt('check_in', booking.checkOut)
        .gt('check_out', booking.checkIn)

      if (checkError) throw checkError

      if (collisions && collisions.length > 0) {
        const conflict = collisions[0]
        alert(
          `⚠️ Conflicto de Fechas:\n\n` +
          `No se puede reactivar la reserva de ${booking.guestName} (${booking.checkIn} al ${booking.checkOut}) ` +
          `porque ${accTitle} ya está ocupada por "${conflict.guest_name}" desde el ${conflict.check_in} hasta el ${conflict.check_out}.\n\n` +
          `Para reactivarla, primero deberás cambiar la fecha o reasignar la habitación de la otra reserva.`
        )
        setRestoringId(null)
        return
      }

      // 2. Confirm reactivation
      const confirmed = window.confirm(
        `¿Deseas reactivar la reserva de "${booking.guestName}" en ${accTitle}?\n\n` +
        `Fechas: del ${booking.checkIn} al ${booking.checkOut}\n` +
        `La reserva volverá al Planner de Reservas con estatus Confirmado.`
      )
      if (!confirmed) {
        setRestoringId(null)
        return
      }

      // 3. Update Supabase
      const { error: updateError } = await supabase
        .from('bookings')
        .update({
          status: 'confirmado',
          cancelled_at: null,
          cancellation_reason: null
        })
        .eq('id', booking.id)

      if (updateError) throw updateError

      // 4. Update local state
      setBookings(prev => prev.filter(b => b.id !== booking.id))
      setActionNotice({
        type: 'success',
        message: `¡Reserva de ${booking.guestName} reactivada con éxito! Ya está disponible en el Planner.`
      })
      if (detailBooking?.id === booking.id) {
        setDetailBooking(null)
      }
    } catch (err: any) {
      console.error('Error reactivating booking:', err)
      alert(`Error al reactivar la reserva: ${err.message || 'Error desconocido'}`)
    } finally {
      setRestoringId(null)
    }
  }

  // Purge / Hard delete
  const handlePurge = async (booking: Booking) => {
    setActionNotice(null)
    const confirmed = window.confirm(
      `🚨 ATENCIÓN: ¿Deseas eliminar DEFINITIVAMENTE esta reserva anulada de "${booking.guestName}"?\n\n` +
      `Esta acción borrará de manera permanente el registro de la base de datos y no se podrá volver a reactivar.`
    )
    if (!confirmed) return

    setPurgingId(booking.id)
    try {
      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', booking.id)

      if (error) throw error

      setBookings(prev => prev.filter(b => b.id !== booking.id))
      setActionNotice({
        type: 'success',
        message: `Reserva eliminada definitivamente del sistema.`
      })
      if (detailBooking?.id === booking.id) {
        setDetailBooking(null)
      }
    } catch (err: any) {
      console.error('Error purging booking:', err)
      alert(`No se pudo eliminar la reserva: ${err.message}`)
    } finally {
      setPurgingId(null)
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-widest text-[#C5A059] font-extrabold block">
              Recepción & Mi Negocio
            </span>
            <span className="text-gray-300">•</span>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
              Papelera de Reservas
            </span>
          </div>
          <h1 className="text-3xl font-bold font-serif text-gray-800 flex items-center gap-3 mt-1">
            <ArchiveX className="text-rose-600" size={32} />
            Res. Anuladas
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Historial de reservas canceladas. Puedes consultar los motivos de anulación o reactivar cualquier reserva en cualquier momento.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchCancelledBookings()}
            disabled={loading}
            className="flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-2xl border border-gray-200 text-xs font-bold uppercase tracking-wider transition-all active:scale-95 shadow-sm disabled:opacity-50"
            title="Refrescar listado"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {/* Action Notification Banner */}
      {actionNotice && (
        <div className={`p-4 rounded-2xl flex items-center justify-between gap-3 text-xs font-semibold ${
          actionNotice.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
            : 'bg-rose-50 text-rose-800 border border-rose-200'
        }`}>
          <div className="flex items-center gap-2">
            {actionNotice.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            <span>{actionNotice.message}</span>
          </div>
          <button onClick={() => setActionNotice(null)} className="text-gray-400 hover:text-gray-600">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Safety Notice Box (Paxer style) */}
      <div className="p-4 rounded-3xl bg-amber-50/70 border border-amber-200/60 flex items-start gap-3.5 shadow-sm">
        <div className="p-2 bg-amber-100/80 rounded-2xl text-amber-700 flex-shrink-0 mt-0.5">
          <ShieldCheck size={20} />
        </div>
        <div className="text-xs text-amber-900 leading-relaxed">
          <p className="font-bold text-amber-950">Protección contra borrados accidentales</p>
          <p className="mt-0.5 text-amber-800/90">
            Cuando se cancela una reserva, no se pierde su información: se conserva en esta sección junto con sus fechas, huésped y abonos previos. Al pulsar <strong className="text-amber-950">"Reactivar"</strong>, el sistema verifica que la habitación esté libre y la reintegra al Planner en un clic.
          </p>
        </div>
      </div>

      {/* 2. Filters Bar (Matching Paxer screen layout) */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          {/* Search Input */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
              Búsqueda rápida
            </label>
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Cliente, localizador, cabaña..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-50/80 border border-gray-200 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-gray-800 outline-none focus:ring-2 focus:ring-[#C5A059] transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Date Range: Desde - Hasta */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                Rango de fechas
              </label>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => applyPresetDays(30)}
                  className="text-[10px] text-gray-500 hover:text-[#C5A059] font-medium"
                >
                  30d
                </button>
                <span className="text-gray-300">•</span>
                <button
                  type="button"
                  onClick={() => applyPresetDays(60)}
                  className="text-[10px] text-gray-500 hover:text-[#C5A059] font-medium"
                >
                  60d
                </button>
                <span className="text-gray-300">•</span>
                <button
                  type="button"
                  onClick={() => { setDateFrom(''); setDateTo('') }}
                  className="text-[10px] text-gray-500 hover:text-[#C5A059] font-medium"
                >
                  Todas
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="bg-gray-50/80 border border-gray-200 rounded-2xl px-3 py-2 text-xs text-gray-700 outline-none focus:ring-2 focus:ring-[#C5A059]"
                title="Fecha desde"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="bg-gray-50/80 border border-gray-200 rounded-2xl px-3 py-2 text-xs text-gray-700 outline-none focus:ring-2 focus:ring-[#C5A059]"
                title="Fecha hasta"
              />
            </div>
          </div>

          {/* Motivo de Anulación */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
              Motivo de anulación
            </label>
            <select
              value={selectedReason}
              onChange={(e) => setSelectedReason(e.target.value)}
              className="w-full bg-gray-50/80 border border-gray-200 rounded-2xl px-3.5 py-2.5 text-xs text-gray-800 font-medium outline-none focus:ring-2 focus:ring-[#C5A059]"
            >
              {REASON_PRESETS.map((preset) => (
                <option key={preset} value={preset}>
                  {preset}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Reason tags for quick click */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mr-1">
            Filtro rápido:
          </span>
          {REASON_PRESETS.map((r) => {
            const isActive = selectedReason === r
            return (
              <button
                key={r}
                type="button"
                onClick={() => setSelectedReason(r)}
                className={`text-[11px] px-3 py-1 rounded-full font-medium transition-all ${
                  isActive
                    ? 'bg-[#3D2B1F] text-white shadow-sm'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                }`}
              >
                {r}
              </button>
            )
          })}
        </div>
      </div>

      {/* 3. Results Section */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Table summary bar */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between text-xs text-gray-500">
          <div>
            Mostrando <strong className="text-gray-800">{filteredBookings.length}</strong> {filteredBookings.length === 1 ? 'reserva anulada' : 'reservas anuladas'}
            {bookings.length !== filteredBookings.length && (
              <span className="text-gray-400"> (de un total de {bookings.length})</span>
            )}
          </div>
          {(selectedReason !== 'Todos' || dateFrom || dateTo || searchQuery) && (
            <button
              onClick={() => {
                setSelectedReason('Todos')
                setDateFrom(defaultFrom)
                setDateTo('')
                setSearchQuery('')
              }}
              className="text-[#C5A059] hover:underline font-bold text-xs"
            >
              Restablecer filtros
            </button>
          )}
        </div>

        {/* Loading state */}
        {loading && (
          <div className="py-20 flex flex-col items-center justify-center text-gray-400 gap-3">
            <RefreshCw size={28} className="animate-spin text-[#C5A059]" />
            <p className="text-xs font-medium">Buscando reservas anuladas...</p>
          </div>
        )}

        {/* Error state */}
        {!loading && loadError && (
          <div className="py-12 px-6 text-center">
            <p className="text-rose-600 font-bold text-sm">Ocurrió un error al cargar las reservas</p>
            <p className="text-xs text-gray-400 mt-1">{loadError}</p>
            <button
              onClick={() => fetchCancelledBookings()}
              className="mt-4 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !loadError && filteredBookings.length === 0 && (
          <div className="py-20 px-6 text-center max-w-md mx-auto space-y-3">
            <div className="w-16 h-16 rounded-full bg-gray-50 text-gray-300 flex items-center justify-center mx-auto">
              <ArchiveX size={32} />
            </div>
            <h3 className="text-base font-bold text-gray-700">No hay reservas anuladas</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              {bookings.length === 0
                ? 'Cuando anules o elimines una reserva desde el Planner, se guardará automáticamente aquí para que nunca pierdas datos por error.'
                : 'No se encontraron reservas anuladas que coincidan con los filtros aplicados.'}
            </p>
          </div>
        )}

        {/* Table View */}
        {!loading && !loadError && filteredBookings.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-600">
              <thead className="bg-gray-50/70 border-b border-gray-100 text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Localizador</th>
                  <th className="py-3.5 px-4">Cliente / Huésped</th>
                  <th className="py-3.5 px-4">Cabaña / Habitación</th>
                  <th className="py-3.5 px-4">Entrada</th>
                  <th className="py-3.5 px-4">Salida</th>
                  <th className="py-3.5 px-4">Canal</th>
                  <th className="py-3.5 px-4">Motivo de Anulación</th>
                  <th className="py-3.5 px-4">Fecha Anulación</th>
                  <th className="py-3.5 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredBookings.map((b) => {
                  const acc = getAccommodation(b.accommodationId)
                  const isRestoring = restoringId === b.id
                  const isPurging = purgingId === b.id

                  const cancelDateStr = b.cancelledAt
                    ? new Date(b.cancelledAt).toLocaleString('es-ES', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    : 'Sin registro'

                  return (
                    <tr key={b.id} className="hover:bg-gray-50/80 transition-colors">
                      {/* Localizador */}
                      <td className="py-4 px-4 font-mono font-bold text-[#C5A059]">
                        {b.locator ? (
                          <span className="bg-[#C5A059]/10 px-2 py-1 rounded-md text-[11px]">
                            {b.locator}
                          </span>
                        ) : (
                          <span className="text-gray-300">#N/A</span>
                        )}
                      </td>

                      {/* Huésped */}
                      <td className="py-4 px-4">
                        <div className="font-bold text-gray-800 text-sm leading-tight">
                          {b.guestName}
                        </div>
                        {b.guestPhone && (
                          <div className="text-[11px] text-gray-400 mt-0.5 font-mono">
                            {b.guestPhone}
                          </div>
                        )}
                        {b.guestCi && (
                          <div className="text-[10px] text-gray-400">
                            CI: {b.guestCi}
                          </div>
                        )}
                      </td>

                      {/* Alojamiento */}
                      <td className="py-4 px-4">
                        <div className="font-semibold text-gray-800">
                          {acc?.title || `Habitación #${b.accommodationId}`}
                        </div>
                        <div className="text-[10px] text-gray-400 capitalize">
                          {acc?.type || 'Alojamiento'}
                        </div>
                      </td>

                      {/* Fecha Entrada */}
                      <td className="py-4 px-4 font-semibold text-gray-700 whitespace-nowrap">
                        {b.checkIn}
                      </td>

                      {/* Fecha Salida */}
                      <td className="py-4 px-4 font-semibold text-gray-700 whitespace-nowrap">
                        {b.checkOut}
                      </td>

                      {/* Canal */}
                      <td className="py-4 px-4">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700">
                          {b.specialNotes?.toLowerCase().includes('bookingflow') ? 'Web Directa' : 'Local'}
                        </span>
                      </td>

                      {/* Motivo Anulación */}
                      <td className="py-4 px-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200/60 max-w-[200px] truncate" title={b.cancellationReason || ''}>
                          {b.cancellationReason || 'Anulada por el hotel'}
                        </span>
                      </td>

                      {/* Fecha Anulación */}
                      <td className="py-4 px-4 text-gray-500 whitespace-nowrap text-[11px]">
                        {cancelDateStr}
                      </td>

                      {/* Acciones */}
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Botón Ver Detalle */}
                          <button
                            type="button"
                            onClick={() => setDetailBooking(b)}
                            className="p-2 rounded-xl text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-all"
                            title="Ver detalles completos de la reserva"
                          >
                            <Eye size={15} />
                          </button>

                          {/* Botón Reactivar / Restaurar */}
                          <button
                            type="button"
                            onClick={() => handleReactivate(b)}
                            disabled={isRestoring}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-sm transition-all active:scale-95 disabled:opacity-50"
                            title="Reactivar y devolver al calendario"
                          >
                            <RotateCcw size={13} className={isRestoring ? 'animate-spin' : ''} />
                            <span>{isRestoring ? 'Verificando...' : 'Reactivar'}</span>
                          </button>

                          {/* Botón Eliminar definitivamente (Purga) */}
                          <button
                            type="button"
                            onClick={() => handlePurge(b)}
                            disabled={isPurging}
                            className="p-2 rounded-xl text-gray-300 hover:text-rose-600 hover:bg-rose-50 transition-all"
                            title="Eliminar definitivamente (borrado permanente)"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. Detail Modal for Canceled Booking */}
      {detailBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 space-y-5">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
                  <ArchiveX size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800 text-base">Detalle de Reserva Anulada</h3>
                  <p className="text-xs text-gray-400 font-mono">
                    Localizador: {detailBooking.locator || 'Sin código'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDetailBooking(null)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-xl"
              >
                <X size={18} />
              </button>
            </div>

            {/* Motivo de anulación highlight */}
            <div className="p-3.5 bg-rose-50/70 border border-rose-200/70 rounded-2xl space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-rose-800 uppercase tracking-wider text-[10px]">
                  Motivo de anulación:
                </span>
                <span className="text-[10px] text-rose-600 font-medium">
                  {detailBooking.cancelledAt
                    ? new Date(detailBooking.cancelledAt).toLocaleString('es-ES')
                    : 'Sin fecha registrada'}
                </span>
              </div>
              <p className="text-sm font-bold text-rose-900">
                {detailBooking.cancellationReason || 'Anulada sin motivo especificado'}
              </p>
            </div>

            {/* Info Huésped & Fechas */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-gray-50/80 p-4 rounded-2xl border border-gray-100">
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Huésped</span>
                <span className="font-bold text-gray-800 text-sm mt-0.5 block">{detailBooking.guestName}</span>
                {detailBooking.guestCi && <span className="text-gray-500 block">CI: {detailBooking.guestCi}</span>}
                {detailBooking.guestPhone && <span className="text-gray-500 block font-mono">Tlf: {detailBooking.guestPhone}</span>}
                {detailBooking.guestEmail && <span className="text-gray-500 block">Correo: {detailBooking.guestEmail}</span>}
              </div>

              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Estancia</span>
                <span className="font-bold text-gray-800 text-sm mt-0.5 block">
                  {getAccommodation(detailBooking.accommodationId)?.title || `Cabaña #${detailBooking.accommodationId}`}
                </span>
                <span className="text-gray-600 block mt-1">Del <strong>{detailBooking.checkIn}</strong> al <strong>{detailBooking.checkOut}</strong></span>
                <span className="text-gray-500 block mt-0.5">
                  {detailBooking.guestsCount.adults} adultos, {detailBooking.guestsCount.children} niños
                </span>
              </div>
            </div>

            {/* Valores Financieros */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Total Reserva</span>
                <span className="text-base font-extrabold text-gray-800 block mt-0.5">{fmt(detailBooking.totalAmount)}</span>
              </div>
              <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Abonos Registrados</span>
                <span className="text-base font-extrabold text-emerald-600 block mt-0.5">{fmt(detailBooking.amountPaid)}</span>
              </div>
            </div>

            {/* Notas especiales */}
            {detailBooking.specialNotes && (
              <div className="p-3 bg-amber-50/60 rounded-2xl border border-amber-100 text-xs text-amber-900">
                <span className="font-bold text-[10px] uppercase tracking-wider text-amber-700 block mb-0.5">Notas especiales:</span>
                {detailBooking.specialNotes}
              </div>
            )}

            {/* Footer Buttons */}
            <div className="flex gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setDetailBooking(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => handleReactivate(detailBooking)}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold shadow-md shadow-emerald-500/20 flex items-center justify-center gap-1.5"
              >
                <RotateCcw size={14} />
                Reactivar Reserva
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
