/**
 * Pure helpers that turn task data into display text and tones. Business
 * rules (what counts as overdue, etc.) come from the domain layer; this
 * module only decides how they are presented.
 */

import { CATEGORIES, PRIORITIES } from '../../config/constants.js'
import { DUE_STATUS, daysBetween, formatDateKey, getDueStatus, getTodayKey, toDateKey } from '../../domain/dates.js'

const PRIORITY_LABELS = Object.fromEntries(PRIORITIES.map((priority) => [priority.value, priority.label]))
const CATEGORY_LABELS = Object.fromEntries(CATEGORIES.map((category) => [category.value, category.label]))

const PRIORITY_TONES = { high: 'danger', medium: 'warning', low: 'neutral' }

export function getPriorityBadge(priority) {
  return { tone: PRIORITY_TONES[priority] ?? 'neutral', label: `${PRIORITY_LABELS[priority] ?? priority} priority` }
}

export function getCategoryLabel(category) {
  return CATEGORY_LABELS[category] ?? category
}

/** "today", "tomorrow", "yesterday" in lower case, otherwise a short date such as "Oct 20". */
function describeDay(key, now) {
  const diff = daysBetween(getTodayKey(now), key)
  if (diff === 0) return 'today'
  if (diff === 1) return 'tomorrow'
  if (diff === -1) return 'yesterday'
  return formatDateKey(key, { now })
}

/**
 * Due-date badge and visual state for a task, or null without a due date.
 * `state` is one of 'overdue' | 'today' | 'soon' | 'upcoming' | 'none'.
 */
export function getDueBadge(task, now = new Date()) {
  if (!task.dueDate) return null
  const day = describeDay(task.dueDate, now)
  const status = getDueStatus(task, now)

  switch (status) {
    case DUE_STATUS.OVERDUE:
      return { state: status, tone: 'danger', label: `Overdue · due ${day}` }
    case DUE_STATUS.TODAY:
      return { state: status, tone: 'warning', label: 'Due today' }
    case DUE_STATUS.SOON:
      return { state: status, tone: 'warning', label: `Due ${day}` }
    case DUE_STATUS.UPCOMING:
      return { state: status, tone: 'neutral', label: `Due ${day}` }
    default:
      // Completed tasks: show the date without urgency.
      return { state: DUE_STATUS.NONE, tone: 'neutral', label: `Due ${day}` }
  }
}

/** "Completed today" / "Completed Oct 2", or null for active tasks. */
export function getCompletedLabel(task, now = new Date()) {
  if (!task.completed || !task.completedAt) return null
  const key = toDateKey(new Date(task.completedAt))
  return key ? `Completed ${describeDay(key, now)}` : 'Completed'
}
