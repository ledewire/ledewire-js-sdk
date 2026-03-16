/**
 * Platform configuration namespace (browser).
 *
 * Provides access to public (unauthenticated) platform-level configuration.
 *
 * @module
 */
import type { HttpClient } from '@ledewire/core'
import type { PublicConfigResponse } from '@ledewire/core'

/**
 * Platform-level configuration for browser clients.
 *
 * Obtain via `client.config` — do not construct directly.
 */
export class BrowserConfigNamespace {
  /** @internal */
  constructor(protected readonly http: HttpClient) {}

  /**
   * Returns platform-level public configuration.
   * No authentication required — safe to call before the user has signed in.
   *
   * Use `google_client_id` to initialise the Google Identity Services library
   * on the storefront login page without requiring a prior authenticated call.
   *
   * @example
   * ```ts
   * const lw = init({ apiKey: 'your_api_key' })
   * const { google_client_id } = await lw.config.getPublic()
   * google.accounts.id.initialize({ client_id: google_client_id, callback })
   * ```
   */
  async getPublic(): Promise<PublicConfigResponse> {
    return this.http.get<PublicConfigResponse>('/v1/config/public')
  }
}
