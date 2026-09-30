import type { HttpClient } from '@ledewire/core'
import type {
  PaginationParams,
  PublicationListResponse,
  PublicationWorkListResponse,
  PublicationWorksParams,
} from '@ledewire/core'

/**
 * Bulk-licensing publications namespace — the read-only catalog a Selection is
 * built from. Both endpoints are public: no buyer JWT is required to browse what
 * is licensable before authenticating. Requests are always sent without
 * credentials, so a stale or expired session never blocks them.
 *
 * @example
 * ```ts
 * const { data } = await client.publications.list()
 * const licensable = data.filter((p) => p.bulk_licensable)
 *
 * const page = await client.publications.listWorks(licensable[0].id, {
 *   from: '2026-01-01',
 *   to: '2026-01-31',
 * })
 * // A page can legitimately be empty inside the requested range — check
 * // `date_filter` before concluding "nothing changed in that window".
 * if (page.date_filter === 'unsupported') {
 *   console.warn('This publication has no modification dates; the range could not be applied.')
 * }
 * ```
 */
export class PublicationsNamespace {
  constructor(protected readonly http: HttpClient) {}

  /**
   * Lists every publication the broker reports as ready to license, ordered by
   * name. Served from LedeWire's own registry (reconciled daily against the
   * broker's directory), so it answers even while the broker is unreachable.
   *
   * Licensability is the only filter: a publication that publishes no `FULL_USE`
   * rate is still listed, flagged `bulk_licensable: false`, rather than omitted.
   *
   * @param params - Optional pagination parameters.
   * @returns A paginated list of publications.
   */
  async list(params?: PaginationParams): Promise<PublicationListResponse> {
    return this.http.get<PublicationListResponse>('/v1/publications', params, { auth: false })
  }

  /**
   * Returns one page of a publication's article URLs, read live from the
   * broker's catalog and optionally bounded by modification date. A page of
   * `url`s is exactly what {@link AcquisitionsNamespace.create}'s Selection
   * takes. Works are not priced here — pricing happens when the Selection is
   * quoted.
   *
   * **Check `date_filter` before treating an empty page as "nothing in
   * range".** Some publications' catalogs carry no modification dates at all;
   * on those, the broker's date filter returns nothing and this comes back as
   * `date_filter: 'unsupported'` rather than `'applied'` — a different answer
   * from "no works were modified in that window", which the unfiltered catalog
   * cannot confirm either way.
   *
   * Paginate with `next_cursor`: pass it back as `cursor` alongside the same
   * `from`/`to` to fetch the next page. A `null` `next_cursor` means the walk
   * is over — an empty page carrying a cursor is not the end.
   *
   * @param id - The publication ID.
   * @param params - Optional `from`/`to` date bounds (inclusive, `YYYY-MM-DD`),
   *   `cursor` for the next page, and `limit` (defaults to the maximum, 1000).
   * @returns A page of the publication's works.
   */
  async listWorks(
    id: string,
    params?: PublicationWorksParams,
  ): Promise<PublicationWorkListResponse> {
    return this.http.get<PublicationWorkListResponse>(
      `/v1/publications/${encodeURIComponent(id)}/works`,
      params,
      { auth: false },
    )
  }
}
