import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { THEMES } from '../config/constants.js'
import { isValidTheme } from '../domain/preferences.js'
import { applyTheme, getSystemTheme, subscribeToSystemTheme } from './theme.js'
import { ThemeContext } from './themeContext.js'

/**
 * Provides the theme preference (`system`, `light` or `dark`), the theme
 * actually in effect (`resolvedTheme`) and a setter that persists the choice.
 */
export function ThemeProvider({ preferenceStorage, initialPreferences, children }) {
  const [theme, setThemeState] = useState(initialPreferences.theme)
  const systemTheme = useSyncExternalStore(subscribeToSystemTheme, getSystemTheme, () => THEMES.LIGHT)

  // Synchronize the DOM (an external system) with the current preference.
  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const setTheme = useCallback(
    (nextTheme) => {
      if (!isValidTheme(nextTheme)) return
      setThemeState(nextTheme)
      // Best effort: if saving fails the theme still applies for this session.
      preferenceStorage.savePreferences({ theme: nextTheme })
    },
    [preferenceStorage],
  )

  const value = useMemo(
    () => ({ theme, resolvedTheme: theme === THEMES.SYSTEM ? systemTheme : theme, setTheme }),
    [theme, systemTheme, setTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
