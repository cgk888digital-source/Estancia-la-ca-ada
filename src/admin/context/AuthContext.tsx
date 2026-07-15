import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../../lib/supabase'

export type Role = 'admin' | 'gerente' | 'empleado'

interface AuthContextType {
  role: Role | null
  login: (pin: string) => Promise<boolean>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Configuración de PINs rápidos -> Mapeado a usuarios reales
/*
const PINS: Record<string, { email: string; role: Role }> = {
  '1234': { email: 'admin@estancialacanada.com', role: 'admin' },
  '5555': { email: 'gerente@estancialacanada.com', role: 'gerente' }
}
*/

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRole] = useState<Role | null>(() => {
    const saved = localStorage.getItem('adminRole')
    return (saved as Role) || null
  })

  useEffect(() => {
    // Escuchar cambios de sesión reales de Supabase
    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        // En una app más robusta, obtendríamos el rol desde la base de datos (user_roles).
        // Por eficiencia, lo mantenemos sincronizado con el localStorage que guardamos en login.
        const saved = localStorage.getItem('adminRole')
        if (saved) {
          setRole(saved as Role)
        }
      } else {
        setRole(null)
        localStorage.removeItem('adminRole')
      }
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [])

  const login = useCallback(async (_pin: string): Promise<boolean> => {
    // Bypassing real authentication temporarily
    setRole('admin')
    localStorage.setItem('adminRole', 'admin')
    return true
  }, [])

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
    setRole(null)
    localStorage.removeItem('adminRole')
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
