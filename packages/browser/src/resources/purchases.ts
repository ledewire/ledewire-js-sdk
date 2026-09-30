import type { HttpClient } from '@ledewire/core'
import type { PurchaseCreateRequest, PurchaseResponse } from '@ledewire/core'

/**
 * Buyer purchases namespace — create and retrieve content purchases.
 *
 * **Single-use purchase model:** a completed purchase does not imply
 * standing access. `has_purchased` on other endpoints means only "has ever
 * bought" — it is not a re-access grant. Buying again is how the buyer
 * receives the content a second time; see {@link BrowserPurchasesNamespace.create}.
 *
 * Obtain via `lw.purchases` — do not construct directly.
 *
 * @example
 * ```ts
 * await lw.purchases.create({ content_id: 'content-id' })
 * const all = await lw.purchases.list()
 * ```
 */
export class BrowserPurchasesNamespace {
  constructor(protected readonly http: HttpClient) {}

  /**
   * Completes a content purchase using the buyer's wallet balance and
   * delivers the content in the same response.
   *
   * **This response is the only place the delivered content ever arrives.**
   * For a deliverable LedeWire holds, `content_body` carries the full body as
   * plain UTF-8 text — it is never base64-encoded on the wire, so no
   * `atob()` or decoding step is needed. For a deliverable hosted elsewhere,
   * `content_uri` carries its URL instead. Neither field is present on
   * {@link BrowserPurchasesNamespace.get} or {@link BrowserPurchasesNamespace.list}
   * — there is no route that serves the same content a second time — so
   * persist `content_body` / `content_uri` immediately if you need it later.
   * A past purchase does not grant re-access: buying the same content again
   * is a new charge that delivers it again.
   *
   * @param body - The content ID and expected price in cents.
   * @returns The completed purchase record, including the delivered content.
   * @throws {SpendCapReachedError} `402` — the buyer's daily spend cap has
   *   been reached. There is no funding URL for this refusal: adding money
   *   to the wallet does not clear it. It clears only when the spend window
   *   rolls over at `resetsAt`, or when the cap is raised via
   *   `lw.user.spendCap.update()`.
   * @throws {NotFoundError} `404` — the content does not exist, or its
   *   visibility is `unlisted` (non-public) and this buyer has no standing
   *   grant to see it. Non-public content is not purchasable through this
   *   endpoint.
   *
   * @example
   * ```ts
   * const purchase = await lw.purchases.create({ content_id: 'content-id' })
   * await saveDeliveredContent(purchase) // persist now — one-time delivery
   *
   * if (purchase.content_body && purchase.content.content_type === 'markdown') {
   *   renderMarkdown(purchase.content_body)
   * } else if (purchase.content_body && purchase.content.content_type === 'html') {
   *   // Inline HTML is seller-supplied — sanitise before inserting it.
   *   container.innerHTML = DOMPurify.sanitize(purchase.content_body)
   * } else if (purchase.content_uri) {
   *   // Seller-supplied URI — check the scheme before navigating to it.
   *   const uri = new URL(purchase.content_uri)
   *   if (['https:', 'http:'].includes(uri.protocol)) {
   *     window.location.href = purchase.content_uri
   *   }
   * }
   * ```
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
}
