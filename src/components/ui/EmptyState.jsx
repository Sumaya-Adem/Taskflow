import { Icon } from './Icon.jsx'
import styles from './EmptyState.module.css'

/** Friendly placeholder for sections without content, with an optional call to action. */
export function EmptyState({ icon = 'inbox', title, message, action, headingLevel = 2 }) {
  const Heading = `h${headingLevel}`
  return (
    <section className={styles.emptyState}>
      <span className={styles.iconWrap}>
        <Icon name={icon} size={28} />
      </span>
      <Heading className={styles.title}>{title}</Heading>
      {message && <p className={styles.message}>{message}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </section>
  )
}
