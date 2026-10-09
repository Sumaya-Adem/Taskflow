import { useCallback, useMemo, useRef, useState } from 'react'
import { PageHeader } from '../components/layout/PageHeader.jsx'
import { TaskFormDialog } from '../components/tasks/TaskFormDialog.jsx'
import { TaskList } from '../components/tasks/TaskList.jsx'
import { Button } from '../components/ui/Button.jsx'
import { ConfirmDialog } from '../components/ui/ConfirmDialog.jsx'
import { EmptyState } from '../components/ui/EmptyState.jsx'
import { Icon } from '../components/ui/Icon.jsx'
import { Toast } from '../components/ui/Toast.jsx'
import { DEFAULT_SORT } from '../config/constants.js'
import { sortTasks } from '../domain/selectors.js'
import { useTasks } from '../state/useTasks.js'

const DIALOG = Object.freeze({ CREATE: 'create', EDIT: 'edit', DELETE: 'delete' })

/**
 * My Tasks: the task list plus create, edit, complete/reopen and delete
 * flows. All changes go through useTasks(); this component only manages
 * which dialog is open and the feedback shown afterwards.
 */
export function TasksPage({ route }) {
  const { tasks, addTask, updateTask, toggleTaskCompleted, deleteTask } = useTasks()
  // { type: DIALOG.*, task?: Task }. The task is a snapshot taken when the dialog opened.
  const [dialog, setDialog] = useState(null)
  const [toast, setToast] = useState(null)
  const toastIdRef = useRef(0)

  const visibleTasks = useMemo(() => sortTasks(tasks, DEFAULT_SORT), [tasks])
  const now = new Date()

  const notify = useCallback((message, tone = 'success') => {
    toastIdRef.current += 1
    setToast({ id: toastIdRef.current, message, tone })
  }, [])
  const dismissToast = useCallback(() => setToast(null), [])
  const closeDialog = () => setDialog(null)
  const openCreateDialog = () => setDialog({ type: DIALOG.CREATE })

  const handleCreate = (values) => {
    const result = addTask(values)
    if (result.ok) {
      closeDialog()
      notify(`Task "${result.task.title}" created.`)
    }
    return result
  }

  const handleUpdate = (values) => {
    const result = updateTask(dialog.task.id, values)
    if (result.ok) {
      closeDialog()
      notify('Changes saved.')
    }
    return result
  }

  const handleToggle = (task) => {
    const result = toggleTaskCompleted(task.id)
    if (result.ok) notify(task.completed ? `"${task.title}" reopened.` : `"${task.title}" completed.`)
    else notify(result.errors.form, 'error')
  }

  const handleConfirmDelete = () => {
    const { task } = dialog
    const result = deleteTask(task.id)
    closeDialog()
    if (result.ok) notify(`Task "${task.title}" deleted.`)
    else notify(result.errors.form, 'error')
  }

  const newTaskButton = (
    <Button onClick={openCreateDialog}>
      <Icon name="plus" size={18} />
      New task
    </Button>
  )

  return (
    <>
      <PageHeader title={route.title} description={route.description} actions={tasks.length > 0 && newTaskButton} />

      {tasks.length === 0 ? (
        <EmptyState
          icon="inbox"
          title="No tasks yet"
          message="Add your first task to start organizing your work and personal to-dos."
          action={
            <Button onClick={openCreateDialog}>
              <Icon name="plus" size={18} />
              Create your first task
            </Button>
          }
        />
      ) : (
        <TaskList
          tasks={visibleTasks}
          now={now}
          onToggle={handleToggle}
          onEdit={(task) => setDialog({ type: DIALOG.EDIT, task })}
          onDelete={(task) => setDialog({ type: DIALOG.DELETE, task })}
        />
      )}

      {dialog?.type === DIALOG.CREATE && <TaskFormDialog onSubmit={handleCreate} onClose={closeDialog} />}
      {dialog?.type === DIALOG.EDIT && (
        <TaskFormDialog task={dialog.task} onSubmit={handleUpdate} onClose={closeDialog} />
      )}
      {dialog?.type === DIALOG.DELETE && (
        <ConfirmDialog
          title="Delete task?"
          message={`"${dialog.task.title}" will be permanently deleted. This cannot be undone.`}
          confirmLabel="Delete task"
          onConfirm={handleConfirmDelete}
          onCancel={closeDialog}
        />
      )}

      <Toast toast={toast} onDismiss={dismissToast} />
    </>
  )
}
