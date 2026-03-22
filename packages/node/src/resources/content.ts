import type { HttpClient } from '@ledewire/core'
import type { ContentWithAccessResponse } from '@ledewire/core'

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
}
