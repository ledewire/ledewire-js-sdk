import { describe, it, expect } from 'vitest'
import { SpendCapReachedError } from './errors.js'
import { spendCapErrorFromBody } from './spend-cap.js'

describe('spendCapErrorFromBody', () => {
  it('builds a SpendCapReachedError from a well-formed daily-spend-cap-reached body', () => {
    const body = {
      error: { code: 402, message: 'Daily spend cap reached.', type: 'daily_spend_cap_reached' },
      cap_cents: 5000,
      spent_cents: 4000,
      remaining_cents: 1000,
      resets_at: '2099-01-02T00:00:00Z',
      bulk_exempt: true,
    }

    const err = spendCapErrorFromBody(body)

    expect(err).toBeInstanceOf(SpendCapReachedError)
    expect(err?.message).toBe('Daily spend cap reached.')
    expect(err?.code).toBe(402)
    expect(err?.capCents).toBe(5000)
    expect(err?.spentCents).toBe(4000)
    expect(err?.remainingCents).toBe(1000)
    expect(err?.resetsAt).toBe('2099-01-02T00:00:00Z')
    expect(err?.bulkExempt).toBe(true)
  })

  it('falls back to a default message and undefined code when absent', () => {
    const body = {
      error: { type: 'daily_spend_cap_reached' },
      cap_cents: 100,
      spent_cents: 100,
      remaining_cents: 0,
      resets_at: '2099-01-01T00:00:00Z',
      bulk_exempt: false,
    }

    const err = spendCapErrorFromBody(body)

    expect(err?.message).toBe('Daily spend cap reached.')
    expect(err?.code).toBeUndefined()
  })

  it("falls back to the body's top-level remedy message when the envelope has none", () => {
    const body = {
      error: { type: 'daily_spend_cap_reached' },
      cap_cents: 1000,
      spent_cents: 1000,
      remaining_cents: 0,
      resets_at: '2099-01-01T00:00:00Z',
      bulk_exempt: false,
      message: 'Ask a Company admin to raise your daily spend cap.',
    }

    const err = spendCapErrorFromBody(body)

    expect(err?.message).toBe('Ask a Company admin to raise your daily spend cap.')
  })

  it('returns null for a body with a different error.type', () => {
    expect(spendCapErrorFromBody({ error: { type: 'insufficient_funds' } })).toBeNull()
  })

  it('returns null when error.type is absent', () => {
    expect(spendCapErrorFromBody({ error: {} })).toBeNull()
  })

  it('returns null when there is no error field', () => {
    expect(spendCapErrorFromBody({ cap_cents: 100 })).toBeNull()
  })

  it('returns null for null, undefined, and non-object bodies', () => {
    expect(spendCapErrorFromBody(null)).toBeNull()
    expect(spendCapErrorFromBody(undefined)).toBeNull()
    expect(spendCapErrorFromBody('not an object')).toBeNull()
  })

  it('returns null when a numeric field is missing, rather than producing NaN', () => {
    const body = {
      error: { type: 'daily_spend_cap_reached' },
      cap_cents: 100,
      spent_cents: 100,
      // remaining_cents missing
      resets_at: '2099-01-01T00:00:00Z',
      bulk_exempt: false,
    }
    expect(spendCapErrorFromBody(body)).toBeNull()
  })

  it('returns null when resets_at is missing, rather than producing the string "undefined"', () => {
    const body = {
      error: { type: 'daily_spend_cap_reached' },
      cap_cents: 100,
      spent_cents: 100,
      remaining_cents: 0,
      // resets_at missing
      bulk_exempt: false,
    }
    expect(spendCapErrorFromBody(body)).toBeNull()
  })

  it('returns null when bulk_exempt is missing or the wrong type', () => {
    const body = {
      error: { type: 'daily_spend_cap_reached' },
      cap_cents: 100,
      spent_cents: 100,
      remaining_cents: 0,
      resets_at: '2099-01-01T00:00:00Z',
      // bulk_exempt missing
    }
    expect(spendCapErrorFromBody(body)).toBeNull()
  })
})
