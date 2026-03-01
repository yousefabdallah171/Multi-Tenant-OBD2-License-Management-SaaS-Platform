export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export function isRequired(value: string) {
  return value.trim().length > 0
}

export function isValidBiosId(value: string) {
  return /^[A-Za-z0-9_-]{4,}$/.test(value.trim())
}

export function validateEmail(value: string): string | null {
  return isValidEmail(value) ? null : 'Invalid email format.'
}

export function validateBiosId(value: string): string | null {
  if (!isRequired(value)) {
    return 'BIOS ID is required.'
  }

  return isValidBiosId(value) ? null : 'Invalid BIOS ID.'
}
