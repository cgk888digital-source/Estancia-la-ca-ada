import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface HotelSettings {
  checkin_time: string
  checkout_time: string
  table_count: string
}

const DEFAULTS: HotelSettings = {
  checkin_time: '2:00 PM',
  checkout_time: '11:00 AM',
  table_count: '6',
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
          if (row.key === 'checkin_time' || row.key === 'checkout_time' || row.key === 'table_count') {
            map[row.key] = row.value
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
