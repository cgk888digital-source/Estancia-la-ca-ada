import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Share, Plus, Download } from 'lucide-react'

/** Evento propietario de Chromium; todavia no esta en las definiciones estandar de TS. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'estancia_install_dismissed_at'
const DISMISS_DAYS = 14
const IOS_HELP_DELAY_MS = 3000

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (window.navigator as Navigator & { standalone?: boolean }).standalone === true

const isIOS = () => {
  const ua = window.navigator.userAgent
  // iPadOS 13+ se identifica como Macintosh; se distingue por el soporte tactil.
  return /iphone|ipod|ipad/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)
}

const wasRecentlyDismissed = () => {
  const raw = localStorage.getItem(DISMISS_KEY)
  if (!raw) return false
  return Date.now() - Number(raw) < DISMISS_DAYS * 24 * 60 * 60 * 1000
}

/**
 * Invita a instalar la app en la pantalla de inicio del telefono.
 *
 * En Android/Chrome usa el evento `beforeinstallprompt` para instalar con un toque.
 * Safari en iOS nunca dispara ese evento —la instalacion siempre es manual— asi que
 * ahi se muestran las instrucciones de Compartir > Anadir a pantalla de inicio.
 */
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIOSHelp, setShowIOSHelp] = useState(false)

  useEffect(() => {
    if (isStandalone() || wasRecentlyDismissed()) return

    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
      setDeferred(null)
      setShowIOSHelp(false)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)

    let timer: number | undefined
    if (isIOS()) timer = window.setTimeout(() => setShowIOSHelp(true), IOS_HELP_DELAY_MS)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
      if (timer !== undefined) clearTimeout(timer)
    }
  }, [])

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setDeferred(null)
    setShowIOSHelp(false)
  }

  const install = async () => {
    if (!deferred) return
    await deferred.prompt()
    await deferred.userChoice
    setDeferred(null)
  }

  const visible = deferred !== null || showIOSHelp

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ type: 'spring', damping: 26, stiffness: 240 }}
          className="fixed bottom-0 left-1/2 -translate-x-1/2 z-[200] w-full max-w-[430px] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        >
          <div className="relative rounded-2xl bg-brand-neutral shadow-2xl ring-1 ring-brand-primary/10 p-4">
            <button
              onClick={dismiss}
              aria-label="Cerrar"
              className="absolute top-3 right-3 p-1 rounded-full text-brand-primary/40 hover:text-brand-primary/70 active:scale-90 transition"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 pr-6">
              <img
                src="/pwa-192x192.png"
                alt="Estancia La Cañada"
                className="w-14 h-14 rounded-xl shadow-md shrink-0"
              />
              <div className="min-w-0">
                <h3 className="font-serif text-lg leading-tight text-brand-primary">
                  Instala Estancia La Cañada
                </h3>
                <p className="text-xs text-brand-primary/60 leading-snug mt-0.5">
                  Añádela a tu pantalla de inicio y ábrela como una app, sin buscar el enlace.
                </p>
              </div>
            </div>

            {deferred ? (
              <button
                onClick={install}
                className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl bg-brand-terracotta py-3 text-white font-bold text-sm uppercase tracking-widest active:scale-95 transition"
              >
                <Download size={18} />
                Instalar app
              </button>
            ) : (
              <div className="mt-4 rounded-xl bg-brand-primary/5 p-3 space-y-2">
                <Step n={1}>
                  Toca <Share size={14} className="inline-block mx-0.5 -mt-0.5 text-brand-terracotta" />
                  <strong className="font-semibold"> Compartir</strong> en la barra de Safari.
                </Step>
                <Step n={2}>
                  Elige <Plus size={14} className="inline-block mx-0.5 -mt-0.5 text-brand-terracotta" />
                  <strong className="font-semibold"> Añadir a pantalla de inicio</strong>.
                </Step>
                <Step n={3}>
                  Confirma con <strong className="font-semibold">Añadir</strong>. El icono queda en tu inicio.
                </Step>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5 items-start">
      <span className="shrink-0 w-5 h-5 rounded-full bg-brand-terracotta text-white text-[11px] font-bold flex items-center justify-center">
        {n}
      </span>
      <p className="text-xs text-brand-primary/75 leading-relaxed">{children}</p>
    </div>
  )
}
