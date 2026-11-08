import { LedewireError } from '@ledewire/core'
import type { LedewireRefusalCode } from './types.js'

/**
 * Thrown when a `402 Payment Required` response is received but no
 * `ledewire-wallet` scheme entry is present in the `accepts` array.
 * This means the resource is not a Ledewire-gated URL.
 */
export class UnsupportedSchemeError extends LedewireError {
  constructor(message: string) {
    super(message, 402)
    this.name = 'UnsupportedSchemeError'
  }
}

/**
 * Thrown when a `402 Payment Required` response's `PAYMENT-REQUIRED` header
 * is not base64 JSON, or its `ledewire-wallet` entry or `resource` is missing
 * a field or holds one the client won't sign. Nothing was signed.
 */
export class MalformedPaymentRequiredError extends LedewireError {
  constructor(message: string) {
    super(message, 402)
    this.name = 'MalformedPaymentRequiredError'
  }
}

/**
 * Thrown when the API refuses a well-formed signed payment: the paid request's
 * `402` carries a fresh `PAYMENT-REQUIRED` whose `error` is a refusal code.
 * `code` (and `type`) name it. Nothing was charged.
 *
 * The adapters re-sign once only for codes the signer's `shouldResign`
 * accepts (`payment_authorization_expired`, and `amount_mismatch` within the
 * configured `maxPriceCents`), and throw this for every other code, or when
 * the re-signed payment is refused too.
 *
 * - `unknown_payment_key`: the key isn't registered, or was revoked
 * - `invalid_ledewire_wallet_signature`: the signature does not verify against the key
 * - `recipient_mismatch`, `amount_mismatch`, `resource_mismatch`: the signed
 *   `to`, `value`/`asset` or `resource` is not what the API now asks
 * - `payment_authorization_expired`: the validity window does not contain
 *   the server's now; check the clock
 * - `nonce_already_used`: this payment was already made. Check whether the
 *   work was bought before paying again
 */
export class PaymentRefusedError extends LedewireError {
  static override readonly brand: string = 'PaymentRefusedError'

  /** The refusal code. */
  readonly refusal: LedewireRefusalCode

  constructor(refusal: LedewireRefusalCode, message?: string) {
    super(message ?? `Payment refused: ${refusal}`, 402, undefined, refusal)
    this.name = 'PaymentRefusedError'
    this.refusal = refusal
  }
}

/**
 * Thrown before anything is signed when a challenge's price is above the
 * configured `maxPriceCents`, including the new price after an
 * `amount_mismatch` refusal. Nothing was charged.
 */
export class PriceAboveMaximumError extends LedewireError {
  static override readonly brand: string = 'PriceAboveMaximumError'

  /** The quoted price, in cents. */
  readonly amountCents: number
  /** The configured maximum, in cents. */
  readonly maxPriceCents: number

  constructor(amountCents: number, maxPriceCents: number) {
    super(
      `Refusing to pay: the price, ${String(amountCents)} cents, is above the maximum of ${String(maxPriceCents)} cents`,
      402,
    )
    this.name = 'PriceAboveMaximumError'
    this.amountCents = amountCents
    this.maxPriceCents = maxPriceCents
  }
}

/**
 * Thrown by {@link LedewirePaymentClient.buildPaymentSignature} when asked to
 * pay for a URL whose origin is not the configured Ledewire API origin
 * (`apiBase`). The client authenticates and pays only against the API it was
 * configured with; a `402` from any other origin is never paid.
 *
 * The built-in fetch and Axios adapters check
 * {@link LedewirePaymentClient.allowsPaymentTo} first and return such a `402`
 * to the caller unpaid, so this error reaches only code that calls
 * `buildPaymentSignature` directly.
 */
export class PaymentOriginNotAllowedError extends LedewireError {
  constructor(origin: string, apiOrigin: string) {
    super(`Refusing to pay: ${origin} is not the configured Ledewire API (${apiOrigin})`, 402)
    this.name = 'PaymentOriginNotAllowedError'
  }
}

/**
 * Thrown when the buyer wallet has insufficient funds to complete the payment.
 */
export class InsufficientFundsError extends LedewireError {
  constructor(message: string) {
    super(message, 422)
    this.name = 'InsufficientFundsError'
  }
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
export function extractApiErrorMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== 'object') return fallback
  const raw = (body as Record<string, unknown>)['error']
  if (typeof raw === 'string') return raw
  if (raw && typeof raw === 'object') {
    const message = (raw as Record<string, unknown>)['message']
    if (typeof message === 'string') return message
  }
  return fallback
}
