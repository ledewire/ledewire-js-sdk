/**
 * Buyer API key management namespace.
 *
 * @module
 */
import type { HttpClient } from '@ledewire/core'
import type { UserApiKey, UserApiKeyCreateRequest, UserApiKeyCreateResponse } from '@ledewire/core'

/**
 * Manage buyer API keys for the authenticated user.
 *
 * Buyer API keys are the authentication credential for autonomous agents — they
 * allow an agent to obtain a buyer JWT via `auth.loginWithBuyerApiKey()` without
 * requiring a username and password. Each key is named, independently revocable,
 * and can carry an optional `spending_limit_cents` ceiling.
 *
 * **Secret handling:** `create()` returns the `secret` exactly once. It is never
 * retrievable again after the response is received — store it immediately in a
 * secrets manager (e.g. environment variable, Vault, AWS Secrets Manager).
 *
 * Obtain via `client.user.apiKeys` — do not construct directly.
 *
 * @example
 * ```ts
 * // Create a key for an agent, with a $10 spend ceiling
 * const { key, secret } = await client.user.apiKeys.create({
 *   name: 'my-rag-agent',
 *   spending_limit_cents: 1000,
 * })
 * // Store secret immediately — it cannot be retrieved again
 * await secretsManager.put('LEDEWIRE_BUYER_SECRET', secret)
 *
 * // List all keys (secrets never included)
 * const keys = await client.user.apiKeys.list()
 *
 * // Revoke a compromised key
 * await client.user.apiKeys.revoke(keys[0].id)
 * ```
 */
export class UserApiKeysNamespace {
  /** @internal */
  constructor(private readonly http: HttpClient) {}

  /**
   * Returns all buyer API keys for the authenticated user.
   * The `secret` is never included in list responses.
   *
   * @returns Array of API key records.
   */
  async list(): Promise<UserApiKey[]> {
    return this.http.get<UserApiKey[]>('/v1/user/api-keys')
  }

  /**
   * Creates a new buyer API key.
   *
   * The `secret` in the response is shown exactly once and cannot be retrieved
   * again. Store it immediately in a secrets manager before discarding the
   * response object.
   *
   * @param body - Name and optional spend ceiling for the new key.
   * @returns The new key's public identifier and one-time secret.
   *
   * @example
   * ```ts
   * const { key, secret } = await client.user.apiKeys.create({
   *   name: 'production-agent',
   *   spending_limit_cents: 5000, // $50 cap
   * })
   * // ⚠️ Store secret NOW — it is shown once only
   * process.env.LEDEWIRE_BUYER_SECRET = secret
   * ```
   */
  async create(body: UserApiKeyCreateRequest): Promise<UserApiKeyCreateResponse> {
    return this.http.post<UserApiKeyCreateResponse>('/v1/user/api-keys', body)
  }

  /**
   * Revokes (permanently deletes) a buyer API key by ID.
   *
   * Any agent currently using this key will receive `401` on its next
   * token refresh. Revocation takes effect immediately.
   *
   * @param id - UUID of the API key to revoke.
   */
  async revoke(id: string): Promise<void> {
    return this.http.delete(`/v1/user/api-keys/${encodeURIComponent(id)}`)
  }
}
