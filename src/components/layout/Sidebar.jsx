import { Brand } from './Brand.jsx'
import { NavMenu } from './NavMenu.jsx'
import styles from './Sidebar.module.css'

/** Desktop sidebar (brand + navigation); a bottom tab bar on small screens. */
export function Sidebar({ activeRouteId }) {
  return (
    <aside className={styles.sidebar}>
      <Brand className={styles.brand} />
      <NavMenu activeRouteId={activeRouteId} />
    </aside>
  )
}
