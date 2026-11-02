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
