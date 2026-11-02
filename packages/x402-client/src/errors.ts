import { LedewireError } from '@ledewire/core'

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
 * Thrown when a `402 Payment Required` response contains a `ledewire-wallet`
 * entry but the `extensions.ledewire-wallet` discovery block is missing or
 * incomplete. This indicates a server misconfiguration.
 */
export class MalformedPaymentRequiredError extends LedewireError {
  constructor(message: string) {
    super(message, 402)
    this.name = 'MalformedPaymentRequiredError'
  }
}

/**
 * Thrown when the nonce in `accepts[0].extra` has expired (`expiresAt` is in
 * the past). Callers should retry the full request from the beginning to
 * obtain a fresh nonce.
 */
export class NonceExpiredError extends LedewireError {
  constructor() {
    super('Payment nonce has expired — retry the request to obtain a fresh nonce', 402)
    this.name = 'NonceExpiredError'
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
