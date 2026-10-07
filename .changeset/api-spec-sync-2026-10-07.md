---
'@ledewire/node': minor
'@ledewire/browser': minor
---

Sync with the LedeWire API spec as of 2026-10-07.

- `company.wallet.get()` reads the Company wallet (`balance_cents`, `held_cents`, `pending_top_up_cents`): the only place the Company balance appears. Admin only.
- `company.invitations.revoke(id)` withdraws a pending invitation. Admin only.
- `company.machineUsers.update(id, { name?, description? })` renames a Machine user or changes its description. Its keys keep working. Admin only.
- `auth.signup()` and `auth.loginWithGoogle()` accept `invitation_token` (store invitation), and `loginWithGoogle()` also accepts `company_invitation_token`. For an existing Google account, the response's new `invitations` field reports each token's `InvitationOutcome`.
- New types: `CompanyWallet`, `CompanyMachineUserUpdateRequest`, `InvitationOutcome`, `InvitationRefusalReason`. `ErrorType` gains `invitation_not_accepted`.

**Behavior change (API):** a signup whose invitation token can't be accepted is now refused with a 422 `LedewireError` (`type === 'invitation_not_accepted'`, with `details.reason` and `details.invitation`) and no account is created. Previously the account was created without a membership. `company.invitations.accept()` refusals now carry `details.reason` too.
