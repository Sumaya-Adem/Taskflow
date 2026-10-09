import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { STORAGE_KEYS } from '../config/constants.js'
import { buildTask } from '../test/fixtures.js'
import { renderApp } from '../test/renderApp.jsx'

const KEY = STORAGE_KEYS.TASKS
// Local noon on Friday 2026-10-09. Only Date is faked so user-event timers still run.
const NOW = new Date(2026, 9, 9, 12)

const TASKS = [
  buildTask({ id: 'a', title: 'Write report', priority: 'high', dueDate: '2026-10-07', createdAt: '2026-10-01T09:00:00.000Z' }),
  buildTask({ id: 'b', title: 'Pay rent', priority: 'high', dueDate: '2026-10-02', createdAt: '2026-10-02T09:00:00.000Z' }),
  buildTask({ id: 'c', title: 'Buy milk', priority: 'medium', dueDate: '2026-10-09', createdAt: '2026-10-03T09:00:00.000Z' }),
  buildTask({ id: 'd', title: 'Dentist', priority: 'medium', dueDate: '2026-10-12', createdAt: '2026-10-04T09:00:00.000Z' }),
  buildTask({ id: 'e', title: 'Plan trip', priority: 'medium', dueDate: null, createdAt: '2026-10-05T09:00:00.000Z' }),
  buildTask({ id: 'f', title: 'File taxes', priority: 'high', dueDate: '2026-09-30', completed: true, completedAt: '2026-09-29T09:00:00.000Z', createdAt: '2026-09-20T09:00:00.000Z' }),
  buildTask({ id: 'g', title: 'Renew passport', priority: 'medium', dueDate: '2027-02-01', createdAt: '2026-10-06T09:00:00.000Z' }),
]
// No "low" priority tasks on purpose: zero-count priorities must still be shown.

const entry = (tasks) => ({ [KEY]: JSON.stringify({ version: 1, tasks }) })

function setup(tasks = TASKS) {
  return renderApp({ entries: tasks.length ? entry(tasks) : {} })
}

const summary = () => screen.getByRole('region', { name: 'Task summary' })
const statValue = (label) => within(summary()).getByText(label, { selector: 'dt' }).nextElementSibling
const statCaption = (label) => statValue(label).nextElementSibling
const panel = (name) => screen.getByRole('region', { name })
const panelTitles = (name) =>
  within(panel(name))
    .queryAllByRole('button', { name: /^Edit "/ })
    .map((button) => button.textContent)
const nav = (name) => within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', { name })

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('summary cards', () => {
  it('show accurate counts from the task state', () => {
    setup()
    expect(statValue('Total tasks')).toHaveTextContent('7')
    expect(statValue('Active')).toHaveTextContent('6')
    expect(statValue('Completed')).toHaveTextContent('1')
    expect(statValue('Overdue')).toHaveTextContent('2') // "File taxes" is past due but completed
  })

  it('add context without relying on color', () => {
    setup()
    expect(statCaption('Total tasks')).toHaveTextContent('1 due today')
    expect(statCaption('Completed')).toHaveTextContent('14% of all tasks')
    expect(statCaption('Overdue')).toHaveTextContent('Needs attention')
  })

  it('show zeros and an empty state when there are no tasks', () => {
    setup([])
    for (const label of ['Total tasks', 'Active', 'Completed', 'Overdue']) {
      expect(statValue(label)).toHaveTextContent('0')
    }
    expect(statCaption('Overdue')).toHaveTextContent('All on track')
    expect(statCaption('Completed')).toHaveTextContent('0% of all tasks')
    expect(screen.getByRole('heading', { name: 'Nothing to report yet' })).toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })
})

describe('completion progress', () => {
  it('matches the domain completion percentage', () => {
    setup()
    const bar = screen.getByRole('progressbar', { name: 'Tasks completed' })
    expect(bar).toHaveAttribute('aria-valuenow', '14') // 1 of 7
    expect(bar).toHaveAttribute('aria-valuemin', '0')
    expect(bar).toHaveAttribute('aria-valuemax', '100')
    expect(bar).toHaveAttribute('aria-valuetext', '14% (1 of 7 tasks completed)')
    expect(within(panel('Completion')).getByText('14%')).toBeInTheDocument()
  })

  it.each([
    ['nothing completed', [buildTask({ id: '1' }), buildTask({ id: '2' })], '0'],
    ['everything completed', [buildTask({ id: '1', completed: true, completedAt: NOW.toISOString() })], '100'],
    ['one of three', [buildTask({ id: '1', completed: true, completedAt: NOW.toISOString() }), buildTask({ id: '2' }), buildTask({ id: '3' })], '33'],
  ])('handles %s', (_label, tasks, expected) => {
    setup(tasks)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', expected)
  })
})

describe('priority breakdown', () => {
  it('lists every priority with counts and shares, including empty ones', () => {
    setup()
    const items = within(panel('Tasks by priority')).getAllByRole('listitem')
    expect(items.map((item) => item.querySelector('.visually-hidden').textContent)).toEqual([
      'High priority: 3 tasks (43% of all), 2 active',
      'Medium priority: 4 tasks (57% of all), 4 active',
      'Low priority: 0 tasks (0% of all), 0 active',
    ])
  })

  it('sizes each bar by its share of all tasks', () => {
    setup()
    expect(screen.getByTestId('priority-bar-high')).toHaveStyle({ width: '43%' })
    expect(screen.getByTestId('priority-bar-medium')).toHaveStyle({ width: '57%' })
    expect(screen.getByTestId('priority-bar-low')).toHaveStyle({ width: '0%' })
  })
})

describe('overdue and upcoming', () => {
  it('lists active overdue tasks, most overdue first, with details', () => {
    setup()
    expect(panelTitles('Overdue')).toEqual(['Pay rent', 'Write report'])
    const firstItem = within(panel('Overdue')).getAllByRole('listitem')[0]
    expect(within(firstItem).getByText('Overdue · due Oct 2')).toBeInTheDocument()
    expect(within(firstItem).getByText('High priority')).toBeInTheDocument()
  })

  it('lists active upcoming tasks soonest first, starting with today', () => {
    setup()
    expect(panelTitles('Upcoming')).toEqual(['Buy milk', 'Dentist', 'Renew passport'])
    expect(within(panel('Upcoming')).getByText('Due today')).toBeInTheDocument()
  })

  it('excludes completed and undated tasks, and never shows a task twice', () => {
    setup()
    const shown = [...panelTitles('Overdue'), ...panelTitles('Upcoming')]
    expect(shown).not.toContain('File taxes')
    expect(shown).not.toContain('Plan trip')
    expect(new Set(shown).size).toBe(shown.length)
    expect(within(panel('Upcoming')).getByText('1 active task has no due date')).toBeInTheDocument()
  })

  it('shows clear empty states', () => {
    setup([buildTask({ id: '1', title: 'No deadline' })])
    expect(within(panel('Overdue')).getByText("Nothing overdue. You're on track.")).toBeInTheDocument()
    expect(within(panel('Upcoming')).getByText('No upcoming deadlines.')).toBeInTheDocument()
  })

  it('caps each list and links to the full task list', () => {
    const many = Array.from({ length: 7 }, (_, index) =>
      buildTask({ id: `t${index}`, title: `Task ${index}`, dueDate: `2026-10-${String(10 + index).padStart(2, '0')}` }),
    )
    setup(many)
    expect(panelTitles('Upcoming')).toEqual(['Task 0', 'Task 1', 'Task 2', 'Task 3', 'Task 4'])
    expect(within(panel('Upcoming')).getByText('+2 more')).toBeInTheDocument()
    expect(within(panel('Upcoming')).getByRole('link', { name: 'View in My Tasks' })).toHaveAttribute('href', '#/tasks')
  })
})

describe('quick actions and navigation', () => {
  it('links to My Tasks from the header', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('link', { name: 'View all tasks' }))
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('My Tasks')
  })

  it('creates the first task with the shared task form and updates immediately', async () => {
    const { user, storage } = setup([])
    await user.click(screen.getByRole('button', { name: 'New task' }))
    const dialog = screen.getByRole('dialog', { name: 'New task' })
    await user.type(within(dialog).getByLabelText(/Title/), 'First task')
    await user.selectOptions(within(dialog).getByLabelText(/Priority/), 'low')
    await user.click(within(dialog).getByRole('button', { name: 'Create task' }))

    expect(screen.getByRole('status')).toHaveTextContent('Task "First task" created.')
    expect(statValue('Total tasks')).toHaveTextContent('1')
    expect(within(panel('Tasks by priority')).getByText('Low priority: 1 task (100% of all), 1 active')).toBeInTheDocument()
    expect(JSON.parse(storage.getItem(KEY)).tasks).toHaveLength(1)
  })

  it('opens a task from a deadline list for editing; moving its date updates both lists', async () => {
    const { user } = setup()
    await user.click(within(panel('Overdue')).getByRole('button', { name: 'Edit "Write report"' }))
    const dialog = screen.getByRole('dialog', { name: 'Edit task' })
    expect(within(dialog).getByLabelText(/Title/)).toHaveValue('Write report')

    const dateInput = within(dialog).getByLabelText(/Due date/)
    await user.clear(dateInput)
    await user.type(dateInput, '2026-10-20')
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }))

    expect(panelTitles('Overdue')).toEqual(['Pay rent'])
    expect(panelTitles('Upcoming')).toContain('Write report')
    expect(statValue('Overdue')).toHaveTextContent('1')
  })
})

describe('live updates from task changes elsewhere', () => {
  it('reflects completing, reopening and deleting tasks in My Tasks', async () => {
    const { user } = setup()

    await user.click(nav('My Tasks'))
    await user.click(screen.getByRole('checkbox', { name: 'Write report' }))
    await user.click(nav('Dashboard'))
    expect(statValue('Completed')).toHaveTextContent('2')
    expect(statValue('Overdue')).toHaveTextContent('1')
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '29')
    expect(panelTitles('Overdue')).toEqual(['Pay rent'])

    await user.click(nav('My Tasks'))
    await user.click(screen.getByRole('checkbox', { name: 'Write report' }))
    await user.click(nav('Dashboard'))
    expect(statValue('Completed')).toHaveTextContent('1')
    expect(panelTitles('Overdue')).toEqual(['Pay rent', 'Write report'])

    await user.click(nav('My Tasks'))
    await user.click(screen.getByRole('button', { name: 'Delete "Pay rent"' }))
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete task' }))
    await user.click(nav('Dashboard'))
    expect(statValue('Total tasks')).toHaveTextContent('6')
    expect(panelTitles('Overdue')).toEqual(['Write report'])
  })

  it('reflects edits made in My Tasks', async () => {
    const { user } = setup()
    await user.click(nav('My Tasks'))
    await user.click(screen.getByRole('button', { name: 'Edit "Plan trip"' }))
    await user.selectOptions(within(screen.getByRole('dialog')).getByLabelText(/Priority/), 'low')
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save changes' }))
    await user.click(nav('Dashboard'))
    expect(within(panel('Tasks by priority')).getByText('Low priority: 1 task (14% of all), 1 active')).toBeInTheDocument()
  })
})

describe('data safety', () => {
  it('never writes derived statistics to storage', () => {
    const { storage } = setup()
    expect(Object.keys(storage.entries())).toEqual([KEY])
    expect(storage.getItem(KEY)).toBe(entry(TASKS)[KEY])
  })
})
