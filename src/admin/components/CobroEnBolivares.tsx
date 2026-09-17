import React from 'react'
import { dolaresDeBolivares, formatoBolivares } from '../../utils/bolivares'

/**
 * Bloque para registrar un abono cobrado en bolivares.
 *
 * Mientras esta activo, el monto en dolares NO se escribe a mano: sale de dividir los
 * bolivares entre la tasa. Si se pudieran tocar los dos por separado acabarian sin
 * cuadrar, y entonces ni el saldo de la reserva ni la contabilidad dirian la verdad.
 */

interface Props {
  activo: boolean
  onActivo: (v: boolean) => void
  bolivares: string
  onBolivares: (v: string) => void
  tasa: string
  onTasa: (v: string) => void
  /** Tasa del euro del BCV: la que la posada usa para cobrar en bolivares. */
  referencia: number | null
  /** true para la version apretada, dentro del panel de abonos. */
  compacto?: boolean
}

const CobroEnBolivares: React.FC<Props> = ({
  activo, onActivo, bolivares, onBolivares, tasa, onTasa, referencia, compacto,
}) => {
  const dolares = dolaresDeBolivares(bolivares, tasa)
  const etiqueta = compacto ? 'text-[9px]' : 'text-[10px]'
  const campo = compacto ? 'px-3 py-2 text-xs' : 'px-3 py-2.5 text-xs'

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-3 space-y-2.5">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={activo}
          onChange={e => onActivo(e.target.checked)}
          className="rounded text-[#C5A059] focus:ring-[#C5A059]"
        />
        <span className="text-xs font-bold text-gray-700">Cobrado en bolívares</span>
      </label>

      {activo && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={`${etiqueta} font-bold text-gray-400 uppercase tracking-widest block mb-1`}>
                Bolívares recibidos
              </label>
              <input
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                placeholder="Ej. 48884"
                value={bolivares}
                onChange={e => onBolivares(e.target.value)}
                className={`w-full border border-gray-200 rounded-xl ${campo} outline-none focus:border-[#C5A059]`}
              />
            </div>
            <div>
              <label className={`${etiqueta} font-bold text-gray-400 uppercase tracking-widest block mb-1`}>
                Tasa aplicada
              </label>
              <input
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                placeholder="Ej. 977,68"
                value={tasa}
                onChange={e => onTasa(e.target.value)}
                className={`w-full border border-gray-200 rounded-xl ${campo} outline-none focus:border-[#C5A059]`}
              />
            </div>
          </div>

          {referencia && referencia > 0 && (
            <button
              type="button"
              onClick={() => onTasa(String(referencia))}
              className="text-[10px] font-semibold text-[#C5A059] hover:underline"
            >
              Usar la tasa del euro (BCV) de hoy: {referencia.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </button>
          )}

          <div className="rounded-lg bg-white border border-gray-200 px-3 py-2">
            {dolares > 0 ? (
              <p className="text-xs text-gray-700">
                {formatoBolivares(Number(String(bolivares).replace(',', '.')))}
                {' ÷ '}
                {tasa}
                {' = '}
                <span className="font-bold text-emerald-600">
                  {dolares.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $
                </span>
              </p>
            ) : (
              <p className="text-xs text-gray-400 italic">
                Escriba los bolívares y la tasa para calcular el abono.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default CobroEnBolivares
