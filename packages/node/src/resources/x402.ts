import type { HttpClient } from '@ledewire/core'
import type {
  X402BazaarDiscoveryResponse,
  X402DiscoveryParams,
  X402JwksResponse,
  X402VerifyOriginParams,
  X402VerifyOriginResponse,
} from '@ledewire/core'

/**
 * Public x402 namespace: the Bazaar catalog of resources gated by the
 * `ledewire-wallet` x402 scheme, origin verification for third-party pages,
 * and the JWKS that verifies a settlement `accessToken` offline.
 *
 * No authentication required. The request is always sent without credentials,
 * so a stale or expired session never blocks it. The
 * response never carries the delivered content (`content_body` /
 * `content_uri`) — only the `teaser` preview. Pay for a resource via the
 * x402 flow itself (see `@ledewire/x402-client`), not through this
 * namespace.
 *
 * @example
 * ```ts
 * const { total, resources } = await client.x402.discoverResources({ limit: 20 })
 * for (const resource of resources) {
 *   console.log(resource.metadata.title, resource.metadata.teaser)
 * }
 * ```
 */
export class X402Namespace {
  constructor(protected readonly http: HttpClient) {}

  /**
   * Lists public resources gated by the x402 `ledewire-wallet` scheme.
   *
   * @param params - Optional `limit` (max 100) and zero-based `offset`.
   * @returns The total count of public resources and the requested page.
   */
  async discoverResources(params?: X402DiscoveryParams): Promise<X402BazaarDiscoveryResponse> {
    return this.http.get<X402BazaarDiscoveryResponse>('/v1/x402/discovery/resources', params, {
      auth: false,
    })
  }

  /**
   * Confirms that a page URL is registered as a Ledewire content item, before
   * showing any payment UI for it. Unknown or invalid URLs answer
   * `{ verified: false }`, never an error, so branch on `verified`.
   *
   * Passing `store_id` lets the API register a not-yet-registered URL on this
   * request, when that store has verified its domain and one of its pricing
   * rules matches the URL.
   *
   * @param params - The page `url`, and optionally the `store_id` whose
   *   pricing rules may cover it.
   * @returns `{ verified: true, content_id, store_id, amount, title }` or
   *   `{ verified: false }`.
   * @throws {RateLimitError} On `429` (60 requests per minute per IP);
   *   `err.retryAfter` is the `Retry-After` seconds, always enough to wait.
   *
   * @example
   * ```ts
   * const result = await client.x402.verifyOrigin({ url: 'https://theirsite.com/articles/slug' })
   * if (result.verified) console.log(result.title, result.amount)
   * ```
   */
  async verifyOrigin(params: X402VerifyOriginParams): Promise<X402VerifyOriginResponse> {
    return this.http.get<X402VerifyOriginResponse>('/v1/x402/verify-origin', params, {
      auth: false,
    })
  }

  /**
   * Fetches the JSON Web Key Set (RFC 7517) holding the RS256 public key that
   * signs the `accessToken` in an x402 `PAYMENT-RESPONSE`. Match the token's
   * `kid` header to a key here to verify it offline. The API serves it with
   * `Cache-Control: max-age=86400`, so cache it for a day.
   *
   * @returns The JWKS document.
   * @throws {LedewireError} With `statusCode` `503` and message
   *   `'JWKS unavailable'` when the server has no key material configured.
   *   That body is `{ error: 'JWKS unavailable' }`, not the `ErrorResponse`
   *   envelope, so `err.code` and `err.type` are `undefined`.
   */
  async getJwks(): Promise<X402JwksResponse> {
    return this.http.get<X402JwksResponse>('/.well-known/x402-jwks.json', undefined, {
      auth: false,
    })
  }
}
