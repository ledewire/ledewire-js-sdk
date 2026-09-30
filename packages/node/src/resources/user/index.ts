/**
 * User namespace — authenticated buyer account operations.
 *
 * @module
 */
import type { HttpClient } from '@ledewire/core'
import { UserApiKeysNamespace } from './api-keys.js'
import { UserSpendCapNamespace } from './spend-cap.js'
import { UserMcpKeysNamespace } from './mcp-keys.js'

/**
 * Authenticated buyer account operations.
 *
 * Obtain via `client.user` — do not construct directly.
 */
export class UserNamespace {
  /**
   * Buyer API key management: create, list, and revoke named API keys.
   * Keys are used by autonomous agents to authenticate without a username/password.
   */
  readonly apiKeys: UserApiKeysNamespace

  /**
   * The authenticated buyer's daily spend cap: read and update the ceiling that
   * governs every wallet debit (MCP, REST, and the web payment gate).
   */
  readonly spendCap: UserSpendCapNamespace

  /**
   * MCP API key management: create, list, and revoke keys scoped for use against
   * the Ledewire MCP server.
   */
  readonly mcpKeys: UserMcpKeysNamespace

  /** @internal */
  constructor(http: HttpClient) {
    this.apiKeys = new UserApiKeysNamespace(http)
    this.spendCap = new UserSpendCapNamespace(http)
    this.mcpKeys = new UserMcpKeysNamespace(http)
  }
}
