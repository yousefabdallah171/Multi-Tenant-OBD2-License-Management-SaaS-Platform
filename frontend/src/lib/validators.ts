export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export function isRequired(value: string) {
  return value.trim().length > 0
}

export function isValidBiosId(value: string) {
  return /^[A-Za-z0-9_-]{4,}$/.test(value.trim())
}
