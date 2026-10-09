import { useId } from 'react'
import styles from './Panel.module.css'

/** A titled content card. The section is labelled by its heading. */
export function Panel({ title, description, children }) {
  const headingId = useId()
  return (
    <section className={styles.panel} aria-labelledby={headingId}>
      <div>
        <h2 id={headingId} className={styles.title}>
          {title}
        </h2>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {children}
    </section>
  )
}
