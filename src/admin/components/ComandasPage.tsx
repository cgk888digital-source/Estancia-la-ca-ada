import React, { useState, useEffect, useRef } from 'react'
import { Plus, Check, Search, Utensils, Trash2, CheckCircle2, Bell } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import confetti from 'canvas-confetti'
import { getMenu } from '../../utils/menuStore'
import type { MenuSection, DishItem } from '../../data/weeklyMenu'

interface OrderItem {
  name: string
  quantity: number
  price: string
  notes?: string
}

interface Comanda {
  id: string
  table_id: string
  items: OrderItem[]
  status: 'preparando' | 'listo' | 'entregado' | 'cancelado'
  payment_status: 'pendiente' | 'pagado'
  total_amount: number
  created_at: string
}



const playNotificationSound = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    
    osc.type = 'sine'
    // Sweet restaurant bell double-ding
    osc.frequency.setValueAtTime(587.33, ctx.currentTime) // D5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08) // A5
    
    gain.gain.setValueAtTime(0.12, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35)
    
    osc.connect(gain)
    gain.connect(ctx.destination)
    
    osc.start()
    osc.stop(ctx.currentTime + 0.35)
  } catch (e) {
    console.error('Failed to play sound:', e)
  }
}

const ComandasPage: React.FC = () => {
  const [comandas, setComandas] = useState<Comanda[]>([])
  const [menu, setMenu] = useState<MenuSection[]>([])
  const [activeMenuTab, setActiveMenuTab] = useState('desayuno')
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [soundEnabled, setSoundEnabled] = useState(true)
  
  // Modal states
  const [showNewOrder, setShowNewOrder] = useState(false)
  const [showCheckout, setShowCheckout] = useState(false)
  const [activeCheckoutTable, setActiveCheckoutTable] = useState<string | null>(null)
  const [checkoutPaymentMethod, setCheckoutPaymentMethod] = useState('efectivo')
  const [savingCheckout, setSavingCheckout] = useState(false)

  // Manual order states
  const [selectedTable, setSelectedTable] = useState('Mesa 1')
  const [manualCart, setManualCart] = useState<OrderItem[]>([])
  const [manualNotes, setManualNotes] = useState('')

  const previousCountRef = useRef(0)

  const fetchComandas = async () => {
    const { data, error } = await supabase
      .from('comandas')
      .select('*')
      .eq('payment_status', 'pendiente')
      .order('created_at', { ascending: true })

    if (!error && data) {
      setComandas(data)
      
      // Sound alert if new orders arrive
      const preparingCount = data.filter(c => c.status === 'preparando').length
      if (preparingCount > previousCountRef.current && previousCountRef.current !== 0) {
        if (soundEnabled) playNotificationSound()
      }
      previousCountRef.current = preparingCount
    }
    setLoading(false)
  }

  const fetchMenu = async () => {
    const data = await getMenu()
    setMenu(data)
    if (data.length > 0) setActiveMenuTab(data[0].id)
  }

  useEffect(() => {
    fetchComandas()
    fetchMenu()

    const channel = supabase
      .channel('comandas_admin_realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'comandas'
      }, () => {
        fetchComandas()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [soundEnabled])

  // Update order status (KDS movements)
  const updateStatus = async (id: string, newStatus: 'preparando' | 'listo' | 'entregado' | 'cancelado') => {
    const { error } = await supabase
      .from('comandas')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', id)
      
    if (error) {
      alert('Error al actualizar estado: ' + error.message)
    } else {
      fetchComandas()
    }
  }

  // Add item to manual order creator
  const addDishToManual = (dish: DishItem) => {
    setManualCart(prev => {
      const existing = prev.find(i => i.name === dish.name)
      if (existing) {
        return prev.map(i => i.name === dish.name ? { ...i, quantity: i.quantity + 1 } : i)
      } else {
        return [...prev, { name: dish.name, price: dish.price || 'Incluido', quantity: 1, notes: manualNotes || undefined }]
      }
    })
    setManualNotes('') // Clear notes after adding
  }

  // Update quantity in manual order creator
  const updateManualQty = (name: string, q: number) => {
    if (q <= 0) {
      removeFromManualCart(name)
    } else {
      setManualCart(prev => prev.map(i => i.name === name ? { ...i, quantity: q } : i))
    }
  }

  // Remove item from manual order creator
  const removeFromManualCart = (name: string) => {
    setManualCart(prev => prev.filter(i => i.name !== name))
  }

  // Save manual order to database
  const saveManualOrder = async () => {
    if (manualCart.length === 0) return

    const totalAmount = manualCart.reduce((sum, item) => {
      const parsePrice = (pStr: string): number => {
        if (!pStr || pStr.toLowerCase().includes('incluido')) return 0
        const num = parseFloat(pStr.replace(/[^0-9.]/g, ''))
        return isNaN(num) ? 0 : num
      }
      return sum + (parsePrice(item.price) * item.quantity)
    }, 0)

    const { error } = await supabase
      .from('comandas')
      .insert({
        table_id: selectedTable,
        items: manualCart,
        total_amount: totalAmount,
        status: 'preparando',
        payment_status: 'pendiente'
      })

    if (!error) {
      setManualCart([])
      setShowNewOrder(false)
      fetchComandas()
    } else {
      alert('Error guardando comanda: ' + error.message)
    }
  }

  // Checkout process (process bill and archive table comandas)
  const handleCheckout = async () => {
    if (!activeCheckoutTable) return
    setSavingCheckout(true)

    const tableOrders = comandas.filter(c => c.table_id === activeCheckoutTable)
    const totalToPay = tableOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0)

    try {
      // 1. Mark all active orders for this table as 'pagado'
      const { error: updErr } = await supabase
        .from('comandas')
        .update({ payment_status: 'pagado', updated_at: new Date().toISOString() })
        .eq('table_id', activeCheckoutTable)
        .eq('payment_status', 'pendiente')

      if (updErr) throw updErr

      // 2. Insert transaction entry to register cash flow
      const { error: txErr } = await supabase
        .from('transactions')
        .insert({
          type: 'ingreso',
          category: 'restaurante',
          description: `Consumo Restaurante - ${activeCheckoutTable}`,
          amount: totalToPay,
          payment_method: checkoutPaymentMethod,
          date: new Date().toISOString().substring(0, 10)
        })

      if (txErr) throw txErr

      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.8 }
      })

      setShowCheckout(false)
      setActiveCheckoutTable(null)
      fetchComandas()
    } catch (err: any) {
      console.error(err)
      alert('Error en facturación: ' + err.message)
    } finally {
      setSavingCheckout(false)
    }
  }

  // Columns data filtering
  const filteredComandas = comandas.filter(c => 
    c.table_id.toLowerCase().includes(search.toLowerCase()) || 
    c.items.some(i => i.name.toLowerCase().includes(search.toLowerCase()))
  )

  const colPreparing = filteredComandas.filter(c => c.status === 'preparando')
  const colReady = filteredComandas.filter(c => c.status === 'listo')
  const colDelivered = filteredComandas.filter(c => c.status === 'entregado')

  // Get list of tables that have active orders to checkout
  const activeTablesList = Array.from(new Set(comandas.map(c => c.table_id)))

  const activeMenuSection = menu.find(s => s.id === activeMenuTab)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Comandas del Restaurante</h1>
          <p className="text-sm text-gray-500 mt-1">Pantalla de Cocina (KDS) y Facturación en Tiempo Real</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2.5 rounded-xl border flex items-center gap-2 text-sm font-semibold transition-all ${
              soundEnabled 
                ? 'bg-amber-50 border-amber-200 text-amber-700' 
                : 'bg-white border-gray-200 text-gray-400'
            }`}
            title={soundEnabled ? 'Sonido activado' : 'Sonido silenciado'}
          >
            <Bell size={18} className={soundEnabled ? 'animate-bounce' : ''} />
            <span className="hidden sm:inline">{soundEnabled ? 'Campana ON' : 'Campana OFF'}</span>
          </button>
          <button
            onClick={() => setShowNewOrder(true)}
            className="flex items-center gap-2 bg-[#C5A059] text-white px-5 py-2.5 rounded-xl font-bold hover:bg-[#b8904a] transition-colors shadow-sm"
          >
            <Plus size={20} />
            Nueva Comanda
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Buscar por mesa, cabaña o plato..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#C5A059] focus:bg-white transition-colors"
          />
        </div>
        
        {/* Quick Checkout Dropdown */}
        {activeTablesList.length > 0 && (
          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Cerrar Mesa:</span>
            <select
              onChange={e => {
                if (e.target.value) {
                  setActiveCheckoutTable(e.target.value)
                  setShowCheckout(true)
                  e.target.value = ''
                }
              }}
              className="bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-700 font-bold focus:outline-none focus:border-[#C5A059]"
            >
              <option value="">-- Selecciona Mesa --</option>
              {activeTablesList.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Grid columns */}
      {loading ? (
        <div className="text-center py-20 text-gray-400">Cargando comandas...</div>
      ) : comandas.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 border-dashed p-16 text-center shadow-sm">
          <Utensils size={48} className="mx-auto text-gray-200 mb-4" />
          <h3 className="text-lg font-bold text-gray-900 mb-1">Sin pedidos activos</h3>
          <p className="text-gray-500 text-sm">Los pedidos que los clientes realicen desde la mesa por NFC/QR aparecerán aquí al instante.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* COLUMN 1: PREPARANDO */}
          <div className="bg-amber-50/50 rounded-2xl p-4 border border-amber-100/70 flex flex-col space-y-4">
            <div className="flex justify-between items-center px-1">
              <span className="text-sm font-bold text-amber-800 uppercase tracking-widest">En Preparación ({colPreparing.length})</span>
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
            </div>
            
            <div className="space-y-4 overflow-y-auto max-h-[70vh] custom-scrollbar">
              {colPreparing.map(c => (
                <div key={c.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-gray-800 text-base">{c.table_id}</h4>
                        <span className="text-[10px] text-gray-400">{new Date(c.created_at).toLocaleTimeString('es-VE', {hour: '2-digit', minute: '2-digit'})}</span>
                      </div>
                      <span className="text-xs font-semibold px-2.5 py-1 bg-amber-50 text-amber-700 rounded-lg">Cocina</span>
                    </div>

                    {/* Items list */}
                    <div className="space-y-1.5 border-t border-dashed border-gray-100 pt-2.5">
                      {c.items.map((it, idx) => (
                        <div key={idx} className="text-sm">
                          <span className="font-extrabold text-[#C5A059]">{it.quantity}x</span>{' '}
                          <span className="text-gray-700">{it.name}</span>
                          {it.notes && (
                            <p className="text-[11px] text-red-500 font-semibold italic pl-5 mt-0.5">Nota: {it.notes}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => updateStatus(c.id, 'listo')}
                    className="mt-4 w-full py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                  >
                    <Check size={14} /> Listo para Servir
                  </button>
                </div>
              ))}
              {colPreparing.length === 0 && (
                <div className="text-center py-10 text-gray-400 text-xs italic">Sin pedidos preparando.</div>
              )}
            </div>
          </div>

          {/* COLUMN 2: LISTO */}
          <div className="bg-green-50/40 rounded-2xl p-4 border border-green-100/50 flex flex-col space-y-4">
            <div className="flex justify-between items-center px-1">
              <span className="text-sm font-bold text-green-800 uppercase tracking-widest">Listos para Llevar ({colReady.length})</span>
              <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
            </div>

            <div className="space-y-4 overflow-y-auto max-h-[70vh] custom-scrollbar">
              {colReady.map(c => (
                <div key={c.id} className="bg-white rounded-xl p-4 shadow-sm border border-green-100 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-gray-800 text-base">{c.table_id}</h4>
                        <span className="text-[10px] text-gray-400">{new Date(c.created_at).toLocaleTimeString('es-VE', {hour: '2-digit', minute: '2-digit'})}</span>
                      </div>
                      <span className="text-xs font-semibold px-2.5 py-1 bg-green-100 text-green-800 rounded-lg animate-pulse">¡LISTO!</span>
                    </div>

                    <div className="space-y-1.5 border-t border-dashed border-gray-100 pt-2.5">
                      {c.items.map((it, idx) => (
                        <div key={idx} className="text-sm">
                          <span className="font-bold text-gray-800">{it.quantity}x</span>{' '}
                          <span className="text-gray-700">{it.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => updateStatus(c.id, 'entregado')}
                    className="mt-4 w-full py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                  >
                    Entregado a Mesa
                  </button>
                </div>
              ))}
              {colReady.length === 0 && (
                <div className="text-center py-10 text-gray-400 text-xs italic">Sin platos listos por llevar.</div>
              )}
            </div>
          </div>

          {/* COLUMN 3: ENTREGADOS / ACTIVOS */}
          <div className="bg-blue-50/30 rounded-2xl p-4 border border-blue-100/40 flex flex-col space-y-4">
            <div className="flex justify-between items-center px-1">
              <span className="text-sm font-bold text-blue-800 uppercase tracking-widest">Servidos / Por Cobrar ({colDelivered.length})</span>
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            </div>

            <div className="space-y-4 overflow-y-auto max-h-[70vh] custom-scrollbar">
              {colDelivered.map(c => (
                <div key={c.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-col justify-between opacity-80">
                  <div className="space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-gray-800 text-base">{c.table_id}</h4>
                        <span className="text-[10px] text-gray-400">{new Date(c.created_at).toLocaleTimeString('es-VE', {hour: '2-digit', minute: '2-digit'})}</span>
                      </div>
                      <span className="text-xs font-semibold px-2 py-0.5 bg-blue-50 text-blue-800 rounded-lg">Servido</span>
                    </div>

                    <div className="space-y-1 border-t border-dashed border-gray-100 pt-2">
                      {c.items.map((it, idx) => (
                        <div key={idx} className="text-xs flex justify-between">
                          <span className="text-gray-600">{it.quantity}x {it.name}</span>
                          <span className="font-semibold text-gray-500">{it.price === 'Incluido' ? 'Incluido' : it.price}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-gray-100 flex justify-between items-center text-xs">
                    <span className="text-gray-400">Total:</span>
                    <span className="font-bold text-[#C5A059]">${c.total_amount}</span>
                  </div>
                </div>
              ))}
              {colDelivered.length === 0 && (
                <div className="text-center py-10 text-gray-400 text-xs italic">Ningún pedido servido pendiente.</div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* ── MODAL: COBRAR MESA (CHECKOUT) ── */}
      {showCheckout && activeCheckoutTable && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl flex flex-col">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Registrar Pago de Mesa</h2>
                <p className="text-xs text-gray-400 mt-0.5">{activeCheckoutTable}</p>
              </div>
              <button 
                onClick={() => {
                  setShowCheckout(false)
                  setActiveCheckoutTable(null)
                }}
                className="p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-colors font-bold"
              >
                ✕
              </button>
            </div>

            {/* Content summary */}
            <div className="p-6 space-y-4 max-h-[50vh] overflow-y-auto custom-scrollbar">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Consumos acumulados</h3>
              <div className="space-y-3">
                {comandas
                  .filter(c => c.table_id === activeCheckoutTable)
                  .map((order, oIdx) => (
                    <div key={order.id} className="bg-gray-50 rounded-xl p-3 border border-gray-100 text-xs space-y-2">
                      <div className="flex justify-between font-bold text-gray-500">
                        <span>Comanda #{oIdx + 1}</span>
                        <span>${order.total_amount}</span>
                      </div>
                      <div className="space-y-1">
                        {order.items.map((item, iIdx) => (
                          <div key={iIdx} className="flex justify-between pl-2">
                            <span className="text-gray-600">{item.quantity}x {item.name}</span>
                            <span className="text-gray-400">{item.price}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>

              {/* Total amount summary */}
              <div className="flex justify-between items-center bg-[#C5A059]/10 p-4 rounded-xl border border-[#C5A059]/25 mt-4">
                <span className="font-bold text-gray-700">Total Neto a Cobrar</span>
                <span className="text-xl font-extrabold text-[#C5A059]">
                  ${comandas.filter(c => c.table_id === activeCheckoutTable).reduce((s, o) => s + (Number(o.total_amount) || 0), 0)}
                </span>
              </div>

              {/* Payment selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block">Método de Pago</label>
                <select
                  value={checkoutPaymentMethod}
                  onChange={e => setCheckoutPaymentMethod(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#C5A059] bg-white font-bold text-gray-700"
                >
                  <option value="efectivo">Efectivo ($ / Bs.)</option>
                  <option value="tarjeta">Punto de Venta / Tarjeta</option>
                  <option value="pago_movil">Pago Móvil</option>
                  <option value="zelle">Zelle</option>
                  <option value="transferencia">Transferencia Bancaria</option>
                </select>
              </div>
            </div>

            {/* Modal footer */}
            <div className="p-6 border-t border-gray-100 bg-gray-50 rounded-b-3xl flex justify-end gap-3">
              <button 
                onClick={() => {
                  setShowCheckout(false)
                  setActiveCheckoutTable(null)
                }}
                disabled={savingCheckout}
                className="px-5 py-2.5 rounded-xl font-bold text-gray-600 hover:bg-gray-200 transition-colors text-sm"
              >
                Cancelar
              </button>
              <button 
                onClick={handleCheckout}
                disabled={savingCheckout}
                className="px-6 py-2.5 rounded-xl font-bold bg-green-500 text-white hover:bg-green-600 transition-colors flex items-center gap-2 text-sm shadow-sm"
              >
                {savingCheckout ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 size={16} /> Confirmar Cobro y Facturar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: NUEVA COMANDA (MANUAL DE MESERO) ── */}
      {showNewOrder && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between flex-none">
              <h2 className="text-xl font-bold text-gray-900">Tomar Pedido (Manual)</h2>
              <button 
                onClick={() => {
                  setShowNewOrder(false)
                  setManualCart([])
                }}
                className="p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-colors font-bold"
              >
                ✕
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[450px]">
              {/* Left Panel: Menu active weekly categories and dishes (7 cols) */}
              <div className="lg:col-span-7 flex flex-col space-y-4 lg:border-r border-gray-100 lg:pr-6">
                {/* Table selector & Quick Notes */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Mesa / Cabaña</label>
                    <select
                      value={selectedTable}
                      onChange={e => setSelectedTable(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#C5A059] bg-white font-bold text-gray-700"
                    >
                      <option value="Mesa 1">Mesa 1</option>
                      <option value="Mesa 2">Mesa 2</option>
                      <option value="Mesa 3">Mesa 3</option>
                      <option value="Mesa 4">Mesa 4</option>
                      <option value="Mesa 5">Mesa 5</option>
                      <option value="Cabaña La Lomita">Cabaña La Lomita</option>
                      <option value="Cabaña Mitibibó">Cabaña Mitibibó</option>
                      <option value="Cabaña La Manita">Cabaña La Manita</option>
                      <option value="Galería Suite La Vega">Galería Suite La Vega</option>
                      <option value="Habitación Llano Grande">Habitación Llano Grande</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Nota del Plato (Opcional)</label>
                    <input
                      type="text"
                      placeholder="Ej: sin cebolla..."
                      value={manualNotes}
                      onChange={e => setManualNotes(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#C5A059]"
                    />
                  </div>
                </div>

                {/* Structured Menu Tabs */}
                <div className="flex bg-gray-100 p-1 rounded-xl gap-1 text-[10px] uppercase tracking-wider font-bold">
                  {menu.map(section => (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => setActiveMenuTab(section.id)}
                      className={`flex-1 py-1.5 rounded-lg text-center transition-all ${
                        activeMenuTab === section.id
                          ? 'bg-white shadow text-gray-800'
                          : 'text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      {section.emoji} {section.label}
                    </button>
                  ))}
                </div>

                {/* Structured Dishes Grid */}
                <div className="flex-1 overflow-y-auto max-h-[300px] custom-scrollbar grid grid-cols-1 md:grid-cols-2 gap-3 pr-1">
                  {activeMenuSection?.items.map((dish, idx) => (
                    <div
                      key={idx}
                      onClick={() => addDishToManual(dish)}
                      className="bg-white hover:bg-gray-50 border border-gray-100 p-3 rounded-xl cursor-pointer transition-all flex flex-col justify-between hover:border-[#C5A059]/40 shadow-sm"
                    >
                      <div>
                        <h4 className="text-xs font-bold text-gray-800">{dish.name}</h4>
                        {dish.description && (
                          <p className="text-[9px] text-gray-400 mt-0.5 line-clamp-2 leading-relaxed">{dish.description}</p>
                        )}
                      </div>
                      <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-50 flex-none">
                        <span className="text-[10px] font-bold text-[#C5A059]">
                          {dish.price || 'Incluido'}
                        </span>
                        <span className="text-[9px] font-bold text-gray-400 bg-gray-50 px-2 py-0.5 rounded-md hover:text-[#C5A059]">
                          + Agregar
                        </span>
                      </div>
                    </div>
                  ))}
                  {(!activeMenuSection || activeMenuSection.items.length === 0) && (
                    <div className="col-span-2 text-center py-10 text-gray-300 text-xs italic">
                      Sin platos en esta sección.
                    </div>
                  )}
                </div>
              </div>

              {/* Right Panel: Selected Items / Cart (5 cols) */}
              <div className="lg:col-span-5 flex flex-col justify-between max-h-[460px]">
                <div className="space-y-4 overflow-y-auto flex-1 custom-scrollbar pr-1 pb-4">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-widest block border-b border-gray-200/50 pb-2">Platos en la Comanda</span>
                  {manualCart.length === 0 ? (
                    <div className="text-center py-20 text-gray-300 text-xs italic">
                      Selecciona platos a la izquierda para agregarlos.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {manualCart.map((item, idx) => (
                        <div key={idx} className="bg-gray-50 rounded-xl p-3 border border-gray-100 shadow-sm flex items-center justify-between text-xs">
                          <div className="min-w-0 flex-1 pr-2">
                            <h5 className="font-bold text-gray-800 truncate">{item.name}</h5>
                            <p className="text-[10px] text-[#C5A059] font-medium mt-0.5">{item.price}</p>
                            {item.notes && (
                              <p className="text-[9px] text-red-500 font-medium italic mt-0.5">Nota: {item.notes}</p>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-3 flex-none">
                            {/* Quantity controls */}
                            <div className="flex items-center bg-white border border-gray-200 rounded-lg overflow-hidden">
                              <button
                                type="button"
                                onClick={() => updateManualQty(item.name, item.quantity - 1)}
                                className="px-2 py-0.5 text-gray-500 hover:bg-gray-100"
                              >
                                -
                              </button>
                              <span className="px-1.5 text-xs font-bold text-gray-700">{item.quantity}</span>
                              <button
                                type="button"
                                onClick={() => updateManualQty(item.name, item.quantity + 1)}
                                className="px-2 py-0.5 text-gray-500 hover:bg-gray-100"
                              >
                                +
                              </button>
                            </div>
                            
                            <button
                              type="button"
                              onClick={() => removeFromManualCart(item.name)}
                              className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {manualCart.length > 0 && (
                  <div className="border-t border-gray-100 pt-3 mt-4 flex justify-between items-center text-xs font-bold text-gray-700">
                    <span>Total Estimado:</span>
                    <span className="text-[#C5A059] text-base font-extrabold">
                      ${manualCart.reduce((sum, item) => {
                        const parsePrice = (pStr: string): number => {
                          if (!pStr || pStr.toLowerCase().includes('incluido')) return 0
                          const num = parseFloat(pStr.replace(/[^0-9.]/g, ''))
                          return isNaN(num) ? 0 : num
                        }
                        return sum + (parsePrice(item.price) * item.quantity)
                      }, 0)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 bg-gray-50 rounded-b-3xl flex justify-end gap-3 flex-none">
              <button 
                onClick={() => {
                  setShowNewOrder(false)
                  setManualCart([])
                }}
                className="px-5 py-2.5 rounded-xl font-bold text-gray-600 hover:bg-gray-200 transition-colors text-sm"
              >
                Cancelar
              </button>
              <button 
                onClick={saveManualOrder}
                disabled={manualCart.length === 0}
                className="px-6 py-2.5 rounded-xl font-bold bg-[#C5A059] text-white hover:bg-[#b8904a] transition-colors flex items-center gap-2 text-sm shadow-sm disabled:opacity-50"
              >
                <Check size={18} /> Confirmar e Iniciar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ComandasPage
