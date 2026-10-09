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
  /** Due today or within DUE_SOON_DAYS (matches isDueSoon). */
  SOON: 'soon',
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
  /** Completion status: ascending puts active tasks first. */
  STATUS: 'status',
})

export const SORT_DIRECTIONS = Object.freeze({
  ASC: 'asc',
  DESC: 'desc',
})

export const DEFAULT_SORT = Object.freeze({
  field: SORT_FIELDS.CREATED,
  direction: SORT_DIRECTIONS.DESC,
})

/** Options shown in the My Tasks filter controls. */
export const STATUS_FILTER_OPTIONS = Object.freeze([
  Object.freeze({ value: STATUS_FILTERS.ALL, label: 'All' }),
  Object.freeze({ value: STATUS_FILTERS.ACTIVE, label: 'Active' }),
  Object.freeze({ value: STATUS_FILTERS.COMPLETED, label: 'Completed' }),
])

export const DUE_FILTER_OPTIONS = Object.freeze([
  Object.freeze({ value: DUE_FILTERS.ALL, label: 'Any due date' }),
  Object.freeze({ value: DUE_FILTERS.OVERDUE, label: 'Overdue' }),
  Object.freeze({ value: DUE_FILTERS.TODAY, label: 'Due today' }),
  Object.freeze({ value: DUE_FILTERS.SOON, label: `Due soon (next ${DUE_SOON_DAYS} days)` }),
  Object.freeze({ value: DUE_FILTERS.NONE, label: 'No due date' }),
])

/**
 * Sort choices for the My Tasks list. Each field has a natural default
 * direction (used when the field is picked) and direction labels that say
 * what the order means for that field.
 */
export const SORT_OPTIONS = Object.freeze([
  Object.freeze({
    value: SORT_FIELDS.CREATED,
    label: 'Date created',
    defaultDirection: SORT_DIRECTIONS.DESC,
    directionLabels: Object.freeze({ asc: 'Oldest first', desc: 'Newest first' }),
  }),
  Object.freeze({
    value: SORT_FIELDS.DUE_DATE,
    label: 'Due date',
    defaultDirection: SORT_DIRECTIONS.ASC,
    directionLabels: Object.freeze({ asc: 'Earliest first', desc: 'Latest first' }),
  }),
  Object.freeze({
    value: SORT_FIELDS.PRIORITY,
    label: 'Priority',
    defaultDirection: SORT_DIRECTIONS.DESC,
    directionLabels: Object.freeze({ asc: 'Lowest first', desc: 'Highest first' }),
  }),
  Object.freeze({
    value: SORT_FIELDS.TITLE,
    label: 'Title',
    defaultDirection: SORT_DIRECTIONS.ASC,
    directionLabels: Object.freeze({ asc: 'A to Z', desc: 'Z to A' }),
  }),
  Object.freeze({
    value: SORT_FIELDS.STATUS,
    label: 'Status',
    defaultDirection: SORT_DIRECTIONS.ASC,
    directionLabels: Object.freeze({ asc: 'Active first', desc: 'Completed first' }),
  }),
  Object.freeze({
    value: SORT_FIELDS.UPDATED,
    label: 'Last updated',
    defaultDirection: SORT_DIRECTIONS.DESC,
    directionLabels: Object.freeze({ asc: 'Least recent first', desc: 'Most recent first' }),
  }),
])

export const THEMES = Object.freeze({
  SYSTEM: 'system',
  LIGHT: 'light',
  DARK: 'dark',
})

export const THEME_OPTIONS = Object.freeze([
  Object.freeze({ value: THEMES.SYSTEM, label: 'System', description: 'Match your device setting' }),
  Object.freeze({ value: THEMES.LIGHT, label: 'Light', description: 'Always use the light theme' }),
  Object.freeze({ value: THEMES.DARK, label: 'Dark', description: 'Always use the dark theme' }),
])

export const DEFAULT_THEME = THEMES.SYSTEM

// PREFERENCES is also read by the inline theme script in index.html; keep them in sync.
export const STORAGE_KEYS = Object.freeze({
  TASKS: 'taskflow:tasks',
  PREFERENCES: 'taskflow:preferences',
})

/** Current schema version of the persisted task envelope. */
export const STORAGE_VERSION = 1
