import React, { useState, useEffect } from 'react'
import { Plus, Check, X, UserCheck, UserX, DollarSign, Loader2, Users, Clock, Calendar, Receipt } from 'lucide-react'
import { mockEmployees } from '../data/mockData'
import type { Employee } from '../types'
import { supabase } from '../../lib/supabase'
import { getBcvUsdRate } from '../../utils/exchangeRate'
import ReceiptModal from './ReceiptModal'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

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

const mapDbEmployeeToReact = (db: DbEmployee): Employee => ({
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
})

const FREQ_LABELS: Record<string, string> = {
  quincenal: 'Quincenal',
  mensual: 'Mensual',
  semanal: 'Semanal',
  por_dias: 'Por Días',
}

// ─── Pay Eventual Modal ──────────────────────────────────────────────────────
interface PayEventualModalProps {
  emp: Employee
  onConfirm: (emp: Employee, days: number) => void
  onClose: () => void
  paying: boolean
}

const PayEventualModal: React.FC<PayEventualModalProps> = ({ emp, onConfirm, onClose, paying }) => {
  const defaultDays = emp.paymentFrequency === 'semanal' ? 7 : emp.contractedDays || 1
  const [days, setDays] = useState(defaultDays)
  const total = emp.dailyRate * days

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Registrar Pago Eventual</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {/* Employee info */}
        <div className="bg-gray-50 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#C5A059]/15 text-[#C5A059] flex items-center justify-center font-bold text-sm shrink-0">
            {emp.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">{emp.name}</p>
            <p className="text-xs text-gray-500">{emp.role} · Tarifa: {fmt(emp.dailyRate)}/día</p>
          </div>
        </div>

        {/* Days input */}
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 block">
            {emp.paymentFrequency === 'semanal'
              ? 'Días de la semana a pagar'
              : 'Días trabajados a pagar'}
          </label>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setDays(d => Math.max(1, d - 1))}
              className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center font-bold text-gray-700 text-lg transition-colors"
            >−</button>
            <input
              type="number"
              min={1}
              value={days}
              onChange={e => setDays(Math.max(1, Number(e.target.value)))}
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-center text-lg font-bold outline-none focus:border-[#C5A059]"
            />
            <button
              onClick={() => setDays(d => d + 1)}
              className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center font-bold text-gray-700 text-lg transition-colors"
            >+</button>
          </div>
          {emp.contractedDays > 0 && (
            <p className="text-[10px] text-gray-400 mt-1.5 text-center">
              Contratado por {emp.contractedDays} días · Días a pagar: <strong>{days}</strong>
            </p>
          )}
        </div>

        {/* Total */}
        <div className="bg-[#3D2B1F]/5 border border-[#3D2B1F]/10 rounded-2xl p-4 text-center">
          <p className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-1">Total a Pagar</p>
          <p className="text-3xl font-bold text-[#3D2B1F] font-serif">{fmt(total)}</p>
          <p className="text-[10px] text-gray-400 mt-1">{fmt(emp.dailyRate)} × {days} día{days !== 1 ? 's' : ''}</p>
        </div>

        <button
          onClick={() => onConfirm(emp, days)}
          disabled={paying}
          className="w-full py-3.5 bg-[#3D2B1F] hover:bg-[#2a1d14] text-white rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {paying ? <Loader2 size={16} className="animate-spin" /> : <DollarSign size={16} />}
          Confirmar Pago de {fmt(total)}
        </button>
      </div>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────
const EmployeesPage: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [paidId, setPaidId] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [payEventualTarget, setPayEventualTarget] = useState<Employee | null>(null)
  const [payingEventual, setPayingEventual] = useState(false)
  const [activeTab, setActiveTab] = useState<'fijos' | 'eventuales'>('fijos')
  const [receiptData, setReceiptData] = useState<{emp: Employee, amount: number, period: string, isHistory?: boolean, bcvRate?: number} | null>(null)
  const [bcvRate, setBcvRate] = useState<number>(36.50)
  
  const [tipsBalance, setTipsBalance] = useState<Record<string, number>>({})
  const [payingTips, setPayingTips] = useState<string | null>(null)

  const [form, setForm] = useState({
    name: '',
    role: '',
    hireDate: '',
    employeeType: 'fijo' as 'fijo' | 'eventual',
    salary: '',
    paymentFrequency: 'quincenal' as 'quincenal' | 'mensual' | 'semanal' | 'por_dias',
    dailyRate: '',
    contractedDays: '',
  })

  useEffect(() => {
    let active = true
    const fetchEmployees = async () => {
      const rate = await getBcvUsdRate()
      if (active) setBcvRate(rate)

      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .order('name', { ascending: true })

      if (!active) return

      if (error) {
        console.error('Error fetching employees:', error)
        setEmployees(mockEmployees.map(e => ({ ...e, employeeType: 'fijo', paymentFrequency: 'mensual', dailyRate: 0, contractedDays: 0 })))
      } else if (data && data.length > 0) {
        setEmployees(data.map(mapDbEmployeeToReact))
      } else {
        const dbMocks = mockEmployees.map(e => ({
          name: e.name,
          role: e.role,
          salary: e.salary,
          status: e.status,
          hire_date: e.hireDate,
          last_payment: e.lastPayment || null,
          pending_payment: e.pendingPayment,
          employee_type: 'fijo',
          payment_frequency: 'mensual',
          daily_rate: 0,
          contracted_days: 0,
        }))
        const { data: inserted, error: insErr } = await supabase
          .from('employees')
          .insert(dbMocks)
          .select('*')

        if (!active) return
        if (insErr) {
          setEmployees(mockEmployees.map(e => ({ ...e, employeeType: 'fijo', paymentFrequency: 'mensual', dailyRate: 0, contractedDays: 0 })))
        } else if (inserted) {
          setEmployees(inserted.map(mapDbEmployeeToReact))
        }
      }
      setLoading(false)
    }
    fetchEmployees()
    
    const fetchTips = async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('type, amount, related_to')
        .eq('category', 'propinas')
        .not('related_to', 'is', null)
        
      if (!active || error || !data) return
      
      const balances: Record<string, number> = {}
      data.forEach(tx => {
        if (!tx.related_to) return
        if (!balances[tx.related_to]) balances[tx.related_to] = 0
        const amt = Number(tx.amount) || 0
        if (tx.type === 'ingreso') balances[tx.related_to] += amt
        else if (tx.type === 'egreso') balances[tx.related_to] -= amt
      })
      setTipsBalance(balances)
    }
    fetchTips()
    
    return () => { active = false }
  }, [])

  const fijos = employees.filter(e => e.employeeType === 'fijo')
  const eventuales = employees.filter(e => e.employeeType === 'eventual')
  const activeFijos = fijos.filter(e => e.status === 'activo')
  const activeEventuales = eventuales.filter(e => e.status === 'activo')
  const totalFijosPayroll = activeFijos.reduce((s, e) => s + e.salary, 0)
  const pendingFijos = activeFijos.filter(e => e.pendingPayment)
  const pendingFijosTotal = pendingFijos.reduce((s, e) => s + e.salary, 0)
  
  const handlePayTips = async (emp: Employee) => {
    const balance = tipsBalance[emp.name] || 0
    if (balance <= 0) return
    setPayingTips(emp.id)
    
    const today = new Date().toISOString().split('T')[0]
    
    const { error } = await supabase.from('transactions').insert([{
      date: today,
      type: 'egreso',
      category: 'propinas',
      description: `Pago de propinas acumuladas — ${emp.name} (Tasa BCV: ${bcvRate} Bs/$)`,
      amount: balance,
      payment_method: 'transferencia',
      related_to: emp.name,
    }])
    
    if (!error) {
      setTipsBalance(prev => ({ ...prev, [emp.name]: 0 }))
      setReceiptData({ emp, amount: balance, period: 'Propinas Semanales' })
    }
    setPayingTips(null)
  }

  // ── Pay fixed employee ────────────────────────────────────────────────────
  const handlePay = async (id: string) => {
    setPaidId(id)
    const today = new Date().toISOString().split('T')[0]
    const emp = employees.find(e => e.id === id)

    const { error } = await supabase
      .from('employees')
      .update({ pending_payment: false, last_payment: today })
      .eq('id', id)

    if (error) { console.error(error); setPaidId(null); return }

    if (emp) {
      await supabase.from('transactions').insert([{
        date: today,
        type: 'egreso',
        category: 'empleados',
        description: `Pago nómina fija — ${emp.name} (Tasa BCV: ${bcvRate} Bs/$)`,
        amount: emp.salary,
        payment_method: 'transferencia',
        related_to: emp.name,
      }])
    }

    setEmployees(prev => prev.map(e => e.id === id ? { ...e, pendingPayment: false, lastPayment: today } : e))
    setPaidId(null)
    if (emp) {
      setReceiptData({ emp, amount: emp.salary, period: 'Quincena' })
    }
  }

  const handlePayAll = async () => {
    const today = new Date().toISOString().split('T')[0]
    const pending = activeFijos.filter(e => e.pendingPayment)
    if (pending.length === 0) return

    const { error } = await supabase
      .from('employees')
      .update({ pending_payment: false, last_payment: today })
      .eq('status', 'activo')
      .eq('pending_payment', true)
      .eq('employee_type', 'fijo')

    if (error) { console.error(error); return }

    const txs = pending.map(emp => ({
      date: today,
      type: 'egreso',
      category: 'empleados',
      description: `Pago nómina fija — ${emp.name} (Tasa BCV: ${bcvRate} Bs/$)`,
      amount: emp.salary,
      payment_method: 'transferencia',
      related_to: emp.name,
    }))
    await supabase.from('transactions').insert(txs)

    setEmployees(prev =>
      prev.map(e => e.employeeType === 'fijo' && e.status === 'activo' && e.pendingPayment
        ? { ...e, pendingPayment: false, lastPayment: today }
        : e
      )
    )
  }

  // ── Pay eventual employee ─────────────────────────────────────────────────
  const handlePayEventual = async (emp: Employee, days: number) => {
    setPayingEventual(true)
    const today = new Date().toISOString().split('T')[0]
    const amount = emp.dailyRate * days

    const { error } = await supabase
      .from('employees')
      .update({ last_payment: today, pending_payment: false })
      .eq('id', emp.id)

    if (error) { console.error(error); setPayingEventual(false); return }

    const freqLabel = emp.paymentFrequency === 'semanal' ? `semana (${days} días)` : `${days} día${days !== 1 ? 's' : ''}`
    await supabase.from('transactions').insert([{
      date: today,
      type: 'egreso',
      category: 'empleados',
      description: `Pago eventual — ${emp.name} (${freqLabel} - Tasa BCV: ${bcvRate} Bs/$)`,
      amount,
      payment_method: 'transferencia',
      related_to: emp.name,
    }])

    setEmployees(prev => prev.map(e => e.id === emp.id ? { ...e, lastPayment: today, pendingPayment: false } : e))
    setPayingEventual(false)
    setPayEventualTarget(null)
    setReceiptData({ emp, amount, period: freqLabel })
  }

  const handleViewLastReceipt = async (emp: Employee) => {
    if (!emp.lastPayment) return
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('category', 'empleados')
      .eq('related_to', emp.name)
      .eq('date', emp.lastPayment)
      .order('created_at', { ascending: false })
      .limit(1)

    if (error || !data || data.length === 0) {
      alert('No se encontró el comprobante de este pago.')
      return
    }

    const tx = data[0]
    const matchRate = tx.description.match(/Tasa BCV: ([\d.]+) Bs\/\$/)
    const rate = matchRate ? Number(matchRate[1]) : bcvRate
    
    let period = 'Quincena'
    if (emp.employeeType === 'eventual') {
      const matchPeriod = tx.description.match(/\((.*?) - Tasa BCV/)
      if (matchPeriod) {
        period = matchPeriod[1]
      } else {
        const fallback = tx.description.match(/\((.*?)\)/)
        if (fallback) period = fallback[1]
      }
    }

    setReceiptData({ emp, amount: tx.amount, period, isHistory: true, bcvRate: rate })
  }

  // ── Save new employee ─────────────────────────────────────────────────────
  const handleSave = async () => {
    const isFijo = form.employeeType === 'fijo'
    if (!form.name || !form.role) return
    if (isFijo && !form.salary) return
    if (!isFijo && !form.dailyRate) return

    const dbEmp = {
      name: form.name,
      role: form.role,
      salary: isFijo ? Number(form.salary) : 0,
      status: 'activo',
      hire_date: form.hireDate || new Date().toISOString().split('T')[0],
      last_payment: null,
      pending_payment: isFijo,
      employee_type: form.employeeType,
      payment_frequency: isFijo ? 'quincenal' : form.paymentFrequency,
      daily_rate: isFijo ? 0 : Number(form.dailyRate),
      contracted_days: isFijo ? 0 : Number(form.contractedDays) || 0,
    }

    const { data, error } = await supabase.from('employees').insert([dbEmp]).select('*')
    if (error) { console.error(error); return }
    if (data && data[0]) {
      setEmployees(prev => [mapDbEmployeeToReact(data[0]), ...prev])
    }

    setSaved(true)
    setTimeout(() => {
      setSaved(false)
      setShowModal(false)
      setForm({ name: '', role: '', hireDate: '', employeeType: 'fijo', salary: '', paymentFrequency: 'quincenal', dailyRate: '', contractedDays: '' })
    }, 1200)
  }

  const isFormValid = form.name && form.role && (form.employeeType === 'fijo' ? !!form.salary : !!form.dailyRate)

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] gap-3">
        <Loader2 size={32} className="text-[#C5A059] animate-spin" />
        <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">Cargando nómina...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nómina y Empleados</h1>
          <p className="text-sm text-gray-500 mt-1">
            {activeFijos.length} fijos · {activeEventuales.length} eventuales
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#3D2B1F] hover:bg-[#2a1d14] text-white rounded-xl text-sm font-bold transition-all shadow-sm"
        >
          <Plus size={16} />
          Nuevo Empleado
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1"><Users size={11} /> Fijos Activos</p>
          <p className="text-2xl font-bold text-gray-900">{activeFijos.length}</p>
          <p className="text-xs text-gray-400 mt-1">Nómina: {fmt(totalFijosPayroll)}/quincena</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1"><Clock size={11} /> Eventuales</p>
          <p className="text-2xl font-bold text-gray-900">{activeEventuales.length}</p>
          <p className="text-xs text-gray-400 mt-1">activos</p>
        </div>
        <div className="bg-amber-50 rounded-2xl p-5 border border-amber-100 shadow-sm">
          <p className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-1">Sueldos Pendientes</p>
          <p className="text-2xl font-bold text-amber-700">{pendingFijos.length}</p>
          <p className="text-xs text-amber-500 mt-1">{fmt(pendingFijosTotal)}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex flex-col justify-between">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Pagar Todos (Fijos)</p>
          <button
            onClick={handlePayAll}
            disabled={pendingFijos.length === 0}
            className={`mt-2 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all
              ${pendingFijos.length > 0 ? 'bg-violet-600 hover:bg-violet-700 text-white shadow-sm' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
          >
            <DollarSign size={15} />
            Pagar Todo
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-2xl p-1 w-fit">
        <button
          onClick={() => setActiveTab('fijos')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'fijos' ? 'bg-white shadow-sm text-[#3D2B1F]' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <Users size={15} />
          Empleados Fijos
          {pendingFijos.length > 0 && (
            <span className="bg-amber-500 text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-full">{pendingFijos.length}</span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('eventuales')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'eventuales' ? 'bg-white shadow-sm text-[#3D2B1F]' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <Clock size={15} />
          Eventuales
        </button>
      </div>

      {/* ── FIJOS TABLE ── */}
      {activeTab === 'fijos' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left text-xs font-bold text-gray-400 uppercase tracking-widest px-6 py-4">Empleado</th>
                  <th className="text-left text-xs font-bold text-gray-400 uppercase tracking-widest px-4 py-4 hidden sm:table-cell">Cargo</th>
                  <th className="text-left text-xs font-bold text-gray-400 uppercase tracking-widest px-4 py-4 hidden lg:table-cell">Último Pago</th>
                  <th className="text-left text-xs font-bold text-gray-400 uppercase tracking-widest px-4 py-4">Estado</th>
                  <th className="text-right text-xs font-bold text-gray-400 uppercase tracking-widest px-6 py-4">Sueldo / Propinas</th>
                  <th className="px-4 py-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {fijos.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-16 text-sm text-gray-400">No hay empleados fijos registrados</td></tr>
                ) : fijos.map(emp => (
                  <tr key={emp.id} className={`hover:bg-gray-50 transition-colors ${emp.status === 'inactivo' ? 'opacity-50' : ''}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#C5A059]/15 text-[#C5A059] flex items-center justify-center font-bold text-sm shrink-0">
                          {emp.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{emp.name}</p>
                          <p className="text-xs text-gray-400 sm:hidden">{emp.role}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 hidden sm:table-cell"><span className="text-sm text-gray-600">{emp.role}</span></td>
                    <td className="px-4 py-4 hidden lg:table-cell">
                      {emp.lastPayment ? (
                        <button
                          onClick={() => handleViewLastReceipt(emp)}
                          className="group flex items-center gap-1.5 px-2 py-1 -ml-2 rounded-lg hover:bg-gray-100 transition-colors"
                          title="Ver recibo de pago"
                        >
                          <Receipt size={14} className="text-gray-400 group-hover:text-[#C5A059]" />
                          <span className="text-sm text-gray-500 group-hover:text-gray-900 font-medium">
                            {new Date(emp.lastPayment).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: '2-digit' })}
                          </span>
                        </button>
                      ) : (
                        <span className="text-sm text-gray-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {emp.status === 'inactivo' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 text-gray-500 rounded-lg text-xs font-bold"><UserX size={12} /> Inactivo</span>
                      ) : emp.pendingPayment ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 rounded-lg text-xs font-bold"><DollarSign size={12} /> Pendiente</span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold"><UserCheck size={12} /> Pagado</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex flex-col items-end">
                        <span className="text-sm font-bold text-gray-900">{fmt(emp.salary)}</span>
                        {(tipsBalance[emp.name] > 0) && (
                          <span className="text-xs font-bold text-emerald-600 mt-0.5 bg-emerald-50 px-2 py-0.5 rounded-md">
                            + {fmt(tipsBalance[emp.name])} propinas
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        {emp.status === 'activo' && emp.pendingPayment && (
                          <button
                            onClick={() => handlePay(emp.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all
                              ${paidId === emp.id ? 'bg-emerald-500 text-white' : 'bg-violet-100 text-violet-700 hover:bg-violet-600 hover:text-white'}`}
                          >
                            {paidId === emp.id ? <Check size={14} /> : 'Pagar Nómina'}
                          </button>
                        )}
                        {(tipsBalance[emp.name] > 0) && (
                          <button
                            onClick={() => handlePayTips(emp)}
                            disabled={payingTips === emp.id}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1
                              ${payingTips === emp.id ? 'bg-emerald-500 text-white' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-600 hover:text-white'}`}
                          >
                            {payingTips === emp.id ? <Check size={14} /> : 'Pagar Propinas'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── EVENTUALES TABLE ── */}
      {activeTab === 'eventuales' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left text-xs font-bold text-gray-400 uppercase tracking-widest px-6 py-4">Empleado</th>
                  <th className="text-left text-xs font-bold text-gray-400 uppercase tracking-widest px-4 py-4 hidden sm:table-cell">Cargo</th>
                  <th className="text-left text-xs font-bold text-gray-400 uppercase tracking-widest px-4 py-4">Modalidad</th>
                  <th className="text-left text-xs font-bold text-gray-400 uppercase tracking-widest px-4 py-4 hidden md:table-cell">Días Contrato</th>
                  <th className="text-right text-xs font-bold text-gray-400 uppercase tracking-widest px-6 py-4">Tarifa/Día / Propinas</th>
                  <th className="text-left text-xs font-bold text-gray-400 uppercase tracking-widest px-4 py-4 hidden lg:table-cell">Último Pago</th>
                  <th className="px-4 py-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {eventuales.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-16 text-sm text-gray-400">No hay empleados eventuales registrados</td></tr>
                ) : eventuales.map(emp => (
                  <tr key={emp.id} className={`hover:bg-gray-50 transition-colors ${emp.status === 'inactivo' ? 'opacity-50' : ''}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#5D6346]/15 text-[#5D6346] flex items-center justify-center font-bold text-sm shrink-0">
                          {emp.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{emp.name}</p>
                          <p className="text-xs text-gray-400 sm:hidden">{emp.role}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 hidden sm:table-cell"><span className="text-sm text-gray-600">{emp.role}</span></td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold
                        ${emp.paymentFrequency === 'semanal' ? 'bg-blue-50 text-blue-700' : 'bg-orange-50 text-orange-700'}`}>
                        {emp.paymentFrequency === 'semanal' ? <Calendar size={11} /> : <Clock size={11} />}
                        {FREQ_LABELS[emp.paymentFrequency]}
                      </span>
                    </td>
                    <td className="px-4 py-4 hidden md:table-cell">
                      <span className="text-sm text-gray-600">
                        {emp.contractedDays > 0 ? `${emp.contractedDays} días` : '—'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right"><span className="text-sm font-bold text-gray-900">{fmt(emp.dailyRate)}</span></td>
                    <td className="px-4 py-4 hidden lg:table-cell">
                      {emp.lastPayment ? (
                        <button
                          onClick={() => handleViewLastReceipt(emp)}
                          className="group flex items-center gap-1.5 px-2 py-1 -ml-2 rounded-lg hover:bg-gray-100 transition-colors"
                          title="Ver recibo de pago"
                        >
                          <Receipt size={14} className="text-gray-400 group-hover:text-[#C5A059]" />
                          <span className="text-sm text-gray-500 group-hover:text-gray-900 font-medium">
                            {new Date(emp.lastPayment).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: '2-digit' })}
                          </span>
                        </button>
                      ) : (
                        <span className="text-sm text-gray-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right">
                      {emp.status === 'activo' && (
                        <button
                          onClick={() => setPayEventualTarget(emp)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#C5A059]/10 text-[#3D2B1F] hover:bg-[#C5A059] hover:text-white transition-all"
                        >
                          Registrar Pago
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Pay Eventual Modal ── */}
      {payEventualTarget && (
        <PayEventualModal
          emp={payEventualTarget}
          onConfirm={handlePayEventual}
          onClose={() => setPayEventualTarget(null)}
          paying={payingEventual}
        />
      )}

      {/* ── Receipt Modal ── */}
      {receiptData && (
        <ReceiptModal
          emp={receiptData.emp}
          amountUsd={receiptData.amount}
          period={receiptData.period}
          bcvRate={receiptData.bcvRate || bcvRate}
          isHistory={receiptData.isHistory}
          onClose={() => setReceiptData(null)}
        />
      )}

      {/* ── Modal Nuevo Empleado ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-5 max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Nuevo Empleado</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                <X size={18} className="text-gray-500" />
              </button>
            </div>

            {/* Type selector */}
            <div className="flex gap-2 bg-gray-100 rounded-xl p-1">
              {(['fijo', 'eventual'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setForm(f => ({ ...f, employeeType: t }))}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all capitalize
                    ${form.employeeType === t ? 'bg-white shadow-sm text-[#3D2B1F]' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  {t === 'fijo' ? '👔 Fijo' : '🔧 Eventual'}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">Nombre Completo</label>
                <input type="text" placeholder="Nombre y apellido" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C5A059]" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">Cargo</label>
                <input type="text" placeholder="Cargo o función" value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C5A059]" />
              </div>

              {/* Fijo fields */}
              {form.employeeType === 'fijo' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">Sueldo Quincenal ($)</label>
                    <input type="number" placeholder="0" value={form.salary}
                      onChange={e => setForm(f => ({ ...f, salary: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C5A059]" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">Fecha de Ingreso</label>
                    <input type="date" value={form.hireDate}
                      onChange={e => setForm(f => ({ ...f, hireDate: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C5A059]" />
                  </div>
                </div>
              )}

              {/* Eventual fields */}
              {form.employeeType === 'eventual' && (
                <>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 block">Modalidad de Pago</label>
                    <div className="flex gap-2">
                      {(['semanal', 'por_dias'] as const).map(freq => (
                        <button key={freq}
                          onClick={() => setForm(f => ({ ...f, paymentFrequency: freq }))}
                          className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all
                            ${form.paymentFrequency === freq ? 'bg-[#3D2B1F] text-white border-[#3D2B1F]' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                        >
                          {freq === 'semanal' ? '🗓 Semanal' : '📅 Por Días'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">Tarifa por Día ($)</label>
                      <input type="number" placeholder="0" value={form.dailyRate}
                        onChange={e => setForm(f => ({ ...f, dailyRate: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C5A059]" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">Días Contratado</label>
                      <input type="number" placeholder="0" value={form.contractedDays}
                        onChange={e => setForm(f => ({ ...f, contractedDays: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C5A059]" />
                    </div>
                  </div>

                  {form.dailyRate && (
                    <div className="bg-[#3D2B1F]/5 border border-[#3D2B1F]/10 rounded-xl p-3 text-center">
                      <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Estimado de Pago</p>
                      <p className="text-lg font-bold text-[#3D2B1F] mt-1">
                        {form.contractedDays
                          ? fmt(Number(form.dailyRate) * Number(form.contractedDays))
                          : fmt(Number(form.dailyRate) * (form.paymentFrequency === 'semanal' ? 7 : 1))}
                      </p>
                      <p className="text-[10px] text-gray-400">
                        {form.contractedDays ? `${form.dailyRate} × ${form.contractedDays} días contratados` : ''}
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">Fecha de Ingreso</label>
                    <input type="date" value={form.hireDate}
                      onChange={e => setForm(f => ({ ...f, hireDate: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C5A059]" />
                  </div>
                </>
              )}
            </div>

            <button
              onClick={handleSave}
              disabled={!isFormValid}
              className={`w-full py-3.5 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2
                ${saved ? 'bg-emerald-500 text-white'
                  : !isFormValid ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-[#3D2B1F] hover:bg-[#2a1d14] text-white shadow-lg'}`}
            >
              {saved ? <><Check size={16} /> Empleado Agregado</> : 'Guardar Empleado'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default EmployeesPage
