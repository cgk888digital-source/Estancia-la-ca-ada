import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Plus, Check, Search, Utensils, Trash2, CheckCircle2, Bell, QrCode, Copy, Printer, Smartphone, Receipt, Award } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import confetti from 'canvas-confetti'
import { getMenu } from '../../utils/menuStore'
import type { MenuSection, DishItem } from '../../data/weeklyMenu'
import { buildTableLocations, roomLocations, getOrderingLocationUrl } from '../../data/orderingLocations'
import { useHotelSettings } from '../../utils/useHotelSettings'
import { fechaLocalISO } from '../../utils/dateUtils'
import { getBcvEuroRate } from '../../utils/exchangeRate'

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
  waiter?: string | null
  room_id?: string | null
  service_fee?: number | null
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
  const [comandas, setComandas] = useState<Comanda[]>(() => {
    try {
      const local = localStorage.getItem('estancia_comandas')
      if (local) {
        const parsed = JSON.parse(local)
        if (Array.isArray(parsed)) return parsed
      }
    } catch (e) {}
    return []
  })

  const [menu, setMenu] = useState<MenuSection[]>([])
  const [activeMenuTab, setActiveMenuTab] = useState('desayuno')
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [soundEnabled, setSoundEnabled] = useState(true)
  
  // Modal states
  const [showNewOrder, setShowNewOrder] = useState(false)
  const [showCheckout, setShowCheckout] = useState(false)
  const [activeCheckoutTable, setActiveCheckoutTable] = useState<string | null>(null)
  const [checkoutPaymentMethod, setCheckoutPaymentMethod] = useState('efectivo')
  const [savingCheckout, setSavingCheckout] = useState(false)
  const [bcvRate, setBcvRate] = useState<number>(36.50)
  const [sendServiceToTips, setSendServiceToTips] = useState<boolean>(true)
  const [showPreCuentaModal, setShowPreCuentaModal] = useState<boolean>(false)
  const [preCuentaTable, setPreCuentaTable] = useState<string | null>(null)

  useEffect(() => {
    getBcvEuroRate().then(rate => {
      if (rate > 0) setBcvRate(rate)
    })
  }, [])

  const { settings: hotelSettings } = useHotelSettings()
  const tableLocations = buildTableLocations(Number(hotelSettings.table_count) || 6)
  const allLocations = [...tableLocations, ...roomLocations]

  // QR & NFC Generator states
  const [showQrModal, setShowQrModal] = useState(false)
  const [selectedQrLocationSlug, setSelectedQrLocationSlug] = useState('mesa-1')
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [customDomain, setCustomDomain] = useState(() => window.location.origin)
  const selectedQrLocation = allLocations.find(l => l.slug === selectedQrLocationSlug) ?? null

  // Manual order states
  const [selectedTable, setSelectedTable] = useState('Mesa 1')
  const [manualCart, setManualCart] = useState<OrderItem[]>([])
  const [manualNotes, setManualNotes] = useState('')

  // Waiter & Room linkage states
  const [employees, setEmployees] = useState<{ id: string; name: string; role?: string }[]>([])
  const [manualWaiter, setManualWaiter] = useState<string>('Camarero 1')
  const [manualRoom, setManualRoom] = useState<string>('')
  const [checkoutWaiter, setCheckoutWaiter] = useState<string>('')
  const [checkoutRoom, setCheckoutRoom] = useState<string>('')
  const [showWaiterTipsModal, setShowWaiterTipsModal] = useState<boolean>(false)
  const [waiterTipsData, setWaiterTipsData] = useState<{ waiter: string; tipsTotal: number; ordersCount: number; salesTotal: number }[]>([])
  const [loadingTips, setLoadingTips] = useState<boolean>(false)

  const defaultWaiters = useMemo(() => ['Camarero 1', 'Camarero 2', 'Camarero 3', 'Camarero 4', 'Camarero 5', 'Camarero 6'], [])
  const waiterOptions = useMemo(() => {
    const fromEmployees = employees
      .filter(e => {
        const r = (e.role || '').toLowerCase()
        return r.includes('camarer') || r.includes('meson') || r.includes('restaurante') || r.includes('servicio')
      })
      .map(e => e.name)
    return Array.from(new Set([...fromEmployees, ...defaultWaiters]))
  }, [employees, defaultWaiters])

  // Load employees to populate waiter list if available
  useEffect(() => {
    supabase.from('employees').select('id, name, role').eq('status', 'activo').then(({ data }) => {
      if (data) setEmployees(data)
    })
  }, [])

  // Auto-populate checkout waiter and room from the active table orders
  useEffect(() => {
    if (activeCheckoutTable) {
      const tableOrders = comandas.filter(c => c.table_id === activeCheckoutTable)
      const w = tableOrders.find(o => o.waiter)?.waiter || 'Camarero 1'
      const r = tableOrders.find(o => o.room_id)?.room_id || ''
      setCheckoutWaiter(w)
      setCheckoutRoom(r)
      if (r) {
        setCheckoutPaymentMethod('habitacion')
      } else {
        setCheckoutPaymentMethod('efectivo')
      }
    }
  }, [activeCheckoutTable, comandas])

  const updateTableWaiter = async (tableId: string, waiter: string) => {
    setComandas(prev => prev.map(c => c.table_id === tableId ? { ...c, waiter } : c))
    try {
      await supabase
        .from('comandas')
        .update({ waiter: waiter || null })
        .eq('table_id', tableId)
        .eq('payment_status', 'pendiente')
    } catch (e) {
      console.warn('Error updating waiter:', e)
    }
  }

  const updateTableRoom = async (tableId: string, roomId: string) => {
    setComandas(prev => prev.map(c => c.table_id === tableId ? { ...c, room_id: roomId } : c))
    try {
      await supabase
        .from('comandas')
        .update({ room_id: roomId || null })
        .eq('table_id', tableId)
        .eq('payment_status', 'pendiente')
    } catch (e) {
      console.warn('Error updating room link:', e)
    }
  }

  const fetchWaiterTips = async () => {
    setLoadingTips(true)
    try {
      const { data, error } = await supabase
        .from('comandas')
        .select('waiter, service_fee, total_amount, created_at')
        .eq('payment_status', 'pagado')
        .not('waiter', 'is', null)

      if (!error && data) {
        const summary: Record<string, { tipsTotal: number; ordersCount: number; salesTotal: number }> = {}
        data.forEach(d => {
          const w = d.waiter || 'Sin Asignar'
          if (!summary[w]) summary[w] = { tipsTotal: 0, ordersCount: 0, salesTotal: 0 }
          summary[w].tipsTotal += Number(d.service_fee) || 0
          summary[w].salesTotal += Number(d.total_amount) || 0
          summary[w].ordersCount += 1
        })
        setWaiterTipsData(
          Object.entries(summary)
            .map(([waiter, stats]) => ({ waiter, ...stats }))
            .sort((a, b) => b.tipsTotal - a.tipsTotal)
        )
      }
    } catch (e) {
      console.warn('Error loading waiter tips:', e)
    } finally {
      setLoadingTips(false)
    }
  }

  const previousCountRef = useRef(0)

  // Save comandas to local storage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('estancia_comandas', JSON.stringify(comandas))
    } catch (e) {}
  }, [comandas])

  const fetchComandas = async () => {
    try {
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
    } catch (e) {
      console.warn('Notice fetching comandas from Supabase:', e)
    }
  }

  const fetchMenu = async () => {
    const data = await getMenu()
    setMenu(data)
    if (data.length > 0) setActiveMenuTab(data[0].id)
  }

  useEffect(() => {
    fetchComandas()
    fetchMenu()

    const handleLocalUpdate = () => {
      try {
        const local = localStorage.getItem('estancia_comandas')
        if (local) {
          setComandas(JSON.parse(local))
          setLoading(false)
        }
      } catch (e) {}
    }

    window.addEventListener('storage', handleLocalUpdate)
    window.addEventListener('comanda_created', handleLocalUpdate)
    window.addEventListener('focus', fetchComandas)

    // Polling backup every 4 seconds to guarantee PC and Mobile stay 100% in sync
    const pollInterval = setInterval(() => {
      fetchComandas()
    }, 4000)

    const channel = supabase
      .channel('comandas_admin_realtime_global')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'comandas'
      }, () => {
        fetchComandas()
      })
      .subscribe()

    return () => {
      window.removeEventListener('storage', handleLocalUpdate)
      window.removeEventListener('comanda_created', handleLocalUpdate)
      window.removeEventListener('focus', fetchComandas)
      clearInterval(pollInterval)
      supabase.removeChannel(channel)
    }
  }, [soundEnabled])

  // Update order status (KDS movements) with instant optimistic UI update
  const updateStatus = async (id: string, newStatus: 'preparando' | 'listo' | 'entregado' | 'cancelado') => {
    // 1. Instant local UI update
    setComandas(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c))

    // 2. Sync to Supabase in background
    try {
      const { error } = await supabase
        .from('comandas')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', id)

      if (error) {
        console.warn('Supabase status update warning:', error.message)
      }
    } catch (e) {
      console.warn('Network error updating status:', e)
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

  // Save manual order with instant UI update
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

    const isMesa = selectedTable.startsWith('Mesa')
    const assignedWaiter = isMesa ? (manualWaiter || null) : null
    const assignedRoom = isMesa ? (manualRoom || null) : selectedTable

    const tempId = 'cmd_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4)
    const newComanda: Comanda = {
      id: tempId,
      table_id: selectedTable,
      items: [...manualCart],
      total_amount: totalAmount,
      status: 'preparando',
      payment_status: 'pendiente',
      waiter: assignedWaiter,
      room_id: assignedRoom,
      created_at: new Date().toISOString()
    }

    // 1. Instant local UI update
    setComandas(prev => [...prev, newComanda])
    setManualCart([])
    setShowNewOrder(false)

    // 2. Sync to Supabase
    try {
      const { data, error } = await supabase
        .from('comandas')
        .insert({
          table_id: selectedTable,
          items: newComanda.items,
          total_amount: totalAmount,
          status: 'preparando',
          payment_status: 'pendiente',
          waiter: assignedWaiter,
          room_id: assignedRoom
        })
        .select('id')
        .single()

      if (!error && data?.id) {
        setComandas(prev => prev.map(c => c.id === tempId ? { ...c, id: data.id } : c))
      }
    } catch (e) {
      console.warn('Supabase manual order insert notice:', e)
    }
  }

  // Checkout process (process bill and archive table comandas)
  const handleCheckout = async () => {
    if (!activeCheckoutTable) return
    setSavingCheckout(true)

    const tableOrders = comandas.filter(c => c.table_id === activeCheckoutTable)
    const subtotal = tableOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0)
    const serviceFee = Number((subtotal * 0.10).toFixed(2))
    const totalToPay = Number((subtotal + serviceFee).toFixed(2))

    const targetTable = activeCheckoutTable
    const targetWaiter = checkoutWaiter || tableOrders.find(o => o.waiter)?.waiter || null
    const targetRoom = checkoutRoom || tableOrders.find(o => o.room_id)?.room_id || null

    const cobro = await supabase
      .from('comandas')
      .update({ 
        payment_status: 'pagado', 
        waiter: targetWaiter,
        room_id: targetRoom,
        service_fee: serviceFee,
        updated_at: new Date().toISOString() 
      })
      .eq('table_id', targetTable)
      .eq('payment_status', 'pendiente')

    if (cobro.error) {
      console.error('No se pudo cerrar la mesa:', cobro.error)
      alert('No se pudo cerrar la mesa. La cuenta sigue abierta; vuelva a intentarlo.')
      setSavingCheckout(false)
      return
    }

    const txsToInsert = []
    const isChargedToRoom = checkoutPaymentMethod === 'habitacion'
    const paymentLabel = isChargedToRoom ? 'Cargado a Habitación' : checkoutPaymentMethod

    if (sendServiceToTips && serviceFee > 0) {
      if (subtotal > 0) {
        txsToInsert.push({
          type: 'ingreso',
          category: 'restaurante',
          description: `Consumo Restaurante - ${targetTable}${targetRoom ? ` (Cargado a ${targetRoom})` : ''}${targetWaiter ? ` · Atendido por ${targetWaiter}` : ''}`,
          amount: subtotal,
          payment_method: paymentLabel,
          related_to: targetRoom || targetTable,
          date: fechaLocalISO()
        })
      }
      txsToInsert.push({
        type: 'ingreso',
        category: 'propinas',
        description: `10% Servicio Restaurante - ${targetTable} (${targetWaiter ? `Camarero: ${targetWaiter}` : 'Fondo General'}${targetRoom ? ` · Hab: ${targetRoom}` : ''})`,
        amount: serviceFee,
        payment_method: paymentLabel,
        related_to: targetWaiter || targetTable,
        notes: JSON.stringify({ waiter: targetWaiter, room: targetRoom, table: targetTable, date: fechaLocalISO() }),
        date: fechaLocalISO()
      })
    } else {
      txsToInsert.push({
        type: 'ingreso',
        category: 'restaurante',
        description: `Consumo Restaurante - ${targetTable}${targetRoom ? ` (Cargado a ${targetRoom})` : ''}${targetWaiter ? ` · Atendido por ${targetWaiter}` : ''} (Subtotal: $${subtotal.toFixed(2)} + 10% Serv: $${serviceFee.toFixed(2)})`,
        amount: totalToPay,
        payment_method: paymentLabel,
        related_to: targetRoom || targetTable,
        notes: targetWaiter ? JSON.stringify({ waiter: targetWaiter }) : undefined,
        date: fechaLocalISO()
      })
    }

    const ingreso = await supabase.from('transactions').insert(txsToInsert)

    if (ingreso.error) {
      // La mesa ya quedo cobrada, asi que no se puede deshacer sin mas: lo que no
      // puede pasar es que el dinero se pierda en silencio.
      console.error('La mesa se cobro pero el ingreso no se registro:', ingreso.error)
      alert(
        `La mesa se cerro, pero el ingreso de ${totalToPay} NO quedo registrado en la contabilidad.\n\nAnotelo a mano en Ingresos antes de cerrar la caja.`
      )
    }

    // 2. Ya esta guardado: ahora si se limpia la pantalla y se celebra.
    setComandas(prev => prev.filter(c => c.table_id !== targetTable))
    setShowCheckout(false)
    setActiveCheckoutTable(null)
    setSavingCheckout(false)

    confetti({
      particleCount: 80,
      spread: 60,
      origin: { y: 0.8 }
    })
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
            onClick={() => setShowQrModal(true)}
            className="flex items-center gap-2 bg-white text-[#3D2B1F] border border-gray-200 hover:border-[#C5A059] px-4 py-2.5 rounded-xl font-bold transition-all shadow-sm"
          >
            <QrCode size={18} className="text-[#C5A059]" />
            <span className="hidden sm:inline">Códigos QR & NFC</span>
          </button>
          <button
            onClick={() => {
              fetchWaiterTips()
              setShowWaiterTipsModal(true)
            }}
            className="flex items-center gap-2 bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100 px-4 py-2.5 rounded-xl font-bold transition-all text-sm shadow-sm"
          >
            <Award size={18} className="text-[#C5A059]" />
            <span className="hidden sm:inline">Propinas Camareros</span>
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

                    {c.table_id.startsWith('Mesa') && (
                      <div className="pt-2 border-t border-gray-100 flex flex-col gap-1 text-[11px]">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Camarero:</span>
                          <select
                            value={c.waiter || ''}
                            onChange={e => updateTableWaiter(c.table_id, e.target.value)}
                            className={`text-[10px] font-bold rounded-lg px-2 py-0.5 border cursor-pointer ${
                              c.waiter 
                                ? 'bg-amber-50 text-amber-900 border-amber-300' 
                                : 'bg-gray-50 text-gray-400 border-dashed border-gray-300'
                            }`}
                          >
                            <option value="">-- Asignar --</option>
                            {waiterOptions.map(w => (
                              <option key={w} value={w}>🧑‍🍳 {w}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Cargar a:</span>
                          <select
                            value={c.room_id || ''}
                            onChange={e => updateTableRoom(c.table_id, e.target.value)}
                            className={`text-[10px] font-bold rounded-lg px-2 py-0.5 border max-w-[140px] truncate cursor-pointer ${
                              c.room_id 
                                ? 'bg-blue-50 text-blue-900 border-blue-300' 
                                : 'bg-gray-50 text-gray-400 border-dashed border-gray-300'
                            }`}
                          >
                            <option value="">-- Mesa Directo --</option>
                            <optgroup label="Habitación / Cabaña:">
                              {roomLocations.map(r => (
                                <option key={r.slug} value={r.label}>🏨 {r.label}</option>
                              ))}
                            </optgroup>
                          </select>
                        </div>
                      </div>
                    )}

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

                    {c.table_id.startsWith('Mesa') && (
                      <div className="pt-2 border-t border-gray-100 flex flex-col gap-1 text-[11px]">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Camarero:</span>
                          <select
                            value={c.waiter || ''}
                            onChange={e => updateTableWaiter(c.table_id, e.target.value)}
                            className={`text-[10px] font-bold rounded-lg px-2 py-0.5 border cursor-pointer ${
                              c.waiter 
                                ? 'bg-amber-50 text-amber-900 border-amber-300' 
                                : 'bg-gray-50 text-gray-400 border-dashed border-gray-300'
                            }`}
                          >
                            <option value="">-- Asignar --</option>
                            {waiterOptions.map(w => (
                              <option key={w} value={w}>🧑‍🍳 {w}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Cargar a:</span>
                          <select
                            value={c.room_id || ''}
                            onChange={e => updateTableRoom(c.table_id, e.target.value)}
                            className={`text-[10px] font-bold rounded-lg px-2 py-0.5 border max-w-[140px] truncate cursor-pointer ${
                              c.room_id 
                                ? 'bg-blue-50 text-blue-900 border-blue-300' 
                                : 'bg-gray-50 text-gray-400 border-dashed border-gray-300'
                            }`}
                          >
                            <option value="">-- Mesa Directo --</option>
                            <optgroup label="Habitación / Cabaña:">
                              {roomLocations.map(r => (
                                <option key={r.slug} value={r.label}>🏨 {r.label}</option>
                              ))}
                            </optgroup>
                          </select>
                        </div>
                      </div>
                    )}

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

                    {c.table_id.startsWith('Mesa') && (
                      <div className="pt-2 border-t border-gray-100 flex flex-col gap-1 text-[11px]">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Camarero:</span>
                          <select
                            value={c.waiter || ''}
                            onChange={e => updateTableWaiter(c.table_id, e.target.value)}
                            className={`text-[10px] font-bold rounded-lg px-2 py-0.5 border cursor-pointer ${
                              c.waiter 
                                ? 'bg-amber-50 text-amber-900 border-amber-300' 
                                : 'bg-gray-50 text-gray-400 border-dashed border-gray-300'
                            }`}
                          >
                            <option value="">-- Asignar --</option>
                            {waiterOptions.map(w => (
                              <option key={w} value={w}>🧑‍🍳 {w}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Cargar a:</span>
                          <select
                            value={c.room_id || ''}
                            onChange={e => updateTableRoom(c.table_id, e.target.value)}
                            className={`text-[10px] font-bold rounded-lg px-2 py-0.5 border max-w-[140px] truncate cursor-pointer ${
                              c.room_id 
                                ? 'bg-blue-50 text-blue-900 border-blue-300' 
                                : 'bg-gray-50 text-gray-400 border-dashed border-gray-300'
                            }`}
                          >
                            <option value="">-- Mesa Directo --</option>
                            <optgroup label="Habitación / Cabaña:">
                              {roomLocations.map(r => (
                                <option key={r.slug} value={r.label}>🏨 {r.label}</option>
                              ))}
                            </optgroup>
                          </select>
                        </div>
                      </div>
                    )}

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
                    <span className="text-gray-400">Subtotal:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#C5A059]">${c.total_amount}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setPreCuentaTable(c.table_id)
                          setShowPreCuentaModal(true)
                        }}
                        className="text-[10px] font-bold text-gray-600 hover:text-[#C5A059] bg-gray-50 hover:bg-[#C5A059]/10 px-2 py-1 rounded-md transition-colors flex items-center gap-1 border border-gray-200/60"
                        title="Ver / Imprimir Pre-Cuenta con 10% de Servicio"
                      >
                        <Receipt size={11} /> Pre-Cuenta
                      </button>
                    </div>
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

              {/* Total amount summary with 10% service */}
              {(() => {
                const tableOrders = comandas.filter(c => c.table_id === activeCheckoutTable)
                const subtotal = tableOrders.reduce((s, o) => s + (Number(o.total_amount) || 0), 0)
                const serviceFee = Number((subtotal * 0.10).toFixed(2))
                const totalToPay = Number((subtotal + serviceFee).toFixed(2))

                return (
                  <div className="space-y-3 mt-4">
                    <div className="bg-[#C5A059]/10 p-4 rounded-2xl border border-[#C5A059]/25 space-y-2">
                      <div className="flex justify-between items-center text-xs text-gray-600">
                        <span>Subtotal (Comidas & Bebidas)</span>
                        <span className="font-bold text-gray-800">${subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs text-emerald-800 font-semibold">
                        <span className="flex items-center gap-1">
                          <span>10% de Servicio</span>
                          <span className="text-[10px] text-gray-500 font-normal">(agregado automáticamente)</span>
                        </span>
                        <span>+${serviceFee.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center pt-2.5 border-t border-[#C5A059]/20">
                        <span className="font-bold text-gray-800 text-sm">Total a Cobrar</span>
                        <div className="text-right">
                          <span className="text-2xl font-extrabold text-[#C5A059]">
                            ${totalToPay.toFixed(2)}
                          </span>
                          {bcvRate > 0 && (
                            <p className="text-[11px] text-gray-500 font-medium mt-0.5">
                              ~Bs. {(totalToPay * bcvRate).toFixed(2)} <span className="text-[9px] text-gray-400">(Tasa BCV {bcvRate})</span>
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <label className="flex items-start gap-2.5 p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl text-xs text-emerald-900 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={sendServiceToTips}
                        onChange={e => setSendServiceToTips(e.target.checked)}
                        className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                      />
                      <div>
                        <span className="font-bold">Abonar el 10% de servicio (+${serviceFee.toFixed(2)}) al Fondo de Propinas</span>
                        <p className="text-[10px] text-emerald-700/80 mt-0.5">
                          Se sumará automáticamente al fondo para el reparto semanal entre los trabajadores.
                        </p>
                      </div>
                    </label>
                  </div>
                )
              })()}

              {/* Waiter and Room selector in Checkout */}
              {activeCheckoutTable.startsWith('Mesa') && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-gray-50 p-3.5 rounded-2xl border border-gray-200/80 text-xs">
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                      🧑‍🍳 Camarero que Atendió:
                    </label>
                    <select
                      value={checkoutWaiter}
                      onChange={e => setCheckoutWaiter(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-800 focus:outline-none focus:border-[#C5A059]"
                    >
                      <option value="">-- Sin asignar --</option>
                      {waiterOptions.map(w => (
                        <option key={w} value={w}>{w}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                      🏨 Cargar a Habitación:
                    </label>
                    <select
                      value={checkoutRoom}
                      onChange={e => {
                        setCheckoutRoom(e.target.value)
                        if (e.target.value) setCheckoutPaymentMethod('habitacion')
                      }}
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-800 focus:outline-none focus:border-[#C5A059]"
                    >
                      <option value="">-- Cobro Directo en Mesa --</option>
                      <optgroup label="Habitación o Cabaña:">
                        {roomLocations.map(r => (
                          <option key={r.slug} value={r.label}>{r.label}</option>
                        ))}
                      </optgroup>
                    </select>
                  </div>
                </div>
              )}

              {/* Payment selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block">Método de Pago</label>
                <select
                  value={checkoutPaymentMethod}
                  onChange={e => setCheckoutPaymentMethod(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#C5A059] bg-white font-bold text-gray-700"
                >
                  <option value="habitacion">🏨 Cargar a Cuenta de Habitación (Pago al Check-out)</option>
                  <option value="efectivo">Efectivo ($ / Bs.)</option>
                  <option value="tarjeta">Punto de Venta / Tarjeta</option>
                  <option value="pago_movil">Pago Móvil</option>
                  <option value="zelle">Zelle</option>
                  <option value="transferencia">Transferencia Bancaria</option>
                </select>

                {checkoutPaymentMethod === 'habitacion' && (
                  <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2.5">
                    <span className="text-base leading-none">🏨</span>
                    <div>
                      <p className="font-bold">Consumo cargado a la cuenta del huésped</p>
                      <p className="text-[11px] text-blue-700/90 mt-0.5 leading-relaxed">
                        {checkoutRoom ? `Vinculado a: ${checkoutRoom}.` : 'Por favor asegúrate de seleccionar arriba la habitación correspondiente.'} El huésped cancelará el monto total en Recepción al momento de su Check-out.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal footer */}
            <div className="p-6 border-t border-gray-100 bg-gray-50 rounded-b-3xl flex items-center justify-between gap-3 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  setPreCuentaTable(activeCheckoutTable)
                  setShowPreCuentaModal(true)
                }}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-gray-700 bg-white border border-gray-200 hover:bg-gray-100 text-xs transition-colors shadow-sm"
              >
                <Printer size={15} /> Imprimir Pre-Cuenta
              </button>

              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    setShowCheckout(false)
                    setActiveCheckoutTable(null)
                  }}
                  disabled={savingCheckout}
                  className="px-4 py-2.5 rounded-xl font-bold text-gray-600 hover:bg-gray-200 transition-colors text-xs"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleCheckout}
                  disabled={savingCheckout}
                  className="px-5 py-2.5 rounded-xl font-bold bg-green-500 text-white hover:bg-green-600 transition-colors flex items-center gap-2 text-xs shadow-sm"
                >
                  {savingCheckout ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 size={15} /> Confirmar Cobro
                    </>
                  )}
                </button>
              </div>
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
                      <optgroup label="Mesas">
                        {tableLocations.map(loc => (
                          <option key={loc.slug} value={loc.label}>{loc.label}</option>
                        ))}
                      </optgroup>
                      <optgroup label="Habitaciones y Cabañas">
                        {roomLocations.map(loc => (
                          <option key={loc.slug} value={loc.label}>{loc.label}</option>
                        ))}
                      </optgroup>
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

                {/* Waiter & Room assignment for restaurant tables */}
                {selectedTable.startsWith('Mesa') && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-amber-50/70 p-3 rounded-2xl border border-amber-200/70">
                    <div>
                      <label className="text-[10px] font-bold text-amber-900 uppercase tracking-widest block mb-1">
                        🧑‍🍳 Camarero de Mesa
                      </label>
                      <select
                        value={manualWaiter}
                        onChange={e => setManualWaiter(e.target.value)}
                        className="w-full border border-amber-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-800 bg-white focus:outline-none focus:border-[#C5A059]"
                      >
                        {waiterOptions.map(w => (
                          <option key={w} value={w}>{w}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-amber-900 uppercase tracking-widest block mb-1">
                        🏨 Cargar a Habitación (Opcional)
                      </label>
                      <select
                        value={manualRoom}
                        onChange={e => setManualRoom(e.target.value)}
                        className="w-full border border-amber-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-800 bg-white focus:outline-none focus:border-[#C5A059]"
                      >
                        <option value="">-- Ninguna (Cobro en mesa) --</option>
                        <optgroup label="Habitación o Cabaña:">
                          {roomLocations.map(r => (
                            <option key={r.slug} value={r.label}>{r.label}</option>
                          ))}
                        </optgroup>
                      </select>
                    </div>
                  </div>
                )}

                {/* Structured Menu Tabs */}
                <div className="flex bg-gray-100 p-1 rounded-xl gap-1 text-[10px] uppercase tracking-wider font-bold overflow-x-auto">
                  {menu.map(section => (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => setActiveMenuTab(section.id)}
                      className={`flex-1 min-w-fit px-2.5 py-1.5 rounded-lg text-center transition-all whitespace-nowrap ${
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

      {/* ── MODAL: GENERADOR DE QR & NFC MESAS ── */}
      {showQrModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm print:p-0 print:bg-white print:static">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl flex flex-col overflow-hidden print:shadow-none print:w-full print:max-w-none">
            {/* Header (Hidden when printing) */}
            <div className="p-6 border-b border-gray-100 flex items-center justify-between flex-none print:hidden">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#C5A059]/10 rounded-2xl text-[#C5A059]">
                  <QrCode size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Generador de QR & Enlaces NFC</h2>
                  <p className="text-xs text-gray-400">Configura la URL para los tags NFC o imprime acrílicos de mesa</p>
                </div>
              </div>
              <button 
                onClick={() => setShowQrModal(false)}
                className="p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-colors font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto max-h-[80vh] custom-scrollbar print:overflow-visible print:max-h-none print:p-0">
              {/* Controls (Hidden when printing) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100 print:hidden">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Seleccionar Mesa / Habitación / Cabaña</label>
                  <select
                    value={selectedQrLocationSlug}
                    onChange={e => {
                      setSelectedQrLocationSlug(e.target.value)
                      setCopiedUrl(false)
                    }}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-bold text-gray-700 bg-white focus:outline-none focus:border-[#C5A059]"
                  >
                    <optgroup label="Mesas Restaurante">
                      {tableLocations.map(loc => (
                        <option key={loc.slug} value={loc.slug}>{loc.label}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Habitaciones y Cabañas">
                      {roomLocations.map(loc => (
                        <option key={loc.slug} value={loc.slug}>{loc.label}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Dominio / Host Base</label>
                  <input
                    type="text"
                    value={customDomain}
                    onChange={e => setCustomDomain(e.target.value)}
                    placeholder="https://estancialacanada.com"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-mono text-gray-700 bg-white focus:outline-none focus:border-[#C5A059]"
                  />
                </div>
              </div>

              {/* NFC URL Copy Bar (Hidden when printing) */}
              <div className="bg-amber-50/60 border border-amber-200/70 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 print:hidden">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-amber-800 text-xs font-bold mb-1">
                    <Smartphone size={16} />
                    <span>URL para Grabar en Tag NFC:</span>
                  </div>
                  <code className="text-xs font-mono text-amber-900 bg-amber-100/80 px-2 py-1 rounded block truncate">
                    {selectedQrLocation ? getOrderingLocationUrl(selectedQrLocation, customDomain) : ''}
                  </code>
                </div>
                <button
                  onClick={() => {
                    if (!selectedQrLocation) return
                    const url = getOrderingLocationUrl(selectedQrLocation, customDomain)
                    navigator.clipboard.writeText(url)
                    setCopiedUrl(true)
                    setTimeout(() => setCopiedUrl(false), 2500)
                  }}
                  className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shrink-0 shadow-sm"
                >
                  {copiedUrl ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copiedUrl ? '¡Copiado!' : 'Copiar URL NFC'}</span>
                </button>
              </div>

              {/* PRINTABLE TABLE STAND CARD */}
              <div className="py-2 print:py-0">
                <div className="bg-white p-8 rounded-3xl border-2 border-[#C5A059] flex flex-col items-center text-center shadow-xl max-w-sm mx-auto print:shadow-none print:border-4 print:w-full print:max-w-none print:rounded-none">
                  <img 
                    src="/assets/logo-nuevo.png" 
                    alt="Logo Estancia La Cañada" 
                    className="w-14 h-14 object-contain mb-2 bg-[#3D2B1F] p-1.5 rounded-2xl shadow-md"
                  />
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-[#C5A059]">Estancia La Cañada</span>
                  <h3 className="text-xl font-serif font-bold text-[#3D2B1F] mt-1 mb-4">Menú Digital & Room Service</h3>

                  {/* QR Image */}
                  <div className="p-4 bg-white border-2 border-[#C5A059]/20 rounded-3xl shadow-inner mb-4">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(selectedQrLocation ? getOrderingLocationUrl(selectedQrLocation, customDomain) : '')}`}
                      alt={`QR Code ${selectedQrLocation?.label ?? ''}`}
                      className="w-52 h-52 object-contain"
                    />
                  </div>

                  <div className="bg-[#3D2B1F] text-[#C5A059] px-6 py-1.5 rounded-full font-bold text-sm uppercase tracking-widest mb-3 shadow-sm border border-[#C5A059]/30">
                    {selectedQrLocation?.label}
                  </div>

                  <div className="flex items-center gap-2 text-xs text-gray-700 font-bold mb-1">
                    <Smartphone size={16} className="text-[#C5A059]" />
                    <span>Acerque su celular (NFC) o escanee el QR</span>
                  </div>
                  <p className="text-[10px] text-gray-400 font-medium">Ordene directamente a la cocina sin esperar atención</p>
                </div>
              </div>
            </div>

            {/* Modal Footer (Hidden when printing) */}
            <div className="p-6 border-t border-gray-100 bg-gray-50 rounded-b-3xl flex justify-between items-center print:hidden">
              <span className="text-xs text-gray-400">Compatible con stickers NFC NTAG213 / NTAG215 / NTAG216</span>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setShowQrModal(false)}
                  className="px-5 py-2.5 rounded-xl font-bold text-gray-600 hover:bg-gray-200 transition-colors text-sm"
                >
                  Cerrar
                </button>
                <button 
                  onClick={() => window.print()}
                  className="px-6 py-2.5 rounded-xl font-bold bg-[#3D2B1F] text-white hover:bg-black transition-colors flex items-center gap-2 text-sm shadow-md"
                >
                  <Printer size={16} /> Imprimir Tarjeta de Mesa
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: PRE-CUENTA / TICKET DE CONSUMO (IMPRIMIBLE) ── */}
      {showPreCuentaModal && preCuentaTable && (() => {
        const tableOrders = comandas.filter(c => c.table_id === preCuentaTable)
        const subtotal = tableOrders.reduce((s, o) => s + (Number(o.total_amount) || 0), 0)
        const serviceFee = Number((subtotal * 0.10).toFixed(2))
        const totalToPay = Number((subtotal + serviceFee).toFixed(2))
        const totalBs = (totalToPay * bcvRate).toFixed(2)
        const activeWaiter = tableOrders.find(o => o.waiter)?.waiter || null
        const activeRoom = tableOrders.find(o => o.room_id)?.room_id || null

        return (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm print:p-0 print:bg-white print:static">
            <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden print:shadow-none print:w-full print:max-w-none">
              
              {/* Header (Hidden when printing) */}
              <div className="p-5 border-b border-gray-100 flex items-center justify-between print:hidden bg-gray-50">
                <div className="flex items-center gap-2 text-gray-800 font-bold text-sm">
                  <Receipt size={18} className="text-[#C5A059]" />
                  <span>Pre-Cuenta de Mesa / Habitación</span>
                </div>
                <button
                  onClick={() => setShowPreCuentaModal(false)}
                  className="p-1.5 text-gray-400 hover:bg-gray-200 rounded-full transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* TICKET BODY (Formatted for screen and thermal/standard print) */}
              <div className="p-6 overflow-y-auto max-h-[75vh] font-mono text-xs space-y-4 print:p-0 print:overflow-visible">
                <div className="text-center space-y-1 border-b border-dashed border-gray-300 pb-4">
                  <h2 className="font-bold text-base font-serif text-gray-900 tracking-wider">ESTANCIA LA CAÑADA</h2>
                  <p className="text-[10px] text-gray-500">BAR & RESTAURANTE</p>
                  <p className="text-[10px] text-gray-500">Mérida, Venezuela</p>
                  <div className="pt-2 flex flex-col items-center gap-1">
                    <span className="inline-block bg-gray-100 px-3 py-1 rounded-full font-bold text-gray-800 text-xs">
                      {preCuentaTable}
                    </span>
                    {activeWaiter && (
                      <span className="text-[11px] font-bold text-amber-800">
                        🧑‍🍳 Camarero: {activeWaiter}
                      </span>
                    )}
                    {activeRoom && (
                      <span className="text-[11px] font-bold text-blue-800 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                        🏨 Cargar a: {activeRoom}
                      </span>
                    )}
                  </div>
                  <p className="text-[9px] text-gray-400 pt-1">
                    {new Date().toLocaleDateString('es-VE', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })} - {new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>

                {/* Items list */}
                <div className="space-y-2 py-2 border-b border-dashed border-gray-300">
                  <div className="flex justify-between font-bold text-gray-400 text-[10px] uppercase tracking-wider pb-1">
                    <span>Cant / Descripción</span>
                    <span>Total</span>
                  </div>
                  {tableOrders.flatMap(o => o.items).map((it, idx) => (
                    <div key={idx} className="flex justify-between items-start text-gray-800">
                      <div className="pr-2">
                        <span className="font-bold">{it.quantity}x</span> {it.name}
                      </div>
                      <span className="font-semibold shrink-0">
                        {it.price === 'Incluido' ? 'Incluido' : it.price}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Totals Breakdown */}
                <div className="space-y-1.5 pt-1 text-gray-700">
                  <div className="flex justify-between text-xs">
                    <span>Subtotal Consumos:</span>
                    <span className="font-bold">${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold text-emerald-800">
                    <span>10% de Servicio {activeWaiter ? `(${activeWaiter})` : ''}:</span>
                    <span>+${serviceFee.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-base font-extrabold text-gray-900 pt-2 border-t-2 border-gray-800">
                    <span>TOTAL A PAGAR:</span>
                    <span>${totalToPay.toFixed(2)}</span>
                  </div>
                  {bcvRate > 0 && (
                    <div className="flex justify-between text-xs text-gray-500 pt-1">
                      <span>Equivalente en Bolívares:</span>
                      <span className="font-bold">Bs. {totalBs}</span>
                    </div>
                  )}
                  {bcvRate > 0 && (
                    <p className="text-[9px] text-gray-400 text-right">
                      Tasa oficial BCV: {bcvRate} Bs/€
                    </p>
                  )}
                </div>

                {/* Guest signature box for room charges or table confirmation */}
                <div className="pt-4 mt-2 border-t border-dashed border-gray-300 space-y-3">
                  <div className="text-[10px] text-gray-600 font-bold text-center">
                    {activeRoom ? `CARGO A CUENTA DE HABITACIÓN: ${activeRoom}` : 'FIRMA DE CONFORMIDAD DEL CLIENTE'}
                  </div>
                  <div className="pt-8 border-b border-gray-400"></div>
                  <div className="flex justify-between text-[9px] text-gray-400">
                    <span>Firma del Huésped / Room Signature</span>
                    <span>{activeRoom ? `Hab: ${activeRoom}` : 'Mesa: ' + preCuentaTable}</span>
                  </div>
                  {activeRoom && (
                    <p className="text-[8px] text-gray-400 text-center italic">
                      El consumo será cargado a su habitación para cancelar al check-out en recepción.
                    </p>
                  )}
                </div>

                {/* Ticket footer note */}
                <div className="text-center pt-4 border-t border-dashed border-gray-300 text-gray-400 text-[10px] space-y-1">
                  <p className="font-bold text-gray-600">¡Muchas gracias por su visita!</p>
                  <p>El 10% de servicio ha sido incluido en esta cuenta.</p>
                </div>
              </div>

              {/* Actions footer (Hidden when printing) */}
              <div className="p-5 border-t border-gray-100 bg-gray-50 flex items-center justify-between gap-3 print:hidden">
                <button
                  type="button"
                  onClick={() => setShowPreCuentaModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-200 transition-colors"
                >
                  Cerrar
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-[#3D2B1F] text-white hover:bg-black transition-all shadow-sm"
                  >
                    <Printer size={15} /> Imprimir Cuenta
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPreCuentaModal(false)
                      setActiveCheckoutTable(preCuentaTable)
                      setShowCheckout(true)
                    }}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-green-600 text-white hover:bg-green-700 transition-all shadow-sm"
                  >
                    <CheckCircle2 size={15} /> Proceder al Cobro
                  </button>
                </div>
              </div>

            </div>
          </div>
        )
      })()}

      {/* ── MODAL: REPORTE DE PROPINAS POR CAMARERO ── */}
      {showWaiterTipsModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl flex flex-col overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-amber-50/60">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#C5A059]/20 rounded-2xl text-[#C5A059]">
                  <Award size={24} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Propinas por Camarero</h2>
                  <p className="text-xs text-gray-500">10% de servicio acumulado por mesas cerradas en el Restaurante</p>
                </div>
              </div>
              <button
                onClick={() => setShowWaiterTipsModal(false)}
                className="p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-colors font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto max-h-[60vh] custom-scrollbar">
              {loadingTips ? (
                <div className="text-center py-12 text-gray-400 text-sm">Calculando propinas acumuladas...</div>
              ) : waiterTipsData.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm italic">
                  Aún no hay comandas cerradas con camarero asignado.
                </div>
              ) : (
                <div className="space-y-3">
                  {waiterTipsData.map((item, idx) => (
                    <div key={idx} className="bg-gray-50 rounded-2xl p-4 border border-gray-100 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-800 text-sm">🧑‍🍳 {item.waiter}</span>
                        </div>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          {item.ordersCount} {item.ordersCount === 1 ? 'mesa atendida' : 'mesas atendidas'} · Consumos: ${item.salesTotal.toFixed(2)}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-base font-extrabold text-emerald-700">
                          +${item.tipsTotal.toFixed(2)}
                        </span>
                        {bcvRate > 0 && (
                          <p className="text-[10px] text-gray-400">
                            ~Bs. {(item.tipsTotal * bcvRate).toFixed(2)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}

                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex justify-between items-center text-sm font-bold text-emerald-900 mt-4">
                    <span>Total Propinas Restaurante:</span>
                    <span className="text-lg font-extrabold text-emerald-700">
                      ${waiterTipsData.reduce((s, i) => s + i.tipsTotal, 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
              <button
                onClick={() => setShowWaiterTipsModal(false)}
                className="px-5 py-2.5 rounded-xl font-bold bg-[#3D2B1F] text-white hover:bg-black transition-colors text-sm"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ComandasPage
