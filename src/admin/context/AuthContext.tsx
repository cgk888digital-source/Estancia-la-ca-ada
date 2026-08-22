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

// Configuración de PINs para los 3 niveles de acceso
const PINS: Record<string, { email: string; role: Role; pass: string; label: string }> = {
  '1234': { email: 'propiedad@estancialacanada.com', role: 'propiedad', pass: 'password1234', label: 'La Propiedad' },
  '2222': { email: 'admin@estancialacanada.com', role: 'administracion', pass: 'password2222', label: 'Administración' },
  '3333': { email: 'restaurante@estancialacanada.com', role: 'restaurante', pass: 'password3333', label: 'Restaurante & Cocina' },
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

      if (savedPin && PINS[savedPin]) {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          const user = PINS[savedPin]
          const { error } = await supabase.auth.signInWithPassword({
            email: user.email,
            password: user.pass,
          })
          if (error && active) {
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
    const user = PINS[pin]
    if (!user) return null

    const { error } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: user.pass,
    })

    if (error) {
      console.error('Error authenticating admin user:', error)
      return null
    }

    setRole(user.role)
    setSessionReady(true)
    setSessionExpired(false)
    try {
      localStorage.setItem('adminRole', user.role)
      localStorage.setItem('adminPin', pin)
    } catch { /* modo privado del navegador */ }

    return user.role
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

