import React, { useState, useMemo, useEffect } from 'react'
import { Plus, Search, X, Check, CalendarDays, ChevronDown, Loader2 } from 'lucide-react'
import { mockTransactions, categoryLabels, categoryColors } from '../data/mockData'
import type { Transaction, TransactionType, TransactionCategory, PaymentMethod } from '../types'
import { supabase } from '../../lib/supabase'

interface Props {
  typeFilter?: TransactionType
}

type DatePeriod = 'hoy' | 'semana' | 'mes' | 'año' | 'personalizado' | 'todo'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

const incomeCategories: TransactionCategory[] = ['alojamiento', 'restaurante', 'excursiones', 'bar_cava', 'otros_ingresos']
const expenseCategories: TransactionCategory[] = ['empleados', 'alimentos', 'mantenimiento', 'servicios', 'comisiones', 'otros_egresos']
const paymentMethods: PaymentMethod[] = ['efectivo', 'transferencia', 'tarjeta', 'cheque']

const periodLabels: Record<DatePeriod, string> = {
  hoy: 'Hoy',
  semana: 'Semana',
  mes: 'Mes',
  año: 'Año',
  personalizado: 'Personalizado',
  todo: 'Todo',
}

const mapDbTransactionToReact = (db: any): Transaction => ({
  id: db.id,
  date: db.date,
  type: db.type as TransactionType,
  category: db.category as TransactionCategory,
  description: db.description,
  amount: Number(db.amount) || 0,
  paymentMethod: db.payment_method as PaymentMethod,
  relatedTo: db.related_to || ''
})

function getDateRange(period: DatePeriod, customFrom: string, customTo: string): { from: Date | null; to: Date | null } {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  switch (period) {
    case 'hoy':
      return { from: today, to: today }
    case 'semana': {
      const from = new Date(today)
      from.setDate(today.getDate() - 6)
      return { from, to: today }
    }
    case 'mes':
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: today }
    case 'año':
      return { from: new Date(now.getFullYear(), 0, 1), to: today }
    case 'personalizado':
      return {
        from: customFrom ? new Date(customFrom) : null,
        to: customTo ? new Date(customTo) : null,
      }
    default:
      return { from: null, to: null }
  }
}

const TransactionsPage: React.FC<Props> = ({ typeFilter }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryF, setCategoryF] = useState<TransactionCategory | 'todas'>('todas')
  const [period, setPeriod] = useState<DatePeriod>('mes')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showCategoryMenu, setShowCategoryMenu] = useState(false)

  const [form, setForm] = useState<Omit<Transaction, 'id'>>({
    date: new Date().toISOString().split('T')[0],
    type: typeFilter ?? 'ingreso',
    category: typeFilter === 'egreso' ? 'empleados' : 'alojamiento',
    description: '',
    amount: 0,
    paymentMethod: 'transferencia',
    relatedTo: '',
  })

  const fetchTransactions = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('date', { ascending: false })

    if (error) {
      console.error('Error fetching transactions:', error)
      setTransactions(mockTransactions)
    } else if (data && data.length > 0) {
      setTransactions(data.map(mapDbTransactionToReact))
    } else {
      // Seed table with mockTransactions
      const dbMocks = mockTransactions.map(t => ({
        date: t.date,
        type: t.type,
        category: t.category,
        description: t.description,
        amount: t.amount,
        payment_method: t.paymentMethod,
        related_to: t.relatedTo || null
      }))
      const { data: inserted, error: insErr } = await supabase
        .from('transactions')
        .insert(dbMocks)
        .select('*')
      
      if (insErr) {
        console.error('Error seeding transactions:', insErr)
        setTransactions(mockTransactions)
      } else if (inserted) {
        setTransactions(inserted.map(mapDbTransactionToReact))
      } else {
        setTransactions(mockTransactions)
      }
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchTransactions()
  }, [])

  const filtered = useMemo(() => {
    const { from, to } = getDateRange(period, customFrom, customTo)

    return transactions.filter(t => {
      const matchType = typeFilter ? t.type === typeFilter : true
      const matchSearch =
        t.description.toLowerCase().includes(search.toLowerCase()) ||
        (t.relatedTo ?? '').toLowerCase().includes(search.toLowerCase())
      const matchCat = categoryF === 'todas' || t.category === categoryF

      let matchDate = true
      if (from || to) {
        const txDate = new Date(t.date)
        const txDay = new Date(txDate.getFullYear(), txDate.getMonth(), txDate.getDate())
        if (from && txDay < from) matchDate = false
        if (to && txDay > to) matchDate = false
      }

      return matchType && matchSearch && matchCat && matchDate
    })
  }, [transactions, typeFilter, search, categoryF, period, customFrom, customTo])

  const totalIngresos = filtered.filter(t => t.type === 'ingreso').reduce((s, t) => s + t.amount, 0)
  const totalEgresos = filtered.filter(t => t.type === 'egreso').reduce((s, t) => s + t.amount, 0)
  const total = typeFilter === 'ingreso' ? totalIngresos : typeFilter === 'egreso' ? totalEgresos : totalIngresos - totalEgresos

  const handleSave = async () => {
    if (!form.description || form.amount <= 0) return
    
    const dbTx = {
      date: form.date,
      type: form.type,
      category: form.category,
      description: form.description,
      amount: form.amount,
      payment_method: form.paymentMethod,
      related_to: form.relatedTo || null
    }

    const { data, error } = await supabase
      .from('transactions')
      .insert([dbTx])
      .select('*')

    if (error) {
      console.error('Error saving transaction:', error)
      return
    }

    if (data && data[0]) {
      setTransactions(prev => [mapDbTransactionToReact(data[0]), ...prev])
    }

    setSaved(true)
    setTimeout(() => {
      setSaved(false)
      setShowModal(false)
      setForm({
        date: new Date().toISOString().split('T')[0],
        type: typeFilter ?? 'ingreso',
        category: typeFilter === 'egreso' ? 'empleados' : 'alojamiento',
        description: '',
        amount: 0,
        paymentMethod: 'transferencia',
        relatedTo: '',
      })
    }, 1200)
  }

  const availableCategories = form.type === 'ingreso' ? incomeCategories : expenseCategories
  const allCategories = typeFilter === 'ingreso' ? incomeCategories : typeFilter === 'egreso' ? expenseCategories : [...incomeCategories, ...expenseCategories]

  const title = typeFilter === 'ingreso' ? 'Ingresos' : typeFilter === 'egreso' ? 'Egresos' : 'Transacciones'
  const accentColor = typeFilter === 'egreso' ? '#EF4444' : '#C5A059'
  const btnColor = typeFilter === 'egreso' ? 'bg-red-500 hover:bg-red-600' : 'bg-[#C5A059] hover:bg-[#b8943f]'
  const totalColor = typeFilter === 'ingreso' ? 'text-emerald-600' : typeFilter === 'egreso' ? 'text-red-500' : total >= 0 ? 'text-emerald-600' : 'text-red-500'

  const periods: DatePeriod[] = ['hoy', 'semana', 'mes', 'año', 'personalizado', 'todo']

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {filtered.length} registros · {typeFilter ? 'Total' : 'Balance'}:{' '}
            <span className={`font-bold ${totalColor}`}>{fmt(Math.abs(total))}</span>
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className={`flex items-center gap-2 px-4 py-2.5 ${btnColor} text-white rounded-xl text-sm font-bold transition-all shadow-sm`}
        >
          <Plus size={16} />
          Nuevo {typeFilter === 'egreso' ? 'Egreso' : 'Ingreso'}
        </button>
      </div>

      {/* Date period selector */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <CalendarDays size={15} className="text-gray-400" />
          <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Período</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {periods.map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all
                ${period === p
                  ? 'text-white shadow-sm'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
              style={period === p ? { backgroundColor: accentColor } : {}}
            >
              {periodLabels[p]}
            </button>
          ))}
        </div>

        {/* Custom date range */}
        {period === 'personalizado' && (
          <div className="flex flex-wrap gap-3 pt-1">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">Desde</label>
              <input
                type="date"
                value={customFrom}
                onChange={e => setCustomFrom(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#C5A059] transition-colors"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">Hasta</label>
              <input
                type="date"
                value={customTo}
                onChange={e => setCustomTo(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#C5A059] transition-colors"
              />
            </div>
          </div>
        )}
      </div>

      {/* Search + Category filter */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2.5 flex-1 min-w-[200px]">
          <Search size={16} className="text-gray-400 shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar descripción o proveedor..."
            className="flex-1 text-sm outline-none bg-transparent text-gray-700 placeholder-gray-400"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-gray-300 hover:text-gray-500 transition-colors">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Category dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowCategoryMenu(v => !v)}
            className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-600 hover:border-gray-300 transition-colors"
          >
            {categoryF !== 'todas' && (
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: categoryColors[categoryF] }}
              />
            )}
            <span className="font-medium">{categoryF === 'todas' ? 'Todas las categorías' : categoryLabels[categoryF]}</span>
            <ChevronDown size={14} className="text-gray-400" />
          </button>

          {showCategoryMenu && (
            <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-2xl shadow-xl z-20 py-2 min-w-[200px]">
              <button
                onClick={() => { setCategoryF('todas'); setShowCategoryMenu(false) }}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-gray-50
                  ${categoryF === 'todas' ? 'font-bold text-gray-900' : 'text-gray-600'}`}
              >
                Todas las categorías
              </button>
              <div className="h-px bg-gray-100 my-1" />
              {allCategories.map(c => (
                <button
                  key={c}
                  onClick={() => { setCategoryF(c); setShowCategoryMenu(false) }}
                  className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-3 transition-colors hover:bg-gray-50
                    ${categoryF === c ? 'font-bold text-gray-900' : 'text-gray-600'}`}
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: categoryColors[c] }} />
                  {categoryLabels[c]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Summary bar (only when no typeFilter) */}
      {!typeFilter && filtered.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-emerald-50 rounded-2xl px-4 py-3 border border-emerald-100">
            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-0.5">Ingresos</p>
            <p className="text-base font-bold text-emerald-700">{fmt(totalIngresos)}</p>
          </div>
          <div className="bg-red-50 rounded-2xl px-4 py-3 border border-red-100">
            <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest mb-0.5">Egresos</p>
            <p className="text-base font-bold text-red-600">{fmt(totalEgresos)}</p>
          </div>
          <div className={`rounded-2xl px-4 py-3 border ${total >= 0 ? 'bg-amber-50 border-amber-100' : 'bg-red-50 border-red-100'}`}>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-0.5">Balance</p>
            <p className={`text-base font-bold ${total >= 0 ? 'text-amber-700' : 'text-red-600'}`}>{fmt(total)}</p>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left text-xs font-bold text-gray-400 uppercase tracking-widest px-6 py-4">Fecha</th>
                <th className="text-left text-xs font-bold text-gray-400 uppercase tracking-widest px-4 py-4">Descripción</th>
                <th className="text-left text-xs font-bold text-gray-400 uppercase tracking-widest px-4 py-4 hidden md:table-cell">Categoría</th>
                <th className="text-left text-xs font-bold text-gray-400 uppercase tracking-widest px-4 py-4 hidden lg:table-cell">Método</th>
                <th className="text-right text-xs font-bold text-gray-400 uppercase tracking-widest px-6 py-4">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-16">
                    <Loader2 size={32} className="text-[#C5A059] mx-auto animate-spin mb-3" />
                    <p className="text-sm text-gray-400 font-medium">Cargando transacciones...</p>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-16">
                    <CalendarDays size={32} className="text-gray-200 mx-auto mb-3" />
                    <p className="text-sm text-gray-400 font-medium">Sin registros para el período seleccionado</p>
                    <p className="text-xs text-gray-300 mt-1">Prueba cambiando el filtro de fecha o categoría</p>
                  </td>
                </tr>
              ) : (
                filtered.map(tx => (
                  <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                      {new Date(tx.date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: '2-digit' })}
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-sm font-medium text-gray-900">{tx.description}</p>
                      {tx.relatedTo && <p className="text-xs text-gray-400 mt-0.5">{tx.relatedTo}</p>}
                    </td>
                    <td className="px-4 py-4 hidden md:table-cell">
                      <span
                        className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest text-white"
                        style={{ backgroundColor: categoryColors[tx.category] }}
                      >
                        {categoryLabels[tx.category]}
                      </span>
                    </td>
                    <td className="px-4 py-4 hidden lg:table-cell">
                      <span className="text-xs text-gray-500 capitalize">{tx.paymentMethod}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`text-sm font-bold ${tx.type === 'ingreso' ? 'text-emerald-600' : 'text-red-500'}`}>
                        {tx.type === 'ingreso' ? '+' : '-'}{fmt(tx.amount)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Click outside to close category menu */}
      {showCategoryMenu && (
        <div className="fixed inset-0 z-10" onClick={() => setShowCategoryMenu(false)} />
      )}

      {/* Modal nueva transacción */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Nuevo Registro</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                <X size={18} className="text-gray-500" />
              </button>
            </div>

            {!typeFilter && (
              <div className="flex rounded-xl overflow-hidden border border-gray-200">
                {(['ingreso', 'egreso'] as TransactionType[]).map(t => (
                  <button
                    key={t}
                    onClick={() => setForm(f => ({ ...f, type: t, category: t === 'ingreso' ? 'alojamiento' : 'empleados' }))}
                    className={`flex-1 py-2.5 text-sm font-bold capitalize transition-all
                      ${form.type === t
                        ? t === 'ingreso' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
                        : 'text-gray-400 hover:bg-gray-50'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">Fecha</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C5A059] transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">Monto (ARS)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={form.amount || ''}
                    onChange={e => setForm(f => ({ ...f, amount: Number(e.target.value) }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C5A059] transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">Descripción</label>
                <input
                  type="text"
                  placeholder="Descripción del movimiento..."
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C5A059] transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">Categoría</label>
                  <select
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value as TransactionCategory }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C5A059] transition-colors bg-white"
                  >
                    {availableCategories.map(c => (
                      <option key={c} value={c}>{categoryLabels[c]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">Método de Pago</label>
                  <select
                    value={form.paymentMethod}
                    onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value as PaymentMethod }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C5A059] transition-colors bg-white capitalize"
                  >
                    {paymentMethods.map(m => (
                      <option key={m} value={m} className="capitalize">{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">Proveedor / Relacionado (opcional)</label>
                <input
                  type="text"
                  placeholder="Nombre del proveedor, empleado, cliente..."
                  value={form.relatedTo}
                  onChange={e => setForm(f => ({ ...f, relatedTo: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C5A059] transition-colors"
                />
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={!form.description || form.amount <= 0}
              className={`w-full py-3.5 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2
                ${saved
                  ? 'bg-emerald-500 text-white'
                  : !form.description || form.amount <= 0
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : `${btnColor} text-white shadow-lg`}`}
            >
              {saved ? <><Check size={16} /> Guardado</> : 'Guardar Registro'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default TransactionsPage
