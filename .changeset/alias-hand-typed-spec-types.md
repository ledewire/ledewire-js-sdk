---
'@ledewire/node': minor
'@ledewire/browser': minor
---

Exported request, response and query-parameter types that copied a spec schema by hand are now aliases of the generated types, with a type test pinning each one to `ledewire.yml`, so they can no longer drift from the API. Their names are unchanged.

- **Breaking:** `StoreConfig` (`client.merchant.config.get`) has a required `google_client_id: string | null`, as the API sends it, not an optional `string`. Handle `null` (no Google client ID configured).
- **Breaking:** `PublicationListParams`, `PublicationWorksParams`, `AcquisitionWorksParams`, `X402DiscoveryParams`, `CompanyReportFilters`, `CompanyPurchasesParams` and `CompanySpendParams` no longer carry a `[key: string]` index signature, so a parameter the endpoint does not take is a type error. Pass only the documented parameters.
- `MerchantPricingRuleCreateRequest` (`client.merchant.pricingRules.create`) is now exported from `@ledewire/node`.
