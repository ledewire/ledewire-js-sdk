import type { HttpClient } from '@ledewire/core'
import type {
  PurchaseCreateRequest,
  PurchaseResponse,
  PurchaseVerifyResponse,
} from '@ledewire/core'

/**
 * Buyer purchases namespace — create and retrieve content purchases.
 *
 * @example
 * ```ts
 * await client.purchases.create({ content_id: 'content-id' })
 * const all = await client.purchases.list()
 * ```
 */
export class PurchasesNamespace {
  constructor(protected readonly http: HttpClient) {}

  /**
   * Completes a content purchase using the buyer's wallet balance.
   *
   * @param body - The content ID and expected price in cents.
   * @returns The completed purchase record.
   */
  async create(body: PurchaseCreateRequest): Promise<PurchaseResponse> {
    return this.http.post<PurchaseResponse>('/v1/purchases', body)
  }

  /**
   * Returns all purchases made by the authenticated buyer.
   *
   * @returns A list of purchase records, newest first.
   */
  async list(): Promise<PurchaseResponse[]> {
    return this.http.get<PurchaseResponse[]>('/v1/purchases')
  }

  /**
   * Returns a single purchase by ID.
   *
   * @param id - The purchase ID.
   * @returns The purchase record.
   */
  async get(id: string): Promise<PurchaseResponse> {
    return this.http.get<PurchaseResponse>(`/v1/purchases/${encodeURIComponent(id)}`)
  }

  /**
   * Verifies whether the authenticated buyer has purchased the specified content.
   *
   * @param contentId - The content ID to check.
   * @returns An object with `purchased: boolean`.
   *
   * @example
   * ```ts
   * const result = await client.purchases.verify('content-123')
   * if (result.purchased) {
   *   console.log('User has purchased this content')
   * }
   * ```
   */
  async verify(contentId: string): Promise<PurchaseVerifyResponse> {
    return this.http.get<PurchaseVerifyResponse>(
      `/v1/purchase/verify?content_id=${encodeURIComponent(contentId)}`,
    )
  }
}
