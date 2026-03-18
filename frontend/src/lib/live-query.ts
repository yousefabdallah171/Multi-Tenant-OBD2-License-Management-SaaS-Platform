export const LIVE_QUERY_INTERVAL = {
  STATUS_LIST: 15_000,
  STATUS_DETAIL: 15_000,
  STATUS_COUNTS: 15_000,
  ACTIVATIONS: 15_000,
} as const

export function liveQueryOptions(interval: number) {
  return {
    refetchInterval: interval,
    refetchIntervalInBackground: false,
  } as const
}
