import type { JSX } from 'react'

export function FlagImage({ code, country }: { code: string; country: string }): JSX.Element {
  const normalized = code.trim().toLowerCase()
  const valid = normalized.length === 2 && /^[a-z]{2}$/.test(normalized)

  if (!valid) {
    return <span className="inline-block h-4 w-6 rounded-sm bg-slate-200 dark:bg-slate-700" aria-label="Unknown flag" />
  }

  return (
    <img
      src={`https://flagcdn.com/w20/${normalized}.png`}
      srcSet={`https://flagcdn.com/w40/${normalized}.png 2x`}
      width={20}
      height={15}
      alt={country}
      className="inline-block shrink-0 rounded-sm object-cover"
      style={{ verticalAlign: 'middle' }}
    />
  )
}

export function IpLocationCell({ country, city, countryCode }: { country: string; city: string; countryCode: string }): JSX.Element {
  const label = country && country !== 'Unknown'
    ? `${country}${city ? ` / ${city}` : ''}`
    : 'Unknown'

  return (
    <span className="inline-flex items-center gap-1.5" dir="ltr">
      <FlagImage code={countryCode} country={country} />
      <span>{label}</span>
    </span>
  )
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
