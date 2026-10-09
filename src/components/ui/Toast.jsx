import { useEffect } from 'react'
import { Button } from './Button.jsx'
import { Icon } from './Icon.jsx'
import styles from './Toast.module.css'

export const TOAST_DURATION_MS = 5000

/**
 * Brief feedback message. The live region is always rendered so screen
 * readers announce each new message; the toast hides itself after a delay.
 * Pass a new `toast.id` to show (and re-announce) a message.
 */
export function Toast({ toast, onDismiss, duration = TOAST_DURATION_MS }) {
  useEffect(() => {
    if (!toast) return undefined
    const timer = setTimeout(onDismiss, duration)
    return () => clearTimeout(timer)
  }, [toast, onDismiss, duration])

  return (
    <div className={styles.region} role="status" aria-live="polite" aria-label="Notifications">
      {toast && (
        <div key={toast.id} className={`${styles.toast} ${styles[toast.tone] ?? ''}`}>
          <Icon name={toast.tone === 'success' || !toast.tone ? 'checkCircle' : 'alert'} size={18} className={styles.icon} />
          <p className={styles.message}>{toast.message}</p>
          <Button variant="ghost" iconOnly className={styles.dismiss} onClick={onDismiss} aria-label="Dismiss message">
            <Icon name="close" size={16} />
          </Button>
        </div>
      )}
    </div>
  )
}
