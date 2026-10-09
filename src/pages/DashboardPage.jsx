import { useMemo } from 'react'
import { PageHeader } from '../components/layout/PageHeader.jsx'
import { Button } from '../components/ui/Button.jsx'
import { EmptyState } from '../components/ui/EmptyState.jsx'
import { Panel } from '../components/ui/Panel.jsx'
import { computeStats } from '../domain/stats.js'
import { ROUTES, getRouteHref } from '../navigation/routes.js'
import { useTasks } from '../state/useTasks.js'

const TASKS_ROUTE = ROUTES.find((route) => route.id === 'tasks')

export function DashboardPage({ route }) {
  const { tasks } = useTasks()
  const stats = useMemo(() => computeStats(tasks), [tasks])

  return (
    <>
      <PageHeader title={route.title} description={route.description} />
      {stats.total === 0 ? (
        <EmptyState
          icon="chart"
          title="Nothing to report yet"
          message="Once you add tasks, your progress and upcoming deadlines will appear here."
          action={<Button href={getRouteHref(TASKS_ROUTE)}>Go to My Tasks</Button>}
        />
      ) : (
        <Panel title="Overview" description="Detailed statistics and charts will appear here.">
          <p>
            You have {stats.total} {stats.total === 1 ? 'task' : 'tasks'}: {stats.active} active and{' '}
            {stats.completed} completed.
          </p>
        </Panel>
      )}
    </>
  )
}
