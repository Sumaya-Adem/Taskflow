import { PageHeader } from '../components/layout/PageHeader.jsx'
import { EmptyState } from '../components/ui/EmptyState.jsx'
import { Panel } from '../components/ui/Panel.jsx'
import { useTasks } from '../state/useTasks.js'

export function TasksPage({ route }) {
  const { tasks } = useTasks()

  return (
    <>
      <PageHeader title={route.title} description={route.description} />
      {tasks.length === 0 ? (
        <EmptyState
          icon="inbox"
          title="No tasks yet"
          message="Your task list is empty. Tasks you add will appear here."
        />
      ) : (
        <Panel title="Your tasks" description="The full task list with editing tools will appear here.">
          <p>
            {tasks.length} {tasks.length === 1 ? 'task is' : 'tasks are'} saved in this browser.
          </p>
        </Panel>
      )}
    </>
  )
}
