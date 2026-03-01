import { getFlag, parseUserAgent } from '@/utils/geoip'

describe('geoip utilities', () => {
  test('getFlag returns correct flags and fallback', () => {
    expect(getFlag('EG')).toBe('🇪🇬')
    expect(getFlag('SA')).toBe('🇸🇦')
    expect(getFlag(null)).toBe('🏳️')
  })

  test('parseUserAgent identifies iPhone Safari', () => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile Safari/604.1'
    expect(parseUserAgent(ua)).toBe('iPhone Safari')
  })

  test('parseUserAgent identifies Windows Chrome', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    expect(parseUserAgent(ua)).toBe('Windows Chrome')
  })
})
