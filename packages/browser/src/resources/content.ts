import { decodeContentFields } from '@ledewire/core'
import type { HttpClient } from '@ledewire/core'
import type { ContentWithAccessResponse } from '@ledewire/core'

/**
 * Buyer content namespace — fetch content with real-time access information.
 *
 * Obtain via `lw.content` — do not construct directly.
 *
 * @example
 * ```ts
 * const result = await lw.content.getWithAccess('content-id')
 * if (result.access_info.next_required_action === 'view_content') {
 *   renderMarkdown(result.content_body ?? '')
 * }
 * ```
 */
export class BrowserContentNamespace {
  constructor(protected readonly http: HttpClient) {}

  /**
   * Returns a content item together with access information for the
   * authenticated buyer (or a generic access response when unauthenticated).
   *
   * @param id - The content ID.
   * @returns The content item with access information. `content_body` and
   * `teaser` are returned as plain UTF-8 text — the SDK decodes base64
   * transparently so you can render them directly.
   *
   * @example
   * ```ts
   * const result = await lw.content.getWithAccess('article-123')
   * if (result.access_info.next_required_action === 'view_content') {
   *   renderMarkdown(result.content_body ?? '')
   * }
   * ```
   */
  async getWithAccess(id: string): Promise<ContentWithAccessResponse> {
    const res = await this.http.get<ContentWithAccessResponse>(
      `/v1/content/${encodeURIComponent(id)}/with-access`,
    )
    return decodeContentFields(res)
  }
}
