import { getFlag, parseUserAgent } from '@/utils/geoip'

describe('geoip utilities', () => {
  test('getFlag returns correct flags and fallback', () => {
    expect(getFlag('EG')).toBe('\uD83C\uDDEA\uD83C\uDDEC')
    expect(getFlag('SA')).toBe('\uD83C\uDDF8\uD83C\uDDE6')
    expect(getFlag(null)).toBe('\uD83C\uDFF3\uFE0F')
  })

  test('parseUserAgent identifies iPhone Safari', () => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile Safari/604.1'
    expect(parseUserAgent(ua)).toBe('iPhone Safari')
  })

  test('parseUserAgent identifies Windows Chrome', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    expect(parseUserAgent(ua)).toBe('Windows Chrome')
  })

  test.each([
    ['us', '🇺🇸'],
    ['GB', '🇬🇧'],
    ['de', '🇩🇪'],
    ['ZZ', '🇿🇿'],
  ])('getFlag(%s) returns expected emoji', (code, emoji) => {
    expect(getFlag(code)).toBe(emoji)
  })

  test.each([
    ['', '🏳️'],
    ['A', '🏳️'],
    ['AAA', '🏳️'],
    ['1A', '🏳️'],
    ['??', '🏳️'],
    [undefined, '🏳️'],
  ])('getFlag(%p) falls back to white flag', (code, emoji) => {
    expect(getFlag(code as string | null | undefined)).toBe(emoji)
  })

  test.each([
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) Edg/120.0.0.0', 'Windows Edge'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Firefox/122.0', 'Mac Firefox'],
    ['Mozilla/5.0 (Linux; Android 14) AppleWebKit Chrome/120 Mobile Safari/537.36', 'Android Chrome'],
    ['Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit Safari/604.1', 'iPad Safari'],
    ['SomeAgent/1.0', 'Unknown Browser'],
  ])('parseUserAgent maps device/browser for %s', (ua, expected) => {
    expect(parseUserAgent(ua)).toBe(expected)
  })
})
