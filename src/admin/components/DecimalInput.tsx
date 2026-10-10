import React, { useEffect, useState } from 'react'

/** Convierte texto con formato de moneda venezolano o decimal internacional a número */
export const parseLocalNumber = (val: string | number | null | undefined): number => {
  if (typeof val === 'number') return isNaN(val) ? 0 : val
  if (!val) return 0
  const clean = String(val).trim()
  if (!clean) return 0
  if (clean.includes('.') && clean.includes(',')) {
    if (clean.lastIndexOf(',') > clean.lastIndexOf('.')) {
      return parseFloat(clean.replace(/\./g, '').replace(',', '.')) || 0
    } else {
      return parseFloat(clean.replace(/,/g, '')) || 0
    }
  }
  if (clean.includes(',')) {
    return parseFloat(clean.replace(',', '.')) || 0
  }
  return parseFloat(clean) || 0
}

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: number | null | undefined
  onChange: (value: number) => void
}

/**
 * Campo para montos con decimales que funciona en el celular.
 * Un <input type="number"> controlado con Number() se come el punto mientras se
 * escribe ("12." pasa a 12) y en teclados en español rechaza la coma. Aquí se
 * guarda el texto tal cual y solo se avisa del número, aceptando coma o punto.
 */
const DecimalInput: React.FC<Props> = ({ value, onChange, ...rest }) => {
  const [text, setText] = useState(value ? String(value) : '')

  // Si el número cambia desde fuera (calculadora, tasa, limpiar formulario),
  // se refleja; si es el mismo que ya hay escrito, se respeta lo que se teclea.
  useEffect(() => {
    const actual = value || 0
    if (parseLocalNumber(text) !== actual) setText(actual ? String(actual) : '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={text}
      onChange={e => {
        const limpio = e.target.value.replace(/[^\d.,]/g, '')
        setText(limpio)
        onChange(parseLocalNumber(limpio))
      }}
    />
  )
}

export default DecimalInput

/**
 * Para los campos que guardan el monto como texto: deja solo cifras y un punto
 * decimal, pasando la coma del teclado en español a punto, para que Number()
 * lo siga leyendo bien.
 */
export const textoDecimal = (val: string): string => {
  const limpio = val.replace(/,/g, '.').replace(/[^\d.]/g, '')
  const punto = limpio.indexOf('.')
  return punto === -1 ? limpio : limpio.slice(0, punto + 1) + limpio.slice(punto + 1).replace(/\./g, '')
}
