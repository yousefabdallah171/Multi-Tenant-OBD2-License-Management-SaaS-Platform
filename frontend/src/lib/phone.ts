export function normalizeStrictPhoneInput(value: string) {
  const compact = value.replace(/[^\d+]/g, '')
  if (compact.startsWith('+')) {
    return `+${compact.slice(1).replace(/\+/g, '')}`
  }

  return compact.replace(/\+/g, '')
}

export function isStrictPhoneCharacters(value: string) {
  return /^\+?\d*$/.test(value)
}

export function isValidStrictPhone(value: string) {
  return /^\+?\d{6,20}$/.test(value)
}
