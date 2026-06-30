import React, { useState } from 'react'
import { Lock, ArrowRight, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { motion, AnimatePresence } from 'framer-motion'

const LoginPage: React.FC = () => {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const { login } = useAuth()

  const handleKeyPress = (num: string) => {
    if (pin.length < 4) {
      setPin(prev => prev + num)
      setError(false)
    }
  }

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1))
    setError(false)
  }

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (pin.length === 4) {
      const success = login(pin)
      if (!success) {
        setError(true)
        setPin('')
      }
    }
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

        <form onSubmit={handleSubmit}>
          {/* PIN Display */}
          <div className="flex justify-center gap-3 mb-8">
            {[0, 1, 2, 3].map(i => (
              <div
                key={i}
                className={`w-4 h-4 rounded-full transition-all ${
                  error ? 'bg-red-400' :
                  i < pin.length ? 'bg-[#C5A059]' : 'bg-gray-200'
                }`}
              />
            ))}
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
        </form>
      </motion.div>
    </div>
  )
}

export default LoginPage
