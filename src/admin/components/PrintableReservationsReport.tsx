import React from 'react'
import type { Booking } from '../types'
import { activeAccommodationOptions } from '../../data/accommodations'

interface Props {
  bookings: Booking[]
  dateText: string
}

const PrintableReservationsReport: React.FC<Props> = ({ bookings, dateText }) => {
  // Sort accommodations by ID (or name)
  const sortedAccommodations = [...activeAccommodationOptions].sort((a, b) => a.id - b.id)

  // Get active or future bookings for the week/day context

  return (
    <div className="hidden print:block font-sans text-black bg-white p-8">
      {/* Header */}
      <div className="border-b-2 border-black pb-4 mb-6">
        <h1 className="text-2xl font-bold uppercase tracking-wider mb-1">Reporte de Ocupación</h1>
        <p className="text-sm text-gray-600">Fecha del Reporte: {dateText}</p>
        <p className="text-xs text-gray-500 mt-1">Estancia La Cañada</p>
      </div>

      {/* Table */}
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b-2 border-black text-left">
            <th className="py-2 pr-2 w-1/4">Cabaña / Habitación</th>
            <th className="py-2 px-2 w-1/6">Estado</th>
            <th className="py-2 px-2 w-1/4">Huésped</th>
            <th className="py-2 px-2 w-1/12 text-center">Pax (A+N)</th>
            <th className="py-2 px-2 w-1/12 text-center">Check-In</th>
            <th className="py-2 pl-2 w-1/12 text-center">Check-Out</th>
          </tr>
        </thead>
        <tbody>
          {sortedAccommodations.map((acc, index) => {
            // Find if there's a booking occupying it today or arriving today
            const activeBooking = bookings.find(b => 
              b.accommodationId === acc.id &&
              b.status !== 'checkout_hoy' && // usually checkout means it frees up today, but let's just show the active one
              (b.status === 'ocupado' || b.status === 'checkin_hoy' || b.status === 'confirmado')
            ) || bookings.find(b => b.accommodationId === acc.id) // fallback to any future/past just to show context if filtered

            const isOccupied = activeBooking && ['ocupado', 'checkin_hoy'].includes(activeBooking.status)
            
            const paxText = activeBooking 
              ? `${activeBooking.guestsCount.adults}A + ${activeBooking.guestsCount.children}N`
              : '-'

            return (
              <tr key={acc.id} className={`border-b border-gray-300 ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}>
                <td className="py-2 pr-2 font-bold text-gray-800 text-xs">
                  {acc.title.replace(/\(.*\)/, '').trim()}
                </td>
                <td className="py-2 px-2">
                  {isOccupied ? (
                    <span className="font-bold text-red-600 uppercase text-xs tracking-wider">Ocupada</span>
                  ) : activeBooking?.status === 'checkout_hoy' ? (
                    <span className="font-bold text-orange-600 uppercase text-xs tracking-wider">Salida Hoy</span>
                  ) : activeBooking?.status === 'limpieza' ? (
                    <span className="font-bold text-yellow-600 uppercase text-xs tracking-wider">Limpieza</span>
                  ) : (
                    <span className="font-bold text-green-600 uppercase text-xs tracking-wider">Libre</span>
                  )}
                </td>
                <td className="py-2 px-2 text-gray-700 text-xs truncate max-w-[150px]" title={activeBooking ? activeBooking.guestName : ''}>
                  {activeBooking ? activeBooking.guestName : '-'}
                </td>
                <td className="py-2 px-2 text-center font-semibold text-gray-700 text-xs">
                  {paxText}
                </td>
                <td className="py-2 px-2 text-center text-gray-600 text-xs">
                  {activeBooking ? new Date(activeBooking.checkIn).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }) : '-'}
                </td>
                <td className="py-2 pl-2 text-center text-gray-600 text-xs">
                  {activeBooking ? new Date(activeBooking.checkOut).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }) : '-'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* Footer */}
      <div className="mt-8 text-xs text-gray-400 text-center border-t border-gray-200 pt-4">
        Documento generado automáticamente por el sistema de administración.
      </div>
    </div>
  )
}

export default PrintableReservationsReport
