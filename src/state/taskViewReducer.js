/**
 * In-memory view settings for the My Tasks list: search query, filters and
 * sort. These are UI state only: they are never persisted and never change
 * the stored tasks; the visible list is derived from them on each render.
 */

import { DEFAULT_FILTERS, DEFAULT_SORT, SORT_DIRECTIONS, SORT_OPTIONS } from '../config/constants.js'

export const VIEW_ACTIONS = Object.freeze({
  QUERY_CHANGED: 'view/queryChanged',
  FILTER_CHANGED: 'view/filterChanged',
  SORT_FIELD_CHANGED: 'view/sortFieldChanged',
  SORT_DIRECTION_CHANGED: 'view/sortDirectionChanged',
  CRITERIA_CLEARED: 'view/criteriaCleared',
  RESET: 'view/reset',
})

export const initialTaskView = Object.freeze({
  query: '',
  filters: DEFAULT_FILTERS,
  sort: DEFAULT_SORT,
})

const SORT_OPTION_BY_FIELD = new Map(SORT_OPTIONS.map((option) => [option.value, option]))
const DIRECTION_VALUES = new Set(Object.values(SORT_DIRECTIONS))

/** True when the sort differs from the default, i.e. resetting would change something. */
export function isDefaultSort(sort) {
  return sort.field === DEFAULT_SORT.field && sort.direction === DEFAULT_SORT.direction
}

export function taskViewReducer(state, action) {
  switch (action.type) {
    case VIEW_ACTIONS.QUERY_CHANGED:
      return state.query === action.query ? state : { ...state, query: action.query }

    case VIEW_ACTIONS.FILTER_CHANGED: {
      // Only known filter names are accepted; values come from the configured options.
      if (!Object.hasOwn(DEFAULT_FILTERS, action.name) || state.filters[action.name] === action.value) return state
      return { ...state, filters: { ...state.filters, [action.name]: action.value } }
    }

    case VIEW_ACTIONS.SORT_FIELD_CHANGED: {
      // Picking a field applies its natural direction (e.g. due date: earliest first).
      const option = SORT_OPTION_BY_FIELD.get(action.field)
      if (!option || state.sort.field === action.field) return state
      return { ...state, sort: { field: option.value, direction: option.defaultDirection } }
    }

    case VIEW_ACTIONS.SORT_DIRECTION_CHANGED:
      if (!DIRECTION_VALUES.has(action.direction) || state.sort.direction === action.direction) return state
      return { ...state, sort: { ...state.sort, direction: action.direction } }

    case VIEW_ACTIONS.CRITERIA_CLEARED:
      // Clears what can hide tasks (search and filters) but keeps the chosen order.
      return { ...state, query: initialTaskView.query, filters: initialTaskView.filters }

    case VIEW_ACTIONS.RESET:
      return initialTaskView

    default:
      throw new Error(`Unknown view action: ${action.type}`)
  }
}
