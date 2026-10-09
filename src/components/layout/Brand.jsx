import { DEFAULT_ROUTE, getRouteHref } from '../../navigation/routes.js'
import styles from './Brand.module.css'

/** TaskFlow logo and wordmark; links to the default section. */
export function Brand({ className }) {
  return (
    <a href={getRouteHref(DEFAULT_ROUTE)} className={`${styles.brand} ${className ?? ''}`} aria-label="TaskFlow home">
      <svg className={styles.mark} width="28" height="28" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
        <rect width="32" height="32" rx="8" fill="currentColor" />
        <path
          d="M9 16.5l4.5 4.5L23 11"
          fill="none"
          stroke="var(--color-on-primary)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span aria-hidden="true">TaskFlow</span>
    </a>
  )
}
