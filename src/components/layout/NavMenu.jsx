import { ROUTES, getRouteHref } from '../../navigation/routes.js'
import { Icon } from '../ui/Icon.jsx'
import styles from './NavMenu.module.css'

/** Primary navigation. One list serves as the desktop sidebar menu and the mobile tab bar. */
export function NavMenu({ activeRouteId }) {
  return (
    <nav aria-label="Main">
      <ul className={styles.list}>
        {ROUTES.map((route) => (
          <li key={route.id}>
            <a
              href={getRouteHref(route)}
              className={styles.link}
              aria-current={route.id === activeRouteId ? 'page' : undefined}
            >
              <Icon name={route.icon} />
              <span>{route.label}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
