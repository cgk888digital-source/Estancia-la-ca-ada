import { useEffect, useMemo, useState } from 'react'
import type React from 'react'
import { Check, Mail, Phone, Plus, Search, Sparkles, Users, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { CustomerStatus, MarketingCustomer } from '../types'

interface DbCustomer {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  source: string
  status: CustomerStatus
  tags: string[] | null
  consent_email: boolean
  last_stay_date: string | null
  total_bookings: number | string
  total_spent: number | string
  notes: string | null
  created_at: string
}

const emptyForm = {
  fullName: '',
  email: '',
  phone: '',
  status: 'subscribed' as CustomerStatus,
  tags: '',
  notes: '',
  consentEmail: true,
}

const mapCustomer = (db: DbCustomer): MarketingCustomer => ({
  id: db.id,
  fullName: db.full_name,
  email: db.email || '',
  phone: db.phone || '',
  source: db.source,
  status: db.status,
  tags: db.tags || [],
  consentEmail: db.consent_email,
  lastStayDate: db.last_stay_date || '',
  totalBookings: Number(db.total_bookings) || 0,
  totalSpent: Number(db.total_spent) || 0,
  notes: db.notes || '',
  createdAt: db.created_at,
})

const statusLabel: Record<CustomerStatus, string> = {
  subscribed: 'Suscrito',
  unsubscribed: 'No suscrito',
  prospect: 'Prospecto',
  vip: 'VIP',
}

const statusClass: Record<CustomerStatus, string> = {
  subscribed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  unsubscribed: 'bg-gray-100 text-gray-500 border-gray-200',
  prospect: 'bg-blue-50 text-blue-700 border-blue-200',
  vip: 'bg-amber-50 text-amber-700 border-amber-200',
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<MarketingCustomer[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<CustomerStatus | 'all'>('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<MarketingCustomer | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saved, setSaved] = useState(false)

  async function fetchCustomers() {
    setLoading(true)
    const { data, error } = await supabase
      .from('marketing_customers')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching marketing customers:', error)
      setCustomers([])
    } else {
      setCustomers((data || []).map(mapCustomer))
    }
    setLoading(false)
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCustomers()
  }, [])

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return customers.filter(customer => {
      const matchesStatus = status === 'all' || customer.status === status
      const haystack = [
        customer.fullName,
        customer.email,
        customer.phone,
        customer.source,
        customer.tags.join(' '),
      ].join(' ').toLowerCase()
      return matchesStatus && haystack.includes(q)
    })
  }, [customers, query, status])

  const stats = useMemo(() => ({
    total: customers.length,
    subscribed: customers.filter(c => c.status === 'subscribed' && c.consentEmail).length,
    vip: customers.filter(c => c.status === 'vip').length,
    prospects: customers.filter(c => c.status === 'prospect').length,
  }), [customers])

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  function openEdit(customer: MarketingCustomer) {
    setEditing(customer)
    setForm({
      fullName: customer.fullName,
      email: customer.email,
      phone: customer.phone,
      status: customer.status,
      tags: customer.tags.join(', '),
      notes: customer.notes,
      consentEmail: customer.consentEmail,
    })
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.fullName.trim() || (!form.email.trim() && !form.phone.trim())) return

    const payload = {
      full_name: form.fullName.trim(),
      email: form.email.trim().toLowerCase() || null,
      phone: form.phone.trim() || null,
      status: form.status,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      notes: form.notes.trim() || null,
      consent_email: form.consentEmail,
      source: editing?.source || 'manual',
    }

    const result = editing
      ? await supabase.from('marketing_customers').update(payload).eq('id', editing.id).select('*').single()
      : await supabase.from('marketing_customers').insert([payload]).select('*').single()

    if (result.error) {
      console.error('Error saving customer:', result.error)
      return
    }

    const savedCustomer = mapCustomer(result.data as DbCustomer)
    setCustomers(prev => editing
      ? prev.map(c => c.id === savedCustomer.id ? savedCustomer : c)
      : [savedCustomer, ...prev])
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
    setModalOpen(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-serif text-gray-900 flex items-center gap-2.5">
            Base de Clientes <Sparkles className="text-[#C5A059] fill-[#C5A059]/10" size={24} />
          </h1>
          <p className="text-sm text-gray-500 mt-1">Contactos, consentimiento y segmentos para futuras campañas.</p>
        </div>
        <button onClick={openCreate} className="flex items-center justify-center gap-2 px-5 py-3 bg-[#C5A059] hover:bg-[#b8904a] text-white rounded-2xl text-sm font-bold transition-all shadow-md">
          <Plus size={18} /> Nuevo Cliente
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Clientes" value={stats.total} icon={<Users size={18} />} />
        <StatCard label="Suscritos" value={stats.subscribed} icon={<Mail size={18} />} />
        <StatCard label="VIP" value={stats.vip} icon={<Sparkles size={18} />} />
        <StatCard label="Prospectos" value={stats.prospects} icon={<Phone size={18} />} />
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-3 flex flex-col md:flex-row gap-3">
        <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-2.5 flex-1">
          <Search size={16} className="text-gray-400" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar por nombre, correo, teléfono o etiqueta..." className="w-full bg-transparent outline-none text-sm text-gray-700" />
        </div>
        <select value={status} onChange={e => setStatus(e.target.value as CustomerStatus | 'all')} className="border border-gray-100 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-600 outline-none bg-white">
          <option value="all">Todos los estados</option>
          <option value="subscribed">Suscritos</option>
          <option value="vip">VIP</option>
          <option value="prospect">Prospectos</option>
          <option value="unsubscribed">No suscritos</option>
        </select>
      </div>

      <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-10 text-center text-gray-400 font-bold text-sm">Cargando clientes...</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-gray-400 font-bold text-sm">No hay clientes con esos filtros.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map(customer => (
              <button key={customer.id} onClick={() => openEdit(customer)} className="w-full p-5 text-left hover:bg-gray-50 transition-colors flex flex-col lg:flex-row lg:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-gray-900 truncate">{customer.fullName}</h3>
                    <span className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-full border font-bold ${statusClass[customer.status]}`}>{statusLabel[customer.status]}</span>
                    {!customer.consentEmail && <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-full border border-rose-200 bg-rose-50 text-rose-600 font-bold">Sin email</span>}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-gray-500">
                    {customer.email && <span>{customer.email}</span>}
                    {customer.phone && <span>{customer.phone}</span>}
                    <span>Origen: {customer.source}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  {customer.tags.map(tag => (
                    <span key={tag} className="text-[10px] bg-[#C5A059]/10 text-[#8a6a32] px-2 py-1 rounded-lg font-bold uppercase tracking-wider">{tag}</span>
                  ))}
                </div>
                <div className="text-xs text-gray-400 lg:text-right min-w-[130px]">
                  <p className="font-bold text-gray-700">${customer.totalSpent.toLocaleString('es-VE')}</p>
                  <p>{customer.totalBookings} reservas</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="absolute inset-0" onClick={() => setModalOpen(false)} />
          <div className="relative bg-white rounded-[2rem] shadow-2xl w-full max-w-xl p-6 space-y-5 z-10">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold font-serif text-gray-900">{editing ? 'Editar Cliente' : 'Nuevo Cliente'}</h2>
              <button onClick={() => setModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-xl text-gray-500"><X size={18} /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Nombre" value={form.fullName} onChange={fullName => setForm(f => ({ ...f, fullName }))} className="sm:col-span-2" />
              <Field label="Correo" type="email" value={form.email} onChange={email => setForm(f => ({ ...f, email }))} />
              <Field label="Teléfono" value={form.phone} onChange={phone => setForm(f => ({ ...f, phone }))} />
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Estado</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as CustomerStatus }))} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none bg-white focus:border-[#C5A059]">
                  <option value="subscribed">Suscrito</option>
                  <option value="vip">VIP</option>
                  <option value="prospect">Prospecto</option>
                  <option value="unsubscribed">No suscrito</option>
                </select>
              </div>
              <Field label="Etiquetas" value={form.tags} onChange={tags => setForm(f => ({ ...f, tags }))} placeholder="vip, familia, temporada" />
              <label className="sm:col-span-2 flex items-center gap-2 text-sm font-semibold text-gray-600">
                <input type="checkbox" checked={form.consentEmail} onChange={e => setForm(f => ({ ...f, consentEmail: e.target.checked }))} className="rounded text-[#C5A059]" />
                Puede recibir campañas por correo
              </label>
              <div className="sm:col-span-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Notas</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C5A059] resize-none" />
              </div>
            </div>
            <button onClick={handleSave} disabled={!form.fullName.trim() || (!form.email.trim() && !form.phone.trim())} className="w-full py-3 bg-[#C5A059] hover:bg-[#b8904a] text-white font-bold rounded-2xl text-sm disabled:opacity-40 flex items-center justify-center gap-2">
              <Check size={16} /> {saved ? 'Guardado' : 'Guardar Cliente'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
      <div className="w-10 h-10 rounded-xl bg-[#C5A059]/10 text-[#C5A059] flex items-center justify-center mb-3">{icon}</div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mt-1">{label}</p>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', placeholder = '', className = '' }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string; className?: string }) {
  return (
    <div className={className}>
      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">{label}</label>
      <input type={type} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C5A059]" />
    </div>
  )
}
