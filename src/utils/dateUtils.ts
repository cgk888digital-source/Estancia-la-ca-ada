// "new Date('YYYY-MM-DD')" se interpreta en UTC y puede mostrar un día menos según la zona
// horaria del navegador. Esta función arma la fecha en hora local para evitar ese desfase.
export const parseLocalDate = (dateStr: string) => {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

// Fecha del dia en curso en formato YYYY-MM-DD segun el reloj local.
//
// `toISOString()` pasa por UTC, y en Venezuela (UTC-4) eso adelanta un dia a partir de
// las ocho de la noche: una cena cobrada a las nueve quedaba anotada con la fecha de
// manana y desaparecia del dia en curso.
export const fechaLocalISO = (d: Date = new Date()) => {
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}
