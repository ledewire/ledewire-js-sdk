import type { HttpClient } from '@ledewire/core'
import type { X402BazaarDiscoveryResponse, X402DiscoveryParams } from '@ledewire/core'

/**
 * x402 Bazaar discovery namespace — the public catalog of resources gated by
 * the `ledewire-wallet` x402 scheme.
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
}
