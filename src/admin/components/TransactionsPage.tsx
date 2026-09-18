import React, { useState, useMemo, useEffect } from 'react'
import { Plus, Search, X, Check, CalendarDays, ChevronDown, Loader2, Receipt, Building2, ArrowUpDown, ArrowUp, ArrowDown, Filter, RotateCcw, Calculator, Tag, Pencil, Trash2 } from 'lucide-react'
import { categoryLabels, categoryColors } from '../data/mockData'
import LoadErrorBanner from './LoadErrorBanner'
import { getBcvUsdRate, getParallelUsdRate } from '../../utils/exchangeRate'

/** Cuantos movimientos se traen de una vez. Al superarlo se avisa en pantalla en vez
 *  de recortar en silencio, que era lo que hacia antes. */
const TOPE_MOVIMIENTOS = 500
import type { Transaction, TransactionType, TransactionCategory, PaymentMethod, Employee } from '../types'
import { supabase } from '../../lib/supabase'
import ReceiptModal from './ReceiptModal'
import { parseLocalDate, fechaLocalISO } from '../../utils/dateUtils'
import { useAuth } from '../context/AuthContext'

const DEFAULT_SUPPLIERS = [
  'Corpoelec',
  'Cantv',
  'Gas Comunal',
  'Carnicería Los Llanos',
  'Distribuidora de Alimentos',
  'Frutería y Verdulería',
  'Ferretería Central',
  'Supermercado',
  'Distribuidora de Licores',
  'Hielo Cristal',
  'Farmacia',
  'Empresa de Fumigación'
]

const DEFAULT_CATEGORY_DESCRIPTIONS: Record<string, string[]> = {
  empleados: [
    'Pago de nómina quincenal',
    'Pago de personal eventual',
    'Anticipo de sueldo',
    'Bono de transporte / alimentación',
    'Pago de horas extras',
    'Pago de propinas acumuladas'
  ],
  alimentos: [
    'Compra de víveres y abarrotes',
    'Compra de carnes y embutidos',
    'Compra de frutas y verduras',
    'Compra de quesos y lácteos',
    'Compra de refrescos y bebidas',
    'Compra de licores y cerveza',
    'Compra de panadería y dulces',
    'Compra de bolsas de hielo'
  ],
  mantenimiento: [
    'Reparación de plomería y tuberías',
    'Mantenimiento de bomba de agua',
    'Mantenimiento de aires acondicionados',
    'Material eléctrico y bombillos',
    'Pintura y materiales de refacción',
    'Mantenimiento de piscina y químicos',
    'Jardinería y áreas verdes',
    'Reparación de equipos de cocina'
  ],
  servicios: [
    'Pago de electricidad (Corpoelec)',
    'Pago de internet y telefonía (Cantv)',
    'Recarga de bombonas de gas',
    'Servicio de cisterna de agua',
    'Aseo urbano y recolección de basura'
  ],
  comisiones: [
    'Comisiones bancarias y puntos de venta',
    'Comisión de reservas online'
  ],
  otros_egresos: [
    'Productos de limpieza y desinfección',
    'Artículos de papelería y oficina',
    'Combustible / Gasolina para planta o vehículo',
    'Gastos menores de caja chica',
    'Fletes y traslados'
  ],
  alojamiento: ['Reserva de habitación', 'Alojamiento estancia completa'],
  restaurante: ['Consumo de restaurante', 'Cena especial'],
  bebidas: ['Consumo de bar y bebidas'],
  almuerzos: ['Almuerzos del día'],
  pasapalos: ['Servicio de pasapalos'],
  excursiones: ['Paseo a caballo / excursión'],
  bar_cava: ['Servicio de bar y cava'],
  otros_ingresos: ['Ingreso varios', 'Abono'],
  propinas: ['Propina de cliente']
}

const STORAGE_SUPPLIERS_KEY = 'estancia_saved_suppliers'
const STORAGE_DESCRIPTIONS_KEY = 'estancia_saved_descriptions'

function getLocalSavedSuppliers(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_SUPPLIERS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function getLocalSavedDescriptions(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_DESCRIPTIONS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function evaluateSimpleMath(expr: string): number | null {
  try {
    const clean = expr.replace(/,/g, '.').replace(/[^0-9+\-*/.()]/g, '')
    if (!clean || /[+\-*/.]$/.test(clean)) return null
    // eslint-disable-next-line no-new-func
    const fn = new Function(`return (${clean});`)
    const val = fn()
    if (typeof val === 'number' && !isNaN(val) && isFinite(val)) {
      return Number(val.toFixed(2))
    }
    return null
  } catch {
    return null
  }
}

interface Props {
  typeFilter?: TransactionType
}

type DatePeriod = 'hoy' | 'semana' | 'mes' | 'año' | 'personalizado' | 'todo'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

const incomeCategories: TransactionCategory[] = ['alojamiento', 'restaurante', 'bebidas', 'almuerzos', 'pasapalos', 'excursiones', 'bar_cava', 'otros_ingresos', 'propinas']
const expenseCategories: TransactionCategory[] = ['empleados', 'alimentos', 'mantenimiento', 'servicios', 'comisiones', 'otros_egresos']
const paymentMethods: PaymentMethod[] = ['efectivo', 'transferencia', 'tarjeta', 'cheque']

const periodLabels: Record<DatePeriod, string> = {
  hoy: 'Hoy',
  semana: 'Semana',
  mes: 'Mes',
  año: 'Año',
  personalizado: 'Personalizado',
  todo: 'Todo',
}

interface DbTransaction {
  id: string
  date: string
  type: string
  category: string
  description: string
  amount: number | string
  payment_method: string
  related_to?: string | null
  exchange_rate?: number | string | null
  amount_bs?: number | string | null
  cash_box?: string | null
}

const mapDbTransactionToReact = (db: DbTransaction): Transaction => ({
  id: db.id,
  date: db.date,
  type: db.type as TransactionType,
  category: db.category as TransactionCategory,
  description: db.description,
  amount: Number(db.amount) || 0,
  paymentMethod: db.payment_method as PaymentMethod,
  relatedTo: db.related_to || '',
  exchangeRate: db.exchange_rate == null ? null : Number(db.exchange_rate),
  amountBs: db.amount_bs == null ? null : Number(db.amount_bs),
  cashBox: (db.cash_box as 'usd' | 'bs' | null) ?? null,
})

function getDateRange(period: DatePeriod, customFrom: string, customTo: string): { from: Date | null; to: Date | null } {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  switch (period) {
    case 'hoy':
      return { from: today, to: today }
    case 'semana': {
      const from = new Date(today)
      from.setDate(today.getDate() - 6)
      return { from, to: today }
    }
    case 'mes':
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: today }
    case 'año':
      return { from: new Date(now.getFullYear(), 0, 1), to: today }
    case 'personalizado':
      return {
        from: customFrom ? new Date(customFrom) : null,
        to: customTo ? new Date(customTo) : null,
      }
    default:
      return { from: null, to: null }
  }
}

/** "Bs. 15.000,00 a 942,53 Bs/$" — como se enseña un movimiento pagado en bolivares. */
const textoDeLaTasa = (amountBs?: number | null, rate?: number | null) => {
  if (!amountBs || !rate || amountBs <= 0 || rate <= 0) return null
  const bs = amountBs.toLocaleString('es-VE', { maximumFractionDigits: 2 })
  const tasa = rate.toLocaleString('es-VE', { maximumFractionDigits: 2 })
  return `Bs. ${bs} a ${tasa} Bs/$`
}

const PAGE_SIZE = 25

const TransactionsPage: React.FC<Props> = ({ typeFilter }) => {
  const { role } = useAuth()

  // Quien atiende el hotel registra los ingresos, pero la propiedad no quiere que vea lo
  // que factura la casa. Se le deja el dia en curso —para que compruebe lo que acaba de
  // anotar y detecte un error suyo— y se le quitan el selector de periodo y el total.
  const soloElDia = typeFilter === 'ingreso' && role === 'administracion'

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [hayMas, setHayMas] = useState(false)
  const [viewReceipt, setViewReceipt] = useState<{emp: Employee, amountUsd: number, period: string, bcvRate: number} | null>(null)
  const [search, setSearch] = useState('')

  const [categoryF, setCategoryF] = useState<TransactionCategory | 'todas'>('todas')
  const [supplierF, setSupplierF] = useState<string>('todos')
  const [showSupplierFilterMenu, setShowSupplierFilterMenu] = useState(false)
  const [sortField, setSortField] = useState<'date' | 'description' | 'category' | 'relatedTo' | 'amount'>('date')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [period, setPeriod] = useState<DatePeriod>('mes')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  // El periodo que se consulta de verdad. Con `soloElDia` no hay selector en pantalla,
  // asi que no puede depender de lo que quede en `period`.
  const periodoEfectivo: DatePeriod = soloElDia ? 'hoy' : period
  const [showModal, setShowModal] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showCategoryMenu, setShowCategoryMenu] = useState(false)
  const [page, setPage] = useState(1)

  const [form, setForm] = useState<Omit<Transaction, 'id'>>(() => ({
    date: fechaLocalISO(),
    type: typeFilter ?? 'ingreso',
    category: typeFilter === 'egreso' ? 'empleados' : 'alojamiento',
    description: '',
    amount: 0,
    paymentMethod: 'transferencia',
    relatedTo: '',
  }))

  const handleSort = (field: 'date' | 'description' | 'category' | 'relatedTo' | 'amount') => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection(field === 'date' || field === 'amount' ? 'desc' : 'asc')
    }
    setPage(1)
  }

  const [suppliers, setSuppliers] = useState<string[]>([])
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false)
  const [savedDescriptions, setSavedDescriptions] = useState<string[]>([])
  const [showDescDropdown, setShowDescDropdown] = useState(false)

  // Edición y borrado de movimientos
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Conversor Bs a Euro / Dólar y Calculadora
  const [showCalculator, setShowCalculator] = useState(false)
  const [calcTab, setCalcTab] = useState<'bcv' | 'math'>('bcv')
  const [amountBs, setAmountBs] = useState('')
  // La tasa la escribe quien hizo el cambio. Las del BCV y la paralela solo se enseñan
  // como referencia, para tocarlas de un golpe cuando coincida.
  //
  // Antes habia un selector EUR/USD: al elegir euro el resultado eran EUROS, y se
  // guardaba en un campo que toda la app lee como DOLARES. Segun el boton que se tocara,
  // el mismo gasto quedaba apuntado por una cifra distinta.
  const [exchangeRate, setExchangeRate] = useState(0)
  const [bcvUsd, setBcvUsd] = useState(0)
  const [paraleloUsd, setParaleloUsd] = useState(0)
  const [mathExpression, setMathExpression] = useState('')

  // Lista de distribuidores/proveedores con conteo de movimientos para el menú de filtro
  const availableDistributors = useMemo(() => {
    const counts = new Map<string, number>()
    transactions.forEach(t => {
      const name = t.relatedTo?.trim()
      if (name) {
        counts.set(name, (counts.get(name) || 0) + 1)
      }
    })
    suppliers.forEach(s => {
      if (s && !counts.has(s)) counts.set(s, 0)
    })
    return Array.from(counts.entries())
      .sort(([aName, aCount], [bName, bCount]) => {
        if (bCount !== aCount) return bCount - aCount
        return aName.localeCompare(bName, 'es')
      })
  }, [transactions, suppliers])

  const hasActiveFilters = categoryF !== 'todas' || supplierF !== 'todos' || search.trim() !== ''
  const resetAllFilters = () => {
    setCategoryF('todas')
    setSupplierF('todos')
    setSearch('')
    setPage(1)
  }

  useEffect(() => {
    let active = true

    const fetchTransactions = async () => {
      setLoading(true)

      // Calcular rango de fechas para filtro server-side
      const { from: dateFrom, to: dateTo } = getDateRange(periodoEfectivo, customFrom, customTo)
      
      let query = supabase
        .from('transactions')
        .select('id, date, type, category, description, amount, payment_method, related_to, exchange_rate, amount_bs, cash_box')
        .order('date', { ascending: false })
      
      // Aplicar filtros de fecha server-side (solo si hay rango definido)
      if (dateFrom) {
        query = query.gte('date', fechaLocalISO(dateFrom))
      }
      if (dateTo) {
        const toDate = new Date(dateTo)
        toDate.setDate(toDate.getDate() + 1)
        query = query.lt('date', fechaLocalISO(toDate))
      }
      
      // Se pide una fila mas que el tope: si vuelve, es que el periodo tiene mas
      // movimientos de los que caben y hay que decirlo. Antes se cortaba en 500 sin
      // avisar, y los mas antiguos desaparecian de la pantalla en silencio.
      query = query.limit(TOPE_MOVIMIENTOS + 1)

      const { data, error } = await query

      if (!active) return

      if (error) {
        // Nunca rellenar con datos de demostracion: se avisa y se deja vacio.
        console.error('Error fetching transactions:', error)
        setLoadError(error.message)
      } else {
        setLoadError(null)
        const filas = data || []
        setHayMas(filas.length > TOPE_MOVIMIENTOS)
        setTransactions(filas.slice(0, TOPE_MOVIMIENTOS).map(mapDbTransactionToReact))
      }
      setLoading(false)
    }

    fetchTransactions()

    return () => {
      active = false
    }
  }, [periodoEfectivo, customFrom, customTo])

  // Filtrado y ordenamiento multi-criterio: fecha, descripción, categoría y distribuidor
  const filtered = useMemo(() => {
    const list = transactions.filter(t => {
      const matchType = typeFilter ? t.type === typeFilter : true
      const matchSearch =
        !search.trim() ||
        t.description.toLowerCase().includes(search.toLowerCase()) ||
        (t.relatedTo ?? '').toLowerCase().includes(search.toLowerCase())
      const matchCat = categoryF === 'todas' || t.category === categoryF
      const matchSupplier =
        supplierF === 'todos'
          ? true
          : (t.relatedTo ?? '').trim().toLowerCase() === supplierF.trim().toLowerCase()

      return matchType && matchSearch && matchCat && matchSupplier
    })

    return list.sort((a, b) => {
      let cmp = 0
      if (sortField === 'date') {
        cmp = new Date(a.date).getTime() - new Date(b.date).getTime()
      } else if (sortField === 'description') {
        cmp = a.description.localeCompare(b.description, 'es')
      } else if (sortField === 'category') {
        cmp = (categoryLabels[a.category] || a.category).localeCompare(categoryLabels[b.category] || b.category, 'es')
      } else if (sortField === 'relatedTo') {
        cmp = (a.relatedTo || '').localeCompare(b.relatedTo || '', 'es')
      } else if (sortField === 'amount') {
        cmp = a.amount - b.amount
      }
      return sortDirection === 'asc' ? cmp : -cmp
    })
  }, [transactions, typeFilter, search, categoryF, supplierF, sortField, sortDirection])

  const { totalIngresos, totalEgresos } = useMemo(() => ({
    totalIngresos: filtered.filter(t => t.type === 'ingreso').reduce((s, t) => s + t.amount, 0),
    totalEgresos: filtered.filter(t => t.type === 'egreso').reduce((s, t) => s + t.amount, 0),
  }), [filtered])

  const total = typeFilter === 'ingreso' ? totalIngresos : typeFilter === 'egreso' ? totalEgresos : totalIngresos - totalEgresos

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginatedItems = useMemo(() => 
    filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  , [filtered, page])

  // Tasas de referencia del dia: la del BCV y la paralela.
  useEffect(() => {
    let active = true
    const fetchRates = async () => {
      try {
        const [usd, paralelo] = await Promise.all([getBcvUsdRate(), getParallelUsdRate()])
        if (!active) return
        setBcvUsd(usd)
        setParaleloUsd(paralelo)
        // No se rellena la tasa sola: la dueña tiene que escribir a como cambio ella.
        // Poner una por defecto invita a aceptarla sin mirar, y es justo lo que hace que
        // el gasto quede apuntado a una tasa que nadie pago.
      } catch (e) {
        console.warn('Error obteniendo tasas de referencia:', e)
      }
    }
    fetchRates()
    return () => {
      active = false
    }
  }, [])

  // Cargar lista unificada de proveedores y descripciones de múltiples fuentes
  useEffect(() => {
    let active = true

    const loadCatalogs = async () => {
      const localSuppliers = getLocalSavedSuppliers()
      const localDescs = getLocalSavedDescriptions()

      const supSet = new Set<string>([...DEFAULT_SUPPLIERS, ...localSuppliers])
      const descSet = new Set<string>(localDescs)

      // 1. Cargar proveedores y descripciones del historial completo de transacciones
      try {
        const { data: txData } = await supabase
          .from('transactions')
          .select('description, related_to')
          .order('date', { ascending: false })
          .limit(1000)

        if (active && txData) {
          txData.forEach(tx => {
            if (tx.related_to?.trim()) supSet.add(tx.related_to.trim())
            if (tx.description?.trim()) descSet.add(tx.description.trim())
          })
        }
      } catch (err) {
        console.warn('Error cargando catálogo desde transacciones:', err)
      }

      // 2. Cargar empleados como posibles relacionados/proveedores
      try {
        const { data: empData } = await supabase
          .from('employees')
          .select('name')
          .order('name')

        if (active && empData) {
          empData.forEach(e => {
            if (e.name?.trim()) supSet.add(e.name.trim())
          })
        }
      } catch (err) {
        console.warn('Error cargando empleados para catálogo:', err)
      }

      // 3. Cargar tabla suppliers si estuviese creada
      try {
        const { data: supData } = await supabase.from('suppliers').select('name')
        if (active && supData) {
          supData.forEach((s: { name: string }) => {
            if (s.name?.trim()) supSet.add(s.name.trim())
          })
        }
      } catch {
        // Ignorar si la tabla no existe
      }

      if (active) {
        setSuppliers(Array.from(supSet).sort((a, b) => a.localeCompare(b, 'es')))
        setSavedDescriptions(Array.from(descSet))
      }
    }

    loadCatalogs()

    return () => {
      active = false
    }
  }, [])

  const handleOpenNewModal = () => {
    setEditingTx(null)
    setForm({
      date: fechaLocalISO(),
      type: typeFilter ?? 'ingreso',
      category: typeFilter === 'egreso' ? 'empleados' : 'alojamiento',
      description: '',
      amount: 0,
      paymentMethod: 'transferencia',
      relatedTo: '',
      exchangeRate: null,
      amountBs: null,
      cashBox: null,
    })
    setShowCalculator(false)
    setShowModal(true)
  }

  const handleStartEdit = (tx: Transaction) => {
    setEditingTx(tx)
    setForm({
      date: tx.date,
      type: tx.type,
      category: tx.category,
      description: tx.description,
      amount: tx.amount,
      paymentMethod: tx.paymentMethod,
      relatedTo: tx.relatedTo || '',
      exchangeRate: tx.exchangeRate ?? null,
      amountBs: tx.amountBs ?? null,
      cashBox: tx.cashBox ?? null,
    })
    setShowCalculator(false)
    setShowModal(true)
  }

  const handleConfirmDelete = async () => {
    if (!txToDelete) return
    setDeleting(true)
    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', txToDelete.id)

      if (error) {
        console.error('Error deleting transaction:', error)
        alert('No se pudo eliminar el registro: ' + error.message)
      } else {
        setTransactions(prev => prev.filter(t => t.id !== txToDelete.id))
        if (editingTx && editingTx.id === txToDelete.id) {
          setShowModal(false)
          setEditingTx(null)
        }
        setTxToDelete(null)
      }
    } catch (err: any) {
      alert('Error al eliminar: ' + (err?.message || 'Error inesperado'))
    } finally {
      setDeleting(false)
    }
  }

  const handleSave = async () => {
    if (!form.description.trim() || form.amount <= 0) return

    if (form.cashBox === 'bs' && !(form.amountBs && form.amountBs > 0)) {
      alert('Para descontarlo de la caja en bolívares hace falta saber cuántos bolívares fueron.'
        + ' Abra la calculadora y anote los bolívares y la tasa.')
      return
    }
    
    const cleanDesc = form.description.trim()
    const cleanRelatedTo = (form.relatedTo || '').trim()

    const dbTx = {
      date: form.date,
      type: form.type,
      category: form.category,
      description: cleanDesc,
      amount: form.amount,
      payment_method: form.paymentMethod,
      related_to: cleanRelatedTo || null,
      exchange_rate: form.exchangeRate ?? null,
      amount_bs: form.amountBs ?? null,
      cash_box: form.cashBox ?? null,
    }

    if (editingTx) {
      const { data, error } = await supabase
        .from('transactions')
        .update(dbTx)
        .eq('id', editingTx.id)
        .select('*')

      if (error) {
        console.error('Error updating transaction:', error)
        alert('No se pudo modificar la transacción: ' + error.message)
        return
      }

      if (data && data[0]) {
        const updated = mapDbTransactionToReact(data[0])
        setTransactions(prev => prev.map(t => t.id === editingTx.id ? updated : t))
      }
    } else {
      const { data, error } = await supabase
        .from('transactions')
        .insert([dbTx])
        .select('*')

      if (error) {
        console.error('Error saving transaction:', error)
        alert('No se pudo guardar la transacción. Intenta de nuevo.')
        return
      }

      if (data && data[0]) {
        setTransactions(prev => [mapDbTransactionToReact(data[0]), ...prev])
      }
    }

    // Persistir descripción guardada en localStorage y memoria
    try {
      const curDescs = getLocalSavedDescriptions()
      if (!curDescs.includes(cleanDesc)) {
        const updated = [cleanDesc, ...curDescs].slice(0, 100)
        localStorage.setItem(STORAGE_DESCRIPTIONS_KEY, JSON.stringify(updated))
        setSavedDescriptions(prev => prev.includes(cleanDesc) ? prev : [cleanDesc, ...prev])
      }
    } catch {}

    // Persistir proveedor en localStorage y memoria
    if (cleanRelatedTo) {
      try {
        const curSups = getLocalSavedSuppliers()
        if (!curSups.includes(cleanRelatedTo)) {
          const updated = [cleanRelatedTo, ...curSups].slice(0, 100)
          localStorage.setItem(STORAGE_SUPPLIERS_KEY, JSON.stringify(updated))
          setSuppliers(prev => prev.includes(cleanRelatedTo) ? prev : [...prev, cleanRelatedTo].sort((a, b) => a.localeCompare(b, 'es')))
        }
      } catch {}

      // Intento no bloqueante de guardar en tabla suppliers
      void supabase
        .from('suppliers')
        .upsert({ name: cleanRelatedTo }, { onConflict: 'name' })
    }

    setSaved(true)
    setTimeout(() => {
      setSaved(false)
      setShowModal(false)
      setEditingTx(null)
      setShowCalculator(false)
      setAmountBs('')
      setMathExpression('')
      setForm({
        date: fechaLocalISO(),
        type: typeFilter ?? 'ingreso',
        category: typeFilter === 'egreso' ? 'empleados' : 'alojamiento',
        description: '',
        amount: 0,
        paymentMethod: 'transferencia',
        relatedTo: '',
      })
    }, 1200)
  }

  const availableCategories = form.type === 'ingreso' ? incomeCategories : expenseCategories
  const allCategories = typeFilter === 'ingreso' ? incomeCategories : typeFilter === 'egreso' ? expenseCategories : [...incomeCategories, ...expenseCategories]

  const title = typeFilter === 'ingreso' ? 'Ingresos' : typeFilter === 'egreso' ? 'Egresos' : 'Transacciones'
  const accentColor = typeFilter === 'egreso' ? '#EF4444' : '#C5A059'
  const btnColor = typeFilter === 'egreso' ? 'bg-red-500 hover:bg-red-600' : 'bg-[#C5A059] hover:bg-[#b8943f]'
  const totalColor = typeFilter === 'ingreso' ? 'text-emerald-600' : typeFilter === 'egreso' ? 'text-red-500' : total >= 0 ? 'text-emerald-600' : 'text-red-500'

  const periods: DatePeriod[] = ['hoy', 'semana', 'mes', 'año', 'personalizado', 'todo']

  const handleViewReceipt = (tx: Transaction) => {
    const isEventual = tx.description.toLowerCase().includes('eventual')
    const bcvRate = tx.exchangeRate && tx.exchangeRate > 0 ? tx.exchangeRate : 0
    
    let period = 'Quincena'
    if (isEventual) {
      const entreParentesis = tx.description.match(/\((.*?)\)/)
      if (entreParentesis) period = entreParentesis[1]
    }

    const emp = {
      id: '',
      name: tx.relatedTo || 'Empleado',
      role: isEventual ? 'Personal Eventual' : 'Personal Fijo',
      employeeType: isEventual ? 'eventual' : 'fijo',
      salary: 0,
      status: 'activo',
      hireDate: '',
      lastPayment: tx.date,
      pendingPayment: false,
      paymentFrequency: 'quincenal',
      dailyRate: 0,
      contractedDays: 0,
    } as Employee

    setViewReceipt({
      emp,
      amountUsd: tx.amount,
      period,
      bcvRate
    })
  }

  return (
    <div className="space-y-5">
      <LoadErrorBanner message={loadError} />

      {hayMas && (
        <div role="status" className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs leading-relaxed text-amber-900">
            <strong className="font-bold">Hay más movimientos de los que caben en pantalla.</strong>{' '}
            Se muestran los {TOPE_MOVIMIENTOS} más recientes del periodo. Acote las fechas
            para ver el resto; los totales de abajo solo suman lo que se ve.
          </p>
        </div>
      )}
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {soloElDia ? (
              `${filtered.length} ${filtered.length === 1 ? 'registro' : 'registros'} de hoy`
            ) : (
              <>
                {filtered.length} registros · {typeFilter ? 'Total' : 'Balance'}:{' '}
                <span className={`font-bold ${totalColor}`}>{fmt(Math.abs(total))}</span>
              </>
            )}
          </p>
        </div>
        <button
          onClick={handleOpenNewModal}
          className={`flex items-center gap-2 px-4 py-2.5 ${btnColor} text-white rounded-xl text-sm font-bold transition-all shadow-sm`}
        >
          <Plus size={16} />
          Nuevo {typeFilter === 'egreso' ? 'Egreso' : 'Ingreso'}
        </button>
      </div>

      {/* Date period selector */}
      {soloElDia ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-4">
          <p className="text-xs leading-relaxed text-gray-500">
            Se muestran los ingresos <strong className="font-bold text-gray-700">registrados hoy</strong>,
            para que pueda comprobar lo que acaba de anotar. El histórico y los totales del
            hotel los consulta la propiedad.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <CalendarDays size={15} className="text-gray-400" />
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Período</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {periods.map(p => (
              <button
                key={p}
                onClick={() => {
                  setPeriod(p)
                  setPage(1)
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all
                  ${period === p
                    ? 'text-white shadow-sm'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                style={period === p ? { backgroundColor: accentColor } : {}}
              >
                {periodLabels[p]}
              </button>
            ))}
          </div>

          {/* Custom date range */}
          {period === 'personalizado' && (
            <div className="flex flex-wrap gap-3 pt-1">
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">Desde</label>
                <input
                  type="date"
                  value={customFrom}
                  onChange={e => {
                    setCustomFrom(e.target.value)
                    setPage(1)
                  }}
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#C5A059] transition-colors"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">Hasta</label>
                <input
                  type="date"
                  value={customTo}
                  onChange={e => {
                    setCustomTo(e.target.value)
                    setPage(1)
                  }}
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#C5A059] transition-colors"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Search + Category + Distributor filters */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-3">
          {/* Search bar */}
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2.5 flex-1 min-w-[220px] shadow-xs">
            <Search size={16} className="text-gray-400 shrink-0" />
            <input
              value={search}
              onChange={e => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder="Buscar por descripción o concepto..."
              className="flex-1 text-sm outline-none bg-transparent text-gray-700 placeholder-gray-400"
            />
            {search && (
              <button
                onClick={() => {
                  setSearch('')
                  setPage(1)
                }}
                className="text-gray-300 hover:text-gray-500 transition-colors"
                title="Limpiar búsqueda"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Category dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setShowCategoryMenu(v => !v)
                setShowSupplierFilterMenu(false)
              }}
              className={`flex items-center gap-2 bg-white border rounded-xl px-4 py-2.5 text-sm transition-colors shadow-xs ${categoryF !== 'todas' ? 'border-[#C5A059] text-gray-900 font-bold bg-amber-50/20' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
            >
              {categoryF !== 'todas' && (
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: categoryColors[categoryF] }}
                />
              )}
              <span className="font-medium truncate max-w-[150px]">
                {categoryF === 'todas' ? 'Categorías' : categoryLabels[categoryF]}
              </span>
              <ChevronDown size={14} className="text-gray-400 shrink-0" />
            </button>

            {showCategoryMenu && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setShowCategoryMenu(false)}
                />
                <div className="absolute right-0 sm:left-0 sm:right-auto top-full mt-1.5 bg-white border border-gray-200 rounded-2xl shadow-xl z-30 py-2 min-w-[210px] max-h-64 overflow-y-auto">
                  <button
                    onClick={() => {
                      setCategoryF('todas')
                      setShowCategoryMenu(false)
                      setPage(1)
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-gray-50 ${categoryF === 'todas' ? 'font-bold text-gray-900 bg-gray-50' : 'text-gray-600'}`}
                  >
                    Todas las categorías
                  </button>
                  <div className="h-px bg-gray-100 my-1" />
                  {allCategories.map(c => (
                    <button
                      key={c}
                      onClick={() => {
                        setCategoryF(c)
                        setShowCategoryMenu(false)
                        setPage(1)
                      }}
                      className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2.5 transition-colors hover:bg-gray-50 ${categoryF === c ? 'font-bold text-gray-900 bg-gray-50' : 'text-gray-600'}`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: categoryColors[c] }} />
                      {categoryLabels[c]}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Distributor / Supplier dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setShowSupplierFilterMenu(v => !v)
                setShowCategoryMenu(false)
              }}
              className={`flex items-center gap-2 bg-white border rounded-xl px-4 py-2.5 text-sm transition-colors shadow-xs ${supplierF !== 'todos' ? 'border-[#C5A059] text-amber-900 font-bold bg-amber-50/50' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
            >
              <Building2 size={14} className={supplierF !== 'todos' ? 'text-[#C5A059]' : 'text-gray-400'} />
              <span className="font-medium truncate max-w-[170px]">
                {supplierF === 'todos' ? 'Distribuidores' : supplierF}
              </span>
              <ChevronDown size={14} className="text-gray-400 shrink-0" />
            </button>

            {showSupplierFilterMenu && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setShowSupplierFilterMenu(false)}
                />
                <div className="absolute right-0 top-full mt-1.5 bg-white border border-gray-200 rounded-2xl shadow-xl z-30 py-2 min-w-[240px] max-h-72 overflow-y-auto">
                  <button
                    onClick={() => {
                      setSupplierF('todos')
                      setShowSupplierFilterMenu(false)
                      setPage(1)
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-gray-50 ${supplierF === 'todos' ? 'font-bold text-gray-900 bg-gray-50' : 'text-gray-600'}`}
                  >
                    Todos los distribuidores
                  </button>
                  <div className="h-px bg-gray-100 my-1" />
                  {availableDistributors.length === 0 ? (
                    <div className="px-4 py-3 text-xs text-gray-400 text-center">
                      No hay distribuidores registrados
                    </div>
                  ) : (
                    availableDistributors.map(([distributorName, count]) => (
                      <button
                        key={distributorName}
                        onClick={() => {
                          setSupplierF(distributorName)
                          setShowSupplierFilterMenu(false)
                          setPage(1)
                        }}
                        className={`w-full text-left px-4 py-2 text-xs flex items-center justify-between transition-colors hover:bg-amber-50/60 ${supplierF === distributorName ? 'font-bold text-amber-900 bg-amber-50' : 'text-gray-700'}`}
                      >
                        <span className="truncate pr-2">{distributorName}</span>
                        {count > 0 && (
                          <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full shrink-0 font-medium">
                            {count}
                          </span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Active filter pills & reset button */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1">
              <Filter size={12} /> Filtros:
            </span>

            {categoryF !== 'todas' && (
              <span className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-900 px-2.5 py-1 rounded-lg font-semibold">
                <span>Categoría: {categoryLabels[categoryF]}</span>
                <button
                  onClick={() => { setCategoryF('todas'); setPage(1) }}
                  className="text-amber-600 hover:text-amber-900"
                >
                  <X size={12} />
                </button>
              </span>
            )}

            {supplierF !== 'todos' && (
              <span className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-900 px-2.5 py-1 rounded-lg font-semibold">
                <Building2 size={11} className="text-[#C5A059]" />
                <span>Distribuidor: {supplierF}</span>
                <button
                  onClick={() => { setSupplierF('todos'); setPage(1) }}
                  className="text-amber-600 hover:text-amber-900"
                >
                  <X size={12} />
                </button>
              </span>
            )}

            {search.trim() && (
              <span className="inline-flex items-center gap-1.5 bg-gray-100 border border-gray-200 text-gray-700 px-2.5 py-1 rounded-lg font-semibold">
                <span>Búsqueda: «{search}»</span>
                <button
                  onClick={() => { setSearch(''); setPage(1) }}
                  className="text-gray-500 hover:text-gray-800"
                >
                  <X size={12} />
                </button>
              </span>
            )}

            <button
              onClick={resetAllFilters}
              className="inline-flex items-center gap-1 text-rose-600 hover:text-rose-700 font-bold text-[11px] ml-1 hover:underline cursor-pointer"
            >
              <RotateCcw size={11} /> Limpiar filtros
            </button>
          </div>
        )}
      </div>

      {/* Summary bar (only when no typeFilter) */}
      {!typeFilter && filtered.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-emerald-50 rounded-2xl px-4 py-3 border border-emerald-100">
            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-0.5">Ingresos</p>
            <p className="text-base font-bold text-emerald-700">{fmt(totalIngresos)}</p>
          </div>
          <div className="bg-red-50 rounded-2xl px-4 py-3 border border-red-100">
            <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest mb-0.5">Egresos</p>
            <p className="text-base font-bold text-red-600">{fmt(totalEgresos)}</p>
          </div>
          <div className={`rounded-2xl px-4 py-3 border ${total >= 0 ? 'bg-amber-50 border-amber-100' : 'bg-red-50 border-red-100'}`}>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-0.5">Balance</p>
            <p className={`text-base font-bold ${total >= 0 ? 'text-amber-700' : 'text-red-600'}`}>{fmt(total)}</p>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80 select-none">
                <th
                  onClick={() => handleSort('date')}
                  className="text-left text-xs font-bold text-gray-500 uppercase tracking-widest px-6 py-4 cursor-pointer hover:bg-gray-100/80 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Fecha</span>
                    {sortField === 'date' ? (
                      sortDirection === 'asc' ? <ArrowUp size={13} className="text-[#C5A059]" /> : <ArrowDown size={13} className="text-[#C5A059]" />
                    ) : (
                      <ArrowUpDown size={12} className="text-gray-300 opacity-60" />
                    )}
                  </div>
                </th>

                <th
                  onClick={() => handleSort('description')}
                  className="text-left text-xs font-bold text-gray-500 uppercase tracking-widest px-4 py-4 cursor-pointer hover:bg-gray-100/80 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Descripción</span>
                    {sortField === 'description' ? (
                      sortDirection === 'asc' ? <ArrowUp size={13} className="text-[#C5A059]" /> : <ArrowDown size={13} className="text-[#C5A059]" />
                    ) : (
                      <ArrowUpDown size={12} className="text-gray-300 opacity-60" />
                    )}
                  </div>
                </th>

                <th
                  onClick={() => handleSort('relatedTo')}
                  className="text-left text-xs font-bold text-gray-500 uppercase tracking-widest px-4 py-4 cursor-pointer hover:bg-gray-100/80 transition-colors hidden sm:table-cell"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Distribuidor / Proveedor</span>
                    {sortField === 'relatedTo' ? (
                      sortDirection === 'asc' ? <ArrowUp size={13} className="text-[#C5A059]" /> : <ArrowDown size={13} className="text-[#C5A059]" />
                    ) : (
                      <ArrowUpDown size={12} className="text-gray-300 opacity-60" />
                    )}
                  </div>
                </th>

                <th
                  onClick={() => handleSort('category')}
                  className="text-left text-xs font-bold text-gray-500 uppercase tracking-widest px-4 py-4 cursor-pointer hover:bg-gray-100/80 transition-colors hidden md:table-cell"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Categoría</span>
                    {sortField === 'category' ? (
                      sortDirection === 'asc' ? <ArrowUp size={13} className="text-[#C5A059]" /> : <ArrowDown size={13} className="text-[#C5A059]" />
                    ) : (
                      <ArrowUpDown size={12} className="text-gray-300 opacity-60" />
                    )}
                  </div>
                </th>

                <th className="text-left text-xs font-bold text-gray-400 uppercase tracking-widest px-4 py-4 hidden lg:table-cell">
                  Método
                </th>

                <th
                  onClick={() => handleSort('amount')}
                  className="text-right text-xs font-bold text-gray-500 uppercase tracking-widest px-6 py-4 cursor-pointer hover:bg-gray-100/80 transition-colors"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Monto</span>
                    {sortField === 'amount' ? (
                      sortDirection === 'asc' ? <ArrowUp size={13} className="text-[#C5A059]" /> : <ArrowDown size={13} className="text-[#C5A059]" />
                    ) : (
                      <ArrowUpDown size={12} className="text-gray-300 opacity-60" />
                    )}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-16">
                    <Loader2 size={32} className="text-[#C5A059] mx-auto animate-spin mb-3" />
                    <p className="text-sm text-gray-400 font-medium">Cargando transacciones...</p>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16">
                    <CalendarDays size={32} className="text-gray-200 mx-auto mb-3" />
                    <p className="text-sm text-gray-400 font-medium">
                      {soloElDia
                        ? 'Todavía no hay ningún ingreso registrado hoy'
                        : 'Sin registros para los filtros seleccionados'}
                    </p>
                    <p className="text-xs text-gray-300 mt-1">
                      {hasActiveFilters ? (
                        <button
                          onClick={resetAllFilters}
                          className="text-[#C5A059] underline font-semibold"
                        >
                          Limpiar todos los filtros
                        </button>
                      ) : (
                        'Prueba cambiando el período de fecha o categoría'
                      )}
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedItems.map(tx => (
                  <tr key={tx.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap font-medium">
                      {parseLocalDate(tx.date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: '2-digit' })}
                    </td>

                    <td className="px-4 py-4">
                      <p className="text-sm font-semibold text-gray-900">{tx.description}</p>
                      {textoDeLaTasa(tx.amountBs, tx.exchangeRate) && (
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          {textoDeLaTasa(tx.amountBs, tx.exchangeRate)}
                        </p>
                      )}
                      {tx.cashBox && (
                        <p className="text-[11px] text-[#C5A059] font-semibold mt-0.5">
                          Caja chica en {tx.cashBox === 'usd' ? 'dólares' : 'bolívares'}
                        </p>
                      )}
                      {/* En móvil se muestra el distribuidor debajo con botón para filtrar */}
                      {tx.relatedTo && (
                        <div className="sm:hidden mt-1">
                          <button
                            type="button"
                            onClick={() => { setSupplierF(tx.relatedTo!); setPage(1) }}
                            className="inline-flex items-center gap-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 px-2 py-0.5 rounded-md text-[11px] font-semibold transition-colors"
                            title="Filtrar por este distribuidor"
                          >
                            <Building2 size={11} className="text-[#C5A059]" /> {tx.relatedTo}
                          </button>
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-4 hidden sm:table-cell">
                      {tx.relatedTo ? (
                        <button
                          type="button"
                          onClick={() => { setSupplierF(tx.relatedTo!); setPage(1) }}
                          className="inline-flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/80 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors text-left"
                          title="Clic para filtrar por este distribuidor"
                        >
                          <Building2 size={12} className="text-[#C5A059] shrink-0" />
                          <span className="truncate max-w-[170px]">{tx.relatedTo}</span>
                        </button>
                      ) : (
                        <span className="text-xs text-gray-300 italic">—</span>
                      )}
                    </td>

                    <td className="px-4 py-4 hidden md:table-cell">
                      <button
                        type="button"
                        onClick={() => { setCategoryF(tx.category); setPage(1) }}
                        className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest text-white transition-opacity hover:opacity-85"
                        style={{ backgroundColor: categoryColors[tx.category] }}
                        title="Clic para filtrar por esta categoría"
                      >
                        {categoryLabels[tx.category]}
                      </button>
                    </td>

                    <td className="px-4 py-4 hidden lg:table-cell">
                      <span className="text-xs text-gray-500 capitalize">{tx.paymentMethod}</span>
                    </td>

                    <td className="px-4 sm:px-6 py-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5 sm:gap-2">
                        <span className={`text-sm font-bold mr-1 ${tx.type === 'ingreso' ? 'text-emerald-600' : 'text-red-500'}`}>
                          {tx.type === 'ingreso' ? '+' : '-'}{fmt(tx.amount)}
                        </span>

                        {tx.category === 'empleados' && (
                          <button
                            onClick={() => handleViewReceipt(tx)}
                            className="text-gray-400 hover:text-[#C5A059] hover:bg-amber-50 rounded-lg p-1.5 transition-colors"
                            title="Ver recibo de pago"
                          >
                            <Receipt size={15} />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleStartEdit(tx)}
                          className="text-gray-400 hover:text-amber-700 hover:bg-amber-50 rounded-lg p-1.5 transition-colors"
                          title="Modificar movimiento"
                        >
                          <Pencil size={15} />
                        </button>

                        <button
                          type="button"
                          onClick={() => setTxToDelete(tx)}
                          className="text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg p-1.5 transition-colors"
                          title="Eliminar movimiento"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
              <span className="text-sm text-gray-500">
                Página <span className="font-bold text-gray-900">{page}</span> de <span className="font-bold text-gray-900">{totalPages}</span>
                <span className="ml-2 text-xs text-gray-400">({filtered.length} registros)</span>
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 text-sm font-medium border border-gray-200 rounded-lg hover:bg-white disabled:opacity-50 transition-colors"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 text-sm font-medium border border-gray-200 rounded-lg hover:bg-white disabled:opacity-50 transition-colors"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Click outside to close category menu */}
      {showCategoryMenu && (
        <div className="fixed inset-0 z-10" onClick={() => setShowCategoryMenu(false)} />
      )}

      {/* Modal nueva transacción */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6 space-y-4 my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {editingTx
                    ? `Modificar ${editingTx.type === 'egreso' ? 'Egreso' : 'Ingreso'}`
                    : (typeFilter === 'egreso' ? 'Nuevo Egreso' : typeFilter === 'ingreso' ? 'Nuevo Ingreso' : 'Nuevo Registro')}
                </h2>
                {editingTx && (
                  <p className="text-xs text-amber-700 font-medium mt-0.5">Editando registro existente</p>
                )}
              </div>
              <button onClick={() => { setShowModal(false); setEditingTx(null); }} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                <X size={18} className="text-gray-500" />
              </button>
            </div>

            {!typeFilter && (
              <div className="flex rounded-xl overflow-hidden border border-gray-200">
                {(['ingreso', 'egreso'] as TransactionType[]).map(t => (
                  <button
                    key={t}
                    onClick={() => setForm(f => ({ ...f, type: t, category: t === 'ingreso' ? 'alojamiento' : 'empleados' }))}
                    className={`flex-1 py-2.5 text-sm font-bold capitalize transition-all
                      ${form.type === t
                        ? t === 'ingreso' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
                        : 'text-gray-400 hover:bg-gray-50'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-4">
              {/* Fecha y Monto con botón de calculadora */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">Fecha</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C5A059] transition-colors"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                      Monto ($)
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowCalculator(v => !v)}
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1 transition-all ${
                        showCalculator
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200'
                      }`}
                      title="Abrir calculadora y conversor de Bolívares a dólares"
                    >
                      <Calculator size={13} />
                      <span>{showCalculator ? 'Cerrar Calc' : '🧮 Calc / Bs a $'}</span>
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      placeholder="0.00"
                      value={form.amount || ''}
                      onChange={e => setForm(f => ({ ...f, amount: Number(e.target.value) }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-semibold outline-none focus:border-[#C5A059] transition-colors"
                    />
                  </div>
                  {textoDeLaTasa(form.amountBs, form.exchangeRate) && (
                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      <p className="text-[11px] text-gray-500">
                        {textoDeLaTasa(form.amountBs, form.exchangeRate)}
                      </p>
                      <button
                        type="button"
                        onClick={() => setForm(f => ({ ...f, amountBs: null, exchangeRate: null }))}
                        className="text-[11px] font-bold text-gray-400 hover:text-red-500 transition-colors shrink-0"
                        title="Quitar la tasa de este movimiento"
                      >
                        Quitar
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Panel Conversor de Divisas Bs a Euro / Calculadora */}
              {showCalculator && (
                <div className="rounded-2xl border border-amber-200 bg-gradient-to-b from-amber-50/70 to-white p-3.5 space-y-3 shadow-xs">
                  {/* Pestañas del panel */}
                  <div className="flex items-center justify-between border-b border-amber-200/70 pb-2">
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => setCalcTab('bcv')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                          calcTab === 'bcv'
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'bg-amber-100/70 text-amber-900 hover:bg-amber-200/70'
                        }`}
                      >
                        <span>Bs → Dólares</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setCalcTab('math')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                          calcTab === 'math'
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'bg-amber-100/70 text-amber-900 hover:bg-amber-200/70'
                        }`}
                      >
                        <Calculator size={12} />
                        <span>Calculadora</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowCalculator(false)}
                      className="text-gray-400 hover:text-gray-600 p-1"
                      title="Cerrar"
                    >
                      <X size={15} />
                    </button>
                  </div>

                  {/* Tab 1: Conversor Bs a Euro / Dólar */}
                  {calcTab === 'bcv' && (
                    <div className="space-y-2.5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">
                            Monto en Bolívares (Bs.)
                          </label>
                          <input
                            type="text"
                            placeholder="Ej. 15.000,00"
                            value={amountBs}
                            onChange={e => setAmountBs(e.target.value)}
                            className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-sm font-semibold outline-none focus:border-amber-500"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">
                            Tasa a la que cambió (Bs por $)
                          </label>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            inputMode="decimal"
                            placeholder="Ej. 942,53"
                            value={exchangeRate || ''}
                            onChange={e => setExchangeRate(Number(e.target.value))}
                            className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-sm font-semibold outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>

                      {/* Referencias de hoy. Son un atajo, no una imposicion: la tasa
                          buena es la que se pago de verdad. */}
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                        <span className="text-gray-400 font-medium">Referencias de hoy:</span>
                        {bcvUsd > 0 && (
                          <button
                            type="button"
                            onClick={() => setExchangeRate(bcvUsd)}
                            className="px-2 py-0.5 rounded bg-white hover:bg-amber-50 text-amber-900 border border-amber-200 font-semibold flex items-center gap-1 shadow-2xs"
                          >
                            <span>BCV:</span>
                            <span className="font-bold">{bcvUsd.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs/$</span>
                          </button>
                        )}
                        {paraleloUsd > 0 && (
                          <button
                            type="button"
                            onClick={() => setExchangeRate(paraleloUsd)}
                            className="px-2 py-0.5 rounded bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 font-semibold flex items-center gap-1 shadow-2xs"
                          >
                            <span>Paralelo:</span>
                            <span className="font-bold">{paraleloUsd.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs/$</span>
                          </button>
                        )}
                      </div>

                      {/* Desglose y resultado del cálculo */}
                      {(() => {
                        const numBs = parseFloat(amountBs.replace(/\./g, '').replace(',', '.')) || (parseFloat(amountBs) || 0)
                        const result = (numBs > 0 && exchangeRate > 0) ? Number((numBs / exchangeRate).toFixed(2)) : 0

                        return (
                          <div className="bg-white/95 border border-amber-200/90 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                            <div>
                              <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">Resultado</span>
                              <p className="text-xs text-gray-800 font-medium">
                                {numBs > 0 ? (
                                  <>
                                    <span className="font-bold text-amber-950">Bs. {numBs.toLocaleString('es-VE', { maximumFractionDigits: 2 })}</span>
                                    {' ÷ '}
                                    <span>{exchangeRate}</span>
                                    {' = '}
                                    <span className="text-sm font-extrabold text-emerald-600">
                                      {result.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-gray-400 italic">Escribe el monto en Bs para convertir</span>
                                )}
                              </p>
                              {numBs > 0 && exchangeRate <= 0 && (
                                <p className="text-[11px] text-amber-700 font-medium mt-1">
                                  Falta la tasa a la que cambió.
                                </p>
                              )}
                              {result > 0 && (
                                <p className="text-[11px] text-gray-500 mt-1">
                                  Se guardan los bolívares y la tasa junto al movimiento.
                                </p>
                              )}
                            </div>

                            <button
                              type="button"
                              disabled={result <= 0}
                              onClick={() => {
                                if (result <= 0) return
                                // Los bolivares y la tasa van a sus propios campos, no
                                // pegados a la descripcion: asi no se pierden si luego se
                                // edita el texto del movimiento.
                                setForm(f => ({
                                  ...f,
                                  amount: result,
                                  amountBs: numBs,
                                  exchangeRate,
                                }))
                                setShowCalculator(false)
                              }}
                              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center justify-center gap-1.5 ${
                                result > 0
                                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              }`}
                            >
                              <Check size={14} />
                              <span>Aplicar ({result > 0 ? result : '0.00'})</span>
                            </button>
                          </div>
                        )
                      })()}
                    </div>
                  )}

                  {/* Tab 2: Calculadora Matemática */}
                  {calcTab === 'math' && (
                    <div className="space-y-2.5">
                      <div className="bg-white border border-gray-300 rounded-xl p-2.5 flex items-center justify-between">
                        <input
                          type="text"
                          placeholder="Ej: 15.5 + 40 + 8.2"
                          value={mathExpression}
                          onChange={e => setMathExpression(e.target.value)}
                          className="w-full text-sm font-semibold outline-none bg-transparent"
                        />
                        {mathExpression && (
                          <button
                            type="button"
                            onClick={() => setMathExpression('')}
                            className="text-gray-400 hover:text-gray-600 p-1"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>

                      {/* Teclado numérico táctil */}
                      <div className="grid grid-cols-4 gap-1.5">
                        {['7', '8', '9', '/', '4', '5', '6', '*', '1', '2', '3', '-', 'C', '0', '.', '+'].map(btn => (
                          <button
                            key={btn}
                            type="button"
                            onClick={() => {
                              if (btn === 'C') {
                                setMathExpression('')
                              } else {
                                setMathExpression(prev => prev + btn)
                              }
                            }}
                            className={`py-1.5 rounded-lg text-xs font-bold transition-colors ${
                              btn === 'C'
                                ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                                : ['/', '*', '-', '+'].includes(btn)
                                  ? 'bg-amber-100 text-amber-900 hover:bg-amber-200 font-extrabold'
                                  : 'bg-white hover:bg-gray-50 text-gray-800 border border-gray-200 shadow-2xs'
                            }`}
                          >
                            {btn === '*' ? '×' : btn === '/' ? '÷' : btn}
                          </button>
                        ))}
                      </div>

                      {/* Resultado de la calculadora */}
                      {(() => {
                        const evalResult = evaluateSimpleMath(mathExpression)
                        return (
                          <div className="bg-white/95 border border-amber-200/90 rounded-xl p-2.5 flex items-center justify-between">
                            <div>
                              <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">Total calculado</span>
                              <span className="text-sm font-extrabold text-emerald-600">
                                {evalResult !== null ? evalResult.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                              </span>
                            </div>
                            <button
                              type="button"
                              disabled={evalResult === null || evalResult <= 0}
                              onClick={() => {
                                if (evalResult !== null && evalResult > 0) {
                                  setForm(f => ({ ...f, amount: evalResult }))
                                  setShowCalculator(false)
                                }
                              }}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                                evalResult !== null && evalResult > 0
                                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              }`}
                            >
                              <Check size={14} />
                              <span>Aplicar ({evalResult !== null ? evalResult : '0.00'})</span>
                            </button>
                          </div>
                        )
                      })()}
                    </div>
                  )}
                </div>
              )}

              {/* Categoría y Método de Pago */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">Categoría</label>
                  <select
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value as TransactionCategory }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C5A059] transition-colors bg-white"
                  >
                    {availableCategories.map(c => (
                      <option key={c} value={c}>{categoryLabels[c]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">Método de Pago</label>
                  <select
                    value={form.paymentMethod}
                    onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value as PaymentMethod }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C5A059] transition-colors bg-white capitalize"
                  >
                    {paymentMethods.map(m => (
                      <option key={m} value={m} className="capitalize">{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              {form.type === 'egreso' && (
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">
                    ¿De dónde salió el dinero?
                  </label>
                  <select
                    value={form.cashBox ?? ''}
                    onChange={e => setForm(f => ({
                      ...f,
                      cashBox: (e.target.value || null) as 'usd' | 'bs' | null,
                    }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C5A059] transition-colors bg-white"
                  >
                    <option value="">Del banco o de otra parte</option>
                    <option value="usd">Caja chica en dólares</option>
                    <option value="bs">Caja chica en bolívares</option>
                  </select>
                  {form.cashBox === 'bs' && !(form.amountBs && form.amountBs > 0) && (
                    <p className="text-[11px] text-amber-700 mt-1.5">
                      Anote los bolívares con la calculadora para poder descontarlos de la caja.
                    </p>
                  )}
                </div>
              )}

              {/* Descripción con autocompletado y catálogo guardado */}
              <div className="relative">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block">
                    Descripción
                  </label>
                  {form.description.trim() && !savedDescriptions.some(d => d.toLowerCase() === form.description.trim().toLowerCase()) && (
                    <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                      ✨ Nueva (se guardará)
                    </span>
                  )}
                </div>

                <div className="relative">
                  <input
                    type="text"
                    placeholder="Descripción del movimiento..."
                    value={form.description}
                    onFocus={() => setShowDescDropdown(true)}
                    onChange={e => {
                      setForm(f => ({ ...f, description: e.target.value }))
                      setShowDescDropdown(true)
                    }}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C5A059] transition-colors pr-14"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                    {form.description && (
                      <button
                        type="button"
                        onClick={() => setForm(f => ({ ...f, description: '' }))}
                        className="text-gray-400 hover:text-gray-600 p-1"
                        title="Limpiar"
                      >
                        <X size={14} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowDescDropdown(v => !v)}
                      className="text-gray-400 hover:text-gray-600 p-1"
                      title="Ver sugerencias guardadas"
                    >
                      <ChevronDown size={15} className={`transition-transform duration-200 ${showDescDropdown ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Chips de sugerencias rápidas por categoría */}
                {(() => {
                  const categorySuggestions = DEFAULT_CATEGORY_DESCRIPTIONS[form.category] || []
                  if (categorySuggestions.length === 0) return null
                  return (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {categorySuggestions.slice(0, 4).map(sug => (
                        <button
                          key={sug}
                          type="button"
                          onClick={() => setForm(f => ({ ...f, description: sug }))}
                          className={`text-[11px] px-2 py-0.5 rounded-md border transition-all truncate max-w-[200px]
                            ${form.description.toLowerCase() === sug.toLowerCase()
                              ? 'bg-[#C5A059] text-white border-[#C5A059] font-semibold shadow-2xs'
                              : 'bg-gray-50 hover:bg-gray-100 text-gray-600 border-gray-200'}`}
                        >
                          {sug}
                        </button>
                      ))}
                    </div>
                  )
                })()}

                {/* Dropdown flotante con buscador de descripciones guardadas */}
                {showDescDropdown && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setShowDescDropdown(false)} />
                    <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-gray-200 rounded-2xl shadow-xl z-30 max-h-56 overflow-y-auto py-1.5 divide-y divide-gray-50">
                      {(() => {
                        const term = form.description.trim().toLowerCase()
                        const categorySuggestions = DEFAULT_CATEGORY_DESCRIPTIONS[form.category] || []
                        const allDescs = Array.from(new Set([...categorySuggestions, ...savedDescriptions]))
                        const matches = allDescs.filter(d => !term || d.toLowerCase().includes(term))

                        if (matches.length === 0) {
                          return (
                            <div className="px-3.5 py-3 text-xs text-gray-500 text-center">
                              <p className="font-semibold text-gray-700">«{form.description}»</p>
                              <p className="text-[11px] text-gray-400 mt-0.5">Se guardará automáticamente para futuros movimientos al registrar este gasto.</p>
                            </div>
                          )
                        }

                        return (
                          <>
                            <div className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50/80 flex items-center justify-between">
                              <span>Descripciones sugeridas</span>
                              <span>{matches.length} disponible{matches.length > 1 ? 's' : ''}</span>
                            </div>
                            {matches.map(d => {
                              const isExact = d.toLowerCase() === term
                              const isCat = categorySuggestions.includes(d)
                              return (
                                <button
                                  key={d}
                                  type="button"
                                  onClick={() => {
                                    setForm(f => ({ ...f, description: d }))
                                    setShowDescDropdown(false)
                                  }}
                                  className={`w-full text-left px-3.5 py-2 text-xs flex items-center justify-between hover:bg-amber-50/70 hover:text-amber-900 transition-colors ${isExact ? 'bg-amber-50 font-bold text-amber-900' : 'text-gray-700'}`}
                                >
                                  <span className="flex items-center gap-2 truncate pr-2">
                                    <Tag size={12} className={isCat ? 'text-[#C5A059] shrink-0' : 'text-gray-400 shrink-0'} />
                                    <span className="truncate">{d}</span>
                                  </span>
                                  {isExact && <Check size={14} className="text-[#C5A059] shrink-0" />}
                                </button>
                              )
                            })}
                          </>
                        )
                      })()}
                    </div>
                  </>
                )}
              </div>

              {/* Proveedor / Relacionado con autocompletado y guardados */}
              <div className="relative">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block">
                    Proveedor / Relacionado (opcional)
                  </label>
                  {(form.relatedTo || '').trim() && !suppliers.some(s => s.toLowerCase() === (form.relatedTo || '').trim().toLowerCase()) && (
                    <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                      ✨ Nuevo (se guardará)
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="text"
                    placeholder={form.category === 'propinas' ? 'Ej. Mesa 4, Cliente Pérez (opcional)' : 'Escribe o selecciona un proveedor...'}
                    value={form.relatedTo || ''}
                    onFocus={() => setShowSupplierDropdown(true)}
                    onChange={e => {
                      setForm(f => ({ ...f, relatedTo: e.target.value }))
                      setShowSupplierDropdown(true)
                    }}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C5A059] transition-colors pr-14"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                    {form.relatedTo && (
                      <button
                        type="button"
                        onClick={() => setForm(f => ({ ...f, relatedTo: '' }))}
                        className="text-gray-400 hover:text-gray-600 p-1"
                        title="Limpiar"
                      >
                        <X size={14} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowSupplierDropdown(v => !v)}
                      className="text-gray-400 hover:text-gray-600 p-1"
                      title="Ver proveedores guardados"
                    >
                      <ChevronDown size={15} className={`transition-transform duration-200 ${showSupplierDropdown ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Chips de proveedores frecuentes */}
                {suppliers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {suppliers.slice(0, 4).map(sup => (
                      <button
                        key={sup}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, relatedTo: sup }))}
                        className={`text-[11px] px-2 py-0.5 rounded-md border transition-all truncate max-w-[180px]
                          ${(form.relatedTo || '').toLowerCase() === sup.toLowerCase()
                            ? 'bg-[#C5A059] text-white border-[#C5A059] font-semibold shadow-2xs'
                            : 'bg-gray-50 hover:bg-gray-100 text-gray-600 border-gray-200'}`}
                      >
                        {sup}
                      </button>
                    ))}
                  </div>
                )}

                {/* Dropdown flotante con sugerencias interactivas de proveedores */}
                {showSupplierDropdown && (
                  <>
                    <div
                      className="fixed inset-0 z-20"
                      onClick={() => setShowSupplierDropdown(false)}
                    />
                    <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-gray-200 rounded-2xl shadow-xl z-30 max-h-56 overflow-y-auto py-1.5 divide-y divide-gray-50">
                      {(() => {
                        const term = (form.relatedTo || '').trim().toLowerCase()
                        const matches = suppliers.filter(s =>
                          !term || s.toLowerCase().includes(term)
                        )

                        if (matches.length === 0) {
                          return (
                            <div className="px-3.5 py-3 text-xs text-gray-500 text-center">
                              <p className="font-semibold text-gray-700">«{form.relatedTo}»</p>
                              <p className="text-[11px] text-gray-400 mt-0.5">Se guardará automáticamente en tu catálogo de proveedores al registrar este gasto.</p>
                            </div>
                          )
                        }

                        return (
                          <>
                            <div className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50/80 flex items-center justify-between">
                              <span>Proveedores sugeridos</span>
                              <span>{matches.length} disponible{matches.length > 1 ? 's' : ''}</span>
                            </div>
                            {matches.map(s => {
                              const isExact = s.toLowerCase() === term
                              return (
                                <button
                                  key={s}
                                  type="button"
                                  onClick={() => {
                                    setForm(f => ({ ...f, relatedTo: s }))
                                    setShowSupplierDropdown(false)
                                  }}
                                  className={`w-full text-left px-3.5 py-2.5 text-xs flex items-center justify-between hover:bg-amber-50/70 hover:text-amber-900 transition-colors ${isExact ? 'bg-amber-50 font-bold text-amber-900' : 'text-gray-700'}`}
                                >
                                  <span className="flex items-center gap-2 truncate pr-2">
                                    <Building2 size={13} className="text-[#C5A059] shrink-0" />
                                    <span className="truncate">{s}</span>
                                  </span>
                                  {isExact && <Check size={14} className="text-[#C5A059] shrink-0" />}
                                </button>
                              )
                            })}
                          </>
                        )
                      })()}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <button
                onClick={handleSave}
                disabled={!form.description.trim() || form.amount <= 0}
                className={`w-full py-3.5 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2
                  ${saved
                    ? 'bg-emerald-500 text-white'
                    : !form.description.trim() || form.amount <= 0
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : `${btnColor} text-white shadow-lg`}`}
              >
                {saved ? (
                  <><Check size={16} /> {editingTx ? 'Cambios Guardados' : 'Guardado'}</>
                ) : (
                  editingTx ? 'Guardar Cambios' : 'Guardar Registro'
                )}
              </button>

              {editingTx && (
                <button
                  type="button"
                  onClick={() => setTxToDelete(editingTx)}
                  className="w-full py-2 text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors flex items-center justify-center gap-1.5"
                >
                  <Trash2 size={14} />
                  <span>Eliminar este movimiento</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación para eliminar movimiento */}
      {txToDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-4 border border-gray-100">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-2">
              <Trash2 size={24} />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-lg font-bold text-gray-900">¿Eliminar este movimiento?</h3>
              <p className="text-xs text-gray-500">
                Esta acción removerá el registro de la contabilidad y recalculará los totales.
              </p>
            </div>

            <div className="rounded-2xl bg-gray-50 p-3.5 border border-gray-100 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-gray-400">Descripción:</span>
                <span className="font-bold text-gray-800 text-right truncate max-w-[220px]">{txToDelete.description}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Monto:</span>
                <span className={`font-bold ${txToDelete.type === 'ingreso' ? 'text-emerald-600' : 'text-red-500'}`}>
                  {txToDelete.type === 'ingreso' ? '+' : '-'}{fmt(txToDelete.amount)}
                </span>
              </div>
              {txToDelete.relatedTo && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Relacionado:</span>
                  <span className="font-semibold text-gray-700 truncate max-w-[220px]">{txToDelete.relatedTo}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-400">Fecha:</span>
                <span className="text-gray-600">{parseLocalDate(txToDelete.date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              </div>
            </div>

            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setTxToDelete(null)}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm"
              >
                {deleting ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <>
                    <Trash2 size={15} />
                    <span>Sí, Eliminar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Visor de Recibo */}
      {viewReceipt && (
        <ReceiptModal
          emp={viewReceipt.emp}
          amountUsd={viewReceipt.amountUsd}
          period={viewReceipt.period}
          bcvRate={viewReceipt.bcvRate}
          isHistory={true}
          onClose={() => setViewReceipt(null)}
        />
      )}
    </div>
  )
}

export default TransactionsPage
