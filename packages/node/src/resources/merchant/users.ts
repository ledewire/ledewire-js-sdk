/**
 * Merchant store users (team management) namespace.
 *
 * @module
 */
import type { HttpClient } from '@ledewire/core'
import type { MerchantUser, MerchantInviteRequest, MerchantInviteResponse } from '@ledewire/core'

/**
 * Manage team members for a merchant store.
 *
 * Obtain via `client.merchant.users` — do not construct directly.
 */
export class MerchantUsersNamespace {
  /** @internal */
  constructor(private readonly http: HttpClient) {}

  /**
   * List all members of a store.
   * Requires `owner` role (merchant JWT) or API key with `full` permission.
   *
   * @param storeId - The store ID whose members to retrieve.
   *
   * @example
   * ```ts
   * const members = await client.merchant.users.list('store-id')
   * ```
   */
  async list(storeId: string): Promise<MerchantUser[]> {
    return this.http.get<MerchantUser[]>(`/v1/merchant/${storeId}/users`)
  }

  /**
   * Invite a user to the store.
   * If the user already has an account they are added immediately (`MerchantUser`);
   * otherwise an invitation email is sent (`MerchantInviteResponse`).
   *
   * @param storeId - The store ID to invite the user to.
   * @param body - Invite request body including email and optional `is_author` flag.
   *
   * @example
   * ```ts
   * const result = await client.merchant.users.invite('store-id', {
   *   email: 'author@example.com',
   *   is_author: true,
   * })
   * ```
   */
  async invite(
    storeId: string,
    body: MerchantInviteRequest,
  ): Promise<MerchantUser | MerchantInviteResponse> {
    return this.http.post<MerchantUser | MerchantInviteResponse>(
      `/v1/merchant/${storeId}/users`,
      body,
    )
  }

  /**
   * Remove a member from the store.
   * Owners cannot remove themselves.
   * Requires `owner` role (merchant JWT) or API key with `full` permission.
   *
   * @param storeId - The store ID.
   * @param userId - The StoreUser `id` to remove.
   *
   * @example
   * ```ts
   * await client.merchant.users.remove('store-id', 'store-user-id')
   * ```
   */
  async remove(storeId: string, userId: string): Promise<void> {
    return this.http.delete(`/v1/merchant/${storeId}/users/${userId}`)
  }
}
