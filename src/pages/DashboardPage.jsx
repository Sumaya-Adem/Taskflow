import { useMemo, useState } from 'react'
import { CompletionProgress } from '../components/dashboard/CompletionProgress.jsx'
import { DeadlineList } from '../components/dashboard/DeadlineList.jsx'
import { PriorityBreakdown } from '../components/dashboard/PriorityBreakdown.jsx'
import { StatCards } from '../components/dashboard/StatCards.jsx'
import { PageHeader } from '../components/layout/PageHeader.jsx'
import { TaskFormDialog } from '../components/tasks/TaskFormDialog.jsx'
import { Button } from '../components/ui/Button.jsx'
import { EmptyState } from '../components/ui/EmptyState.jsx'
import { Icon } from '../components/ui/Icon.jsx'
import { describeOutcome } from '../components/tasks/taskFeedback.js'
import { Toast } from '../components/ui/Toast.jsx'
import { useToast } from '../components/ui/useToast.js'
import { getTodayKey, parseDateKey } from '../domain/dates.js'
import { selectOverdueTasks, selectUndatedActiveTasks, selectUpcomingTasks } from '../domain/selectors.js'
import { computeStats } from '../domain/stats.js'
import { ROUTES, getRouteHref } from '../navigation/routes.js'
import { useTasks } from '../state/useTasks.js'
import styles from './DashboardPage.module.css'

const TASKS_HREF = getRouteHref(ROUTES.find((route) => route.id === 'tasks'))

/**
 * Dashboard: headline counts, completion, priority spread and the overdue and
 * upcoming deadlines. Everything is derived on render from the live task
 * state via the domain layer; nothing here is stored. Creating and editing
 * reuse the My Tasks dialog and the useTasks() actions.
 */
export function DashboardPage({ route }) {
  const { tasks, addTask, updateTask } = useTasks()
  const [dialog, setDialog] = useState(null) // { task?: Task } while the form is open
  const { toast, notifyOutcome, dismissToast } = useToast()

  // Date-dependent values only change with the calendar day, so derive them
  // from local midnight and recompute when the day (or the tasks) change.
  const now = new Date()
  const todayKey = getTodayKey(now)
  const { stats, overdue, upcoming, undatedCount } = useMemo(() => {
    const today = parseDateKey(todayKey)
    return {
      stats: computeStats(tasks, { now: today }),
      overdue: selectOverdueTasks(tasks, { now: today }),
      upcoming: selectUpcomingTasks(tasks, { now: today }),
      undatedCount: selectUndatedActiveTasks(tasks).length,
    }
  }, [tasks, todayKey])

  const closeDialog = () => setDialog(null)
  const openCreateDialog = () => setDialog({})

  const handleSubmit = (values) => {
    const result = dialog.task ? updateTask(dialog.task.id, values) : addTask(values)
    if (result.ok) {
      closeDialog()
      const message = dialog.task ? (result.saved ? 'Changes saved.' : 'Task updated.') : `Task "${result.task.title}" created.`
      notifyOutcome(describeOutcome(message, result.saved))
    }
    return result
  }

  const newTaskButton = (
    <Button onClick={openCreateDialog}>
      <Icon name="plus" size={18} />
      New task
    </Button>
  )

  return (
    <>
      <PageHeader
        title={route.title}
        description={route.description}
        actions={
          stats.total > 0 && (
            <>
              <Button variant="secondary" href={TASKS_HREF}>
                View all tasks
              </Button>
              {newTaskButton}
            </>
          )
        }
      />

      <StatCards stats={stats} />

      {stats.total === 0 ? (
        <EmptyState
          icon="chart"
          title="Nothing to report yet"
          message="Once you add tasks, your progress and upcoming deadlines will appear here."
          action={
            <div className={styles.actions}>
              {newTaskButton}
              <Button variant="secondary" href={TASKS_HREF}>
                Go to My Tasks
              </Button>
            </div>
          }
        />
      ) : (
        <>
          <div className={styles.twoColumns}>
            <CompletionProgress stats={stats} />
            <PriorityBreakdown stats={stats} />
          </div>
          <div className={styles.twoColumns}>
            <DeadlineList
              title="Overdue"
              description="Active tasks past their due date, most overdue first."
              tasks={overdue}
              emptyMessage="Nothing overdue. You're on track."
              now={now}
              tasksHref={TASKS_HREF}
              onOpenTask={(task) => setDialog({ task })}
            />
            <DeadlineList
              title="Upcoming"
              description="Active tasks due today or later, soonest first."
              tasks={upcoming}
              emptyMessage="No upcoming deadlines."
              footerNote={
                undatedCount > 0
                  ? `${undatedCount} active ${undatedCount === 1 ? 'task has' : 'tasks have'} no due date`
                  : null
              }
              now={now}
              tasksHref={TASKS_HREF}
              onOpenTask={(task) => setDialog({ task })}
            />
          </div>
        </>
      )}

      {dialog && <TaskFormDialog task={dialog.task} onSubmit={handleSubmit} onClose={closeDialog} />}
      <Toast toast={toast} onDismiss={dismissToast} />
    </>
  )
}
