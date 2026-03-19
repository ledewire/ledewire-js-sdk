---
'@ledewire/browser': minor
---

## New: `lw.auth.requestPasswordReset()` and `lw.auth.resetPassword()`

The browser SDK now exposes the full buyer password reset flow directly from `lw.auth`.

```ts
// Step 1 — send reset code to buyer's email
await lw.auth.requestPasswordReset({ email: 'buyer@example.com' })
// → { data: { message: 'If an account with this email exists, a reset code has been sent.' } }

// Step 2 — submit the 6-digit code and new password
await lw.auth.resetPassword({
  email: 'buyer@example.com',
  reset_code: '123456',
  password: 'new-secure-password',
})
// → { data: { message: 'Password has been successfully reset.' } }
```

The `reset-request` response is intentionally ambiguous — the API returns the same success message whether or not the email exists, preventing account enumeration.

**New exported types:** `AuthPasswordResetRequestBody`, `AuthPasswordResetBody`, `AuthPasswordResetResponse`
