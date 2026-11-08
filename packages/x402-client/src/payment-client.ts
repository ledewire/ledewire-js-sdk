import {
  AuthError,
  ForbiddenError,
  LedewireError,
  RateLimitError,
  spendCapErrorFromBody,
} from '@ledewire/core'
import { encodeJsonHeader, toHex } from './encoding.js'
import {
  InsufficientFundsError,
  MalformedPaymentRequiredError,
  PaymentOriginNotAllowedError,
  PaymentRefusedError,
  PriceAboveMaximumError,
  extractApiErrorMessage,
} from './errors.js'
import { parsePaymentRequired } from './parse.js'
import { assertPrivateKey, importPaymentKey, signAuthorization } from './signing.js'
import type { SigningKey } from './signing.js'
import type {
  LedewireFetchConfig,
  LedewirePaymentAuthorization,
  LedewirePaymentPayload,
  LedewirePaymentRefusal,
  LedewireRefusalCode,
} from './types.js'

const DEFAULT_API_BASE = 'https://api.ledewire.com'
/** The longest window the scheme allows; a challenge cannot widen it. */
const MAX_WINDOW_SECONDS = 300

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
 * @param retryAfter - Seconds from the response's `Retry-After` header, if any
 *   (see `parseRetryAfter`); carried onto a {@link RateLimitError}.
 * @throws {InsufficientFundsError} On `422`.
 * @throws {AuthError} On `401`.
 * @throws {ForbiddenError} On `403`.
 * @throws {RateLimitError} On `429`, with `retryAfter` when given.
 * @throws {LedewireError} For all other statuses.
 */
export function throwPaymentError(status: number, message: string, retryAfter?: number): never {
  if (status === 422) throw new InsufficientFundsError(message)
  if (status === 401) throw new AuthError(message)
  if (status === 403) throw new ForbiddenError(message)
  if (status === 429) throw new RateLimitError(message, undefined, undefined, undefined, retryAfter)
  throw new LedewireError(message, status)
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
 * @param retryAfter - Seconds from the response's `Retry-After` header, if any.
 * @throws {SpendCapReachedError} When the body is a well-formed
 *   `daily_spend_cap_reached` refusal (see {@link spendCapErrorFromBody}).
 * @throws {InsufficientFundsError} On `422`.
 * @throws {AuthError} On `401`.
 * @throws {ForbiddenError} On `403`.
 * @throws {RateLimitError} On `429`.
 * @throws {LedewireError} For all other statuses.
 */
export function throwLegacyPaymentError(status: number, body: unknown, retryAfter?: number): never {
  const spendCapError = spendCapErrorFromBody(body)
  if (spendCapError) throw spendCapError

  const message = extractApiErrorMessage(body, `Payment failed (${String(status)})`)
  throwPaymentError(status, message, retryAfter)
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
  const message = extractApiErrorMessage(body, `Payment failed: ${errorReason}`)

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
 * The {@link PaymentRefusedError} for a refused signed payment, carrying the
 * API's message from the `402` body when it has one.
 *
 * @param code - The refusal code from the fresh `PAYMENT-REQUIRED` challenge.
 * @param body - Parsed JSON body of the same response, if any.
 */
export function paymentRefusedError(code: LedewireRefusalCode, body: unknown): PaymentRefusedError {
  return new PaymentRefusedError(code, extractApiErrorMessage(body, `Payment refused: ${code}`))
}

/**
 * Core Ledewire x402 payment client. Holds a Payment key and builds
 * `PAYMENT-SIGNATURE` header values: each one a fresh Payment authorization
 * signed with that key, with its own random nonce. No session token or API key
 * is ever sent.
 *
 * The client pays only for requests to its configured `apiBase` origin (see
 * {@link allowsPaymentTo}); a `PAYMENT-REQUIRED` challenge cannot change it.
 *
 * Use this directly when integrating with HTTP clients other than `fetch`
 * (e.g. ky, got). For a drop-in `fetch` replacement use
 * {@link createLedewireFetch}; for an Axios instance use
 * {@link wrapAxiosWithPayment}.
 *
 * @example
 * ```ts
 * import { LedewirePaymentClient } from '@ledewire/x402-client'
 *
 * const client = new LedewirePaymentClient({
 *   paymentKey: { id: process.env.LEDEWIRE_PAYMENT_KEY_ID, privateKey: process.env.LEDEWIRE_PAYMENT_KEY },
 *   maxPriceCents: 500,
 * })
 *
 * // In a ky `afterResponse` hook or any other HTTP client interceptor:
 * if (response.status === 402 && client.allowsPaymentTo(request.url)) {
 *   const sig = await client.buildPaymentSignature(
 *     response.headers.get('PAYMENT-REQUIRED'),
 *     request.url,
 *   )
 *   // retry once with PAYMENT-SIGNATURE: sig, and redirects off
 * }
 * ```
 */
export class LedewirePaymentClient {
  /** The configured Ledewire API base URL, fixed at construction. */
  readonly apiBase: string

  readonly #keyId: string
  readonly #maxPriceCents: number | undefined
  #privateKey: string | null
  #signingKey: Promise<SigningKey> | null = null

  /**
   * @param config - The Payment key and optional overrides. `config.fetch` is
   *   not used for payments (the adapters take their own); it is accepted so
   *   one config object serves {@link createLedewireFetch} too.
   * @throws {TypeError} When `paymentKey.id` is empty or not printable ASCII,
   *   `paymentKey.privateKey` is not unpadded base64url of 32 bytes, or
   *   `maxPriceCents` is not a non-negative integer. No message contains the
   *   private key.
   */
  constructor(config: LedewireFetchConfig) {
    const { id, privateKey } = config.paymentKey
    if (typeof id !== 'string' || !/^[\x21-\x7e]+$/.test(id)) {
      throw new TypeError('paymentKey.id must be the registered Payment key id')
    }
    assertPrivateKey(privateKey)
    const max = config.maxPriceCents
    if (max !== undefined && (!Number.isSafeInteger(max) || max < 0)) {
      throw new TypeError('maxPriceCents must be a non-negative integer number of cents')
    }
    this.apiBase = config.apiBase ?? DEFAULT_API_BASE
    this.#keyId = id
    this.#privateKey = privateKey
    this.#maxPriceCents = max
  }

  /**
   * Whether this client will pay for `url`: `true` only when `url` is an
   * absolute URL on the same origin (scheme, host and port) as the configured
   * `apiBase`. Relative or unparseable URLs return `false`.
   *
   * The fetch and Axios adapters call this before answering a `402`; a `402`
   * from any other origin is returned to the caller unpaid.
   *
   * @param url - Full URL of the request that received the `402`.
   */
  allowsPaymentTo(url: string): boolean {
    const origin = originOf(url)
    return origin !== null && origin === originOf(this.apiBase)
  }

  /**
   * Whether the adapters should sign once more after the API refuses a
   * payment with `code`: `payment_authorization_expired` always (a fresh
   * window), and `amount_mismatch` only when `maxPriceCents` is set (the new
   * price is then checked against it). Every other code is surfaced.
   *
   * @param code - The refusal code from the fresh challenge.
   */
  shouldResign(code: LedewireRefusalCode): boolean {
    if (code === 'payment_authorization_expired') return true
    if (code === 'amount_mismatch') return this.#maxPriceCents !== undefined
    return false
  }

  /**
   * Parses a raw `PAYMENT-REQUIRED` header value, signs a Payment
   * authorization for it, and returns the base64-encoded `PAYMENT-SIGNATURE`
   * string ready to set as a request header.
   *
   * The authorization pays the challenge's `payTo` its `amount` in `asset`, for
   * its `resource.url`, from this client's Payment key, valid from now for
   * `maxTimeoutSeconds` (at most 300), with a fresh 32-byte random nonce. Every
   * call signs a new authorization, so every call that is sent is a separate
   * payment: send each one at most once.
   *
   * @param paymentRequiredHeader - Raw value of the `PAYMENT-REQUIRED` response header.
   * @param url - Full URL of the resource being purchased.
   *
   * @throws {PaymentOriginNotAllowedError} `url` is not on the configured
   *   Ledewire API origin. Thrown before the challenge is read.
   * @throws {UnsupportedSchemeError} No `ledewire-wallet` entry in the `accepts` array.
   * @throws {MalformedPaymentRequiredError} The challenge is not base64 JSON,
   *   or a field the client signs is missing or malformed.
   * @throws {PriceAboveMaximumError} The price is above `maxPriceCents`.
   */
  async buildPaymentSignature(paymentRequiredHeader: string, url: string): Promise<string> {
    if (!this.allowsPaymentTo(url)) {
      throw new PaymentOriginNotAllowedError(
        originOf(url) ?? url,
        originOf(this.apiBase) ?? this.apiBase,
      )
    }

    const { paymentRequired, accepted } = parsePaymentRequired(paymentRequiredHeader)

    const amountCents = Number(accepted.amount)
    if (this.#maxPriceCents !== undefined && amountCents > this.#maxPriceCents) {
      throw new PriceAboveMaximumError(amountCents, this.#maxPriceCents)
    }

    const validAfter = Math.floor(Date.now() / 1000)
    const authorization: LedewirePaymentAuthorization = {
      from: this.#keyId,
      to: accepted.payTo,
      value: accepted.amount,
      asset: accepted.asset,
      resource: paymentRequired.resource.url,
      validAfter,
      validBefore: validAfter + Math.min(accepted.maxTimeoutSeconds, MAX_WINDOW_SECONDS),
      nonce: toHex(crypto.getRandomValues(new Uint8Array(32))),
    }

    let signature: string
    try {
      signature = await signAuthorization(await this.#key(), authorization)
    } catch (err) {
      // canonicalAuthorization refuses a value outside the scheme's domain
      // (e.g. a non-ASCII payTo); the API would refuse it as malformed too.
      if (err instanceof TypeError) {
        throw new MalformedPaymentRequiredError(`PAYMENT-REQUIRED cannot be signed: ${err.message}`)
      }
      throw err
    }

    const paymentPayload: LedewirePaymentPayload = {
      x402Version: 2,
      accepted,
      payload: { signature, authorization },
    }
    return encodeJsonHeader(paymentPayload)
  }

  /** Imports the private key once, as a non-extractable key, and drops the string. */
  #key(): Promise<SigningKey> {
    if (!this.#signingKey) {
      const privateKey = this.#privateKey ?? ''
      this.#privateKey = null
      this.#signingKey = importPaymentKey(privateKey)
    }
    return this.#signingKey
  }
}

/** The origin of an absolute URL, or `null` when it is relative or unparseable. */
function originOf(url: string): string | null {
  try {
    const origin = new URL(url).origin
    return origin === 'null' ? null : origin
  } catch {
    return null
  }
}
