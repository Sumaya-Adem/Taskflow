import { useEffect, useMemo, useReducer, useRef } from 'react'
import { createTask, validateTaskInput } from '../domain/task.js'
import { LOAD_STATUS } from '../storage/storage.js'
import { TasksContext } from './tasksContext.js'
import { TASK_ACTIONS, createTasksState, tasksReducer } from './tasksReducer.js'

export const TASK_NOT_FOUND_ERROR = 'This task no longer exists.'

const systemClock = () => new Date()

/** A recovered load must be written back at once, or every reload would back up the same damage again. */
function needsWriteBack(loadResult) {
  return loadResult.writable && (loadResult.status === LOAD_STATUS.REPAIRED || loadResult.status === LOAD_STATUS.CORRUPT)
}

/**
 * Provides task state backed by a task storage adapter.
 *
 * `initialLoad` is the result of `storage.loadTasks()`, performed once at
 * startup rather than during render: loading can write backups, and React
 * may run render-phase initializers more than once.
 *
 * Every action returns a result object so UI code can react to validation
 * errors without try/catch: `{ ok: true, ... }` or `{ ok: false, errors }`.
 */
export function TasksProvider({ storage, initialLoad, clock = systemClock, children }) {
  const [state, dispatch] = useReducer(tasksReducer, initialLoad, createTasksState)

  // The task list as last written to (or read from) storage. Comparing by
  // reference skips redundant saves, including the initial render.
  const persistedTasksRef = useRef(needsWriteBack(initialLoad) ? null : state.tasks)

  const { tasks } = state
  const { writable } = state.persistence

  useEffect(() => {
    if (tasks === persistedTasksRef.current) return
    persistedTasksRef.current = tasks
    if (!writable) return // Storage unavailable or protected: keep changes in memory only.

    const result = storage.saveTasks(tasks)
    dispatch(result.ok ? { type: TASK_ACTIONS.SAVE_SUCCEEDED } : { type: TASK_ACTIONS.SAVE_FAILED, reason: result.reason })
  }, [tasks, writable, storage])

  // Cross-tab sync: another tab changed the stored tasks, so reload them.
  useEffect(
    () =>
      storage.subscribe(() => {
        const result = storage.loadTasks()
        persistedTasksRef.current = needsWriteBack(result) ? null : result.tasks
        dispatch({ type: TASK_ACTIONS.LOADED, result })
      }),
    [storage],
  )

  const actions = useMemo(() => {
    const findTask = (id) => tasks.find((task) => task.id === id)

    return {
      /** Validates and adds a task. Returns `{ ok, task }` or `{ ok: false, errors }`. */
      addTask(input) {
        const validation = validateTaskInput(input)
        if (!validation.isValid) return { ok: false, errors: validation.errors }
        const task = createTask(validation.values, { now: clock() })
        dispatch({ type: TASK_ACTIONS.ADDED, task })
        return { ok: true, task }
      },

      /** Validates and applies edits to a task's editable fields. */
      updateTask(id, changes) {
        const current = findTask(id)
        if (!current) return { ok: false, errors: { form: TASK_NOT_FOUND_ERROR } }
        const validation = validateTaskInput({ ...current, ...changes })
        if (!validation.isValid) return { ok: false, errors: validation.errors }
        dispatch({ type: TASK_ACTIONS.UPDATED, id, changes, now: clock() })
        return { ok: true }
      },

      /** Flips a task between active and completed. */
      toggleTaskCompleted(id) {
        if (!findTask(id)) return { ok: false, errors: { form: TASK_NOT_FOUND_ERROR } }
        dispatch({ type: TASK_ACTIONS.COMPLETION_TOGGLED, id, now: clock() })
        return { ok: true }
      },

      deleteTask(id) {
        if (!findTask(id)) return { ok: false, errors: { form: TASK_NOT_FOUND_ERROR } }
        dispatch({ type: TASK_ACTIONS.DELETED, id })
        return { ok: true }
      },

      dismissStorageNotice() {
        dispatch({ type: TASK_ACTIONS.NOTICE_DISMISSED })
      },
    }
  }, [tasks, clock])

  const value = useMemo(() => ({ tasks, persistence: state.persistence, ...actions }), [tasks, state.persistence, actions])

  return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>
}
