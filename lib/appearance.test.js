import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CAMPFIRE_PALETTE,
  applyCampfirePalette,
  getStoredCampfirePalette,
  normalizeCampfirePalette,
} from './appearance'

function createStorage(values = {}) {
  const data = new Map(Object.entries(values))
  return {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    read: key => data.get(key),
  }
}

describe('Campfire appearance', () => {
  it('uses Ember when no valid palette exists', () => {
    expect(normalizeCampfirePalette('unknown')).toBe(DEFAULT_CAMPFIRE_PALETTE)
    expect(getStoredCampfirePalette(createStorage())).toBe('ember')
  })

  it('migrates a legacy background to the nearest Campfire palette', () => {
    expect(getStoredCampfirePalette(createStorage({ bgTheme: 'ocean' }))).toBe('grove')
    expect(getStoredCampfirePalette(createStorage({ bgTheme: 'dusk' }))).toBe('moonlight')
  })

  it('persists and applies a normalized palette', () => {
    const storage = createStorage()
    const root = { dataset: {} }
    const palette = applyCampfirePalette('grove', { storage, root })

    expect(palette).toBe('grove')
    expect(storage.read('overshare-campfire-palette')).toBe('grove')
    expect(root.dataset).toEqual({
      overshareTheme: 'campfire',
      oversharePalette: 'grove',
    })
  })
})
