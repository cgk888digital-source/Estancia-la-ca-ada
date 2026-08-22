import { AlertTriangle } from 'lucide-react'

/**
 * Aviso de que los datos de la pantalla no se pudieron cargar.
 *
 * Existe porque antes, cuando la consulta fallaba, estas pantallas rellenaban con los
 * datos de demostracion de la plantilla y no decian nada: la dueña veia empleados,
 * reservas y dinero que no existen, con toda la apariencia de ser reales, y podia
 * tomar decisiones sobre cifras inventadas. Es preferible una pantalla vacia con una
 * explicacion que una pantalla llena de mentiras.
 */
export default function LoadErrorBanner({ message }: { message: string | null }) {
  if (!message) return null

  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4"
    >
      <AlertTriangle size={20} className="mt-0.5 shrink-0 text-red-500" />
      <div className="min-w-0">
        <p className="text-sm font-bold text-red-900">No se pudieron cargar los datos</p>
        <p className="mt-1 text-xs leading-relaxed text-red-800">
          Lo que ve en esta pantalla puede estar incompleto. Revise su conexión y vuelva
          a entrar antes de registrar nada.
        </p>
        <p className="mt-1 text-[11px] text-red-700/70">{message}</p>
      </div>
    </div>
  )
}
