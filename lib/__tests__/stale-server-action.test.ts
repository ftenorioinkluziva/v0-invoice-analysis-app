import { describe, expect, it } from 'vitest'
import {
  isServerActionRequest,
  isStaleServerActionError,
  isStaleServerActionResponse,
} from '@/lib/stale-server-action'

describe('stale server action detection', () => {
  it('detects the Next.js action header regardless of casing', () => {
    expect(isServerActionRequest('/api/action', { headers: { 'Next-Action': 'old-id' } })).toBe(true)
    expect(isServerActionRequest('/api/action', { method: 'POST' })).toBe(false)
  })

  it('only treats an action response as stale when it contains the Next error', () => {
    expect(isStaleServerActionResponse(500, 'Failed to find Server Action "x"')).toBe(true)
    expect(isStaleServerActionResponse(303, 'Failed to find Server Action "x"')).toBe(true)
    expect(isStaleServerActionResponse(303, 'normal redirect')).toBe(false)
    expect(isStaleServerActionResponse(401, 'Failed to find Server Action "x"')).toBe(false)
  })

  it('detects stale action errors surfaced as rejected promises', () => {
    expect(isStaleServerActionError(new Error('Failed to find Server Action "x"'))).toBe(true)
    expect(isStaleServerActionError(new Error('Unauthorized'))).toBe(false)
  })
})
