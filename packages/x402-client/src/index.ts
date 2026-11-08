/**
 * @ledewire/x402-client
 *
 * Runtime-agnostic x402 payment client for the Ledewire `ledewire-wallet` scheme.
 * Works in Node.js 20+, Deno, Cloudflare Workers, current browsers, and any
 * environment with web-standard `fetch`, `atob`, `btoa` and WebCrypto Ed25519
 * (`crypto.subtle`).
 *
 * Every payment is a Payment authorization signed with an Ed25519 Payment key
 * the Buyer registered (see {@link registerPaymentKey}); no session token or
 * API key is sent to pay.
 *
 * ## Quick start (fetch)
 * @example
 * ```ts
 * import { createLedewireFetch } from '@ledewire/x402-client'
 *
 * const fetch = createLedewireFetch({
 *   paymentKey: { id: process.env.LEDEWIRE_PAYMENT_KEY_ID, privateKey: process.env.LEDEWIRE_PAYMENT_KEY },
 *   maxPriceCents: 500,
 * })
 * const res = await fetch('https://api.ledewire.com/v1/x402/contents/<content-id>')
 * ```
 *
 * ## Axios
 * @example
 * ```ts
 * import axios from 'axios'
 * import { LedewirePaymentClient } from '@ledewire/x402-client'
 * import { wrapAxiosWithPayment } from '@ledewire/x402-client/axios'
 *
 * const client = new LedewirePaymentClient({ paymentKey, maxPriceCents: 500 })
 * const api = wrapAxiosWithPayment(axios.create(), client)
 * const res = await api.get('https://api.ledewire.com/v1/x402/contents/<content-id>')
 * ```
 *
 * ## Custom transport (ky, got, undici, …)
 * @example
 * ```ts
 * import { LedewirePaymentClient } from '@ledewire/x402-client'
 *
 * const client = new LedewirePaymentClient({ paymentKey, maxPriceCents: 500 })
 * // In your interceptor — pay only the configured Ledewire API:
 * if (!client.allowsPaymentTo(request.url)) return response
 * const sig = await client.buildPaymentSignature(
 *   response.headers.get('payment-required'),
 *   request.url,
 * )
 * // Set PAYMENT-SIGNATURE: sig on one retry request, with redirects off.
 * ```
 *
 * @module
 */
export { createLedewireFetch } from './client.js'
export { LedewireAuthManager } from './auth.js'
export { LedewirePaymentClient, throwPaymentError } from './payment-client.js'
export { wrapFetchWithPayment } from './adapters/fetch.js'
export { registerPaymentKey, createPaymentKeyRegistration } from './payment-keys.js'
export type {
  PaymentKeyCreateBody,
  PaymentKeyRegistration,
  PaymentKeyRegistrar,
  RegisterPaymentKeyOptions,
  RegisteredPaymentKey,
} from './payment-keys.js'
export { generatePaymentKey, canonicalAuthorization } from './signing.js'
export {
  UnsupportedSchemeError,
  MalformedPaymentRequiredError,
  PaymentRefusedError,
  PriceAboveMaximumError,
  InsufficientFundsError,
  PaymentOriginNotAllowedError,
} from './errors.js'
/**
 * `AuthError`, `ForbiddenError`, `LedewireError`, `RateLimitError`, and
 * `SpendCapReachedError` are re-exported here from `@ledewire/core` — LedeWire's private shared
 * internals, not published to npm. Import them from here (or from
 * `@ledewire/node`), never from `@ledewire/core` directly.
 *
 * A refused signed payment is a `PaymentRefusedError` (exported above).
 * `SpendCapReachedError` is the paid request's `402` spend-cap body, which
 * carries no `PAYMENT-REQUIRED`. A `429` from the paid request, the buyer-key
 * login or Payment key registration is a `RateLimitError`, with `retryAfter`
 * from the `Retry-After` header.
 *
 * `@ledewire/core` is bundled separately into every published package via
 * tsup, so each of `@ledewire/x402-client`, `@ledewire/node`, and
 * `@ledewire/browser` carries its own distinct copy of these classes.
 * `instanceof` still works across those copies: every instance carries a
 * non-enumerable class-brand list, and each class's `Symbol.hasInstance`
 * falls back to checking it when the plain prototype check fails — so it
 * works whichever published package's copy of the class you check against.
 */
export {
  AuthError,
  ForbiddenError,
  LedewireError,
  RateLimitError,
  SpendCapReachedError,
} from '@ledewire/core'
export type {
  PaymentSigner,
  LedewireFetchConfig,
  LedewirePaymentKey,
  LedewirePaymentKeyRecord,
  LedewireRefusalCode,
  LedewirePaymentRequired,
  LedewirePaymentRequirements,
  LedewirePaymentAuthorization,
  LedewireWalletPayload,
  LedewirePaymentPayload,
  LedewireSettlementResponse,
  LedewirePaymentRefusal,
} from './types.js'
