---
'@ledewire/node': minor
---

Sync the remaining gaps with the LedeWire API spec.

- **Topics:** new `client.topics.list()` returns the Topic directory, with how many listed publications carry each Topic.
- **Publications:** `publications.list()` accepts `q`, `bulk_licensable` and `topics`. New `publications.get(id)` returns one publication.
- **Content search:** `client.content.search()` runs the buyer search across every Store and Publication, with cursor paging.
- **HTTP client:** query params accept booleans, and an array repeats its key, as in `topics[]`.
