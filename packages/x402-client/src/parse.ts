import type {
  LedewirePaymentRefusal,
  LedewirePaymentRequired,
  LedewirePaymentRequirements,
  LedewireWalletExtension,
} from './types.js'
import { MalformedPaymentRequiredError, UnsupportedSchemeError } from './errors.js'

const SCHEME = 'ledewire-wallet'
const NETWORK = 'ledewire:v1'

/**
 * Decode and parse the raw `PAYMENT-REQUIRED` header value into a typed
 * `LedewirePaymentRequired` object.
 *
 * @throws {UnsupportedSchemeError} When no `ledewire-wallet` scheme entry exists.
 * @throws {MalformedPaymentRequiredError} When the extension block is absent or incomplete.
 */
export function parsePaymentRequired(headerValue: string): {
  paymentRequired: LedewirePaymentRequired
  accepted: LedewirePaymentRequirements
  extension: LedewireWalletExtension
} {
  let paymentRequired: LedewirePaymentRequired
  try {
    paymentRequired = JSON.parse(atob(headerValue)) as LedewirePaymentRequired
  } catch {
    throw new MalformedPaymentRequiredError('PAYMENT-REQUIRED header is not valid base64 JSON')
  }

  const accepted = paymentRequired.accepts.find((r) => r.scheme === SCHEME && r.network === NETWORK)
  if (!accepted) {
    throw new UnsupportedSchemeError(
      `No ${SCHEME}/${NETWORK} entry in PAYMENT-REQUIRED accepts array`,
    )
  }

  const raw = paymentRequired.extensions?.[SCHEME]
  if (!raw || typeof raw !== 'object') {
    throw new MalformedPaymentRequiredError(
      `extensions.${SCHEME} block is missing from PAYMENT-REQUIRED`,
    )
  }
  const ext = raw as Record<string, unknown>
  if (!ext['apiBase'] || !ext['authEndpoint'] || !ext['schemeVersion'] || !ext['contentId']) {
    throw new MalformedPaymentRequiredError(
      `extensions.${SCHEME} is missing required fields (apiBase, authEndpoint, schemeVersion, contentId)`,
    )
  }

  return {
    paymentRequired,
    accepted,
    extension: raw as LedewireWalletExtension,
  }
}

/**
 * Decode the `PAYMENT-RESPONSE` header returned on a successful `200`.
 * Returns `null` for free content where the header is omitted.
 */
export function parsePaymentResponse(headerValue: string | null): {
  accessToken?: string | null
} | null {
  if (!headerValue) return null
  try {
    return JSON.parse(atob(headerValue)) as { accessToken?: string | null }
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
