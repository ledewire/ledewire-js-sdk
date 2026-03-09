/**
 * Seller content management namespace.
 *
 * CRUD operations for store content. Requires API key with `full` permission
 * for write operations, `view` permission for reads, or a merchant JWT with
 * `owner` or `is_author` role.
 *
 * @module
 */
import type { HttpClient } from '@ledewire/core'
import type { Content, ContentResponse, ContentUpdateRequest } from '@ledewire/core'

/**
 * Search criteria for content metadata search.
 * All entries in `metadata` must match (AND logic).
 */
export interface ContentSearchRequest {
  /** Key/value pairs to match against content metadata. */
  metadata: Record<string, unknown>
}

/**
 * Manage content for a merchant store.
 *
 * Obtain via `client.seller.content` — do not construct directly.
 */
export class SellerContentNamespace {
  /** @internal */
  constructor(private readonly http: HttpClient) {}

  /**
   * List all content for the store.
   * Owners and API keys see all content; `is_author` users see only their own.
   *
   * @param storeId - The store whose content to list.
   *
   * @example
   * ```ts
   * const items = await client.seller.content.list('store-id')
   * ```
   */
  async list(storeId: string): Promise<ContentResponse[]> {
    return this.http.get<ContentResponse[]>(`/v1/merchant/${storeId}/content`)
  }

  /**
   * Create a new content item in the store.
   * Returns the persisted item with server-assigned `id`.
   *
   * Authorship is resolved server-side:
   * - Created by an `is_author` user → attributed to that user.
   * - Created via API key → attributed to the store owner.
   * - Created by an owner → attributed to the owner.
   *
   * @param storeId - The store in which to create the content.
   * @param body - Content creation parameters.
   *
   * @example
   * ```ts
   * const item = await client.seller.content.create('store-id', {
   *   content_type: 'markdown',
   *   title: 'Hello World',
   *   content_body: btoa('# Hello World'),
   *   price_cents: 500,
   *   visibility: 'public',
   * })
   * ```
   */
  async create(storeId: string, body: Content): Promise<ContentResponse> {
    return this.http.post<ContentResponse>(`/v1/merchant/${storeId}/content`, body)
  }

  /**
   * Search content by metadata key/value pairs (AND logic).
   * Results are scoped by role: owners see all, `is_author` users see their own.
   *
   * @param storeId - The store to search within.
   * @param body - Metadata criteria.
   *
   * @example
   * ```ts
   * const results = await client.seller.content.search('store-id', {
   *   metadata: { author: 'Alice' },
   * })
   * ```
   */
  async search(storeId: string, body: ContentSearchRequest): Promise<ContentResponse[]> {
    return this.http.post<ContentResponse[]>(`/v1/merchant/${storeId}/content/search`, body)
  }

  /**
   * Get a single content item by ID.
   *
   * @param storeId - The store the content belongs to.
   * @param id - The content ID.
   *
   * @example
   * ```ts
   * const item = await client.seller.content.get('store-id', 'content-id')
   * ```
   */
  async get(storeId: string, id: string): Promise<ContentResponse> {
    return this.http.get<ContentResponse>(`/v1/merchant/${storeId}/content/${id}`)
  }

  /**
   * Update an existing content item.
   *
   * @param storeId - The store the content belongs to.
   * @param id - The content ID to update.
   * @param body - Partial update fields (all fields optional).
   *
   * @example
   * ```ts
   * const updated = await client.seller.content.update('store-id', 'content-id', {
   *   title: 'Updated Title',
   *   price_cents: 750,
   * })
   * ```
   */
  async update(storeId: string, id: string, body: ContentUpdateRequest): Promise<ContentResponse> {
    return this.http.patch<ContentResponse>(`/v1/merchant/${storeId}/content/${id}`, body)
  }

  /**
   * Delete a content item permanently.
   *
   * @param storeId - The store the content belongs to.
   * @param id - The content ID to delete.
   *
   * @example
   * ```ts
   * await client.seller.content.delete('store-id', 'content-id')
   * ```
   */
  async delete(storeId: string, id: string): Promise<void> {
    return this.http.delete(`/v1/merchant/${storeId}/content/${id}`)
  }
}
