import { describe, expect, it } from 'vitest'

import { buildSearchPatterns } from '@/lib/search'

describe('buildSearchPatterns', () => {
  it('creates one partial-match pattern for each search word', () => {
    expect(buildSearchPatterns('arroz branco')).toEqual(['%arroz%', '%branco%'])
  })

  it('ignores extra whitespace between words', () => {
    expect(buildSearchPatterns('  leite   em\tpo  ')).toEqual(['%leite%', '%em%', '%po%'])
  })

  it('returns no patterns for a blank search', () => {
    expect(buildSearchPatterns('   ')).toEqual([])
  })
})
