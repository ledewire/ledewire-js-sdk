import type { X402SettlementResponse } from '@ledewire/core'

/*
 * Wire types for the `ledewire-wallet` x402 scheme.
 *
 * Each wire type here is hand-written to match a `ledewire.yml` schema, and
 * `spec-alignment.test.ts` pins it to that schema, so a divergence fails
 * `pnpm typecheck`:
 *
 * - `LedewirePaymentRequired`: `X402PaymentRequired`, the `PAYMENT-REQUIRED` header
 * - `LedewirePaymentRequirements`: `X402PaymentRequirements`, its `accepts` entry
 * - `LedewireWalletPayload`: `X402PaymentAuthorization`, the signed `payload`
 * - `LedewirePaymentAuthorization`: that payload's `authorization`
 * - `LedewirePaymentKeyRecord`: `PaymentKey`, a registered key
 * - `LedewireSettlementResponse`: an alias of the generated `SettlementResponse`
 *
 * They are copied rather than imported because `@ledewire/core` does not
 * export the generated `components`.
 */

/** A refusal code: why the API refused a well-formed signed payment. */
export type LedewireRefusalCode =
  | 'unknown_payment_key'
  | 'invalid_ledewire_wallet_signature'
  | 'recipient_mismatch'
  | 'amount_mismatch'
  | 'resource_mismatch'
  | 'payment_authorization_expired'
  | 'nonce_already_used'

/**
 * Minimal interface required by the fetch and Axios adapters.
 * `LedewirePaymentClient` satisfies this structurally; you can also pass any
 * object that implements `buildPaymentSignature` for testing or custom flows.
 */
export interface PaymentSigner {
  /**
   * Parses a `PAYMENT-REQUIRED` header, signs a Payment authorization for it,
   * and returns the base64-encoded `PAYMENT-SIGNATURE` string.
   */
  buildPaymentSignature(paymentRequiredHeader: string, url: string): Promise<string>
  /**
   * Optional origin check. When present, the adapters call it with the full
   * URL of the request that got the `402` and return that `402` to the caller
   * unpaid when it returns `false`: no signature is built and no retry is
   * made. `LedewirePaymentClient` implements it to allow only the configured
   * Ledewire API origin. Signers without it are asked to sign every
   * `PAYMENT-REQUIRED` challenge.
   */
  allowsPaymentTo?(url: string): boolean
  /**
   * Optional re-sign policy. When the API refuses a payment with `code`, the
   * adapters sign once more against the refusal's fresh challenge if this
   * returns `true`, and otherwise throw a `PaymentRefusedError`. A request is
   * signed at most twice. Signers without it never re-sign.
   */
  shouldResign?(code: LedewireRefusalCode): boolean
}

/**
 * A registered Payment key, as the payment client is configured with it.
 */
export interface LedewirePaymentKey {
  /** The key's id (`PaymentKey.id`), the `from` of every authorization it signs. */
  id: string
  /**
   * The private half: the 32-byte Ed25519 seed as unpadded base64url
   * (43 characters). Keep it secret. It never leaves the client: it is imported
   * as a non-extractable WebCrypto key and only signs.
   */
  privateKey: string
}

/**
 * Configuration for `createLedewireFetch` and `LedewirePaymentClient`.
 */
export interface LedewireFetchConfig {
  /**
   * The Payment key that signs payments. Register one with
   * `registerPaymentKey()`; a Company admin registers a Machine user's.
   */
  paymentKey: LedewirePaymentKey
  /**
   * The most the client pays for one request, in US cents. A challenge above
   * it is refused with `PriceAboveMaximumError` before anything is signed.
   * When set, an `amount_mismatch` refusal (the price moved) is re-signed once
   * at the new price if it is still within this maximum. Unset, any quoted
   * price is paid and `amount_mismatch` is never re-signed.
   */
  maxPriceCents?: number
  /**
   * Override the Ledewire API base URL. Defaults to `https://api.ledewire.com`.
   * Only requests to this origin are paid, and a `PAYMENT-REQUIRED` challenge
   * cannot change it.
   */
  apiBase?: string
  /**
   * Provide a custom `fetch` implementation. Defaults to the global `fetch`.
   * Useful for testing or environments that require a custom fetch (e.g. with
   * proxy support).
   */
  fetch?: typeof globalThis.fetch
}

/**
 * One entry in the `accepts` array of a `PAYMENT-REQUIRED` challenge for the
 * `ledewire-wallet` scheme (`X402PaymentRequirements`).
 */
export interface LedewirePaymentRequirements {
  /** Always `ledewire-wallet`. */
  scheme: 'ledewire-wallet'
  /** Always `ledewire:v1`. */
  network: 'ledewire:v1'
  /** The price in US cents, as a decimal string. */
  amount: string
  /** Always `USD`. */
  asset: 'USD'
  /** `store:<store id>`: the Store selling the work, the authorization's `to`. */
  payTo: string
  /** The longest validity window, in seconds, an authorization may span. */
  maxTimeoutSeconds: 300
  /** Always `{}`: there is no server nonce. */
  extra: Record<string, never>
}

/**
 * The decoded x402 v2 `PAYMENT-REQUIRED` header for the `ledewire-wallet`
 * scheme (`X402PaymentRequired`).
 */
export interface LedewirePaymentRequired {
  /** Always `2`. */
  x402Version: 2
  /**
   * Why payment is asked for: `PAYMENT-SIGNATURE header is required` on the
   * first request, or the refusal code after a refused payment.
   */
  error: 'PAYMENT-SIGNATURE header is required' | LedewireRefusalCode
  /** The resource being paid for. Its `url` is the authorization's `resource`. */
  resource: { url: string; description: string; mimeType: 'application/json' }
  /** Exactly one `ledewire-wallet` entry. */
  accepts: LedewirePaymentRequirements[]
  /** Always `{}`. */
  extensions: Record<string, never>
}

/**
 * A Payment authorization: the payer's signed promise to pay one amount, to
 * one recipient, for one resource, once, within a window.
 */
export interface LedewirePaymentAuthorization {
  /** The Payment key's id. */
  from: string
  /** The challenge's `payTo`. */
  to: string
  /** The challenge's `amount`: cents, as a decimal string. */
  value: string
  /** The challenge's `asset`. */
  asset: string
  /** The challenge's `resource.url`. */
  resource: string
  /** Unix seconds; not valid before this. */
  validAfter: number
  /** Unix seconds; not valid after this. */
  validBefore: number
  /** 32 random bytes as 64 lowercase hex characters, fresh for every payment. */
  nonce: string
}

/**
 * The `payload` of the `PAYMENT-SIGNATURE` header for the `ledewire-wallet`
 * scheme (`X402PaymentAuthorization`).
 */
export interface LedewireWalletPayload {
  /** Unpadded base64url Ed25519 signature over the authorization's signed bytes. */
  signature: string
  /** The signed Payment authorization. */
  authorization: LedewirePaymentAuthorization
}

/**
 * The full x402 v2 `PaymentPayload` sent, base64-encoded, in the
 * `PAYMENT-SIGNATURE` header. `accepted` echoes the challenge's `accepts`
 * entry; the API reads only its `scheme` and `network`.
 */
export interface LedewirePaymentPayload {
  /** Always `2`. */
  x402Version: 2
  /** The `accepts` entry being paid. */
  accepted: LedewirePaymentRequirements
  /** The signed Payment authorization. */
  payload: LedewireWalletPayload
}

/**
 * A registered Payment key as the API returns it (`PaymentKey`). It holds
 * only the public half.
 */
export interface LedewirePaymentKeyRecord {
  /** The id a Payment authorization names in `from`. */
  id: string
  /** The key's label. */
  name: string
  /** The 32 raw Ed25519 public-key bytes, as unpadded base64url. */
  public_key: string
  /** The Company admin who registered it for a Machine user, else `null`. */
  created_by_user_id: string | null
  /** When it last settled a payment; `null` until it has. */
  last_used_at: string | null
  /** When it was registered. */
  created_at: string
}

/**
 * Decoded `PAYMENT-RESPONSE` header returned on a successful payment: the
 * spec's `SettlementResponse`. `accessToken` is omitted (never `null`) when
 * the server has no signing key; verify it against `client.x402.getJwks()`
 * in `@ledewire/node`.
 */
export type LedewireSettlementResponse = X402SettlementResponse

/**
 * Decoded `PAYMENT-RESPONSE` header on a refused PAID request, in the x402 v2
 * HTTP transport spec's `SettleResponse` shape with `success: false` (see
 * ledewire/api#1066). The adapters still map it when it is sent; the API
 * reports signed-payment refusals in a fresh `PAYMENT-REQUIRED` instead.
 */
export interface LedewirePaymentRefusal {
  success: false
  /** Machine-readable refusal reason, e.g. `daily_spend_cap_reached`. */
  errorReason: string
  /** Always empty on a refusal — no transaction was settled. */
  transaction: string
  /** Payment network identifier. Always `ledewire:v1`. */
  network: string
  /** Buyer wallet identifier, when the server included one. */
  payer?: string
}
