---
'@ledewire/node': minor
---

Follow the API's merchant changes.

- New `client.auth.getInviteInfo(token)` (`GET /v1/auth/invite-info/{token}`): the pending store invitation behind an emailed token, as an `InviteInfoResponse`. A public call that sends no `Authorization` header. 404 is a `NotFoundError`; 409 (already accepted) and 410 (expired) are `LedewireError`s with that `statusCode`.
- New `client.merchant.auth.acceptInvitation({ invitation_token })` (`POST /v1/auth/merchant/accept-invitation`): joins the signed-in merchant to the store and returns a `MerchantInvitationAcceptedResponse`. A refusal carries `type === 'invitation_not_accepted'` and `details.reason` (`not_found`, `wrong_email`, `already_accepted`, `already_member`, `expired`, `invalid`), as `company.invitations.accept()` does.
- New exported types `InviteInfoResponse`, `MerchantAcceptInvitationRequest` and `MerchantInvitationAcceptedResponse`, with `createMockClient()` stubs for both methods.
- `merchant.users.invite` now percent-encodes `storeId` in the path, like the other `merchant.users` methods.
- The JSDoc, README, guide and `llms.txt` say which merchant methods need a **full** store API key (key and secret) or an owner login: `merchant.content` create/update/delete, `merchant.users` list/invite/update/remove, `merchant.pricingRules` create/deactivate and `merchant.domains` add/verify/remove. A `view` key gets a 403 `ForbiddenError` from them.
- `merchant.sales.get` documents the opaque `buyer_ref` and nullable `fees.*_cents` (the type change itself is the **Breaking** `MerchantSaleResponse` entry in the spec-sync changeset).
