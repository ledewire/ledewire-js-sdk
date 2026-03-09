import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { AuthError } from '@ledewire/core'
import { createTestServer, http, HttpResponse } from '@ledewire/core/test-utils'
import {
  errorResponseFixture,
  walletBalanceFixture,
  walletTransactionFixture,
  walletPaymentSessionFixture,
  walletPaymentStatusFixture,
} from '@ledewire/core/test-utils'
import { createClient } from '../client.js'

const BASE = 'https://api.ledewire.com'

const server = createTestServer()
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
})
afterEach(() => {
  server.resetHandlers()
})
afterAll(() => {
  server.close()
})

function makeClient() {
  return createClient()
}

// ---------------------------------------------------------------------------
// wallet.balance
// ---------------------------------------------------------------------------

describe('wallet.balance', () => {
  it('returns the current wallet balance', async () => {
    const fixture = walletBalanceFixture()
    server.use(http.get(`${BASE}/v1/wallet/balance`, () => HttpResponse.json(fixture)))

    const result = await makeClient().wallet.balance()

    expect(result).toEqual(fixture)
  })

  it('throws AuthError on 401', async () => {
    server.use(
      http.get(`${BASE}/v1/wallet/balance`, () =>
        HttpResponse.json(errorResponseFixture(1001, 'Authentication required'), { status: 401 }),
      ),
    )

    await expect(makeClient().wallet.balance()).rejects.toThrow(AuthError)
  })
})

// ---------------------------------------------------------------------------
// wallet.transactions
// ---------------------------------------------------------------------------

describe('wallet.transactions', () => {
  it('returns a list of transactions', async () => {
    const fixture = [
      walletTransactionFixture(),
      walletTransactionFixture({ id: 'txn-id-2', type: 'debit' }),
    ]
    server.use(http.get(`${BASE}/v1/wallet/transactions`, () => HttpResponse.json(fixture)))

    const result = await makeClient().wallet.transactions()

    expect(result).toEqual(fixture)
    expect(result).toHaveLength(2)
  })

  it('returns an empty list when no transactions exist', async () => {
    server.use(http.get(`${BASE}/v1/wallet/transactions`, () => HttpResponse.json([])))

    const result = await makeClient().wallet.transactions()

    expect(result).toEqual([])
  })

  it('throws AuthError on 401', async () => {
    server.use(
      http.get(`${BASE}/v1/wallet/transactions`, () =>
        HttpResponse.json(errorResponseFixture(1001, 'Authentication required'), { status: 401 }),
      ),
    )

    await expect(makeClient().wallet.transactions()).rejects.toThrow(AuthError)
  })
})

// ---------------------------------------------------------------------------
// wallet.createPaymentSession
// ---------------------------------------------------------------------------

describe('wallet.createPaymentSession', () => {
  it('returns the payment session details', async () => {
    const fixture = walletPaymentSessionFixture()
    server.use(http.post(`${BASE}/v1/wallet/payment-session`, () => HttpResponse.json(fixture)))

    const result = await makeClient().wallet.createPaymentSession({
      amount_cents: 5000,
      currency: 'usd',
    })

    expect(result).toEqual(fixture)
  })

  it('returns session with client_secret, session_id, and public_key', async () => {
    const fixture = walletPaymentSessionFixture()
    server.use(http.post(`${BASE}/v1/wallet/payment-session`, () => HttpResponse.json(fixture)))

    const result = await makeClient().wallet.createPaymentSession({
      amount_cents: 5000,
      currency: 'usd',
    })

    expect(result.client_secret).toBe('pi_test_secret')
    expect(result.session_id).toBe('pi_test_session')
    expect(result.public_key).toBe('pk_test_pubkey')
  })

  it('throws AuthError on 401', async () => {
    server.use(
      http.post(`${BASE}/v1/wallet/payment-session`, () =>
        HttpResponse.json(errorResponseFixture(1001, 'Authentication required'), { status: 401 }),
      ),
    )

    await expect(
      makeClient().wallet.createPaymentSession({ amount_cents: 5000, currency: 'usd' }),
    ).rejects.toThrow(AuthError)
  })
})

// ---------------------------------------------------------------------------
// wallet.getPaymentStatus
// ---------------------------------------------------------------------------

describe('wallet.getPaymentStatus', () => {
  it('returns the payment status for a session', async () => {
    const fixture = walletPaymentStatusFixture()
    server.use(
      http.get(`${BASE}/v1/wallet/payment-status/pi_test_session`, () =>
        HttpResponse.json(fixture),
      ),
    )

    const result = await makeClient().wallet.getPaymentStatus('pi_test_session')

    expect(result).toEqual(fixture)
  })

  it('returns a pending status', async () => {
    const fixture = walletPaymentStatusFixture({ status: 'pending', balance_cents: 0 })
    server.use(
      http.get(`${BASE}/v1/wallet/payment-status/pi_pending`, () => HttpResponse.json(fixture)),
    )

    const result = await makeClient().wallet.getPaymentStatus('pi_pending')

    expect(result.status).toBe('pending')
  })

  it('throws AuthError on 401', async () => {
    server.use(
      http.get(`${BASE}/v1/wallet/payment-status/pi_bad`, () =>
        HttpResponse.json(errorResponseFixture(1001, 'Authentication required'), { status: 401 }),
      ),
    )

    await expect(makeClient().wallet.getPaymentStatus('pi_bad')).rejects.toThrow(AuthError)
  })
})
