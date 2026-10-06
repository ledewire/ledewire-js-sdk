/**
 * MCP API key management namespace.
 *
 * @module
 */
import type { HttpClient } from '@ledewire/core'
import type { McpApiKey, McpApiKeyCreateRequest, McpApiKeyCreateResponse } from '@ledewire/core'

/**
 * Manage the authenticated buyer's MCP API keys.
 *
 * MCP API keys authenticate agent requests against the Ledewire MCP server, sent
 * as `Authorization: Bearer <key>:<secret>`. Each key carries an explicit set of
 * scopes — `can_search` (default `true`), `can_purchase` (default `false`), and
 * the seller-tier `can_manage_content` / `can_read_analytics`, which additionally
 * require `store_id` to be set to a store the user owns or authors.
 *
 * **Secret handling:** `create()` returns the `secret` exactly once. It is never
 * retrievable again — store it immediately, alongside the `key`, in a secrets
 * manager.
 *
 * **Changing permissions:** scopes are fixed at creation. To change what a key
 * can do, revoke it and create a replacement with the desired scopes.
 *
 * Obtain via `client.user.mcpKeys` — do not construct directly.
 *
 * @example
 * ```ts
 * // Create a search+purchase key for an autonomous agent
 * const { key, secret } = await client.user.mcpKeys.create({
 *   label: 'my-rag-agent',
 *   can_search: true,
 *   can_purchase: true,
 * })
 * // Store immediately — the secret cannot be retrieved again
 * await secretsManager.put('LEDEWIRE_MCP_CREDENTIAL', `${key}:${secret}`)
 *
 * // List all keys (secrets never included)
 * const keys = await client.user.mcpKeys.list()
 *
 * // To change permissions: revoke and recreate
 * await client.user.mcpKeys.revoke(keys[0].id)
 * ```
 */
export class UserMcpKeysNamespace {
  /** @internal */
  constructor(private readonly http: HttpClient) {}

  /**
   * Returns all MCP API keys for the authenticated user.
   * The `secret` is never included in list responses.
   *
   * @returns Array of MCP API key records.
   */
  async list(): Promise<McpApiKey[]> {
    return this.http.get<McpApiKey[]>('/v1/mcp/keys')
  }

  /**
   * Creates a new MCP API key.
   *
   * The `secret` in the response is shown exactly once and cannot be retrieved
   * again. Store it immediately alongside `key` — the pair is used together as
   * `Authorization: Bearer <key>:<secret>` against the Ledewire MCP server.
   *
   * @param body - Label and scopes for the new key.
   * @returns The new key's public identifier, scopes, and one-time secret.
   * @throws {ForbiddenError} When a seller-tier scope or `store_id` names a store
   *   the user is not an owner or author of (plain store members cannot hold a
   *   store-scoped key), or when the caller is a Machine user, whose keys its
   *   Company's admins manage through `company.machineUsers.mcpKeys`. Seller-tier
   *   scopes are re-checked on every use, so a key stops working if its holder
   *   loses the role.
   *
   * @example
   * ```ts
   * const { key, secret } = await client.user.mcpKeys.create({
   *   label: 'production-agent',
   *   can_search: true,
   *   can_purchase: true,
   * })
   * ```
   */
  async create(body: McpApiKeyCreateRequest): Promise<McpApiKeyCreateResponse> {
    return this.http.post<McpApiKeyCreateResponse>('/v1/mcp/keys', body)
  }

  /**
   * Revokes (permanently deletes) an MCP API key by ID.
   *
   * To change a key's permissions, revoke it and create a replacement with the
   * desired scopes — scopes cannot be edited in place.
   *
   * @param id - UUID of the MCP API key to revoke.
   * @throws {ForbiddenError} When the caller is a Machine user.
   */
  async revoke(id: string): Promise<void> {
    return this.http.delete(`/v1/mcp/keys/${encodeURIComponent(id)}`)
  }
}
