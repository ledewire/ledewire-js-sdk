import type { HttpClient } from '@ledewire/core'
import type { ContentWithAccessResponse } from '@ledewire/core'

/**
 * Buyer content namespace — fetch content with real-time access information.
 *
 * Obtain via `client.content` — do not construct directly.
 */
export class BrowserContentNamespace {
  constructor(protected readonly http: HttpClient) {}

  /**
   * Returns a content item together with access information for the
   * authenticated buyer (or a generic access response when unauthenticated).
   *
   * @param id - The content ID.
   * @param userId - Optional user ID to check a specific user's access status.
   * @returns The content item with access information.
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
