/**
 * Machine user credentials namespaces: Buyer keys and MCP API keys.
 *
 * @module
 */
import type {
  HttpClient,
  CompanyMachineUserBuyerKeyCreateResponse,
  CompanyMachineUserBuyerKeyList,
  CompanyMachineUserBuyerKeyRequest,
  CompanyMachineUserMcpKeyCreateResponse,
  CompanyMachineUserMcpKeyList,
  CompanyMachineUserMcpKeyRequest,
} from '@ledewire/core'

/**
 * Buyer keys belonging to a Company Machine user. Every call requires Company admin rights.
 *
 * A Buyer key logs in through the buyer API-key flow. Its spending limit is the
 * Machine user's membership Spend cap, so keys carry no limit of their own.
 * Secrets are returned only by `create()`. A key is rotated by creating its
 * replacement before revoking the old one.
 *
 * Obtain via `client.company.machineUsers.buyerKeys` — do not construct directly.
 *
 * @example
 * ```ts
 * const { id, secret } = await client.company.machineUsers.buyerKeys.create('machine-user-id', {
 *   name: 'ci',
 * })
 * await client.company.machineUsers.buyerKeys.revoke('machine-user-id', id)
 * ```
 */
export class CompanyMachineUserBuyerKeysNamespace {
  /** @internal */
  constructor(private readonly http: HttpClient) {}

  /**
   * Lists a Machine user's Buyer keys, oldest first. Secrets are never included.
   *
   * @param machineUserId - The Machine user id.
   * @returns The key envelope (`{ data }`).
   */
  async list(machineUserId: string): Promise<CompanyMachineUserBuyerKeyList> {
    return this.http.get<CompanyMachineUserBuyerKeyList>(
      `/v1/company/machine-users/${encodeURIComponent(machineUserId)}/buyer-keys`,
    )
  }

  /**
   * Creates a Buyer key for a Machine user. The `secret` appears in this response
   * only; store it immediately.
   *
   * @param machineUserId - The Machine user id.
   * @param body - The key `name`, unique among this Machine user's keys.
   * @returns The new key, including its one-time `secret`.
   */
  async create(
    machineUserId: string,
    body: CompanyMachineUserBuyerKeyRequest,
  ): Promise<CompanyMachineUserBuyerKeyCreateResponse> {
    return this.http.post<CompanyMachineUserBuyerKeyCreateResponse>(
      `/v1/company/machine-users/${encodeURIComponent(machineUserId)}/buyer-keys`,
      body,
    )
  }

  /**
   * Revokes (deletes) a Machine user's Buyer key.
   *
   * @param machineUserId - The Machine user id.
   * @param id - The Buyer key id.
   */
  async revoke(machineUserId: string, id: string): Promise<void> {
    return this.http.delete(
      `/v1/company/machine-users/${encodeURIComponent(machineUserId)}/buyer-keys/${encodeURIComponent(id)}`,
    )
  }
}

/**
 * MCP API keys belonging to a Company Machine user. Every call requires Company admin rights.
 *
 * An MCP key authenticates as `Authorization: Bearer <key>:<secret>` and carries
 * buyer scopes only (`mcp:search`, `mcp:purchase`). It does not expire, and its
 * scopes cannot be edited, so revoke it and create a replacement to change them.
 *
 * Obtain via `client.company.machineUsers.mcpKeys` — do not construct directly.
 *
 * @example
 * ```ts
 * const { key, secret } = await client.company.machineUsers.mcpKeys.create('machine-user-id', {
 *   label: 'search-only',
 *   scopes: ['mcp:search'],
 * })
 * ```
 */
export class CompanyMachineUserMcpKeysNamespace {
  /** @internal */
  constructor(private readonly http: HttpClient) {}

  /**
   * Lists a Machine user's active MCP API keys, oldest first. Secrets are never included.
   *
   * @param machineUserId - The Machine user id.
   * @returns The key envelope (`{ data }`).
   */
  async list(machineUserId: string): Promise<CompanyMachineUserMcpKeyList> {
    return this.http.get<CompanyMachineUserMcpKeyList>(
      `/v1/company/machine-users/${encodeURIComponent(machineUserId)}/mcp-keys`,
    )
  }

  /**
   * Creates an MCP API key for a Machine user. The `secret` appears in this
   * response only; store it immediately.
   *
   * @param machineUserId - The Machine user id.
   * @param body - A `label` and at least one of `mcp:search` / `mcp:purchase` in `scopes`.
   * @returns The new key, including its one-time `secret`.
   */
  async create(
    machineUserId: string,
    body: CompanyMachineUserMcpKeyRequest,
  ): Promise<CompanyMachineUserMcpKeyCreateResponse> {
    return this.http.post<CompanyMachineUserMcpKeyCreateResponse>(
      `/v1/company/machine-users/${encodeURIComponent(machineUserId)}/mcp-keys`,
      body,
    )
  }

  /**
   * Revokes a Machine user's MCP API key. The key stops authenticating at once.
   *
   * @param machineUserId - The Machine user id.
   * @param id - The MCP key id.
   */
  async revoke(machineUserId: string, id: string): Promise<void> {
    return this.http.delete(
      `/v1/company/machine-users/${encodeURIComponent(machineUserId)}/mcp-keys/${encodeURIComponent(id)}`,
    )
  }
}
