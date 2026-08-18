import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, ArrowRight, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { motion, AnimatePresence } from 'framer-motion'

const LoginPage: React.FC = () => {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)
  const { login, sessionExpired } = useAuth()
  const navigate = useNavigate()

  const handleKeyPress = (num: string) => {
    if (pin.length < 4) {
      const newPin = pin + num
      setPin(newPin)
      setError(false)
      if (newPin.length === 4) {
        executeLogin(newPin)
      }
    }
  }

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1))
    setError(false)
  }

  const executeLogin = async (pinToUse: string) => {
    setLoading(true)
    const success = await login(pinToUse)
    setLoading(false)

    if (success) {
      if (pinToUse === '3333') {
        navigate('/admin/comandas', { replace: true })
      } else if (pinToUse === '2222') {
        navigate('/admin/reservas', { replace: true })
      } else {
        navigate('/admin', { replace: true })
      }
    } else {
      setError(true)
      setPin('')
    }
  }

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (pin.length === 4) {
      executeLogin(pin)
    }
  }

  const handleQuickRole = (rolePin: string) => {
    setPin(rolePin)
    setError(false)
    executeLogin(rolePin)
  }

  return (
    <div className="min-h-screen bg-[#121212] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm bg-white rounded-3xl p-8 shadow-2xl relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-2 bg-[#C5A059]" />
        
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[#C5A059]/10 rounded-full flex items-center justify-center mx-auto mb-4 text-[#C5A059]">
            <Lock size={32} />
          </div>
          <h1 className="text-2xl font-serif text-[#3D2B1F] mb-1">Acceso Restringido</h1>
          <p className="text-sm text-gray-500">Ingrese su PIN de seguridad</p>
        </div>

        {/* Sin esto, volver a pedir el PIN parece un fallo. Y es importante que lo vea:
            trabajar con la sesión caída era justo lo que hacía que no se guardara nada. */}
        {sessionExpired && (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center">
            <p className="text-sm font-bold text-amber-900">Su sesión se cerró</p>
            <p className="mt-1 text-xs leading-relaxed text-amber-800">
              Vuelva a ingresar su PIN. Es necesario para que los cambios que haga
              queden guardados de verdad.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* PIN Display */}
          <div className="flex justify-center gap-3 mb-8">
            {loading ? (
              <div className="animate-pulse flex gap-3">
                {[0, 1, 2, 3].map(i => (
                  <div key={i} className="w-4 h-4 rounded-full bg-[#C5A059]" />
                ))}
              </div>
            ) : (
              [0, 1, 2, 3].map(i => (
                <div
                  key={i}
                  className={`w-4 h-4 rounded-full transition-all ${
                    error ? 'bg-red-400' :
                    i < pin.length ? 'bg-[#C5A059]' : 'bg-gray-200'
                  }`}
                />
              ))
            )}
          </div>

          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-red-500 text-xs font-bold text-center mb-6"
              >
                PIN Incorrecto
              </motion.p>
            )}
          </AnimatePresence>

          {/* Keypad */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
              <button
                key={num}
                type="button"
                onClick={() => handleKeyPress(num.toString())}
                className="w-16 h-16 rounded-2xl bg-gray-50 hover:bg-gray-100 text-[#3D2B1F] text-2xl font-semibold mx-auto transition-colors focus:outline-none focus:ring-2 focus:ring-[#C5A059]/50"
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              onClick={handleDelete}
              className="w-16 h-16 rounded-2xl text-gray-400 hover:bg-red-50 hover:text-red-500 mx-auto flex items-center justify-center transition-colors"
            >
              <X size={24} />
            </button>
            <button
              type="button"
              onClick={() => handleKeyPress('0')}
              className="w-16 h-16 rounded-2xl bg-gray-50 hover:bg-gray-100 text-[#3D2B1F] text-2xl font-semibold mx-auto transition-colors focus:outline-none focus:ring-2 focus:ring-[#C5A059]/50"
            >
              0
            </button>
            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={pin.length < 4}
              className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center transition-all ${
                pin.length === 4 
                  ? 'bg-[#C5A059] text-white hover:bg-[#b8904a] shadow-lg shadow-[#C5A059]/30' 
                  : 'bg-gray-100 text-gray-300'
              }`}
            >
              <ArrowRight size={24} />
            </button>
          </div>

          {/* Role PIN Quick Fill */}
          <div className="pt-4 border-t border-gray-100 flex flex-col gap-2">
            <p className="text-[10px] uppercase tracking-widest text-center text-gray-400 font-bold mb-1">Niveles de Acceso (PIN):</p>
            <div className="grid grid-cols-3 gap-1.5 text-[10px]">
              <button
                type="button"
                onClick={() => handleQuickRole('3333')}
                className="p-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 font-medium text-center transition-colors border border-amber-200/60"
              >
                <span className="block font-bold">3333</span>
                <span>Restaurante</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickRole('2222')}
                className="p-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-900 font-medium text-center transition-colors border border-blue-200/60"
              >
                <span className="block font-bold">2222</span>
                <span>Admin</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickRole('1234')}
                className="p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-medium text-center transition-colors border border-emerald-200/60"
              >
                <span className="block font-bold">1234</span>
                <span>Propiedad</span>
              </button>
            </div>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

export default LoginPage
