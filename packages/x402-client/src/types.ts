/**
 * Configuration for `createLedewireFetch`.
 */
export interface LedewireFetchConfig {
  /**
   * Buyer API key (e.g. `bktst_abc123`). Obtained from
   * `client.user.apiKeys.create()` in `@ledewire/node` or `@ledewire/browser`.
   */
  key: string
  /**
   * 64-char hex secret paired with the key. Shown once at creation only.
   */
  secret: string
  /**
   * Override the Ledewire API base URL. Defaults to `https://api.ledewire.com`.
   * Can also be discovered from the `extensions.ledewire-wallet.apiBase` field
   * in a PAYMENT-REQUIRED response, which takes precedence when present.
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
 * The decoded structure of an x402 v2 `PAYMENT-REQUIRED` header for the
 * `ledewire-wallet` scheme.
 */
export interface LedewirePaymentRequired {
  x402Version: number
  resource: { url: string; description?: string; mimeType?: string }
  accepts: LedewirePaymentRequirements[]
  extensions?: Record<string, unknown>
}

/**
 * A single entry in the `accepts` array of a `PAYMENT-REQUIRED` response
 * for the `ledewire-wallet` scheme.
 */
export interface LedewirePaymentRequirements {
  scheme: string
  network: string
  amount: string
  asset: string
  payTo: string
  maxTimeoutSeconds: number
  extra: LedewireWalletExtra
}

/**
 * Scheme-specific extra fields present in the `accepts[].extra` object for
 * the `ledewire-wallet` scheme.
 */
export interface LedewireWalletExtra {
  /** Single-use token minted by the server for this payment challenge. */
  nonce: string
  /** Unix timestamp (seconds) after which the nonce expires. */
  expiresAt: number
  /** UUID of the Ledewire content record being purchased. */
  contentId: string
}

/**
 * The `extensions.ledewire-wallet` discovery block present in a
 * `PAYMENT-REQUIRED` response.
 */
export interface LedewireWalletExtension {
  /** Ledewire API base URL (environment-aware, derived from the request). */
  apiBase: string
  /** Path to the buyer API key auth endpoint. */
  authEndpoint: string
  /** URL for creating a Ledewire account. */
  signupUrl?: string
  /** Scheme version string. Always `ledewire:v1`. */
  schemeVersion: string
  /** UUID of the Ledewire content record. Identical to `accepts[0].extra.contentId`. */
  contentId: string
}

/**
 * The `payload` object placed inside the x402 v2 `PaymentPayload` for the
 * `ledewire-wallet` scheme.
 */
export interface LedewireWalletPayload {
  /** Buyer JWT obtained by authenticating with the buyer API key. */
  token: string
  /** UUID of the Ledewire content record being purchased. */
  contentId: string
}

/**
 * Full x402 v2 `PaymentPayload` sent in the `PAYMENT-SIGNATURE` header.
 */
export interface LedewirePaymentPayload {
  x402Version: 2
  resource: { url: string }
  accepted: LedewirePaymentRequirements
  payload: LedewireWalletPayload
  extensions?: Record<string, unknown>
}

/**
 * Decoded `PAYMENT-RESPONSE` header returned on a successful payment.
 */
export interface LedewireSettlementResponse {
  success: true
  transaction: string
  network: string
  payer: string
  accessToken?: string | null
}
