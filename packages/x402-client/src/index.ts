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
/**
 * `AuthError`, `ForbiddenError`, `LedewireError`, and `SpendCapReachedError`
 * are re-exported here from `@ledewire/core` — LedeWire's private shared
 * internals, not published to npm. Import them from here (or from
 * `@ledewire/node`), never from `@ledewire/core` directly.
 *
 * On the PAID request's `402` refusal (spec form, ledewire/api#1066):
 * `AuthError` maps `invalid_ledewire_wallet_payload_token`, `ForbiddenError`
 * maps `invalid_ledewire_wallet_payload_role`, and `SpendCapReachedError`
 * maps `daily_spend_cap_reached`. The pre-api#1066 legacy mapping (kept
 * during the switch-over) instead reads a bare `401`/`403`/`402` status.
 *
 * `@ledewire/core` is bundled separately into every published package via
 * tsup, so each of `@ledewire/x402-client`, `@ledewire/node`, and
 * `@ledewire/browser` carries its own distinct copy of these classes.
 * `instanceof` still works across those copies: every instance carries a
 * non-enumerable class-brand list, and each class's `Symbol.hasInstance`
 * falls back to checking it when the plain prototype check fails — so it
 * works whichever published package's copy of the class you check against.
 */
export { AuthError, ForbiddenError, LedewireError, SpendCapReachedError } from '@ledewire/core'
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
  LedewirePaymentRefusal,
} from './types.js'
