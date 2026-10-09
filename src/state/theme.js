/** Browser helpers for theming (no React). */

import { THEMES } from '../config/constants.js'

const DARK_SCHEME_QUERY = '(prefers-color-scheme: dark)'

function getDarkSchemeQuery() {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(DARK_SCHEME_QUERY)
    : null
}

/** `useSyncExternalStore` subscription to the OS color-scheme setting. */
export function subscribeToSystemTheme(onChange) {
  const query = getDarkSchemeQuery()
  if (!query) return () => {}
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

/** The OS color scheme; light when it cannot be detected. */
export function getSystemTheme() {
  return getDarkSchemeQuery()?.matches ? THEMES.DARK : THEMES.LIGHT
}

/**
 * Applies a theme preference to the root element. An explicit choice sets
 * `data-theme`; "system" removes it so CSS follows `prefers-color-scheme`.
 * Mirrors the inline script in index.html that runs before first paint.
 */
export function applyTheme(theme, root = document.documentElement) {
  if (theme === THEMES.LIGHT || theme === THEMES.DARK) root.dataset.theme = theme
  else delete root.dataset.theme
}
