---
'@ledewire/node': minor
'@ledewire/browser': minor
---

Register, list and revoke Payment keys, the public Ed25519 keys that sign x402 payments: `user.paymentKeys.list()` / `.create({ name, public_key, proof })` / `.revoke(id)` for a Buyer, and `company.machineUsers.paymentKeys.list(machineUserId)` / `.create(machineUserId, body)` / `.revoke(machineUserId, id)` for a Company admin managing a Machine user's keys. Adds the `PaymentKey`, `PaymentKeyCreateRequest` and `CompanyMachineUserPaymentKeyList` types and `createMockClient()` stubs.
