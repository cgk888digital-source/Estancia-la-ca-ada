import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Sliders, Check, Sparkles, DollarSign, Percent, AlertCircle, Clock, UtensilsCrossed } from 'lucide-react'
import { accommodationOptions, activeAccommodationOptions } from '../../data/accommodations'
import { supabase } from '../../lib/supabase'

interface DbAccommodation {
  id: number
  title: string
  price: number
  december_price: number
  discount_percent: number
}

interface HotelTimes {
  checkin_time: string
  checkout_time: string
}

interface MealPrices {
  meal_breakfast_adult: string
  meal_dinner_adult: string
  meal_breakfast_child: string
  meal_dinner_child: string
  /** Alimentación total por adulto y noche del 21 de diciembre al 7 de enero. En esas
   *  fechas la pensión del adulto sube; la del niño se mantiene igual. */
  meal_adult_navidad: string
}

const MEAL_KEYS: (keyof MealPrices)[] = [
  'meal_breakfast_adult',
  'meal_dinner_adult',
  'meal_breakfast_child',
  'meal_dinner_child',
  'meal_adult_navidad',
]

const MEAL_LABELS: Record<keyof MealPrices, string> = {
  meal_breakfast_adult: 'Desayuno Adulto',
  meal_dinner_adult: 'Cena Adulto',
  meal_breakfast_child: 'Desayuno Niño',
  meal_dinner_child: 'Cena Niño',
  meal_adult_navidad: 'Alimentación Adulto (Navidad)',
}

export default function RatesPage() {
  const [rates, setRates] = useState<DbAccommodation[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Check-in / Check-out hour settings
  const [hotelTimes, setHotelTimes] = useState<HotelTimes>({ checkin_time: '2:00 PM', checkout_time: '11:00 AM' })
  const [savingTimes, setSavingTimes] = useState(false)
  const [successTimes, setSuccessTimes] = useState(false)
  const [errorTimes, setErrorTimes] = useState('')

  // Restaurant table count (used to generate the Mesa 1..N QR/NFC codes in Comandas)
  const [tableCount, setTableCount] = useState('6')
  const [savingTableCount, setSavingTableCount] = useState(false)
  const [successTableCount, setSuccessTableCount] = useState(false)
  const [errorTableCount, setErrorTableCount] = useState('')

  // Desayuno y cena incluidos: se suman a la tarifa de la habitación por cada huésped/noche.
  const [meals, setMeals] = useState<MealPrices>({
    meal_breakfast_adult: '22',
    meal_dinner_adult: '34',
    meal_breakfast_child: '20',
    meal_dinner_child: '28',
    meal_adult_navidad: '62',
  })
  const [savingMeals, setSavingMeals] = useState(false)
  const [successMeals, setSuccessMeals] = useState(false)
  const [errorMeals, setErrorMeals] = useState('')

  const mealTotalAdult = Number(meals.meal_breakfast_adult || 0) + Number(meals.meal_dinner_adult || 0)
  const mealTotalChild = Number(meals.meal_breakfast_child || 0) + Number(meals.meal_dinner_child || 0)

  async function fetchAll() {
    setLoading(true)
    setErrorMsg('')

    const [accRes, settingsRes] = await Promise.all([
      supabase.from('accommodations').select('*').order('id', { ascending: true }),
      supabase.from('hotel_settings').select('key, value'),
    ])

    if (accRes.error) {
      setErrorMsg('No se pudieron cargar las tarifas de la base de datos.')
    } else if (accRes.data) {
      const activeIds = new Set(activeAccommodationOptions.map(o => o.id))
      setRates(accRes.data.filter(d => activeIds.has(Number(d.id))).map(d => ({
        id: Number(d.id),
        title: d.title,
        price: Number(d.price),
        december_price: Number(d.december_price),
        discount_percent: Number(d.discount_percent)
      })))
    }

    if (!settingsRes.error && settingsRes.data) {
      const map: Partial<HotelTimes> = {}
      const mealMap: Partial<MealPrices> = {}
      settingsRes.data.forEach((row: { key: string; value: string }) => {
        if (row.key === 'checkin_time' || row.key === 'checkout_time') {
          map[row.key] = row.value
        }
        if (row.key === 'table_count') {
          setTableCount(row.value)
        }
        if ((MEAL_KEYS as string[]).includes(row.key)) {
          mealMap[row.key as keyof MealPrices] = row.value
        }
      })
      setHotelTimes(prev => ({ ...prev, ...map }))
      setMeals(prev => ({ ...prev, ...mealMap }))
    }

    setLoading(false)
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAll()
  }, [])

  const handleInputChange = (id: number, field: keyof DbAccommodation, value: number) => {
    setRates(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))
  }

  const handleSave = async () => {
    const invalid = rates.find(r => r.price <= 0 || r.december_price <= 0 || r.discount_percent < 0 || r.discount_percent > 100)
    if (invalid) {
      setErrorMsg('Verifica que las tarifas sean mayores a 0 y los descuentos estén entre 0% y 100%.')
      return
    }

    setSaving(true)
    setErrorMsg('')

    try {
      const promises = rates.map(rate =>
        supabase.from('accommodations').update({
          price: rate.price,
          december_price: rate.december_price,
          discount_percent: rate.discount_percent
        }).eq('id', rate.id)
      )

      const results = await Promise.all(promises)
      const err = results.find(r => r.error)
      if (err) throw err.error

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch {
      setErrorMsg('Error al guardar los cambios en el servidor.')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveTimes = async () => {
    if (!hotelTimes.checkin_time.trim() || !hotelTimes.checkout_time.trim()) {
      setErrorTimes('Por favor completa ambos horarios.')
      return
    }

    setSavingTimes(true)
    setErrorTimes('')

    try {
      const upserts = [
        { key: 'checkin_time', value: hotelTimes.checkin_time, label: 'Hora de Check-in', updated_at: new Date().toISOString() },
        { key: 'checkout_time', value: hotelTimes.checkout_time, label: 'Hora de Check-out', updated_at: new Date().toISOString() },
      ]

      const { error } = await supabase
        .from('hotel_settings')
        .upsert(upserts, { onConflict: 'key' })

      if (error) throw error

      setSuccessTimes(true)
      setTimeout(() => setSuccessTimes(false), 3000)
    } catch {
      setErrorTimes('Error al guardar los horarios.')
    } finally {
      setSavingTimes(false)
    }
  }

  const handleSaveMeals = async () => {
    const invalid = MEAL_KEYS.find(k => {
      const n = Number(meals[k])
      return !Number.isFinite(n) || n < 0
    })
    if (invalid) {
      setErrorMeals('Todos los precios de comidas deben ser números iguales o mayores a 0.')
      return
    }

    setSavingMeals(true)
    setErrorMeals('')

    try {
      const upserts = MEAL_KEYS.map(k => ({
        key: k,
        value: String(Number(meals[k])),
        label: MEAL_LABELS[k],
        updated_at: new Date().toISOString(),
      }))

      const { error } = await supabase
        .from('hotel_settings')
        .upsert(upserts, { onConflict: 'key' })

      if (error) throw error

      setSuccessMeals(true)
      setTimeout(() => setSuccessMeals(false), 3000)
    } catch {
      setErrorMeals('Error al guardar los precios de comidas.')
    } finally {
      setSavingMeals(false)
    }
  }

  const handleSaveTableCount = async () => {
    const n = Number(tableCount)
    if (!Number.isInteger(n) || n < 1) {
      setErrorTableCount('Ingresa un número de mesas válido (mínimo 1).')
      return
    }

    setSavingTableCount(true)
    setErrorTableCount('')

    try {
      const { error } = await supabase
        .from('hotel_settings')
        .upsert([{ key: 'table_count', value: String(n), label: 'Número de Mesas', updated_at: new Date().toISOString() }], { onConflict: 'key' })

      if (error) throw error

      setSuccessTableCount(true)
      setTimeout(() => setSuccessTableCount(false), 3000)
    } catch {
      setErrorTableCount('Error al guardar el número de mesas.')
    } finally {
      setSavingTableCount(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] gap-3">
        <div className="w-10 h-10 border-4 border-[#C5A059] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-bold text-gray-500 uppercase tracking-widest animate-pulse">Cargando configuración...</p>
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto">

      {/* ── SECCIÓN 1: Horarios Check-in / Check-out ── */}
      <div className="bg-white border border-gray-200/60 rounded-[2rem] overflow-hidden shadow-sm">
        <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-lg font-bold font-serif text-gray-800 flex items-center gap-2">
              <Clock size={18} className="text-[#C5A059]" />
              Horarios de Check-in y Check-out
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              Estos horarios se muestran al huésped en la galería, el flujo de reserva y la confirmación final.
            </p>
          </div>
          <button
            onClick={handleSaveTimes}
            disabled={savingTimes}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[#3D2B1F] hover:bg-[#2e1f14] text-white rounded-2xl text-xs uppercase tracking-wider font-extrabold transition-all active:scale-95 disabled:opacity-50 shrink-0"
          >
            {savingTimes ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Check size={14} />
            )}
            Guardar Horarios
          </button>
        </div>

        <div className="p-6 space-y-4">
          {successTimes && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl text-xs font-semibold flex items-center gap-2">
              <Sparkles size={15} className="text-emerald-600" />
              ¡Horarios actualizados! Los huéspedes ya ven los nuevos horarios.
            </div>
          )}
          {errorTimes && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-2xl text-xs font-semibold flex items-center gap-2">
              <AlertCircle size={15} className="text-rose-600" />
              {errorTimes}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Check-in */}
            <div className="bg-amber-50/60 border border-amber-100 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-amber-100 rounded-xl flex items-center justify-center text-amber-700 font-bold text-sm">🕑</div>
                <div>
                  <p className="text-xs font-bold text-gray-700">Hora de Check-in</p>
                  <p className="text-[10px] text-gray-400">Hora a partir de la cual los huéspedes pueden ingresar</p>
                </div>
              </div>
              <input
                type="text"
                value={hotelTimes.checkin_time}
                onChange={e => setHotelTimes(prev => ({ ...prev, checkin_time: e.target.value }))}
                placeholder="Ej: 2:00 PM"
                className="w-full border border-amber-200 bg-white rounded-xl px-4 py-2.5 text-sm font-bold text-gray-700 outline-none focus:border-[#C5A059] focus:ring-1 focus:ring-[#C5A059]/30 transition-all"
              />
              <p className="text-[10px] text-gray-400 italic">Formato libre: "2:00 PM", "14:00", "Desde las 3pm", etc.</p>
            </div>

            {/* Check-out */}
            <div className="bg-orange-50/60 border border-orange-100 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-orange-100 rounded-xl flex items-center justify-center text-orange-700 font-bold text-sm">🕚</div>
                <div>
                  <p className="text-xs font-bold text-gray-700">Hora de Check-out</p>
                  <p className="text-[10px] text-gray-400">Hora límite para que los huéspedes desocupen</p>
                </div>
              </div>
              <input
                type="text"
                value={hotelTimes.checkout_time}
                onChange={e => setHotelTimes(prev => ({ ...prev, checkout_time: e.target.value }))}
                placeholder="Ej: 11:00 AM"
                className="w-full border border-orange-200 bg-white rounded-xl px-4 py-2.5 text-sm font-bold text-gray-700 outline-none focus:border-[#C5A059] focus:ring-1 focus:ring-[#C5A059]/30 transition-all"
              />
              <p className="text-[10px] text-gray-400 italic">Formato libre: "11:00 AM", "11:00", "Antes de las 11am", etc.</p>
            </div>
          </div>

          {/* Preview */}
          <div className="mt-2 p-4 bg-[#121212] rounded-2xl flex items-center justify-around">
            <div className="text-center">
              <p className="text-[8px] uppercase tracking-widest text-white/40 font-bold mb-1">Vista previa Check-in</p>
              <p className="text-sm font-bold text-[#C5A059]">🕑 {hotelTimes.checkin_time || '—'}</p>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="text-center">
              <p className="text-[8px] uppercase tracking-widest text-white/40 font-bold mb-1">Vista previa Check-out</p>
              <p className="text-sm font-bold text-[#C5A059]">🕚 {hotelTimes.checkout_time || '—'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── SECCIÓN 1.2: Comidas incluidas en la tarifa ── */}
      <div className="bg-white border border-gray-200/60 rounded-[2rem] overflow-hidden shadow-sm">
        <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-lg font-bold font-serif text-gray-800 flex items-center gap-2">
              <UtensilsCrossed size={18} className="text-[#C5A059]" />
              Comidas Incluidas en la Tarifa
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              Se suman a la tarifa de la habitación por cada huésped y por cada noche. Al guardar, todas las reservas nuevas se calculan con estos montos.
            </p>
          </div>
          <button
            onClick={handleSaveMeals}
            disabled={savingMeals}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[#3D2B1F] hover:bg-[#2e1f14] text-white rounded-2xl text-xs uppercase tracking-wider font-extrabold transition-all active:scale-95 disabled:opacity-50 shrink-0"
          >
            {savingMeals ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Check size={14} />
            )}
            Guardar Comidas
          </button>
        </div>

        <div className="p-6 space-y-4">
          {successMeals && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl text-xs font-semibold flex items-center gap-2">
              <Sparkles size={15} className="text-emerald-600" />
              ¡Precios de comidas actualizados! Las reservas nuevas ya usan estos montos.
            </div>
          )}
          {errorMeals && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-2xl text-xs font-semibold flex items-center gap-2">
              <AlertCircle size={15} className="text-rose-600" />
              {errorMeals}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Adultos */}
            <div className="bg-[#C5A059]/5 border border-[#C5A059]/20 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-gray-700">Adulto <span className="text-gray-400 font-medium">(15+)</span></p>
                <span className="text-[10px] font-mono font-bold text-[#C5A059] bg-white px-2 py-1 rounded-lg border border-[#C5A059]/20">
                  ${mealTotalAdult} / noche
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">Desayuno ($)</label>
                  <input
                    type="number"
                    min={0}
                    value={meals.meal_breakfast_adult}
                    onChange={e => setMeals(prev => ({ ...prev, meal_breakfast_adult: e.target.value }))}
                    className="w-full border border-gray-200 bg-white rounded-xl px-3 py-2 text-sm font-bold text-gray-700 outline-none focus:border-[#C5A059] focus:ring-1 focus:ring-[#C5A059]/30 transition-all"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">Cena ($)</label>
                  <input
                    type="number"
                    min={0}
                    value={meals.meal_dinner_adult}
                    onChange={e => setMeals(prev => ({ ...prev, meal_dinner_adult: e.target.value }))}
                    className="w-full border border-gray-200 bg-white rounded-xl px-3 py-2 text-sm font-bold text-gray-700 outline-none focus:border-[#C5A059] focus:ring-1 focus:ring-[#C5A059]/30 transition-all"
                  />
                </div>
              </div>

              {/* Del 21 de diciembre al 7 de enero la pension del adulto sube. Cotejado
                  contra Paxer con ocho reservas navideñas reales. */}
              <div className="pt-3 border-t border-[#C5A059]/20">
                <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">
                  Alimentación en Navidad ($ / noche) <span className="text-[#C5A059]">— 21 dic al 7 ene</span>
                </label>
                <input
                  type="number"
                  min={0}
                  value={meals.meal_adult_navidad}
                  onChange={e => setMeals(prev => ({ ...prev, meal_adult_navidad: e.target.value }))}
                  className="w-full border border-gray-200 bg-white rounded-xl px-3 py-2 text-sm font-bold text-gray-700 outline-none focus:border-[#C5A059] focus:ring-1 focus:ring-[#C5A059]/30 transition-all"
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  Sustituye al total de desayuno + cena en esas fechas. El niño no cambia.
                </p>
              </div>
            </div>

            {/* Niños */}
            <div className="bg-sky-50/60 border border-sky-100 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-gray-700">Niño <span className="text-gray-400 font-medium">(3 a 12 años)</span></p>
                <span className="text-[10px] font-mono font-bold text-sky-700 bg-white px-2 py-1 rounded-lg border border-sky-200">
                  ${mealTotalChild} / noche
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">Desayuno ($)</label>
                  <input
                    type="number"
                    min={0}
                    value={meals.meal_breakfast_child}
                    onChange={e => setMeals(prev => ({ ...prev, meal_breakfast_child: e.target.value }))}
                    className="w-full border border-sky-200 bg-white rounded-xl px-3 py-2 text-sm font-bold text-gray-700 outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-300/40 transition-all"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">Cena ($)</label>
                  <input
                    type="number"
                    min={0}
                    value={meals.meal_dinner_child}
                    onChange={e => setMeals(prev => ({ ...prev, meal_dinner_child: e.target.value }))}
                    className="w-full border border-sky-200 bg-white rounded-xl px-3 py-2 text-sm font-bold text-gray-700 outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-300/40 transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Ejemplo en vivo para que se vea el efecto antes de guardar */}
          <div className="p-4 bg-[#121212] rounded-2xl">
            <p className="text-[8px] uppercase tracking-widest text-white/40 font-bold mb-2">Ejemplo: 1 noche, 2 adultos + 1 niño</p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="text-white/60">Habitación</span>
              <span className="text-white/30">+</span>
              <span className="text-[#C5A059] font-bold">${mealTotalAdult * 2}</span>
              <span className="text-white/40 text-xs">(2 adultos)</span>
              <span className="text-white/30">+</span>
              <span className="text-sky-300 font-bold">${mealTotalChild}</span>
              <span className="text-white/40 text-xs">(1 niño)</span>
              <span className="text-white/30">=</span>
              <span className="text-white font-bold">Habitación + ${mealTotalAdult * 2 + mealTotalChild}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── SECCIÓN 1.5: Mesas del Restaurante (para QR/NFC en Comandas) ── */}
      <div className="bg-white border border-gray-200/60 rounded-[2rem] overflow-hidden shadow-sm">
        <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-lg font-bold font-serif text-gray-800 flex items-center gap-2">
              <UtensilsCrossed size={18} className="text-[#C5A059]" />
              Mesas del Restaurante
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              Define cuántas mesas hay para generar sus códigos QR/NFC en Comandas → "Generar QR/NFC".
            </p>
          </div>
          <button
            onClick={handleSaveTableCount}
            disabled={savingTableCount}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[#3D2B1F] hover:bg-[#2e1f14] text-white rounded-2xl text-xs uppercase tracking-wider font-extrabold transition-all active:scale-95 disabled:opacity-50 shrink-0"
          >
            {savingTableCount ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Check size={14} />
            )}
            Guardar
          </button>
        </div>

        <div className="p-6 space-y-4">
          {successTableCount && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl text-xs font-semibold flex items-center gap-2">
              <Sparkles size={15} className="text-emerald-600" />
              ¡Número de mesas actualizado!
            </div>
          )}
          {errorTableCount && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-2xl text-xs font-semibold flex items-center gap-2">
              <AlertCircle size={15} className="text-rose-600" />
              {errorTableCount}
            </div>
          )}
          <div className="max-w-xs">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">Cantidad de Mesas</label>
            <input
              type="number"
              min={1}
              value={tableCount}
              onChange={e => setTableCount(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-700 outline-none focus:border-[#C5A059] focus:ring-1 focus:ring-[#C5A059]/30 transition-all"
            />
          </div>
        </div>
      </div>

      {/* ── SECCIÓN 2: Tarifas y Descuentos ── */}
      <div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5">
          <div>
            <h1 className="text-2xl font-bold font-serif text-gray-800">Tarifas y Descuentos Temporales</h1>
            <p className="text-xs text-gray-400 mt-1">
              Modifica precios base, precios de temporada alta (Diciembre) y aplica descuentos rápidos por cabaña.
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-[#C5A059] hover:bg-[#b8904a] text-white rounded-2xl text-xs uppercase tracking-wider font-extrabold transition-all shadow-md shadow-[#C5A059]/20 active:scale-95 disabled:opacity-50"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Check size={16} />
            )}
            Guardar Tarifas
          </button>
        </div>

        {success && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl text-xs font-semibold flex items-center gap-2 mb-4">
            <Sparkles size={16} className="text-emerald-600" />
            ¡Tarifas y descuentos actualizados exitosamente en tiempo real!
          </div>
        )}

        {errorMsg && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-2xl text-xs font-semibold flex items-center gap-2 mb-4">
            <AlertCircle size={16} className="text-rose-600" />
            {errorMsg}
          </div>
        )}

        {/* Season explainer card */}
        <div className="bg-[#3D2B1F]/5 border border-[#3D2B1F]/10 rounded-[2rem] p-6 mb-5">
          <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm font-serif mb-1.5">
            <Sliders size={16} className="text-[#C5A059]" /> Reglas de Tarifas y Temporadas
          </h3>
          <p className="text-xs text-gray-500 leading-relaxed">
            El sistema aplica la <strong>Tarifa Diciembre</strong> a cada noche que caiga entre el <strong>21 de diciembre y el 7 de enero</strong>, no a la estadía entera: si un huésped entra el 18 y se va el 26, las tres primeras noches van a Tarifa Base y las demás a Tarifa Diciembre. En esas fechas la alimentación del adulto también cambia a la de Navidad. El resto del año se usa la <strong>Tarifa Base</strong>. Si configuras un <strong>Descuento Activo</strong> mayor al 0%, se aplicará de inmediato al huésped y se mostrará el precio original tachado como incentivo de reserva.
          </p>
        </div>

        {/* Accommodation Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {rates.map(rate => {
            const accInfo = accommodationOptions.find(o => o.id === rate.id)
            return (
              <motion.div
                key={rate.id}
                className="bg-white border border-gray-200/60 rounded-[2rem] overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col"
              >
                {/* Photo & Badge */}
                <div className="relative aspect-[16/9] overflow-hidden bg-gray-100">
                  {accInfo?.image ? (
                    <img src={accInfo.image} alt={rate.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">Sin Imagen</div>
                  )}
                  <div className="absolute top-3 left-3 bg-[#3D2B1F]/90 backdrop-blur-sm text-white text-[8px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-full">
                    {accInfo?.type || 'Alojamiento'}
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-gray-800 text-sm leading-snug">{rate.title}</h3>
                    <p className="text-[10px] text-gray-400 mt-1 font-medium">{accInfo?.capacity}</p>
                  </div>

                  <div className="space-y-3 pt-3 border-t border-gray-50">
                    {/* Base price */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-0.5">
                          <DollarSign size={10} /> Tarifa Base ($ / noche)
                        </label>
                        <span className="text-[9px] font-mono font-bold text-gray-500">Normal</span>
                      </div>
                      <input
                        type="number"
                        min={1}
                        value={rate.price}
                        onChange={e => handleInputChange(rate.id, 'price', Number(e.target.value))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#C5A059]"
                      />
                    </div>

                    {/* December price */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-0.5">
                          <DollarSign size={10} /> Tarifa Diciembre ($ / noche)
                        </label>
                        <span className="text-[9px] font-mono font-bold text-[#C5A059]">Alta Season</span>
                      </div>
                      <input
                        type="number"
                        min={1}
                        value={rate.december_price}
                        onChange={e => handleInputChange(rate.id, 'december_price', Number(e.target.value))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#C5A059]"
                      />
                    </div>

                    {/* Discount */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-0.5">
                          <Percent size={10} /> Descuento Activo (%)
                        </label>
                        {rate.discount_percent > 0 && (
                          <span className="text-[8px] font-extrabold text-emerald-600 uppercase bg-emerald-50 px-1.5 py-0.5 rounded">
                            {rate.discount_percent}% OFF
                          </span>
                        )}
                      </div>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={rate.discount_percent}
                        onChange={e => handleInputChange(rate.id, 'discount_percent', Number(e.target.value))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#C5A059]"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
