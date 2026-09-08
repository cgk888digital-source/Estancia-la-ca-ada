import React, { useState, useEffect, useMemo } from 'react'
import { X, CheckSquare, Square, Loader2, DollarSign, Sparkles, Coins } from 'lucide-react'
import type { Employee } from '../types'
import { supabase } from '../../lib/supabase'

const fmtUsd = (n: number) =>
  new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

const fmtBs = (n: number) =>
  new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'VES', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

interface WeeklyTipsModalProps {
  isOpen: boolean
  onClose: () => void
  employees: Employee[]
  globalTipsBalance: number
  bcvRate: number
  onDistributed: (distributedTotal: number) => void
}

export const WeeklyTipsModal: React.FC<WeeklyTipsModalProps> = ({
  isOpen,
  onClose,
  employees,
  globalTipsBalance,
  bcvRate,
  onDistributed,
}) => {
  // Solo trabajadores activos participan en el reparto
  const activeEmployees = useMemo(() => employees.filter(e => e.status === 'activo'), [employees])

  const [amount, setAmount] = useState<string>('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [customNote, setCustomNote] = useState('')

  // Al abrir el modal, preseleccionar todos los trabajadores activos y el saldo disponible
  useEffect(() => {
    if (isOpen) {
      setSelectedIds(new Set(activeEmployees.map(e => e.id)))
      setAmount(globalTipsBalance > 0 ? String(globalTipsBalance) : '')
      const today = new Date()
      setCustomNote(`Semana ${today.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`)
    }
  }, [isOpen, activeEmployees, globalTipsBalance])

  if (!isOpen) return null

  const numAmount = Math.max(0, parseFloat(amount) || 0)
  const selectedCount = selectedIds.size
  const perWorkerUsd = selectedCount > 0 ? Number((numAmount / selectedCount).toFixed(2)) : 0
  const perWorkerBs = perWorkerUsd * bcvRate

  const handleToggleWorker = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleSelectAll = () => {
    setSelectedIds(new Set(activeEmployees.map(e => e.id)))
  }

  const handleDeselectAll = () => {
    setSelectedIds(new Set())
  }

  const handleSetFullBalance = () => {
    setAmount(String(globalTipsBalance))
  }

  const handleConfirmDistribution = async () => {
    if (numAmount <= 0) {
      alert('Ingresa un monto válido mayor a 0 para repartir.')
      return
    }
    if (selectedCount === 0) {
      alert('Debes seleccionar al menos un trabajador para el reparto.')
      return
    }

    const selectedWorkers = activeEmployees.filter(e => selectedIds.has(e.id))
    const confirmMessage = `¿Confirmar el reparto de ${fmtUsd(numAmount)} entre ${selectedCount} trabajadores?\n\nCada uno recibirá ${fmtUsd(perWorkerUsd)} (~${fmtBs(perWorkerBs)} a tasa BCV ${bcvRate} Bs/€).`

    if (!window.confirm(confirmMessage)) return

    setSubmitting(true)
    const today = new Date().toISOString().split('T')[0]
    const noteSuffix = customNote.trim() ? ` (${customNote.trim()})` : ''

    const transactionsToInsert = selectedWorkers.map(emp => ({
      date: today,
      type: 'egreso',
      category: 'propinas',
      description: `Reparto Semanal de Propinas${noteSuffix} — ${emp.name} (Tasa BCV: ${bcvRate} Bs/€)`,
      amount: perWorkerUsd,
      payment_method: 'transferencia',
      related_to: emp.name,
    }))

    const { error } = await supabase.from('transactions').insert(transactionsToInsert)

    if (error) {
      console.error('Error insertando egresos de propinas:', error)
      alert(`Hubo un error al registrar el reparto: ${error.message}`)
      setSubmitting(false)
      return
    }

    const totalDeducted = perWorkerUsd * selectedCount
    onDistributed(totalDeducted)
    setSubmitting(false)
    alert(`¡Reparto completado con éxito!\nSe entregaron ${fmtUsd(perWorkerUsd)} a cada uno de los ${selectedCount} trabajadores.`)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-100">
        
        {/* Header */}
        <div className="p-6 pb-4 border-b border-gray-100 flex items-start justify-between gap-4 bg-gradient-to-r from-emerald-50/70 to-teal-50/30">
          <div>
            <div className="flex items-center gap-2 text-emerald-700">
              <Coins size={20} className="text-emerald-600" />
              <span className="text-xs font-bold uppercase tracking-wider">Fondo Semanal</span>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mt-1">Reparto Semanal de Propinas</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Distribución en partes iguales a los trabajadores activos de esta semana
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="p-2 hover:bg-white/80 rounded-full transition-colors text-gray-400 hover:text-gray-700"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">

          {/* Balance card & Amount Input */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Saldo actual en fondo */}
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200/70 flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Saldo Disponible en Fondo</span>
                <p className="text-2xl font-bold text-emerald-700 mt-1">{fmtUsd(globalTipsBalance)}</p>
              </div>
              {globalTipsBalance > 0 && (
                <button
                  type="button"
                  onClick={handleSetFullBalance}
                  className="mt-3 text-xs font-bold text-emerald-700 bg-emerald-100/70 hover:bg-emerald-200/80 px-3 py-1.5 rounded-lg transition-colors w-fit"
                >
                  Repartir todo el saldo
                </button>
              )}
            </div>

            {/* Monto a repartir */}
            <div className="bg-emerald-50/50 rounded-2xl p-4 border border-emerald-200/70">
              <label className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 block mb-1">
                Monto Semanal a Repartir ($)
              </label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-base">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="w-full bg-white border border-emerald-300 rounded-xl pl-8 pr-3 py-2 text-lg font-bold text-gray-900 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
              <p className="text-[11px] text-gray-500 mt-1.5">
                Tasa BCV oficial: <strong className="text-gray-700">{bcvRate} Bs/€</strong>
              </p>
            </div>
          </div>

          {/* Nota opcional de semana */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 block mb-1">
              Identificador / Nota de la Semana
            </label>
            <input
              type="text"
              placeholder="Ej. Semana 36 / 1ra semana Septiembre"
              value={customNote}
              onChange={e => setCustomNote(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 outline-none focus:bg-white focus:border-emerald-500 transition-all"
            />
          </div>

          {/* Worker Selection Header */}
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-sm font-bold text-gray-900">
                  Trabajadores que laboraron esta semana ({selectedCount} de {activeEmployees.length})
                </h3>
                <p className="text-xs text-gray-500">Marca o desmarca quiénes reciben propina semanal</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 px-2.5 py-1 rounded-lg hover:bg-emerald-50 transition-colors"
                >
                  Marcar todos
                </button>
                <span className="text-gray-300">|</span>
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  className="text-xs font-semibold text-gray-500 hover:text-gray-700 px-2.5 py-1 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Desmarcar todos
                </button>
              </div>
            </div>

            {/* List of active workers */}
            <div className="border border-gray-200 rounded-2xl divide-y divide-gray-100 max-h-56 overflow-y-auto custom-scrollbar">
              {activeEmployees.length === 0 ? (
                <div className="p-6 text-center text-sm text-gray-400">
                  No hay empleados activos en el sistema.
                </div>
              ) : (
                activeEmployees.map(emp => {
                  const isChecked = selectedIds.has(emp.id)
                  return (
                    <label
                      key={emp.id}
                      className={`flex items-center justify-between p-3.5 cursor-pointer transition-colors ${
                        isChecked ? 'bg-emerald-50/30 hover:bg-emerald-50/60' : 'hover:bg-gray-50 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative flex items-center justify-center">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleWorker(emp.id)}
                            className="sr-only"
                          />
                          {isChecked ? (
                            <CheckSquare size={18} className="text-emerald-600 shrink-0" />
                          ) : (
                            <Square size={18} className="text-gray-400 shrink-0" />
                          )}
                        </div>

                        <div className="w-8 h-8 rounded-full bg-[#C5A059]/15 text-[#C5A059] flex items-center justify-center font-bold text-xs shrink-0">
                          {emp.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>

                        <div>
                          <p className="text-sm font-semibold text-gray-900 leading-none">{emp.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-gray-500">{emp.role}</span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                              emp.employeeType === 'fijo' ? 'bg-amber-100/70 text-amber-800' : 'bg-blue-100/70 text-blue-800'
                            }`}>
                              {emp.employeeType === 'fijo' ? 'Fijo' : 'Eventual'}
                            </span>
                            <span className="text-[10px] text-gray-400">
                              {emp.paymentFrequency === 'semanal' ? '🗓 Semanal' : '📅 Quincenal'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right pl-3">
                        {isChecked && perWorkerUsd > 0 ? (
                          <>
                            <span className="text-sm font-bold text-emerald-700">+{fmtUsd(perWorkerUsd)}</span>
                            <p className="text-[10px] text-gray-400">~{fmtBs(perWorkerBs)}</p>
                          </>
                        ) : (
                          <span className="text-xs text-gray-400 font-medium">Excluido</span>
                        )}
                      </div>
                    </label>
                  )
                })
              )}
            </div>
          </div>

          {/* Equal split summary */}
          {selectedCount > 0 && numAmount > 0 && (
            <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl p-5 text-white shadow-lg space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles size={18} className="text-emerald-200" />
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-100">
                    Cálculo Equitativo Semanal
                  </span>
                </div>
                <span className="text-xs bg-white/20 px-2.5 py-1 rounded-full font-bold">
                  {selectedCount} persona{selectedCount !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-1 border-t border-white/20">
                <div>
                  <p className="text-xs text-emerald-100 font-medium">Cada trabajador recibe</p>
                  <p className="text-3xl font-extrabold text-white mt-0.5">{fmtUsd(perWorkerUsd)}</p>
                  <p className="text-xs text-emerald-200 mt-0.5">Equivalente a {fmtBs(perWorkerBs)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-emerald-100 font-medium">Total distribuido</p>
                  <p className="text-2xl font-bold text-white mt-0.5">{fmtUsd(perWorkerUsd * selectedCount)}</p>
                  <p className="text-xs text-emerald-200 mt-0.5">
                    {globalTipsBalance >= (perWorkerUsd * selectedCount)
                      ? `Remanente: ${fmtUsd(globalTipsBalance - (perWorkerUsd * selectedCount))}`
                      : 'Fondo cubierto'}
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-6 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-900 rounded-xl hover:bg-gray-200/60 transition-colors"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleConfirmDistribution}
            disabled={submitting || selectedCount === 0 || numAmount <= 0}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-emerald-600/20 transition-all"
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Procesando reparto...</span>
              </>
            ) : (
              <>
                <DollarSign size={16} />
                <span>Repartir {fmtUsd(perWorkerUsd)} a {selectedCount} trabajador{selectedCount !== 1 ? 'es' : ''}</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  )
}

export default WeeklyTipsModal
