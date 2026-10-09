/**
 * Calendar-date helpers.
 *
 * Due dates are stored as local calendar "date keys" (`YYYY-MM-DD`), never as
 * timestamps. A timestamp such as `new Date('2026-10-08')` is parsed as UTC
 * midnight and shows up as the previous day west of Greenwich; keeping plain
 * date keys and comparing them against the user's *local* today avoids that
 * whole class of off-by-one bugs. Zero-padded keys also sort and compare
 * correctly as strings.
 */

import { DUE_SOON_DAYS } from '../config/constants.js'

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const MS_PER_DAY = 24 * 60 * 60 * 1000
// Four-digit years only: keeps keys fixed-width (so string comparison stays
// correct) and avoids Date's legacy mapping of years 0–99 to 1900–1999.
const MIN_YEAR = 1000

export const DUE_STATUS = Object.freeze({
  NONE: 'none',
  OVERDUE: 'overdue',
  TODAY: 'today',
  SOON: 'soon',
  UPCOMING: 'upcoming',
})

function pad(value, length = 2) {
  return String(value).padStart(length, '0')
}

/** Splits a valid date key into numbers, or returns null. */
function parseParts(key) {
  if (typeof key !== 'string') return null
  const match = DATE_KEY_PATTERN.exec(key)
  if (!match) return null

  const [year, month, day] = match.slice(1).map(Number)
  if (year < MIN_YEAR || month < 1 || month > 12 || day < 1) return null

  // Round-trip through UTC to reject impossible dates such as 2026-02-30.
  const probe = new Date(Date.UTC(year, month - 1, day))
  if (probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return null

  return { year, month, day }
}

function isValidDate(date) {
  return date instanceof Date && !Number.isNaN(date.getTime())
}

/** True for a well-formed, real calendar date such as `2026-10-08`. */
export function isValidDateKey(value) {
  return parseParts(value) !== null
}

/** The local calendar date of `date` as a key, or null for an invalid Date. */
export function toDateKey(date) {
  if (!isValidDate(date)) return null
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Today's local calendar date as a key. */
export function getTodayKey(now = new Date()) {
  return toDateKey(now)
}

/** Local midnight of the given key as a Date, or null if the key is invalid. */
export function parseDateKey(key) {
  const parts = parseParts(key)
  if (!parts) return null
  return new Date(parts.year, parts.month - 1, parts.day)
}

/**
 * Shifts a key by whole calendar days. Uses UTC arithmetic so daylight-saving
 * transitions (23- or 25-hour days) can never skip or repeat a date.
 */
export function addDays(key, days) {
  const parts = parseParts(key)
  if (!parts || !Number.isInteger(days)) return null
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days))
  return `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

/** Whole calendar days from `fromKey` to `toKey` (negative if earlier), or null. */
export function daysBetween(fromKey, toKey) {
  const from = parseParts(fromKey)
  const to = parseParts(toKey)
  if (!from || !to) return null
  const fromMs = Date.UTC(from.year, from.month - 1, from.day)
  const toMs = Date.UTC(to.year, to.month - 1, to.day)
  return Math.round((toMs - fromMs) / MS_PER_DAY)
}

/**
 * Classifies an *active* task's due date relative to today. Completed tasks
 * and tasks without a valid due date are always `none`.
 */
export function getDueStatus(task, now = new Date(), soonDays = DUE_SOON_DAYS) {
  if (!task || task.completed || !isValidDateKey(task.dueDate)) return DUE_STATUS.NONE

  const diff = daysBetween(getTodayKey(now), task.dueDate)
  if (diff === null) return DUE_STATUS.NONE
  if (diff < 0) return DUE_STATUS.OVERDUE
  if (diff === 0) return DUE_STATUS.TODAY
  if (diff <= soonDays) return DUE_STATUS.SOON
  return DUE_STATUS.UPCOMING
}

/** Active task whose due date is before today. */
export function isOverdue(task, now = new Date()) {
  return getDueStatus(task, now) === DUE_STATUS.OVERDUE
}

/** Active task due today. */
export function isDueToday(task, now = new Date()) {
  return getDueStatus(task, now) === DUE_STATUS.TODAY
}

/** Active task due today or within the next `soonDays` days. */
export function isDueSoon(task, now = new Date(), soonDays = DUE_SOON_DAYS) {
  const status = getDueStatus(task, now, soonDays)
  return status === DUE_STATUS.TODAY || status === DUE_STATUS.SOON
}

/**
 * Formats a date key for display. Yesterday/today/tomorrow use relative words
 * ("Today"); other dates use a short date, adding the year only when it is not
 * the current year. Returns '' for an invalid key.
 */
export function formatDateKey(key, { now = new Date(), locale } = {}) {
  const parts = parseParts(key)
  if (!parts) return ''

  const todayKey = getTodayKey(now)
  const diff = daysBetween(todayKey, key)

  if (diff !== null && Math.abs(diff) <= 1) {
    const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(diff, 'day')
    return relative.charAt(0).toLocaleUpperCase(locale) + relative.slice(1)
  }

  const sameYear = todayKey !== null && Number(todayKey.slice(0, 4)) === parts.year
  // Format in UTC so the host timezone cannot shift the displayed day.
  const formatter = new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
  return formatter.format(new Date(Date.UTC(parts.year, parts.month - 1, parts.day)))
}
