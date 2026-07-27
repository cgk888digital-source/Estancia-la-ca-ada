import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../../lib/supabase'

export type Role = 'propiedad' | 'administracion' | 'restaurante'

interface AuthContextType {
  role: Role | null
  sessionReady: boolean
  login: (pin: string) => Promise<boolean>
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
    } catch (e) {
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
    } catch (e) {
      return true
    }
  })

  // On mount, restore the real Supabase session BEFORE letting protected pages query RLS-protected tables
  useEffect(() => {
    let active = true
    const restoreSession = async () => {
      const savedPin = localStorage.getItem('adminPin')
      if (savedPin && PINS[savedPin]) {
        const user = PINS[savedPin]
        await supabase.auth.signInWithPassword({
          email: user.email,
          password: user.pass,
        }).catch(() => {})
      }
      if (active) setSessionReady(true)
    }
    restoreSession()
    return () => { active = false }
  }, [])

  const login = useCallback(async (pin: string): Promise<boolean> => {
    const user = PINS[pin]
    if (!user) return false

    const { error } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: user.pass,
    })

    if (error) {
      console.error('Error authenticating admin user:', error)
      return false
    }

    setRole(user.role)
    setSessionReady(true)
    try {
      localStorage.setItem('adminRole', user.role)
      localStorage.setItem('adminPin', pin)
    } catch (e) {}

    return true
  }, [])

  const logout = useCallback(async () => {
    setRole(null)
    try {
      localStorage.removeItem('adminRole')
      localStorage.removeItem('adminPin')
    } catch (e) {}
    await supabase.auth.signOut().catch(() => {})
  }, [])

  const value = useMemo(() => ({ role, sessionReady, login, logout }), [role, sessionReady, login, logout])

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

