/**
 * @ledewire/x402-client
 *
 * Runtime-agnostic x402 fetch wrapper for the Ledewire `ledewire-wallet` scheme.
 * Works in Node.js 18+, Deno, Cloudflare Workers, and any environment with
 * a web-standard `fetch` and `atob`/`btoa`.
 *
 * @example
 * ```ts
 * import { createLedewireFetch } from '@ledewire/x402-client'
 *
 * const fetch = createLedewireFetch({
 *   key: 'bktst_abc123',
 *   secret: 'your-64-char-hex-secret',
 * })
 *
 * // Payment is handled automatically — this is all the agent author writes.
 * const res = await fetch('https://blog.example.com/posts/great-article')
 * const article = await res.json()
 * ```
 *
 * @module
 */
export { createLedewireFetch } from './client.js'
export { LedewireAuthManager } from './auth.js'
export {
  UnsupportedSchemeError,
  MalformedPaymentRequiredError,
  NonceExpiredError,
  InsufficientFundsError,
} from './errors.js'
export type {
  LedewireFetchConfig,
  LedewirePaymentRequired,
  LedewirePaymentRequirements,
  LedewireWalletExtra,
  LedewireWalletExtension,
  LedewireWalletPayload,
  LedewirePaymentPayload,
  LedewireSettlementResponse,
} from './types.js'
