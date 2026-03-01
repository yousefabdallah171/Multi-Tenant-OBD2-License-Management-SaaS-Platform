import { validateBiosId, validateEmail } from '@/lib/validators'

describe('validators', () => {
  test("validateEmail('bad@') returns error", () => {
    expect(validateEmail('bad@')).toBe('Invalid email format.')
  })

  test("validateBiosId('') returns required error", () => {
    expect(validateBiosId('')).toBe('BIOS ID is required.')
  })

  test("validateBiosId('BIOS-001') returns null", () => {
    expect(validateBiosId('BIOS-001')).toBeNull()
  })

  test.each([
    'user@example.com',
    'user.name@example.com',
    'user+alias@example.co.uk',
    'u123@sample.org',
    'name_surname@sample.net',
  ])('validateEmail accepts valid email: %s', (email) => {
    expect(validateEmail(email)).toBeNull()
  })

  test.each([
    'bad',
    'missingatsign.com',
    'bad@',
    '@example.com',
    'a b@example.com',
    'no-domain@localhost',
  ])('validateEmail rejects invalid email: %s', (email) => {
    expect(validateEmail(email)).toBe('Invalid email format.')
  })

  test.each([
    'ABCD',
    'ABCD-1234',
    'bios_id',
    'BIOS_2026',
    'A1-b2_c3',
  ])('validateBiosId accepts: %s', (bios) => {
    expect(validateBiosId(bios)).toBeNull()
  })

  test.each([
    '   ',
    'A',
    'AB',
    'ABC',
    'bad id',
    '%%%',
  ])('validateBiosId rejects: %s', (bios) => {
    const result = validateBiosId(bios)
    expect(result === 'BIOS ID is required.' || result === 'Invalid BIOS ID.').toBe(true)
  })
})
