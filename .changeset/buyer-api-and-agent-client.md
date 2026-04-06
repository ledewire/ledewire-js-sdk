---
'@ledewire/node': minor
'@ledewire/browser': minor
---

**Buyer API key authentication, `user.apiKeys` namespace, and `createAgentClient()` factory**

### `auth.loginWithBuyerApiKey()` (node + browser)

Authenticate as a buyer using a named API key + secret. Tokens are stored automatically — identical in shape to email/password login.

```ts
await client.auth.loginWithBuyerApiKey({
  key: process.env.LEDEWIRE_BUYER_KEY,
  secret: process.env.LEDEWIRE_BUYER_SECRET,
})
```

### `client.user.apiKeys` (node + browser)

Manage buyer API keys from a portal or dashboard. The `secret` is returned **once only** at creation — store it immediately.

```ts
// List existing keys (secret never included)
const keys = await client.user.apiKeys.list()

// Create a new agent key with an optional spend cap
const { key, secret } = await client.user.apiKeys.create({
  name: 'my-rag-agent',
  spending_limit_cents: 1000,
})

// Revoke a key
await client.user.apiKeys.revoke(keyId)
```

### `createAgentClient()` (`@ledewire/node` only)

Factory for autonomous (headless) agents. Returns a buyer-scoped client exposing `auth`, `wallet`, `purchases`, `content`, `checkout`, and `user`. The `merchant`, `seller`, and `config` namespaces are intentionally excluded.

```ts
import { createAgentClient } from '@ledewire/node'

const agent = createAgentClient({
  key: process.env.LEDEWIRE_BUYER_KEY,
  secret: process.env.LEDEWIRE_BUYER_SECRET,
  // storage: myRedisAdapter  // recommended for serverless — default is MemoryTokenStorage
})

await agent.auth.loginWithBuyerApiKey({ key, secret })
const balance = await agent.wallet.balance()
const purchase = await agent.purchases.create({ content_id: 'abc123' })
```

### New exported types (`@ledewire/node`)

`AuthLoginBuyerApiKeyRequest`, `UserApiKey`, `UserApiKeyCreateRequest`, `UserApiKeyCreateResponse`, `AgentClientConfig`, `AgentClient`

---

**x402 pricing rules and domain verification** (`client.merchant.pricingRules` + `client.merchant.domains`, `@ledewire/node` only)

Manage URL-pattern pricing rules and the domain verification required before creating them.

```ts
// 1. Verify domain ownership (DNS TXT record)
const verification = await client.merchant.domains.add(storeId, { domain: 'blog.example.com' })
// verification.txt_record_name / .txt_record_value → add to DNS, platform verifies async

// 2. Create a pricing rule for matching URLs
const rule = await client.merchant.pricingRules.create(storeId, {
  url_pattern: 'https://blog.example.com/posts/**',
  price_cents: 150,
})

// 3. Deactivate without deleting
await client.merchant.pricingRules.deactivate(storeId, rule.id)
```

New exported types: `MerchantPricingRule`, `MerchantDomainVerification`
