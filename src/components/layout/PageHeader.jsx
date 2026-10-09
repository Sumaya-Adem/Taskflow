import styles from './PageHeader.module.css'

/**
 * Page title block. The heading is focusable (tabIndex -1) so the app shell
 * can move focus to it after navigation, announcing the new page to
 * screen-reader users.
 */
export function PageHeader({ title, description, actions }) {
  return (
    <div className={styles.pageHeader}>
      <div>
        <h1 className={styles.title} tabIndex={-1}>
          {title}
        </h1>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  )
}
