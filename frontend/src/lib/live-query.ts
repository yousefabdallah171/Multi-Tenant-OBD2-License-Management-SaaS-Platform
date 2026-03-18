export const LIVE_QUERY_INTERVAL = {
  STATUS_LIST: 5_000, // Refetch customers list every 5 seconds
  STATUS_DETAIL: 5_000, // Refetch detail pages every 5 seconds
  STATUS_COUNTS: 5_000, // Refetch counts every 5 seconds
  ACTIVATIONS: 5_000, // Refetch activations every 5 seconds
} as const

export function liveQueryOptions(interval: number) {
  return {
    refetchInterval: interval,
    refetchIntervalInBackground: true, // Also refetch in background for near real-time updates
  } as const
}
