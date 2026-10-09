import { Brand } from './Brand.jsx'
import { ThemeToggle } from './ThemeToggle.jsx'
import styles from './AppHeader.module.css'

const dateFormatter = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' })

/** Top bar: brand on mobile (the sidebar shows it on desktop), today's date and global actions. */
export function AppHeader({ now = new Date() }) {
  return (
    <header className={styles.header}>
      <Brand className={styles.brand} />
      <p className={styles.today}>{dateFormatter.format(now)}</p>
      <div className={styles.actions}>
        <ThemeToggle />
      </div>
    </header>
  )
}
