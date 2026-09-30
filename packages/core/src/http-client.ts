import { AuthError, ForbiddenError, LedewireError, NotFoundError } from './errors.js'
import type { ErrorTypeValue } from './errors.js'
import { spendCapErrorFromBody } from './spend-cap.js'

/**
 * Configuration options for `HttpClient`.
 */
export interface HttpClientConfig {
  /** API base URL. Defaults to the production API. */
  baseUrl?: string
  /**
   * Returns the current access token (or null) before each request.
   * If null, requests are sent without an Authorization header.
   */
  getAccessToken?: () => string | null | Promise<string | null>
  /**
   * Called when a 401 is received on the first attempt.
   * Should refresh and return the new access token, or null to propagate
   * an `AuthError` to the caller.
   */
  onUnauthorized?: () => string | null | Promise<string | null>
}

/**
 * Per-request overrides accepted by {@link HttpClient} methods.
 */
export interface RequestOptions {
  /**
   * Whether to attach authentication to this request. Defaults to `true`.
   * Pass `false` for public endpoints: skips `getAccessToken`, sends no
   * `Authorization` header, and maps a `401` straight to an {@link AuthError}
   * without invoking `onUnauthorized`.
   */
  auth?: boolean
}

/** The default LedeWire API base URL used by all SDK packages. */
export const DEFAULT_BASE_URL = 'https://api.ledewire.com'

/**
 * Extracts `{ message, code, type, details }` from a parsed API error body,
 * tolerating shapes that don't match the documented `ErrorResponse` envelope:
 * an empty object, a body with no `error` field at all, `error` as a bare
 * string (e.g. the spec's `{ "error": "Content ... not found" }` 404 purchase
 * example), `null`, or non-object JSON. Never throws; falls back to
 * `fallbackMessage` (the response's `statusText`) whenever the body doesn't
 * carry a usable message.
 */
function extractErrorInfo(
  body: unknown,
  fallbackMessage: string,
): {
  message: string
  code: number | undefined
  type: ErrorTypeValue | undefined
  details: Record<string, unknown> | undefined
} {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { message: fallbackMessage, code: undefined, type: undefined, details: undefined }
  }

  const record = body as Record<string, unknown>
  const { error, ...rest } = record
  const details = Object.keys(rest).length > 0 ? rest : undefined

  if (typeof error === 'string') {
    return { message: error, code: undefined, type: undefined, details }
  }

  if (!error || typeof error !== 'object' || Array.isArray(error)) {
    return { message: fallbackMessage, code: undefined, type: undefined, details }
  }

  const errorRecord = error as Record<string, unknown>
  const message =
    typeof errorRecord['message'] === 'string' ? errorRecord['message'] : fallbackMessage
  const code = typeof errorRecord['code'] === 'number' ? errorRecord['code'] : undefined
  const type = typeof errorRecord['type'] === 'string' ? errorRecord['type'] : undefined

  return { message, code, type, details }
}

/**
 * Core HTTP client used by all SDK packages.
 *
 * Features:
 * - Injects `Authorization: Bearer <token>` headers automatically
 * - Maps HTTP error responses to typed `LedewireError` subclasses
 * - On receiving a 401, calls `onUnauthorized` once and retries the request
 * - Per-request `{ auth: false }` (see {@link RequestOptions}) skips all of
 *   the above for public endpoints
 *
 * This is an internal class - consumers should use the
 * package-level client factories (`init` / `createClient`) instead.
 */
export class HttpClient {
  private readonly baseUrl: string
  private readonly getAccessToken: NonNullable<HttpClientConfig['getAccessToken']>
  private readonly onUnauthorized: NonNullable<HttpClientConfig['onUnauthorized']>

  constructor(config: HttpClientConfig = {}) {
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '')
    this.getAccessToken = config.getAccessToken ?? (() => null)
    this.onUnauthorized = config.onUnauthorized ?? (() => null)
  }

  /**
   * GET request with optional query parameters.
   * @param path - API path (e.g. `/v1/wallet/balance`)
   * @param params - Query string parameters. `undefined` values are omitted; numbers are coerced to strings.
   * @param options - Per-request overrides. Pass `{ auth: false }` for public endpoints.
   */
  async get<T>(
    path: string,
    params?: Record<string, string | number | undefined>,
    options?: RequestOptions,
  ): Promise<T> {
    return this.request<T>('GET', this.buildUrl(path, params), undefined, options)
  }

  /**
   * POST request.
   * @param path - API path
   * @param body - Request body (JSON-serialized)
   * @param params - Optional query string parameters. `undefined` values are omitted; numbers are coerced to strings.
   */
  async post<T>(
    path: string,
    body?: unknown,
    params?: Record<string, string | number | undefined>,
  ): Promise<T> {
    return this.request<T>('POST', this.buildUrl(path, params), body)
  }

  /**
   * PUT request.
   * @param path - API path
   * @param body - Request body (JSON-serialized)
   */
  async put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PUT', this.buildUrl(path), body)
  }

  /**
   * PATCH request.
   * @param path - API path
   * @param body - Partial update body (JSON-serialized)
   */
  async patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PATCH', this.buildUrl(path), body)
  }

  /**
   * DELETE request.
   * @param path - API path
   */
  async delete<T = void>(path: string): Promise<T> {
    return this.request<T>('DELETE', this.buildUrl(path))
  }

  /**
   * GET request that returns the raw, unparsed `Response` instead of decoded JSON.
   * Used for binary downloads (e.g. `GET /v1/acquisitions/{id}/corpus/download`,
   * which streams a gzip archive when the corpus is ready, or a JSON
   * `CorpusResponse` body otherwise).
   *
   * Applies the same `Authorization` header injection and single-retry-on-401
   * behaviour as {@link HttpClient.get}, and maps a non-2xx response to the same
   * typed errors — it just skips the `response.json()` decode step so the caller
   * can read the body as a stream, blob, or array buffer.
   *
   * @param path - API path (e.g. `/v1/acquisitions/{id}/corpus/download`)
   * @returns The raw `Response`. Callers are responsible for reading its body.
   */
  async getRaw(path: string): Promise<Response> {
    return this.performRequest('GET', this.buildUrl(path), {
      Accept: 'application/gzip, application/json',
    })
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private buildUrl(path: string, params?: Record<string, string | number | undefined>): string {
    const url = `${this.baseUrl}${path}`
    if (!params) return url
    const filtered = Object.entries(params).filter(
      (entry): entry is [string, string | number] => entry[1] !== undefined,
    )
    if (filtered.length === 0) return url
    const qs = new URLSearchParams(filtered.map(([k, v]) => [k, String(v)]))
    return `${url}?${qs.toString()}`
  }

  private async request<T>(
    method: string,
    url: string,
    body?: unknown,
    options?: RequestOptions,
  ): Promise<T> {
    const response = await this.performRequest(
      method,
      url,
      { 'Content-Type': 'application/json', Accept: 'application/json' },
      body,
      false,
      options,
    )

    if (response.status === 204) {
      return undefined as T
    }

    return response.json() as Promise<T>
  }

  /**
   * Shared auth-injection, single-401-retry, and error-mapping logic behind both
   * `request()` (JSON in, JSON out) and `getRaw()` (JSON in, raw `Response` out).
   */
  private async performRequest(
    method: string,
    url: string,
    headers: Record<string, string>,
    body?: unknown,
    isRetry = false,
    options?: RequestOptions,
  ): Promise<Response> {
    const useAuth = options?.auth !== false
    const token = useAuth ? await this.getAccessToken() : null
    const finalHeaders: Record<string, string> = { ...headers }
    if (token) finalHeaders['Authorization'] = `Bearer ${token}`

    const response = await fetch(url, {
      method,
      headers: finalHeaders,
      ...(body !== undefined && { body: JSON.stringify(body) }),
    })

    if (response.status === 401 && !isRetry) {
      if (useAuth) {
        const newToken = await this.onUnauthorized()
        if (newToken) {
          return this.performRequest(method, url, headers, body, true, options)
        }
      }
      throw new AuthError('Session expired. Please re-authenticate.')
    }

    if (!response.ok) {
      await this.throwApiError(response)
    }

    return response
  }

  private async throwApiError(response: Response): Promise<never> {
    let body: unknown
    try {
      body = await response.json()
    } catch {
      // Non-JSON body - fall through to use statusText
    }

    const spendCapError = spendCapErrorFromBody(body)
    if (spendCapError) {
      throw spendCapError
    }

    const { message, code, type, details } = extractErrorInfo(body, response.statusText)

    switch (response.status) {
      case 401:
        throw new AuthError(message, code, type, details)
      case 403:
        throw new ForbiddenError(message, code, type, details)
      case 404:
        throw new NotFoundError(message, code, type, details)
      default:
        throw new LedewireError(message, response.status, code, type, details)
    }
  }
}
