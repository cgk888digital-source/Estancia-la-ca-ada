import React, { useState, useEffect, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import { TrendingUp, TrendingDown, DollarSign, Users, ArrowUpRight, ArrowDownRight, Loader2 } from 'lucide-react'
import { mockTransactions, mockEmployees, categoryLabels, categoryColors } from '../data/mockData'
import type { Transaction, TransactionType, TransactionCategory, PaymentMethod, Employee } from '../types'
import { supabase } from '../../lib/supabase'
import { parseLocalDate } from '../../utils/dateUtils'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

/** '2026-08' — la clave con la que se comparan las fechas de las transacciones. */
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

/** 'Agosto' / 'Ago' — el nombre que ve la dueña. Antes estaba escrito a mano como
 *  "Mayo" y no cambiaba nunca, asi que las cifras del mes en curso salian con el
 *  nombre de otro mes. */
const monthName = (d: Date, style: 'long' | 'short' = 'long') =>
  cap(d.toLocaleDateString('es-VE', { month: style }).replace('.', ''))

const shiftMonth = (d: Date, delta: number) => new Date(d.getFullYear(), d.getMonth() + delta, 1)

/** Suma los ingresos o los egresos de un mes concreto. Pura, para que las dependencias
 *  de los useMemo sigan siendo solo los datos y no la funcion. */
const sumMonth = (list: Transaction[], prefix: string, type: TransactionType) =>
  list.filter(t => t.date.startsWith(prefix) && t.type === type).reduce((s, t) => s + t.amount, 0)

interface DbTransaction {
  id: string
  date: string
  type: string
  category: string
  description: string
  amount: number | string
  payment_method: string
  related_to?: string | null
}

interface DbEmployee {
  id: string
  name: string
  role: string
  salary: number | string
  status: string
  hire_date: string
  last_payment: string | null
  pending_payment: boolean
  employee_type?: string
  payment_frequency?: string
  daily_rate?: number | string
  contracted_days?: number
}

const Dashboard: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    try {
      const cache = localStorage.getItem('estancia_transactions')
      if (cache) {
        const parsed = JSON.parse(cache)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      }
    } catch (e) {}
    return mockTransactions
  })
  const [employees, setEmployees] = useState<Employee[]>(() => {
    try {
      const cache = localStorage.getItem('estancia_employees')
      if (cache) {
        const parsed = JSON.parse(cache)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      }
    } catch (e) {}
    return mockEmployees
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let active = true

    const fetchData = async () => {
      // Solo los últimos 7 meses para las gráficas del dashboard
      const sevenMonthsAgo = new Date()
      sevenMonthsAgo.setMonth(sevenMonthsAgo.getMonth() - 7)
      const dateFrom = sevenMonthsAgo.toISOString().substring(0, 10)

      const [txRes, empRes] = await Promise.all([
        supabase.from('transactions')
          .select('id, date, type, category, description, amount, payment_method, related_to')
          .gte('date', dateFrom)
          .order('date', { ascending: false }),
        supabase.from('employees')
          .select('id, name, role, salary, status, pending_payment, employee_type, payment_frequency, daily_rate, contracted_days, hire_date, last_payment')
      ])

      if (!active) return

      if (txRes.error) {
        console.error('Error fetching transactions:', txRes.error)
      } else if (txRes.data && txRes.data.length > 0) {
        const mapped = txRes.data.map((db: DbTransaction) => ({
          id: db.id,
          date: db.date,
          type: db.type as TransactionType,
          category: db.category as TransactionCategory,
          description: db.description,
          amount: Number(db.amount) || 0,
          paymentMethod: db.payment_method as PaymentMethod,
          relatedTo: db.related_to || ''
        }))
        setTransactions(mapped)
      }

      if (empRes.error) {
        console.error('Error fetching employees:', empRes.error)
      } else if (empRes.data) {
        setEmployees(empRes.data.map((db: DbEmployee) => ({
          id: db.id,
          name: db.name,
          role: db.role,
          salary: Number(db.salary) || 0,
          status: db.status as 'activo' | 'inactivo',
          hireDate: db.hire_date,
          lastPayment: db.last_payment || '',
          pendingPayment: db.pending_payment,
          employeeType: (db.employee_type || 'fijo') as 'fijo' | 'eventual',
          paymentFrequency: (db.payment_frequency || 'quincenal') as 'quincenal' | 'mensual' | 'semanal' | 'por_dias',
          dailyRate: Number(db.daily_rate) || 0,
          contractedDays: Number(db.contracted_days) || 0,
        })))
      }
      setLoading(false)
    }

    fetchData()

    return () => {
      active = false
    }
  }, [])

  const txList = transactions.length > 0 ? transactions : mockTransactions
  const empList = employees.length > 0 ? employees : mockEmployees

  // El mes en curso, recalculado en cada carga: nada de nombres escritos a mano.
  const thisMonth = useMemo(() => new Date(), [])
  const prevMonth = useMemo(() => shiftMonth(thisMonth, -1), [thisMonth])
  const currentMonthPrefix = useMemo(() => monthKey(thisMonth), [thisMonth])
  const prevMonthPrefix = useMemo(() => monthKey(prevMonth), [prevMonth])

  const { monthTx, totalIngresos, totalEgresos, balance } = useMemo(() => {
    const monthTx = txList.filter(t => t.date.startsWith(currentMonthPrefix))
    const totalIngresos = sumMonth(txList, currentMonthPrefix, 'ingreso')
    const totalEgresos = sumMonth(txList, currentMonthPrefix, 'egreso')
    return { monthTx, totalIngresos, totalEgresos, balance: totalIngresos - totalEgresos }
  }, [txList, currentMonthPrefix])

  /**
   * Variacion real contra el mes anterior. Antes aqui habia un "+12% vs Abril" escrito
   * a mano que no se calculaba con nada: decia lo mismo subieran o bajaran las ventas.
   * Si no hay con que comparar se dice, no se inventa un porcentaje.
   */
  const variacion = useMemo(() => {
    const etiqueta = monthName(prevMonth)
    const calc = (actual: number, type: TransactionType) => {
      const anterior = sumMonth(txList, prevMonthPrefix, type)
      if (anterior === 0) {
        return { texto: actual === 0 ? `Sin datos de ${etiqueta}` : `Nada en ${etiqueta}`, sube: actual > 0 }
      }
      const pct = ((actual - anterior) / anterior) * 100
      const signo = pct > 0 ? '+' : ''
      return { texto: `${signo}${pct.toFixed(0)}% vs ${etiqueta}`, sube: pct >= 0 }
    }
    return { ingresos: calc(totalIngresos, 'ingreso'), egresos: calc(totalEgresos, 'egreso') }
  }, [txList, prevMonthPrefix, prevMonth, totalIngresos, totalEgresos])

  const pendingPayroll = useMemo(() =>
    empList.filter(e => e.pendingPayment && e.status === 'activo').reduce((s, e) => s + e.salary, 0)
  , [empList])

  const pendingCount = useMemo(() =>
    empList.filter(e => e.pendingPayment && e.status === 'activo').length
  , [empList])

  /**
   * Los siete meses que terminan en el actual, calculados de las transacciones reales.
   * Antes los meses estaban fijados a Nov-2025..May-2026 y, cuando un mes no tenia
   * movimientos, la grafica rellenaba con cifras de demostracion: la dueña veia
   * ingresos que nunca existieron. Un mes sin datos ahora vale cero.
   */
  const monthlyData = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const d = shiftMonth(thisMonth, i - 6)
      const prefix = monthKey(d)
      return {
        month: monthName(d, 'short'),
        ingresos: sumMonth(txList, prefix, 'ingreso'),
        egresos: sumMonth(txList, prefix, 'egreso'),
      }
    })
  , [txList, thisMonth])

  // Pie data — income breakdown (memoized)
  const incomePie = useMemo(() => monthTx
    .filter(t => t.type === 'ingreso')
    .reduce((acc, t) => {
      const existing = acc.find(a => a.name === categoryLabels[t.category])
      if (existing) existing.value += t.amount
      else acc.push({ name: categoryLabels[t.category], value: t.amount, color: categoryColors[t.category] })
      return acc
    }, [] as { name: string; value: number; color: string }[])
  , [monthTx])

  const recent = useMemo(() =>
    [...txList].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6)
  , [txList])

  const kpis = [
    {
      label: `Ingresos ${monthName(thisMonth)}`,
      value: fmt(totalIngresos),
      icon: <TrendingUp size={20} />,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      trend: variacion.ingresos.texto,
      trendUp: variacion.ingresos.sube,
      trendGood: variacion.ingresos.sube,
    },
    {
      label: `Egresos ${monthName(thisMonth)}`,
      value: fmt(totalEgresos),
      icon: <TrendingDown size={20} />,
      color: 'text-red-500',
      bg: 'bg-red-50',
      trend: variacion.egresos.texto,
      trendUp: variacion.egresos.sube,
      // Gastar mas es la mala noticia: aqui el color va al reves que la flecha.
      trendGood: !variacion.egresos.sube,
    },
    {
      label: 'Balance Neto',
      value: fmt(balance),
      icon: <DollarSign size={20} />,
      color: balance >= 0 ? 'text-[#C5A059]' : 'text-red-500',
      bg: 'bg-[#C5A059]/10',
      trend: `${monthName(thisMonth)} ${thisMonth.getFullYear()}`,
      trendUp: balance >= 0,
      trendGood: balance >= 0,
    },
    {
      label: 'Sueldos Pendientes',
      value: fmt(pendingPayroll),
      icon: <Users size={20} />,
      color: 'text-violet-600',
      bg: 'bg-violet-50',
      trend: `${pendingCount} empleados`,
      trendUp: false,
      trendGood: false,
    },
  ]

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 size={40} className="text-[#C5A059] animate-spin" />
        <p className="text-sm font-medium text-gray-500">Cargando datos del panel...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">{monthName(thisMonth)} {thisMonth.getFullYear()} — resumen general</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-start justify-between mb-4">
              <div className={`w-10 h-10 rounded-xl ${kpi.bg} ${kpi.color} flex items-center justify-center`}>
                {kpi.icon}
              </div>
              <span className={`flex items-center gap-1 text-xs font-medium ${kpi.trendGood ? 'text-emerald-600' : 'text-red-500'}`}>
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
            <BarChart data={monthlyData} barGap={6}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(value: unknown) => [fmt(value as number), '']}
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
              <Tooltip formatter={(value: unknown) => [fmt(value as number), '']} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }} />
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
                  {parseLocalDate(tx.date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
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
