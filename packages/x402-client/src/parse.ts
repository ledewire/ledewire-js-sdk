import type {
  LedewirePaymentRefusal,
  LedewirePaymentRequired,
  LedewirePaymentRequirements,
  LedewireRefusalCode,
  LedewireSettlementResponse,
} from './types.js'
import { decodeJsonHeader } from './encoding.js'
import { MalformedPaymentRequiredError, UnsupportedSchemeError } from './errors.js'

const SCHEME = 'ledewire-wallet'
const NETWORK = 'ledewire:v1'
const AMOUNT = /^(0|[1-9][0-9]*)$/

/** Every refusal code a fresh challenge can name after a refused signed payment. */
const REFUSAL_CODES: ReadonlySet<string> = new Set<LedewireRefusalCode>([
  'unknown_payment_key',
  'invalid_ledewire_wallet_signature',
  'recipient_mismatch',
  'amount_mismatch',
  'resource_mismatch',
  'payment_authorization_expired',
  'nonce_already_used',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function malformed(detail: string): MalformedPaymentRequiredError {
  return new MalformedPaymentRequiredError(`PAYMENT-REQUIRED ${detail}`)
}

/**
 * Decode and parse the raw `PAYMENT-REQUIRED` header value, checking every
 * field the client signs: the `ledewire-wallet` entry's `amount` (a decimal
 * string of cents that is a safe integer), `asset` (`USD`), `payTo`,
 * `maxTimeoutSeconds` (a positive integer) and `extra` (an object, `{}` in
 * practice), and the challenge's `resource.url`.
 *
 * @throws {UnsupportedSchemeError} When no `ledewire-wallet` / `ledewire:v1` entry exists.
 * @throws {MalformedPaymentRequiredError} When the header is not base64 JSON, or
 *   a field the client signs is missing or malformed.
 */
export function parsePaymentRequired(headerValue: string): {
  paymentRequired: LedewirePaymentRequired
  accepted: LedewirePaymentRequirements
} {
  let decoded: unknown
  try {
    decoded = decodeJsonHeader(headerValue)
  } catch {
    throw malformed('header is not valid base64 JSON')
  }
  if (!isRecord(decoded)) throw malformed('header is not a JSON object')
  if (!Array.isArray(decoded['accepts'])) throw malformed('has no accepts array')

  const entry: unknown = decoded['accepts'].find(
    (r: unknown) => isRecord(r) && r['scheme'] === SCHEME && r['network'] === NETWORK,
  )
  if (!isRecord(entry)) {
    throw new UnsupportedSchemeError(
      `No ${SCHEME}/${NETWORK} entry in PAYMENT-REQUIRED accepts array`,
    )
  }

  const { amount, asset, payTo, maxTimeoutSeconds, extra } = entry
  if (typeof amount !== 'string' || !AMOUNT.test(amount) || !Number.isSafeInteger(Number(amount))) {
    throw malformed('amount is not a decimal string of cents')
  }
  if (asset !== 'USD') throw malformed('asset is not USD')
  if (typeof payTo !== 'string' || payTo === '') throw malformed('payTo is missing')
  if (
    typeof maxTimeoutSeconds !== 'number' ||
    !Number.isSafeInteger(maxTimeoutSeconds) ||
    maxTimeoutSeconds <= 0
  ) {
    throw malformed('maxTimeoutSeconds is not a positive integer')
  }
  if (!isRecord(extra)) throw malformed('extra is not an object')

  const resource = decoded['resource']
  if (!isRecord(resource) || typeof resource['url'] !== 'string' || resource['url'] === '') {
    throw malformed('resource.url is missing')
  }

  // Every field the client reads is checked above; the rest pass through as sent.
  const paymentRequired: unknown = decoded
  const accepted: unknown = entry
  return {
    paymentRequired: paymentRequired as LedewirePaymentRequired,
    accepted: accepted as LedewirePaymentRequirements,
  }
}

/**
 * The refusal code of a paid request's `402`: the `error` of its fresh
 * `PAYMENT-REQUIRED` challenge, when that is one of the seven refusal codes.
 * Tolerant: returns `null` for an absent or undecodable header, or any other
 * `error`, and never throws.
 *
 * @param headerValue - Raw `PAYMENT-REQUIRED` value of the paid request's response.
 */
export function refusalCodeOf(headerValue: string | null | undefined): LedewireRefusalCode | null {
  if (!headerValue) return null
  let decoded: unknown
  try {
    decoded = decodeJsonHeader(headerValue)
  } catch {
    return null
  }
  if (!isRecord(decoded)) return null
  const error = decoded['error']
  return typeof error === 'string' && REFUSAL_CODES.has(error)
    ? (error as LedewireRefusalCode)
    : null
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
    return decodeJsonHeader(headerValue) as Pick<LedewireSettlementResponse, 'accessToken'>
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
    decoded = decodeJsonHeader(headerValue)
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
