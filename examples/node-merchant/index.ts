/**
 * Node.js merchant + seller walkthrough.
 *
 * Demonstrates:
 * 1. Merchant email/password authentication
 * 2. Listing stores you manage
 * 3. Creating a content item as a seller (API key + secret)
 * 4. Viewing a sales summary for the store
 * 5. Listing recent individual sales
 *
 * Prerequisites:
 *   cp .env.example .env   # fill in LEDEWIRE_EMAIL, LEDEWIRE_PASSWORD,
 *                          # LEDEWIRE_API_KEY, LEDEWIRE_API_SECRET
 *
 * Run:
 *   pnpm start
 */
import { createClient, LedewireError } from '@ledewire/node'

// A single client instance can be used for both merchant and seller workflows.
// Merchant operations use email/password session tokens; seller operations use
// the API key + secret pair.
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
    // 1. Merchant authentication
    // -------------------------------------------------------------------------
    await client.merchant.auth.loginWithEmail({
      email: process.env['LEDEWIRE_EMAIL'] ?? '',
      password: process.env['LEDEWIRE_PASSWORD'] ?? '',
    })
    console.log('✓ Authenticated as merchant')

    // -------------------------------------------------------------------------
    // 2. List stores
    // -------------------------------------------------------------------------
    const stores = await client.merchant.auth.stores()
    if (stores.length === 0) {
      console.log('No stores found — create a store in the dashboard first.')
      return
    }

    const [firstStore] = stores
    if (!firstStore) return // narrowing — length guard above makes this unreachable
    const storeId = firstStore.store_id
    console.log(`✓ Using store: ${storeId}`)

    // -------------------------------------------------------------------------
    // 3. Create a content item (seller API key + secret required)
    // -------------------------------------------------------------------------
    const article = await client.seller.content.create(storeId, {
      content_type: 'markdown',
      title: 'Getting Started with LedeWire',
      content_body: Buffer.from('# Welcome\n\nThis is your first LedeWire article.').toString(
        'base64',
      ),
      price_cents: 299,
      visibility: 'public',
    })
    console.log(`✓ Created content: ${article.id} — "${article.title}"`)

    // -------------------------------------------------------------------------
    // 4. Sales summary
    // -------------------------------------------------------------------------
    const summary = await client.merchant.sales.summary(storeId)
    console.log(
      `✓ Sales summary: ${summary.total_sales} sales, ` +
        `${summary.total_revenue_cents / 100} USD total revenue`,
    )

    // -------------------------------------------------------------------------
    // 5. Recent individual sales
    // -------------------------------------------------------------------------
    const sales = await client.merchant.sales.list(storeId)
    console.log(`✓ Recent sales (${sales.length} records)`)
    for (const sale of sales.slice(0, 5)) {
      console.log(`   - ${sale.content_title}: ${sale.price_cents / 100} USD`)
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
