/**
 * Platform configuration namespace.
 *
 * Provides access to public (unauthenticated) platform-level configuration.
 *
 * @module
 */
import type { HttpClient } from '@ledewire/core'
import type { PublicConfigResponse } from '@ledewire/core'

/**
 * Platform-level configuration.
 *
 * Obtain via `client.config` — do not construct directly.
 */
export class ConfigNamespace {
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
   * const { google_client_id } = await client.config.getPublic()
   * // Initialise Google Sign-In
   * google.accounts.id.initialize({ client_id: google_client_id, callback })
   * ```
   */
  async getPublic(): Promise<PublicConfigResponse> {
    return this.http.get<PublicConfigResponse>('/v1/config/public')
  }
}
