import {
  DEFAULT_BASE_URL,
  HttpClient,
  MemoryTokenStorage,
  TokenManager,
  createRefreshFn,
} from '@ledewire/core'
import type { TokenStorage, StoredTokens } from '@ledewire/core'
import { AcquisitionsNamespace } from './resources/acquisitions.js'
import { AuthNamespace } from './resources/auth.js'
import { CheckoutNamespace } from './resources/checkout.js'
import { CompanyNamespace } from './resources/company/index.js'
import { ConfigNamespace } from './resources/config.js'
import { ContentNamespace } from './resources/content.js'
import { MerchantNamespace } from './resources/merchant/index.js'
import { PublicationsNamespace } from './resources/publications.js'
import { TopicsNamespace } from './resources/topics.js'
import { PurchasesNamespace } from './resources/purchases.js'
import { UserNamespace } from './resources/user/index.js'
import { WalletNamespace } from './resources/wallet.js'
import { X402Namespace } from './resources/x402.js'

/**
 * Configuration options for the LedeWire Node.js client.
 */
export interface NodeClientConfig {
  /**
   * Store API key. When set, the client logs in with it automatically
   * (`POST /v1/auth/login/api-key`), the same login as
   * `client.auth.loginWithApiKey()`:
   *
   * - before its first authenticated request, when no token is stored
   *   (construction itself sends nothing; concurrent first requests share one login)
   * - again when a token refresh fails, retrying the request once
   *
   * A client that already holds a token (from `storage`, or an explicit login)
   * does not log in. A refused key rejects the request with an `AuthError`
   * carrying the API's message, and `onAuthExpired` fires once per failed login.
   *
   * On a client created with `apiKey`, clearing the stored tokens doesn't drop
   * the credentials: the next request logs in again. To stop for good, create a
   * client without `apiKey`. Don't mix another login (email, Google, merchant)
   * on an `apiKey` client: if that session's refresh fails, the client falls
   * back to the store key.
   *
   * To read the key's `store_id`, call `client.auth.loginWithApiKey()` once
   * yourself; the client then holds a token and doesn't log in again.
   *
   * Omit when using merchant email/password or buyer auth.
   */
  apiKey?: string
  /**
   * Secret paired with `apiKey`, sent with the automatic login.
   * When combined with `apiKey`, grants `full` (read/write) store permission.
   * When omitted, `apiKey` alone grants `view` (read-only) store permission.
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
   * With `apiKey` set, the client logs in again with the key instead, and this
   * fires only when an automatic login fails (once per failed attempt).
   */
  onAuthExpired?: () => void | Promise<void>
}

/**
 * Creates a fully configured LedeWire Node.js client.
 *
 * @example Store API key + secret (logs in automatically on the first request):
 * ```ts
 * import { createClient } from '@ledewire/node'
 *
 * const client = createClient({
 *   apiKey: process.env.LEDEWIRE_API_KEY,
 *   apiSecret: process.env.LEDEWIRE_API_SECRET,
 * })
 * const sales = await client.merchant.sales.list(storeId)
 *
 * // Need the key's store_id? Log in explicitly once; the client won't repeat it.
 * const { store_id } = await client.auth.loginWithApiKey({
 *   key: process.env.LEDEWIRE_API_KEY,
 *   secret: process.env.LEDEWIRE_API_SECRET,
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

  // A store API key logs in by itself, through the same `loginWithApiKey` an
  // explicit login uses (a credential exchange, so it never re-enters the
  // token manager). `client` is read only when a request needs a token, by
  // which point it is constructed below.
  const { apiKey, apiSecret } = config
  const login =
    apiKey === undefined
      ? undefined
      : async (): Promise<string> => {
          const res = await client.auth.loginWithApiKey({
            key: apiKey,
            ...(apiSecret !== undefined && { secret: apiSecret }),
          })
          return res.access_token
        }

  const tokenManager = new TokenManager({
    storage,
    refreshFn: createRefreshFn(baseUrl),
    ...(config.onTokenRefreshed !== undefined && { onTokenRefreshed: config.onTokenRefreshed }),
    ...(config.onAuthExpired !== undefined && { onAuthExpired: config.onAuthExpired }),
    ...(login !== undefined && { login }),
  })

  const http = new HttpClient({
    baseUrl,
    getAccessToken: () => tokenManager.getAccessToken(),
    onUnauthorized: () => tokenManager.handleUnauthorized(),
  })

  const client = new NodeClient(http, tokenManager, config)
  return client
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

  /** Buyer wallet: balance, fund, transactions */
  readonly wallet: WalletNamespace

  /** Content purchases for the authenticated buyer */
  readonly purchases: PurchasesNamespace

  /** Public content with per-user access information */
  readonly content: ContentNamespace

  /** Buyer checkout state — what action is required before accessing content */
  readonly checkout: CheckoutNamespace

  /** Authenticated buyer account: API keys, MCP keys, and the daily spend cap */
  readonly user: UserNamespace

  /** Company membership, and Company administration: members, Machine users, wallet, reports */
  readonly company: CompanyNamespace

  /** Publications available to bulk-license, and their works (no auth required) */
  readonly publications: PublicationsNamespace

  /** Topic directory: the subjects publications cover, with how many carry each (no auth required) */
  readonly topics: TopicsNamespace

  /** Buyer bulk acquisitions: quote, acknowledge, authorize, corpus download, signed manifest */
  readonly acquisitions: AcquisitionsNamespace

  /** Public x402 Bazaar resource discovery (no auth required) */
  readonly x402: X402Namespace

  /** @internal */
  constructor(
    private readonly _http: HttpClient,
    private readonly _tokenManager: TokenManager,
    private readonly _config: NodeClientConfig,
  ) {
    this.config = new ConfigNamespace(_http)
    this.auth = new AuthNamespace(_http, _tokenManager)
    this.merchant = new MerchantNamespace(_http, _tokenManager)
    this.wallet = new WalletNamespace(_http)
    this.purchases = new PurchasesNamespace(_http)
    this.content = new ContentNamespace(_http)
    this.checkout = new CheckoutNamespace(_http)
    this.user = new UserNamespace(_http)
    this.company = new CompanyNamespace(_http)
    this.publications = new PublicationsNamespace(_http)
    this.topics = new TopicsNamespace(_http)
    this.acquisitions = new AcquisitionsNamespace(_http)
    this.x402 = new X402Namespace(_http)
  }
}

/**
 * Configuration options for the LedeWire agent client.
 *
 * The agent client is a buyer-scoped client designed for autonomous (headless)
 * agents. It authenticates automatically using a buyer API key + secret and
 * exposes only the namespaces an agent needs: `auth`, `wallet`, `purchases`,
 * `content`, `checkout`, `user`, `company`, `publications`, `topics`, `acquisitions`,
 * and `x402`.
 */
export interface AgentClientConfig {
  /**
   * Buyer API key (e.g. `bktst_abc123`).
   * Obtain via `client.user.apiKeys.create()` after signing up as a buyer.
   */
  key: string
  /**
   * 64-char hex secret paired with `key`.
   * Shown once at creation — store in a secrets manager, never in source code.
   */
  secret: string
  /**
   * Override the API base URL. Defaults to `https://api.ledewire.com`.
   */
  baseUrl?: string
  /**
   * Custom token storage. Defaults to {@link MemoryTokenStorage}.
   *
   * **Serverless / edge warning:** `MemoryTokenStorage` resets on cold start.
   * In serverless environments the agent will re-authenticate on every
   * invocation. Provide a persistent adapter (Redis, KV store, encrypted
   * database column) to avoid the extra round-trip on each cold start.
   */
  storage?: TokenStorage
}

/**
 * A buyer-scoped client for autonomous agents.
 * Exposes `auth`, `wallet`, `purchases`, `content`, `checkout`, `user`,
 * `company`, `publications`, `topics`, `acquisitions`, and `x402`.
 *
 * Instantiate with {@link createAgentClient} rather than constructing directly.
 */
export type AgentClient = Pick<
  NodeClient,
  | 'auth'
  | 'wallet'
  | 'purchases'
  | 'content'
  | 'checkout'
  | 'user'
  | 'company'
  | 'publications'
  | 'topics'
  | 'acquisitions'
  | 'x402'
>

/**
 * Creates a LedeWire client optimised for autonomous agents.
 *
 * The client authenticates automatically using a buyer API key + secret.
 * On the first API call the agent exchanges its credentials for a JWT; the
 * `TokenManager` then refreshes it proactively in the background — the agent
 * never needs to call `auth.loginWithBuyerApiKey()` manually.
 *
 * Only buyer-relevant namespaces are exposed. `merchant` and `config` are
 * intentionally absent.
 *
 * @example
 * ```ts
 * import { createAgentClient } from '@ledewire/node'
 *
 * const agent = createAgentClient({
 *   key: process.env.LEDEWIRE_BUYER_KEY,
 *   secret: process.env.LEDEWIRE_BUYER_SECRET,
 * })
 *
 * // Authenticate once, then use the wallet and purchasing APIs freely
 * await agent.auth.loginWithBuyerApiKey({
 *   key: process.env.LEDEWIRE_BUYER_KEY,
 *   secret: process.env.LEDEWIRE_BUYER_SECRET,
 * })
 *
 * // Check access before buying: a preview and access_info, never the deliverable
 * const preview = await agent.content.getWithAccess('abc123')
 * if (preview.access_info.next_required_action === 'purchase') {
 *   // The purchase response is the only delivery (single-use): keep it now
 *   const purchase = await agent.purchases.create({
 *     content_id: preview.id,
 *     price_cents: preview.price_cents,
 *   })
 *   const deliverable = purchase.content_body ?? purchase.content_uri
 * }
 * ```
 */
export function createAgentClient(config: AgentClientConfig): AgentClient {
  const baseUrl = config.baseUrl ?? DEFAULT_BASE_URL
  const storage = config.storage ?? new MemoryTokenStorage()

  const tokenManager = new TokenManager({
    storage,
    refreshFn: createRefreshFn(baseUrl),
  })

  const http = new HttpClient({
    baseUrl,
    getAccessToken: () => tokenManager.getAccessToken(),
    onUnauthorized: () => tokenManager.handleUnauthorized(),
  })

  // Wire the full NodeClient so all namespace constructors run,
  // then return only the buyer-relevant subset via the AgentClient type.
  const client = new NodeClient(http, tokenManager, {
    baseUrl,
    storage,
  })

  return {
    auth: client.auth,
    wallet: client.wallet,
    purchases: client.purchases,
    content: client.content,
    checkout: client.checkout,
    user: client.user,
    company: client.company,
    publications: client.publications,
    topics: client.topics,
    acquisitions: client.acquisitions,
    x402: client.x402,
  }
}
