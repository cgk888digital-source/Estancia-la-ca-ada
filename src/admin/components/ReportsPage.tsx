import React, { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell, Legend
} from 'recharts'
import { mockTransactions, mockMonthlyData, categoryLabels, categoryColors } from '../data/mockData'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

const ReportsPage: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState('2026-05')

  const monthTx = mockTransactions.filter(t => t.date.startsWith(selectedMonth))
  const ingresos = monthTx.filter(t => t.type === 'ingreso').reduce((s, t) => s + t.amount, 0)
  const egresos = monthTx.filter(t => t.type === 'egreso').reduce((s, t) => s + t.amount, 0)

  // Income breakdown by category
  const incomeByCategory = monthTx
    .filter(t => t.type === 'ingreso')
    .reduce((acc, t) => {
      const existing = acc.find(a => a.category === t.category)
      if (existing) existing.value += t.amount
      else acc.push({ category: t.category, name: categoryLabels[t.category], value: t.amount, color: categoryColors[t.category] })
      return acc
    }, [] as { category: string; name: string; value: number; color: string }[])
    .sort((a, b) => b.value - a.value)

  // Expense breakdown by category
  const expenseByCategory = monthTx
    .filter(t => t.type === 'egreso')
    .reduce((acc, t) => {
      const existing = acc.find(a => a.category === t.category)
      if (existing) existing.value += t.amount
      else acc.push({ category: t.category, name: categoryLabels[t.category], value: t.amount, color: categoryColors[t.category] })
      return acc
    }, [] as { category: string; name: string; value: number; color: string }[])
    .sort((a, b) => b.value - a.value)

  // Net profit trend
  const netTrend = mockMonthlyData.map(m => ({
    ...m,
    neto: m.ingresos - m.egresos
  }))

  const margin = ingresos > 0 ? ((ingresos - egresos) / ingresos * 100) : 0

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reportes</h1>
          <p className="text-sm text-gray-500 mt-1">Análisis financiero detallado</p>
        </div>
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2.5">
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="text-sm outline-none bg-transparent text-gray-700 cursor-pointer"
          >
            <option value="2026-05">Mayo 2026</option>
            <option value="2026-04">Abril 2026</option>
            <option value="2026-03">Marzo 2026</option>
          </select>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Total Ingresos</p>
          <p className="text-2xl font-bold text-emerald-600">{fmt(ingresos)}</p>
          <p className="text-xs text-gray-400 mt-1">{monthTx.filter(t => t.type === 'ingreso').length} transacciones</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Total Egresos</p>
          <p className="text-2xl font-bold text-red-500">{fmt(egresos)}</p>
          <p className="text-xs text-gray-400 mt-1">{monthTx.filter(t => t.type === 'egreso').length} transacciones</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Resultado Neto</p>
          <p className={`text-2xl font-bold ${ingresos - egresos >= 0 ? 'text-[#C5A059]' : 'text-red-600'}`}>
            {fmt(ingresos - egresos)}
          </p>
          <p className="text-xs text-gray-400 mt-1">Margen: <span className="font-bold text-gray-600">{margin.toFixed(1)}%</span></p>
        </div>
      </div>

      {/* Trend area chart */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-widest mb-6">Resultado Neto — Tendencia 7 meses</h2>
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
            <Tooltip formatter={(v: number) => [fmt(v), 'Neto']} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }} />
            <Area type="monotone" dataKey="neto" stroke="#C5A059" strokeWidth={2.5} fill="url(#netGrad)" dot={{ fill: '#C5A059', r: 4 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Side by side breakdowns */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Income pie */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-widest mb-5">Ingresos por Categoría</h2>
          {incomeByCategory.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Sin datos</p>
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
              <div className="space-y-2 mt-2">
                {incomeByCategory.map(item => (
                  <div key={item.category} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-xs text-gray-600">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400">{((item.value / ingresos) * 100).toFixed(0)}%</span>
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
            <p className="text-sm text-gray-400 text-center py-8">Sin datos</p>
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
              <div className="space-y-2 mt-3">
                {expenseByCategory.map(item => (
                  <div key={item.category} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-xs text-gray-600">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400">{((item.value / egresos) * 100).toFixed(0)}%</span>
                      <span className="text-xs font-bold text-gray-900">{fmt(item.value)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Monthly comparison bar */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-widest mb-6">Comparativa Mensual</h2>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={mockMonthlyData} barGap={6}>
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
    </div>
  )
}

export default ReportsPage
