/**
 * Company Machine users and their keys.
 *
 * @module
 */
import type { HttpClient } from '@ledewire/core'
import type {
  CompanyMachineUser,
  CompanyMachineUserBuyerKeyCreateRequest,
  CompanyMachineUserBuyerKeyCreateResponse,
  CompanyMachineUserBuyerKeyList,
  CompanyMachineUserCreateRequest,
  CompanyMachineUserList,
  CompanyMachineUserMcpKeyCreateRequest,
  CompanyMachineUserMcpKeyCreateResponse,
  CompanyMachineUserMcpKeyList,
} from '@ledewire/core'

function machineUserPath(machineUserId: string): string {
  return `/v1/company/machine-users/${encodeURIComponent(machineUserId)}`
}

/**
 * Issue and revoke a Machine user's Buyer keys. Company admins only.
 *
 * A Machine user's Buyer key logs in through `auth.loginWithBuyerApiKey()` (or
 * `createAgentClient()`), exactly like a buyer's own key. Its spending limit is
 * the Machine user's membership Spend cap, so a key carries no
 * `spending_limit_cents` of its own.
 *
 * **Secret handling:** `create()` returns the `secret` exactly once.
 *
 * Obtain via `client.company.machineUsers.buyerKeys` — do not construct directly.
 */
export class CompanyMachineUserBuyerKeysNamespace {
  /** @internal */
  constructor(private readonly http: HttpClient) {}

  /**
   * Lists a Machine user's Buyer keys, oldest first. Secrets are never included.
   *
   * @param machineUserId - The Machine user id (`CompanyMachineUser.id`).
   * @returns The keys.
   * @throws {NotFoundError} When the Machine user is not in the caller's Company.
   */
  async list(machineUserId: string): Promise<CompanyMachineUserBuyerKeyList> {
    return this.http.get<CompanyMachineUserBuyerKeyList>(
      `${machineUserPath(machineUserId)}/buyer-keys`,
    )
  }

  /**
   * Creates a Buyer key for a Machine user.
   *
   * @param machineUserId - The Machine user id (`CompanyMachineUser.id`).
   * @param body - The key's name, unique among this Machine user's Buyer keys.
   * @returns The key with its one-time `secret` — store it immediately.
   * @throws {LedewireError} With `statusCode === 409` when the Machine user is
   *   deactivated; with `statusCode === 422` for a duplicate name.
   */
  async create(
    machineUserId: string,
    body: CompanyMachineUserBuyerKeyCreateRequest,
  ): Promise<CompanyMachineUserBuyerKeyCreateResponse> {
    return this.http.post<CompanyMachineUserBuyerKeyCreateResponse>(
      `${machineUserPath(machineUserId)}/buyer-keys`,
      body,
    )
  }

  /**
   * Revokes a Machine user's Buyer key.
   *
   * @param machineUserId - The Machine user id (`CompanyMachineUser.id`).
   * @param id - The key id.
   * @throws {NotFoundError} When there is no such Machine user in the caller's
   *   Company, or no such active key.
   */
  async revoke(machineUserId: string, id: string): Promise<void> {
    return this.http.delete(
      `${machineUserPath(machineUserId)}/buyer-keys/${encodeURIComponent(id)}`,
    )
  }
}

/**
 * Issue and revoke a Machine user's MCP API keys. Company admins only.
 *
 * A Machine user's MCP key carries buyer scopes only — `mcp:search` and
 * `mcp:purchase` — never a store, and does not expire; revoke it instead. It is
 * presented to the Ledewire MCP server as `Authorization: Bearer <key>:<secret>`.
 *
 * **Secret handling:** `create()` returns the `secret` exactly once.
 *
 * Obtain via `client.company.machineUsers.mcpKeys` — do not construct directly.
 */
export class CompanyMachineUserMcpKeysNamespace {
  /** @internal */
  constructor(private readonly http: HttpClient) {}

  /**
   * Lists a Machine user's active MCP API keys, oldest first. Secrets are never
   * included.
   *
   * @param machineUserId - The Machine user id (`CompanyMachineUser.id`).
   * @returns The keys.
   * @throws {NotFoundError} When the Machine user is not in the caller's Company.
   */
  async list(machineUserId: string): Promise<CompanyMachineUserMcpKeyList> {
    return this.http.get<CompanyMachineUserMcpKeyList>(`${machineUserPath(machineUserId)}/mcp-keys`)
  }

  /**
   * Creates an MCP API key for a Machine user.
   *
   * @param machineUserId - The Machine user id (`CompanyMachineUser.id`).
   * @param body - A label and at least one of `'mcp:search'`, `'mcp:purchase'`.
   *   Any other scope, or a `store_id`, is refused with `400`.
   * @returns The key with its one-time `secret` — store it immediately.
   * @throws {LedewireError} With `statusCode === 409` when the Machine user is
   *   deactivated; with `statusCode === 422` for a duplicate label.
   */
  async create(
    machineUserId: string,
    body: CompanyMachineUserMcpKeyCreateRequest,
  ): Promise<CompanyMachineUserMcpKeyCreateResponse> {
    return this.http.post<CompanyMachineUserMcpKeyCreateResponse>(
      `${machineUserPath(machineUserId)}/mcp-keys`,
      body,
    )
  }

  /**
   * Revokes a Machine user's MCP API key.
   *
   * @param machineUserId - The Machine user id (`CompanyMachineUser.id`).
   * @param id - The key id.
   * @throws {NotFoundError} When there is no such Machine user in the caller's
   *   Company, or no such active key.
   */
  async revoke(machineUserId: string, id: string): Promise<void> {
    return this.http.delete(`${machineUserPath(machineUserId)}/mcp-keys/${encodeURIComponent(id)}`)
  }
}

/**
 * Manage the Company's Machine users. Company admins only.
 *
 * A Machine user is a Buyer with a name and no email, password or login — an
 * identity for an autonomous agent that spends the Company's money. It joins at
 * once as a non-admin member with the default daily Spend cap (change it with
 * `company.members.update()`), and authenticates only with the keys an admin
 * issues it through {@link buyerKeys} and {@link mcpKeys}. Every human-only flow
 * (login, Google sign-in, password reset, accepting or leaving a membership)
 * refuses it.
 *
 * Obtain via `client.company.machineUsers` — do not construct directly.
 *
 * @example
 * ```ts
 * const agentUser = await client.company.machineUsers.create({ name: 'research-agent' })
 * const { key, secret } = await client.company.machineUsers.buyerKeys.create(agentUser.id, {
 *   name: 'production',
 * })
 * // Store immediately — the secret cannot be retrieved again
 * await secretsManager.put('LEDEWIRE_AGENT_KEY', `${key}:${secret}`)
 *
 * // The agent then authenticates as the Machine user (server-side, @ledewire/node)
 * const agent = createAgentClient({ key, secret })
 * ```
 */
export class CompanyMachineUsersNamespace {
  /** A Machine user's Buyer keys: list, create, revoke. */
  readonly buyerKeys: CompanyMachineUserBuyerKeysNamespace

  /** A Machine user's MCP API keys: list, create, revoke. */
  readonly mcpKeys: CompanyMachineUserMcpKeysNamespace

  /** @internal */
  constructor(private readonly http: HttpClient) {
    this.buyerKeys = new CompanyMachineUserBuyerKeysNamespace(http)
    this.mcpKeys = new CompanyMachineUserMcpKeysNamespace(http)
  }

  /**
   * Lists the Company's Machine users, deactivated ones included
   * (`deactivated_at` set).
   *
   * @returns The Machine users.
   * @throws {ForbiddenError} When the caller is not a Company admin.
   * @throws {NotFoundError} When the caller belongs to no Company.
   */
  async list(): Promise<CompanyMachineUserList> {
    return this.http.get<CompanyMachineUserList>('/v1/company/machine-users')
  }

  /**
   * Creates a Machine user, joined at once as an active non-admin member.
   *
   * @param body - A name (at most 100 characters, unique among the Company's
   *   active Machine users) and an optional description.
   * @returns The Machine user.
   * @throws {LedewireError} With `statusCode === 409` when an active Machine
   *   user already has this name; with `statusCode === 422` when the name is
   *   blank or too long.
   */
  async create(body: CompanyMachineUserCreateRequest): Promise<CompanyMachineUser> {
    return this.http.post<CompanyMachineUser>('/v1/company/machine-users', body)
  }

  /**
   * Deactivates a Machine user, **permanently**. In one step this closes its
   * membership, revokes every key it holds, and ends its sessions. It cannot be
   * reactivated; create a new one, which may reuse the name.
   *
   * @param id - The Machine user id (`CompanyMachineUser.id`).
   * @returns The deactivated Machine user.
   * @throws {NotFoundError} When the Machine user is not in the caller's Company.
   * @throws {LedewireError} With `statusCode === 409` when already deactivated.
   */
  async deactivate(id: string): Promise<CompanyMachineUser> {
    return this.http.delete<CompanyMachineUser>(machineUserPath(id))
  }
}
