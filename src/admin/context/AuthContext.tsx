import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../../lib/supabase'

export type Role = 'propiedad' | 'administracion' | 'restaurante'

interface AuthContextType {
  role: Role | null
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

  // On mount, restore Supabase session in background so RLS policies work
  useEffect(() => {
    const savedPin = localStorage.getItem('adminPin')
    if (savedPin && PINS[savedPin]) {
      const user = PINS[savedPin]
      supabase.auth.signInWithPassword({
        email: user.email,
        password: user.pass,
      }).catch(() => {})
    }
  }, [])

  const login = useCallback(async (pin: string): Promise<boolean> => {
    const user = PINS[pin]
    if (!user) return false

    // Set role instantly for 0ms UI
    setRole(user.role)
    try {
      localStorage.setItem('adminRole', user.role)
      localStorage.setItem('adminPin', pin)
    } catch (e) {}

    // Auth in background so Supabase queries use authenticated role
    supabase.auth.signInWithPassword({
      email: user.email,
      password: user.pass,
    }).catch(() => {})

    return true
  }, [])

  const logout = useCallback(async () => {
    setRole(null)
    try {
      localStorage.removeItem('adminRole')
      localStorage.removeItem('adminPin')
    } catch (e) {}
    supabase.auth.signOut().catch(() => {})
  }, [])

  const value = useMemo(() => ({ role, login, logout }), [role, login, logout])

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

