import type { HttpClient } from '@ledewire/core'
import type { LicenseDocument, PurchaseCreateRequest, PurchaseResponse } from '@ledewire/core'

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
 * const content = await lw.content.getWithAccess('content-id')
 * await lw.purchases.create({ content_id: content.id, price_cents: content.price_cents })
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
   * @param body - `content_id`, and `price_cents`: the price the buyer was
   *   quoted (e.g. `price_cents` from `content.getWithAccess()` or a search
   *   result). The API charges only when it equals the work's current price.
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
   * @throws {LedewireError} `422` — `price_cents` no longer matches the
   *   work's current price (`Content (<id>) price appears to have changed`).
   *   Nothing is charged: re-read the price, show it to the buyer, and buy
   *   again at the new price. A `422` also covers `insufficient_funds` and
   *   the brokered-delivery refusals, which carry an `error.type`.
   * @throws {LedewireError} `400` — `content_id` or `price_cents` missing or
   *   of the wrong type. Nothing is charged.
   *
   * @example
   * ```ts
   * const content = await lw.content.getWithAccess('content-id')
   * const purchase = await lw.purchases.create({
   *   content_id: content.id,
   *   price_cents: content.price_cents, // the price the buyer was shown
   * })
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

  /**
   * Downloads the licence document one of the buyer's own purchases was delivered
   * under — the URL a purchase's `license.document_url` points at.
   *
   * For a brokered work, this is the licence document the work's source granted, as
   * LedeWire captured it at purchase time (usually `application/pdf`). For an SEC
   * filing (`license.type === 'public-domain'`), it is LedeWire's terms for SEC filings
   * as `text/markdown`, in the version the filing was delivered under.
   *
   * The response is not JSON, so the bytes come back as an `ArrayBuffer` with the
   * server's `Content-Type` — see {@link LicenseDocument}. The type is chosen by the
   * work's source, so treat the document as an attachment: never render it inline on
   * your own origin.
   *
   * @param id - The purchase ID.
   * @returns The document's bytes and content type.
   * @throws {AuthError} `401` — missing or invalid credentials.
   * @throws {ForbiddenError} `403` — the credential is not a buyer token (or an MCP key
   *   without the `mcp:search` scope).
   * @throws {NotFoundError} `404` — no such purchase for this buyer, the purchase is not
   *   completed, or its document has not been captured yet. All look the same.
   *
   * @example
   * ```ts
   * const purchase = await lw.purchases.get('purchase-id')
   * if (purchase.license?.document_url) {
   *   const { body, contentType } = await lw.purchases.licenseDocument(purchase.id)
   *   // Offer it as a download; never render it inline.
   *   // Pass the type through only for the two expected ones, so a server-sent
   *   // text/html can never run in this origin.
   *   const type = /^(application\/pdf|text\/markdown)\s*(;|$)/.test(contentType)
   *     ? contentType
   *     : 'application/octet-stream'
   *   const url = URL.createObjectURL(new Blob([body], { type }))
   *   const a = document.createElement('a')
   *   a.href = url
   *   a.download = 'licence'
   *   a.click()
   *   URL.revokeObjectURL(url)
   * }
   * ```
   */
  async licenseDocument(id: string): Promise<LicenseDocument> {
    // The document's type is the source's choice, so accept anything.
    const response = await this.http.getRaw(
      `/v1/purchases/${encodeURIComponent(id)}/license_document`,
      '*/*',
    )
    return {
      body: await response.arrayBuffer(),
      contentType: response.headers.get('content-type') ?? 'application/octet-stream',
    }
  }
}
