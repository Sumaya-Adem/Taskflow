import { PageHeader } from '../components/layout/PageHeader.jsx'
import { Icon } from '../components/ui/Icon.jsx'
import { Panel } from '../components/ui/Panel.jsx'
import { THEME_OPTIONS } from '../config/constants.js'
import { LOAD_STATUS } from '../storage/storage.js'
import { useTasks } from '../state/useTasks.js'
import { useTheme } from '../state/useTheme.js'
import styles from './SettingsPage.module.css'

function getStorageStatus({ loadStatus, writable, saveError }) {
  if (loadStatus === LOAD_STATUS.UNAVAILABLE) return { ok: false, label: 'Unavailable: changes last until you close this tab' }
  if (!writable) return { ok: false, label: 'Paused to protect saved data' }
  if (saveError) return { ok: false, label: 'Last save failed' }
  return { ok: true, label: 'Saving automatically in this browser' }
}

function ThemeSettings() {
  const { theme, setTheme } = useTheme()

  return (
    <Panel title="Appearance" description="Choose how TaskFlow looks on this device.">
      <fieldset className={styles.options}>
        <legend className="visually-hidden">Theme</legend>
        {THEME_OPTIONS.map((option) => (
          <label key={option.value} className={styles.option}>
            <input
              type="radio"
              name="theme"
              value={option.value}
              checked={theme === option.value}
              onChange={() => setTheme(option.value)}
            />
            <span className={styles.optionLabel}>{option.label}</span>
            <span className={styles.optionDescription}>{option.description}</span>
          </label>
        ))}
      </fieldset>
    </Panel>
  )
}

function StorageSettings() {
  const { tasks, persistence } = useTasks()
  const status = getStorageStatus(persistence)

  return (
    <Panel title="Data" description="TaskFlow stores your tasks locally in this browser. Nothing is sent to a server.">
      <dl className={styles.details}>
        <dt>Storage</dt>
        <dd>
          <Icon name={status.ok ? 'checkCircle' : 'alert'} size={16} className={status.ok ? styles.ok : styles.warning} />
          {status.label}
        </dd>
        <dt>Tasks</dt>
        <dd>{tasks.length}</dd>
      </dl>
    </Panel>
  )
}

export function SettingsPage({ route }) {
  return (
    <>
      <PageHeader title={route.title} description={route.description} />
      <ThemeSettings />
      <StorageSettings />
    </>
  )
}
