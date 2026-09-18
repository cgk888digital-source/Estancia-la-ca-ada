import React, { useState, useEffect, useMemo } from 'react'
import { Plus, Check, X, UserCheck, UserX, DollarSign, Loader2, Users, Clock, Calendar, Receipt, Pencil, CheckSquare, Square, Coins, Gift, Trash2 } from 'lucide-react'
import LoadErrorBanner from './LoadErrorBanner'
import type { Employee, EmployeeBonus } from '../types'
import { supabase } from '../../lib/supabase'
import { getBcvEuroRate } from '../../utils/exchangeRate'
import { parseLocalDate, fechaLocalISO } from '../../utils/dateUtils'
import ReceiptModal from './ReceiptModal'
import WeeklyTipsModal from './WeeklyTipsModal'
import {
  cargarBonos, crearBono, borrarBonoPendiente, pagarBonosPendientes,
  sumaDeBonos, bonosPagadosEn, esApunteDeBono,
} from '../../utils/employeeBonuses'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

// Los sueldos son cifras redondas, los bonos no: 12,50 no puede salir como 13.
const fmtBono = (n: number) =>
  new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n)

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
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)
  const [paidId, setPaidId] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [payEventualTarget, setPayEventualTarget] = useState<Employee | null>(null)
  const [payingEventual, setPayingEventual] = useState(false)
  const [activeTab, setActiveTab] = useState<'fijos' | 'eventuales'>('fijos')
  const [receiptData, setReceiptData] = useState<{emp: Employee, amount: number, period: string, isHistory?: boolean, bcvRate?: number, bonuses?: EmployeeBonus[]} | null>(null)
  const [bcvRate, setBcvRate] = useState<number>(36.50)
  
  // Fondo y Reparto de Propinas
  const [globalTipsBalance, setGlobalTipsBalance] = useState<number>(0)
  const [showTipsModal, setShowTipsModal] = useState(false)

  // Filtro de Frecuencia y Selección Múltiple para Nómina
  const [frequencyFilter, setFrequencyFilter] = useState<'todas' | 'semanal' | 'quincenal' | 'por_dias'>('todas')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [payingSelected, setPayingSelected] = useState(false)

  // ── Bonos ─────────────────────────────────────────────────────────────────
  const [bonuses, setBonuses] = useState<EmployeeBonus[]>([])
  const [bonusTarget, setBonusTarget] = useState<Employee | null>(null)
  const [savingBonus, setSavingBonus] = useState(false)
  const [bonusForm, setBonusForm] = useState(() => ({ amount: '', concept: '', date: fechaLocalISO() }))

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
      const rate = await getBcvEuroRate()
      if (active) setBcvRate(rate)

      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .order('name', { ascending: true })

      if (!active) return

      if (error) {
        console.error('Error fetching employees:', error)
        setLoadError(error.message)
      } else {
        setLoadError(null)
        setEmployees((data || []).map(mapDbEmployeeToReact))
      }
      setLoading(false)
    }
    fetchEmployees()
    
    const fetchTips = async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('type, amount')
        .eq('category', 'propinas')
        
      if (!active || error || !data) return
      
      let total = 0
      data.forEach(tx => {
        const amt = Number(tx.amount) || 0
        if (tx.type === 'ingreso') total += amt
        else if (tx.type === 'egreso') total -= amt
      })
      setGlobalTipsBalance(total)
    }
    fetchTips()

    const fetchBonuses = async () => {
      const { bonos, error } = await cargarBonos()
      if (!active) return
      // Si esto fallara, la nomina sigue funcionando sin bonos. Lo que no puede pasar es
      // enseñar media lista y que la dueña pague de menos creyendo que estan todos.
      if (error) { console.error('Error cargando bonos:', error); return }
      setBonuses(bonos)
    }
    fetchBonuses()

    return () => { active = false }
  }, [])

  const {
    fijos, eventuales, activeFijos, activeEventuales,
    totalFijosPayroll, pendingFijos, pendingFijosTotal
  } = useMemo(() => {
    const fijos = employees.filter(e => e.employeeType === 'fijo')
    const eventuales = employees.filter(e => e.employeeType === 'eventual')
    const activeFijos = fijos.filter(e => e.status === 'activo')
    const activeEventuales = eventuales.filter(e => e.status === 'activo')
    const totalFijosPayroll = activeFijos.reduce((s, e) => s + e.salary, 0)
    const pendingFijos = activeFijos.filter(e => e.pendingPayment)
    const pendingFijosTotal = pendingFijos.reduce((s, e) => s + e.salary, 0)
    return { fijos, eventuales, activeFijos, activeEventuales, totalFijosPayroll, pendingFijos, pendingFijosTotal }
  }, [employees])

  // Filtrado por frecuencia
  const filteredFijos = useMemo(() => {
    return fijos.filter(e => {
      if (frequencyFilter === 'todas') return true
      return e.paymentFrequency === frequencyFilter
    })
  }, [fijos, frequencyFilter])

  const filteredEventuales = useMemo(() => {
    return eventuales.filter(e => {
      if (frequencyFilter === 'todas') return true
      return e.paymentFrequency === frequencyFilter
    })
  }, [eventuales, frequencyFilter])

  // Empleados seleccionados para pago
  const selectedPendingEmployees = useMemo(() => {
    return employees.filter(e => selectedIds.has(e.id) && e.status === 'activo' && e.pendingPayment)
  }, [employees, selectedIds])

  const totalSelectedPay = useMemo(() => {
    // El total que se anuncia antes de confirmar tiene que ser el que se va a pagar de
    // verdad, bonos incluidos, o la dueña aprueba una cifra y sale otra.
    const bonoPorEmpleado = new Map<string, number>()
    for (const b of bonuses) {
      if (b.paid) continue
      bonoPorEmpleado.set(b.employeeId, (bonoPorEmpleado.get(b.employeeId) ?? 0) + b.amount)
    }
    return selectedPendingEmployees.reduce((sum, e) => {
      const base = e.employeeType === 'fijo'
        ? e.salary
        : e.dailyRate * (e.contractedDays || (e.paymentFrequency === 'semanal' ? 7 : 1))
      return sum + base + (bonoPorEmpleado.get(e.id) ?? 0)
    }, 0)
  }, [selectedPendingEmployees, bonuses])

  // Bonos pendientes agrupados por empleado, para no recorrer la lista entera en cada
  // fila de la tabla.
  const bonosPendientesPorEmpleado = useMemo(() => {
    const mapa = new Map<string, EmployeeBonus[]>()
    for (const b of bonuses) {
      if (b.paid) continue
      const lista = mapa.get(b.employeeId)
      if (lista) lista.push(b)
      else mapa.set(b.employeeId, [b])
    }
    return mapa
  }, [bonuses])

  const bonosPendientesDe = (id: string) => bonosPendientesPorEmpleado.get(id) ?? []
  const totalBonosPendientes = (id: string) => sumaDeBonos(bonosPendientesDe(id))

  /** Cobra los bonos pendientes de un empleado y deja el estado en pantalla al dia. */
  const cobrarBonos = async (emp: Employee, fecha: string): Promise<EmployeeBonus[]> => {
    const pendientes = bonosPendientesDe(emp.id)
    if (pendientes.length === 0) return []

    const { pagados, error } = await pagarBonosPendientes(emp, pendientes, fecha, bcvRate)
    if (pagados.length > 0) {
      const ids = new Set(pagados.map(b => b.id))
      setBonuses(prev => prev.map(b => ids.has(b.id) ? { ...b, paid: true, paidAt: fecha } : b))
    }
    // El error se enseña siempre: es dinero que puede quedar sin apuntar en Egresos.
    if (error) alert(error)
    return pagados
  }

  // ── Pay fixed employee ────────────────────────────────────────────────────
  const handlePay = async (id: string) => {
    setPaidId(id)
    const today = fechaLocalISO()
    const emp = employees.find(e => e.id === id)

    const { error } = await supabase
      .from('employees')
      .update({ pending_payment: false, last_payment: today })
      .eq('id', id)

    if (error) { console.error(error); setPaidId(null); return }

    if (emp) {
      const periodLabel = emp.paymentFrequency === 'semanal' ? 'semanal' : 'quincenal'
      await supabase.from('transactions').insert([{
        date: today,
        type: 'egreso',
        category: 'empleados',
        description: `Pago nómina ${periodLabel} — ${emp.name}`,
        amount: emp.salary,
        payment_method: 'transferencia',
        related_to: emp.name,
        exchange_rate: bcvRate,
        amount_bs: Math.round(emp.salary * bcvRate * 100) / 100,
      }])
    }

    const bonosCobrados = emp ? await cobrarBonos(emp, today) : []

    setEmployees(prev => prev.map(e => e.id === id ? { ...e, pendingPayment: false, lastPayment: today } : e))
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    setPaidId(null)
    if (emp) {
      setReceiptData({
        emp,
        amount: emp.salary + sumaDeBonos(bonosCobrados),
        period: emp.paymentFrequency === 'semanal' ? 'Semana' : 'Quincena',
        bonuses: bonosCobrados,
      })
    }
  }

  // ── Pay Selected Employees ────────────────────────────────────────────────
  const handlePaySelected = async () => {
    if (selectedPendingEmployees.length === 0) return

    const confirmMsg = `¿Deseas registrar el pago de nómina de ${selectedPendingEmployees.length} empleado(s) seleccionado(s) por un total de ${fmt(totalSelectedPay)}?`
    if (!window.confirm(confirmMsg)) return

    setPayingSelected(true)
    const today = fechaLocalISO()
    const ids = selectedPendingEmployees.map(e => e.id)

    const { error } = await supabase
      .from('employees')
      .update({ pending_payment: false, last_payment: today })
      .in('id', ids)

    if (error) {
      console.error('Error al actualizar empleados:', error)
      alert(`Hubo un error al actualizar el estado: ${error.message}`)
      setPayingSelected(false)
      return
    }

    const txs = selectedPendingEmployees.map(emp => {
      const amount = emp.employeeType === 'fijo'
        ? emp.salary
        : emp.dailyRate * (emp.contractedDays || (emp.paymentFrequency === 'semanal' ? 7 : 1))
      const periodLabel = emp.paymentFrequency === 'semanal' ? 'semanal' : emp.paymentFrequency === 'quincenal' ? 'quincenal' : 'por días'
      return {
        date: today,
        type: 'egreso',
        category: 'empleados',
        description: `Pago nómina ${periodLabel} — ${emp.name}`,
        amount,
        payment_method: 'transferencia',
        related_to: emp.name,
        exchange_rate: bcvRate,
        amount_bs: Math.round(amount * bcvRate * 100) / 100,
      }
    })

    await supabase.from('transactions').insert(txs)

    // Los bonos pendientes se cobran con la nomina, cada uno con su apunte aparte.
    const bonosPorEmpleado = new Map<string, EmployeeBonus[]>()
    for (const emp of selectedPendingEmployees) {
      bonosPorEmpleado.set(emp.id, await cobrarBonos(emp, today))
    }

    setEmployees(prev => prev.map(e => ids.includes(e.id) ? { ...e, pendingPayment: false, lastPayment: today } : e))
    setSelectedIds(new Set())
    setPayingSelected(false)

    if (selectedPendingEmployees.length === 1) {
      const single = selectedPendingEmployees[0]
      const amt = single.employeeType === 'fijo' ? single.salary : single.dailyRate * (single.contractedDays || 7)
      const bonos = bonosPorEmpleado.get(single.id) ?? []
      setReceiptData({
        emp: single,
        amount: amt + sumaDeBonos(bonos),
        period: single.paymentFrequency === 'semanal' ? 'Semana' : 'Quincena',
        bonuses: bonos,
      })
    } else {
      alert(`¡Se procesó exitosamente el pago de nómina de ${selectedPendingEmployees.length} empleados!`)
    }
  }

  const handlePayAll = async () => {
    const today = fechaLocalISO()
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
      description: `Pago nómina ${emp.paymentFrequency === 'semanal' ? 'semanal' : 'quincenal'} — ${emp.name}`,
      amount: emp.salary,
      payment_method: 'transferencia',
      related_to: emp.name,
      exchange_rate: bcvRate,
      amount_bs: Math.round(emp.salary * bcvRate * 100) / 100,
    }))
    await supabase.from('transactions').insert(txs)

    for (const emp of pending) await cobrarBonos(emp, today)

    setEmployees(prev =>
      prev.map(e => e.employeeType === 'fijo' && e.status === 'activo' && e.pendingPayment
        ? { ...e, pendingPayment: false, lastPayment: today }
        : e
      )
    )
    setSelectedIds(new Set())
  }

  // ── Pay eventual employee ─────────────────────────────────────────────────
  const handlePayEventual = async (emp: Employee, days: number) => {
    setPayingEventual(true)
    const today = fechaLocalISO()
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
      description: `Pago eventual (${freqLabel}) — ${emp.name}`,
      amount,
      payment_method: 'transferencia',
      related_to: emp.name,
      exchange_rate: bcvRate,
      amount_bs: Math.round(amount * bcvRate * 100) / 100,
    }])

    const bonosCobrados = await cobrarBonos(emp, today)

    setEmployees(prev => prev.map(e => e.id === emp.id ? { ...e, lastPayment: today, pendingPayment: false } : e))
    setPayingEventual(false)
    setPayEventualTarget(null)
    setReceiptData({
      emp,
      amount: amount + sumaDeBonos(bonosCobrados),
      period: freqLabel,
      bonuses: bonosCobrados,
    })
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
      .limit(10)

    // Un bono es otro apunte del mismo empleado y la misma fecha. Sin saltarlos, al pedir
    // el recibo saldria el del bono en lugar del del sueldo.
    const tx = (data || []).find(t => !esApunteDeBono(t.notes))

    if (error || !tx) {
      alert('No se encontró el comprobante de este pago.')
      return
    }
    const rate = tx.exchange_rate ? Number(tx.exchange_rate) : bcvRate
    
    let period = emp.paymentFrequency === 'semanal' ? 'Semana' : 'Quincena'
    if (emp.employeeType === 'eventual') {
      const entreParentesis = tx.description.match(/\((.*?)\)/)
      if (entreParentesis) period = entreParentesis[1]
    }

    const bonos = await bonosPagadosEn(emp.id, emp.lastPayment)
    setReceiptData({
      emp,
      amount: Number(tx.amount) + sumaDeBonos(bonos),
      period,
      isHistory: true,
      bcvRate: rate,
      bonuses: bonos,
    })
  }

  // ── Bonos: apuntar, quitar ────────────────────────────────────────────────
  const handleOpenBonus = (emp: Employee) => {
    setBonusTarget(emp)
    setBonusForm({ amount: '', concept: '', date: fechaLocalISO() })
  }

  const handleAddBonus = async () => {
    if (!bonusTarget) return
    const monto = Number(String(bonusForm.amount).replace(',', '.'))
    if (!Number.isFinite(monto) || monto <= 0) {
      alert('Escriba un monto mayor que cero.')
      return
    }

    setSavingBonus(true)
    const { bono, error } = await crearBono(bonusTarget.id, monto, bonusForm.concept, bonusForm.date)
    setSavingBonus(false)

    if (error || !bono) {
      alert('No se pudo guardar el bono: ' + (error ?? 'la base de datos no devolvió nada'))
      return
    }

    setBonuses(prev => [bono, ...prev])
    setBonusForm({ amount: '', concept: '', date: fechaLocalISO() })
  }

  const handleDeleteBonus = async (bono: EmployeeBonus) => {
    if (!window.confirm(`¿Eliminar el bono de ${fmtBono(bono.amount)}?`)) return
    const error = await borrarBonoPendiente(bono.id)
    if (error) { alert('No se pudo eliminar el bono: ' + error); return }
    setBonuses(prev => prev.filter(b => b.id !== bono.id))
  }

  // ── Open Modals ───────────────────────────────────────────────────────────
  const handleOpenNew = () => {
    setEditingEmployee(null)
    setForm({
      name: '',
      role: '',
      hireDate: fechaLocalISO(),
      employeeType: activeTab === 'eventuales' ? 'eventual' : 'fijo',
      salary: '',
      paymentFrequency: 'quincenal',
      dailyRate: '',
      contractedDays: '',
    })
    setShowModal(true)
  }

  const handleOpenEdit = (emp: Employee) => {
    setEditingEmployee(emp)
    setForm({
      name: emp.name,
      role: emp.role,
      hireDate: emp.hireDate || '',
      employeeType: emp.employeeType,
      salary: emp.salary ? String(emp.salary) : '',
      paymentFrequency: emp.paymentFrequency,
      dailyRate: emp.dailyRate ? String(emp.dailyRate) : '',
      contractedDays: emp.contractedDays ? String(emp.contractedDays) : '',
    })
    setShowModal(true)
  }

  // ── Save/Update employee ──────────────────────────────────────────────────
  const handleSave = async () => {
    const isFijo = form.employeeType === 'fijo'
    if (!form.name || !form.role) return
    if (isFijo && !form.salary) return
    if (!isFijo && !form.dailyRate) return

    if (editingEmployee) {
      // Modo Edición
      const updatedDb = {
        name: form.name,
        role: form.role,
        salary: isFijo ? Number(form.salary) : 0,
        employee_type: form.employeeType,
        payment_frequency: form.paymentFrequency,
        daily_rate: isFijo ? 0 : Number(form.dailyRate),
        contracted_days: isFijo ? 0 : Number(form.contractedDays) || 0,
        hire_date: form.hireDate || editingEmployee.hireDate,
      }

      const { data, error } = await supabase
        .from('employees')
        .update(updatedDb)
        .eq('id', editingEmployee.id)
        .select('*')

      if (error) { console.error(error); alert(`Error al actualizar: ${error.message}`); return }
      if (data && data[0]) {
        setEmployees(prev => prev.map(e => e.id === editingEmployee.id ? mapDbEmployeeToReact(data[0]) : e))
      }
    } else {
      // Modo Creación
      const dbEmp = {
        name: form.name,
        role: form.role,
        salary: isFijo ? Number(form.salary) : 0,
        status: 'activo',
        hire_date: form.hireDate || fechaLocalISO(),
        last_payment: null,
        pending_payment: true,
        employee_type: form.employeeType,
        payment_frequency: form.paymentFrequency,
        daily_rate: isFijo ? 0 : Number(form.dailyRate),
        contracted_days: isFijo ? 0 : Number(form.contractedDays) || 0,
      }

      const { data, error } = await supabase.from('employees').insert([dbEmp]).select('*')
      if (error) { console.error(error); alert(`Error al crear: ${error.message}`); return }
      if (data && data[0]) {
        setEmployees(prev => [mapDbEmployeeToReact(data[0]), ...prev])
      }
    }

    setSaved(true)
    setTimeout(() => {
      setSaved(false)
      setShowModal(false)
      setEditingEmployee(null)
    }, 900)
  }

  const isFormValid = form.name && form.role && (form.employeeType === 'fijo' ? !!form.salary : !!form.dailyRate)

  // Toggle selection
  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Toggle all pending in current view
  const currentPendingList = activeTab === 'fijos'
    ? filteredFijos.filter(e => e.status === 'activo' && e.pendingPayment)
    : filteredEventuales.filter(e => e.status === 'activo' && e.pendingPayment)

  const isAllPendingSelected = currentPendingList.length > 0 && currentPendingList.every(e => selectedIds.has(e.id))

  const handleToggleSelectAll = () => {
    if (isAllPendingSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev)
        currentPendingList.forEach(e => next.delete(e.id))
        return next
      })
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev)
        currentPendingList.forEach(e => next.add(e.id))
        return next
      })
    }
  }

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
      <LoadErrorBanner message={loadError} />
      
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nómina y Empleados</h1>
          <p className="text-sm text-gray-500 mt-1">
            {activeFijos.length} fijos · {activeEventuales.length} eventuales · Tasa BCV: <strong>{bcvRate} Bs/€</strong>
          </p>
        </div>
        <button
          onClick={handleOpenNew}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#3D2B1F] hover:bg-[#2a1d14] text-white rounded-xl text-sm font-bold transition-all shadow-sm active:scale-95"
        >
          <Plus size={16} />
          Nuevo Empleado
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1"><Users size={11} /> Fijos</p>
          <p className="text-2xl font-bold text-gray-900">{activeFijos.length}</p>
          <p className="text-xs text-gray-400 mt-1">Nómina base: {fmt(totalFijosPayroll)}</p>
        </div>
        
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1"><Clock size={11} /> Eventuales</p>
          <p className="text-2xl font-bold text-gray-900">{activeEventuales.length}</p>
          <p className="text-xs text-gray-400 mt-1">activos contratados</p>
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
            className={`mt-2 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all justify-center
              ${pendingFijos.length > 0 ? 'bg-violet-600 hover:bg-violet-700 text-white shadow-sm' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
          >
            <DollarSign size={15} />
            Pagar Todo
          </button>
        </div>

        {/* Fondo de Propinas con Modal Semanal */}
        <div className="bg-emerald-50 rounded-2xl p-5 border border-emerald-100 shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-1 flex items-center gap-1">
              <Coins size={12} /> Fondo de Propinas
            </p>
            <p className="text-2xl font-bold text-emerald-700">{fmt(globalTipsBalance)}</p>
          </div>
          <button
            onClick={() => setShowTipsModal(true)}
            className="mt-2 flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all w-full justify-center bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white shadow-sm"
          >
            <Coins size={14} />
            Reparto Semanal
          </button>
        </div>
      </div>

      {/* Tabs & Frequency Filter Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Tab Fijos vs Eventuales */}
        <div className="flex gap-1 bg-gray-100 rounded-2xl p-1 w-fit">
          <button
            onClick={() => { setActiveTab('fijos'); setSelectedIds(new Set()) }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'fijos' ? 'bg-white shadow-sm text-[#3D2B1F]' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Users size={15} />
            Empleados Fijos
            {pendingFijos.length > 0 && (
              <span className="bg-amber-500 text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-full">{pendingFijos.length}</span>
            )}
          </button>
          <button
            onClick={() => { setActiveTab('eventuales'); setSelectedIds(new Set()) }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'eventuales' ? 'bg-white shadow-sm text-[#3D2B1F]' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Clock size={15} />
            Eventuales
          </button>
        </div>

        {/* Frecuencia de Pago Filter */}
        <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-2xl p-1">
          <span className="text-xs text-gray-400 font-bold px-2 uppercase tracking-wider hidden md:inline">Frecuencia:</span>
          {(['todas', 'semanal', 'quincenal'] as const).map(freq => (
            <button
              key={freq}
              onClick={() => setFrequencyFilter(freq)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all capitalize ${
                frequencyFilter === freq
                  ? 'bg-[#3D2B1F] text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              {freq === 'todas' ? 'Todas' : freq === 'semanal' ? '🗓 Semanal' : '📅 Quincenal'}
            </button>
          ))}
        </div>
      </div>

      {/* Floating Action Bar for Selected Employees */}
      {selectedPendingEmployees.length > 0 && (
        <div className="bg-violet-900 text-white p-4 px-6 rounded-2xl shadow-xl flex items-center justify-between gap-4 flex-wrap animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center gap-3">
            <div className="bg-violet-800 text-violet-200 px-3 py-1 rounded-xl text-xs font-bold">
              {selectedPendingEmployees.length} seleccionado{selectedPendingEmployees.length !== 1 ? 's' : ''}
            </div>
            <span className="text-sm font-medium text-violet-100">
              Total a pagar: <strong className="text-white text-base font-bold">{fmt(totalSelectedPay)}</strong>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-1.5 text-xs text-violet-300 hover:text-white transition-colors font-medium"
            >
              Deseleccionar
            </button>
            <button
              onClick={handlePaySelected}
              disabled={payingSelected}
              className="flex items-center gap-2 px-5 py-2.5 bg-white text-violet-950 hover:bg-violet-50 rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 disabled:opacity-50"
            >
              {payingSelected ? <Loader2 size={14} className="animate-spin" /> : <DollarSign size={14} />}
              Pagar Seleccionados ({selectedPendingEmployees.length})
            </button>
          </div>
        </div>
      )}

      {/* ── FIJOS TABLE ── */}
      {activeTab === 'fijos' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="w-12 px-4 py-4 text-center">
                    <button
                      type="button"
                      onClick={handleToggleSelectAll}
                      disabled={currentPendingList.length === 0}
                      className="text-gray-400 hover:text-violet-600 disabled:opacity-30 transition-colors"
                      title={isAllPendingSelected ? "Deseleccionar pendientes" : "Seleccionar todos los pendientes"}
                    >
                      {isAllPendingSelected ? (
                        <CheckSquare size={18} className="text-violet-600" />
                      ) : (
                        <Square size={18} />
                      )}
                    </button>
                  </th>
                  <th className="text-left text-xs font-bold text-gray-400 uppercase tracking-widest px-4 py-4">Empleado</th>
                  <th className="text-left text-xs font-bold text-gray-400 uppercase tracking-widest px-4 py-4 hidden sm:table-cell">Cargo</th>
                  <th className="text-left text-xs font-bold text-gray-400 uppercase tracking-widest px-4 py-4">Modalidad</th>
                  <th className="text-left text-xs font-bold text-gray-400 uppercase tracking-widest px-4 py-4 hidden lg:table-cell">Último Pago</th>
                  <th className="text-left text-xs font-bold text-gray-400 uppercase tracking-widest px-4 py-4">Estado</th>
                  <th className="text-right text-xs font-bold text-gray-400 uppercase tracking-widest px-6 py-4">Sueldo Base</th>
                  <th className="px-4 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredFijos.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-16 text-sm text-gray-400">
                      No hay empleados fijos con el filtro seleccionado
                    </td>
                  </tr>
                ) : filteredFijos.map(emp => {
                  const isSelected = selectedIds.has(emp.id)
                  const isSelectable = emp.status === 'activo' && emp.pendingPayment

                  return (
                    <tr
                      key={emp.id}
                      className={`hover:bg-gray-50/80 transition-colors ${
                        emp.status === 'inactivo' ? 'opacity-50' : ''
                      } ${isSelected ? 'bg-violet-50/40' : ''}`}
                    >
                      {/* Checkbox de selección */}
                      <td className="w-12 px-4 py-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleSelect(emp.id)}
                          disabled={!isSelectable}
                          className="disabled:opacity-20 text-gray-400 hover:text-violet-600 transition-colors"
                        >
                          {isSelected ? (
                            <CheckSquare size={18} className="text-violet-600" />
                          ) : (
                            <Square size={18} />
                          )}
                        </button>
                      </td>

                      <td className="px-4 py-4">
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

                      <td className="px-4 py-4 hidden sm:table-cell">
                        <span className="text-sm text-gray-600">{emp.role}</span>
                      </td>

                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${
                          emp.paymentFrequency === 'semanal'
                            ? 'bg-blue-50 text-blue-700 border border-blue-100'
                            : 'bg-amber-50 text-amber-800 border border-amber-100'
                        }`}>
                          {emp.paymentFrequency === 'semanal' ? <Calendar size={11} /> : <Clock size={11} />}
                          {FREQ_LABELS[emp.paymentFrequency] || emp.paymentFrequency}
                        </span>
                      </td>

                      <td className="px-4 py-4 hidden lg:table-cell">
                        {emp.lastPayment ? (
                          <button
                            onClick={() => handleViewLastReceipt(emp)}
                            className="group flex items-center gap-1.5 px-2 py-1 -ml-2 rounded-lg hover:bg-gray-100 transition-colors"
                            title="Ver recibo de pago"
                          >
                            <Receipt size={14} className="text-gray-400 group-hover:text-[#C5A059]" />
                            <span className="text-sm text-gray-500 group-hover:text-gray-900 font-medium">
                              {parseLocalDate(emp.lastPayment).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: '2-digit' })}
                            </span>
                          </button>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </td>

                      <td className="px-4 py-4">
                        {emp.status === 'inactivo' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 text-gray-500 rounded-lg text-xs font-bold">
                            <UserX size={12} /> Inactivo
                          </span>
                        ) : emp.pendingPayment ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 rounded-lg text-xs font-bold">
                            <DollarSign size={12} /> Pendiente
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold">
                            <UserCheck size={12} /> Pagado
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <span className="text-sm font-bold text-gray-900">{fmt(emp.salary)}</span>
                        <p className="text-[10px] text-gray-400">/{emp.paymentFrequency === 'semanal' ? 'sem' : 'quinc'}</p>
                        {totalBonosPendientes(emp.id) > 0 && (
                          <p className="text-[10px] font-bold text-emerald-600 mt-1">
                            + {fmtBono(totalBonosPendientes(emp.id))} en bonos
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenBonus(emp)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              totalBonosPendientes(emp.id) > 0
                                ? 'text-emerald-600 hover:bg-emerald-50'
                                : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
                            }`}
                            title="Bonos del empleado"
                          >
                            <Gift size={14} />
                          </button>

                          <button
                            onClick={() => handleOpenEdit(emp)}
                            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Editar empleado y frecuencia"
                          >
                            <Pencil size={14} />
                          </button>

                          {emp.status === 'activo' && emp.pendingPayment && (
                            <button
                              onClick={() => handlePay(emp.id)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                paidId === emp.id
                                  ? 'bg-emerald-500 text-white'
                                  : 'bg-violet-100 text-violet-700 hover:bg-violet-600 hover:text-white'
                              }`}
                            >
                              {paidId === emp.id ? <Check size={14} /> : 'Pagar'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
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
                  <th className="w-12 px-4 py-4 text-center">
                    <button
                      type="button"
                      onClick={handleToggleSelectAll}
                      disabled={currentPendingList.length === 0}
                      className="text-gray-400 hover:text-violet-600 disabled:opacity-30 transition-colors"
                      title={isAllPendingSelected ? "Deseleccionar pendientes" : "Seleccionar todos los pendientes"}
                    >
                      {isAllPendingSelected ? (
                        <CheckSquare size={18} className="text-violet-600" />
                      ) : (
                        <Square size={18} />
                      )}
                    </button>
                  </th>
                  <th className="text-left text-xs font-bold text-gray-400 uppercase tracking-widest px-4 py-4">Empleado</th>
                  <th className="text-left text-xs font-bold text-gray-400 uppercase tracking-widest px-4 py-4 hidden sm:table-cell">Cargo</th>
                  <th className="text-left text-xs font-bold text-gray-400 uppercase tracking-widest px-4 py-4">Modalidad</th>
                  <th className="text-left text-xs font-bold text-gray-400 uppercase tracking-widest px-4 py-4 hidden md:table-cell">Días Contrato</th>
                  <th className="text-right text-xs font-bold text-gray-400 uppercase tracking-widest px-6 py-4">Tarifa / Día</th>
                  <th className="text-left text-xs font-bold text-gray-400 uppercase tracking-widest px-4 py-4 hidden lg:table-cell">Último Pago</th>
                  <th className="px-4 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredEventuales.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-16 text-sm text-gray-400">
                      No hay empleados eventuales con el filtro seleccionado
                    </td>
                  </tr>
                ) : filteredEventuales.map(emp => {
                  const isSelected = selectedIds.has(emp.id)
                  const isSelectable = emp.status === 'activo' && emp.pendingPayment

                  return (
                    <tr
                      key={emp.id}
                      className={`hover:bg-gray-50/80 transition-colors ${
                        emp.status === 'inactivo' ? 'opacity-50' : ''
                      } ${isSelected ? 'bg-violet-50/40' : ''}`}
                    >
                      <td className="w-12 px-4 py-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleSelect(emp.id)}
                          disabled={!isSelectable}
                          className="disabled:opacity-20 text-gray-400 hover:text-violet-600 transition-colors"
                        >
                          {isSelected ? (
                            <CheckSquare size={18} className="text-violet-600" />
                          ) : (
                            <Square size={18} />
                          )}
                        </button>
                      </td>

                      <td className="px-4 py-4">
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

                      <td className="px-4 py-4 hidden sm:table-cell">
                        <span className="text-sm text-gray-600">{emp.role}</span>
                      </td>

                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${
                          emp.paymentFrequency === 'semanal' ? 'bg-blue-50 text-blue-700' : 'bg-orange-50 text-orange-700'
                        }`}>
                          {emp.paymentFrequency === 'semanal' ? <Calendar size={11} /> : <Clock size={11} />}
                          {FREQ_LABELS[emp.paymentFrequency] || emp.paymentFrequency}
                        </span>
                      </td>

                      <td className="px-4 py-4 hidden md:table-cell">
                        <span className="text-sm text-gray-600">
                          {emp.contractedDays > 0 ? `${emp.contractedDays} días` : '—'}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <span className="text-sm font-bold text-gray-900">{fmt(emp.dailyRate)}</span>
                        {totalBonosPendientes(emp.id) > 0 && (
                          <p className="text-[10px] font-bold text-emerald-600 mt-1">
                            + {fmtBono(totalBonosPendientes(emp.id))} en bonos
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-4 hidden lg:table-cell">
                        {emp.lastPayment ? (
                          <button
                            onClick={() => handleViewLastReceipt(emp)}
                            className="group flex items-center gap-1.5 px-2 py-1 -ml-2 rounded-lg hover:bg-gray-100 transition-colors"
                            title="Ver recibo de pago"
                          >
                            <Receipt size={14} className="text-gray-400 group-hover:text-[#C5A059]" />
                            <span className="text-sm text-gray-500 group-hover:text-gray-900 font-medium">
                              {parseLocalDate(emp.lastPayment).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: '2-digit' })}
                            </span>
                          </button>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </td>

                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenBonus(emp)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              totalBonosPendientes(emp.id) > 0
                                ? 'text-emerald-600 hover:bg-emerald-50'
                                : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
                            }`}
                            title="Bonos del empleado"
                          >
                            <Gift size={14} />
                          </button>

                          <button
                            onClick={() => handleOpenEdit(emp)}
                            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Editar empleado y frecuencia"
                          >
                            <Pencil size={14} />
                          </button>

                          {emp.status === 'activo' && (
                            <button
                              onClick={() => setPayEventualTarget(emp)}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#C5A059]/10 text-[#3D2B1F] hover:bg-[#C5A059] hover:text-white transition-all"
                            >
                              Registrar Pago
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modal de Reparto Semanal de Propinas ── */}
      <WeeklyTipsModal
        isOpen={showTipsModal}
        onClose={() => setShowTipsModal(false)}
        employees={employees}
        globalTipsBalance={globalTipsBalance}
        bcvRate={bcvRate}
        onDistributed={(distributedTotal) => {
          setGlobalTipsBalance(prev => Math.max(0, prev - distributedTotal))
        }}
      />

      {/* ── Pay Eventual Modal ── */}
      {payEventualTarget && (
        <PayEventualModal
          emp={payEventualTarget}
          onConfirm={handlePayEventual}
          onClose={() => setPayEventualTarget(null)}
          paying={payingEventual}
        />
      )}

      {/* ── Modal de Bonos del Empleado ── */}
      {bonusTarget && (() => {
        const suyos = bonuses
          .filter(b => b.employeeId === bonusTarget.id)
          .sort((a, b) => b.bonusDate.localeCompare(a.bonusDate))
        const pendientes = suyos.filter(b => !b.paid)
        const pagados = suyos.filter(b => b.paid)
        const totalPendiente = sumaDeBonos(pendientes)

        return (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6 space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <Gift size={18} className="text-emerald-600" />
                    Bonos
                  </h2>
                  <p className="text-sm text-gray-500 mt-0.5">{bonusTarget.name}</p>
                </div>
                <button
                  onClick={() => setBonusTarget(null)}
                  className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors shrink-0"
                >
                  <X size={18} className="text-gray-500" />
                </button>
              </div>

              {totalPendiente > 0 && (
                <div className="rounded-2xl bg-emerald-50 border border-emerald-100 px-4 py-3">
                  <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Pendiente de pago</p>
                  <p className="text-xl font-bold text-emerald-700">{fmtBono(totalPendiente)}</p>
                  <p className="text-xs text-emerald-800 mt-1">
                    Se cobrará solo al pagar la próxima nómina, con su apunte aparte en Egresos.
                  </p>
                </div>
              )}

              {/* Apuntar un bono nuevo */}
              <div className="space-y-3 rounded-2xl border border-gray-100 p-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Nuevo bono</p>

                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Monto (USD)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={bonusForm.amount}
                      onChange={e => setBonusForm(prev => ({ ...prev, amount: e.target.value }))}
                      placeholder="0.00"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#C5A059] transition-colors"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Fecha</label>
                    <input
                      type="date"
                      value={bonusForm.date}
                      onChange={e => setBonusForm(prev => ({ ...prev, date: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#C5A059] transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Motivo (opcional)</label>
                  <input
                    type="text"
                    value={bonusForm.concept}
                    onChange={e => setBonusForm(prev => ({ ...prev, concept: e.target.value }))}
                    placeholder="Buen servicio, temporada alta..."
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#C5A059] transition-colors"
                  />
                </div>

                <button
                  onClick={handleAddBonus}
                  disabled={savingBonus}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2"
                >
                  {savingBonus ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  Apuntar bono
                </button>
              </div>

              {/* Pendientes */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                  Pendientes ({pendientes.length})
                </p>
                {pendientes.length === 0 ? (
                  <p className="text-sm text-gray-400 py-2">No hay bonos pendientes.</p>
                ) : pendientes.map(b => (
                  <div key={b.id} className="flex items-center gap-3 rounded-xl border border-gray-100 px-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900">{fmtBono(b.amount)}</p>
                      <p className="text-xs text-gray-400 truncate">
                        {parseLocalDate(b.bonusDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: '2-digit' })}
                        {b.concept ? ' · ' + b.concept : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteBonus(b)}
                      className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                      title="Eliminar bono"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Historial */}
              {pagados.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                    Ya pagados ({pagados.length}) · {fmtBono(sumaDeBonos(pagados))}
                  </p>
                  {pagados.slice(0, 10).map(b => (
                    <div key={b.id} className="flex items-center gap-3 px-3 py-2">
                      <Check size={14} className="text-emerald-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-600">{fmtBono(b.amount)}</p>
                        <p className="text-xs text-gray-400 truncate">
                          Pagado el {b.paidAt
                            ? parseLocalDate(b.paidAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: '2-digit' })
                            : '—'}
                          {b.concept ? ' · ' + b.concept : ''}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      })()}
      {/* ── Receipt Modal ── */}
      {receiptData && (
        <ReceiptModal
          emp={receiptData.emp}
          amountUsd={receiptData.amount}
          period={receiptData.period}
          bcvRate={receiptData.bcvRate || bcvRate}
          isHistory={receiptData.isHistory}
          bonuses={receiptData.bonuses}
          onClose={() => setReceiptData(null)}
        />
      )}

      {/* ── Modal Crear / Editar Empleado ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-5 max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">
                {editingEmployee ? 'Editar Empleado' : 'Nuevo Empleado'}
              </h2>
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
                <input
                  type="text"
                  placeholder="Nombre y apellido"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C5A059]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">Cargo</label>
                <input
                  type="text"
                  placeholder="Cargo o función"
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C5A059]"
                />
              </div>

              {/* Fijo fields */}
              {form.employeeType === 'fijo' && (
                <>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 block">
                      Frecuencia de Pago (Nómina)
                    </label>
                    <div className="flex gap-2">
                      {(['semanal', 'quincenal', 'mensual'] as const).map(freq => (
                        <button
                          key={freq}
                          type="button"
                          onClick={() => setForm(f => ({ ...f, paymentFrequency: freq }))}
                          className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all ${
                            form.paymentFrequency === freq
                              ? 'bg-[#3D2B1F] text-white border-[#3D2B1F]'
                              : 'border-gray-200 text-gray-500 hover:border-gray-300'
                          }`}
                        >
                          {freq === 'semanal' ? '🗓 Semanal' : freq === 'quincenal' ? '📅 Quincenal' : '📆 Mensual'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">
                        {form.paymentFrequency === 'semanal'
                          ? 'Sueldo Semanal ($)'
                          : form.paymentFrequency === 'mensual'
                          ? 'Sueldo Mensual ($)'
                          : 'Sueldo Quincenal ($)'}
                      </label>
                      <input
                        type="number"
                        placeholder="0"
                        value={form.salary}
                        onChange={e => setForm(f => ({ ...f, salary: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C5A059]"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">Fecha de Ingreso</label>
                      <input
                        type="date"
                        value={form.hireDate}
                        onChange={e => setForm(f => ({ ...f, hireDate: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C5A059]"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Eventual fields */}
              {form.employeeType === 'eventual' && (
                <>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 block">Modalidad de Pago</label>
                    <div className="flex gap-2">
                      {(['semanal', 'quincenal', 'por_dias'] as const).map(freq => (
                        <button
                          key={freq}
                          type="button"
                          onClick={() => setForm(f => ({ ...f, paymentFrequency: freq }))}
                          className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all ${
                            form.paymentFrequency === freq
                              ? 'bg-[#3D2B1F] text-white border-[#3D2B1F]'
                              : 'border-gray-200 text-gray-500 hover:border-gray-300'
                          }`}
                        >
                          {freq === 'semanal' ? '🗓 Semanal' : freq === 'quincenal' ? '📅 Quincenal' : '⏱ Por Días'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">Tarifa por Día ($)</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={form.dailyRate}
                        onChange={e => setForm(f => ({ ...f, dailyRate: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C5A059]"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">Días Contratado</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={form.contractedDays}
                        onChange={e => setForm(f => ({ ...f, contractedDays: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C5A059]"
                      />
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
                    <input
                      type="date"
                      value={form.hireDate}
                      onChange={e => setForm(f => ({ ...f, hireDate: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C5A059]"
                    />
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
                  : 'bg-[#3D2B1F] hover:bg-[#2a1d14] text-white shadow-lg active:scale-95'}`}
            >
              {saved ? (
                <>
                  <Check size={16} /> {editingEmployee ? 'Empleado Actualizado' : 'Empleado Guardado'}
                </>
              ) : (
                editingEmployee ? 'Guardar Cambios' : 'Registrar Empleado'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default EmployeesPage
