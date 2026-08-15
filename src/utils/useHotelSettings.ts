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
}

// Los valores de alimentación suman el total histórico verificado contra Paxer:
// $56 por adulto y $48 por niño, por noche.
const DEFAULTS: HotelSettings = {
  checkin_time: '2:00 PM',
  checkout_time: '11:00 AM',
  table_count: '6',
  meal_breakfast_adult: '28',
  meal_dinner_adult: '28',
  meal_breakfast_child: '24',
  meal_dinner_child: '24',
}

const SETTING_KEYS = Object.keys(DEFAULTS) as (keyof HotelSettings)[]

/** Total de alimentación por noche que se suma a la tarifa de la habitación. */
export function getMealRates(settings: HotelSettings) {
  return {
    perAdult: Number(settings.meal_breakfast_adult) + Number(settings.meal_dinner_adult),
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
