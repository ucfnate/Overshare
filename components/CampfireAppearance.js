'use client'

import { useCallback, useSyncExternalStore } from 'react'
import {
  CAMPFIRE_PALETTES,
  DEFAULT_CAMPFIRE_PALETTE,
  applyCampfirePalette,
  getStoredCampfirePalette,
  normalizeCampfirePalette,
} from '../lib/appearance'

const PALETTE_CHANGE_EVENT = 'overshare-palette-change'

function getClientPalette() {
  return getStoredCampfirePalette(window.localStorage)
}

function subscribeToPalette(listener) {
  const syncPalette = () => {
    const palette = getClientPalette()
    if (document.documentElement.dataset.oversharePalette !== palette) {
      document.documentElement.dataset.oversharePalette = palette
    }
    listener()
  }

  window.addEventListener('storage', syncPalette)
  window.addEventListener(PALETTE_CHANGE_EVENT, syncPalette)
  return () => {
    window.removeEventListener('storage', syncPalette)
    window.removeEventListener(PALETTE_CHANGE_EVENT, syncPalette)
  }
}

export function useCampfireAppearance() {
  const palette = useSyncExternalStore(
    subscribeToPalette,
    getClientPalette,
    () => DEFAULT_CAMPFIRE_PALETTE
  )

  const choosePalette = useCallback((value) => {
    const next = normalizeCampfirePalette(value)
    applyCampfirePalette(next, {
      storage: window.localStorage,
      root: document.documentElement,
    })
    window.dispatchEvent(new Event(PALETTE_CHANGE_EVENT))
  }, [])

  return { palette, choosePalette }
}

export function CampfirePalettePicker({ value, onChange, compact = false }) {
  if (compact) {
    return (
      <div className="campfire-palette-compact">
        <label htmlFor="campfire-palette-select">Colors</label>
        <select
          id="campfire-palette-select"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          {Object.entries(CAMPFIRE_PALETTES).map(([id, palette]) => (
            <option key={id} value={id}>{palette.name}</option>
          ))}
        </select>
      </div>
    )
  }

  return (
    <fieldset className="campfire-palette-picker">
      <legend>Choose your colors</legend>
      <div className="campfire-palette-grid">
        {Object.entries(CAMPFIRE_PALETTES).map(([id, palette]) => {
          const selected = value === id
          return (
            <button
              type="button"
              key={id}
              className="campfire-palette-option"
              aria-pressed={selected}
              onClick={() => onChange(id)}
            >
              <span className="campfire-swatches" aria-hidden="true">
                {palette.swatches.map(color => <span key={color} style={{ backgroundColor: color }} />)}
              </span>
              <span className="campfire-palette-name">{palette.name}</span>
              <span className="campfire-palette-description">{palette.description}</span>
              <span className="campfire-palette-check" aria-hidden="true">{selected ? '✓' : ''}</span>
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
