/**
 * Seller content namespace for browser environments.
 *
 * Read-only operations using a view-permission API key token.
 * Hits the `/v1/seller/content` family of endpoints — store identity is
 * derived server-side from the token, so no `store_id` is required.
 *
 * @module
 */
import { decodeContentFields } from '@ledewire/core'
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
  /**
   * Exact match against the content's external identifier.
   * Use the full formatted value as it appears in `ContentResponse.external_identifier`,
   * e.g. `'vimeo:123456789'`.
   */
  external_identifier?: string
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
 * await lw.seller.loginWithApiKey({ key: 'your_api_key' })
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
   * @returns Array of content items. `teaser` is returned as plain text —
   * the SDK decodes base64 automatically.
   *
   * @example
   * ```ts
   * const items = await lw.seller.content.list()
   * ```
   */
  async list(): Promise<ContentResponse[]> {
    const res = await this.http.get<ContentResponse[]>('/v1/seller/content')
    return res.map(decodeContentFields)
  }

  /**
   * Search content by title, URI, and/or metadata (AND logic).
   * At least one criterion must be supplied.
   * Requires a token with at least `view` permission.
   *
   * @param body - Search criteria (title, uri, and/or metadata).
   * @returns Array of matching content items. `teaser` is returned as plain
   * text — the SDK decodes base64 automatically.
   *
   * @example
   * ```ts
   * const results = await lw.seller.content.search({ title: 'intro' })
   * const byUri = await lw.seller.content.search({ uri: 'vimeo.com' })
   * const byId = await lw.seller.content.search({ external_identifier: 'vimeo:123456789' })
   * const byMeta = await lw.seller.content.search({ metadata: { author: 'Alice' } })
   * ```
   */
  async search(body: SellerContentSearchRequest): Promise<ContentResponse[]> {
    const res = await this.http.post<ContentResponse[]>('/v1/seller/content/search', body)
    return res.map(decodeContentFields)
  }

  /**
   * Get a single content item by ID.
   * Requires a token with at least `view` permission.
   *
   * @param id - The content ID.
   * @returns The content item. `content_body` and `teaser` are returned as
   * plain UTF-8 text — the SDK decodes base64 automatically so you can render
   * them directly without calling `atob()`.
   *
   * @example
   * ```ts
   * const item = await lw.seller.content.get('content-id')
   * // item.content_body is plain markdown — no atob() needed
   * ```
   */
  async get(id: string): Promise<ContentResponse> {
    const res = await this.http.get<ContentResponse>(`/v1/seller/content/${id}`)
    return decodeContentFields(res)
  }
}
