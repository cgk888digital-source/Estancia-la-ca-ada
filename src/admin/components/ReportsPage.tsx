import React, { useState, useEffect, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell, Legend
} from 'recharts'
import { Loader2, X, Utensils, Users, Home } from 'lucide-react'
import { mockTransactions, mockMonthlyData, categoryLabels, categoryColors } from '../data/mockData'
import type { Transaction, TransactionType, TransactionCategory, PaymentMethod, Booking } from '../types'
import { supabase } from '../../lib/supabase'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

interface DbTransaction {
  id: string
  type: string
  category: string
  description: string
  amount: number | string
  date: string
  payment_method: string
  related_to?: string | null
}

const ReportsPage: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)

  // Filtering State
  const [filterType, setFilterType] = useState<'dia' | 'semana' | 'mes' | 'año'>('mes')
  const [filterDate, setFilterDate] = useState<string>(new Date().toISOString().substring(0, 10))

  // Modal State
  const [modalOpen, setModalOpen] = useState(false)
  const [modalTitle, setModalTitle] = useState('')
  const [modalData, setModalData] = useState<Transaction[]>([])

  useEffect(() => {
    let active = true

    const fetchData = async () => {
      const [txRes, bRes] = await Promise.all([
        supabase.from('transactions').select('*').order('date', { ascending: false }),
        supabase.from('bookings').select('*')
      ])

      if (!active) return

      if (txRes.data) {
        setTransactions(txRes.data.map((db: DbTransaction) => ({
          id: db.id,
          date: db.date,
          type: db.type as TransactionType,
          category: db.category as TransactionCategory,
          description: db.description,
          amount: Number(db.amount) || 0,
          paymentMethod: db.payment_method as PaymentMethod,
          relatedTo: db.related_to || ''
        })))
      }
      
      if (bRes.data) {
        setBookings(bRes.data.map(b => ({
          ...b,
          accommodationId: Number(b.accommodation_id),
          guestName: b.guest_name,
          checkIn: b.check_in,
          checkOut: b.check_out,
          totalAmount: Number(b.total_amount),
          amountPaid: Number(b.amount_paid),
          paymentStatus: b.payment_status,
          guestsCount: b.guests_count || { adults: 2, children: 0 }
        })) as unknown as Booking[])
      }

      setLoading(false)
    }

    fetchData()
    return () => { active = false }
  }, [])

  const txList = transactions.length > 0 ? transactions : mockTransactions

  // Filter Logic
  const getFilterPrefix = () => {
    if (filterType === 'dia') return filterDate.substring(0, 10) // YYYY-MM-DD
    if (filterType === 'mes') return filterDate.substring(0, 7) // YYYY-MM
    if (filterType === 'año') return filterDate.substring(0, 4) // YYYY
    
    if (filterType === 'semana') {
      // Calculate start of week (Monday)
      const d = new Date(filterDate)
      const day = d.getDay()
      const diff = d.getDate() - day + (day === 0 ? -6 : 1)
      const startOfWeek = new Date(d.setDate(diff))
      const endOfWeek = new Date(startOfWeek)
      endOfWeek.setDate(startOfWeek.getDate() + 6)
      return { start: startOfWeek.toISOString().substring(0, 10), end: endOfWeek.toISOString().substring(0, 10) }
    }
    return ''
  }

  const isDateInFilter = (dateStr: string) => {
    const prefix = getFilterPrefix()
    if (typeof prefix === 'string') {
      return dateStr.startsWith(prefix)
    } else {
      return dateStr >= prefix.start && dateStr <= prefix.end
    }
  }

  const filteredTx = useMemo(() => txList.filter(t => isDateInFilter(t.date)), [txList, filterType, filterDate])
  const filteredBookings = useMemo(() => bookings.filter(b => isDateInFilter(b.checkIn)), [bookings, filterType, filterDate])

  const ingresos = useMemo(() => filteredTx.filter(t => t.type === 'ingreso').reduce((s, t) => s + t.amount, 0), [filteredTx])
  const egresos = useMemo(() => filteredTx.filter(t => t.type === 'egreso').reduce((s, t) => s + t.amount, 0), [filteredTx])
  const neto = ingresos - egresos
  const margin = ingresos > 0 ? (neto / ingresos * 100) : 0

  // Specific Reports Data
  const fbCategories = ['restaurante', 'bebidas', 'almuerzos', 'alimentos']
  const fbIngresos = filteredTx.filter(t => t.type === 'ingreso' && fbCategories.includes(t.category)).reduce((s, t) => s + t.amount, 0)
  const nominaEgresos = filteredTx.filter(t => t.category === 'empleados').reduce((s, t) => s + t.amount, 0)

  // Cabins Report Data
  const cabinReport = useMemo(() => {
    const counts: Record<number, number> = {}
    filteredBookings.forEach(b => {
      counts[b.accommodationId] = (counts[b.accommodationId] || 0) + 1
    })
    return Object.entries(counts)
      .map(([id, count]) => ({ id: Number(id), count }))
      .sort((a, b) => b.count - a.count)
  }, [filteredBookings])

  // Charts Data
  const incomeByCategory = useMemo(() => {
    return filteredTx
      .filter(t => t.type === 'ingreso')
      .reduce((acc, t) => {
        const existing = acc.find(a => a.category === t.category)
        if (existing) existing.value += t.amount
        else acc.push({ category: t.category, name: categoryLabels[t.category] || t.category, value: t.amount, color: categoryColors[t.category] || '#ccc' })
        return acc
      }, [] as { category: string; name: string; value: number; color: string }[])
      .sort((a, b) => b.value - a.value)
  }, [filteredTx])

  const expenseByCategory = useMemo(() => {
    return filteredTx
      .filter(t => t.type === 'egreso')
      .reduce((acc, t) => {
        const existing = acc.find(a => a.category === t.category)
        if (existing) existing.value += t.amount
        else acc.push({ category: t.category, name: categoryLabels[t.category] || t.category, value: t.amount, color: categoryColors[t.category] || '#ccc' })
        return acc
      }, [] as { category: string; name: string; value: number; color: string }[])
      .sort((a, b) => b.value - a.value)
  }, [filteredTx])

  const monthlyData = useMemo(() => {
    const monthMappings: Record<string, string> = {
      'Nov': '2025-11', 'Dic': '2025-12', 'Ene': '2026-01', 'Feb': '2026-02',
      'Mar': '2026-03', 'Abr': '2026-04', 'May': '2026-05'
    }

    return mockMonthlyData.map(item => {
      const prefix = monthMappings[item.month]
      if (!prefix) return item

      const monthTxs = txList.filter(t => t.date.startsWith(prefix))
      if (monthTxs.length === 0) return item

      const pIngresos = monthTxs.filter(t => t.type === 'ingreso').reduce((s, t) => s + t.amount, 0)
      const pEgresos = monthTxs.filter(t => t.type === 'egreso').reduce((s, t) => s + t.amount, 0)
      return { month: item.month, ingresos: pIngresos, egresos: pEgresos }
    })
  }, [txList])

  const netTrend = useMemo(() => monthlyData.map(m => ({ ...m, neto: m.ingresos - m.egresos })), [monthlyData])

  const openModal = (title: string, data: Transaction[]) => {
    setModalTitle(title)
    setModalData(data)
    setModalOpen(true)
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 size={40} className="text-[#C5A059] animate-spin" />
        <p className="text-sm font-medium text-gray-500">Cargando reportes...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 1. Header and Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reportes y Filtros</h1>
          <p className="text-sm text-gray-500 mt-1">Análisis financiero y ocupación detallada</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value as any)}
            className="text-sm bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 outline-none font-bold text-gray-700 focus:border-[#C5A059] transition-colors"
          >
            <option value="dia">Por Día</option>
            <option value="semana">Por Semana</option>
            <option value="mes">Por Mes</option>
            <option value="año">Por Año</option>
          </select>
          <input
            type={filterType === 'mes' ? 'month' : 'date'}
            value={filterType === 'mes' ? filterDate.substring(0, 7) : filterDate}
            onChange={e => {
              if (filterType === 'mes') {
                setFilterDate(e.target.value + '-01')
              } else {
                setFilterDate(e.target.value)
              }
            }}
            className="text-sm bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 outline-none font-medium text-gray-700 focus:border-[#C5A059] transition-colors"
          />
        </div>
      </div>

      {/* 2. Summary KPIs (Clickable) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button 
          onClick={() => openModal('Total Ingresos', filteredTx.filter(t => t.type === 'ingreso'))}
          className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm text-left hover:border-emerald-300 transition-colors group relative"
        >
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Total Ingresos</p>
          <p className="text-2xl font-bold text-emerald-600">{fmt(ingresos)}</p>
          <p className="text-xs text-gray-400 mt-1 group-hover:text-emerald-600 transition-colors">Click para ver {filteredTx.filter(t => t.type === 'ingreso').length} transacciones</p>
        </button>

        <button 
          onClick={() => openModal('Total Egresos', filteredTx.filter(t => t.type === 'egreso'))}
          className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm text-left hover:border-red-300 transition-colors group relative"
        >
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Total Egresos</p>
          <p className="text-2xl font-bold text-red-500">{fmt(egresos)}</p>
          <p className="text-xs text-gray-400 mt-1 group-hover:text-red-500 transition-colors">Click para ver {filteredTx.filter(t => t.type === 'egreso').length} transacciones</p>
        </button>

        <button 
          onClick={() => openModal('Resultado Neto (Todas)', filteredTx)}
          className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm text-left hover:border-[#C5A059] transition-colors group"
        >
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Resultado Neto</p>
          <p className={`text-2xl font-bold ${neto >= 0 ? 'text-[#C5A059]' : 'text-red-600'}`}>
            {fmt(neto)}
          </p>
          <p className="text-xs text-gray-400 mt-1 group-hover:text-[#C5A059] transition-colors">Margen: <span className="font-bold">{margin.toFixed(1)}%</span></p>
        </button>
      </div>

      {/* 3. Specific New Reports */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Food and Beverage */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center shrink-0">
            <Utensils size={24} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Alimentos y Bebidas</p>
            <p className="text-lg font-bold text-gray-900">{fmt(fbIngresos)}</p>
            <button 
              onClick={() => openModal('Ingresos Alimentos y Bebidas', filteredTx.filter(t => t.type === 'ingreso' && fbCategories.includes(t.category)))}
              className="text-[10px] font-bold text-orange-500 uppercase tracking-wider hover:underline mt-0.5 block"
            >
              Ver Detalle ({filteredTx.filter(t => t.type === 'ingreso' && fbCategories.includes(t.category)).length})
            </button>
          </div>
        </div>

        {/* Payroll */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center shrink-0">
            <Users size={24} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Pago Nómina</p>
            <p className="text-lg font-bold text-red-500">{fmt(nominaEgresos)}</p>
            <button 
              onClick={() => openModal('Egresos de Nómina', filteredTx.filter(t => t.category === 'empleados'))}
              className="text-[10px] font-bold text-blue-500 uppercase tracking-wider hover:underline mt-0.5 block"
            >
              Ver Detalle ({filteredTx.filter(t => t.category === 'empleados').length})
            </button>
          </div>
        </div>

        {/* Cabins Occupancy */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col justify-center">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Home size={16} className="text-[#C5A059]" />
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Ocupación</p>
            </div>
            <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-bold">{filteredBookings.length} total</span>
          </div>
          {cabinReport.length === 0 ? (
             <p className="text-xs text-gray-400">Sin alquileres en este periodo.</p>
          ) : (
            <div className="space-y-2 max-h-[60px] overflow-y-auto pr-2 custom-scrollbar">
              {cabinReport.map(cr => (
                <div key={cr.id} className="flex justify-between items-center border-b border-gray-50 pb-1 last:border-0 last:pb-0">
                  <span className="text-xs text-gray-600 truncate mr-2">Cabaña ID: {cr.id}</span>
                  <span className="text-[10px] font-bold bg-[#C5A059]/10 text-[#C5A059] px-2 py-0.5 rounded-md shrink-0">
                    {cr.count} res.
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 4. Trend area chart */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-widest mb-6">Resultado Neto — Tendencia Histórica</h2>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={netTrend}>
            <defs>
              <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#C5A059" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#C5A059" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v: unknown) => [fmt(v as number), 'Neto']} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }} />
            <Area type="monotone" dataKey="neto" stroke="#C5A059" strokeWidth={2.5} fill="url(#netGrad)" dot={{ fill: '#C5A059', r: 4 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* 5. Side by side breakdowns */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Income pie */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-widest mb-5">Ingresos por Categoría</h2>
          {incomeByCategory.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Sin datos en este periodo</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={incomeByCategory} cx="50%" cy="50%" outerRadius={70} paddingAngle={3} dataKey="value">
                    {incomeByCategory.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: unknown) => [fmt(v as number), '']} contentStyle={{ borderRadius: 12, border: 'none', fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                {incomeByCategory.map(item => (
                  <div key={item.category} className="flex items-center justify-between border-b border-gray-50 pb-1.5 last:border-0">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-xs text-gray-600 truncate">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[10px] text-gray-400">{((item.value / ingresos) * 100).toFixed(0)}%</span>
                      <span className="text-xs font-bold text-gray-900">{fmt(item.value)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Expense breakdown */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-widest mb-5">Egresos por Categoría</h2>
          {expenseByCategory.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Sin datos en este periodo</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={expenseByCategory} layout="vertical" barSize={16}>
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={100} />
                  <Tooltip formatter={(v: unknown) => [fmt(v as number), '']} contentStyle={{ borderRadius: 12, border: 'none', fontSize: 12 }} />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                    {expenseByCategory.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-3 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                {expenseByCategory.map(item => (
                  <div key={item.category} className="flex items-center justify-between border-b border-gray-50 pb-1.5 last:border-0">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-xs text-gray-600 truncate">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[10px] text-gray-400">{((item.value / egresos) * 100).toFixed(0)}%</span>
                      <span className="text-xs font-bold text-gray-900">{fmt(item.value)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 6. Monthly comparison bar */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-widest mb-6">Comparativa Mensual</h2>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={monthlyData} barGap={6}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v: unknown) => [fmt(v as number), '']} contentStyle={{ borderRadius: 12, border: 'none', fontSize: 12 }} />
            <Legend formatter={v => <span style={{ fontSize: 12, color: '#6b7280' }}>{v}</span>} />
            <Bar dataKey="ingresos" name="Ingresos" fill="#C5A059" radius={[6, 6, 0, 0]} />
            <Bar dataKey="egresos" name="Egresos" fill="#A65D47" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 7. Modal (Popup for Click to Expand) */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50/50">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{modalTitle}</h3>
                <p className="text-xs text-gray-500 mt-1">{modalData.length} transacciones en el periodo actual</p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="text-gray-400 hover:text-gray-700 bg-white shadow-sm border border-gray-100 p-2 rounded-full transition-all"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto bg-gray-50 flex-1 custom-scrollbar">
              {modalData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-sm font-bold text-gray-800">No hay transacciones</p>
                  <p className="text-xs text-gray-400 mt-1">No se encontraron registros en el rango seleccionado.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {modalData.map(tx => (
                    <div key={tx.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50 px-2 py-0.5 rounded-md">
                            {tx.date}
                          </span>
                          <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider" style={{ backgroundColor: categoryColors[tx.category] + '20', color: categoryColors[tx.category] }}>
                            {categoryLabels[tx.category] || tx.category}
                          </span>
                        </div>
                        <p className="text-sm font-bold text-gray-800">{tx.description}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-base font-bold ${tx.type === 'ingreso' ? 'text-emerald-600' : 'text-red-500'}`}>
                          {tx.type === 'ingreso' ? '+' : '-'}{fmt(tx.amount)}
                        </p>
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-1 bg-gray-50 inline-block px-1.5 py-0.5 rounded">
                          {tx.paymentMethod}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ReportsPage
