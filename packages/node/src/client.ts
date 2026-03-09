import { HttpClient, MemoryTokenStorage, TokenManager, parseExpiresAt } from '@ledewire/core'
import type { TokenStorage, StoredTokens } from '@ledewire/core'

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
   * Provide a custom adapter to persist tokens to a database or cache
   * across server restarts:
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
   * Called after a successful token refresh.
   * Use this to persist updated tokens to your storage backend.
   *
   * @example
   * ```ts
   * onTokenRefreshed: async (tokens) => {
   *   await db.sessions.upsert({ tokens })
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
 * @example Full access (API key + secret):
 * ```ts
 * import { createClient } from '@ledewire/node'
 *
 * const client = createClient({
 *   apiKey: process.env.LEDEWIRE_API_KEY,
 *   apiSecret: process.env.LEDEWIRE_API_SECRET,
 * })
 * ```
 *
 * @example Merchant email/password auth:
 * ```ts
 * const client = createClient()
 * await client.merchant.auth.loginWithEmail({ email, password })
 * const sales = await client.merchant.sales.list({ storeId: 'store-id' })
 * ```
 */
export function createClient(config: NodeClientConfig = {}): NodeClient {
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

  /**
   * @internal
   * Exposed for testing and advanced use cases.
   */
  constructor(
    public readonly _http: HttpClient,
    public readonly _tokenManager: TokenManager,
    public readonly _config: NodeClientConfig,
  ) {
    this.auth = new AuthNamespace(_http, _tokenManager)
    this.merchant = new MerchantNamespace(_http, _tokenManager)
    this.seller = new SellerNamespace(_http)
    this.wallet = new WalletNamespace(_http)
    this.purchases = new PurchasesNamespace(_http)
    this.content = new ContentNamespace(_http)
  }
}

// Placeholder namespace classes - replaced by real implementations in build step 4
/** @internal */
class AuthNamespace {
  constructor(
    protected readonly http: HttpClient,
    protected readonly tokenManager: TokenManager,
  ) {}
}
/** @internal */
class MerchantNamespace {
  constructor(
    protected readonly http: HttpClient,
    protected readonly tokenManager: TokenManager,
  ) {}
}
/** @internal */
class SellerNamespace {
  constructor(protected readonly http: HttpClient) {}
}
/** @internal */
class WalletNamespace {
  constructor(protected readonly http: HttpClient) {}
}
/** @internal */
class PurchasesNamespace {
  constructor(protected readonly http: HttpClient) {}
}
/** @internal */
class ContentNamespace {
  constructor(protected readonly http: HttpClient) {}
}
