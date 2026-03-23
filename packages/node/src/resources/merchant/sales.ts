import type { HttpClient } from '@ledewire/core'
import type {
  MerchantSaleResponse,
  SalesSummaryResponse,
  PaginatedSalesList,
  PaginationParams,
} from '@ledewire/core'

/**
 * Merchant sales namespace — revenue summary, per-sale records, and sale detail.
 *
 * @example
 * ```ts
 * const summary = await client.merchant.sales.summary(storeId)
 * console.log(`Revenue: ${summary.total_revenue_cents / 100} USD`)
 * const { data, pagination } = await client.merchant.sales.list(storeId)
 * ```
 */
export class MerchantSalesNamespace {
  constructor(protected readonly http: HttpClient) {}

  /**
   * Returns aggregated revenue and sales-count statistics for the store,
   * broken down by month.
   *
   * @param storeId - The merchant store ID.
   * @returns Sales summary with totals and monthly breakdowns.
   */
  async summary(storeId: string): Promise<SalesSummaryResponse> {
    return this.http.get<SalesSummaryResponse>(`/v1/merchant/${storeId}/sales/summary`)
  }

  /**
   * Returns paginated per-title sales statistics for the store.
   *
   * @param storeId - The merchant store ID.
   * @param params - Optional pagination parameters.
   * @returns Paginated sales statistics with `data` and `pagination`.
   *
   * @example
   * ```ts
   * const { data, pagination } = await client.merchant.sales.list(storeId, { page: 2 })
   * ```
   */
  async list(storeId: string, params?: PaginationParams): Promise<PaginatedSalesList> {
    return this.http.get<PaginatedSalesList>(`/v1/merchant/${storeId}/sales`, params)
  }

  /**
   * Returns full detail for a single sale, including the platform fee breakdown.
   *
   * @param storeId - The merchant store ID.
   * @param id - The sale (purchase) ID.
   * @returns The sale detail with fee split.
   */
  async get(storeId: string, id: string): Promise<MerchantSaleResponse> {
    return this.http.get<MerchantSaleResponse>(`/v1/merchant/${storeId}/sales/${id}`)
  }
}
