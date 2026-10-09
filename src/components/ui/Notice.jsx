import { Button } from './Button.jsx'
import { Icon } from './Icon.jsx'
import styles from './Notice.module.css'

/**
 * Inline notification. Errors use role="alert" so they are announced
 * immediately; warnings use the politer role="status".
 */
export function Notice({ tone = 'warning', title, message, onDismiss }) {
  return (
    <div className={`${styles.notice} ${styles[tone] ?? ''}`} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon name="alert" className={styles.icon} />
      <div className={styles.body}>
        <p className={styles.title}>{title}</p>
        {message && <p className={styles.message}>{message}</p>}
      </div>
      {onDismiss && (
        <Button variant="ghost" iconOnly className={styles.dismiss} onClick={onDismiss} aria-label="Dismiss notification">
          <Icon name="close" size={16} />
        </Button>
      )}
    </div>
  )
}
