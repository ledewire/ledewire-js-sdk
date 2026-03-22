/**
 * Decode a base64-encoded string to plain UTF-8 text.
 *
 * Used internally by SDK response handlers to transparently decode
 * `content_body` and `teaser` fields from the API wire format.
 *
 * @internal
 */
export function decodeBase64(value: string): string {
  return atob(value)
}

/**
 * Encode a plain UTF-8 string to base64.
 *
 * Used internally by SDK request handlers to re-encode plain-text
 * `content_body` and `teaser` fields before they are sent to the API.
 *
 * @internal
 */
export function encodeBase64(value: string): string {
  return btoa(value)
}

/**
 * Decode base64-encoded `content_body` and `teaser` fields on a content
 * response object.  Works with both `ContentResponse` (which may carry
 * `content_body`) and `ContentListItem` (which only carries `teaser`).
 * Null and absent fields are left untouched.
 *
 * @internal
 */
export function decodeContentFields<
  T extends { content_body?: string | null; teaser?: string | null },
>(item: T): T {
  return {
    ...item,
    ...(typeof item.content_body === 'string' && {
      content_body: decodeBase64(item.content_body),
    }),
    ...(typeof item.teaser === 'string' && { teaser: decodeBase64(item.teaser) }),
  } as T
}

/**
 * Encode plain-text `content_body` and `teaser` fields to base64 before
 * they are sent to the API.  Absent and undefined fields are left untouched.
 *
 * @internal
 */
export function encodeContentFields(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...body }
  if (typeof out['content_body'] === 'string')
    out['content_body'] = encodeBase64(out['content_body'])
  if (typeof out['teaser'] === 'string') out['teaser'] = encodeBase64(out['teaser'])
  return out
}
