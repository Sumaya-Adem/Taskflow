import { createContext } from 'react'

/** Holds `{ tasks, persistence, ...actions }`; see TasksProvider. */
export const TasksContext = createContext(null)
