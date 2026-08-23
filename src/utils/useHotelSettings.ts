import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface HotelSettings {
  checkin_time: string
  checkout_time: string
  table_count: string
  /** Precio del desayuno por adulto, por noche. Editable en Tarifas y Descuentos. */
  meal_breakfast_adult: string
  /** Precio de la cena por adulto, por noche. */
  meal_dinner_adult: string
  /** Precio del desayuno por niño (3-12 años), por noche. */
  meal_breakfast_child: string
  /** Precio de la cena por niño (3-12 años), por noche. */
  meal_dinner_child: string
  /** Alimentación total por adulto y noche en temporada navideña (21 dic - 7 ene).
   *  En navidad sube; el niño se mantiene igual todo el año. */
  meal_adult_navidad: string
}

// Valores verificados contra el grid de Paxer: 56 por adulto y 48 por niño y noche el
// resto del año, y 62 por adulto en temporada navideña.
const DEFAULTS: HotelSettings = {
  checkin_time: '2:00 PM',
  checkout_time: '11:00 AM',
  table_count: '6',
  meal_breakfast_adult: '22',
  meal_dinner_adult: '34',
  meal_breakfast_child: '20',
  meal_dinner_child: '28',
  meal_adult_navidad: '62',
}

const SETTING_KEYS = Object.keys(DEFAULTS) as (keyof HotelSettings)[]

/**
 * Alimentación por persona y noche, que se suma a la tarifa de la habitación.
 *
 * El adulto cuesta mas en navidad; el niño vale igual todo el año. Si por lo que sea la
 * tarifa navideña no estuviera cargada, se usa la normal en su lugar: es preferible
 * cobrar de menos a cobrar un disparate.
 */
export function getMealRates(settings: HotelSettings) {
  const perAdult = Number(settings.meal_breakfast_adult) + Number(settings.meal_dinner_adult)
  const navideno = Number(settings.meal_adult_navidad)
  return {
    perAdult,
    perAdultNavidad: Number.isFinite(navideno) && navideno > 0 ? navideno : perAdult,
    perChild: Number(settings.meal_breakfast_child) + Number(settings.meal_dinner_child),
  }
}

export function useHotelSettings() {
  const [settings, setSettings] = useState<HotelSettings>(DEFAULTS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    const fetchSettings = async () => {
      const { data, error } = await supabase
        .from('hotel_settings')
        .select('key, value')

      if (!error && data && active) {
        const map: Partial<HotelSettings> = {}
        data.forEach((row: { key: string; value: string }) => {
          if ((SETTING_KEYS as string[]).includes(row.key)) {
            map[row.key as keyof HotelSettings] = row.value
          }
        })
        setSettings(prev => ({ ...prev, ...map }))
      }
      if (active) setLoading(false)
    }
    fetchSettings()
    return () => { active = false }
  }, [])

  return { settings, loading }
}
