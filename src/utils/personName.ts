export interface PersonNameParts {
  firstName: string
  lastName: string
}

/**
 * The database currently stores the customer's name in a single column.
 * For existing records, use the final word as the surname so names such as
 * "Luis Enrique Feo" reopen as "Luis Enrique" + "Feo" in editable forms.
 */
export function splitPersonName(value: string): PersonNameParts {
  const cleanValue = value
    .replace(/\s+\((?:habitaci[oó]n\s+)?\d+\/\d+\)$/i, '')
    .trim()
    .replace(/\s+/g, ' ')
  const parts = cleanValue.split(' ').filter(Boolean)

  if (parts.length === 0) return { firstName: '', lastName: '' }
  if (parts.length === 1) return { firstName: parts[0], lastName: '' }

  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts[parts.length - 1]
  }
}

export function joinPersonName(firstName: string, lastName: string) {
  return `${firstName.trim()} ${lastName.trim()}`.trim().replace(/\s+/g, ' ')
}
