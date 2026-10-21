/**
 * Company namespace: buyer-side Company membership, administration, wallet, and spend.
 *
 * @module
 */
import type { HttpClient } from '@ledewire/core'
import { CompanyMembershipNamespace } from './membership.js'
import { CompanyMembersNamespace } from './members.js'
import { CompanyInvitationsNamespace } from './invitations.js'
import { CompanyMachineUsersNamespace } from './machine-users.js'
import { CompanyWalletNamespace } from './wallet.js'
import { CompanyPurchasesNamespace } from './purchases.js'
import { CompanySpendNamespace } from './spend.js'

/**
 * Company operations for a buyer who belongs to, or administers, a Company.
 *
 * `membership` is available to any buyer in a Company. The other namespaces
 * require Company admin rights, and a Machine user's credentials cannot use them.
 *
 * Obtain via `client.company` — do not construct directly.
 *
 * @example
 * ```ts
 * const membership = await client.company.membership.get()
 *
 * // Admins: review members and spend
 * const { data: members } = await client.company.members.list()
 * const { data: spend } = await client.company.spend.list()
 * ```
 */
export class CompanyNamespace {
  /** The authenticated buyer's own Company membership: read and leave. */
  readonly membership: CompanyMembershipNamespace

  /** Admin: list, change role or Spend cap for, and remove open members. */
  readonly members: CompanyMembersNamespace

  /** Admin: invite, list, and revoke invitations. Accept an invitation as the invitee. */
  readonly invitations: CompanyInvitationsNamespace

  /** Admin: Machine users (name-only agent Buyers), with their Buyer and MCP keys. */
  readonly machineUsers: CompanyMachineUsersNamespace

  /** Admin: the Company wallet, its pending top-ups, and funding. */
  readonly wallet: CompanyWalletNamespace

  /** Admin: purchases and Bulk acquisitions the Company has paid for. */
  readonly purchases: CompanyPurchasesNamespace

  /** Admin: spend per membership. */
  readonly spend: CompanySpendNamespace

  /** @internal */
  constructor(http: HttpClient) {
    this.membership = new CompanyMembershipNamespace(http)
    this.members = new CompanyMembersNamespace(http)
    this.invitations = new CompanyInvitationsNamespace(http)
    this.machineUsers = new CompanyMachineUsersNamespace(http)
    this.wallet = new CompanyWalletNamespace(http)
    this.purchases = new CompanyPurchasesNamespace(http)
    this.spend = new CompanySpendNamespace(http)
  }
}
