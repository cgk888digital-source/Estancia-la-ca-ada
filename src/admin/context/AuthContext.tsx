import React, { createContext, useContext, useState } from 'react'

export type Role = 'admin' | 'gerente' | 'empleado'

interface AuthContextType {
  role: Role | null
  login: (pin: string) => boolean
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Configuración de PINs rápidos
const PINS: Record<string, Role> = {
  '1234': 'admin',
  '5555': 'gerente',
  '9999': 'empleado'
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRole] = useState<Role | null>(() => {
    // Restaurar sesión de localStorage al cargar
    const saved = localStorage.getItem('adminRole')
    return (saved as Role) || null
  })

  const login = (pin: string) => {
    const foundRole = PINS[pin]
    if (foundRole) {
      setRole(foundRole)
      localStorage.setItem('adminRole', foundRole)
      return true
    }
    return false
  }

  const logout = () => {
    setRole(null)
    localStorage.removeItem('adminRole')
  }

  return (
    <AuthContext.Provider value={{ role, login, logout }}>
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
