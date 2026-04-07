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
 * @example
 * ```ts
 * import { createLedewireFetch } from '@ledewire/x402-client'
 *
 * const fetch = createLedewireFetch({ key: 'bktst_...', secret: '...' })
 *
 * const res = await fetch('https://blog.example.com/posts/article')
 * const content = await res.json()
 * ```
 *
 * @throws {UnsupportedSchemeError} When the `402` is not a `ledewire-wallet` challenge.
 * @throws {MalformedPaymentRequiredError} When the server's `PAYMENT-REQUIRED` is malformed.
 * @throws {NonceExpiredError} When the payment nonce is already expired.
 * @throws {InsufficientFundsError} When the buyer wallet has insufficient funds.
 * @throws {AuthError} When buyer API key authentication fails.
 * @throws {LedewireError} For other API error responses (400, 401, 403, 404, 429).
 */
export function createLedewireFetch(config: LedewireFetchConfig): typeof globalThis.fetch {
  const client = new LedewirePaymentClient(config)
  return wrapFetchWithPayment(config.fetch ?? globalThis.fetch, client)
}
