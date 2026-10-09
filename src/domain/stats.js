/**
 * Dashboard statistics. Always derived from the current task list on demand;
 * never persisted.
 */

import { PRIORITIES } from '../config/constants.js'
import { DUE_STATUS, getDueStatus } from './dates.js'

/**
 * Completion as a whole percentage. Rounds normally, but never reports 0%
 * once something is done or 100% while something is still open.
 */
export function completionPercentage(completed, total) {
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(completed) || completed <= 0) return 0
  if (completed >= total) return 100
  const percentage = Math.round((completed / total) * 100)
  return Math.min(Math.max(percentage, 1), 99)
}

/** `part` as a whole percentage of `total` (normal rounding); 0 when there is nothing to divide. */
export function sharePercentage(part, total) {
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(part) || part <= 0) return 0
  return Math.round((Math.min(part, total) / total) * 100)
}

/**
 * @returns {{
 *   total: number, active: number, completed: number,
 *   overdue: number, dueToday: number, completionPercentage: number,
 *   byPriority: Record<string, { total: number, active: number, completed: number }>
 * }}
 *   `byPriority` always contains every configured priority, even when zero.
 */
export function computeStats(tasks, { now = new Date() } = {}) {
  const byPriority = Object.fromEntries(
    PRIORITIES.map((priority) => [priority.value, { total: 0, active: 0, completed: 0 }]),
  )
  const stats = { total: 0, active: 0, completed: 0, overdue: 0, dueToday: 0 }

  for (const task of tasks) {
    stats.total += 1
    if (task.completed) stats.completed += 1
    else stats.active += 1

    const dueStatus = getDueStatus(task, now)
    if (dueStatus === DUE_STATUS.OVERDUE) stats.overdue += 1
    if (dueStatus === DUE_STATUS.TODAY) stats.dueToday += 1

    const bucket = byPriority[task.priority]
    if (bucket) {
      bucket.total += 1
      bucket[task.completed ? 'completed' : 'active'] += 1
    }
  }

  return {
    ...stats,
    completionPercentage: completionPercentage(stats.completed, stats.total),
    byPriority,
  }
}
