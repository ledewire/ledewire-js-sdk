import type { HttpClient } from '@ledewire/core'
import type { SalesStatisticsItem, SalesSummaryResponse } from '@ledewire/core'

/**
 * Seller sales namespace — revenue summary and per-content sales statistics.
 *
 * Uses API key authentication. Provides the same data as `merchant.sales` but
 * without pagination wrappers.
 *
 * @example
 * ```ts
 * const summary = await client.seller.sales.summary()
 * console.log(`Revenue: ${summary.total_revenue_cents / 100} USD`)
 * const sales = await client.seller.sales.list()
 * ```
 */
export class SellerSalesNamespace {
  constructor(protected readonly http: HttpClient) {}

  /**
   * Returns aggregated revenue and sales-count statistics for the store,
   * broken down by month.
   *
   * @returns Sales summary with totals and monthly breakdowns.
   */
  async summary(): Promise<SalesSummaryResponse> {
    return this.http.get<SalesSummaryResponse>('/v1/seller/sales/summary')
  }

  /**
   * Returns per-content sales statistics for all content in the store.
   *
   * @returns Array of sales statistics by content item.
   *
   * @example
   * ```ts
   * const sales = await client.seller.sales.list()
   * sales.forEach(s => console.log(`${s.title}: ${s.total_sales} sales`))
   * ```
   */
  async list(): Promise<SalesStatisticsItem[]> {
    return this.http.get<SalesStatisticsItem[]>('/v1/seller/sales')
  }
}
