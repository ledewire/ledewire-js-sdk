/**
 * Company Machine users namespace: name-only Buyers that autonomous agents act as.
 *
 * @module
 */
import type {
  HttpClient,
  CompanyMachineUser,
  CompanyMachineUserList,
  CompanyMachineUserRequest,
  CompanyMachineUserUpdateRequest,
} from '@ledewire/core'
import {
  CompanyMachineUserBuyerKeysNamespace,
  CompanyMachineUserMcpKeysNamespace,
} from './machine-user-keys.js'

/**
 * Create and manage a Company's Machine users. Every call requires Company admin rights.
 *
 * A Machine user is a Buyer with a name and no email, password or login. It is
 * joined as an active, non-admin member with the default daily Spend cap, and is
 * given credentials through its own Buyer keys (`buyerKeys`) and MCP API keys
 * (`mcpKeys`). Deactivation is permanent. A deactivated name can be reused.
 *
 * Obtain via `client.company.machineUsers` — do not construct directly.
 *
 * @example
 * ```ts
 * const agent = await client.company.machineUsers.create({
 *   name: 'research-agent',
 *   description: 'Nightly corpus pull',
 * })
 *
 * const { secret } = await client.company.machineUsers.buyerKeys.create(agent.id, {
 *   name: 'primary',
 * })
 * // Store the secret immediately; it is shown once.
 *
 * // Retire the agent: revokes its keys and ends its sessions
 * await client.company.machineUsers.deactivate(agent.id)
 * ```
 */
export class CompanyMachineUsersNamespace {
  /**
   * Buyer keys for a Machine user: list, create, and revoke.
   */
  readonly buyerKeys: CompanyMachineUserBuyerKeysNamespace

  /**
   * MCP API keys for a Machine user: list, create, and revoke.
   */
  readonly mcpKeys: CompanyMachineUserMcpKeysNamespace

  /** @internal */
  constructor(private readonly http: HttpClient) {
    this.buyerKeys = new CompanyMachineUserBuyerKeysNamespace(http)
    this.mcpKeys = new CompanyMachineUserMcpKeysNamespace(http)
  }

  /**
   * Lists the Company's Machine users, active and deactivated, oldest first.
   *
   * @returns The Machine user envelope (`{ data }`).
   */
  async list(): Promise<CompanyMachineUserList> {
    return this.http.get<CompanyMachineUserList>('/v1/company/machine-users')
  }

  /**
   * Creates a Machine user. The name must be unique among the Company's active
   * Machine users, and at most 100 characters.
   *
   * @param body - `name`, and an optional `description`.
   * @returns The new Machine user.
   *
   * @example
   * ```ts
   * const agent = await client.company.machineUsers.create({ name: 'support-bot' })
   * ```
   */
  async create(body: CompanyMachineUserRequest): Promise<CompanyMachineUser> {
    return this.http.post<CompanyMachineUser>('/v1/company/machine-users', body)
  }

  /**
   * Renames a Machine user or changes its description. Its keys and sessions are
   * untouched, so the agent keeps working. Attribution reads the new name live.
   *
   * @param id - The Machine user id.
   * @param body - `name`, `description`, or both. A null or blank `description` clears it.
   * @returns The updated Machine user.
   *
   * @example
   * ```ts
   * await client.company.machineUsers.update('machine-user-id', { description: 'Weekly sync' })
   * ```
   */
  async update(id: string, body: CompanyMachineUserUpdateRequest): Promise<CompanyMachineUser> {
    return this.http.patch<CompanyMachineUser>(
      `/v1/company/machine-users/${encodeURIComponent(id)}`,
      body,
    )
  }

  /**
   * Deactivates a Machine user permanently. In one transaction this closes its
   * membership, revokes every key it holds, and ends its sessions. It cannot be
   * reactivated; create a new Machine user instead.
   *
   * @param id - The Machine user id.
   * @returns The deactivated Machine user.
   *
   * @example
   * ```ts
   * const retired = await client.company.machineUsers.deactivate('machine-user-id')
   * ```
   */
  async deactivate(id: string): Promise<CompanyMachineUser> {
    return this.http.delete<CompanyMachineUser>(
      `/v1/company/machine-users/${encodeURIComponent(id)}`,
    )
  }
}
