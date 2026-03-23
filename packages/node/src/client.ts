import {
  DEFAULT_BASE_URL,
  HttpClient,
  MemoryTokenStorage,
  TokenManager,
  createRefreshFn,
} from '@ledewire/core'
import type { TokenStorage, StoredTokens } from '@ledewire/core'
import { AuthNamespace } from './resources/auth.js'
import { CheckoutNamespace } from './resources/checkout.js'
import { ConfigNamespace } from './resources/config.js'
import { ContentNamespace } from './resources/content.js'
import { MerchantNamespace } from './resources/merchant/index.js'
import { PurchasesNamespace } from './resources/purchases.js'
import { SellerNamespace } from './resources/seller/index.js'
import { WalletNamespace } from './resources/wallet.js'

/**
 * Configuration options for the LedeWire Node.js client.
 */
export interface NodeClientConfig {
  /**
   * LedeWire API key.
   * Required for all seller and buyer operations.
   * Omit when using merchant email/password auth exclusively.
   */
  apiKey?: string
  /**
   * LedeWire API secret.
   * When combined with `apiKey`, grants `full` (read/write) seller permission.
   * When omitted, `apiKey` alone grants `view` (read-only) seller permission.
   */
  apiSecret?: string
  /**
   * Override the API base URL.
   * Defaults to `https://api.ledewire.com`.
   *
   * @example Set to staging for development:
   * ```ts
   * baseUrl: 'https://api-staging.ledewire.com'
   * ```
   */
  baseUrl?: string
  /**
   * Custom token storage implementation.
   * Defaults to {@link MemoryTokenStorage} (in-memory).
   *
   * **Serverless / edge warning:** `MemoryTokenStorage` resets on every cold start.
   * Tokens are lost between function invocations, causing a login loop. Always
   * provide a persistent adapter (Redis, database, encrypted httpOnly cookie) when
   * deploying to serverless or edge runtimes.
   *
   * `setTokens` is called both on initial login and after every background token
   * refresh — it is the canonical hook for persisting updated credentials.
   *
   * ```ts
   * storage: {
   *   getTokens: async () => JSON.parse(await redis.get('tokens')),
   *   setTokens: async (t) => redis.set('tokens', JSON.stringify(t)),
   *   clearTokens: async () => redis.del('tokens'),
   * }
   * ```
   */
  storage?: TokenStorage
  /**
   * Called after a successful background token refresh, in addition to `storage.setTokens`.
   *
   * **Scope:** fires only on background token refresh — not on initial login or signup.
   * `storage.setTokens` fires on both. If you need to persist tokens on every auth event,
   * the `storage` adapter is the correct hook.
   *
   * Use `onTokenRefreshed` **only** for side-effects that should run specifically when
   * the SDK auto-refreshes a token in the background, e.g. audit logging, cache
   * invalidation, or notifying a secondary system. If you are using a `storage` adapter,
   * `storage.setTokens` is already the correct persistence hook — providing both
   * will result in double-writes on every refresh.
   *
   * @example Audit log only (storage handles persistence separately):
   * ```ts
   * onTokenRefreshed: async (tokens) => {
   *   await auditLog.record('token_refreshed', { expires_at: tokens.expiresAt })
   * }
   * ```
   */
  onTokenRefreshed?: (tokens: StoredTokens) => void | Promise<void>
  /**
   * Called when the session fully expires and cannot be refreshed.
   * Handle this by prompting the user to re-authenticate.
   */
  onAuthExpired?: () => void | Promise<void>
}

/**
 * Creates a fully configured LedeWire Node.js client.
 *
 * @example API key + secret (seller / buyer access):
 * ```ts
 * import { createClient } from '@ledewire/node'
 *
 * const client = createClient({
 *   apiKey: process.env.LEDEWIRE_API_KEY,
 *   apiSecret: process.env.LEDEWIRE_API_SECRET,
 * })
 * ```
 *
 * @example Merchant JWT auth (email / password, no API key):
 * ```ts
 * import { createClient, ForbiddenError } from '@ledewire/node'
 *
 * const client = createClient({
 *   storage: {
 *     getTokens: async () => JSON.parse((await redis.get('lw:tokens')) ?? 'null'),
 *     setTokens: async (t) => redis.set('lw:tokens', JSON.stringify(t)),
 *     clearTokens: async () => redis.del('lw:tokens'),
 *   },
 *   onAuthExpired: () => redirect('/login'),
 * })
 *
 * const { tokens, stores } = await client.merchant.auth.loginWithEmailAndListStores({
 *   email: 'owner@example.com',
 *   password: process.env.MERCHANT_PASSWORD,
 * })
 * const storeId = stores[0].id
 * ```
 *
 * @example Merchant JWT auth (Google OAuth):
 * ```ts
 * const { tokens, stores } = await client.merchant.auth.loginWithGoogleAndListStores({
 *   id_token: googleIdToken,
 * })
 * const storeId = stores[0].id
 * ```
 */
export function createClient(config: NodeClientConfig = {}): NodeClient {
  const baseUrl = config.baseUrl ?? DEFAULT_BASE_URL
  const storage = config.storage ?? new MemoryTokenStorage()

  if (
    config.storage !== undefined &&
    config.onTokenRefreshed !== undefined &&
    (typeof process === 'undefined' || process.env['NODE_ENV'] !== 'production')
  ) {
    console.warn(
      '[LedeWire] Both `storage` and `onTokenRefreshed` are configured. ' +
        '`storage.setTokens` fires on both login and background token refresh and is the ' +
        'canonical persistence hook. `onTokenRefreshed` fires only on background refresh ' +
        'and is intended for side-effects (audit logging, cache invalidation), not duplicate ' +
        'persistence. If both are writing tokens to the same store, remove `onTokenRefreshed`.',
    )
  }

  const tokenManager = new TokenManager({
    storage,
    refreshFn: createRefreshFn(baseUrl),
    ...(config.onTokenRefreshed !== undefined && { onTokenRefreshed: config.onTokenRefreshed }),
    ...(config.onAuthExpired !== undefined && { onAuthExpired: config.onAuthExpired }),
  })

  const http = new HttpClient({
    baseUrl,
    getAccessToken: () => tokenManager.getAccessToken(),
    onUnauthorized: () => tokenManager.handleUnauthorized(),
  })

  return new NodeClient(http, tokenManager, config)
}

/**
 * The LedeWire Node.js client.
 * Access API resources through the namespaced properties.
 *
 * @remarks
 * Instantiate with {@link createClient} rather than constructing directly.
 */
export class NodeClient {
  /** Platform-level public configuration (no auth required) */
  readonly config: ConfigNamespace

  /** Buyer authentication: email/password, Google, API key, password reset */
  readonly auth: AuthNamespace

  /** Merchant operations: store auth, team management, content, sales */
  readonly merchant: MerchantNamespace

  /** Seller content and sales management (API key auth) */
  readonly seller: SellerNamespace

  /** Buyer wallet: balance, fund, transactions */
  readonly wallet: WalletNamespace

  /** Content purchases for the authenticated buyer */
  readonly purchases: PurchasesNamespace

  /** Public content with per-user access information */
  readonly content: ContentNamespace

  /** Buyer checkout state — what action is required before accessing content */
  readonly checkout: CheckoutNamespace

  /** @internal */
  constructor(
    private readonly _http: HttpClient,
    private readonly _tokenManager: TokenManager,
    private readonly _config: NodeClientConfig,
  ) {
    this.config = new ConfigNamespace(_http)
    this.auth = new AuthNamespace(_http, _tokenManager)
    this.merchant = new MerchantNamespace(_http, _tokenManager)
    this.seller = new SellerNamespace(_http)
    this.wallet = new WalletNamespace(_http)
    this.purchases = new PurchasesNamespace(_http)
    this.content = new ContentNamespace(_http)
    this.checkout = new CheckoutNamespace(_http)
  }
}
