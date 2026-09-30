---
'@ledewire/x402-client': patch
---

Raise the axios peer dependency from `>=1.16.0` to `>=1.20.0`, excluding versions affected by the advisories published 2026-09-30: HTTP/2 adapter bypassing DNS lookup and proxy controls (GHSA-3pq3-5fj3-cg6v), a denial of service from an unhandled HTTP/2 session `error` event (GHSA-542g-h47m-68v8), ReDoS in the `data:` URL parser (GHSA-c29m-xwm3-cm6r) and in proxy host normalization (GHSA-mghh-pgcx-3jjj), and prototype-pollution gadgets (GHSA-x97p-jq2g-jp4f, plus two moderate advisories).
