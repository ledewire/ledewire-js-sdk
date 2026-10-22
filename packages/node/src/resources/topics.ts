import type { HttpClient } from '@ledewire/core'
import type { TopicDirectoryResponse } from '@ledewire/core'

/**
 * Topic directory namespace: the subjects a publication can cover, and how many
 * listed publications carry each. The slugs are the values `topics` on
 * {@link PublicationsNamespace.list} accepts. Public: no buyer JWT is required.
 *
 * @example
 * ```ts
 * const { data, unclassified_count } = await client.topics.list()
 * const sports = data.find((t) => t.slug === 'sports')
 * console.log(sports?.publication_count)
 * ```
 */
export class TopicsNamespace {
  constructor(protected readonly http: HttpClient) {}

  /**
   * Lists every Topic in vocabulary order, with its IAB unique ID, its IAB display
   * name, and the number of listed publications carrying it. A Topic no publication
   * carries yet is listed with `0`.
   *
   * Each `publication_count` equals the `pagination.total` that
   * {@link PublicationsNamespace.list} reports when filtered by that Topic alone.
   *
   * @returns The Topic directory.
   */
  async list(): Promise<TopicDirectoryResponse> {
    return this.http.get<TopicDirectoryResponse>('/v1/topics', undefined, { auth: false })
  }
}
