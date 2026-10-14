/**
 * Lo que se cobra por las mascotas de una reserva: cada perro, cada noche.
 *
 * La tarifa anunciada es la del perro pequeño y se cambia en Tarifas y Descuentos. Si el
 * perro es más grande, se cambia en la propia reserva. La tarifa aplicada se guarda en la
 * reserva (`pet_fee_night`), para que al editar fechas o habitaciones se recalcule con el
 * precio que se pactó y no con el que esté anunciado ese día.
 */
export const cargoMascotas = (mascotas: number, tarifaPorNoche: number, noches: number) =>
  mascotas > 0 && tarifaPorNoche > 0 && noches > 0 ? mascotas * tarifaPorNoche * noches : 0

/** «1 mascota × 10 $/noche × 3 noches = 30 $», para las notas de la reserva. */
export const notaDeMascotas = (mascotas: number, tarifaPorNoche: number, noches: number) => {
  const total = cargoMascotas(mascotas, tarifaPorNoche, noches)
  if (total <= 0) return ''
  return `Mascotas: ${mascotas} × ${tarifaPorNoche} $/noche × ${noches} ${noches === 1 ? 'noche' : 'noches'} = ${total} $.`
}
