import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { PageHeader } from '../components/layout/PageHeader.jsx'
import { TaskFormDialog } from '../components/tasks/TaskFormDialog.jsx'
import { TaskList } from '../components/tasks/TaskList.jsx'
import { TaskToolbar } from '../components/tasks/TaskToolbar.jsx'
import { Button } from '../components/ui/Button.jsx'
import { ConfirmDialog } from '../components/ui/ConfirmDialog.jsx'
import { EmptyState } from '../components/ui/EmptyState.jsx'
import { Icon } from '../components/ui/Icon.jsx'
import { Toast } from '../components/ui/Toast.jsx'
import { DEFAULT_FILTERS, DEFAULT_SORT } from '../config/constants.js'
import { getTodayKey, parseDateKey } from '../domain/dates.js'
import { hasActiveCriteria, selectVisibleTasks } from '../domain/selectors.js'
import { validateTaskInput } from '../domain/task.js'
import { VIEW_ACTIONS, initialTaskView, taskViewReducer } from '../state/taskViewReducer.js'
import { useTasks } from '../state/useTasks.js'

const DIALOG = Object.freeze({ CREATE: 'create', EDIT: 'edit', DELETE: 'delete' })
const HIDDEN_BY_VIEW_NOTE = ' It is hidden by your current search or filters.'

/**
 * My Tasks: the task list plus search/filter/sort and the create, edit,
 * complete/reopen and delete flows. Task changes go through useTasks(); the
 * view settings live in local state and only change what is displayed.
 */
export function TasksPage({ route }) {
  const { tasks, addTask, updateTask, toggleTaskCompleted, deleteTask } = useTasks()
  const [view, dispatchView] = useReducer(taskViewReducer, initialTaskView)
  // { type: DIALOG.*, task?: Task }. The task is a snapshot taken when the dialog opened.
  const [dialog, setDialog] = useState(null)
  const [toast, setToast] = useState(null)
  const toastIdRef = useRef(0)
  const listHeadingRef = useRef(null)
  const focusListAfterRenderRef = useRef(false)

  const now = new Date()
  // Due-date filters only depend on the calendar day, so the memo is keyed on
  // it and recomputes when the date changes (local midnight of the same day).
  const todayKey = getTodayKey(now)
  const visibleTasks = useMemo(
    () => selectVisibleTasks(tasks, view, { now: parseDateKey(todayKey) }),
    [tasks, view, todayKey],
  )
  const isFiltered = hasActiveCriteria(view.filters, view.query)

  // When a task leaves the filtered view (e.g. completed while showing "Active"),
  // its checkbox disappears; move focus to the list heading instead of losing it.
  useEffect(() => {
    if (!focusListAfterRenderRef.current) return
    focusListAfterRenderRef.current = false
    ;(listHeadingRef.current ?? document.querySelector('main h1'))?.focus()
  })

  const isInView = (task) => selectVisibleTasks([task], view, { now }).length > 0

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
      const note = isInView(result.task) ? '' : HIDDEN_BY_VIEW_NOTE
      notify(`Task "${result.task.title}" created.${note}`)
    }
    return result
  }

  const handleUpdate = (values) => {
    const result = updateTask(dialog.task.id, values)
    if (result.ok) {
      closeDialog()
      const updated = { ...dialog.task, ...validateTaskInput(values).values }
      notify(`Changes saved.${isInView(updated) ? '' : HIDDEN_BY_VIEW_NOTE}`)
    }
    return result
  }

  const handleToggle = (task) => {
    const result = toggleTaskCompleted(task.id)
    if (!result.ok) {
      notify(result.errors.form, 'error')
      return
    }
    if (!isInView({ ...task, completed: !task.completed })) focusListAfterRenderRef.current = true
    notify(task.completed ? `"${task.title}" reopened.` : `"${task.title}" completed.`)
  }

  const handleConfirmDelete = () => {
    const { task } = dialog
    const result = deleteTask(task.id)
    closeDialog()
    if (result.ok) notify(`Task "${task.title}" deleted.`)
    else notify(result.errors.form, 'error')
  }

  const handleRemoveSetting = (key) => {
    if (key === 'query') dispatchView({ type: VIEW_ACTIONS.QUERY_CHANGED, query: '' })
    else if (key === 'sort') dispatchView({ type: VIEW_ACTIONS.SORT_FIELD_CHANGED, field: DEFAULT_SORT.field })
    else dispatchView({ type: VIEW_ACTIONS.FILTER_CHANGED, name: key, value: DEFAULT_FILTERS[key] })
  }

  const newTaskButton = (
    <Button onClick={openCreateDialog}>
      <Icon name="plus" size={18} />
      New task
    </Button>
  )

  let content
  if (tasks.length === 0) {
    content = (
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
    )
  } else {
    content = (
      <>
        <TaskToolbar
          view={view}
          resultCount={visibleTasks.length}
          totalCount={tasks.length}
          onQueryChange={(query) => dispatchView({ type: VIEW_ACTIONS.QUERY_CHANGED, query })}
          onFilterChange={(name, value) => dispatchView({ type: VIEW_ACTIONS.FILTER_CHANGED, name, value })}
          onSortFieldChange={(field) => dispatchView({ type: VIEW_ACTIONS.SORT_FIELD_CHANGED, field })}
          onSortDirectionChange={(direction) => dispatchView({ type: VIEW_ACTIONS.SORT_DIRECTION_CHANGED, direction })}
          onRemoveSetting={handleRemoveSetting}
          onReset={() => dispatchView({ type: VIEW_ACTIONS.RESET })}
        />
        {visibleTasks.length === 0 ? (
          <EmptyState
            icon="search"
            title="No matching tasks"
            message={`None of your ${tasks.length} ${tasks.length === 1 ? 'task matches' : 'tasks match'} the current search and filters.`}
            action={
              <Button variant="secondary" onClick={() => dispatchView({ type: VIEW_ACTIONS.CRITERIA_CLEARED })}>
                Clear search and filters
              </Button>
            }
          />
        ) : (
          <TaskList
            tasks={visibleTasks}
            totalCount={tasks.length}
            isFiltered={isFiltered}
            headingRef={listHeadingRef}
            now={now}
            onToggle={handleToggle}
            onEdit={(task) => setDialog({ type: DIALOG.EDIT, task })}
            onDelete={(task) => setDialog({ type: DIALOG.DELETE, task })}
          />
        )}
      </>
    )
  }

  return (
    <>
      <PageHeader title={route.title} description={route.description} actions={tasks.length > 0 && newTaskButton} />

      {content}

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
