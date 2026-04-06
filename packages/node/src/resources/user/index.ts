/**
 * User namespace — authenticated buyer account operations.
 *
 * @module
 */
import type { HttpClient } from '@ledewire/core'
import { UserApiKeysNamespace } from './api-keys.js'

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

  /** @internal */
  constructor(http: HttpClient) {
    this.apiKeys = new UserApiKeysNamespace(http)
  }
}
