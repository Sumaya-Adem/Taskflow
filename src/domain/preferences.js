/**
 * User preferences model. Preferences are small and non-critical, so invalid
 * values simply fall back to defaults.
 */

import { DEFAULT_THEME, THEMES } from '../config/constants.js'

const THEME_VALUES = new Set(Object.values(THEMES))

export const DEFAULT_PREFERENCES = Object.freeze({ theme: DEFAULT_THEME })

export function isValidTheme(value) {
  return THEME_VALUES.has(value)
}

/** Converts an untrusted value into a complete, valid preferences object. */
export function normalizePreferences(raw) {
  const source = raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  return {
    theme: isValidTheme(source.theme) ? source.theme : DEFAULT_PREFERENCES.theme,
  }
}
