export function getFlag(_code: string | null | undefined): string {
  return ''
}

export function parseUserAgent(userAgent: string): string {
  const ua = userAgent.toLowerCase()

  const device = (() => {
    if (ua.includes('iphone')) return 'iPhone'
    if (ua.includes('ipad')) return 'iPad'
    if (ua.includes('android')) return 'Android'
    if (ua.includes('windows')) return 'Windows'
    if (ua.includes('macintosh') || ua.includes('mac os')) return 'Mac'
    if (ua.includes('linux')) return 'Linux'
    return 'Unknown'
  })()

  const browser = (() => {
    if (ua.includes('edg/')) return 'Edge'
    if (ua.includes('chrome/') && !ua.includes('edg/')) return 'Chrome'
    if (ua.includes('safari/') && !ua.includes('chrome/')) return 'Safari'
    if (ua.includes('firefox/')) return 'Firefox'
    return 'Browser'
  })()

  return `${device} ${browser}`.trim()
}
