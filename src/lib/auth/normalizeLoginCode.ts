const ACCESS_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

function isValidChar(c: string) {
  return ACCESS_CODE_ALPHABET.includes(c)
}

/** Normalize 8TD-SBW-3QK or 8TDSBW3QK to dashed form for the API */
export function normalizeLoginCode(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ''

  const alphanumeric = trimmed.toUpperCase().replace(/[^A-Z0-9]/g, '')

  if (alphanumeric.length !== 9 || !alphanumeric.split('').every(isValidChar)) {
    return trimmed
  }

  return `${alphanumeric.slice(0, 3)}-${alphanumeric.slice(3, 6)}-${alphanumeric.slice(6)}`
}
