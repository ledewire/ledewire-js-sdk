import { LedewirePaymentClient } from './payment-client.js'
import { wrapFetchWithPayment } from './adapters/fetch.js'
import type { LedewireFetchConfig } from './types.js'

/**
 * Creates a `fetch`-compatible function that automatically handles x402
 * `ledewire-wallet` payment challenges.
 *
 * Convenience wrapper around {@link LedewirePaymentClient} +
 * {@link wrapFetchWithPayment}. For Axios or other HTTP clients, use those
 * building blocks directly.
 *
 * Each payment is a Payment authorization signed with `config.paymentKey`; no
 * session token or API key is sent. Only requests to the configured `apiBase`
 * origin are paid; a `402` from any other origin is returned unpaid.
 *
 * @example
 * ```ts
 * import { createLedewireFetch } from '@ledewire/x402-client'
 *
 * const fetch = createLedewireFetch({
 *   paymentKey: { id: process.env.LEDEWIRE_PAYMENT_KEY_ID, privateKey: process.env.LEDEWIRE_PAYMENT_KEY },
 *   maxPriceCents: 500,
 * })
 *
 * const res = await fetch('https://api.ledewire.com/v1/x402/contents/<content-id>')
 * const content = await res.json()
 * ```
 *
 * @throws {UnsupportedSchemeError} When the `402` is not a `ledewire-wallet` challenge.
 * @throws {MalformedPaymentRequiredError} When the server's `PAYMENT-REQUIRED` is malformed.
 * @throws {PriceAboveMaximumError} When the price is above `maxPriceCents`.
 * @throws {PaymentRefusedError} When the API refuses the signed payment; `refusal` names the code.
 * @throws {InsufficientFundsError} When the buyer wallet has insufficient funds.
 * @throws {SpendCapReachedError} When a `402` carries no `PAYMENT-REQUIRED` header and
 *   its body is a daily-spend-cap-reached refusal — retrying or funding the wallet
 *   cannot clear this, so there is nothing to challenge.
 * @throws {RateLimitError} When the paid request is refused with `429`; `retryAfter`
 *   carries the `Retry-After` header in seconds, when sent.
 * @throws {LedewireError} For other API error responses (400, 401, 403, 404).
 */
export function createLedewireFetch(config: LedewireFetchConfig): typeof globalThis.fetch {
  const client = new LedewirePaymentClient(config)
  return wrapFetchWithPayment(config.fetch ?? globalThis.fetch, client)
}
