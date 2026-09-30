import type { HttpClient } from '@ledewire/core'
import { LedewireError } from '@ledewire/core'
import type {
  AcquisitionResponse,
  CorpusManifestResponse,
  CorpusResponse,
  PaginatedAcquisitionWorkList,
  PaginationParams,
  SigningKeyHistoryResponse,
} from '@ledewire/core'

/**
 * Content-types the corpus download endpoint sends for a ready archive.
 * The API sends `application/gzip` (see `Corpus::CONTENT_TYPE` in the API
 * service); the rest are accepted defensively for equivalent archive/binary
 * transports.
 */
const ARCHIVE_CONTENT_TYPES = [
  'application/gzip',
  'application/x-gzip',
  'application/octet-stream',
  'application/x-tar',
  'application/jsonl+gzip',
]

/**
 * Returns the media type portion of a `Content-Type` header value, discarding
 * any `; charset=...` (or other) parameters, lower-cased for comparison.
 */
function mediaType(contentType: string): string {
  return contentType.replace(/;.*$/, '').trim().toLowerCase()
}

function isArchiveContentType(contentType: string): boolean {
  return ARCHIVE_CONTENT_TYPES.includes(mediaType(contentType))
}

function isJsonContentType(contentType: string): boolean {
  const type = mediaType(contentType)
  return type === 'application/json' || type === 'application/problem+json' || type === 'text/json'
}

/**
 * Request body for {@link AcquisitionsNamespace.create}.
 */
export interface AcquisitionCreateRequest {
  /**
   * The works to license, in the order they should be recorded (a Selection).
   * Every row gets a disposition, refused ones included — a row that vanished
   * silently between upload and quote is exactly the failure the
   * {@link AcquisitionsNamespace.acknowledgeExclusions} step exists to prevent.
   * Typically the `url`s from one or more pages of
   * {@link PublicationsNamespace.listWorks}.
   */
  urls: string[]
}

/**
 * Result of {@link AcquisitionsNamespace.downloadCorpus} — a discriminated union
 * on `ready`.
 *
 * - `ready: true` — the archive is streaming now, as `body`.
 * - `ready: false` — nothing to stream yet; `corpus` carries the same state
 *   {@link AcquisitionsNamespace.getCorpus} would report (e.g. `assembling`,
 *   `pending`, `rebuild_required`, or `failed`).
 */
export type CorpusDownloadResult =
  | {
      /** The corpus archive is ready and streaming. */
      ready: true
      /** The gzip archive body. Read it to completion and verify its size against `byte_size` from {@link AcquisitionsNamespace.getCorpus} — the download carries no `Content-Length`. */
      body: ReadableStream<Uint8Array>
      /** The raw `Response`, for callers that need headers or want to read the body a different way (`.blob()`, `.arrayBuffer()`, etc.). */
      response: Response
    }
  | {
      /** Nothing is downloadable yet. */
      ready: false
      /** The corpus state, exactly as {@link AcquisitionsNamespace.getCorpus} would report it. */
      corpus: CorpusResponse
    }

/**
 * Bulk-licensing acquisitions namespace — submit a Selection, watch it get
 * priced, authorize the hold, and retrieve the delivered corpus and its signed
 * manifest.
 *
 * Every method requires a buyer JWT, except {@link signingKeyHistory}, which is
 * public.
 *
 * @example
 * ```ts
 * // 1. Submit a Selection and open the acquisition.
 * let acquisition = await client.acquisitions.create({
 *   urls: ['https://example.com/articles/1', 'https://example.com/articles/2'],
 * })
 *
 * // 2. Quoting is asynchronous — poll until quote_state is 'ready'.
 * while (acquisition.quote_state === 'pending') {
 *   await new Promise((resolve) => setTimeout(resolve, 2000))
 *   acquisition = await client.acquisitions.get(acquisition.id)
 * }
 *
 * // 3. Inspect what cannot be sold before committing money to the rest.
 * if (acquisition.exclusions.length > 0) {
 *   console.warn('Excluded from this Selection:', acquisition.exclusions)
 * }
 *
 * // 4. Register the exclusions — required before authorization.
 * acquisition = await client.acquisitions.acknowledgeExclusions(acquisition.id)
 *
 * // 5. Place the hold and start the run.
 * try {
 *   acquisition = await client.acquisitions.authorize(acquisition.id)
 * } catch (err) {
 *   if (err instanceof SpendCapReachedError) {
 *     // Funding the wallet will not clear this — it is a policy limit, not a
 *     // balance problem. Tell the buyer when it clears instead of retrying.
 *     console.error(`Daily spend cap reached; resets at ${err.resetsAt}.`)
 *     return
 *   }
 *   throw err
 * }
 *
 * // 6. Poll until the run settles.
 * while (acquisition.status === 'authorized' || acquisition.status === 'acquiring') {
 *   await new Promise((resolve) => setTimeout(resolve, 5000))
 *   acquisition = await client.acquisitions.get(acquisition.id)
 * }
 *
 * // 7. Partial failure is read from the per-work list, not caught as an exception.
 * const { data: works } = await client.acquisitions.listWorks(acquisition.id)
 * const failed = works.filter((w) => w.delivery_state === 'undelivered')
 *
 * // 8. Download the corpus.
 * const result = await client.acquisitions.downloadCorpus(acquisition.id)
 * if (result.ready) {
 *   // See downloadCorpus() for a full Node file-piping example.
 * }
 * ```
 */
export class AcquisitionsNamespace {
  constructor(protected readonly http: HttpClient) {}

  /**
   * Uploads a Selection of work URLs and opens a Bulk acquisition that will
   * carry its quote. Returns in milliseconds: nothing here calls the broker.
   *
   * **Quoting is asynchronous.** Resolving rates for 10,000 works is roughly
   * 200 upstream batch calls, so the response comes back with
   * `quote_state: 'pending'` and a snapshot the buyer can already read while
   * pricing runs behind it. Poll {@link get} until `quote_state` is `'ready'`.
   *
   * @param body - The Selection to license.
   * @returns The acquisition, with its quote not yet priced (201).
   */
  async create(body: AcquisitionCreateRequest): Promise<AcquisitionResponse> {
    return this.http.post<AcquisitionResponse>('/v1/acquisitions', body)
  }

  /**
   * Polls a Bulk acquisition — the one resource the whole flow hangs off. Both
   * the quote arriving and the run progressing are read here, because the
   * buyer holds one id and neither question is answerable from the other.
   *
   * Cheap enough to poll for hours: it carries counts and an exclusion tally
   * rather than rows. Per-work detail is {@link listWorks}.
   *
   * @param id - The acquisition ID.
   * @returns The current acquisition state.
   */
  async get(id: string): Promise<AcquisitionResponse> {
    return this.http.get<AcquisitionResponse>(`/v1/acquisitions/${encodeURIComponent(id)}`)
  }

  /**
   * Re-prices the acquisition's Selection at today's rates, **without
   * re-resolving it**. The buyer returns to the id they already hold and gets
   * the same works at current prices without uploading anything again — what
   * makes the 24-hour quote expiry cheap rather than punitive.
   *
   * Asynchronous, like {@link create}. Any prior acknowledgement of exclusions
   * is withdrawn, since the list the buyer acknowledged is not this list —
   * call {@link acknowledgeExclusions} again once re-pricing finishes.
   *
   * @param id - The acquisition ID.
   * @returns The acquisition with re-pricing under way (202). Poll {@link get}
   *   until `quote_state` is `'ready'`.
   */
  async requote(id: string): Promise<AcquisitionResponse> {
    return this.http.post<AcquisitionResponse>(`/v1/acquisitions/${encodeURIComponent(id)}/quote`)
  }

  /**
   * Registers the buyer's acknowledgement of what cannot be sold. Its own step
   * rather than a flag on {@link authorize}: for a large Selection, some rows
   * will always be excluded, and the failure that matters most for an
   * audit-trail product is a buyer authorizing without ever seeing that works
   * they asked for are not coming.
   *
   * Withdrawn by any {@link requote}, so it always refers to the current set of
   * exclusions and never to a stale one.
   *
   * @param id - The acquisition ID.
   * @returns The acquisition, now eligible for {@link authorize}.
   */
  async acknowledgeExclusions(id: string): Promise<AcquisitionResponse> {
    return this.http.post<AcquisitionResponse>(
      `/v1/acquisitions/${encodeURIComponent(id)}/acknowledgement`,
    )
  }

  /**
   * Places the hold and starts the run — the one moment a Bulk acquisition's
   * money is committed. Funds move from the wallet to held funds for the
   * stated maximum chargeable total, and retrieval begins off the request
   * thread, so this returns immediately and the buyer polls {@link get}.
   *
   * Two constraints are checked, and they are not the same constraint:
   * **wallet balance** asks whether the buyer has the money; **spend-cap
   * headroom** asks whether they are allowed to spend it today. The cap is
   * read once, here — captures drawn on this hold are never re-checked
   * against it.
   *
   * @param id - The acquisition ID.
   * @returns The acquisition with the hold placed and the run started (202).
   * @throws {SpendCapReachedError} When the buyer's daily spend cap refuses
   *   this acquisition (402). Deliberately carries no funding URL — adding
   *   money cannot clear a cap. Distinct from a `422` insufficient-funds
   *   refusal, where the quote survives and the buyer can retry after funding.
   */
  async authorize(id: string): Promise<AcquisitionResponse> {
    return this.http.post<AcquisitionResponse>(
      `/v1/acquisitions/${encodeURIComponent(id)}/authorization`,
    )
  }

  /**
   * Returns every work in the Selection with its disposition, in submission
   * order, refused rows included.
   *
   * **Partial failure is read from here, not caught.** An acquisition where
   * 300 of 10,000 works failed is ordinary — it does not fail the request and
   * is not an exception — so each outcome is a line item carrying its typed
   * `failure_reason`.
   *
   * @param id - The acquisition ID.
   * @param params - Optional pagination parameters.
   * @returns A paginated list of per-work dispositions.
   */
  async listWorks(id: string, params?: PaginationParams): Promise<PaginatedAcquisitionWorkList> {
    return this.http.get<PaginatedAcquisitionWorkList>(
      `/v1/acquisitions/${encodeURIComponent(id)}/works`,
      params,
    )
  }

  /**
   * Reads where the acquisition's corpus is.
   *
   * **Answers with a state, never with an error — every case is a 200.** A
   * corpus is a rendering of purchases the buyer already holds rather than an
   * entitlement of its own, so a blob past its 30-day retention answers
   * `state: 'rebuild_required'` rather than a `404`/`410` — nothing was lost.
   *
   * Reading the state never starts work; use {@link buildCorpus} to request an
   * assembly.
   *
   * @param id - The acquisition ID.
   * @returns The corpus state, whatever it is.
   */
  async getCorpus(id: string): Promise<CorpusResponse> {
    return this.http.get<CorpusResponse>(`/v1/acquisitions/${encodeURIComponent(id)}/corpus`)
  }

  /**
   * Starts an assembly when the corpus state is `'rebuild_required'`, and does
   * nothing when a corpus is already downloadable — re-assembling one that is
   * sitting there would spend minutes of a worker for a file the buyer can
   * already have.
   *
   * A separate verb from {@link getCorpus} rather than a flag on it, because a
   * buyer polling every few seconds while a run finishes would otherwise queue
   * one assembly per poll.
   *
   * @param id - The acquisition ID.
   * @returns The existing corpus state (200) if one is already downloadable,
   *   or the corpus with assembly under way (202). Poll {@link getCorpus}
   *   until `state` is `'ready'`.
   */
  async buildCorpus(id: string): Promise<CorpusResponse> {
    return this.http.post<CorpusResponse>(`/v1/acquisitions/${encodeURIComponent(id)}/corpus`)
  }

  /**
   * Downloads the corpus archive — the same authentication as everything
   * else, deliberately not a presigned object-store link (which would be a
   * bearer capability anyone holding it could spend). The archive streams
   * from this route in every environment; it never redirects.
   *
   * The archive is sent chunked and carries **no `Content-Length`**. Verify a
   * download is complete by comparing its final size against `byte_size` from
   * {@link getCorpus} once the stream has been fully read.
   *
   * A corpus that is not `'ready'` answers with its state as JSON at `200`,
   * exactly as {@link getCorpus} would — asking for the file of an expired
   * corpus is the same situation as asking where it is.
   *
   * @param id - The acquisition ID.
   * @returns `{ ready: true, body, response }` when the archive is streaming;
   *   `{ ready: false, corpus }` with the corpus state otherwise.
   * @throws {LedewireError} When the response's content-type is missing or is
   *   neither a recognized archive type (e.g. `application/gzip`) nor a
   *   recognized JSON type (e.g. `application/json`), or when an
   *   archive-typed response has no body.
   *
   * @example
   * ```ts
   * // Node: stream the archive straight to a file.
   * import { createWriteStream } from 'node:fs'
   * import { pipeline } from 'node:stream/promises'
   * import { Readable } from 'node:stream'
   *
   * const result = await client.acquisitions.downloadCorpus(acquisitionId)
   * if (result.ready) {
   *   await pipeline(Readable.fromWeb(result.body), createWriteStream('corpus.tar.gz'))
   *   const { byte_size } = await client.acquisitions.getCorpus(acquisitionId)
   *   // Compare the written file's size against byte_size to confirm completeness.
   * } else {
   *   console.log('Not ready yet:', result.corpus.state)
   * }
   * ```
   */
  async downloadCorpus(id: string): Promise<CorpusDownloadResult> {
    const response = await this.http.getRaw(
      `/v1/acquisitions/${encodeURIComponent(id)}/corpus/download`,
    )
    const contentType = response.headers.get('content-type') ?? ''

    if (isJsonContentType(contentType)) {
      const corpus = (await response.json()) as CorpusResponse
      return { ready: false, corpus }
    }

    if (isArchiveContentType(contentType)) {
      if (!response.body) {
        throw new LedewireError(
          'Corpus download response declared an archive content-type but had no body.',
          response.status,
        )
      }
      return { ready: true, body: response.body, response }
    }

    throw new LedewireError(
      contentType
        ? `Corpus download response had an unrecognized content-type: "${contentType}".`
        : 'Corpus download response had no content-type header.',
      response.status,
    )
  }

  /**
   * Returns the signed manifest of a Bulk acquisition — the permanent audit
   * record, served standalone so it can be obtained long after the corpus
   * blob has expired.
   *
   * **Verify through the signing-key history, never through the inline
   * `jwk`.** Resolve `signing_kid` through {@link signingKeyHistory}, match the
   * key on all 32 raw public-key bytes, confirm it was valid at `signed_at`,
   * and verify the detached signature over the manifest's exact bytes. The
   * `jwk` embedded in the manifest's own JWS header is attacker-controlled end
   * to end and must never be trusted as the verification key.
   *
   * @param id - The acquisition ID.
   * @returns The signed manifest.
   * @throws {LedewireError} With `statusCode === 409` when the acquisition
   *   exists but has no manifest yet — the manifest is written once, at first
   *   assembly, so this means "ask for the corpus first" rather than "there is
   *   nothing here".
   */
  async getManifest(id: string): Promise<CorpusManifestResponse> {
    return this.http.get<CorpusManifestResponse>(
      `/v1/acquisitions/${encodeURIComponent(id)}/manifest`,
    )
  }

  /**
   * Returns the append-only, hash-chained log of every Ed25519 key that has
   * signed an audit-export manifest — the trust anchor a verifier resolves a
   * manifest's `signing_kid` through. Public and unauthenticated: a third
   * party verifying a decade-old corpus holds no credentials of ours.
   *
   * @returns The signing-key history, in chain order.
   */
  async signingKeyHistory(): Promise<SigningKeyHistoryResponse> {
    return this.http.get<SigningKeyHistoryResponse>(
      '/.well-known/ledewire-signing-keys.json',
      undefined,
      { auth: false },
    )
  }
}
