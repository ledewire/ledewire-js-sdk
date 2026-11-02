/**
 * Merchant store users (team management) namespace.
 *
 * @module
 */
import type { HttpClient } from '@ledewire/core'
import type {
  MerchantUser,
  MerchantInviteRequest,
  MerchantInviteResponse,
  MerchantUserUpdateRequest,
  PaginatedUsersList,
  PaginationParams,
} from '@ledewire/core'

/**
 * Manage team members for a merchant store.
 *
 * Obtain via `client.merchant.users` — do not construct directly.
 */
export class MerchantUsersNamespace {
  /** @internal */
  constructor(private readonly http: HttpClient) {}

  /**
   * List all members of a store (paginated).
   *
   * **Requires a full key:** `owner` role (merchant JWT) or a store API key
   * with `full` permission. A `view` key and a non-owner member are refused.
   *
   * @param storeId - The store ID whose members to retrieve.
   * @param params - Optional pagination parameters.
   * @throws {ForbiddenError} For a `view` API key or a non-owner member (403).
   *
   * @example
   * ```ts
   * const { data, pagination } = await client.merchant.users.list('store-id')
   * ```
   */
  async list(storeId: string, params?: PaginationParams): Promise<PaginatedUsersList> {
    return this.http.get<PaginatedUsersList>(
      `/v1/merchant/${encodeURIComponent(storeId)}/users`,
      params,
    )
  }

  /**
   * Invite a user to the store.
   * If the user already has an account they are added immediately (`MerchantUser`);
   * otherwise an invitation email is sent (`MerchantInviteResponse`), whose
   * `invitation_token` the invitee redeems through `auth.signup()`,
   * `auth.loginWithGoogle()` or `merchant.auth.acceptInvitation()`.
   *
   * **Requires a full key:** `owner` role (merchant JWT) or a store API key
   * with `full` permission. A `view` key and a non-owner member are refused.
   *
   * @param storeId - The store ID to invite the user to.
   * @param body - Invite request body. Only `email` is required; `is_author` defaults to `true` on the server when omitted.
   * @throws {ForbiddenError} For a `view` API key or a non-owner member (403).
   * @throws {LedewireError} With `statusCode === 409` when the address already
   *   belongs to the store.
   *
   * @example
   * ```ts
   * // Minimal — is_author defaults to true on the server
   * const result = await client.merchant.users.invite('store-id', {
   *   email: 'author@example.com',
   * })
   *
   * // Explicit — override is_author or set a custom fee
   * const result = await client.merchant.users.invite('store-id', {
   *   email: 'author@example.com',
   *   is_author: true,
   *   author_fee_bps: 1800,
   * })
   * ```
   */
  async invite(
    storeId: string,
    body: MerchantInviteRequest,
  ): Promise<MerchantUser | MerchantInviteResponse> {
    return this.http.post<MerchantUser | MerchantInviteResponse>(
      `/v1/merchant/${encodeURIComponent(storeId)}/users`,
      body,
    )
  }

  /**
   * Update a store member's permissions.
   * Supports toggling `is_author` and setting a per-author fee override.
   * At least one field must be provided. Owners cannot update their own record.
   *
   * **Requires a full key:** `owner` role (merchant JWT) or a store API key
   * with `full` permission. A `view` key and a non-owner member are refused.
   *
   * @param storeId - The store ID.
   * @param userId - The StoreUser `id` to update.
   * @param body - Fields to update.
   * @throws {ForbiddenError} For a `view` API key, a non-owner member, or an
   *   owner updating their own record (403).
   *
   * @example
   * ```ts
   * // Set a custom 18% author fee
   * await client.merchant.users.update('store-id', 'user-id', { author_fee_bps: 1800 })
   * // Clear the override (revert to store default)
   * await client.merchant.users.update('store-id', 'user-id', { author_fee_bps: null })
   * ```
   */
  async update(
    storeId: string,
    userId: string,
    body: MerchantUserUpdateRequest,
  ): Promise<MerchantUser> {
    return this.http.patch<MerchantUser>(
      `/v1/merchant/${encodeURIComponent(storeId)}/users/${encodeURIComponent(userId)}`,
      body,
    )
  }

  /**
   * Remove a member from the store.
   * Owners cannot remove themselves.
   *
   * **Requires a full key:** `owner` role (merchant JWT) or a store API key
   * with `full` permission. A `view` key and a non-owner member are refused.
   *
   * @param storeId - The store ID.
   * @param userId - The StoreUser `id` to remove.
   * @throws {ForbiddenError} For a `view` API key, a non-owner member, or an
   *   owner removing themselves (403).
   *
   * @example
   * ```ts
   * await client.merchant.users.remove('store-id', 'store-user-id')
   * ```
   */
  async remove(storeId: string, userId: string): Promise<void> {
    return this.http.delete(
      `/v1/merchant/${encodeURIComponent(storeId)}/users/${encodeURIComponent(userId)}`,
    )
  }
}
