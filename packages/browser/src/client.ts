import { HttpClient, MemoryTokenStorage, TokenManager, parseExpiresAt } from '@ledewire/core'
import type { TokenStorage } from '@ledewire/core'
import { BrowserAuthNamespace } from './resources/auth.js'
import { BrowserConfigNamespace } from './resources/config.js'
import { BrowserContentNamespace } from './resources/content.js'
import { BrowserPurchasesNamespace } from './resources/purchases.js'
import { BrowserSellerNamespace } from './resources/seller/index.js'
import { BrowserWalletNamespace } from './resources/wallet.js'
import { CheckoutNamespace } from './resources/checkout.js'

/**
 * Configuration options for the LedeWire browser client.
 */
export interface BrowserClientConfig {
  /**
   * LedeWire API key that identifies the store.
   * Obtained from the LedeWire merchant dashboard.
   */
  apiKey: string
  /**
   * Override the API base URL.
   * Defaults to `https://api.ledewire.com`.
   */
  baseUrl?: string
  /**
   * Token storage adapter.
   * Defaults to {@link MemoryTokenStorage} (in-memory, most secure).
   *
   * To persist sessions across page reloads, use the built-in
   * `localStorageAdapter`:
   * ```ts
   * import { init, localStorageAdapter } from '@ledewire/browser'
   * const lw = init({ apiKey: '...', storage: localStorageAdapter() })
   * ```
   */
  storage?: TokenStorage
  /**
   * Called when the user's session expires and cannot be refreshed.
   * Use this to show a re-authentication prompt.
   *
   * @example
   * ```ts
   * onAuthExpired: () => showLoginModal()
   * ```
   */
  onAuthExpired?: () => void
}

/**
 * Initialises a LedeWire browser client.
 * This is the primary entry point for the browser SDK.
 *
 * @example CDN usage:
 * ```html
 * <script src="https://cdn.jsdelivr.net/npm/@ledewire/browser@1/dist/ledewire.min.js"></script>
 * <script>
 *   const lw = Ledewire.init({ apiKey: 'your_api_key' })
 *   const state = await lw.checkout.state('content-id')
 * </script>
 * ```
 *
 * @example npm usage:
 * ```ts
 * import { init } from '@ledewire/browser'
 * const lw = init({ apiKey: 'your_api_key' })
 * ```
 */
export function init(config: BrowserClientConfig): BrowserClient {
  const baseUrl = config.baseUrl ?? 'https://api.ledewire.com'
  const storage = config.storage ?? new MemoryTokenStorage()

  const tokenManager = new TokenManager({
    storage,
    refreshFn: async (refreshToken) => {
      const res = await fetch(`${baseUrl}/v1/auth/token/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      })
      if (!res.ok) throw new Error('Token refresh failed')
      const data = (await res.json()) as {
        access_token: string
        refresh_token: string
        expires_at: string
      }
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: parseExpiresAt(data.expires_at),
      }
    },
    ...(config.onAuthExpired !== undefined && { onAuthExpired: config.onAuthExpired }),
  })

  const http = new HttpClient({
    baseUrl,
    getAccessToken: () => tokenManager.getAccessToken(),
    onUnauthorized: () => tokenManager.handleUnauthorized(),
  })

  return new BrowserClient(http, tokenManager, config)
}

/**
 * The LedeWire browser client.
 * Access buyer flows through the namespaced properties.
 *
 * @remarks
 * Instantiate with {@link init} rather than constructing directly.
 */
export class BrowserClient {
  /** Platform-level public configuration (no auth required) */
  readonly config: BrowserConfigNamespace

  /** Buyer authentication: email/password signup/login, Google OAuth, password reset */
  readonly auth: BrowserAuthNamespace

  /** Checkout state machine: determines next action for a piece of content */
  readonly checkout: CheckoutNamespace

  /** Wallet: balance, fund via payment session, transaction history */
  readonly wallet: BrowserWalletNamespace

  /** Content purchases for the authenticated buyer */
  readonly purchases: BrowserPurchasesNamespace

  /** Public content with per-user access information */
  readonly content: BrowserContentNamespace

  /** Seller operations: API key login, content list/search/get */
  readonly seller: BrowserSellerNamespace

  /** @internal */
  constructor(
    public readonly _http: HttpClient,
    public readonly _tokenManager: TokenManager,
    public readonly _config: BrowserClientConfig,
  ) {
    this.config = new BrowserConfigNamespace(_http)
    this.auth = new BrowserAuthNamespace(_http, _tokenManager)
    this.checkout = new CheckoutNamespace(_http)
    this.wallet = new BrowserWalletNamespace(_http)
    this.purchases = new BrowserPurchasesNamespace(_http)
    this.content = new BrowserContentNamespace(_http)
    this.seller = new BrowserSellerNamespace(_http, _tokenManager)
  }
}
