/**
 * Seller content namespace for browser environments.
 *
 * Read-only operations using a view-permission API key token.
 * Hits the `/v1/seller/content` family of endpoints — store identity is
 * derived server-side from the token, so no `store_id` is required.
 *
 * @module
 */
import type { HttpClient } from '@ledewire/core'
import type { ContentResponse } from '@ledewire/core'

/**
 * Search criteria for seller content search.
 * At least one field must be supplied. All supplied fields must match (AND logic).
 */
export interface SellerContentSearchRequest {
  /** Case-insensitive partial match against the content title. */
  title?: string
  /** Case-insensitive partial match against the content URI (`external_ref` content only). */
  uri?: string
  /** Exact key/value pairs to AND-match against content metadata. */
  metadata?: Record<string, unknown>
}

/**
 * Seller content namespace — list, search, and fetch store content by API key.
 *
 * Obtain via `lw.seller.content` — do not construct directly.
 *
 * @example
 * ```ts
 * const lw = Ledewire.init({ apiKey: 'your_api_key' })
 * await lw.auth.loginWithApiKey({ key: 'your_api_key' })
 *
 * const items = await lw.seller.content.list()
 * const results = await lw.seller.content.search({ title: 'intro' })
 * const item = await lw.seller.content.get('content-id')
 * ```
 */
export class BrowserSellerContentNamespace {
  /** @internal */
  constructor(private readonly http: HttpClient) {}

  /**
   * List all content for the authenticated seller's store.
   * Requires a token with at least `view` permission.
   *
   * @returns Array of content items.
   *
   * @example
   * ```ts
   * const items = await lw.seller.content.list()
   * ```
   */
  async list(): Promise<ContentResponse[]> {
    return this.http.get<ContentResponse[]>('/v1/seller/content')
  }

  /**
   * Search content by title, URI, and/or metadata (AND logic).
   * At least one criterion must be supplied.
   * Requires a token with at least `view` permission.
   *
   * @param body - Search criteria (title, uri, and/or metadata).
   * @returns Array of matching content items.
   *
   * @example
   * ```ts
   * const results = await lw.seller.content.search({ title: 'intro' })
   * const byUri = await lw.seller.content.search({ uri: 'vimeo.com' })
   * const byMeta = await lw.seller.content.search({ metadata: { author: 'Alice' } })
   * ```
   */
  async search(body: SellerContentSearchRequest): Promise<ContentResponse[]> {
    return this.http.post<ContentResponse[]>('/v1/seller/content/search', body)
  }

  /**
   * Get a single content item by ID.
   * Requires a token with at least `view` permission.
   *
   * @param id - The content ID.
   * @returns The content item.
   *
   * @example
   * ```ts
   * const item = await lw.seller.content.get('content-id')
   * ```
   */
  async get(id: string): Promise<ContentResponse> {
    return this.http.get<ContentResponse>(`/v1/seller/content/${id}`)
  }
}
