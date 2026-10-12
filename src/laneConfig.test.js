import { describe, expect, it } from 'vitest'
import { TILE_CAPACITY } from './laneConfig.js'

// 22 PRs are queued after 1.2 s (the AI lane) and must each get a tile; 98 is the largest
// capacity the "exactly at capacity" scenario can reach (n - 1 pending after n ticks, up to tick 99).
const MIN_TILE_CAPACITY = 22
const MAX_TILE_CAPACITY = 98

describe('TILE_CAPACITY', () => {
  it('is between the smallest and largest capacity the scenarios allow', () => {
    expect(TILE_CAPACITY).toBeGreaterThanOrEqual(MIN_TILE_CAPACITY)
    expect(TILE_CAPACITY).toBeLessThanOrEqual(MAX_TILE_CAPACITY)
  })
})
