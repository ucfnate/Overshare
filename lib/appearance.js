export const CAMPFIRE_THEME = 'campfire'
export const DEFAULT_CAMPFIRE_PALETTE = 'ember'
export const CAMPFIRE_PALETTE_STORAGE_KEY = 'overshare-campfire-palette'

export const CAMPFIRE_PALETTES = {
  ember: {
    name: 'Ember',
    description: 'Warm cream, flame orange, and golden light.',
    swatches: ['#fff4df', '#ef6b42', '#f3b94f'],
  },
  grove: {
    name: 'Grove',
    description: 'Soft sage, forest green, and sun-warmed ochre.',
    swatches: ['#edf3e5', '#2f6d50', '#d8a43d'],
  },
  moonlight: {
    name: 'Moonlight',
    description: 'Deep indigo, lavender, and a rose-colored glow.',
    swatches: ['#1d2038', '#8f86db', '#d96d90'],
  },
}

const LEGACY_PALETTE_MAP = {
  sunset: 'ember',
  vapor: 'ember',
  ocean: 'grove',
  plain: 'grove',
  dusk: 'moonlight',
  slate: 'moonlight',
}

export function normalizeCampfirePalette(value) {
  if (value && CAMPFIRE_PALETTES[value]) return value
  return LEGACY_PALETTE_MAP[value] || DEFAULT_CAMPFIRE_PALETTE
}

export function getStoredCampfirePalette(storage) {
  try {
    const saved = storage?.getItem(CAMPFIRE_PALETTE_STORAGE_KEY)
    if (saved) return normalizeCampfirePalette(saved)
    return normalizeCampfirePalette(storage?.getItem('bgTheme'))
  } catch {
    return DEFAULT_CAMPFIRE_PALETTE
  }
}

export function applyCampfirePalette(value, { storage, root } = {}) {
  const palette = normalizeCampfirePalette(value)
  try { storage?.setItem(CAMPFIRE_PALETTE_STORAGE_KEY, palette) } catch {}
  if (root?.dataset) {
    root.dataset.overshareTheme = CAMPFIRE_THEME
    root.dataset.oversharePalette = palette
  }
  return palette
}
