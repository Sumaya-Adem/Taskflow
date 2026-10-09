import { Icon } from './Icon.jsx'
import styles from './Badge.module.css'

/** Small status label. Tone adds color, but the text always carries the meaning. */
export function Badge({ tone = 'neutral', icon, children }) {
  return (
    <span className={`${styles.badge} ${styles[tone] ?? styles.neutral}`}>
      {icon && <Icon name={icon} size={12} />}
      {children}
    </span>
  )
}
