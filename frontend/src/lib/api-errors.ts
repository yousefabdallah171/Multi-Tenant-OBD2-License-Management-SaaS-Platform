export function resolveApiErrorMessage(error: unknown, fallback: string): string {
  const responseData =
    typeof error === 'object' && error !== null && 'response' in error
      ? (error as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }).response?.data
      : undefined

  const rawMessage =
    Object.values(responseData?.errors ?? {})[0]?.[0]
    ?? responseData?.message
    ?? (typeof error === 'object' && error !== null && 'message' in error ? String((error as { message?: string }).message ?? '') : '')
    ?? ''

  const normalized = rawMessage.trim().toLowerCase()

  if (normalized.includes('curl error 28') || normalized.includes('timed out') || normalized.includes('timeout') || normalized.includes('external api endpoint is not responding')) {
    return 'The external API endpoint is offline right now. Try again later or use a scheduled activation.'
  }

  if (normalized.includes('external api endpoint is unavailable')) {
    return 'The external API endpoint is unavailable right now. Verify the endpoint settings and try again later.'
  }

  if (rawMessage.trim() !== '') {
    return rawMessage
  }

  return fallback
}
