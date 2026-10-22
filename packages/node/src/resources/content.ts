import type { HttpClient } from '@ledewire/core'
import type {
  BuyerContentSearchRequest,
  ContentSearchResponse,
  ContentWithAccessResponse,
} from '@ledewire/core'

/**
 * Buyer content namespace — fetch content with real-time access information.
 *
 * @example
 * ```ts
 * const { content, access } = await client.content.getWithAccess('content-id')
 * if (access.has_access) console.log(content.title)
 * ```
 */
export class ContentNamespace {
  constructor(protected readonly http: HttpClient) {}

  /**
   * Returns a content item together with access information for a given user.
   * Authenticated buyer calls omit `userId` — the token determines the user.
   * Server-side merchant calls can pass `userId` to proxy-check a specific
   * buyer's access state without impersonating them (e.g. to resolve a support
   * ticket or verify entitlement before issuing a refund).
   *
   * @param id - The content ID.
   * @param userId - Optional buyer ID to check access for a specific user.
   *   When omitted, access is evaluated for the token's authenticated user
   *   (or returns generic/unauthenticated access info if no token is present).
   * @returns The content item with access information.
   *
   * @example
   * ```ts
   * // Buyer-facing: access evaluated from the bearer token
   * const result = await client.content.getWithAccess('article-123')
   *
   * // Merchant server-side: check a specific buyer's access
   * const result = await client.content.getWithAccess('article-123', 'user-id-456')
   * if (result.access_info.has_purchased) {
   *   // buyer has already purchased — proceed with refund
   * }
   * ```
   */
  async getWithAccess(id: string, userId?: string): Promise<ContentWithAccessResponse> {
    const params: Record<string, string> = {}
    if (userId !== undefined) {
      params['user_id'] = userId
    }
    return this.http.get<ContentWithAccessResponse>(
      `/v1/content/${id}/with-access`,
      Object.keys(params).length > 0 ? params : undefined,
    )
  }

  /**
   * Searches LedeWire for content a buyer can purchase: works from every Store, and
   * brokered works from every Publication. This is the same search as the MCP
   * `search_content` tool. Each brokered work names its Publication, and unlisted or
   * archived works never appear.
   *
   * The search is paged by one opaque cursor. Send each page's `next_cursor` back as
   * `cursor`, with the same `query`, `tags`, `max_price_cents`, `metadata` and `limit`,
   * until it comes back `null`. A cursor lasts 24 hours. Without a `query`, only Store
   * works are searched, filtered by the other fields.
   *
   * A page can be shorter than `limit`, or empty, while `next_cursor` is not `null`.
   * Keep paging. When `partial_results` is `true`, part of the search could not run and
   * the page may be incomplete. Sending `next_cursor` then asks for the missed results
   * again.
   *
   * `unavailable_providers` in the response is deprecated and always empty. Use
   * `partial_results` to detect a partial page.
   *
   * Requires buyer credentials. Searches with a `query` are rate-limited to 15 a minute
   * per buyer.
   *
   * @param body - The search criteria, and the `cursor` from the previous page if any.
   * @returns One page of results.
   * @example
   * ```ts
   * let cursor: string | null | undefined
   * do {
   *   const page = await client.content.search({ query: 'quantum computing', cursor })
   *   for (const result of page.data) console.log(result.title, result.publication?.name)
   *   cursor = page.next_cursor
   * } while (cursor)
   * ```
   */
  async search(body: BuyerContentSearchRequest): Promise<ContentSearchResponse> {
    return this.http.post<ContentSearchResponse>('/v1/content/search', body)
  }
}
