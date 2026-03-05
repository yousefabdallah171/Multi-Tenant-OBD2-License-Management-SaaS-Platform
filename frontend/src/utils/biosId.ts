/**
 * Returns the raw BIOS ID without the `{username}-` prefix
 * that older records may have stored. New records store the
 * raw BIOS ID directly, but this handles legacy data gracefully.
 */
export function rawBiosId(biosId: string, externalUsername?: string | null): string {
  if (!externalUsername || !biosId) return biosId
  const prefix = externalUsername + '-'
  return biosId.startsWith(prefix) ? biosId.slice(prefix.length) : biosId
}

/**
 * Formats a username input: lowercase, spaces/special chars → underscore,
 * trim leading/trailing underscores, collapse multiple underscores.
 */
export function formatUsername(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}
