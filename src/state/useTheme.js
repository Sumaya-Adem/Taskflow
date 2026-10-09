import { useContext } from 'react'
import { ThemeContext } from './themeContext.js'

/** Theme preference and setter. Must be used inside <ThemeProvider>. */
export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within a ThemeProvider')
  return context
}
