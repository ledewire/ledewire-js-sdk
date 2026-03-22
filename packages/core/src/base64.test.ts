import { describe, it, expect } from 'vitest'
import { decodeBase64, encodeBase64, decodeContentFields, encodeContentFields } from './base64.js'

// ---------------------------------------------------------------------------
// decodeBase64 / encodeBase64
// ---------------------------------------------------------------------------

describe('decodeBase64', () => {
  it('decodes a base64 string to plain text', () => {
    expect(decodeBase64(btoa('# Hello World'))).toBe('# Hello World')
  })

  it('round-trips with encodeBase64', () => {
    const plain = 'Some markdown text\nWith newlines.'
    expect(decodeBase64(encodeBase64(plain))).toBe(plain)
  })
})

describe('encodeBase64', () => {
  it('encodes plain text to base64', () => {
    expect(encodeBase64('hello')).toBe(btoa('hello'))
  })
})

// ---------------------------------------------------------------------------
// decodeContentFields
// ---------------------------------------------------------------------------

describe('decodeContentFields', () => {
  it('decodes content_body when present', () => {
    const input = { content_body: btoa('# Title'), teaser: null }
    expect(decodeContentFields(input).content_body).toBe('# Title')
  })

  it('decodes teaser when present', () => {
    const input = { content_body: null, teaser: btoa('A short teaser.') }
    expect(decodeContentFields(input).teaser).toBe('A short teaser.')
  })

  it('decodes both fields when both are strings', () => {
    const input = { content_body: btoa('body'), teaser: btoa('teaser') }
    const result = decodeContentFields(input)
    expect(result.content_body).toBe('body')
    expect(result.teaser).toBe('teaser')
  })

  it('leaves content_body untouched when null', () => {
    const input = { content_body: null, teaser: btoa('t') }
    expect(decodeContentFields(input).content_body).toBeNull()
  })

  it('leaves teaser untouched when null', () => {
    const input = { content_body: btoa('b'), teaser: null }
    expect(decodeContentFields(input).teaser).toBeNull()
  })

  it('leaves teaser untouched when undefined', () => {
    const input: { content_body: null; teaser?: string | null } = { content_body: null }
    expect(decodeContentFields(input).teaser).toBeUndefined()
  })

  it('preserves all other fields unchanged', () => {
    const input = {
      id: 'abc',
      content_type: 'markdown' as const,
      title: 'Test',
      content_body: btoa('body'),
      teaser: btoa('teaser'),
      price_cents: 500,
    }
    const result = decodeContentFields(input)
    expect(result.id).toBe('abc')
    expect(result.content_type).toBe('markdown')
    expect(result.title).toBe('Test')
    expect(result.price_cents).toBe(500)
  })

  it('does not mutate the original object', () => {
    const input = { content_body: btoa('body'), teaser: btoa('teaser') }
    decodeContentFields(input)
    expect(input.content_body).toBe(btoa('body'))
    expect(input.teaser).toBe(btoa('teaser'))
  })
})

// ---------------------------------------------------------------------------
// encodeContentFields
// ---------------------------------------------------------------------------

describe('encodeContentFields', () => {
  it('encodes content_body when present', () => {
    const result = encodeContentFields({ content_body: '# Title', teaser: undefined })
    expect(result['content_body']).toBe(btoa('# Title'))
  })

  it('encodes teaser when present', () => {
    const result = encodeContentFields({ teaser: 'A teaser.' })
    expect(result['teaser']).toBe(btoa('A teaser.'))
  })

  it('encodes both fields when both are provided', () => {
    const result = encodeContentFields({ content_body: 'body', teaser: 'teaser' })
    expect(result['content_body']).toBe(btoa('body'))
    expect(result['teaser']).toBe(btoa('teaser'))
  })

  it('leaves content_body untouched when undefined', () => {
    const result = encodeContentFields({ title: 'Hello' })
    expect(result['content_body']).toBeUndefined()
  })

  it('leaves teaser untouched when undefined', () => {
    const result = encodeContentFields({ title: 'Hello' })
    expect(result['teaser']).toBeUndefined()
  })

  it('preserves all other fields unchanged', () => {
    const result = encodeContentFields({
      content_type: 'markdown',
      title: 'My Post',
      content_body: 'body',
      price_cents: 500,
    })
    expect(result['content_type']).toBe('markdown')
    expect(result['title']).toBe('My Post')
    expect(result['price_cents']).toBe(500)
  })

  it('does not mutate the original object', () => {
    const input = { content_body: 'body', teaser: 'teaser' }
    encodeContentFields(input)
    expect(input.content_body).toBe('body')
    expect(input.teaser).toBe('teaser')
  })

  it('round-trips with decodeContentFields', () => {
    const original = { content_body: '# Hello\n\nWorld', teaser: 'A teaser.' }
    const encoded = encodeContentFields(original as Record<string, unknown>)
    const decoded = decodeContentFields(
      encoded as { content_body?: string | null; teaser?: string | null },
    )
    expect(decoded.content_body).toBe(original.content_body)
    expect(decoded.teaser).toBe(original.teaser)
  })
})
