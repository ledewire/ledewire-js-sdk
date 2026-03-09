/**
 * Node.js merchant example.
 *
 * Demonstrates:
 * - Merchant email/password authentication
 * - Listing stores and team members
 * - Creating content
 * - Viewing a sales summary
 *
 * Run:
 *   cp .env.example .env  # fill in your credentials
 *   pnpm start
 */
import { createClient, LedewireError } from '@ledewire/node'

const client = createClient({
  // Use API key + secret for seller operations,
  // or omit and use merchant.auth.loginWithEmail for merchant ops
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
    // 1. Authenticate as merchant
    await client.merchant.auth.loginWithEmail({
      email: process.env['LEDEWIRE_EMAIL'] ?? '',
      password: process.env['LEDEWIRE_PASSWORD'] ?? '',
    })
    console.log('Authenticated as merchant')

    // 2. List stores you manage
    const stores = await client.merchant.auth.stores()
    console.log('Stores:', stores)

    if (stores.length === 0) {
      console.log('No stores found')
      return
    }

    const storeId = stores[0].store_id

    // 3. View sales summary
    const summary = await client.merchant.sales.summary({ storeId })
    console.log('Sales summary:', summary)

    // 4. List recent sales
    const sales = await client.merchant.sales.list({ storeId })
    console.log(`Recent sales (${sales.length}):`, sales)

  } catch (err) {
    if (err instanceof LedewireError) {
      console.error(`API error ${err.statusCode}: ${err.message}`)
    } else {
      throw err
    }
  }
}

void main()
