import type { HttpClient } from '@ledewire/core'
import type {
  LicenseDocument,
  PurchaseCreateRequest,
  PurchaseResponse,
  PurchaseVerifyResponse,
} from '@ledewire/core'

/**
 * Buyer purchases namespace — create and retrieve content purchases.
 *
 * **Single-use purchase model:** a completed purchase does not imply
 * standing access. `has_purchased` on other endpoints means only "has ever
 * bought" — it is not a re-access grant. Buying again is how the buyer
 * receives the content a second time; see {@link PurchasesNamespace.create}.
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
   * Completes a content purchase using the buyer's wallet balance and
   * delivers the content in the same response.
   *
   * **This response is the only place the delivered content ever arrives.**
   * For a deliverable LedeWire holds, `content_body` carries the full body as
   * plain UTF-8 text — it is never base64-encoded on the wire, so no
   * `atob()` or decoding step is needed. For a deliverable hosted elsewhere,
   * `content_uri` carries its URL instead. Neither field is present on
   * {@link PurchasesNamespace.get} or {@link PurchasesNamespace.list} — there
   * is no route that serves the same content a second time — so persist
   * `content_body` / `content_uri` immediately if you need it later. A past
   * purchase does not grant re-access: buying the same content again is a
   * new charge that delivers it again.
   *
   * @param body - The content ID and expected price in cents.
   * @returns The completed purchase record, including the delivered content.
   * @throws {SpendCapReachedError} `402` — the buyer's daily spend cap has
   *   been reached. There is no funding URL for this refusal: adding money
   *   to the wallet does not clear it. It clears only when the spend window
   *   rolls over at `resetsAt`, or when the cap is raised via
   *   `client.user.spendCap.update()`.
   * @throws {NotFoundError} `404` — the content does not exist, or its
   *   visibility is `unlisted` (non-public) and this buyer has no standing
   *   grant to see it. Non-public content is not purchasable through this
   *   endpoint.
   *
   * @example
   * ```ts
   * const purchase = await client.purchases.create({ content_id: 'content-id' })
   * await saveDeliveredContent(purchase) // persist now — one-time delivery
   *
   * if (purchase.content_body && purchase.content.content_type === 'markdown') {
   *   renderMarkdown(purchase.content_body)
   * } else if (purchase.content_body && purchase.content.content_type === 'html') {
   *   // Inline HTML is seller-supplied — sanitise it before rendering to any
   *   // user (e.g. a server-side sanitiser, or DOMPurify if forwarding to a browser).
   *   const safeHtml = sanitizeHtml(purchase.content_body)
   * } else if (purchase.content_uri) {
   *   // Seller-supplied URI — check the scheme before following or linking to it.
   *   const uri = new URL(purchase.content_uri)
   *   if (['https:', 'http:'].includes(uri.protocol)) {
   *     // fetch(purchase.content_uri) or forward it as a link
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
   * import { writeFile } from 'node:fs/promises'
   *
   * const purchase = await client.purchases.get('purchase-id')
   * if (purchase.license?.document_url) {
   *   const { body, contentType } = await client.purchases.licenseDocument(purchase.id)
   *   const ext = contentType.startsWith('application/pdf')
   *     ? 'pdf'
   *     : contentType.startsWith('text/markdown')
   *       ? 'md'
   *       : 'bin'
   *   await writeFile(`licence.${ext}`, Buffer.from(body))
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
