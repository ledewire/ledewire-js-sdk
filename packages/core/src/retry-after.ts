/**
 * Reads a `Retry-After` header as the number of seconds to wait. Accepts both forms
 * RFC 9110 allows: delta-seconds (`120`) and an HTTP-date. A date in the past means
 * no wait (`0`). Returns `undefined` when the header is absent or unparseable.
 *
 * Shared by `HttpClient` and `@ledewire/x402-client`, so every
 * {@link RateLimitError} reads the header the same way.
 *
 * @param value - The raw header value, or `null`/`undefined` when the header is absent.
 * @param now - The current time in milliseconds, injectable for tests.
 */
export function parseRetryAfter(
  value: string | null | undefined,
  now: number = Date.now(),
): number | undefined {
  if (value === null || value === undefined) return undefined
  const trimmed = value.trim()
  if (/^\d+$/.test(trimmed)) return Number(trimmed)
  const at = Date.parse(trimmed)
  if (Number.isNaN(at)) return undefined
  return Math.max(0, Math.ceil((at - now) / 1000))
}
