---
'@ledewire/node': minor
'@ledewire/browser': minor
---

Add `InvalidCursorError`, thrown when `content.search` refuses its `cursor` (`422` with `error.type` `'invalid_cursor'`): the cursor is invalid, expired, in an older format, or was issued for different filters. Drop the cursor and restart the search from the first page; the same cursor never succeeds on retry. It extends `LedewireError` with `statusCode` 422 and is matched on `error.type` alone, so any other 422 stays a plain `LedewireError`. Needs an API that sends `invalid_cursor` (ledewire/api#1692). Syncs `ledewire.yml` from the API (ledewire/api `3eb80e29831f41310acdd370dd15f5306096195d`): `ErrorType` gains `'invalid_cursor'`.
