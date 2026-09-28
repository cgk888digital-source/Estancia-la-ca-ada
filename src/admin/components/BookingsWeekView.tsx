import React, { useState, useMemo, useEffect, useRef } from 'react'
import { Plus, Maximize2, Minimize2 } from 'lucide-react'
import { activeAccommodationOptions } from '../../data/accommodations'
import type { Booking } from '../types'
import { parseLocalDate, fechaLocalISO as formatLocalDate } from '../../utils/dateUtils'
import { useIsMobile } from '../../utils/useMediaQuery'

const DRAG_THRESHOLD_PX = 6

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

type EffectivePaymentState = 'reservado' | 'sin_pago' | 'parcial' | 'pagado'

const paymentStateLabels: Record<EffectivePaymentState, string> = {
  reservado: 'Reservado',
  sin_pago: 'Sin Pago',
  parcial: 'Pago Parcial',
  pagado: 'Pagado'
}

const getPaymentColorClasses = (booking: Pick<Booking, 'confirmed' | 'paymentStatus'>) => {
  let state: EffectivePaymentState = 'sin_pago'
  if (!booking.confirmed) state = 'reservado'
  else if (booking.paymentStatus === 'completo') state = 'pagado'
  else if (booking.paymentStatus === 'parcial') state = 'parcial'

  if (state === 'pagado') return { bg: 'bg-emerald-500/10 border-emerald-300 text-emerald-900', bullet: 'bg-emerald-500', text: 'text-emerald-600', badge: 'bg-emerald-100 border-emerald-300 text-emerald-800' }
  if (state === 'parcial') return { bg: 'bg-orange-500/10 border-orange-300 text-orange-900', bullet: 'bg-orange-500', text: 'text-orange-600', badge: 'bg-orange-100 border-orange-300 text-orange-800' }
  if (state === 'sin_pago') return { bg: 'bg-blue-500/10 border-blue-400 text-blue-900', bullet: 'bg-blue-600', text: 'text-blue-700', badge: 'bg-blue-100 border-blue-400 text-blue-900' }
  return { bg: 'bg-sky-500/10 border-sky-300 text-sky-900', bullet: 'bg-sky-400', text: 'text-sky-600', badge: 'bg-sky-100 border-sky-300 text-sky-800' }
}

interface BookingsWeekViewProps {
  bookings: Booking[]
  todayStr: string
  todayDate: Date
  onSelectBooking: (b: Booking) => void
  onOpenAddModalWithDates: (accId: number, checkIn: string, checkOut: string) => void
  reassignBooking: (bookingId: string, newAccId: number, newCheckIn: string, newCheckOut: string) => Promise<boolean>
  getBookingPaymentColors: (b: Booking) => any
}

export default function BookingsWeekView({
  bookings,
  todayStr,
  todayDate,
  onSelectBooking,
  onOpenAddModalWithDates,
  reassignBooking,
  getBookingPaymentColors
}: BookingsWeekViewProps) {
  const isMobile = useIsMobile()
  const [weekAnchor, setWeekAnchor] = useState(() => new Date(todayDate))
  const [weekViewMode, setWeekViewMode] = useState<'semana' | 'personalizado'>('semana')
  const [weekRangeFrom, setWeekRangeFrom] = useState('')
  const [weekRangeTo, setWeekRangeTo] = useState('')
  const [plannerFullscreen, setPlannerFullscreen] = useState(false)

  const [dragInfo, setDragInfo] = useState<{ bookingId: string; mode: 'move' | 'resize-left' | 'resize-right' } | null>(null)
  const [dragOverCell, setDragOverCell] = useState<string | null>(null)
  const [rangeSelect, setRangeSelect] = useState<{ accId: number; startDateStr: string; endDateStr: string } | null>(null)
  const [pendingCheckIn, setPendingCheckIn] = useState<{ accId: number; dateStr: string } | null>(null)

  const dragOverCellRef = useRef<string | null>(null)
  const dragStartPosRef = useRef<{ x: number; y: number } | null>(null)
  const hasDraggedRef = useRef(false)
  const rangeStartPosRef = useRef<{ x: number; y: number } | null>(null)
  const rangeDraggedRef = useRef(false)
  const rangePointerTypeRef = useRef<string>('mouse')

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
      const nights = calculateNights(booking.checkIn, booking.checkOut)
      newCheckIn = dropDateStr
      newCheckOut = formatLocalDate(addDays(parseLocalDate(dropDateStr), nights))
      newAccId = accId
    } else {
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

  useEffect(() => {
    if (!dragInfo) return
    hasDraggedRef.current = false

    const handlePointerMove = (e: PointerEvent) => {
      if (!hasDraggedRef.current) {
        const start = dragStartPosRef.current
        if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) < DRAG_THRESHOLD_PX) return
        hasDraggedRef.current = true
      }
      const stack = document.elementsFromPoint(e.clientX, e.clientY)
      const cellEl = stack.find((el): el is HTMLElement => el instanceof HTMLElement && !!el.dataset.plannerCell)
      const key = cellEl?.dataset.plannerCell || null
      dragOverCellRef.current = key
      setDragOverCell(key)
    }

    const handlePointerUp = () => {
      const targetKey = dragOverCellRef.current
      const didDrag = hasDraggedRef.current
      dragStartPosRef.current = null
      hasDraggedRef.current = false
      dragOverCellRef.current = null

      if (!didDrag || !targetKey) {
        setDragInfo(null)
        setDragOverCell(null)
        return
      }

      const [accIdStr, dateStr] = targetKey.split('|')
      handleDropOnCell(Number(accIdStr), dateStr)
    }

    const handlePointerCancel = () => {
      dragStartPosRef.current = null
      hasDraggedRef.current = false
      dragOverCellRef.current = null
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
  }, [dragInfo, bookings])

  useEffect(() => {
    if (!rangeSelect) return

    const handlePointerMove = (e: PointerEvent) => {
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

      if (wasDrag) {
        const [fromStr, toStr] = startDateStr <= endDateStr
          ? [startDateStr, endDateStr]
          : [endDateStr, startDateStr]
        onOpenAddModalWithDates(accId, fromStr, formatLocalDate(addDays(parseLocalDate(toStr), 1)))
        return
      }

      if (!wasTouch) {
        onOpenAddModalWithDates(accId, startDateStr, formatLocalDate(addDays(parseLocalDate(startDateStr), 1)))
        return
      }

      if (pendingCheckIn && pendingCheckIn.accId === accId) {
        if (startDateStr === pendingCheckIn.dateStr) {
          setPendingCheckIn(null)
          return
        }
        if (startDateStr > pendingCheckIn.dateStr) {
          onOpenAddModalWithDates(accId, pendingCheckIn.dateStr, startDateStr)
          setPendingCheckIn(null)
          return
        }
      }
      setPendingCheckIn({ accId, dateStr: startDateStr })
    }

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

  return (
    <div className={plannerFullscreen
      ? 'fixed inset-0 z-[120] bg-white flex flex-col'
      : 'bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden'}>
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

        <button
          onClick={() => setPlannerFullscreen(v => !v)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 bg-white text-[10px] font-bold uppercase tracking-wider text-gray-600 active:scale-95"
        >
          {plannerFullscreen
            ? <><Minimize2 size={14} /> Salir</>
            : <><Maximize2 size={14} /> Pantalla completa</>}
        </button>
      </div>

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

      <div
        className={plannerFullscreen ? 'overflow-auto flex-1 min-h-0' : 'overflow-auto max-h-[70dvh]'}
        style={{ overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}
      >
        <div className="min-w-fit divide-y divide-gray-100">
          <div className="flex bg-gray-50 sticky top-0 z-20 border-b border-gray-100 shadow-sm">
            <div className="w-20 sm:w-24 shrink-0 sticky left-0 z-30 p-2 font-bold text-[9px] text-gray-400 uppercase tracking-widest flex items-center justify-center border-r border-gray-100 bg-gray-50">
              Cabaña
            </div>
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

          {activeAccommodationOptions.map(acc => {
            const weekStartStr = weekDays[0].dateStr
            const weekEndStr = weekDays[weekDays.length - 1].dateStr
            const rowBookings = bookings.filter(b =>
              b.accommodationId === acc.id && b.checkIn <= weekEndStr && b.checkOut > weekStartStr
            )

            return (
              <div key={acc.id} className="flex hover:bg-gray-50/40 transition-colors">
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

                <div className="flex-1 relative">
                  <div className="grid divide-x divide-gray-100 h-12 sm:h-10" style={{ gridTemplateColumns: `repeat(${weekDays.length}, minmax(${isMobile ? 44 : 40}px, 1fr))` }}>
                    {weekDays.map(day => {
                      const isOccupied = rowBookings.some(b => day.dateStr >= b.checkIn && day.dateStr < b.checkOut)
                      const isDragTarget = dragOverCell === `${acc.id}|${day.dateStr}`
                      const isRangeSelected = !!rangeSelect && rangeSelect.accId === acc.id &&
                        day.dateStr >= (rangeSelect.startDateStr <= rangeSelect.endDateStr ? rangeSelect.startDateStr : rangeSelect.endDateStr) &&
                        day.dateStr <= (rangeSelect.startDateStr <= rangeSelect.endDateStr ? rangeSelect.endDateStr : rangeSelect.startDateStr)
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

                  {rowBookings.map(b => {
                    const occupiedIdx = weekDays.reduce<number[]>((acc2, day, i) => {
                      if (day.dateStr >= b.checkIn && day.dateStr < b.checkOut) acc2.push(i)
                      return acc2
                    }, [])
                    if (occupiedIdx.length === 0) return null
                    const startIdx = occupiedIdx[0]
                    const endIdx = occupiedIdx[occupiedIdx.length - 1]
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
                        <div
                          onPointerDown={e => { e.preventDefault(); dragStartPosRef.current = { x: e.clientX, y: e.clientY }; setDragInfo({ bookingId: b.id, mode: 'resize-left' }) }}
                          title="Arrastra para cambiar el check-in"
                          style={{ touchAction: 'none' }}
                          className="w-3 sm:w-1.5 shrink-0 cursor-ew-resize hover:bg-black/10 active:bg-black/15 transition-colors select-none"
                        />

                        <button
                          onPointerDown={e => { dragStartPosRef.current = { x: e.clientX, y: e.clientY }; setDragInfo({ bookingId: b.id, mode: 'move' }) }}
                          onClick={() => onSelectBooking(b)}
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
  )
}
