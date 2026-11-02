/**
 * Node.js merchant walkthrough.
 *
 * Demonstrates:
 * 1. Merchant email/password authentication + store discovery (single call)
 * 2. Creating a content item in the store
 * 3. Viewing a sales summary for the store
 * 4. Listing recent individual sales
 *
 * Prerequisites:
 *   cp .env.example .env   # fill in LEDEWIRE_EMAIL, LEDEWIRE_PASSWORD,
 *                          # LEDEWIRE_API_KEY, LEDEWIRE_API_SECRET
 *
 * Run:
 *   pnpm start
 */
import { createClient, LedewireError } from '@ledewire/node'

// client.merchant.* accepts either a merchant session (email/password, used here)
// or a store API-key token from client.auth.loginWithApiKey({ key, secret }).
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
    const storeId = firstStore.store_id
    console.log(`✓ Using store: ${firstStore.store_name} (${storeId})`)

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
  } catch (err) {
    if (err instanceof LedewireError) {
      console.error(`API error ${err.statusCode}: ${err.message}`)
    } else {
      throw err
    }
  }
}

void main()
