import type { HttpClient } from '@ledewire/core'
import type { PaginatedBuyersList } from '@ledewire/core'
import type { PaginationParams } from './users.js'

/**
 * Merchant buyers namespace — aggregated, anonymised buyer statistics.
 *
 * @example
 * ```ts
 * const { data, pagination } = await client.merchant.buyers.list(storeId)
 * console.log(`Total buyers: ${pagination.total}`)
 * ```
 */
export class MerchantBuyersNamespace {
  constructor(protected readonly http: HttpClient) {}

  /**
   * Returns paginated, aggregated buyer statistics for the store.
   * Results are anonymised — buyer identities are not exposed.
   *
   * @param storeId - The merchant store ID.
   * @param params - Optional pagination parameters.
   * @returns Paginated buyer statistics with `data` and `pagination`.
   *
   * @example
   * ```ts
   * const { data, pagination } = await client.merchant.buyers.list(storeId)
   * ```
   */
  async list(storeId: string, params?: PaginationParams): Promise<PaginatedBuyersList> {
    const query = new URLSearchParams()
    if (params?.page !== undefined) query.set('page', String(params.page))
    if (params?.per_page !== undefined) query.set('per_page', String(params.per_page))
    const qs = query.toString()
    return this.http.get<PaginatedBuyersList>(`/v1/merchant/${storeId}/buyers${qs ? `?${qs}` : ''}`)
  }
}
