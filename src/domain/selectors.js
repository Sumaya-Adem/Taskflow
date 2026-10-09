/**
 * Search, filter and sort selectors. Pure functions: they never mutate the
 * input list and always return a new array.
 */

import {
  DEFAULT_FILTERS,
  DEFAULT_SORT,
  DUE_FILTERS,
  FILTER_ALL,
  PRIORITIES,
  SORT_DIRECTIONS,
  SORT_FIELDS,
  STATUS_FILTERS,
} from '../config/constants.js'
import { DUE_STATUS, getDueStatus } from './dates.js'

const PRIORITY_RANK = Object.fromEntries(PRIORITIES.map((priority) => [priority.value, priority.rank]))
const titleCollator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true })

/** Lower-cases and strips accents so "cafe" matches "Café". */
function foldText(value) {
  return value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
}

/** Splits a query into folded, non-empty search terms. */
export function toSearchTerms(query) {
  if (typeof query !== 'string') return []
  return foldText(query).split(/\s+/).filter(Boolean)
}

/**
 * Case- and accent-insensitive search over title and description. Every term
 * in the query must appear somewhere in the task (AND semantics), so
 * "milk buy" matches "Buy oat milk".
 */
export function searchTasks(tasks, query) {
  const terms = toSearchTerms(query)
  if (terms.length === 0) return [...tasks]

  return tasks.filter((task) => {
    const haystack = foldText(`${task.title}\n${task.description}`)
    return terms.every((term) => haystack.includes(term))
  })
}

function matchesStatus(task, status) {
  if (status === STATUS_FILTERS.ACTIVE) return !task.completed
  if (status === STATUS_FILTERS.COMPLETED) return task.completed
  return true
}

function matchesValue(actual, expected) {
  if (expected === FILTER_ALL || expected === undefined || expected === null) return true
  return actual === expected
}

/**
 * Due filters follow `getDueStatus`, so completed tasks are never overdue or
 * due. `soon` means due today or within DUE_SOON_DAYS (like `isDueSoon`);
 * `upcoming` means due after today; `none` means no due date.
 */
function matchesDue(task, due, now) {
  switch (due) {
    case DUE_FILTERS.OVERDUE:
      return getDueStatus(task, now) === DUE_STATUS.OVERDUE
    case DUE_FILTERS.TODAY:
      return getDueStatus(task, now) === DUE_STATUS.TODAY
    case DUE_FILTERS.SOON: {
      const status = getDueStatus(task, now)
      return status === DUE_STATUS.TODAY || status === DUE_STATUS.SOON
    }
    case DUE_FILTERS.UPCOMING: {
      const status = getDueStatus(task, now)
      return status === DUE_STATUS.SOON || status === DUE_STATUS.UPCOMING
    }
    case DUE_FILTERS.NONE:
      return task.dueDate === null
    default:
      return true
  }
}

/**
 * Filters by status, priority, category and due date. All criteria combine
 * with AND; a missing or `'all'` criterion does not filter.
 */
export function filterTasks(tasks, filters = DEFAULT_FILTERS, { now = new Date() } = {}) {
  const { status, priority, category, due } = { ...DEFAULT_FILTERS, ...filters }
  return tasks.filter(
    (task) =>
      matchesStatus(task, status) &&
      matchesValue(task.priority, priority) &&
      matchesValue(task.category, category) &&
      matchesDue(task, due, now),
  )
}

/** True when any filter differs from its default or a search is active. */
export function hasActiveCriteria(filters = DEFAULT_FILTERS, query = '') {
  const merged = { ...DEFAULT_FILTERS, ...filters }
  const filtered = Object.keys(DEFAULT_FILTERS).some((key) => merged[key] !== DEFAULT_FILTERS[key])
  return filtered || toSearchTerms(query).length > 0
}

function compareStrings(a, b) {
  if (a === b) return 0
  return a < b ? -1 : 1
}

/** Primary comparators, written for ascending order. */
const COMPARATORS = {
  [SORT_FIELDS.CREATED]: (a, b) => compareStrings(a.createdAt, b.createdAt),
  [SORT_FIELDS.UPDATED]: (a, b) => compareStrings(a.updatedAt, b.updatedAt),
  [SORT_FIELDS.DUE_DATE]: (a, b) => compareStrings(a.dueDate, b.dueDate),
  [SORT_FIELDS.PRIORITY]: (a, b) => (PRIORITY_RANK[a.priority] ?? 0) - (PRIORITY_RANK[b.priority] ?? 0),
  [SORT_FIELDS.TITLE]: (a, b) => titleCollator.compare(a.title, b.title),
  [SORT_FIELDS.STATUS]: (a, b) => Number(a.completed) - Number(b.completed),
}

/** Fixed tie-breakers, independent of the chosen direction: newest first, then id. */
function compareTieBreakers(a, b) {
  return compareStrings(b.createdAt, a.createdAt) || compareStrings(a.id, b.id)
}

/** Resolves a possibly invalid sort option to a supported one. */
export function resolveSort(sort) {
  const field = Object.hasOwn(COMPARATORS, sort?.field) ? sort.field : DEFAULT_SORT.field
  const direction = Object.values(SORT_DIRECTIONS).includes(sort?.direction)
    ? sort.direction
    : DEFAULT_SORT.direction
  return { field, direction }
}

/**
 * Sorts tasks by a supported field and direction. Ordering is deterministic:
 * ties fall back to creation time (newest first) and then id. When sorting by
 * due date, tasks without one always come last, whatever the direction.
 */
export function sortTasks(tasks, sort = DEFAULT_SORT) {
  const { field, direction } = resolveSort(sort)
  const compare = COMPARATORS[field]
  const sign = direction === SORT_DIRECTIONS.DESC ? -1 : 1

  return [...tasks].sort((a, b) => {
    if (field === SORT_FIELDS.DUE_DATE && a.dueDate !== b.dueDate) {
      if (a.dueDate === null) return 1
      if (b.dueDate === null) return -1
    }
    return sign * compare(a, b) || compareTieBreakers(a, b)
  })
}

/** Search → filter → sort, the full pipeline behind the visible task list. */
export function selectVisibleTasks(tasks, { query = '', filters, sort } = {}, { now = new Date() } = {}) {
  return sortTasks(filterTasks(searchTasks(tasks, query), filters, { now }), sort)
}
