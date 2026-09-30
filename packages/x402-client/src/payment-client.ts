import { AuthError, ForbiddenError, LedewireError, spendCapErrorFromBody } from '@ledewire/core'
import { LedewireAuthManager } from './auth.js'
import { InsufficientFundsError, NonceExpiredError } from './errors.js'
import { parsePaymentRequired } from './parse.js'
import type {
  LedewireFetchConfig,
  LedewirePaymentPayload,
  LedewirePaymentRefusal,
} from './types.js'

/**
 * Maps an HTTP status code from a paid-request retry to a typed SDK error.
 * Always throws — useful as the final branch in a response handler.
 *
 * **Legacy** — a bare status/message mapping with no access to the response
 * body, kept for the pre-api#1066 fallback (see {@link throwLegacyPaymentError})
 * and for any custom-transport caller already using it directly. Prefer
 * {@link throwPaymentRefusal} for the x402 v2 spec form, and
 * {@link throwLegacyPaymentError} when you have the full parsed body.
 *
 * @param status - HTTP status of the failed retry response.
 * @param message - Error message extracted from the response body.
 * @throws {InsufficientFundsError} On `422`.
 * @throws {AuthError} On `401`.
 * @throws {ForbiddenError} On `403`.
 * @throws {LedewireError} For all other statuses.
 */
export function throwPaymentError(status: number, message: string): never {
  if (status === 422) throw new InsufficientFundsError(message)
  if (status === 401) throw new AuthError(message)
  if (status === 403) throw new ForbiddenError(message)
  throw new LedewireError(message, status)
}

/**
 * Extracts a human-readable message from a parsed API error body, tolerating
 * both shapes seen in the wild: `{ error: "string" }` (some legacy Ledewire
 * responses) and `{ error: { code, message, type } }` (the documented
 * `ErrorResponse` envelope). Falls back to `fallback` — never throws.
 *
 * @param body - Parsed JSON body of an error response, or `undefined`/`null`.
 * @param fallback - Message to use when the body carries no usable string.
 */
export function extractPaymentErrorMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== 'object') return fallback
  const raw = (body as Record<string, unknown>)['error']
  if (typeof raw === 'string') return raw
  if (raw && typeof raw === 'object') {
    const message = (raw as Record<string, unknown>)['message']
    if (typeof message === 'string') return message
  }
  return fallback
}

/**
 * Maps the PAID request's non-OK response to a typed SDK error using the
 * **legacy** (pre-api#1066) body-only shape: the daily-spend-cap refusal (or
 * any other error) lives directly in the `402`/`422`/`401`/`403` body, with
 * no `PAYMENT-RESPONSE` header to read instead. Remove this once api#1066
 * ships and the API always sends the header on the paid leg.
 *
 * @param status - HTTP status of the failed retry response.
 * @param body - Parsed JSON body of the failed retry response.
 * @throws {SpendCapReachedError} When the body is a well-formed
 *   `daily_spend_cap_reached` refusal (see {@link spendCapErrorFromBody}).
 * @throws {InsufficientFundsError} On `422`.
 * @throws {AuthError} On `401`.
 * @throws {ForbiddenError} On `403`.
 * @throws {LedewireError} For all other statuses.
 */
export function throwLegacyPaymentError(status: number, body: unknown): never {
  const spendCapError = spendCapErrorFromBody(body)
  if (spendCapError) throw spendCapError

  const message = extractPaymentErrorMessage(body, `Payment failed (${String(status)})`)
  throwPaymentError(status, message)
}

/**
 * Maps a decoded {@link LedewirePaymentRefusal} (the x402 v2 `PAYMENT-RESPONSE`
 * header with `success: false` on the PAID request's `402`) to a typed SDK
 * error, per ledewire/api#1066. **Spec form** — this is the mapping to keep;
 * {@link throwLegacyPaymentError} exists only for the pre-api#1066 transition.
 *
 * @param refusal - The decoded `PAYMENT-RESPONSE` refusal.
 * @param body - Parsed JSON body of the same response, read separately from
 *   the header — e.g. the `DailySpendCapReachedError` body with `cap_cents`
 *   etc. accompanying a `daily_spend_cap_reached` refusal.
 * @throws {InsufficientFundsError} `errorReason === 'insufficient_funds'`.
 * @throws {SpendCapReachedError} `errorReason === 'daily_spend_cap_reached'`
 *   and `body` has well-formed cap fields.
 * @throws {AuthError} `errorReason === 'invalid_ledewire_wallet_payload_token'`.
 * @throws {ForbiddenError} `errorReason === 'invalid_ledewire_wallet_payload_role'`.
 * @throws {LedewireError} Any other `errorReason` — `err.type` is set to the
 *   raw reason so callers can still branch on it.
 */
export function throwPaymentRefusal(refusal: LedewirePaymentRefusal, body: unknown): never {
  const { errorReason } = refusal
  const message = extractPaymentErrorMessage(body, `Payment failed: ${errorReason}`)

  switch (errorReason) {
    case 'insufficient_funds':
      throw new InsufficientFundsError(message)
    case 'daily_spend_cap_reached': {
      const spendCapError = spendCapErrorFromBody(body)
      if (spendCapError) throw spendCapError
      // Body lacked well-formed cap fields — still surface the reason via
      // `type`, never NaN/undefined cap fields on a shape that's merely close.
      throw new LedewireError(message, 402, undefined, 'daily_spend_cap_reached')
    }
    case 'invalid_ledewire_wallet_payload_token':
      throw new AuthError(message)
    case 'invalid_ledewire_wallet_payload_role':
      throw new ForbiddenError(message)
    default:
      throw new LedewireError(message, 402, undefined, errorReason)
  }
}

/**
 * Core Ledewire x402 payment client. Holds buyer credentials, manages the
 * JWT lifecycle, and builds `PAYMENT-SIGNATURE` header values.
 *
 * Use this directly when integrating with HTTP clients other than `fetch`
 * (e.g. Axios, ky, got). For a drop-in `fetch` replacement use
 * {@link createLedewireFetch}; for an Axios instance use
 * {@link wrapAxiosWithPayment}.
 *
 * @example
 * ```ts
 * import { LedewirePaymentClient } from '@ledewire/x402-client'
 *
 * const client = new LedewirePaymentClient({ key, secret })
 *
 * // In a ky `beforeError` hook or any other HTTP client interceptor:
 * if (response.status === 402) {
 *   const sig = await client.buildPaymentSignature(
 *     response.headers.get('PAYMENT-REQUIRED'),
 *     request.url,
 *   )
 *   // retry with PAYMENT-SIGNATURE: sig
 * }
 * ```
 */
export class LedewirePaymentClient {
  /** @internal */
  readonly auth: LedewireAuthManager

  /**
   * @param config - Buyer credentials and optional overrides. The `fetch`
   *   field, when provided, is used only for authentication requests to the
   *   Ledewire API — not for fetching content.
   */
  constructor(config: LedewireFetchConfig) {
    this.auth = new LedewireAuthManager(
      config.key,
      config.secret,
      config.apiBase ?? 'https://api.ledewire.com',
      config.fetch,
    )
  }

  /**
   * Parses a raw `PAYMENT-REQUIRED` header value, authenticates with the
   * buyer API key, and returns the base64-encoded `PAYMENT-SIGNATURE` string
   * ready to set as a request header.
   *
   * A stable UUID is generated per call and included in the payload when the
   * server advertises `payment-identifier` support — enabling safe retries
   * without double-charging.
   *
   * @param paymentRequiredHeader - Raw value of the `PAYMENT-REQUIRED` response header.
   * @param url - Full URL of the resource being purchased.
   *
   * @throws {UnsupportedSchemeError} No `ledewire-wallet` entry in the `accepts` array.
   * @throws {MalformedPaymentRequiredError} Extension block is absent or malformed.
   * @throws {NonceExpiredError} Nonce `expiresAt` is in the past.
   * @throws {AuthError} Buyer API key credentials are invalid.
   */
  async buildPaymentSignature(paymentRequiredHeader: string, url: string): Promise<string> {
    const { paymentRequired, accepted, extension } = parsePaymentRequired(paymentRequiredHeader)

    if (Date.now() / 1000 > accepted.extra.expiresAt) {
      throw new NonceExpiredError()
    }

    if (extension.apiBase) {
      this.auth.apiBase = extension.apiBase
    }

    const token = await this.auth.getAccessToken()

    const supportsPaymentIdentifier = paymentRequired.extensions?.['payment-identifier'] != null

    const paymentPayload: LedewirePaymentPayload = {
      x402Version: 2,
      resource: { url },
      accepted,
      payload: { token, contentId: extension.contentId },
      ...(supportsPaymentIdentifier
        ? { extensions: { 'payment-identifier': crypto.randomUUID() } }
        : undefined),
    }

    return btoa(JSON.stringify(paymentPayload))
  }
}
