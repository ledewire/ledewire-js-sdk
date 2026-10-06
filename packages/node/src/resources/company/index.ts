/**
 * Company namespace — shared Company wallets, their members, and Machine users.
 *
 * @module
 */
import type { HttpClient } from '@ledewire/core'
import { CompanyInvitationsNamespace } from './invitations.js'
import { CompanyMachineUsersNamespace } from './machine-users.js'
import { CompanyMembersNamespace } from './members.js'
import { CompanyMembershipNamespace } from './membership.js'
import { CompanyPurchasesNamespace, CompanySpendNamespace } from './reports.js'
import { CompanyWalletNamespace } from './wallet.js'

/**
 * Company operations for the authenticated buyer.
 *
 * A Company is a shared wallet that pays for its members' purchases. Each
 * member spends under their own daily Spend cap, set by a Company admin, and
 * never sees the Company balance. Admins fund the wallet, manage members and
 * Machine users (agent identities with no login), and report on spend.
 *
 * `membership` and `invitations.accept()` are for any buyer; everything else is
 * Company-admin only and throws {@link ForbiddenError} for a plain member.
 *
 * Obtain via `client.company` — do not construct directly.
 */
export class CompanyNamespace {
  /** The authenticated buyer's own membership: read it, or leave the Company. */
  readonly membership: CompanyMembershipNamespace

  /** Invite people to the Company (admin), and accept an invitation (invitee). */
  readonly invitations: CompanyInvitationsNamespace

  /** List members, change a member's role or daily Spend cap, remove a member (admin). */
  readonly members: CompanyMembersNamespace

  /** Machine users and their Buyer keys and MCP API keys (admin). */
  readonly machineUsers: CompanyMachineUsersNamespace

  /** Fund the Company wallet and list unsettled top-ups (admin). */
  readonly wallet: CompanyWalletNamespace

  /** Everything the Company paid for, attributed to its members (admin). */
  readonly purchases: CompanyPurchasesNamespace

  /** What each member has spent of the Company's money (admin). */
  readonly spend: CompanySpendNamespace

  /** @internal */
  constructor(http: HttpClient) {
    this.membership = new CompanyMembershipNamespace(http)
    this.invitations = new CompanyInvitationsNamespace(http)
    this.members = new CompanyMembersNamespace(http)
    this.machineUsers = new CompanyMachineUsersNamespace(http)
    this.wallet = new CompanyWalletNamespace(http)
    this.purchases = new CompanyPurchasesNamespace(http)
    this.spend = new CompanySpendNamespace(http)
  }
}
