import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, ArrowRight, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { motion, AnimatePresence } from 'framer-motion'

// Un PIN de cuatro cifras son diez mil combinaciones: a mano no es nada. Esto no
// sustituye a un limite en el servidor, pero corta el probar una tras otra.
const INTENTOS_MAXIMOS = 5
const ESPERA_MS = 60_000
const CLAVE_BLOQUEO = 'estancia_admin_bloqueo'

const leerBloqueo = (): number => {
  try {
    return Number(localStorage.getItem(CLAVE_BLOQUEO)) || 0
  } catch {
    return 0
  }
}

const guardarBloqueo = (hasta: number) => {
  try {
    localStorage.setItem(CLAVE_BLOQUEO, String(hasta))
  } catch { /* modo privado del navegador */ }
}

/** Momento en que termina un bloqueo que empieza ahora. */
const calcularFinDeBloqueo = () => Date.now() + ESPERA_MS

/** Segundos que faltan, o 0 si ya paso. */
const segundosHasta = (momento: number) =>
  Math.max(0, Math.ceil((momento - Date.now()) / 1000))

const LoginPage: React.FC = () => {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)
  const [fallos, setFallos] = useState(0)
  const [bloqueadoHasta, setBloqueadoHasta] = useState(0)
  const [segundosRestantes, setSegundosRestantes] = useState(0)

  // Manda el momento de fin, no la cuenta atras: asi el teclado queda cerrado desde el
  // primer instante y no durante el medio segundo que tarda el primer tic.
  const bloqueado = bloqueadoHasta > 0

  // Un bloqueo anterior sigue valiendo aunque se recargue la pagina.
  useEffect(() => {
    const guardado = leerBloqueo()
    if (segundosHasta(guardado) > 0) iniciarBloqueo(guardado)
  }, [])

  // Cuenta atras visible; al llegar a cero el bloqueo se levanta solo.
  useEffect(() => {
    if (!bloqueadoHasta) return
    const t = setInterval(() => {
      const quedan = segundosHasta(bloqueadoHasta)
      setSegundosRestantes(quedan)
      if (quedan === 0) setBloqueadoHasta(0)
    }, 500)
    return () => clearInterval(t)
  }, [bloqueadoHasta])

  function iniciarBloqueo(hasta: number) {
    setBloqueadoHasta(hasta)
    setSegundosRestantes(segundosHasta(hasta))
  }
  const { login, sessionExpired } = useAuth()
  const navigate = useNavigate()

  const handleKeyPress = (num: string) => {
    if (bloqueado) return
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
    const rol = await login(pinToUse)
    setLoading(false)

    if (rol) {
      // Se enruta por el rol, no por el PIN: asi el codigo publico no revela
      // que PINes existen ni a quien pertenecen.
      const destino = rol === 'restaurante' ? '/admin/comandas'
        : rol === 'administracion' ? '/admin/reservas'
        : '/admin'
      navigate(destino, { replace: true })
    } else {
      setError(true)
      setPin('')
      const nuevosFallos = fallos + 1
      setFallos(nuevosFallos)
      if (nuevosFallos >= INTENTOS_MAXIMOS) {
        const hasta = calcularFinDeBloqueo()
        guardarBloqueo(hasta)
        iniciarBloqueo(hasta)
        setFallos(0)
      }
    }
  }

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (bloqueado) return
    if (pin.length === 4) {
      executeLogin(pin)
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

          {bloqueado && (
            <div role="alert" className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-center">
              <p className="text-sm font-bold text-red-900">Demasiados intentos</p>
              <p className="mt-1 text-xs text-red-800">
                Espere {segundosRestantes} segundo{segundosRestantes === 1 ? '' : 's'} para volver a intentarlo.
              </p>
            </div>
          )}

          {/* Keypad */}
          <div className={`grid grid-cols-3 gap-4 mb-6 ${bloqueado ? 'opacity-40 pointer-events-none' : ''}`}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
              <button
                key={num}
                type="button"
                onClick={() => handleKeyPress(num.toString())}
                disabled={bloqueado}
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
              disabled={pin.length < 4 || bloqueado}
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
