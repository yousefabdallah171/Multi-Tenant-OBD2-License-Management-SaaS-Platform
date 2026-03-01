import { formatCurrency, formatDate, formatDuration } from '@/lib/utils'

describe('formatters', () => {
  test('formatDate returns english medium format', () => {
    expect(formatDate('2026-03-01T12:00:00Z', 'en-US')).toContain('Mar')
    expect(formatDate('2026-03-01T12:00:00Z', 'en-US')).toContain('2026')
  })

  test('formatDate supports arabic locale', () => {
    const value = formatDate('2026-03-01T12:00:00Z', 'ar-EG')
    expect(value.length).toBeGreaterThan(0)
  })

  test('formatCurrency formats USD amount', () => {
    expect(formatCurrency(1234.5, 'USD', 'en-US')).toBe('$1,234.50')
  })

  test('formatDuration converts 0.021 days to 30 minutes', () => {
    expect(formatDuration(0.021)).toBe('30 minutes')
  })

  test.each([
    [0.0007, '1 minute'],
    [0.021, '30 minutes'],
    [0.0417, '1 hour'],
    [0.5, '12 hours'],
    [1, '1 day'],
    [7, '7 days'],
    [1.5, '1.5 days'],
  ])('formatDuration(%p) => %p', (input, expected) => {
    expect(formatDuration(input)).toBe(expected)
  })

  test.each([
    [0, '$0.00'],
    [1, '$1.00'],
    [12.5, '$12.50'],
    [999.99, '$999.99'],
  ])('formatCurrency(%p) uses USD by default', (input, expected) => {
    expect(formatCurrency(input)).toBe(expected)
  })

  test('formatCurrency supports non-USD currencies', () => {
    expect(formatCurrency(100, 'EUR', 'en-US')).toContain('100')
  })

  test.each(['en-US', 'ar-EG', 'fr-FR', 'de-DE'])('formatDate returns non-empty for locale %s', (locale) => {
    expect(formatDate('2026-03-01T12:00:00Z', locale).length).toBeGreaterThan(0)
  })
})
