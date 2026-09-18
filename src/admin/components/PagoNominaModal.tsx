import React, { useState } from 'react'
import { X, Plus, Trash2, Loader2, DollarSign, Check, Wallet } from 'lucide-react'
import type { Employee, EmployeeBonus } from '../types'
import {
  type RenglonDePago, type Moneda, type MetodoDePago, type OrigenBs,
  metodosPorMoneda, etiquetaDeParte, renglonVacio, renglonPorDefecto,
  dolaresDeRenglon, sumaDeRenglones, renglonCompleto, TOLERANCIA,
} from '../../utils/pagoNomina'

/**
 * El formulario de pago de la nómina de un empleado.
 *
 * Arriba, lo que se le debe: sueldo (o días, si es eventual) más los bonos pendientes.
 * Debajo, cómo se le paga, en tantos renglones como haga falta. El botón no se activa
 * hasta que los renglones cuadran con lo que se le debe: un pago a medias que nadie nota
 * es justo lo que descuadra la contabilidad a fin de mes.
 */

const fmt = (n: number) =>
  new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n)

const fmtBs = (n: number) =>
  'Bs. ' + n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const conDecimales = (n: number) =>
  n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export interface PagoConfirmado {
  renglones: RenglonDePago[]
  /** Solo para eventuales. */
  dias: number
  total: number
}

interface Props {
  emp: Employee
  bonos: EmployeeBonus[]
  /** Tasa del euro del BCV: la que la posada usa para pagar en bolívares. */
  tasaReferencia: number
  paying: boolean
  onConfirm: (pago: PagoConfirmado) => void
  onClose: () => void
}

const PagoNominaModal: React.FC<Props> = ({ emp, bonos, tasaReferencia, paying, onConfirm, onClose }) => {
  const esEventual = emp.employeeType === 'eventual'
  const diasPorDefecto = emp.paymentFrequency === 'semanal' ? 7 : emp.contractedDays || 1
  const [dias, setDias] = useState(diasPorDefecto)

  const base = esEventual ? emp.dailyRate * dias : emp.salary
  const totalBonos = bonos.reduce((s, b) => s + b.amount, 0)
  const total = Math.round((base + totalBonos) * 100) / 100

  const [renglones, setRenglones] = useState<RenglonDePago[]>(() => [renglonPorDefecto(total, tasaReferencia)])
  // Mientras no se toque nada, el renglón de siempre sigue a lo que se debe. En cuanto se
  // toca un renglón, manda quien paga.
  const [tocado, setTocado] = useState(false)

  const cambiarDias = (nuevos: number) => {
    const d = Math.max(1, nuevos)
    setDias(d)
    if (!tocado) {
      const nuevoTotal = Math.round((emp.dailyRate * d + totalBonos) * 100) / 100
      setRenglones([renglonPorDefecto(nuevoTotal, tasaReferencia)])
    }
  }

  const actualizar = (id: string, cambios: Partial<RenglonDePago>) => {
    setTocado(true)
    setRenglones(prev => prev.map(r => (r.id === id ? { ...r, ...cambios } : r)))
  }

  const cambiarMoneda = (r: RenglonDePago, moneda: Moneda) => {
    if (r.moneda === moneda) return
    const limpio = renglonVacio(moneda, tasaReferencia)
    actualizar(r.id, { moneda, metodo: limpio.metodo, dolares: '', bolivares: '', tasa: limpio.tasa, origenBs: 'cuenta' })
  }

  const ponerLoQueFalta = (r: RenglonDePago) => {
    const otros = sumaDeRenglones(renglones.filter(x => x.id !== r.id))
    const restante = Math.max(0, Math.round((total - otros) * 100) / 100)
    if (r.moneda === 'usd') {
      actualizar(r.id, { dolares: restante.toFixed(2) })
      return
    }
    const tasa = Number(String(r.tasa).replace(',', '.'))
    if (!(tasa > 0)) {
      alert('Escriba primero la tasa de este renglón.')
      return
    }
    actualizar(r.id, { bolivares: (Math.round(restante * tasa * 100) / 100).toFixed(2) })
  }

  const agregar = () => {
    setTocado(true)
    setRenglones(prev => [...prev, renglonVacio('usd', tasaReferencia)])
  }

  const quitar = (id: string) => {
    setTocado(true)
    setRenglones(prev => prev.filter(r => r.id !== id))
  }

  const suma = sumaDeRenglones(renglones)
  const diferencia = Math.round((total - suma) * 100) / 100
  const todosCompletos = renglones.length > 0 && renglones.every(renglonCompleto)
  const cuadra = todosCompletos && Math.abs(diferencia) <= TOLERANCIA

  const campo = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#C5A059] bg-white'
  const etiqueta = 'text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto p-6 space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Registrar pago</h2>
            <p className="text-sm text-gray-500 mt-0.5">{emp.name} · {emp.role}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {/* Días, solo eventuales */}
        {esEventual && (
          <div>
            <label className={etiqueta}>
              {emp.paymentFrequency === 'semanal' ? 'Días de la semana a pagar' : 'Días trabajados a pagar'}
            </label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => cambiarDias(dias - 1)}
                className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 font-bold text-gray-700 text-lg"
              >−</button>
              <input
                type="number"
                min={1}
                value={dias}
                onChange={e => cambiarDias(Number(e.target.value))}
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-center text-lg font-bold outline-none focus:border-[#C5A059]"
              />
              <button
                onClick={() => cambiarDias(dias + 1)}
                className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 font-bold text-gray-700 text-lg"
              >+</button>
            </div>
          </div>
        )}

        {/* Lo que se le debe */}
        <div className="rounded-2xl bg-gray-50 border border-gray-100 p-4 space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">
              {esEventual ? `${dias} día${dias === 1 ? '' : 's'} × ${fmt(emp.dailyRate)}` : 'Sueldo del período'}
            </span>
            <span className="font-semibold text-gray-900">{fmt(base)}</span>
          </div>
          {bonos.map(b => (
            <div key={b.id} className="flex justify-between text-sm gap-3">
              <span className="text-gray-500 truncate">Bono{b.concept ? ' — ' + b.concept : ''}</span>
              <span className="font-semibold text-emerald-600 shrink-0">{fmt(b.amount)}</span>
            </div>
          ))}
          <div className="flex justify-between pt-2 border-t border-gray-200">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Total a pagar</span>
            <span className="text-lg font-bold text-[#3D2B1F]">{fmt(total)}</span>
          </div>
        </div>

        {/* Cómo se paga */}
        <div className="space-y-3">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Cómo se le paga</p>

          {renglones.map((r, i) => {
            const dolares = dolaresDeRenglon(r)
            return (
              <div key={r.id} className="rounded-2xl border border-gray-200 p-3.5 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    {renglones.length > 1 ? `Pago ${i + 1}` : 'Pago'}
                  </span>
                  <div className="flex ml-auto rounded-lg bg-gray-100 p-0.5">
                    {(['usd', 'bs'] as Moneda[]).map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => cambiarMoneda(r, m)}
                        className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                          r.moneda === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                        }`}
                      >
                        {m === 'usd' ? 'Dólares' : 'Bolívares'}
                      </button>
                    ))}
                  </div>
                  {renglones.length > 1 && (
                    <button
                      type="button"
                      onClick={() => quitar(r.id)}
                      className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg"
                      title="Quitar este pago"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={etiqueta}>Forma de pago</label>
                    <select
                      value={r.metodo}
                      onChange={e => actualizar(r.id, { metodo: e.target.value as MetodoDePago })}
                      className={campo}
                    >
                      {metodosPorMoneda[r.moneda].map(m => (
                        <option key={m} value={m}>{etiquetaDeParte(m, r.moneda === 'bs')}</option>
                      ))}
                    </select>
                  </div>

                  {r.moneda === 'usd' ? (
                    <div>
                      <label className={etiqueta}>Monto (USD)</label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={r.dolares}
                        onChange={e => actualizar(r.id, { dolares: e.target.value })}
                        className={campo}
                      />
                    </div>
                  ) : (
                    <div>
                      <label className={etiqueta}>¿De dónde sale?</label>
                      <select
                        value={r.origenBs}
                        onChange={e => actualizar(r.id, { origenBs: e.target.value as OrigenBs })}
                        className={campo}
                      >
                        <option value="cuenta">Cuenta del hotel</option>
                        <option value="fondo">Fondo en bolívares</option>
                      </select>
                    </div>
                  )}
                </div>

                {r.moneda === 'bs' && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={etiqueta}>Bolívares</label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={r.bolivares}
                        onChange={e => actualizar(r.id, { bolivares: e.target.value })}
                        className={campo}
                      />
                    </div>
                    <div>
                      <label className={etiqueta}>Tasa aplicada</label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        inputMode="decimal"
                        placeholder="Bs por $"
                        value={r.tasa}
                        onChange={e => actualizar(r.id, { tasa: e.target.value })}
                        className={campo}
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] text-gray-500 flex items-center gap-1 min-w-0">
                    {r.moneda === 'usd' && r.metodo === 'efectivo' && (
                      <><Wallet size={12} className="text-[#C5A059] shrink-0" /> Sale de la caja chica en dólares</>
                    )}
                    {r.moneda === 'usd' && r.metodo !== 'efectivo' && 'Sale de la cuenta del hotel'}
                    {r.moneda === 'bs' && dolares > 0 && (
                      <span className="truncate">
                        {fmtBs(Number(String(r.bolivares).replace(',', '.')))} ÷ {conDecimales(Number(String(r.tasa).replace(',', '.')))} ={' '}
                        <strong className="text-gray-800">{fmt(dolares)}</strong>
                      </span>
                    )}
                  </p>
                  {Math.abs(diferencia) > TOLERANCIA && (
                    <button
                      type="button"
                      onClick={() => ponerLoQueFalta(r)}
                      className="text-[11px] font-bold text-[#C5A059] hover:underline shrink-0"
                    >
                      Poner lo que falta
                    </button>
                  )}
                </div>
              </div>
            )
          })}

          <button
            type="button"
            onClick={agregar}
            className="w-full py-2.5 border-2 border-dashed border-gray-200 hover:border-[#C5A059] rounded-2xl text-sm font-bold text-gray-500 hover:text-[#3D2B1F] transition-all flex items-center justify-center gap-2"
          >
            <Plus size={16} /> Añadir otra forma de pago
          </button>
        </div>

        {/* Cuadre */}
        <div className={`rounded-2xl px-4 py-3 flex items-center justify-between text-sm font-bold ${
          cuadra ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'
        }`}>
          <span>Pagado {fmt(suma)} de {fmt(total)}</span>
          <span>
            {cuadra
              ? <span className="flex items-center gap-1"><Check size={16} /> Cuadra</span>
              : !todosCompletos
                ? 'Falta completar un pago'
                : diferencia > 0 ? `Faltan ${fmt(diferencia)}` : `Sobran ${fmt(-diferencia)}`}
          </span>
        </div>

        <button
          onClick={() => onConfirm({ renglones, dias, total })}
          disabled={!cuadra || paying}
          className="w-full py-3.5 bg-[#3D2B1F] hover:bg-[#2a1d14] text-white rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {paying ? <Loader2 size={16} className="animate-spin" /> : <DollarSign size={16} />}
          Confirmar pago de {fmt(total)}
        </button>
      </div>
    </div>
  )
}

export default PagoNominaModal
