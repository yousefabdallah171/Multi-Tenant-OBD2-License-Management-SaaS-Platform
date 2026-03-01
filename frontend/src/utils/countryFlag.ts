export function countryCodeToFlag(code: string): string {
  const normalized = code.trim().toUpperCase()
  if (normalized.length !== 2 || !/^[A-Z]{2}$/.test(normalized)) {
    return '\u{1F3F3}\uFE0F'
  }

  return [...normalized]
    .map((char) => String.fromCodePoint(0x1f1e6 - 65 + char.charCodeAt(0)))
    .join('')
}

export function formatIpLocation(country: string, city: string, countryCode: string): string {
  if (!country && !city) {
    return '\u{1F3F3}\uFE0F Unknown'
  }

  return `${countryCodeToFlag(countryCode)} ${country}${city ? ` / ${city}` : ''}`.trim()
}

export function isPrivateOrLocalIp(ip: string): boolean {
  return (
    ip === '127.0.0.1'
    || ip === '::1'
    || ip.startsWith('10.')
    || ip.startsWith('192.168.')
    || /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)
  )
}
