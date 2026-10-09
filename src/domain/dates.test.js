import { describe, expect, it } from 'vitest'
import { buildTask, withTimezone } from '../test/fixtures.js'
import {
  DUE_STATUS,
  addDays,
  daysBetween,
  formatDateKey,
  getDueStatus,
  getTodayKey,
  isDueSoon,
  isDueToday,
  isOverdue,
  isValidDateKey,
  parseDateKey,
  toDateKey,
} from './dates.js'

// Local-time constructor: independent of the host timezone.
const localDate = (year, month, day, hour = 12, minute = 0) => new Date(year, month - 1, day, hour, minute)
const NOW = localDate(2026, 10, 8)

describe('isValidDateKey', () => {
  it.each(['2026-10-08', '2024-02-29', '2026-12-31', '1000-01-01', '9999-12-31'])('accepts %s', (key) => {
    expect(isValidDateKey(key)).toBe(true)
  })

  it.each([
    ['impossible day', '2026-02-30'],
    ['non-leap Feb 29', '2026-02-29'],
    ['month 13', '2026-13-01'],
    ['month 00', '2026-00-10'],
    ['day 00', '2026-10-00'],
    ['missing padding', '2026-1-8'],
    ['timestamp', '2026-10-08T00:00:00Z'],
    ['surrounding whitespace', ' 2026-10-08 '],
    ['other separator', '2026/10/08'],
    ['year below 1000', '0999-01-01'],
    ['empty string', ''],
    ['garbage', 'not a date'],
  ])('rejects %s', (_label, key) => {
    expect(isValidDateKey(key)).toBe(false)
  })

  it.each([null, undefined, 20261008, new Date(), {}])('rejects non-string %p', (value) => {
    expect(isValidDateKey(value)).toBe(false)
  })
})

describe('toDateKey / getTodayKey', () => {
  it('uses the local calendar date with zero padding', () => {
    expect(toDateKey(localDate(2026, 1, 5))).toBe('2026-01-05')
    expect(getTodayKey(NOW)).toBe('2026-10-08')
  })

  it('handles the first and last instants of a local day', () => {
    expect(toDateKey(localDate(2026, 10, 8, 0, 0))).toBe('2026-10-08')
    expect(toDateKey(new Date(2026, 9, 8, 23, 59, 59, 999))).toBe('2026-10-08')
  })

  it('returns null for invalid input', () => {
    expect(toDateKey(new Date('nope'))).toBeNull()
    expect(toDateKey('2026-10-08')).toBeNull()
    expect(toDateKey(undefined)).toBeNull()
  })

  it('reports the date in the local timezone, not UTC', () => {
    const instant = new Date('2026-10-08T23:30:00Z')
    expect(withTimezone('America/Los_Angeles', () => toDateKey(instant))).toBe('2026-10-08')
    expect(withTimezone('Asia/Tokyo', () => toDateKey(instant))).toBe('2026-10-09')
    expect(withTimezone('UTC', () => toDateKey(instant))).toBe('2026-10-08')
  })

  it('keeps the local year at New Year when UTC has already rolled over', () => {
    const instant = new Date('2027-01-01T03:00:00Z')
    expect(withTimezone('America/Los_Angeles', () => toDateKey(instant))).toBe('2026-12-31')
    expect(withTimezone('UTC', () => toDateKey(instant))).toBe('2027-01-01')
  })
})

describe('parseDateKey', () => {
  it('returns local midnight for the key', () => {
    const date = parseDateKey('2026-10-08')
    expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()]).toEqual([2026, 9, 8, 0])
  })

  it('round-trips through toDateKey in timezones west and east of UTC', () => {
    for (const tz of ['America/Los_Angeles', 'Pacific/Kiritimati', 'Asia/Kolkata', 'UTC']) {
      expect(withTimezone(tz, () => toDateKey(parseDateKey('2026-10-08')))).toBe('2026-10-08')
    }
  })

  it('avoids the UTC-parsing off-by-one that `new Date(key)` has', () => {
    withTimezone('America/New_York', () => {
      expect(toDateKey(new Date('2026-10-08'))).toBe('2026-10-07') // the pitfall
      expect(toDateKey(parseDateKey('2026-10-08'))).toBe('2026-10-08')
    })
  })

  it('returns null for invalid keys', () => {
    expect(parseDateKey('2026-02-30')).toBeNull()
    expect(parseDateKey(null)).toBeNull()
  })
})

describe('addDays / daysBetween', () => {
  it('moves across month, year and leap-day boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2026-10-08', 0)).toBe('2026-10-08')
  })

  it('is unaffected by daylight-saving transitions', () => {
    withTimezone('America/New_York', () => {
      expect(addDays('2026-03-07', 1)).toBe('2026-03-08') // spring forward
      expect(addDays('2026-03-08', 1)).toBe('2026-03-09')
      expect(addDays('2026-10-31', 1)).toBe('2026-11-01') // fall back
      expect(addDays('2026-11-01', 1)).toBe('2026-11-02')
      expect(daysBetween('2026-03-01', '2026-03-31')).toBe(30)
    })
  })

  it('counts signed whole days', () => {
    expect(daysBetween('2026-10-08', '2026-10-11')).toBe(3)
    expect(daysBetween('2026-10-08', '2026-10-01')).toBe(-7)
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1)
  })

  it('returns null for invalid input', () => {
    expect(addDays('bad', 1)).toBeNull()
    expect(addDays('2026-10-08', 1.5)).toBeNull()
    expect(daysBetween('2026-10-08', null)).toBeNull()
  })
})

describe('getDueStatus and predicates', () => {
  const due = (dueDate, overrides = {}) => buildTask({ dueDate, ...overrides })

  it.each([
    ['2026-10-07', DUE_STATUS.OVERDUE],
    ['2025-12-31', DUE_STATUS.OVERDUE],
    ['2026-10-08', DUE_STATUS.TODAY],
    ['2026-10-09', DUE_STATUS.SOON],
    ['2026-10-11', DUE_STATUS.SOON], // boundary: exactly DUE_SOON_DAYS (3) away
    ['2026-10-12', DUE_STATUS.UPCOMING],
    [null, DUE_STATUS.NONE],
    ['garbage', DUE_STATUS.NONE],
  ])('due %s → %s', (dueDate, expected) => {
    expect(getDueStatus(due(dueDate), NOW)).toBe(expected)
  })

  it('never treats completed tasks as overdue or due', () => {
    const done = due('2026-10-01', { completed: true })
    expect(getDueStatus(done, NOW)).toBe(DUE_STATUS.NONE)
    expect(isOverdue(done, NOW)).toBe(false)
    expect(isDueToday(due('2026-10-08', { completed: true }), NOW)).toBe(false)
  })

  it('becomes overdue exactly at local midnight, not before', () => {
    const task = due('2026-10-08')
    expect(isOverdue(task, new Date(2026, 9, 8, 23, 59, 59, 999))).toBe(false)
    expect(isOverdue(task, new Date(2026, 9, 9, 0, 0, 0, 0))).toBe(true)
  })

  it('evaluates "today" in the user\'s timezone', () => {
    const instant = new Date('2026-10-08T23:30:00Z')
    const task = due('2026-10-08')
    expect(withTimezone('America/Los_Angeles', () => isDueToday(task, instant))).toBe(true)
    expect(withTimezone('Asia/Tokyo', () => isOverdue(task, instant))).toBe(true)
  })

  it('isDueSoon includes today and respects a custom window', () => {
    expect(isDueSoon(due('2026-10-08'), NOW)).toBe(true)
    expect(isDueSoon(due('2026-10-11'), NOW)).toBe(true)
    expect(isDueSoon(due('2026-10-12'), NOW)).toBe(false)
    expect(isDueSoon(due('2026-10-12'), NOW, 4)).toBe(true)
    expect(isDueSoon(due('2026-10-07'), NOW)).toBe(false)
  })

  it('tolerates missing tasks', () => {
    expect(getDueStatus(null, NOW)).toBe(DUE_STATUS.NONE)
    expect(isOverdue(undefined, NOW)).toBe(false)
  })
})

describe('formatDateKey', () => {
  const format = (key, now = NOW) => formatDateKey(key, { now, locale: 'en-US' })

  it('uses relative words for yesterday, today and tomorrow', () => {
    expect(format('2026-10-07')).toBe('Yesterday')
    expect(format('2026-10-08')).toBe('Today')
    expect(format('2026-10-09')).toBe('Tomorrow')
  })

  it('omits the year for dates in the current year', () => {
    expect(format('2026-10-20')).toBe('Oct 20')
    expect(format('2026-01-01')).toBe('Jan 1')
  })

  it('includes the year for other years', () => {
    expect(format('2027-01-15')).toBe('Jan 15, 2027')
    expect(format('2025-12-25')).toBe('Dec 25, 2025')
  })

  it('shows the stored calendar day regardless of host timezone', () => {
    for (const tz of ['America/Los_Angeles', 'Pacific/Kiritimati']) {
      expect(withTimezone(tz, () => format('2026-10-20', localDate(2026, 10, 8)))).toBe('Oct 20')
    }
  })

  it('returns an empty string for invalid keys', () => {
    expect(format('2026-02-30')).toBe('')
    expect(format(null)).toBe('')
  })
})
