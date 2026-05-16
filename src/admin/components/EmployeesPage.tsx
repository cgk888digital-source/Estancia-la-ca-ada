import React, { useState } from 'react'
import { Plus, Check, X, UserCheck, UserX, DollarSign } from 'lucide-react'
import { mockEmployees } from '../data/mockData'
import type { Employee } from '../types'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

const EmployeesPage: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>(mockEmployees)
  const [showModal, setShowModal] = useState(false)
  const [paidId, setPaidId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', role: '', salary: '', hireDate: '' })
  const [saved, setSaved] = useState(false)

  const active = employees.filter(e => e.status === 'activo')
  const totalPayroll = active.reduce((s, e) => s + e.salary, 0)
  const pendingCount = active.filter(e => e.pendingPayment).length
  const pendingTotal = active.filter(e => e.pendingPayment).reduce((s, e) => s + e.salary, 0)

  const handlePay = (id: string) => {
    setPaidId(id)
    setTimeout(() => {
      setEmployees(prev =>
        prev.map(e => e.id === id ? { ...e, pendingPayment: false, lastPayment: new Date().toISOString().split('T')[0] } : e)
      )
      setPaidId(null)
    }, 1000)
  }

  const handlePayAll = () => {
    const today = new Date().toISOString().split('T')[0]
    setEmployees(prev =>
      prev.map(e => e.status === 'activo' && e.pendingPayment ? { ...e, pendingPayment: false, lastPayment: today } : e)
    )
  }

  const handleSave = () => {
    if (!form.name || !form.role || !form.salary) return
    const newEmp: Employee = {
      id: `e${Date.now()}`,
      name: form.name,
      role: form.role,
      salary: Number(form.salary),
      status: 'activo',
      hireDate: form.hireDate || new Date().toISOString().split('T')[0],
      lastPayment: '',
      pendingPayment: true,
    }
    setEmployees(prev => [newEmp, ...prev])
    setSaved(true)
    setTimeout(() => {
      setSaved(false)
      setShowModal(false)
      setForm({ name: '', role: '', salary: '', hireDate: '' })
    }, 1200)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Empleados</h1>
          <p className="text-sm text-gray-500 mt-1">{active.length} activos · Planilla mensual: <span className="font-bold text-violet-600">{fmt(totalPayroll)}</span></p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#3D2B1F] hover:bg-[#2a1d14] text-white rounded-xl text-sm font-bold transition-all shadow-sm"
        >
          <Plus size={16} />
          Nuevo Empleado
        </button>
      </div>

      {/* Payroll summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Total Empleados Activos</p>
          <p className="text-2xl font-bold text-gray-900">{active.length}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Sueldos Pendientes</p>
          <p className="text-2xl font-bold text-amber-600">{pendingCount} empleados</p>
          <p className="text-xs text-gray-400 mt-1">{fmt(pendingTotal)}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex flex-col justify-between">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Pagar Todos</p>
          <button
            onClick={handlePayAll}
            disabled={pendingCount === 0}
            className={`mt-2 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all
              ${pendingCount > 0 ? 'bg-violet-600 hover:bg-violet-700 text-white shadow-sm' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
          >
            <DollarSign size={15} />
            Registrar Pago Total
          </button>
        </div>
      </div>

      {/* Employees table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left text-xs font-bold text-gray-400 uppercase tracking-widest px-6 py-4">Empleado</th>
                <th className="text-left text-xs font-bold text-gray-400 uppercase tracking-widest px-4 py-4 hidden sm:table-cell">Cargo</th>
                <th className="text-left text-xs font-bold text-gray-400 uppercase tracking-widest px-4 py-4 hidden lg:table-cell">Último Pago</th>
                <th className="text-left text-xs font-bold text-gray-400 uppercase tracking-widest px-4 py-4">Estado Pago</th>
                <th className="text-right text-xs font-bold text-gray-400 uppercase tracking-widest px-6 py-4">Sueldo</th>
                <th className="px-4 py-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {employees.map(emp => (
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
                  <td className="px-4 py-4 hidden sm:table-cell">
                    <span className="text-sm text-gray-600">{emp.role}</span>
                  </td>
                  <td className="px-4 py-4 hidden lg:table-cell">
                    <span className="text-sm text-gray-500">
                      {emp.lastPayment
                        ? new Date(emp.lastPayment).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: '2-digit' })
                        : '—'}
                    </span>
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
                  </td>
                  <td className="px-4 py-4 text-right">
                    {emp.status === 'activo' && emp.pendingPayment && (
                      <button
                        onClick={() => handlePay(emp.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all
                          ${paidId === emp.id
                            ? 'bg-emerald-500 text-white'
                            : 'bg-violet-100 text-violet-700 hover:bg-violet-600 hover:text-white'}`}
                      >
                        {paidId === emp.id ? <Check size={14} /> : 'Pagar'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal nuevo empleado */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Nuevo Empleado</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                <X size={18} className="text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">Nombre Completo</label>
                <input
                  type="text"
                  placeholder="Nombre y apellido"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C5A059] transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">Cargo</label>
                <input
                  type="text"
                  placeholder="Cargo o función"
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C5A059] transition-colors"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">Sueldo (ARS)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={form.salary}
                    onChange={e => setForm(f => ({ ...f, salary: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C5A059] transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">Fecha de Ingreso</label>
                  <input
                    type="date"
                    value={form.hireDate}
                    onChange={e => setForm(f => ({ ...f, hireDate: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C5A059] transition-colors"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={!form.name || !form.role || !form.salary}
              className={`w-full py-3.5 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2
                ${saved
                  ? 'bg-emerald-500 text-white'
                  : !form.name || !form.role || !form.salary
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
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
