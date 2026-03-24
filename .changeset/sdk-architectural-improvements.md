---
'@ledewire/node': patch
'@ledewire/browser': patch
---

**`PaginationParams` is now exported from `@ledewire/browser`** — previously it
was only available from `@ledewire/node`. Browser consumers building custom
pagination UI can now import it directly:

```ts
import type { PaginationParams } from '@ledewire/browser'
```

**`process.env` guard for edge runtimes (`@ledewire/node`)** — the dev-mode
warning that fires when both `storage` and `onTokenRefreshed` are configured now
checks `typeof process === 'undefined'` before accessing `process.env`. This
prevents a runtime crash when `@ledewire/node` is used on Cloudflare Workers,
Deno, or Bun.
