---
'@ledewire/node': patch
'@ledewire/browser': patch
---

`purchases.create()` documents `price_cents`: the price the buyer was quoted, which must equal the work's current price or the API refuses with a `422` and charges nothing. Every `purchases.create()` example in the READMEs, `llms.txt`, guides and JSDoc (including `SpendCapReachedError`) now passes it.
