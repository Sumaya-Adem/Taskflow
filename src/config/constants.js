/**
 * Application-wide configuration. Domain logic, storage and (later) UI read
 * their options from here rather than hard-coding values.
 */

export const TASK_LIMITS = Object.freeze({
  // Lengths are measured in UTF-16 code units, matching the browser's
  // `maxlength` attribute so form limits and validation always agree.
  titleMaxLength: 120,
  descriptionMaxLength: 1000,
})

/** Ordered from most to least urgent; `rank` drives priority sorting. */
export const PRIORITIES = Object.freeze([
  Object.freeze({ value: 'high', label: 'High', rank: 3 }),
  Object.freeze({ value: 'medium', label: 'Medium', rank: 2 }),
  Object.freeze({ value: 'low', label: 'Low', rank: 1 }),
])

export const DEFAULT_PRIORITY = 'medium'

export const CATEGORIES = Object.freeze([
  Object.freeze({ value: 'work', label: 'Work' }),
  Object.freeze({ value: 'personal', label: 'Personal' }),
  Object.freeze({ value: 'shopping', label: 'Shopping' }),
  Object.freeze({ value: 'health', label: 'Health' }),
  Object.freeze({ value: 'other', label: 'Other' }),
])

/** Used for new tasks without a category and for unknown stored categories. */
export const DEFAULT_CATEGORY = 'other'

/** A task is "due soon" when due today or within this many following days. */
export const DUE_SOON_DAYS = 3

/** Sentinel filter value meaning "do not filter on this field". */
export const FILTER_ALL = 'all'

export const STATUS_FILTERS = Object.freeze({
  ALL: FILTER_ALL,
  ACTIVE: 'active',
  COMPLETED: 'completed',
})

export const DUE_FILTERS = Object.freeze({
  ALL: FILTER_ALL,
  OVERDUE: 'overdue',
  TODAY: 'today',
  UPCOMING: 'upcoming',
  NONE: 'none',
})

export const DEFAULT_FILTERS = Object.freeze({
  status: STATUS_FILTERS.ALL,
  priority: FILTER_ALL,
  category: FILTER_ALL,
  due: DUE_FILTERS.ALL,
})

export const SORT_FIELDS = Object.freeze({
  CREATED: 'createdAt',
  UPDATED: 'updatedAt',
  DUE_DATE: 'dueDate',
  PRIORITY: 'priority',
  TITLE: 'title',
})

export const SORT_DIRECTIONS = Object.freeze({
  ASC: 'asc',
  DESC: 'desc',
})

export const DEFAULT_SORT = Object.freeze({
  field: SORT_FIELDS.CREATED,
  direction: SORT_DIRECTIONS.DESC,
})

export const STORAGE_KEYS = Object.freeze({
  TASKS: 'taskflow:tasks',
})

/** Current schema version of the persisted task envelope. */
export const STORAGE_VERSION = 1
