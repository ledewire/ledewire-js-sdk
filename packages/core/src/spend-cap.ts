import { SpendCapReachedError } from './errors.js'

/**
 * Builds a {@link SpendCapReachedError} from a parsed `402` response body, or
 * `null` when the body isn't a well-formed daily-spend-cap-reached refusal.
 *
 * Shared by {@link HttpClient}'s error mapping (`POST /v1/purchases`,
 * acquisition authorization) and the `@ledewire/x402-client` fetch/Axios
 * adapters, which see the same body shape on a bare `GET /v1/x402/contents/{id}`
 * `402` — one with **no** `PAYMENT-REQUIRED` header, so there is nothing to
 * challenge and retrying or funding the wallet cannot clear it.
 *
 * Requires `error.type === 'daily_spend_cap_reached'` and `cap_cents`,
 * `spent_cents`, `remaining_cents` to be numbers, `resets_at` to be a string,
 * and `bulk_exempt` to be a boolean. A body with the right `error.type` but a
 * missing or mistyped field returns `null` — never `NaN`/`'undefined'` fields
 * on a shape that's merely close — so the caller falls back to its generic
 * error path.
 *
 * @param body - The parsed JSON body of a `402` response, or `undefined`/`null`
 *   if it couldn't be parsed.
 */
export function spendCapErrorFromBody(body: unknown): SpendCapReachedError | null {
  if (!body || typeof body !== 'object') return null
  const record = body as Record<string, unknown>

  const error = record['error']
  if (!error || typeof error !== 'object') return null
  const errorRecord = error as Record<string, unknown>
  if (errorRecord['type'] !== 'daily_spend_cap_reached') return null

  const capCents = record['cap_cents']
  const spentCents = record['spent_cents']
  const remainingCents = record['remaining_cents']
  const resetsAt = record['resets_at']
  const bulkExempt = record['bulk_exempt']

  if (
    typeof capCents !== 'number' ||
    typeof spentCents !== 'number' ||
    typeof remainingCents !== 'number' ||
    typeof resetsAt !== 'string' ||
    typeof bulkExempt !== 'boolean'
  ) {
    return null
  }

  // The body also carries the remedy at the top level (`message`) — for a
  // Company member, "ask a Company admin" — which is what MCP clients see in
  // place of the envelope. Prefer the envelope's, fall back to it.
  const message =
    typeof errorRecord['message'] === 'string'
      ? errorRecord['message']
      : typeof record['message'] === 'string'
        ? record['message']
        : 'Daily spend cap reached.'
  const code = typeof errorRecord['code'] === 'number' ? errorRecord['code'] : undefined

  return new SpendCapReachedError(
    message,
    { capCents, spentCents, remainingCents, resetsAt, bulkExempt },
    code,
  )
}
