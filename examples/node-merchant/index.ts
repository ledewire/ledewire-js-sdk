/**
 * Node.js merchant walkthrough.
 *
 * Demonstrates:
 * 1. Merchant email/password authentication + store discovery (single call)
 * 2. Creating a content item in the store
 * 3. Viewing a sales summary for the store
 * 4. Listing per-title sales statistics
 * 5. Listing top buyers by their opaque buyer_ref
 * 6. The same sales summary from a store API-key session, using the store_id
 *    that loginWithApiKey resolves with
 * 6. Checking that one of the store's own pages is a registered x402 resource
 *    (set LEDEWIRE_PAGE_URL to try it)
 *
 * Prerequisites:
 *   cp .env.example .env   # fill in LEDEWIRE_EMAIL, LEDEWIRE_PASSWORD,
 *                          # LEDEWIRE_API_KEY, LEDEWIRE_API_SECRET
 *
 * Run:
 *   pnpm start
 */
import { createClient, LedewireError } from '@ledewire/node'

// client.merchant.* accepts either a merchant session (email/password, steps 1-4)
// or a store API-key token from client.auth.loginWithApiKey({ key, secret }) (step 5).
const client = createClient({
  apiKey: process.env['LEDEWIRE_API_KEY'],
  apiSecret: process.env['LEDEWIRE_API_SECRET'],
  baseUrl: process.env['LEDEWIRE_BASE_URL'] ?? 'https://api.ledewire.com',
  onAuthExpired: () => {
    console.error('Session expired — please re-authenticate')
    process.exit(1)
  },
})

async function main(): Promise<void> {
  try {
    // -------------------------------------------------------------------------
    // 1. Merchant authentication + store discovery (single call)
    // -------------------------------------------------------------------------
    const { stores } = await client.merchant.auth.loginWithEmailAndListStores({
      email: process.env['LEDEWIRE_EMAIL'] ?? '',
      password: process.env['LEDEWIRE_PASSWORD'] ?? '',
    })
    console.log('✓ Authenticated as merchant')

    if (stores.length === 0) {
      console.log('No stores found — create a store in the dashboard first.')
      return
    }

    const [firstStore] = stores
    if (!firstStore) return // narrowing — length guard above makes this unreachable
    const storeId = firstStore.id
    console.log(`✓ Using store: ${firstStore.name} (${storeId})`)

    // -------------------------------------------------------------------------
    // 2. Create a content item
    // -------------------------------------------------------------------------
    const article = await client.merchant.content.create(storeId, {
      content_type: 'markdown',
      title: 'Getting Started with LedeWire',
      content_body: '# Welcome\n\nThis is your first LedeWire article.',
      price_cents: 299,
      visibility: 'public',
    })
    console.log(`✓ Created content: ${article.id} — "${article.title}"`)

    // -------------------------------------------------------------------------
    // 3. Sales summary
    // -------------------------------------------------------------------------
    const summary = await client.merchant.sales.summary(storeId)
    console.log(
      `✓ Sales summary: ${summary.total_sales} sales, ` +
        `${summary.total_revenue_cents / 100} USD total revenue`,
    )

    // -------------------------------------------------------------------------
    // 4. Recent individual sales
    // -------------------------------------------------------------------------
    const { data: sales, pagination } = await client.merchant.sales.list(storeId)
    console.log(
      `✓ Recent sales (${pagination.total} total, showing first ${Math.min(5, sales.length)})`,
    )
    for (const sale of sales.slice(0, 5)) {
      console.log(`   - ${sale.title}: ${sale.total_revenue_cents / 100} USD`)
    }

    // -------------------------------------------------------------------------
    // 5. Top buyers — identified only by an opaque, store-scoped buyer_ref
    // -------------------------------------------------------------------------
    // A single sale (client.merchant.sales.get) names its buyer by the same
    // buyer_ref, never by user id or name, so the two can be matched.
    const { data: buyers } = await client.merchant.buyers.list(storeId)
    for (const buyer of buyers.slice(0, 5)) {
      console.log(
        `   - ${buyer.buyer_ref}: ${buyer.purchases_count} purchases, ` +
          `${buyer.total_spent_cents / 100} USD net`,
      )
    }

    // -------------------------------------------------------------------------
    // 6. Store API-key session: loginWithApiKey resolves with the key's store_id
    // -------------------------------------------------------------------------
    const key = process.env['LEDEWIRE_API_KEY']
    if (key) {
      const keyClient = createClient({
        baseUrl: process.env['LEDEWIRE_BASE_URL'] ?? 'https://api.ledewire.com',
      })
      const secret = process.env['LEDEWIRE_API_SECRET']
      const { store_id } = await keyClient.auth.loginWithApiKey({
        key,
        ...(secret !== undefined && { secret }),
      })
      const keySummary = await keyClient.merchant.sales.summary(store_id)
      console.log(`✓ API-key session for store ${store_id}: ${keySummary.total_sales} sales`)
    }

    // -------------------------------------------------------------------------
    // 6. x402 origin verification for one of the store's pages (public, no auth)
    // -------------------------------------------------------------------------
    const pageUrl = process.env['LEDEWIRE_PAGE_URL']
    if (pageUrl) {
      // Passing store_id lets the API register the URL now if one of the store's
      // pricing rules covers it. Unknown URLs answer verified: false, never an error.
      const origin = await client.x402.verifyOrigin({ url: pageUrl, store_id: storeId })
      console.log(
        origin.verified
          ? `✓ ${pageUrl} is "${origin.title}" at ${origin.amount} cents`
          : `✗ ${pageUrl} is not a registered Ledewire resource`,
      )
    }
  } catch (err) {
    if (err instanceof LedewireError) {
      console.error(`API error ${err.statusCode}: ${err.message}`)
    } else {
      throw err
    }
  }
}

void main()
