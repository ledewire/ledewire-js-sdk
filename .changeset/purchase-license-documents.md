---
'@ledewire/node': minor
'@ledewire/browser': minor
---

Add `purchases.licenseDocument(id)` to `@ledewire/node` and `@ledewire/browser`, which downloads the licence document a purchase's `license.document_url` points at. It resolves to a `LicenseDocument`, `{ body: ArrayBuffer, contentType }`, because the document is a PDF, Markdown (an SEC filing's terms) or other bytes rather than JSON. It throws `AuthError` (401), `ForbiddenError` (403) and `NotFoundError` (404), and is stubbed in `createMockClient()`.
Export the `PurchaseLicense`, `PurchasePublication`, `ContentSearchFiling` and `LicenseDocument` types, and document `license`, `content.publication` and `content.filing` on purchases, `filing` on search results, and the `publication`, `form_type`, `ticker` and `cik` filters on `content.search()` (SEC EDGAR filings).
