---
'@ledewire/node': minor
---

**`client.merchant.auth` now supports password reset** — two new methods mirror
the buyer-side password reset flow:

```ts
// Step 1: request a reset code (always returns 200 — enumeration-safe)
await client.merchant.auth.requestPasswordReset({ email: 'merchant@example.com' })

// Step 2: submit the code and new password
await client.merchant.auth.resetPassword({
  email: 'merchant@example.com',
  reset_code: '123456',
  password: 'newSecurePassword',
})
```

Three new types are exported from `@ledewire/node`:
`MerchantPasswordResetRequestBody`, `MerchantPasswordResetBody`,
`MerchantPasswordResetResponse`.
