/**
 * Task domain model: creation, validation, updates and normalization of
 * untrusted (stored or legacy) records. Pure functions only; no React and no
 * storage access.
 *
 * Task shape:
 * {
 *   id: string,
 *   title: string,              // trimmed, 1..TASK_LIMITS.titleMaxLength
 *   description: string,        // trimmed, '' when empty
 *   priority: 'low' | 'medium' | 'high',
 *   category: string,           // a value from CATEGORIES
 *   dueDate: string | null,     // local calendar date key 'YYYY-MM-DD'
 *   completed: boolean,
 *   completedAt: string | null, // ISO timestamp, set only while completed
 *   createdAt: string,          // ISO timestamp
 *   updatedAt: string,          // ISO timestamp
 * }
 */

import {
  CATEGORIES,
  DEFAULT_CATEGORY,
  DEFAULT_PRIORITY,
  PRIORITIES,
  TASK_LIMITS,
} from '../config/constants.js'
import { isValidDateKey } from './dates.js'

/** Fields a user may set when creating or editing a task. */
export const EDITABLE_FIELDS = Object.freeze(['title', 'description', 'priority', 'category', 'dueDate'])

const PRIORITY_VALUES = new Set(PRIORITIES.map((priority) => priority.value))
const CATEGORY_VALUES = new Set(CATEGORIES.map((category) => category.value))

// Legacy records may hold a full timestamp; only its calendar-date prefix is kept.
const DATE_KEY_PREFIX_PATTERN = /^(\d{4}-\d{2}-\d{2})T/

export class TaskValidationError extends Error {
  constructor(errors) {
    super('Invalid task input')
    this.name = 'TaskValidationError'
    this.errors = errors
  }
}

/** A random unique ID; falls back to `getRandomValues` where `randomUUID` is missing (non-secure contexts). */
export function generateId(cryptoImpl = globalThis.crypto) {
  if (typeof cryptoImpl?.randomUUID === 'function') return cryptoImpl.randomUUID()

  const bytes = new Uint8Array(16)
  if (typeof cryptoImpl?.getRandomValues === 'function') {
    cryptoImpl.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256)
  }
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isBlank(value) {
  return value === undefined || value === null || value === ''
}

/** Normalizes a timestamp-like value to an ISO string, or returns null. */
function toIsoTimestamp(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  if (typeof value === 'string' && value.trim() === '') return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function nowIso(now) {
  const iso = toIsoTimestamp(now instanceof Date ? now.getTime() : now)
  if (!iso) throw new TypeError('`now` must be a valid date')
  return iso
}

function validateTitle(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    return { error: 'Title is required.' }
  }
  const title = value.trim()
  if (title.length > TASK_LIMITS.titleMaxLength) {
    return { error: `Title must be ${TASK_LIMITS.titleMaxLength} characters or fewer.` }
  }
  return { value: title }
}

function validateDescription(value) {
  if (isBlank(value)) return { value: '' }
  if (typeof value !== 'string') return { error: 'Description must be text.' }
  const description = value.trim()
  if (description.length > TASK_LIMITS.descriptionMaxLength) {
    return { error: `Description must be ${TASK_LIMITS.descriptionMaxLength} characters or fewer.` }
  }
  return { value: description }
}

function validatePriority(value) {
  if (isBlank(value)) return { value: DEFAULT_PRIORITY }
  return PRIORITY_VALUES.has(value) ? { value } : { error: 'Choose a valid priority.' }
}

function validateCategory(value) {
  if (isBlank(value)) return { value: DEFAULT_CATEGORY }
  return CATEGORY_VALUES.has(value) ? { value } : { error: 'Choose a valid category.' }
}

function validateDueDate(value) {
  if (isBlank(value)) return { value: null }
  return isValidDateKey(value) ? { value } : { error: 'Enter a valid date.' }
}

const FIELD_VALIDATORS = {
  title: validateTitle,
  description: validateDescription,
  priority: validatePriority,
  category: validateCategory,
  dueDate: validateDueDate,
}

/**
 * Validates user input for the editable fields.
 *
 * Blank optional fields fall back to defaults; supplied values must be valid
 * (an unknown priority is an error, not silently replaced). Unknown keys are
 * ignored.
 *
 * @returns {{ isValid: boolean, errors: Record<string, string>, values: object }}
 *   `values` holds the normalized value of every field that passed.
 */
export function validateTaskInput(input) {
  const source = isPlainObject(input) ? input : {}
  const errors = {}
  const values = {}

  for (const field of EDITABLE_FIELDS) {
    const result = FIELD_VALIDATORS[field](source[field])
    if (result.error) errors[field] = result.error
    else values[field] = result.value
  }

  return { isValid: Object.keys(errors).length === 0, errors, values }
}

function validateOrThrow(input) {
  const result = validateTaskInput(input)
  if (!result.isValid) throw new TaskValidationError(result.errors)
  return result.values
}

/**
 * Creates a new, active task from user input.
 * @throws {TaskValidationError} when the input is invalid.
 */
export function createTask(input, { now = new Date(), id = generateId() } = {}) {
  const values = validateOrThrow(input)
  const timestamp = nowIso(now)
  return {
    id,
    ...values,
    completed: false,
    completedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

/**
 * Applies edits to the editable fields of a task. Fields missing from
 * `changes` keep their current values; identity, completion state and
 * `createdAt` cannot be changed here.
 * @throws {TaskValidationError} when the merged result is invalid.
 */
export function updateTask(task, changes, { now = new Date() } = {}) {
  const patch = isPlainObject(changes) ? changes : {}
  const merged = {}
  for (const field of EDITABLE_FIELDS) {
    merged[field] = Object.hasOwn(patch, field) ? patch[field] : task[field]
  }
  return { ...task, ...validateOrThrow(merged), updatedAt: nowIso(now) }
}

/** Marks a task complete or active. Returns the same object if nothing changes. */
export function setTaskCompleted(task, completed, { now = new Date() } = {}) {
  const nextCompleted = Boolean(completed)
  if (task.completed === nextCompleted) return task
  const timestamp = nowIso(now)
  return {
    ...task,
    completed: nextCompleted,
    completedAt: nextCompleted ? timestamp : null,
    updatedAt: timestamp,
  }
}

export function toggleTaskCompleted(task, options) {
  return setTaskCompleted(task, !task.completed, options)
}

function normalizeEnum(value, allowed, fallback) {
  if (typeof value !== 'string') return fallback
  const candidate = value.trim().toLowerCase()
  return allowed.has(candidate) ? candidate : fallback
}

function normalizeDueDate(value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (isValidDateKey(trimmed)) return trimmed
  const prefix = DATE_KEY_PREFIX_PATTERN.exec(trimmed)?.[1]
  return prefix && isValidDateKey(prefix) ? prefix : null
}

function normalizeId(value) {
  if (typeof value === 'string' && value.trim() !== '') return value.trim()
  if (Number.isFinite(value)) return String(value)
  return null
}

function truncate(value, maxLength) {
  return value.length > maxLength ? value.slice(0, maxLength).trimEnd() : value
}

/**
 * Converts an untrusted record (from storage, another tab or an older app
 * version) into a valid task, repairing what it safely can:
 * unknown priority/category → defaults, over-long text → truncated,
 * malformed dates/timestamps → cleared or defaulted, missing id → generated,
 * unknown fields → dropped.
 *
 * Returns null when the record cannot be salvaged: it is not an object or has
 * no usable title.
 */
export function normalizeTask(raw, { now = new Date(), generate = generateId } = {}) {
  if (!isPlainObject(raw)) return null
  if (typeof raw.title !== 'string' || raw.title.trim() === '') return null

  const fallbackTimestamp = nowIso(now)
  const createdAt = toIsoTimestamp(raw.createdAt) ?? fallbackTimestamp
  const updatedAt = toIsoTimestamp(raw.updatedAt) ?? createdAt
  const completed = raw.completed === true

  return {
    id: normalizeId(raw.id) ?? generate(),
    title: truncate(raw.title.trim(), TASK_LIMITS.titleMaxLength),
    description:
      typeof raw.description === 'string'
        ? truncate(raw.description.trim(), TASK_LIMITS.descriptionMaxLength)
        : '',
    priority: normalizeEnum(raw.priority, PRIORITY_VALUES, DEFAULT_PRIORITY),
    category: normalizeEnum(raw.category, CATEGORY_VALUES, DEFAULT_CATEGORY),
    dueDate: normalizeDueDate(raw.dueDate),
    completed,
    completedAt: completed ? (toIsoTimestamp(raw.completedAt) ?? updatedAt) : null,
    createdAt,
    updatedAt,
  }
}

/**
 * Normalizes a list of untrusted records. Unsalvageable records are dropped;
 * records sharing an id with an earlier one get a fresh id so no data is lost.
 *
 * @returns {{ tasks: object[], droppedCount: number, repairedCount: number }}
 *   `repairedCount` counts kept records that differed from their stored form.
 */
export function normalizeTasks(rawList, { now = new Date(), generate = generateId } = {}) {
  if (!Array.isArray(rawList)) return { tasks: [], droppedCount: 0, repairedCount: 0 }

  const seenIds = new Set()
  const tasks = []
  let droppedCount = 0
  let repairedCount = 0

  for (const raw of rawList) {
    const task = normalizeTask(raw, { now, generate })
    if (!task) {
      droppedCount += 1
      continue
    }
    while (seenIds.has(task.id)) task.id = generate()
    seenIds.add(task.id)

    if (!isSameRecord(raw, task)) repairedCount += 1
    tasks.push(task)
  }

  return { tasks, droppedCount, repairedCount }
}

const TASK_KEYS = Object.freeze([
  'id',
  'title',
  'description',
  'priority',
  'category',
  'dueDate',
  'completed',
  'completedAt',
  'createdAt',
  'updatedAt',
])

function isSameRecord(raw, task) {
  const rawKeys = Object.keys(raw)
  return rawKeys.length === TASK_KEYS.length && TASK_KEYS.every((key) => raw[key] === task[key])
}
