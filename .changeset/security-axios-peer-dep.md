---
'@ledewire/x402-client': patch
---

Tighten axios peer dependency from `>=1.0.0` to `>=1.16.0` to exclude versions affected by multiple high/critical security advisories including prototype pollution gadgets, NO_PROXY bypass (SSRF), header injection, ReDoS via cookie name, and credential leak via proxy redirect.
