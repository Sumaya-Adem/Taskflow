import { useEffect, useRef } from 'react'
import { AppHeader } from './AppHeader.jsx'
import { Sidebar } from './Sidebar.jsx'
import { StorageNotice } from './StorageNotice.jsx'
import styles from './AppShell.module.css'

const APP_NAME = 'TaskFlow'

/**
 * Overall page layout: skip link, sidebar navigation, header and main area.
 * Keeps the document title in sync with the active route and, after
 * navigation (not on first load), moves focus to the new page heading.
 */
export function AppShell({ route, children }) {
  const mainRef = useRef(null)
  const previousRouteIdRef = useRef(route.id)

  useEffect(() => {
    document.title = `${route.title} · ${APP_NAME}`
  }, [route.title])

  useEffect(() => {
    if (previousRouteIdRef.current === route.id) return
    previousRouteIdRef.current = route.id
    mainRef.current?.querySelector('h1')?.focus()
  }, [route.id])

  // The skip link must not change the URL hash, which drives routing.
  const handleSkipToContent = (event) => {
    event.preventDefault()
    mainRef.current?.focus()
  }

  return (
    <div className={styles.shell}>
      <a href="#main-content" className={styles.skipLink} onClick={handleSkipToContent}>
        Skip to main content
      </a>
      <Sidebar activeRouteId={route.id} />
      <div className={styles.column}>
        <AppHeader />
        <main id="main-content" ref={mainRef} tabIndex={-1} className={styles.main}>
          <StorageNotice />
          {children}
        </main>
      </div>
    </div>
  )
}
