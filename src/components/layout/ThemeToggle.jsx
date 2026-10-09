import { THEMES } from '../../config/constants.js'
import { useTheme } from '../../state/useTheme.js'
import { Button } from '../ui/Button.jsx'
import { Icon } from '../ui/Icon.jsx'

/** Quick switch between light and dark. The full choice, including "System", lives in Settings. */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const nextTheme = resolvedTheme === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK

  return (
    <Button
      variant="ghost"
      iconOnly
      onClick={() => setTheme(nextTheme)}
      aria-label={`Switch to ${nextTheme} theme`}
      title={`Switch to ${nextTheme} theme`}
    >
      <Icon name={nextTheme === THEMES.DARK ? 'moon' : 'sun'} />
    </Button>
  )
}
