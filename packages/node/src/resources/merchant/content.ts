/**
 * Merchant content management namespace.
 *
 * CRUD operations for store content using merchant JWT authentication.
 * Requires `owner` role or `is_author` permissions.
 *
 * @module
 */
import { decodeContentFields, encodeContentFields } from '@ledewire/core'
import type { HttpClient } from '@ledewire/core'
import type {
  Content,
  ContentResponse,
  ContentUpdateRequest,
  PaginatedContentList,
  PaginationParams,
} from '@ledewire/core'

/**
 * Search criteria for content search.
 * At least one field must be supplied. All supplied fields must match (AND logic).
 */
export interface MerchantContentSearchRequest {
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
 * Manage content for a merchant store using merchant JWT authentication.
 *
 * Obtain via `client.merchant.content` — do not construct directly.
 */
export class MerchantContentNamespace {
  /** @internal */
  constructor(private readonly http: HttpClient) {}

  /**
   * List content for the store (paginated).
   * Owners see all content; `is_author` users see only their own.
   *
   * @param storeId - The store whose content to list.
   * @param params - Optional pagination parameters.
   *
   * @example
   * ```ts
   * const { data, pagination } = await client.merchant.content.list('store-id')
   * // data[].teaser is plain text — no atob() needed
   * ```
   */
  async list(storeId: string, params?: PaginationParams): Promise<PaginatedContentList> {
    const res = await this.http.get<PaginatedContentList>(
      `/v1/merchant/${encodeURIComponent(storeId)}/content`,
      params,
    )
    return { ...res, data: res.data.map(decodeContentFields) }
  }

  /**
   * Create a new content item in the store.
   * Returns the persisted item with server-assigned `id`.
   *
   * Authorship is resolved server-side:
   * - Created by an `is_author` user → attributed to that user.
   * - Created by an owner → attributed to the owner.
   *
   * @param storeId - The store in which to create the content.
   * @param body - Content creation parameters.
   *
   * @example
   * ```ts
   * const item = await client.merchant.content.create('store-id', {
   *   content_type: 'markdown',
   *   title: 'Hello World',
   *   content_body: '# Hello World',  // plain text — SDK encodes to base64
   *   price_cents: 500,
   *   visibility: 'public',
   * })
   * // item.content_body is plain text on the response — no atob() needed
   * ```
   */
  async create(storeId: string, body: Content): Promise<ContentResponse> {
    const res = await this.http.post<ContentResponse>(
      `/v1/merchant/${encodeURIComponent(storeId)}/content`,
      encodeContentFields(body),
    )
    return decodeContentFields(res)
  }

  /**
   * Search content by metadata key/value pairs (AND logic), with pagination.
   * Results are scoped by role: owners see all, `is_author` users see their own.
   *
   * @param storeId - The store to search within.
   * @param body - Search criteria.
   * @param params - Optional pagination parameters.
   *
   * @example
   * ```ts
   * // Search by title
   * const { data } = await client.merchant.content.search('store-id', { title: 'intro' })
   *
   * // Search by URI
   * const { data } = await client.merchant.content.search('store-id', { uri: 'vimeo.com' })
   *
   * // Search by external identifier
   * const { data } = await client.merchant.content.search('store-id', { external_identifier: 'vimeo:123456789' })
   *
   * // Search by metadata
   * const { data } = await client.merchant.content.search('store-id', { metadata: { author: 'Alice' } })
   * ```
   */
  async search(
    storeId: string,
    body: MerchantContentSearchRequest,
    params?: PaginationParams,
  ): Promise<PaginatedContentList> {
    const res = await this.http.post<PaginatedContentList>(
      `/v1/merchant/${encodeURIComponent(storeId)}/content/search`,
      body,
      params,
    )
    return { ...res, data: res.data.map(decodeContentFields) }
  }

  /**
   * Get a single content item by ID.
   *
   * @param storeId - The store the content belongs to.
   * @param id - The content ID.
   *
   * @example
   * ```ts
   * const item = await client.merchant.content.get('store-id', 'content-id')
   * // item.content_body and item.teaser are plain text — no atob() needed
   * ```
   */
  async get(storeId: string, id: string): Promise<ContentResponse> {
    const res = await this.http.get<ContentResponse>(
      `/v1/merchant/${encodeURIComponent(storeId)}/content/${encodeURIComponent(id)}`,
    )
    return decodeContentFields(res)
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
   * const updated = await client.merchant.content.update('store-id', 'content-id', {
   *   title: 'Updated Title',
   *   price_cents: 750,
   * })
   * // updated.content_body and updated.teaser are plain text — no atob() needed
   * ```
   */
  async update(storeId: string, id: string, body: ContentUpdateRequest): Promise<ContentResponse> {
    const res = await this.http.patch<ContentResponse>(
      `/v1/merchant/${encodeURIComponent(storeId)}/content/${encodeURIComponent(id)}`,
      encodeContentFields(body),
    )
    return decodeContentFields(res)
  }

  /**
   * Delete a content item permanently.
   *
   * @param storeId - The store the content belongs to.
   * @param id - The content ID to delete.
   *
   * @example
   * ```ts
   * await client.merchant.content.delete('store-id', 'content-id')
   * ```
   */
  async delete(storeId: string, id: string): Promise<void> {
    return this.http.delete(
      `/v1/merchant/${encodeURIComponent(storeId)}/content/${encodeURIComponent(id)}`,
    )
  }
}
