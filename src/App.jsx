import { AppShell } from './components/layout/AppShell.jsx'
import { ErrorBoundary } from './components/ui/ErrorBoundary.jsx'
import { useHashRoute } from './navigation/useHashRoute.js'
import { DashboardPage } from './pages/DashboardPage.jsx'
import { SettingsPage } from './pages/SettingsPage.jsx'
import { TasksPage } from './pages/TasksPage.jsx'
import { TasksProvider } from './state/TasksProvider.jsx'
import { ThemeProvider } from './state/ThemeProvider.jsx'

const PAGES = {
  dashboard: DashboardPage,
  tasks: TasksPage,
  settings: SettingsPage,
}

function CurrentPage() {
  const route = useHashRoute()
  const Page = PAGES[route.id]
  return (
    <AppShell route={route}>
      <Page route={route} />
    </AppShell>
  )
}

/** Root component. `services` comes from `createAppServices()` (see main.jsx). */
function App({ services }) {
  return (
    <ErrorBoundary>
      <ThemeProvider
        preferenceStorage={services.preferenceStorage}
        initialPreferences={services.initialPreferences}
      >
        <TasksProvider storage={services.taskStorage} initialLoad={services.initialTaskLoad}>
          <CurrentPage />
        </TasksProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}

export default App
