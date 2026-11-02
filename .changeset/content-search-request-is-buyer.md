---
'@ledewire/node': minor
---

`ContentSearchRequest` is now the buyer search request that `client.content.search()` takes.

**Breaking:** in 0.14.0 `ContentSearchRequest` was the seller content search shape (`title`,
`uri`, `external_identifier`). That shape is now exported only as
`MerchantContentSearchRequest`, and `ContentSearchRequest` names the buyer's
`POST /v1/content/search` body (`query`, `tags`, `max_price_cents`, `publication`,
`form_type`, `ticker`, `cik`, `cursor`, `limit`, …). Code that typed a seller search with
`ContentSearchRequest` must switch to `MerchantContentSearchRequest`. `BuyerContentSearchRequest`
is kept as the same type under its earlier name.
