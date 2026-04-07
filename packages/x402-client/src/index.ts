/**
 * @ledewire/x402-client
 *
 * Runtime-agnostic x402 payment client for the Ledewire `ledewire-wallet` scheme.
 * Works in Node.js 18+, Deno, Cloudflare Workers, and any environment with
 * web-standard `fetch`, `atob`, and `btoa`.
 *
 * ## Quick start (fetch)
 * @example
 * ```ts
 * import { createLedewireFetch } from '@ledewire/x402-client'
 *
 * const fetch = createLedewireFetch({ key: 'bktst_...', secret: '...' })
 * const res = await fetch('https://blog.example.com/posts/great-article')
 * ```
 *
 * ## Axios
 * @example
 * ```ts
 * import axios from 'axios'
 * import { LedewirePaymentClient } from '@ledewire/x402-client'
 * import { wrapAxiosWithPayment } from '@ledewire/x402-client/axios'
 *
 * const client = new LedewirePaymentClient({ key: 'bktst_...', secret: '...' })
 * const api = wrapAxiosWithPayment(axios.create(), client)
 * const res = await api.get('https://blog.example.com/posts/great-article')
 * ```
 *
 * ## Custom transport (ky, got, undici, …)
 * @example
 * ```ts
 * import { LedewirePaymentClient } from '@ledewire/x402-client'
 *
 * const client = new LedewirePaymentClient({ key: 'bktst_...', secret: '...' })
 * // In your interceptor:
 * const sig = await client.buildPaymentSignature(
 *   response.headers.get('payment-required'),
 *   request.url,
 * )
 * // Set PAYMENT-SIGNATURE: sig on the retry request.
 * ```
 *
 * @module
 */
export { createLedewireFetch } from './client.js'
export { LedewireAuthManager } from './auth.js'
export { LedewirePaymentClient, throwPaymentError } from './payment-client.js'
export { wrapFetchWithPayment } from './adapters/fetch.js'
export {
  UnsupportedSchemeError,
  MalformedPaymentRequiredError,
  NonceExpiredError,
  InsufficientFundsError,
} from './errors.js'
export type {
  PaymentSigner,
  LedewireFetchConfig,
  LedewirePaymentRequired,
  LedewirePaymentRequirements,
  LedewireWalletExtra,
  LedewireWalletExtension,
  LedewireWalletPayload,
  LedewirePaymentPayload,
  LedewireSettlementResponse,
} from './types.js'
