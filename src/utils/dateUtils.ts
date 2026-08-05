// "new Date('YYYY-MM-DD')" se interpreta en UTC y puede mostrar un día menos según la zona
// horaria del navegador. Esta función arma la fecha en hora local para evitar ese desfase.
export const parseLocalDate = (dateStr: string) => {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}
