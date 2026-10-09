import { describe, expect, it } from 'vitest'
import { DEFAULT_PREFERENCES, isValidTheme, normalizePreferences } from './preferences.js'

describe('isValidTheme', () => {
  it.each(['system', 'light', 'dark'])('accepts %s', (theme) => {
    expect(isValidTheme(theme)).toBe(true)
  })

  it.each(['Dark', 'blue', '', null, undefined, 1])('rejects %p', (theme) => {
    expect(isValidTheme(theme)).toBe(false)
  })
})

describe('normalizePreferences', () => {
  it('keeps valid preferences and drops unknown keys', () => {
    expect(normalizePreferences({ theme: 'dark', extra: true })).toEqual({ theme: 'dark' })
  })

  it('falls back to defaults for invalid values', () => {
    expect(normalizePreferences({ theme: 'neon' })).toEqual(DEFAULT_PREFERENCES)
  })

  it.each([null, undefined, 'dark', 42, ['dark']])('returns defaults for non-object %p', (raw) => {
    expect(normalizePreferences(raw)).toEqual(DEFAULT_PREFERENCES)
  })
})
