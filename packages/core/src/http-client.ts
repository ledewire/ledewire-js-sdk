import type { components } from './api.gen.js'
import { AuthError, ForbiddenError, LedewireError, NotFoundError } from './errors.js'

/** @internal */
type ApiErrorBody = components['schemas']['ErrorResponse']

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

/** The default LedeWire API base URL used by all SDK packages. */
export const DEFAULT_BASE_URL = 'https://api.ledewire.com'

/**
 * Core HTTP client used by all SDK packages.
 *
 * Features:
 * - Injects `Authorization: Bearer <token>` headers automatically
 * - Maps HTTP error responses to typed `LedewireError` subclasses
 * - On receiving a 401, calls `onUnauthorized` once and retries the request
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
   */
  async get<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
    return this.request<T>('GET', this.buildUrl(path, params))
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
    isRetry = false,
  ): Promise<T> {
    const token = await this.getAccessToken()
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    }
    if (token) headers['Authorization'] = `Bearer ${token}`

    const response = await fetch(url, {
      method,
      headers,
      ...(body !== undefined && { body: JSON.stringify(body) }),
    })

    if (response.status === 401 && !isRetry) {
      const newToken = await this.onUnauthorized()
      if (newToken) {
        return this.request<T>(method, url, body, true)
      }
      throw new AuthError('Session expired. Please re-authenticate.')
    }

    if (!response.ok) {
      await this.throwApiError(response)
    }

    if (response.status === 204) {
      return undefined as T
    }

    return response.json() as Promise<T>
  }

  private async throwApiError(response: Response): Promise<never> {
    let body: ApiErrorBody | undefined
    try {
      body = (await response.json()) as ApiErrorBody
    } catch {
      // Non-JSON body - fall through to use statusText
    }

    const message = body?.error.message ?? response.statusText
    const code = body?.error.code

    switch (response.status) {
      case 401:
        throw new AuthError(message, code)
      case 403:
        throw new ForbiddenError(message, code)
      case 404:
        throw new NotFoundError(message, code)
      default:
        throw new LedewireError(message, response.status, code)
    }
  }
}
