---
'@ledewire/node': minor
'@ledewire/browser': minor
---

Errors now carry `retryAfter`, the number of seconds to wait from the response's `Retry-After` header.

- Set on every `LedewireError` and its typed subclasses (`AuthError`, `ForbiddenError`, `NotFoundError`) when the response includes the header. It accepts both the seconds form and the HTTP-date form. A past date gives `0`, and an unparseable value gives `undefined`.
- `publications.listWorks` no longer documents the header as unavailable.
