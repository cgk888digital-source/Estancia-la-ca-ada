import { useEffect, useMemo, useState } from 'react'
import type React from 'react'
import { CalendarClock, Check, Copy, Mail, Megaphone, Plus, Send, Sparkles, Users, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { CampaignSegment, CampaignStatus, EmailCampaign, EmailTemplate, MarketingCustomer } from '../types'

interface DbCampaign {
  id: string
  name: string
  subject: string
  preview_text: string | null
  body: string
  segment: CampaignSegment
  status: CampaignStatus
  scheduled_at: string | null
  sent_at: string | null
  recipient_count: number | string
  opened_count: number | string
  clicked_count: number | string
  created_at: string
}

interface DbTemplate {
  id: string
  name: string
  subject: string
  preview_text: string | null
  body: string
  category: string
}

interface DbCustomer {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  source: string
  status: MarketingCustomer['status']
  tags: string[] | null
  consent_email: boolean
  last_stay_date: string | null
  total_bookings: number | string
  total_spent: number | string
  notes: string | null
  created_at: string
}

const emptyCampaign = {
  name: '',
  subject: '',
  previewText: '',
  body: '',
  segment: 'subscribed' as CampaignSegment,
  scheduledAt: '',
}

const segmentLabels: Record<CampaignSegment, string> = {
  all: 'Todos con permiso',
  subscribed: 'Suscritos',
  vip: 'Clientes VIP',
  prospect: 'Prospectos',
  recent_guests: 'Huéspedes recientes',
  no_recent_stay: 'Sin estadía reciente',
}

const statusLabels: Record<CampaignStatus, string> = {
  draft: 'Borrador',
  scheduled: 'Programada',
  sent: 'Enviada',
  paused: 'Pausada',
}

const statusClasses: Record<CampaignStatus, string> = {
  draft: 'bg-gray-100 text-gray-600 border-gray-200',
  scheduled: 'bg-blue-50 text-blue-700 border-blue-200',
  sent: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  paused: 'bg-amber-50 text-amber-700 border-amber-200',
}

const mapCampaign = (db: DbCampaign): EmailCampaign => ({
  id: db.id,
  name: db.name,
  subject: db.subject,
  previewText: db.preview_text || '',
  body: db.body,
  segment: db.segment,
  status: db.status,
  scheduledAt: db.scheduled_at || '',
  sentAt: db.sent_at || '',
  recipientCount: Number(db.recipient_count) || 0,
  openedCount: Number(db.opened_count) || 0,
  clickedCount: Number(db.clicked_count) || 0,
  createdAt: db.created_at,
})

const mapTemplate = (db: DbTemplate): EmailTemplate => ({
  id: db.id,
  name: db.name,
  subject: db.subject,
  previewText: db.preview_text || '',
  body: db.body,
  category: db.category,
})

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

function matchesSegment(customer: MarketingCustomer, segment: CampaignSegment) {
  if (!customer.email || !customer.consentEmail || customer.status === 'unsubscribed') return false
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
  const lastStay = customer.lastStayDate ? new Date(customer.lastStayDate) : null

  if (segment === 'all') return true
  if (segment === 'subscribed') return customer.status === 'subscribed' || customer.status === 'vip'
  if (segment === 'vip') return customer.status === 'vip' || customer.tags.includes('vip')
  if (segment === 'prospect') return customer.status === 'prospect'
  if (segment === 'recent_guests') return !!lastStay && lastStay >= ninetyDaysAgo
  if (segment === 'no_recent_stay') return !lastStay || lastStay < ninetyDaysAgo
  return false
}

export default function EmailMarketingPage() {
  const [customers, setCustomers] = useState<MarketingCustomer[]>([])
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([])
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyCampaign)
  const [copied, setCopied] = useState(false)

  async function fetchData() {
    setLoading(true)
    const [customersRes, campaignsRes, templatesRes] = await Promise.all([
      supabase.from('marketing_customers').select('*').order('created_at', { ascending: false }),
      supabase.from('email_campaigns').select('*').order('created_at', { ascending: false }),
      supabase.from('email_templates').select('*').order('created_at', { ascending: false }),
    ])

    if (customersRes.error) console.error('Error fetching marketing customers:', customersRes.error)
    else setCustomers((customersRes.data || []).map(mapCustomer))

    if (campaignsRes.error) console.error('Error fetching campaigns:', campaignsRes.error)
    else setCampaigns((campaignsRes.data || []).map(mapCampaign))

    if (templatesRes.error) console.error('Error fetching templates:', templatesRes.error)
    else setTemplates((templatesRes.data || []).map(mapTemplate))

    setLoading(false)
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData()
  }, [])

  const audience = useMemo(() => customers.filter(customer => matchesSegment(customer, form.segment)), [customers, form.segment])
  const subscribedCount = useMemo(() => customers.filter(customer => matchesSegment(customer, 'all')).length, [customers])

  const stats = useMemo(() => ({
    drafts: campaigns.filter(c => c.status === 'draft').length,
    scheduled: campaigns.filter(c => c.status === 'scheduled').length,
    sent: campaigns.filter(c => c.status === 'sent').length,
  }), [campaigns])

  function applyTemplate(template: EmailTemplate) {
    setForm(f => ({
      ...f,
      name: f.name || template.name,
      subject: template.subject,
      previewText: template.previewText,
      body: template.body,
    }))
  }

  async function saveCampaign(nextStatus: CampaignStatus) {
    if (!form.name.trim() || !form.subject.trim() || !form.body.trim()) return

    const payload = {
      name: form.name.trim(),
      subject: form.subject.trim(),
      preview_text: form.previewText.trim() || null,
      body: form.body.trim(),
      segment: form.segment,
      status: nextStatus,
      scheduled_at: nextStatus === 'scheduled' && form.scheduledAt ? new Date(form.scheduledAt).toISOString() : null,
      sent_at: nextStatus === 'sent' ? new Date().toISOString() : null,
      recipient_count: audience.length,
    }

    const { data, error } = await supabase
      .from('email_campaigns')
      .insert([payload])
      .select('*')
      .single()

    if (error) {
      console.error('Error saving email campaign:', error)
      return
    }

    const campaign = mapCampaign(data as DbCampaign)
    if (audience.length > 0) {
      await supabase.from('email_campaign_recipients').insert(audience.map(customer => ({
        campaign_id: campaign.id,
        customer_id: customer.id,
        email: customer.email,
        status: nextStatus === 'sent' ? 'sent' : 'queued',
        sent_at: nextStatus === 'sent' ? new Date().toISOString() : null,
      })))
    }

    setCampaigns(prev => [campaign, ...prev])
    setForm(emptyCampaign)
    setModalOpen(false)
  }

  async function markAsSent(campaign: EmailCampaign) {
    const { data, error } = await supabase
      .from('email_campaigns')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', campaign.id)
      .select('*')
      .single()

    if (error) {
      console.error('Error marking campaign as sent:', error)
      return
    }
    setCampaigns(prev => prev.map(item => item.id === campaign.id ? mapCampaign(data as DbCampaign) : item))
  }

  async function copyAudience() {
    const emails = audience.map(customer => customer.email).join(', ')
    await navigator.clipboard.writeText(emails)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-serif text-gray-900 flex items-center gap-2.5">
            Email Marketing <Sparkles className="text-[#C5A059] fill-[#C5A059]/10" size={24} />
          </h1>
          <p className="text-sm text-gray-500 mt-1">Campañas, plantillas y audiencias listas para conectar con un proveedor de envío.</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="flex items-center justify-center gap-2 px-5 py-3 bg-[#C5A059] hover:bg-[#b8904a] text-white rounded-2xl text-sm font-bold transition-all shadow-md">
          <Plus size={18} /> Nueva Campaña
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Audiencia activa" value={subscribedCount} icon={<Users size={18} />} />
        <StatCard label="Borradores" value={stats.drafts} icon={<Megaphone size={18} />} />
        <StatCard label="Programadas" value={stats.scheduled} icon={<CalendarClock size={18} />} />
        <StatCard label="Enviadas" value={stats.sent} icon={<Send size={18} />} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_0.8fr] gap-6">
        <div className="bg-white border border-gray-100 rounded-3xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-700">Campañas</h2>
            <span className="text-xs text-gray-400 font-semibold">{campaigns.length} registradas</span>
          </div>
          {loading ? (
            <div className="p-10 text-center text-gray-400 font-bold text-sm">Cargando campañas...</div>
          ) : campaigns.length === 0 ? (
            <div className="p-10 text-center text-gray-400 font-bold text-sm">Todavía no hay campañas creadas.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {campaigns.map(campaign => (
                <div key={campaign.id} className="p-5 flex flex-col lg:flex-row lg:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-gray-900 truncate">{campaign.name}</h3>
                      <span className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-full border font-bold ${statusClasses[campaign.status]}`}>{statusLabels[campaign.status]}</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1 truncate">{campaign.subject}</p>
                    <p className="text-xs text-gray-400 mt-1">{segmentLabels[campaign.segment]} · {campaign.recipientCount} destinatarios</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {campaign.status !== 'sent' && (
                      <button onClick={() => markAsSent(campaign)} className="px-4 py-2 rounded-xl border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 text-xs font-bold uppercase tracking-wider">
                        Marcar enviada
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-100 rounded-3xl shadow-sm p-6 space-y-4">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-700">Plantillas</h2>
            <p className="text-xs text-gray-400 mt-1">Textos base para acelerar campañas.</p>
          </div>
          <div className="space-y-3">
            {templates.map(template => (
              <button key={template.id} onClick={() => { applyTemplate(template); setModalOpen(true) }} className="w-full text-left p-4 border border-gray-100 hover:border-[#C5A059]/40 hover:bg-[#C5A059]/5 rounded-2xl transition-colors">
                <p className="text-sm font-bold text-gray-800">{template.name}</p>
                <p className="text-xs text-gray-400 mt-1 line-clamp-2">{template.subject}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="absolute inset-0" onClick={() => setModalOpen(false)} />
          <div className="relative bg-white rounded-[2rem] shadow-2xl w-full max-w-3xl p-6 space-y-5 z-10 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold font-serif text-gray-900">Nueva Campaña</h2>
              <button onClick={() => setModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-xl text-gray-500"><X size={18} /></button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Nombre Interno" value={form.name} onChange={name => setForm(f => ({ ...f, name }))} />
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Segmento</label>
                <select value={form.segment} onChange={e => setForm(f => ({ ...f, segment: e.target.value as CampaignSegment }))} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none bg-white focus:border-[#C5A059]">
                  {Object.entries(segmentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
              <Field label="Asunto" value={form.subject} onChange={subject => setForm(f => ({ ...f, subject }))} className="md:col-span-2" />
              <Field label="Vista Previa" value={form.previewText} onChange={previewText => setForm(f => ({ ...f, previewText }))} className="md:col-span-2" />
              <div className="md:col-span-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Mensaje</label>
                <textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} rows={9} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C5A059] resize-none font-mono leading-relaxed" />
              </div>
              <Field label="Fecha Programada" type="datetime-local" value={form.scheduledAt} onChange={scheduledAt => setForm(f => ({ ...f, scheduledAt }))} />
              <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">Audiencia</p>
                  <p className="text-xl font-bold text-gray-900">{audience.length} destinatarios</p>
                </div>
                <button onClick={copyAudience} disabled={audience.length === 0} className="p-3 rounded-xl bg-white border border-gray-200 text-gray-500 hover:text-[#C5A059] disabled:opacity-40">
                  {copied ? <Check size={18} /> : <Copy size={18} />}
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button onClick={() => saveCampaign('draft')} className="flex-1 py-3 border border-gray-200 text-gray-600 font-bold rounded-2xl text-sm hover:bg-gray-50">
                Guardar Borrador
              </button>
              <button onClick={() => saveCampaign('scheduled')} disabled={!form.scheduledAt} className="flex-1 py-3 border border-blue-200 bg-blue-50 text-blue-700 font-bold rounded-2xl text-sm disabled:opacity-40">
                Programar
              </button>
              <button onClick={() => saveCampaign('sent')} className="flex-1 py-3 bg-[#C5A059] hover:bg-[#b8904a] text-white font-bold rounded-2xl text-sm flex items-center justify-center gap-2">
                <Mail size={16} /> Registrar Envío
              </button>
            </div>
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

function Field({ label, value, onChange, type = 'text', className = '' }: { label: string; value: string; onChange: (value: string) => void; type?: string; className?: string }) {
  return (
    <div className={className}>
      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C5A059]" />
    </div>
  )
}
