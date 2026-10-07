import React from 'react'
import type { Booking } from '../types'
import { accommodationOptions } from '../../data/accommodations'
import { parseLocalDate } from '../../utils/dateUtils'

interface Props {
  bookings: Booking[]
  desde: string
  hasta: string
}

/** Tope de días que se imprimen en el resumen diario. Un rango de un año serían 365 bloques. */
const MAXIMO_DE_DIAS = 92

const nombreDeHabitacion = (id: number) => {
  const acc = accommodationOptions.find(o => o.id === id)
  if (!acc) return 'Habitación ' + id
  return acc.title.replace(/\(.*\)/, '').replace('Galería ', '').trim()
}

const pax = (b: Booking) => {
  const { adults, children, babies } = b.guestsCount
  return `${adults}A+${children}N` + (babies > 0 ? `+${babies}B` : '')
}

const dia = (f: string) => parseLocalDate(f).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })

const diaLargo = (f: string) => {
  const t = parseLocalDate(f).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
  return t.charAt(0).toUpperCase() + t.slice(1)
}

const rangoLargo = (desde: string, hasta: string) => {
  const opciones: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }
  if (desde === hasta) return parseLocalDate(desde).toLocaleDateString('es-ES', opciones)
  return `Del ${parseLocalDate(desde).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })} al ${parseLocalDate(hasta).toLocaleDateString('es-ES', opciones)}`
}

/** Los días del rango, como YYYY-MM-DD. */
const diasDelRango = (desde: string, hasta: string) => {
  const salida: string[] = []
  const fin = parseLocalDate(hasta)
  for (let d = parseLocalDate(desde); d <= fin && salida.length < MAXIMO_DE_DIAS; d.setDate(d.getDate() + 1)) {
    const mes = String(d.getMonth() + 1).padStart(2, '0')
    salida.push(`${d.getFullYear()}-${mes}-${String(d.getDate()).padStart(2, '0')}`)
  }
  return salida
}

const estadoDeReserva = (b: Booking) => {
  if (b.confirmed === false) return 'Sin revisar'
  if (b.paymentStatus === 'completo') return 'Pagada'
  if (b.paymentStatus === 'parcial') return 'Abonada'
  return 'Sin pago'
}

/**
 * El reporte que se imprime desde el planner.
 *
 * Son dos documentos seguidos: primero el movimiento día a día —quién sale, quién entra y
 * quién se queda—, que es lo que se le da a las camareras por la mañana, y detrás la lista
 * completa del periodo para la administración.
 *
 * Una reserva entra en el rango si lo toca, aunque empiece antes o acabe después: esos días
 * la habitación está ocupada igual.
 */
const PrintableReservationsReport: React.FC<Props> = ({ bookings, desde, hasta }) => {
  if (!desde || !hasta || hasta < desde) return null

  const delRango = bookings
    .filter(b => b.status !== 'anulada' && b.checkIn <= hasta && b.checkOut >= desde)
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn) || a.accommodationId - b.accommodationId)

  const dias = diasDelRango(desde, hasta)
  const recortado = parseLocalDate(hasta) > parseLocalDate(dias[dias.length - 1] || desde)

  const filaDeMovimiento = (b: Booking, cuando: string) => (
    <tr key={b.id + cuando} className="border-b border-gray-200">
      <td className="py-1 pr-2 font-bold text-[11px] w-[30%]">{nombreDeHabitacion(b.accommodationId)}</td>
      <td className="py-1 px-2 text-[11px] w-[34%]">{b.guestName}</td>
      <td className="py-1 px-2 text-[11px] text-center w-[12%]">{pax(b)}</td>
      <td className="py-1 px-2 text-[11px] text-center w-[12%]">{dia(b.checkIn)}</td>
      <td className="py-1 pl-2 text-[11px] text-center w-[12%]">{dia(b.checkOut)}</td>
    </tr>
  )

  const bloque = (titulo: string, nota: string, lista: Booking[], cuando: string) => {
    if (lista.length === 0) return null
    return (
      <div className="mb-3">
        <p className="text-[10px] font-bold uppercase tracking-widest mb-1">
          {titulo} <span className="font-normal normal-case tracking-normal text-gray-500">— {nota}</span>
        </p>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-400 text-left text-[8px] uppercase tracking-widest text-gray-500">
              <th className="py-0.5 pr-2 font-bold">Habitación</th>
              <th className="py-0.5 px-2 font-bold">Huésped</th>
              <th className="py-0.5 px-2 font-bold text-center">Pax</th>
              <th className="py-0.5 px-2 font-bold text-center">Entra</th>
              <th className="py-0.5 pl-2 font-bold text-center">Sale</th>
            </tr>
          </thead>
          <tbody>{lista.map(b => filaDeMovimiento(b, cuando))}</tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="hidden print:block font-sans text-black bg-white p-8">
      {/* ── Parte 1: el movimiento de cada día ── */}
      <div className="border-b-2 border-black pb-3 mb-5">
        <h1 className="text-xl font-bold uppercase tracking-wider">Movimiento de habitaciones</h1>
        <p className="text-sm text-gray-700 mt-0.5">{rangoLargo(desde, hasta)}</p>
        <p className="text-[11px] text-gray-500 mt-1">
          Estancia La Cañada · {delRango.length} {delRango.length === 1 ? 'reserva' : 'reservas'} en el periodo
        </p>
      </div>

      {delRango.length === 0 && (
        <p className="text-sm text-gray-600 mb-6">No hay reservas en estas fechas.</p>
      )}

      {dias.map(d => {
        const salidas = delRango.filter(b => b.checkOut === d)
        const entradas = delRango.filter(b => b.checkIn === d)
        const sequedan = delRango.filter(b => b.checkIn < d && b.checkOut > d)
        const vacio = salidas.length === 0 && entradas.length === 0 && sequedan.length === 0

        return (
          <div key={d} className="mb-5 break-inside-avoid">
            <h2 className="text-sm font-bold uppercase tracking-wider bg-gray-100 border-l-4 border-black px-2 py-1 mb-2">
              {diaLargo(d)}
            </h2>
            {vacio ? (
              <p className="text-[11px] text-gray-500 pl-2">Sin entradas ni salidas. Ninguna habitación ocupada.</p>
            ) : (
              <>
                {bloque('Salidas', 'hay que limpiar la habitación', salidas, 'sale')}
                {bloque('Entradas', 'hay que tenerla lista', entradas, 'entra')}
                {/* Las que siguen ocupadas van en una línea: no hay nada que hacer con ellas,
                    y en un rango largo repetir la tabla entera cada día llenaba hojas. */}
                {sequedan.length > 0 && (
                  <p className="text-[10px] leading-snug">
                    <span className="font-bold uppercase tracking-widest">Siguen ocupadas: </span>
                    <span className="text-gray-700">
                      {sequedan.map(b => `${nombreDeHabitacion(b.accommodationId)} (${pax(b)})`).join(' · ')}
                    </span>
                  </p>
                )}
              </>
            )}
          </div>
        )
      })}

      {recortado && (
        <p className="text-[11px] text-gray-500 mt-4">
          El detalle por día se corta en {MAXIMO_DE_DIAS} días. La lista completa de abajo sí incluye todo el periodo.
        </p>
      )}

      {/* ── Parte 2: la lista completa, para administración ── */}
      <div className="break-before-page pt-2">
        <div className="border-b-2 border-black pb-3 mb-5">
          <h1 className="text-xl font-bold uppercase tracking-wider">Reservas del periodo</h1>
          <p className="text-sm text-gray-700 mt-0.5">{rangoLargo(desde, hasta)}</p>
        </div>

        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-black text-left">
              <th className="py-1.5 pr-2 text-[10px] uppercase tracking-widest">Localizador</th>
              <th className="py-1.5 px-2 text-[10px] uppercase tracking-widest">Huésped</th>
              <th className="py-1.5 px-2 text-[10px] uppercase tracking-widest">Habitación</th>
              <th className="py-1.5 px-2 text-[10px] uppercase tracking-widest text-center">Entrada</th>
              <th className="py-1.5 px-2 text-[10px] uppercase tracking-widest text-center">Salida</th>
              <th className="py-1.5 px-2 text-[10px] uppercase tracking-widest text-center">Pax</th>
              <th className="py-1.5 pl-2 text-[10px] uppercase tracking-widest">Estado</th>
            </tr>
          </thead>
          <tbody>
            {delRango.map((b, i) => (
              <tr key={b.id} className={`border-b border-gray-300 ${i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}>
                <td className="py-1.5 pr-2 text-[11px] font-mono">{b.locator || '—'}</td>
                <td className="py-1.5 px-2 text-[11px]">{b.guestName}</td>
                <td className="py-1.5 px-2 text-[11px] font-bold">{nombreDeHabitacion(b.accommodationId)}</td>
                <td className="py-1.5 px-2 text-[11px] text-center">{dia(b.checkIn)}</td>
                <td className="py-1.5 px-2 text-[11px] text-center">{dia(b.checkOut)}</td>
                <td className="py-1.5 px-2 text-[11px] text-center">{pax(b)}</td>
                <td className="py-1.5 pl-2 text-[11px]">{estadoDeReserva(b)}</td>
              </tr>
            ))}
            {delRango.length === 0 && (
              <tr>
                <td colSpan={7} className="py-3 text-[11px] text-gray-500">No hay reservas en estas fechas.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-8 text-[10px] text-gray-400 text-center border-t border-gray-200 pt-3">
        Estancia La Cañada · Documento generado por el sistema de administración.
      </div>
    </div>
  )
}

export default PrintableReservationsReport
