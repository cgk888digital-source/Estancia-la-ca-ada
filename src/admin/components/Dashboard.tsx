import React from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import { TrendingUp, TrendingDown, DollarSign, Users, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { mockTransactions, mockMonthlyData, mockEmployees, categoryLabels, categoryColors } from '../data/mockData'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

const Dashboard: React.FC = () => {
  const mayTx = mockTransactions.filter(t => t.date.startsWith('2026-05'))
  const totalIngresos = mayTx.filter(t => t.type === 'ingreso').reduce((s, t) => s + t.amount, 0)
  const totalEgresos = mayTx.filter(t => t.type === 'egreso').reduce((s, t) => s + t.amount, 0)
  const balance = totalIngresos - totalEgresos
  const pendingPayroll = mockEmployees.filter(e => e.pendingPayment && e.status === 'activo').reduce((s, e) => s + e.salary, 0)

  // Pie data — income breakdown
  const incomePie = mayTx
    .filter(t => t.type === 'ingreso')
    .reduce((acc, t) => {
      const existing = acc.find(a => a.name === categoryLabels[t.category])
      if (existing) existing.value += t.amount
      else acc.push({ name: categoryLabels[t.category], value: t.amount, color: categoryColors[t.category] })
      return acc
    }, [] as { name: string; value: number; color: string }[])

  const recent = [...mockTransactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6)

  const kpis = [
    {
      label: 'Ingresos Mayo',
      value: fmt(totalIngresos),
      icon: <TrendingUp size={20} />,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      trend: '+12% vs Abril',
      trendUp: true,
    },
    {
      label: 'Egresos Mayo',
      value: fmt(totalEgresos),
      icon: <TrendingDown size={20} />,
      color: 'text-red-500',
      bg: 'bg-red-50',
      trend: '-8% vs Abril',
      trendUp: false,
    },
    {
      label: 'Balance Neto',
      value: fmt(balance),
      icon: <DollarSign size={20} />,
      color: balance >= 0 ? 'text-[#C5A059]' : 'text-red-500',
      bg: 'bg-[#C5A059]/10',
      trend: 'Mayo 2026',
      trendUp: balance >= 0,
    },
    {
      label: 'Sueldos Pendientes',
      value: fmt(pendingPayroll),
      icon: <Users size={20} />,
      color: 'text-violet-600',
      bg: 'bg-violet-50',
      trend: `${mockEmployees.filter(e => e.pendingPayment && e.status === 'activo').length} empleados`,
      trendUp: false,
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Mayo 2026 — resumen general</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-start justify-between mb-4">
              <div className={`w-10 h-10 rounded-xl ${kpi.bg} ${kpi.color} flex items-center justify-center`}>
                {kpi.icon}
              </div>
              <span className={`flex items-center gap-1 text-xs font-medium ${kpi.trendUp ? 'text-emerald-600' : 'text-red-500'}`}>
                {kpi.trendUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                {kpi.trend}
              </span>
            </div>
            <p className="text-xs text-gray-400 uppercase tracking-widest font-medium mb-1">{kpi.label}</p>
            <p className="text-xl font-bold text-gray-900">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Bar chart */}
        <div className="xl:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-widest mb-6">Ingresos vs Egresos — Últimos 7 meses</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={mockMonthlyData} barGap={6}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(value: number) => [fmt(value), '']}
                contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }}
              />
              <Bar dataKey="ingresos" name="Ingresos" fill="#C5A059" radius={[6, 6, 0, 0]} />
              <Bar dataKey="egresos" name="Egresos" fill="#A65D47" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie chart */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-widest mb-6">Ingresos por Categoría</h2>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={incomePie} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                {incomePie.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Legend
                iconType="circle"
                iconSize={8}
                formatter={(value) => <span style={{ fontSize: 11, color: '#6b7280' }}>{value}</span>}
              />
              <Tooltip formatter={(value: number) => [fmt(value), '']} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent transactions */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-widest">Últimos Movimientos</h2>
          <span className="text-xs text-[#C5A059] font-medium cursor-pointer hover:underline">Ver todos</span>
        </div>
        <div className="divide-y divide-gray-50">
          {recent.map((tx) => (
            <div key={tx.id} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors">
              <div className={`w-2 h-8 rounded-full ${tx.type === 'ingreso' ? 'bg-emerald-400' : 'bg-red-400'}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{tx.description}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(tx.date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                  {' · '}
                  <span className="capitalize">{categoryLabels[tx.category]}</span>
                </p>
              </div>
              <span className={`text-sm font-bold ${tx.type === 'ingreso' ? 'text-emerald-600' : 'text-red-500'}`}>
                {tx.type === 'ingreso' ? '+' : '-'}{fmt(tx.amount)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Dashboard
