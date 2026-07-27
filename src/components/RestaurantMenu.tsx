import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ChevronLeft, Wine, Clock, Users, 
  ShoppingBag, Plus, Minus, Receipt, FileText, CheckCircle2 
} from 'lucide-react'
import { getMenu } from '../utils/menuStore'
import { weeklyMenu } from '../data/weeklyMenu'
import { supabase } from '../lib/supabase'
import type { DishItem } from '../data/weeklyMenu'

const galleryPlatos = [
  { src: '/assets/restaurante/platos/ceviche.png',          label: 'Ceviche del Día' },
  { src: '/assets/restaurante/platos/bocado-1.png',         label: 'Bocado de Autor' },
  { src: '/assets/restaurante/platos/tartare-aguacate.png', label: 'Tartare de Atún' },
  { src: '/assets/restaurante/platos/pescado-grill.png',    label: 'Pescado a la Plancha' },
  { src: '/assets/restaurante/platos/ravioli.png',          label: 'Ravioli Artesanal' },
  { src: '/assets/restaurante/platos/ensalada.png',         label: 'Ensalada Fresca' },
  { src: '/assets/restaurante/platos/trucha-verduras.png',  label: 'Trucha del Páramo' },
  { src: '/assets/restaurante/platos/carne-papas.png',      label: 'Carne de Res' },
  { src: '/assets/restaurante/platos/milanesa.png',         label: 'Milanesa de la Casa' },
  { src: '/assets/restaurante/platos/sopa-cebolla.png',     label: 'Sopa Gratinada' },
  { src: '/assets/restaurante/platos/postre-fresas.png',    label: 'Fresas con Crema' },
  { src: '/assets/restaurante/platos/postre-crepe.png',     label: 'Crepe de Chocolate' },
]

interface CartItem {
  dish: DishItem
  quantity: number
  notes: string
}

const parsePrice = (priceStr?: string): number => {
  if (!priceStr) return 0;
  if (priceStr.toLowerCase().includes('incluido')) return 0;
  const num = parseFloat(priceStr.replace(/[^0-9.]/g, ''));
  return isNaN(num) ? 0 : num;
}

const RestaurantMenu: React.FC<{ 
  onBack: () => void; 
  onOpenCava: () => void;
  tableId?: string | null;
}> = ({ onBack, onOpenCava, tableId }) => {
  const [activeTab, setActiveTab] = useState('almuerzo')
  const [menu, setMenu] = useState(weeklyMenu)
  
  // Cart & Order state
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedTable, setSelectedTable] = useState<string>(() => {
    return tableId || localStorage.getItem('estancia_table_id') || 'Mesa 1'
  })

  useEffect(() => {
    if (tableId) {
      setSelectedTable(tableId)
      localStorage.setItem('estancia_table_id', tableId)
    }
  }, [tableId])

  const [isCartOpen, setIsCartOpen] = useState(false)
  const [tableOrders, setTableOrders] = useState<any[]>([])
  const [isBillOpen, setIsBillOpen] = useState(false)
  const [fetchingBill, setFetchingBill] = useState(false)
  const [placingOrder, setPlacingOrder] = useState(false)
  const [orderSuccess, setOrderSuccess] = useState(false)

  const fetchTableOrders = useCallback(async () => {
    if (!selectedTable) return

    // 1. Instant local read (0ms delay)
    try {
      const local = localStorage.getItem('estancia_comandas')
      if (local) {
        const parsed = JSON.parse(local)
        if (Array.isArray(parsed)) {
          const matching = parsed.filter(o => o.table_id === selectedTable && o.payment_status === 'pendiente')
          setTableOrders(matching)
        }
      }
    } catch (e) {}

    setFetchingBill(false)

    // 2. Sync from Supabase in background
    try {
      const { data, error } = await supabase
        .from('comandas')
        .select('*')
        .eq('table_id', selectedTable)
        .eq('payment_status', 'pendiente')
        .order('created_at', { ascending: false })
      
      if (!error && data) {
        setTableOrders(data)
      }
    } catch (e) {
      console.warn('Notice fetching table orders:', e)
    }
  }, [selectedTable])

  useEffect(() => { getMenu().then(setMenu) }, [])

  useEffect(() => {
    if (selectedTable) {
      fetchTableOrders()
      
      const pollInterval = setInterval(() => {
        fetchTableOrders()
      }, 4000)

      window.addEventListener('focus', fetchTableOrders)

      const channel = supabase
        .channel(`table_orders_${selectedTable}_global`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'comandas',
          filter: `table_id=eq.${selectedTable}`
        }, () => {
          fetchTableOrders()
        })
        .subscribe()
        
      return () => {
        clearInterval(pollInterval)
        window.removeEventListener('focus', fetchTableOrders)
        supabase.removeChannel(channel)
      }
    }
  }, [selectedTable, fetchTableOrders])

  const getItemQuantity = (dish: DishItem) => {
    const item = cart.find(i => i.dish.name === dish.name)
    return item ? item.quantity : 0
  }

  const updateQuantity = (dish: DishItem, q: number) => {
    if (q <= 0) {
      setCart(prev => prev.filter(i => i.dish.name !== dish.name))
    } else {
      setCart(prev => {
        const existing = prev.find(i => i.dish.name === dish.name)
        if (existing) {
          return prev.map(i => i.dish.name === dish.name ? { ...i, quantity: q } : i)
        } else {
          return [...prev, { dish, quantity: q, notes: '' }]
        }
      })
    }
  }

  const updateNotes = (dishName: string, notes: string) => {
    setCart(prev => prev.map(i => i.dish.name === dishName ? { ...i, notes } : i))
  }

  const handlePlaceOrder = async () => {
    const activeTable = selectedTable || 'Mesa 1'
    if (cart.length === 0) return
    setPlacingOrder(true)
    
    const totalAmount = cart.reduce((sum, item) => {
      const price = parsePrice(item.dish.price)
      return sum + (price * item.quantity)
    }, 0)
    
    const orderItems = cart.map(item => ({
      name: item.dish.name,
      price: item.dish.price || 'Incluido',
      quantity: item.quantity,
      notes: item.notes || null
    }))
    
    const localOrder = {
      id: 'cmd_' + Date.now(),
      table_id: activeTable,
      items: orderItems,
      total_amount: totalAmount,
      status: 'preparando',
      payment_status: 'pendiente',
      created_at: new Date().toISOString()
    }

    // 1. Instant local state update (Cart closes, order success shown immediately!)
    setTableOrders(prev => [localOrder, ...prev])
    setCart([])
    setIsCartOpen(false)
    setOrderSuccess(true)
    setTimeout(() => setOrderSuccess(false), 3500)
    setPlacingOrder(false)

    // Save to shared local storage & trigger live sync event
    try {
      const existing = localStorage.getItem('estancia_comandas')
      const parsed = existing ? JSON.parse(existing) : []
      const updated = [localOrder, ...parsed]
      localStorage.setItem('estancia_comandas', JSON.stringify(updated))
      window.dispatchEvent(new CustomEvent('comanda_created'))
    } catch (e) {}

    // 2. Background sync to Supabase with returned UUID
    try {
      const { data, error } = await supabase
        .from('comandas')
        .insert({
          table_id: activeTable,
          items: orderItems,
          total_amount: totalAmount,
          status: 'preparando',
          payment_status: 'pendiente'
        })
        .select()

      if (!error && data && data.length > 0) {
        const realOrder = data[0]
        setTableOrders(prev => prev.map(o => o.id === localOrder.id ? realOrder : o))
        try {
          const existing = localStorage.getItem('estancia_comandas')
          const parsed: any[] = existing ? JSON.parse(existing) : []
          const updated = parsed.map(o => o.id === localOrder.id ? realOrder : o)
          localStorage.setItem('estancia_comandas', JSON.stringify(updated))
          window.dispatchEvent(new CustomEvent('comanda_created'))
        } catch (e) {}
      } else if (error) {
        console.warn('Supabase insert notice:', error.message)
      }
    } catch (err) {
      console.warn('Supabase guest order insert notice:', err)
    }
  }

  const activeSection = menu.find(s => s.id === activeTab) ?? menu[0]


  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen bg-brand-neutral text-brand-primary font-sans pb-32"
    >
      <div className="bg-[#3D2B1F] text-white px-4 py-2.5 flex items-center justify-between text-xs font-bold shadow-md sticky top-0 z-50 border-b border-[#C5A059]/30">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-gray-300 text-[11px] uppercase tracking-wider">Ordenando para:</span>
        </div>
        <select
          value={selectedTable}
          onChange={e => {
            setSelectedTable(e.target.value)
            localStorage.setItem('estancia_table_id', e.target.value)
          }}
          className="bg-[#C5A059] text-white font-bold rounded-lg px-3 py-1 text-xs focus:outline-none cursor-pointer"
        >
          <option value="Mesa 1">Mesa 1</option>
          <option value="Mesa 2">Mesa 2</option>
          <option value="Mesa 3">Mesa 3</option>
          <option value="Mesa 4">Mesa 4</option>
          <option value="Mesa 5">Mesa 5</option>
          <option value="Mesa 6">Mesa 6</option>
          <option value="Cabaña La Lomita">Cabaña La Lomita</option>
          <option value="Cabaña Mitibibó">Cabaña Mitibibó</option>
          <option value="Cabaña La Manita">Cabaña La Manita</option>
          <option value="Suite La Vega">Suite La Vega</option>
          <option value="Habitación Llano Grande">Habitación Llano Grande</option>
        </select>
      </div>

      {/* ── HERO ── */}
      <div className="relative h-[55vh] w-full overflow-hidden">
        <img
          src="/assets/restaurante/hero.jpg"
          alt="Restaurante La Cañada"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/20" />

        <button
          onClick={onBack}
          className="absolute top-6 left-6 z-20 p-2 bg-black/30 backdrop-blur-md rounded-full border border-white/20 text-white"
        >
          <ChevronLeft size={20} />
        </button>

        <div className="absolute bottom-0 left-0 w-full p-7">
          <motion.div initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }}>
            <span className="text-brand-accent text-[10px] uppercase tracking-[0.45em] font-bold block mb-2">
              Cocina de La Cañada
            </span>
            <h1 className="text-white text-4xl font-serif leading-tight mb-2">
              Gastronomía<br />de Origen
            </h1>
            <p className="text-white/70 text-xs leading-relaxed max-w-[260px]">
              Productos locales, fuego de leña y recetas que celebran el territorio andino.
            </p>
          </motion.div>
        </div>
      </div>

      {/* ── VIDEO COCINA ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="px-5 mt-5"
      >
        <div className="rounded-2xl overflow-hidden" style={{ aspectRatio: '16/9' }}>
          <video
            src="/assets/restaurante/video-cocina.mov"
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover"
          />
        </div>
      </motion.div>

      {/* ── AMBIENTE — chefs + interior ── */}
      <section className="px-5 mt-8">
        <div className="mb-4">
          <span className="text-brand-terracotta text-[10px] uppercase tracking-[0.4em] font-bold block mb-1">Nuestra Cocina</span>
          <h2 className="text-2xl font-serif text-brand-primary">El arte en el plato</h2>
        </div>

        {/* 2 verticales lado a lado */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          {[
            { src: '/assets/restaurante/chef-1.png',  caption: 'Arepas artesanales' },
            { src: '/assets/restaurante/chef-2.png',  caption: 'Horneados del día' },
          ].map((img, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: i * 0.1 }}
              className="relative rounded-2xl overflow-hidden"
              style={{ aspectRatio: '3/4' }}
            >
              <img src={img.src} alt={img.caption} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
              <span className="absolute bottom-3 left-3 text-white text-[10px] font-bold tracking-wide">
                {img.caption}
              </span>
            </motion.div>
          ))}
        </div>

        {/* Interior de noche — full width */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative rounded-2xl overflow-hidden"
          style={{ height: 200 }}
        >
          <img src="/assets/restaurante/interior-noche.png" alt="Restaurante de noche" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
          <div className="absolute bottom-4 left-5 right-5 flex justify-between items-end">
            <span className="text-white text-sm font-serif italic">Un ambiente para recordar</span>
          </div>
        </motion.div>
      </section>

      {/* ── GALERÍA DE PLATOS ── */}
      <section className="px-5 mt-12">
        <div className="mb-6">
          <span className="text-brand-terracotta text-[10px] uppercase tracking-[0.4em] font-bold block mb-1">Nuestros Platos</span>
          <h2 className="text-2xl font-serif text-brand-primary">Lo que llega a tu mesa</h2>
          <p className="text-brand-primary/50 text-xs mt-1">Elaborados con productos frescos de la región andina.</p>
        </div>

        {/* Grid mixto */}
        <div className="flex flex-col gap-3">
          {/* Full width — primer plato destacado */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }} whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative rounded-2xl overflow-hidden"
            style={{ height: 240 }}
          >
            <img src={galleryPlatos[0].src} alt={galleryPlatos[0].label} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
            <span className="absolute bottom-4 left-4 text-white font-serif text-lg">{galleryPlatos[0].label}</span>
            <span className="absolute top-4 right-4 bg-brand-accent/90 text-white text-[9px] uppercase tracking-widest font-bold px-3 py-1.5 rounded-full">
              Entrada
            </span>
          </motion.div>

          {/* Fila de 2 */}
          <div className="grid grid-cols-2 gap-3">
            {galleryPlatos.slice(1, 3).map((p, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                className="relative rounded-2xl overflow-hidden"
                style={{ height: 160 }}
              >
                <img src={p.src} alt={p.label} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
                <span className="absolute bottom-2 left-2 right-2 text-white text-[11px] font-bold leading-tight">{p.label}</span>
              </motion.div>
            ))}
          </div>

          {/* Full width — principal destacado */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }} whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative rounded-2xl overflow-hidden"
            style={{ height: 220 }}
          >
            <img src={galleryPlatos[3].src} alt={galleryPlatos[3].label} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            <div className="absolute bottom-4 left-4">
              <span className="text-brand-accent text-[9px] uppercase tracking-widest font-bold block mb-1">Principal</span>
              <span className="text-white font-serif text-lg">{galleryPlatos[3].label}</span>
            </div>
          </motion.div>

          {/* Fila de 2 */}
          <div className="grid grid-cols-2 gap-3">
            {galleryPlatos.slice(4, 6).map((p, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                className="relative rounded-2xl overflow-hidden"
                style={{ height: 160 }}
              >
                <img src={p.src} alt={p.label} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
                <span className="absolute bottom-2 left-2 right-2 text-white text-[11px] font-bold leading-tight">{p.label}</span>
              </motion.div>
            ))}
          </div>

          {/* Fila de 3 pequeñas */}
          <div className="grid grid-cols-3 gap-2">
            {galleryPlatos.slice(6, 9).map((p, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.07 }}
                className="relative rounded-xl overflow-hidden"
                style={{ height: 120 }}
              >
                <img src={p.src} alt={p.label} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <span className="absolute bottom-1.5 left-1.5 right-1.5 text-white text-[9px] font-bold leading-tight">{p.label}</span>
              </motion.div>
            ))}
          </div>

          {/* Full width — postre destacado */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }} whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative rounded-2xl overflow-hidden bg-brand-wood"
            style={{ height: 200 }}
          >
            <img src={galleryPlatos[11].src} alt={galleryPlatos[11].label} className="w-full h-full object-cover opacity-90" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
            <div className="absolute bottom-4 left-4">
              <span className="text-brand-accent text-[9px] uppercase tracking-widest font-bold block mb-1">Postre</span>
              <span className="text-white font-serif text-lg">{galleryPlatos[11].label}</span>
            </div>
          </motion.div>

          {/* Última fila de 2 — postres */}
          <div className="grid grid-cols-2 gap-3">
            {galleryPlatos.slice(9, 11).map((p, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                className="relative rounded-2xl overflow-hidden"
                style={{ height: 150 }}
              >
                <img src={p.src} alt={p.label} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
                <span className="absolute bottom-2 left-2 right-2 text-white text-[11px] font-bold leading-tight">{p.label}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── MENÚ DE LA SEMANA ── */}
      <section className="px-5 mt-14">
        <div className="mb-6">
          <span className="text-brand-terracotta text-[10px] uppercase tracking-[0.4em] font-bold block mb-1">Actualizado semanalmente</span>
          <h2 className="text-2xl font-serif text-brand-primary">Menú de la Semana</h2>
        </div>

        {/* Tabs */}
        <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-brand-primary/5 mb-6">
          {menu.map(section => (
            <button
              key={section.id}
              onClick={() => setActiveTab(section.id)}
              className={`flex-1 py-2.5 rounded-xl text-[10px] uppercase tracking-widest font-bold transition-all ${
                activeTab === section.id
                  ? 'bg-brand-wood text-white shadow-lg'
                  : 'text-brand-primary/50 hover:text-brand-primary'
              }`}
            >
              {section.emoji} {section.label}
            </button>
          ))}
        </div>

        {/* Included notice */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {activeSection.included && (
              <div className="flex items-center gap-2 mb-5 bg-brand-olive/10 border border-brand-olive/20 rounded-xl px-4 py-2.5">
                <span className="text-brand-olive text-xs">✓</span>
                <span className="text-brand-olive text-xs font-bold">{activeSection.included}</span>
              </div>
            )}

            {/* Dish list */}
            <div className="flex flex-col gap-4">
              {activeSection.items.map((dish, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="bg-white rounded-2xl overflow-hidden shadow-sm border border-brand-primary/5 flex"
                >
                  {/* Foto del plato si existe */}
                  {dish.image && (
                    <div className="w-24 flex-none overflow-hidden">
                      <img
                        src={dish.image!.startsWith('data:') ? dish.image! : `/assets/restaurante/${dish.image}`}
                        alt={dish.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className={`flex flex-col justify-center p-4 flex-1 ${!dish.image ? 'border-l-4 border-brand-accent' : ''}`}>
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="text-sm font-serif text-brand-wood leading-tight">{dish.name}</h3>
                      {dish.price && (
                        <span className={`text-xs font-bold whitespace-nowrap flex-none ${dish.price === 'Incluido' ? 'text-brand-olive' : 'text-brand-accent'}`}>
                          {dish.price}
                        </span>
                      )}
                    </div>
                    {dish.description && (
                      <p className="text-brand-primary/55 text-[11px] leading-relaxed whitespace-pre-line">{dish.description}</p>
                    )}
                    {dish.tag && (
                      <span className="mt-2 self-start text-[9px] uppercase tracking-widest border border-brand-olive/30 text-brand-olive px-2 py-0.5 rounded-full font-bold">
                        {dish.tag}
                      </span>
                    )}

                    {tableId && (
                      <div className="mt-3 flex items-center justify-end gap-2 border-t border-brand-primary/5 pt-3">
                        {getItemQuantity(dish) > 0 ? (
                          <div className="flex items-center bg-brand-wood text-white rounded-xl overflow-hidden shadow-sm">
                            <button
                              onClick={() => updateQuantity(dish, getItemQuantity(dish) - 1)}
                              className="px-3 py-1.5 hover:bg-brand-wood/80 transition-colors text-xs font-bold"
                            >
                              -
                            </button>
                            <span className="px-2.5 text-xs font-bold">{getItemQuantity(dish)}</span>
                            <button
                              onClick={() => updateQuantity(dish, getItemQuantity(dish) + 1)}
                              className="px-3 py-1.5 hover:bg-brand-wood/80 transition-colors text-xs font-bold"
                            >
                              +
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => updateQuantity(dish, 1)}
                            className="px-3 py-1.5 bg-[#C5A059] text-white text-[10px] font-bold rounded-xl uppercase tracking-wider hover:bg-[#b8904a] active:scale-95 transition-all shadow-sm"
                          >
                            Agregar al Pedido
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Horario e info */}
        <div className="mt-8 grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl p-4 border border-brand-primary/5 shadow-sm flex items-center gap-3">
            <Clock size={18} className="text-brand-accent flex-none" />
            <div>
              <p className="text-[9px] uppercase tracking-widest text-brand-primary/40 font-bold mb-0.5">Horario</p>
              <p className="text-xs font-bold text-brand-wood">7am · 12pm · 7pm</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-brand-primary/5 shadow-sm flex items-center gap-3">
            <Users size={18} className="text-brand-accent flex-none" />
            <div>
              <p className="text-[9px] uppercase tracking-widest text-brand-primary/40 font-bold mb-0.5">Reservas</p>
              <p className="text-xs font-bold text-brand-wood">Recepción</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CAVA VIRTUAL CTA ── */}
      <section className="px-5 mt-12">
        <motion.div
          initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          onClick={onOpenCava}
          className="relative h-[220px] rounded-3xl overflow-hidden cursor-pointer group"
        >
          <img
            src="/assets/restaurante/mesa-elegante.png"
            alt="Cava Virtual"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-brand-wood/85 via-brand-wood/40 to-transparent" />
          <div className="absolute inset-0 flex flex-col items-center justify-end pb-7 text-center px-6">
            <Wine className="text-brand-accent mb-3" size={32} />
            <h3 className="text-white text-2xl font-serif mb-1">Cava Virtual</h3>
            <p className="text-white/60 text-xs mb-4">Etiquetas seleccionadas por nuestro sommelier</p>
            <div className="flex items-center gap-1.5 text-brand-accent text-[10px] uppercase tracking-[0.3em] font-bold">
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── FLOATING CART & BILL BAR ── */}
      {tableId && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-full max-w-[390px] px-4">
          <div className="bg-brand-wood/95 backdrop-blur-md rounded-2xl p-3 flex gap-3 shadow-2xl border border-white/10 text-white">
            <button
              onClick={() => setIsBillOpen(true)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-white/20 hover:bg-white/5 active:scale-95 transition-all text-[10px] font-bold uppercase tracking-wider text-white"
            >
              <Receipt size={14} className="text-[#C5A059]" />
              Ver Cuenta {tableOrders.length > 0 && `(${tableOrders.length})`}
            </button>
            
            <button
              onClick={() => cart.length > 0 && setIsCartOpen(true)}
              disabled={cart.length === 0}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#C5A059] hover:bg-[#b8904a] active:scale-95 transition-all text-[10px] font-bold uppercase tracking-wider text-white disabled:opacity-40 disabled:pointer-events-none"
            >
              <ShoppingBag size={14} />
              Pedir ({cart.reduce((sum, i) => sum + i.quantity, 0)})
            </button>
          </div>
        </div>
      )}

      {/* ── CART DRAWER ── */}
      <AnimatePresence>
        {isCartOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCartOpen(false)}
              className="fixed inset-0 bg-black z-[110]"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 max-w-[430px] mx-auto bg-brand-neutral rounded-t-[2rem] border-t border-brand-primary/10 z-[120] px-6 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl flex flex-col max-h-[80dvh]"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-brand-primary/5 mb-4 flex-none">
                <div>
                  <h3 className="text-lg font-serif text-brand-wood">Tu Pedido</h3>
                  <p className="text-[10px] uppercase tracking-widest text-brand-primary/40 font-bold">{tableId}</p>
                </div>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="w-8 h-8 rounded-full bg-brand-primary/5 flex items-center justify-center text-brand-primary/60 hover:bg-brand-primary/10 font-sans font-bold"
                >
                  ✕
                </button>
              </div>

              {/* Items List */}
              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-1 pb-4">
                {cart.map((item, index) => (
                  <div key={index} className="bg-white rounded-2xl p-4 border border-brand-primary/5 shadow-sm space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-bold text-brand-wood truncate">{item.dish.name}</h4>
                        <p className="text-xs text-[#C5A059] font-semibold mt-0.5">
                          {item.dish.price === 'Incluido' || !item.dish.price ? 'Incluido en plan' : item.dish.price}
                        </p>
                      </div>
                      
                      {/* Quantity control */}
                      <div className="flex items-center bg-brand-primary/5 rounded-xl overflow-hidden flex-none">
                        <button
                          onClick={() => updateQuantity(item.dish, item.quantity - 1)}
                          className="px-2.5 py-1 text-brand-primary/75 hover:bg-brand-primary/10 transition-colors"
                        >
                          <Minus size={10} />
                        </button>
                        <span className="px-2 text-xs font-bold text-brand-primary">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.dish, item.quantity + 1)}
                          className="px-2.5 py-1 text-brand-primary/75 hover:bg-brand-primary/10 transition-colors"
                        >
                          <Plus size={10} />
                        </button>
                      </div>
                    </div>

                    {/* Notes field */}
                    <div>
                      <input
                        type="text"
                        placeholder="Nota especial (ej: sin cebolla, hielo...)"
                        value={item.notes}
                        onChange={e => updateNotes(item.dish.name, e.target.value)}
                        className="w-full bg-brand-neutral border border-brand-primary/5 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#C5A059] text-brand-primary"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Summary and button */}
              <div className="pt-4 border-t border-brand-primary/5 mt-auto flex-none space-y-4 bg-brand-neutral">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-brand-primary/60">Total Estimado</span>
                  <span className="font-bold text-brand-wood text-lg">
                    ${cart.reduce((sum, item) => sum + (parsePrice(item.dish.price) * item.quantity), 0)}
                  </span>
                </div>

                <button
                  onClick={handlePlaceOrder}
                  disabled={placingOrder}
                  className="w-full py-3.5 bg-brand-terracotta text-white rounded-xl font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-brand-terracotta/90 active:scale-95 transition-all shadow-lg disabled:opacity-50"
                >
                  {placingOrder ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <FileText size={14} />
                      Enviar a Cocina
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── BILL DRAWER ── */}
      <AnimatePresence>
        {isBillOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsBillOpen(false)}
              className="fixed inset-0 bg-black z-[110]"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 max-w-[430px] mx-auto bg-brand-neutral rounded-t-[2rem] border-t border-brand-primary/10 z-[120] px-6 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl flex flex-col max-h-[80dvh]"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-brand-primary/5 mb-4 flex-none">
                <div>
                  <h3 className="text-lg font-serif text-brand-wood">Cuenta de la Mesa</h3>
                  <p className="text-[10px] uppercase tracking-widest text-brand-primary/40 font-bold">{selectedTable}</p>
                </div>
                <button
                  onClick={() => setIsBillOpen(false)}
                  className="w-8 h-8 rounded-full bg-brand-primary/5 flex items-center justify-center text-brand-primary/60 hover:bg-brand-primary/10 font-sans font-bold"
                >
                  ✕
                </button>
              </div>

              {/* Orders List */}
              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-1 pb-4">
                {fetchingBill ? (
                  <div className="text-center py-8 text-brand-primary/40 text-xs">Cargando detalles de cuenta...</div>
                ) : tableOrders.length === 0 ? (
                  <div className="text-center py-8 text-brand-primary/40 text-xs">Aún no hay comandas activas para esta mesa.</div>
                ) : (
                  tableOrders.map((order, oIdx) => (
                    <div key={order.id} className="bg-white rounded-2xl p-4 border border-brand-primary/5 shadow-sm space-y-3">
                      <div className="flex items-center justify-between border-b border-brand-primary/5 pb-2">
                        <span className="text-[10px] text-brand-primary/40 font-bold uppercase tracking-wider">
                          Pedido #{tableOrders.length - oIdx} ({new Date(order.created_at).toLocaleTimeString('es-VE', {hour: '2-digit', minute: '2-digit'})})
                        </span>
                        
                        {/* Status Badge */}
                        <span className={`text-[9px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full ${
                          order.status === 'preparando' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                          order.status === 'listo' ? 'bg-green-500 text-white animate-pulse' :
                          'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}>
                          {order.status === 'preparando' ? 'En Cocina' :
                           order.status === 'listo' ? 'Listo' : 'Servido'}
                        </span>
                      </div>

                      {/* Items */}
                      <div className="space-y-1.5">
                        {order.items?.map((item: any, iIdx: number) => (
                          <div key={iIdx} className="flex justify-between items-start text-xs">
                            <div className="min-w-0 pr-2">
                              <span className="font-bold text-brand-wood">{item.quantity}x</span>{' '}
                              <span className="text-brand-primary/75">{item.name}</span>
                              {item.notes && (
                                <p className="text-[9px] text-brand-primary/40 italic mt-0.5">Nota: {item.notes}</p>
                              )}
                            </div>
                            <span className="font-semibold text-brand-primary/70">{item.price === 'Incluido' ? 'Incluido' : item.price}</span>
                          </div>
                        ))}
                      </div>

                      <div className="flex justify-between items-center pt-2 border-t border-brand-primary/5 text-xs font-bold text-brand-wood">
                        <span>Subtotal comanda</span>
                        <span>${order.total_amount}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Total and actions */}
              {tableOrders.length > 0 && (
                <div className="pt-4 border-t border-brand-primary/5 mt-auto flex-none space-y-4 bg-brand-neutral">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-brand-primary/60 font-bold">Total Acumulado</span>
                    <span className="font-extrabold text-[#C5A059] text-xl">
                      ${tableOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0)}
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      alert(`Cuenta Solicitada\n\nEl mesero se acercará a la mesa ${selectedTable} en breve con tu cuenta física. ¡Gracias por preferir Estancia La Cañada!`);
                      setIsBillOpen(false);
                    }}
                    className="w-full py-3.5 bg-brand-wood text-white rounded-xl font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-brand-wood/90 active:scale-95 transition-all shadow-lg"
                  >
                    <Receipt size={14} />
                    Pedir Cuenta Física
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── SUCCESS POPUP ── */}
      <AnimatePresence>
        {orderSuccess && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-6 pointer-events-none"
          >
            <div className="bg-brand-wood text-white border border-brand-accent/20 rounded-2xl p-6 shadow-2xl flex flex-col items-center gap-3 max-w-[280px] text-center">
              <CheckCircle2 size={40} className="text-green-400" />
              <div>
                <h4 className="font-serif text-sm font-bold text-white mb-1">¡Pedido Enviado!</h4>
                <p className="text-[10px] text-white/60 leading-relaxed">Tu pedido ha sido recibido en cocina y ya comenzó su preparación.</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default RestaurantMenu
