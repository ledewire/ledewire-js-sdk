/**
 * Company purchases namespace: everything the Company has paid for.
 *
 * @module
 */
import type { HttpClient, CompanyPurchaseList, CompanyPurchaseListParams } from '@ledewire/core'

/**
 * Lists the purchases and Bulk acquisitions drawn on the Company wallet. Every call
 * requires Company admin rights.
 *
 * Each row is attributed to the membership that paid, including members who have
 * since left. A Bulk acquisition's per-work purchases are not listed separately. Fetch
 * its Corpus and Manifest through `client.acquisitions` using the acquisition id.
 *
 * Obtain via `client.company.purchases` — do not construct directly.
 *
 * @example
 * ```ts
 * const { data, pagination } = await client.company.purchases.list({
 *   from: '2026-10-01',
 *   to: '2026-10-31',
 *   kind: 'purchase',
 *   per_page: 100,
 * })
 * ```
 */
export class CompanyPurchasesNamespace {
  /** @internal */
  constructor(private readonly http: HttpClient) {}

  /**
   * Lists Company purchases, newest first, with optional filters and pagination.
   *
   * @param params - Optional `page`, `per_page`, `member`, `from`, `to`, and `kind` filters.
   * @returns The paginated purchase envelope (`{ data, pagination }`).
   */
  async list(params?: CompanyPurchaseListParams): Promise<CompanyPurchaseList> {
    return this.http.get<CompanyPurchaseList>(
      '/v1/company/purchases',
      params && {
        page: params.page,
        per_page: params.per_page,
        member: params.member,
        from: params.from,
        to: params.to,
        kind: params.kind,
      },
    )
  }
}
