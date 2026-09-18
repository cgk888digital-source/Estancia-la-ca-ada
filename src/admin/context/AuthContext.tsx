import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../../lib/supabase'

export type Role = 'propiedad' | 'administracion' | 'restaurante'

interface AuthContextType {
  role: Role | null
  sessionReady: boolean
  /** La sesión con la base de datos se perdió y hubo que volver a pedir el PIN. */
  sessionExpired: boolean
  /** Devuelve el rol si el PIN es correcto, o null si no. */
  login: (pin: string) => Promise<Role | null>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

/**
 * Cambia un PIN por una sesión, en el servidor.
 *
 * Aquí vivía el mapa PIN -> correo + contraseña. Como este fichero acaba dentro del
 * JavaScript que sirve la web, las tres contraseñas se podían leer desde la pestaña de
 * red de cualquier navegador, sin saber nada de nada. Ahora el mapa está en una tabla
 * que solo lee la función `admin-login` con la clave de servicio, y aquí no queda
 * ninguna contraseña: se manda el PIN y vuelve una sesión ya hecha.
 */
interface SesionDelPin {
  access_token: string
  refresh_token: string
  role: Role
}

async function pedirSesion(pin: string): Promise<SesionDelPin | null> {
  const { data, error } = await supabase.functions.invoke('admin-login', { body: { pin } })
  // Un PIN incorrecto vuelve como error HTTP, igual que un fallo de red. Desde aquí no
  // se distinguen, y tampoco hace falta: en los dos casos no se entra.
  if (error || !data?.access_token || !data?.refresh_token || !data?.role) return null
  return data as SesionDelPin
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRole] = useState<Role | null>(() => {
    try {
      const saved = localStorage.getItem('adminRole')
      return (saved as Role) || null
    } catch {
      return null
    }
  })
  // Empieza en false cuando hay un rol guardado: las páginas protegidas (bookings,
  // transactions, etc.) esperan esto antes de consultar Supabase, para no disparar
  // sus queries antes de que exista una sesión real y quedarse "pegadas" por el
  // lock interno de supabase-js mientras se resuelve el signIn de fondo.
  const [sessionReady, setSessionReady] = useState(() => {
    try {
      return !localStorage.getItem('adminPin')
    } catch {
      return true
    }
  })

  const [sessionExpired, setSessionExpired] = useState(false)

  const clearStored = () => {
    try {
      localStorage.removeItem('adminRole')
      localStorage.removeItem('adminPin')
    } catch { /* modo privado del navegador */ }
  }

  // Al abrir, restaura la sesión real de Supabase ANTES de dejar que las páginas
  // protegidas consulten tablas con RLS.
  //
  // Antes esto se tragaba el fallo con .catch(() => {}) y ponía sessionReady = true
  // igualmente: el panel se abría sin pedir PIN, con la apariencia normal, pero el
  // cliente de Supabase quedaba ANÓNIMO. Como anónimo solo tiene permiso de lectura,
  // todo se veía bien y ningún guardado entraba — así se perdió un día de trabajo.
  // Sin sesión real es preferible volver a pedir el PIN que dejar trabajar en vano.
  useEffect(() => {
    let active = true
    const restoreSession = async () => {
      const savedPin = localStorage.getItem('adminPin')
      const savedRole = localStorage.getItem('adminRole')

      if (savedPin) {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          const nueva = await pedirSesion(savedPin)
          if (nueva) {
            await supabase.auth.setSession({
              access_token: nueva.access_token,
              refresh_token: nueva.refresh_token,
            })
          } else if (active) {
            clearStored()
            setRole(null)
            setSessionExpired(true)
          }
        }
      } else if (savedRole && active) {
        // Hay rol guardado pero no PIN: no hay manera de recuperar la sesión.
        clearStored()
        setRole(null)
        setSessionExpired(true)
      }
      if (active) setSessionReady(true)
    }
    restoreSession()
    return () => { active = false }
  }, [])

  // Si la sesión se cae mientras trabaja (el token deja de renovarse), el panel no
  // puede seguir aparentando que todo va bien: se pide el PIN de nuevo.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session)) {
        clearStored()
        setRole(null)
        setSessionExpired(true)
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const login = useCallback(async (pin: string): Promise<Role | null> => {
    const sesion = await pedirSesion(pin)
    if (!sesion) return null

    const { error } = await supabase.auth.setSession({
      access_token: sesion.access_token,
      refresh_token: sesion.refresh_token,
    })

    if (error) {
      console.error('No se pudo montar la sesión del panel:', error)
      return null
    }

    setRole(sesion.role)
    setSessionReady(true)
    setSessionExpired(false)
    try {
      localStorage.setItem('adminRole', sesion.role)
      localStorage.setItem('adminPin', pin)
    } catch { /* modo privado del navegador */ }

    return sesion.role
  }, [])

  const logout = useCallback(async () => {
    setRole(null)
    try {
      localStorage.removeItem('adminRole')
      localStorage.removeItem('adminPin')
    } catch { /* modo privado del navegador */ }
    await supabase.auth.signOut().catch(() => {})
  }, [])

  const value = useMemo(
    () => ({ role, sessionReady, sessionExpired, login, logout }),
    [role, sessionReady, sessionExpired, login, logout]
  )

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

