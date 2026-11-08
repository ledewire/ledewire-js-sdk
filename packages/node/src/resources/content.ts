import { decodeContentFields } from '@ledewire/core'
import type { HttpClient } from '@ledewire/core'
import type {
  ContentSearchRequest,
  ContentSearchResponse,
  ContentWithAccessResponse,
} from '@ledewire/core'

/**
 * Buyer content namespace — fetch content with real-time access information.
 *
 * @example
 * ```ts
 * const result = await client.content.getWithAccess('content-id')
 * console.log(result.title, result.access_info.next_required_action)
 * ```
 */
export class ContentNamespace {
  constructor(protected readonly http: HttpClient) {}

  /**
   * Returns a content preview together with access information for the caller.
   *
   * Buyer-only: call it with a buyer token (`auth.loginWithEmail`,
   * `auth.loginWithGoogle`, `auth.loginWithBuyerApiKey`, or a
   * `createAgentClient()`), or with no token for generic access info
   * (`next_required_action: 'authenticate'`). A store credential (a merchant
   * login, `auth.loginWithApiKey`, or `createClient({ apiKey, apiSecret })`) is
   * refused with `403`, thrown as `ForbiddenError`. Access is always the
   * caller's own; there is no way to look up another buyer.
   *
   * @param id - The content ID. URL-encoded by the SDK.
   * @returns The content preview with the caller's `access_info`. `teaser` is
   * returned as plain UTF-8 text (the SDK decodes the base64 wire format). The
   * response never carries the deliverable: buy with `purchases.create()`.
   * @throws {ForbiddenError} When the client holds a store credential.
   *
   * @example
   * ```ts
   * const result = await client.content.getWithAccess('article-123')
   * if (result.access_info.next_required_action === 'purchase') {
   *   // Buy (or re-buy) via client.purchases.create(): has_purchased means
   *   // only "has ever bought" and does not by itself grant access.
   * }
   * ```
   */
  async getWithAccess(id: string): Promise<ContentWithAccessResponse> {
    const res = await this.http.get<ContentWithAccessResponse>(
      `/v1/content/${encodeURIComponent(id)}/with-access`,
    )
    return decodeContentFields(res)
  }

  /**
   * Searches LedeWire for content a buyer can purchase: works from every Store, and
   * brokered works from every Publication. This is the same search as the MCP
   * `search_content` tool. Each brokered work names its Publication, and unlisted or
   * archived works never appear.
   *
   * The search is paged by one opaque cursor. Send each page's `next_cursor` back as
   * `cursor`, with the same `query`, `tags`, `max_price_cents`, `metadata`,
   * `publication`, `form_type`, `ticker`, `cik` and `limit`, until it comes back `null`.
   * A cursor lasts 24 hours. Without a `query`, only Store works are searched, filtered
   * by the other fields — unless `form_type`, `ticker` or `cik` is given, which lists
   * the SEC EDGAR filings they name. Filings are shown to every signed-in Buyer, up
   * to that Buyer's limit on SEC requests; over it, the search returns what it could
   * with `partial_results: true`. Each result's `filing`
   * describes an SEC filing (filer, ticker, CIK, form, dates, accession number) and is
   * `null` for every other work; `publication` names a brokered work's Publication.
   *
   * A page can be shorter than `limit`, or empty, while `next_cursor` is not `null`.
   * Keep paging. When `partial_results` is `true`, part of the search could not run and
   * the page may be incomplete. Sending `next_cursor` then asks for the missed results
   * again. (`unavailable_providers` is deprecated and always empty.)
   *
   * Requires buyer credentials. Searches with a `query` are rate-limited to 15 a minute
   * per buyer.
   *
   * @param body - The search criteria, and the `cursor` from the previous page if any.
   * @returns One page of results.
   * @throws {RateLimitError} `429` — the buyer's search rate limit is exhausted. The SDK
   *   does not retry automatically; wait `err.retryAfter` seconds, when it is set.
   * @throws {InvalidCursorError} `422` with `error.type` `'invalid_cursor'` — the `cursor`
   *   is invalid, expired, in an older format, or was issued for different filters. Nothing
   *   was searched. Drop the cursor and restart the search from the first page; the same
   *   cursor never succeeds on retry.
   * @example
   * ```ts
   * let cursor: string | null | undefined
   * do {
   *   const page = await client.content.search({ query: 'quantum computing', cursor })
   *   for (const result of page.data) console.log(result.title, result.publication?.name)
   *   cursor = page.next_cursor
   * } while (cursor)
   *
   * // SEC EDGAR filings: `form_type`, `ticker` and `cik` return only filings, and
   * // `query` may be left out to list them newest first. `10-K` includes `10-K/A`.
   * // Filings are shown to every signed-in Buyer.
   * const filings = await client.content.search({ ticker: 'AAPL', form_type: '10-K' })
   * for (const result of filings.data) {
   *   console.log(result.filing?.form_type, result.filing?.filing_date, result.filing?.cik)
   * }
   *
   * // Only works from one Publication, by id or exact name.
   * const atlantic = await client.content.search({ query: 'housing', publication: 'The Atlantic' })
   * ```
   */
  async search(body: ContentSearchRequest): Promise<ContentSearchResponse> {
    return this.http.post<ContentSearchResponse>('/v1/content/search', body)
  }
}
