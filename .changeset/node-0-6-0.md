---
'@ledewire/node': minor
---

## Breaking changes

### `content_body` and `teaser` are now plain text in and out

The SDK now transparently handles base64 encoding on write and decoding on read for all content endpoints. Update any `seller.content.create` and `seller.content.update` call sites — pass plain text, not base64:

```ts
// Before
await client.seller.content.create(storeId, {
  content_type: 'markdown',
  content_body: Buffer.from('# Hello\n\nWorld').toString('base64'),
  teaser: Buffer.from('A short teaser.').toString('base64'),
  // ...
})

// After — plain text, SDK handles encoding
await client.seller.content.create(storeId, {
  content_type: 'markdown',
  content_body: '# Hello\n\nWorld',
  teaser: 'A short teaser.',
  // ...
})
```

Responses from `get`, `list`, `search`, `create`, and `update` now return `content_body` and `teaser` as plain UTF-8 text. Remove any `Buffer.from(x, 'base64').toString()` decoding in consumer code.

## Fixes and improvements

- **`ContentSearchRequest` exported** from `@ledewire/node` — was previously missing from the public surface
- **`external_identifier`** added to `ContentSearchRequest` — search content by its namespaced platform ID (e.g. `'vimeo:123456789'`)
- **`content.getWithAccess(id, userId?)`** — JSDoc now documents the `userId` parameter as a merchant server-side proxy lookup (check a specific buyer's access state without impersonating them)
- **`metadata.reading_time`** annotated in types (not `read_time`) to prevent silent runtime `undefined`
- **`ForbiddenError` JSDoc** now shows correct import path for both browser and node packages
