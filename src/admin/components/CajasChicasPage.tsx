import React, { useState, useEffect, useMemo } from 'react'
import { Wallet, Plus, Loader2, Trash2, X, ArrowDownCircle, ArrowUpCircle, Scale } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import LoadErrorBanner from './LoadErrorBanner'
import { parseLocalDate, fechaLocalISO } from '../../utils/dateUtils'
import {
  cargarMovimientosDeCaja, crearMovimientoDeCaja, borrarMovimientoDeCaja,
  calcularSaldos, cajaQueAlimenta, etiquetaDeMovimiento,
  type Caja, type TipoMovimiento, type MovimientoDeCaja, type ApunteParaCaja,
} from '../../utils/cajaChica'

/**
 * Las dos cajas chicas.
 *
 * El saldo no se guarda en ninguna parte: se calcula cada vez a partir de los apuntes de
 * la contabilidad y de los movimientos de caja. Un saldo guardado es un saldo que un dia
 * se queda viejo y nadie se entera.
 */

const fmtUsd = (n: number) =>
  new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n)

const fmtBs = (n: number) =>
  'Bs. ' + n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

interface ApunteCompleto extends ApunteParaCaja {
  id: string
  date: string
  description: string
}

interface LineaDeCaja {
  id: string
  fecha: string
  concepto: string
  detalle: string
  /** En la moneda de la caja. Positivo entra, negativo sale. */
  importe: number
  manual: MovimientoDeCaja | null
}

const CajasChicasPage: React.FC = () => {
  // Las dos cajas las ven los dos accesos: la administradora es la que esta en el hotel
  // y la que las mueve a diario; la propiedad va una vez al mes.

  const [apuntes, setApuntes] = useState<ApunteCompleto[]>([])
  const [movimientos, setMovimientos] = useState<MovimientoDeCaja[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [cajaVisible, setCajaVisible] = useState<Caja>('usd')
  const [modal, setModal] = useState<{ caja: Caja; tipo: TipoMovimiento } | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [form, setForm] = useState(() => ({ importe: '', fecha: fechaLocalISO(), origen: '', nota: '' }))

  useEffect(() => {
    let activo = true

    const cargar = async () => {
      const [apuntesRes, movsRes] = await Promise.all([
        supabase
          .from('transactions')
          .select('id, date, type, description, amount, amount_bs, payment_method, cash_box')
          .order('date', { ascending: false }),
        cargarMovimientosDeCaja(),
      ])

      if (!activo) return

      if (apuntesRes.error) {
        setLoadError(apuntesRes.error.message)
      } else if (movsRes.error) {
        setLoadError(movsRes.error)
      } else {
        setLoadError(null)
        setApuntes((apuntesRes.data || []).map(row => ({
          id: row.id,
          date: row.date,
          description: row.description,
          type: row.type,
          amount: Number(row.amount) || 0,
          amountBs: row.amount_bs == null ? null : Number(row.amount_bs),
          paymentMethod: row.payment_method,
          cashBox: row.cash_box as Caja | null,
        })))
        setMovimientos(movsRes.movimientos)
      }
      setLoading(false)
    }

    cargar()
    return () => { activo = false }
  }, [])

  const saldos = useMemo(() => calcularSaldos(apuntes, movimientos), [apuntes, movimientos])

  /** Todo lo que ha movido una caja, lo automatico y lo de mano, en un solo hilo. */
  const lineasDe = (caja: Caja): LineaDeCaja[] => {
    const lineas: LineaDeCaja[] = []

    for (const a of apuntes) {
      if (cajaQueAlimenta(a) === caja) {
        lineas.push({
          id: 'in-' + a.id,
          fecha: a.date,
          concepto: a.description,
          detalle: 'Cobro en efectivo',
          importe: a.amount,
          manual: null,
        })
      }
      if (a.type === 'egreso' && a.cashBox === caja) {
        const importe = caja === 'bs' ? (a.amountBs || 0) : a.amount
        lineas.push({
          id: 'out-' + a.id,
          fecha: a.date,
          concepto: a.description,
          detalle: 'Gasto pagado desde la caja',
          importe: -importe,
          manual: null,
        })
      }
    }

    for (const m of movimientos) {
      if (m.box !== caja) continue
      lineas.push({
        id: m.id,
        fecha: m.date,
        concepto: etiquetaDeMovimiento[m.kind],
        detalle: [m.source, m.notes].filter(Boolean).join(' · '),
        importe: m.amount,
        manual: m,
      })
    }

    return lineas.sort((a, b) => b.fecha.localeCompare(a.fecha))
  }

  const abrirModal = (caja: Caja, tipo: TipoMovimiento) => {
    setModal({ caja, tipo })
    setForm({ importe: '', fecha: fechaLocalISO(), origen: '', nota: '' })
  }

  const guardar = async () => {
    if (!modal) return
    const bruto = Number(String(form.importe).replace(',', '.'))
    if (!Number.isFinite(bruto) || bruto === 0) {
      alert('Escriba un importe distinto de cero.')
      return
    }

    // La reposicion siempre suma y el retiro siempre resta, se escriba con signo o sin el.
    // El ajuste respeta el signo: sirve para cuadrar en los dos sentidos.
    const importe =
      modal.tipo === 'reposicion' ? Math.abs(bruto)
      : modal.tipo === 'retiro' ? -Math.abs(bruto)
      : bruto

    setGuardando(true)
    const { movimiento, error } = await crearMovimientoDeCaja({
      box: modal.caja,
      kind: modal.tipo,
      amount: importe,
      date: form.fecha,
      source: form.origen,
      notes: form.nota,
    })
    setGuardando(false)

    if (error || !movimiento) {
      alert('No se pudo guardar: ' + (error ?? 'la base de datos no devolvió nada'))
      return
    }

    setMovimientos(prev => [movimiento, ...prev])
    setModal(null)
  }

  const borrar = async (m: MovimientoDeCaja) => {
    const importe = m.box === 'bs' ? fmtBs(Math.abs(m.amount)) : fmtUsd(Math.abs(m.amount))
    if (!window.confirm(`¿Eliminar ${etiquetaDeMovimiento[m.kind].toLowerCase()} de ${importe}?`)) return
    const error = await borrarMovimientoDeCaja(m.id)
    if (error) { alert('No se pudo eliminar: ' + error); return }
    setMovimientos(prev => prev.filter(x => x.id !== m.id))
  }

  const dinero = (caja: Caja, n: number) => (caja === 'bs' ? fmtBs(n) : fmtUsd(n))

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 size={32} className="animate-spin text-[#C5A059]" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <LoadErrorBanner message={loadError} />

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Cajas Chicas</h1>
        <p className="text-sm text-gray-500 mt-1">
          El efectivo que hay en el hotel y el saldo en bolívares para los pagos del día a día.
        </p>
      </div>

      {saldos.egresosBsSinImporte > 0 && (
        <div role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs leading-relaxed text-amber-900">
            <strong className="font-bold">
              Hay {saldos.egresosBsSinImporte} gasto{saldos.egresosBsSinImporte === 1 ? '' : 's'} pagado
              {saldos.egresosBsSinImporte === 1 ? '' : 's'} desde la caja en bolívares sin los bolívares apuntados.
            </strong>{' '}
            No se pueden descontar del saldo. Ábralos en Egresos y anote los bolívares y la tasa.
          </p>
        </div>
      )}

      {/* Saldos */}
      <div className="grid gap-3 sm:grid-cols-2">
        {(['usd', 'bs'] as Caja[]).map(caja => {
          const saldo = caja === 'bs' ? saldos.bs : saldos.usd
          return (
            <button
              key={caja}
              onClick={() => setCajaVisible(caja)}
              className={`text-left rounded-2xl border p-5 transition-all ${
                cajaVisible === caja
                  ? 'border-[#C5A059] bg-white shadow-sm'
                  : 'border-gray-100 bg-white/60 hover:border-gray-200'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Wallet size={16} className="text-[#C5A059]" />
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  {caja === 'usd' ? 'Efectivo en dólares' : 'Fondo en bolívares'}
                </span>
              </div>
              <p className={`text-2xl font-bold ${saldo < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                {dinero(caja, saldo)}
              </p>
              <p className="text-[11px] text-gray-400 mt-1">
                {caja === 'usd'
                  ? 'Billetes. Se llena con los cobros en efectivo en dólares.'
                  : 'Saldo que la propiedad transfiere desde las cuentas del hotel.'}
              </p>
            </button>
          )
        })}
      </div>

      {saldos.usd < 0 && cajaVisible === 'usd' && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          El saldo está en negativo: se ha pagado desde la caja más de lo que entró. Revise si
          falta registrar algún cobro en efectivo o alguna reposición.
        </p>
      )}

      {/* Acciones */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => abrirModal(cajaVisible, 'reposicion')}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#C5A059] hover:bg-[#b8943f] text-white rounded-xl text-sm font-bold transition-all"
        >
          <ArrowDownCircle size={16} /> Reponer
        </button>
        <button
          onClick={() => abrirModal(cajaVisible, 'retiro')}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 hover:border-gray-300 text-gray-700 rounded-xl text-sm font-bold transition-all"
        >
          <ArrowUpCircle size={16} /> Retirar
        </button>
        <button
          onClick={() => abrirModal(cajaVisible, 'ajuste')}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 hover:border-gray-300 text-gray-700 rounded-xl text-sm font-bold transition-all"
        >
          <Scale size={16} /> Ajustar por conteo
        </button>
      </div>

      {/* Movimientos */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/60">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
            Movimientos · {cajaVisible === 'usd' ? 'dólares' : 'bolívares'}
          </p>
        </div>

        {lineasDe(cajaVisible).length === 0 ? (
          <div className="py-16 text-center">
            <Wallet size={32} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400 font-medium">Esta caja todavía no tiene movimientos</p>
            <p className="text-xs text-gray-300 mt-1">
              {cajaVisible === 'bs'
                ? 'Use «Reponer» cuando la propiedad transfiera el dinero'
                : 'Entrará solo con el primer cobro en efectivo'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {lineasDe(cajaVisible).slice(0, 100).map(linea => (
              <div key={linea.id} className="flex items-center gap-4 px-6 py-3.5">
                <div className="w-20 shrink-0 text-xs text-gray-400">
                  {parseLocalDate(linea.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: '2-digit' })}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{linea.concepto}</p>
                  {linea.detalle && <p className="text-xs text-gray-400 truncate">{linea.detalle}</p>}
                </div>
                <span className={`text-sm font-bold shrink-0 ${linea.importe >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {linea.importe >= 0 ? '+' : '−'}{dinero(cajaVisible, Math.abs(linea.importe))}
                </span>
                {linea.manual ? (
                  <button
                    onClick={() => borrar(linea.manual!)}
                    className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                    title="Eliminar movimiento"
                  >
                    <Trash2 size={14} />
                  </button>
                ) : (
                  <span className="w-[30px] shrink-0" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{etiquetaDeMovimiento[modal.tipo]}</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {modal.caja === 'usd' ? 'Caja chica en dólares' : 'Fondo en bolívares'}
                </p>
              </div>
              <button onClick={() => setModal(null)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                <X size={18} className="text-gray-500" />
              </button>
            </div>

            {modal.tipo === 'ajuste' && (
              <p className="text-xs leading-relaxed text-gray-500 bg-gray-50 rounded-xl p-3">
                Para cuadrar con lo que hay de verdad — los billetes contados, o el saldo que
                dice el banco. Escriba la diferencia: en positivo si sobra, con un menos
                delante si falta.
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">
                  Importe ({modal.caja === 'usd' ? 'USD' : 'Bs'})
                </label>
                <input
                  type="number"
                  step="any"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={form.importe}
                  onChange={e => setForm(f => ({ ...f, importe: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C5A059]"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Fecha</label>
                <input
                  type="date"
                  value={form.fecha}
                  onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C5A059]"
                />
              </div>
            </div>

            {modal.tipo !== 'ajuste' && (
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">
                  {modal.tipo === 'reposicion' ? '¿De dónde salió?' : '¿A dónde fue?'}
                </label>
                <input
                  type="text"
                  placeholder={modal.tipo === 'reposicion' ? 'Ej. Transferencia desde Bancamiga del hotel' : 'Ej. Devuelto a la cuenta del hotel'}
                  value={form.origen}
                  onChange={e => setForm(f => ({ ...f, origen: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C5A059]"
                />
              </div>
            )}

            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Nota (opcional)</label>
              <input
                type="text"
                value={form.nota}
                onChange={e => setForm(f => ({ ...f, nota: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C5A059]"
              />
            </div>

            <p className="text-[11px] text-gray-400 leading-relaxed">
              Esto no es un ingreso ni un gasto del hotel: el dinero solo cambia de sitio. No
              aparece en los totales del mes, solo en el saldo de la caja.
            </p>

            <button
              onClick={guardar}
              disabled={guardando}
              className="w-full py-3 bg-[#C5A059] hover:bg-[#b8943f] disabled:opacity-50 text-white rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2"
            >
              {guardando ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              Guardar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default CajasChicasPage
