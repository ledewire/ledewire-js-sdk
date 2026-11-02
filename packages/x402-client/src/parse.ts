import type {
  LedewirePaymentRefusal,
  LedewirePaymentRequired,
  LedewirePaymentRequirements,
  LedewireSettlementResponse,
} from './types.js'
import { MalformedPaymentRequiredError, UnsupportedSchemeError } from './errors.js'

const SCHEME = 'ledewire-wallet'
const NETWORK = 'ledewire:v1'

/**
 * The API's x402 content endpoint, `/v1/x402/contents/{id}`, with a UUID id
 * (`contents.id` is a `uuid` column). Anchored at both ends: anything else is
 * not a challenge the API issued.
 */
const CONTENT_PATH =
  /^\/v1\/x402\/contents\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i

/**
 * The content id the API's challenge names. The API puts it nowhere but
 * `resource.url` (`<base_url>/v1/x402/contents/<content.id>`; the spec: "The
 * work's id is not in the payload: it is the `id` in the request path"), and
 * it settles only when `payload.contentId` equals that id.
 */
function contentIdFromResource(resource: unknown): string {
  const url =
    resource && typeof resource === 'object' ? (resource as Record<string, unknown>)['url'] : null
  let parsed: URL | null = null
  if (typeof url === 'string') {
    try {
      parsed = new URL(url)
    } catch {
      // Not an absolute URL - refused below
    }
  }
  const match = parsed && !parsed.search && !parsed.hash ? CONTENT_PATH.exec(parsed.pathname) : null
  if (!match?.[1]) {
    throw new MalformedPaymentRequiredError(
      'PAYMENT-REQUIRED resource.url is not a Ledewire /v1/x402/contents/{id} URL',
    )
  }
  return match[1]
}

/**
 * Decode and parse the raw `PAYMENT-REQUIRED` header value the Ledewire API
 * sends: `accepts[0].extra` carries `{ nonce, expiresAt }`, the content id is
 * the `{id}` in `resource.url`, and `extensions` is `{}`. An optional
 * `extensions['ledewire-wallet'].apiBase` is honoured when present.
 *
 * @throws {UnsupportedSchemeError} When no `ledewire-wallet` scheme entry exists.
 * @throws {MalformedPaymentRequiredError} When the header is not base64 JSON,
 *   `resource.url` is not a `/v1/x402/contents/{id}` URL, or the entry's
 *   `extra` lacks a string `nonce` or numeric `expiresAt`.
 */
export function parsePaymentRequired(headerValue: string): {
  paymentRequired: LedewirePaymentRequired
  accepted: LedewirePaymentRequirements
  contentId: string
  apiBase?: string
} {
  let decoded: unknown
  try {
    decoded = JSON.parse(atob(headerValue))
  } catch {
    throw new MalformedPaymentRequiredError('PAYMENT-REQUIRED header is not valid base64 JSON')
  }
  if (
    !decoded ||
    typeof decoded !== 'object' ||
    !Array.isArray((decoded as Record<string, unknown>)['accepts'])
  ) {
    throw new MalformedPaymentRequiredError('PAYMENT-REQUIRED has no accepts array')
  }
  const paymentRequired = decoded as LedewirePaymentRequired

  const accepted = paymentRequired.accepts.find((r) => r.scheme === SCHEME && r.network === NETWORK)
  if (!accepted) {
    throw new UnsupportedSchemeError(
      `No ${SCHEME}/${NETWORK} entry in PAYMENT-REQUIRED accepts array`,
    )
  }

  const extra: unknown = accepted.extra
  const { nonce, expiresAt } = (extra && typeof extra === 'object' ? extra : {}) as Record<
    string,
    unknown
  >
  if (typeof nonce !== 'string' || !nonce || typeof expiresAt !== 'number') {
    throw new MalformedPaymentRequiredError(
      `accepts[].extra must carry a string nonce and a numeric expiresAt`,
    )
  }

  const contentId = contentIdFromResource(paymentRequired.resource)

  const extension = paymentRequired.extensions?.[SCHEME]
  const apiBase =
    extension && typeof extension === 'object'
      ? (extension as Record<string, unknown>)['apiBase']
      : undefined

  return {
    paymentRequired,
    accepted,
    contentId,
    ...(typeof apiBase === 'string' && apiBase ? { apiBase } : {}),
  }
}

/**
 * Decode the `PAYMENT-RESPONSE` header returned on a successful `200`.
 * Returns `null` for free content where the header is omitted.
 */
export function parsePaymentResponse(
  headerValue: string | null,
): Pick<LedewireSettlementResponse, 'accessToken'> | null {
  if (!headerValue) return null
  try {
    return JSON.parse(atob(headerValue)) as Pick<LedewireSettlementResponse, 'accessToken'>
  } catch {
    return null
  }
}

/**
 * Decode the `PAYMENT-RESPONSE` header on a failed payment — a `402` on the
 * PAID request (the one carrying `PAYMENT-SIGNATURE`). Per the x402 v2 HTTP
 * transport spec, this is a `SettleResponse` with `success: false` and an
 * `errorReason` (see ledewire/api#1066). **Spec form** — this header is the
 * source of truth going forward; a paid `402` with no such header, or one
 * that fails to decode, falls back to the legacy body-only mapping (remove
 * that fallback once api#1066 ships).
 *
 * Tolerant decode: never throws. Returns `null` when the header is absent,
 * not valid base64 JSON, or the decoded value doesn't have `success: false`
 * with a string `errorReason` — treating any of those as "no refusal here".
 *
 * @param headerValue - Raw value of the `PAYMENT-RESPONSE` response header, or `null`.
 */
export function parsePaymentRefusal(headerValue: string | null): LedewirePaymentRefusal | null {
  if (!headerValue) return null

  let decoded: unknown
  try {
    decoded = JSON.parse(atob(headerValue))
  } catch {
    return null
  }

  if (!decoded || typeof decoded !== 'object') return null
  const record = decoded as Record<string, unknown>

  if (record['success'] !== false) return null
  const errorReason = record['errorReason']
  if (typeof errorReason !== 'string') return null

  return {
    success: false,
    errorReason,
    transaction: typeof record['transaction'] === 'string' ? record['transaction'] : '',
    network: typeof record['network'] === 'string' ? record['network'] : NETWORK,
    ...(typeof record['payer'] === 'string' ? { payer: record['payer'] } : {}),
  }
}
