import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { STORAGE_KEYS, STORAGE_VERSION } from '../config/constants.js'
import { buildTask } from '../test/fixtures.js'
import { createQuotaError } from '../test/memoryStorage.js'
import { renderApp } from '../test/renderApp.jsx'

const KEY = STORAGE_KEYS.TASKS
// Local noon on 2026-10-09; only Date is faked so user-event timers still run.
const NOW = new Date(2026, 9, 9, 12)
const LATER = new Date(2026, 9, 10, 8, 30)

const tasksEntry = (tasks, version = STORAGE_VERSION) => ({ [KEY]: JSON.stringify({ version, tasks }) })
const storedTasks = (storage) => JSON.parse(storage.getItem(KEY)).tasks

function renderTasksPage(options = {}) {
  return renderApp({ hash: '#/tasks', ...options })
}

const dialog = () => screen.getByRole('dialog')
const field = (name) => within(dialog()).getByLabelText(name, { exact: false })
const itemFor = (title) => screen.getByRole('checkbox', { name: title }).closest('li')

async function createTask(user, { title, description, priority, category, dueDate } = {}) {
  await user.click(screen.getByRole('button', { name: /New task|Create your first task/ }))
  if (title) await user.type(field('Title'), title)
  if (description !== undefined) await user.type(field('Description'), description)
  if (priority) await user.selectOptions(field('Priority'), priority)
  if (category) await user.selectOptions(field('Category'), category)
  if (dueDate) fireEvent.change(field('Due date'), { target: { value: dueDate } })
  await user.click(within(dialog()).getByRole('button', { name: 'Create task' }))
}

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('empty and initial states', () => {
  it('shows an empty state with a way to create the first task', async () => {
    const { user } = renderTasksPage()
    expect(screen.getByRole('heading', { name: 'No tasks yet' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'New task' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Create your first task' }))
    expect(screen.getByRole('dialog', { name: 'New task' })).toBeInTheDocument()
    expect(field('Title')).toHaveFocus()
  })

  it('lists stored tasks with their details', () => {
    renderTasksPage({
      entries: tasksEntry([
        buildTask({
          id: 'a',
          title: 'Write report',
          description: 'Include Q3 numbers',
          priority: 'high',
          category: 'work',
          dueDate: '2026-10-20',
        }),
      ]),
    })
    const item = itemFor('Write report')
    expect(within(item).getByText('Include Q3 numbers')).toBeInTheDocument()
    expect(within(item).getByText('High priority')).toBeInTheDocument()
    expect(within(item).getByText('Work')).toBeInTheDocument()
    expect(within(item).getByText('Due Oct 20')).toHaveAttribute('datetime', '2026-10-20')
    expect(screen.getByText('1 active · 0 completed')).toBeInTheDocument()
  })

  it('omits optional details that are not set', () => {
    renderTasksPage({ entries: tasksEntry([buildTask({ title: 'Bare', description: '', dueDate: null })]) })
    const item = itemFor('Bare')
    expect(within(item).queryByText(/^Due/)).not.toBeInTheDocument()
    expect(item.querySelector('p')).toBeNull()
  })

  it('lists newest tasks first', () => {
    renderTasksPage({
      entries: tasksEntry([
        buildTask({ id: 'old', title: 'Older', createdAt: '2026-10-01T00:00:00.000Z' }),
        buildTask({ id: 'new', title: 'Newer', createdAt: '2026-10-05T00:00:00.000Z' }),
      ]),
    })
    expect(screen.getAllByRole('checkbox').map((box) => box.closest('li').querySelector('h3').textContent)).toEqual([
      'Newer',
      'Older',
    ])
  })

  it('distinguishes overdue, due-today, due-soon and completed tasks', () => {
    renderTasksPage({
      entries: tasksEntry([
        buildTask({ id: '1', title: 'Late', dueDate: '2026-10-07' }),
        buildTask({ id: '2', title: 'Today', dueDate: '2026-10-09' }),
        buildTask({ id: '3', title: 'Soon', dueDate: '2026-10-10' }),
        buildTask({ id: '4', title: 'Later', dueDate: '2026-11-30' }),
        buildTask({ id: '5', title: 'Done', dueDate: '2026-10-01', completed: true, completedAt: NOW.toISOString() }),
      ]),
    })
    expect(itemFor('Late')).toHaveClass('overdue')
    expect(within(itemFor('Late')).getByText('Overdue · due Oct 7')).toBeInTheDocument()
    expect(itemFor('Today')).toHaveClass('today')
    expect(within(itemFor('Today')).getByText('Due today')).toBeInTheDocument()
    expect(itemFor('Soon')).toHaveClass('soon')
    expect(within(itemFor('Soon')).getByText('Due tomorrow')).toBeInTheDocument()
    expect(itemFor('Later')).not.toHaveClass('overdue', 'soon', 'today', 'completed')
    expect(itemFor('Done')).toHaveClass('completed')
    expect(itemFor('Done')).not.toHaveClass('overdue')
    expect(within(itemFor('Done')).getByText('Completed today')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Done' })).toBeChecked()
  })
})

describe('creating tasks', () => {
  it('creates, normalizes, shows and persists a task', async () => {
    const { user, storage } = renderTasksPage()
    await createTask(user, {
      title: '  Plan sprint  ',
      description: 'Agenda draft',
      priority: 'high',
      category: 'work',
      dueDate: '2026-10-12',
    })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Task "Plan sprint" created.')
    const item = itemFor('Plan sprint')
    expect(within(item).getByText('High priority')).toBeInTheDocument()

    const [saved] = storedTasks(storage)
    expect(saved).toMatchObject({
      title: 'Plan sprint',
      description: 'Agenda draft',
      priority: 'high',
      category: 'work',
      dueDate: '2026-10-12',
      completed: false,
      completedAt: null,
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    })
    expect(saved.id).toEqual(expect.any(String))
  })

  it('uses defaults for optional fields', async () => {
    const { user, storage } = renderTasksPage()
    await createTask(user, { title: 'Minimal' })
    expect(storedTasks(storage)[0]).toMatchObject({ description: '', priority: 'medium', category: 'other', dueDate: null })
  })

  it.each([
    ['empty', ''],
    ['whitespace-only', '    '],
  ])('rejects an %s title, keeps the dialog open and saves nothing', async (_label, title) => {
    const { user, storage } = renderTasksPage()
    await createTask(user, { title })

    expect(dialog()).toBeInTheDocument()
    expect(field('Title')).toHaveAttribute('aria-invalid', 'true')
    expect(field('Title')).toHaveFocus()
    expect(within(dialog()).getByText('Title is required.')).toBeInTheDocument()
    expect(storage.getItem(KEY)).toBeNull()
  })

  it('rejects an over-limit title even if the input limit is bypassed', async () => {
    const { user, storage } = renderTasksPage()
    await user.click(screen.getByRole('button', { name: 'Create your first task' }))
    fireEvent.change(field('Title'), { target: { value: 'x'.repeat(121) } })
    await user.click(within(dialog()).getByRole('button', { name: 'Create task' }))
    expect(within(dialog()).getByText('Title must be 120 characters or fewer.')).toBeInTheDocument()
    expect(storage.getItem(KEY)).toBeNull()
  })

  it('accepts a title at exactly the limit', async () => {
    const { user, storage } = renderTasksPage()
    await user.click(screen.getByRole('button', { name: 'Create your first task' }))
    fireEvent.change(field('Title'), { target: { value: 'x'.repeat(120) } })
    await user.click(within(dialog()).getByRole('button', { name: 'Create task' }))
    expect(storedTasks(storage)[0].title).toHaveLength(120)
  })

  it('rejects an over-limit description', async () => {
    const { user, storage } = renderTasksPage()
    await user.click(screen.getByRole('button', { name: 'Create your first task' }))
    await user.type(field('Title'), 'Valid')
    fireEvent.change(field('Description'), { target: { value: 'd'.repeat(1001) } })
    await user.click(within(dialog()).getByRole('button', { name: 'Create task' }))
    expect(within(dialog()).getByText('Description must be 1000 characters or fewer.')).toBeInTheDocument()
    expect(storage.getItem(KEY)).toBeNull()
  })

  it('never stores an invalid due date (the date input rejects it)', async () => {
    const { user, storage } = renderTasksPage()
    await createTask(user, { title: 'Dated', dueDate: '2026-02-30' })
    expect(storedTasks(storage)[0].dueDate).toBeNull()
  })

  it('can be cancelled without saving, and starts fresh next time', async () => {
    const { user, storage } = renderTasksPage()
    await user.click(screen.getByRole('button', { name: 'Create your first task' }))
    await user.type(field('Title'), 'Abandoned')
    await user.click(within(dialog()).getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(storage.getItem(KEY)).toBeNull()
    expect(screen.getByRole('button', { name: 'Create your first task' })).toHaveFocus()

    await user.click(screen.getByRole('button', { name: 'Create your first task' }))
    expect(field('Title')).toHaveValue('')
  })

  it('closes on Escape (dialog cancel event) without saving', async () => {
    const { user, storage } = renderTasksPage()
    await user.click(screen.getByRole('button', { name: 'Create your first task' }))
    await user.type(field('Title'), 'Escaped')
    fireEvent(dialog(), new Event('cancel', { cancelable: true }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(storage.getItem(KEY)).toBeNull()
  })

  it('works entirely from the keyboard', async () => {
    const { user, storage } = renderTasksPage()
    screen.getByRole('button', { name: 'Create your first task' }).focus()
    await user.keyboard('{Enter}')
    expect(field('Title')).toHaveFocus()
    await user.keyboard('Keyboard only')

    const expectedTabOrder = ['Description', 'Priority', 'Category', 'Due date']
    for (const name of expectedTabOrder) {
      await user.tab()
      expect(field(name)).toHaveFocus()
    }
    await user.tab()
    expect(within(dialog()).getByRole('button', { name: 'Cancel' })).toHaveFocus()
    await user.tab()
    expect(within(dialog()).getByRole('button', { name: 'Create task' })).toHaveFocus()
    await user.keyboard('{Enter}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(storedTasks(storage)[0].title).toBe('Keyboard only')
  })

  it('submits with Enter from the title field', async () => {
    const { user, storage } = renderTasksPage()
    await user.click(screen.getByRole('button', { name: 'Create your first task' }))
    await user.type(field('Title'), 'Quick add{Enter}')
    expect(storedTasks(storage)[0].title).toBe('Quick add')
  })

  it('offers "New task" in the header once tasks exist', async () => {
    const { user } = renderTasksPage()
    await createTask(user, { title: 'First' })
    await createTask(user, { title: 'Second' })
    expect(screen.getAllByRole('checkbox')).toHaveLength(2)
  })
})

describe('editing tasks', () => {
  const original = buildTask({
    id: 'task-1',
    title: 'Original title',
    description: 'Original notes',
    priority: 'low',
    category: 'personal',
    dueDate: '2026-10-15',
    createdAt: '2026-10-01T09:00:00.000Z',
    updatedAt: '2026-10-01T09:00:00.000Z',
  })

  it('pre-fills the form, saves changes and preserves identity', async () => {
    vi.setSystemTime(LATER)
    const { user, storage } = renderTasksPage({ entries: tasksEntry([original]) })
    await user.click(screen.getByRole('button', { name: 'Edit "Original title"' }))

    expect(screen.getByRole('dialog', { name: 'Edit task' })).toBeInTheDocument()
    expect(field('Title')).toHaveValue('Original title')
    expect(field('Description')).toHaveValue('Original notes')
    expect(field('Priority')).toHaveValue('low')
    expect(field('Category')).toHaveValue('personal')
    expect(field('Due date')).toHaveValue('2026-10-15')

    await user.clear(field('Title'))
    await user.type(field('Title'), 'Updated title')
    await user.selectOptions(field('Priority'), 'high')
    fireEvent.change(field('Due date'), { target: { value: '' } })
    await user.click(within(dialog()).getByRole('button', { name: 'Save changes' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Changes saved.')
    expect(itemFor('Updated title')).toBeInTheDocument()
    expect(storedTasks(storage)).toEqual([
      {
        ...original,
        title: 'Updated title',
        priority: 'high',
        dueDate: null,
        updatedAt: LATER.toISOString(),
      },
    ])
  })

  it('cancelling leaves the task unchanged', async () => {
    const { user, storage } = renderTasksPage({ entries: tasksEntry([original]) })
    await user.click(screen.getByRole('button', { name: 'Edit "Original title"' }))
    await user.clear(field('Title'))
    await user.type(field('Title'), 'Not saved')
    await user.click(within(dialog()).getByRole('button', { name: 'Cancel' }))

    expect(itemFor('Original title')).toBeInTheDocument()
    expect(storage.getItem(KEY)).toBe(tasksEntry([original])[KEY])
    expect(screen.getByRole('button', { name: 'Edit "Original title"' })).toHaveFocus()
  })

  it('shows validation errors and keeps the saved task intact', async () => {
    const { user, storage } = renderTasksPage({ entries: tasksEntry([original]) })
    await user.click(screen.getByRole('button', { name: 'Edit "Original title"' }))
    await user.clear(field('Title'))
    await user.click(within(dialog()).getByRole('button', { name: 'Save changes' }))

    expect(within(dialog()).getByText('Title is required.')).toBeInTheDocument()
    expect(storage.getItem(KEY)).toBe(tasksEntry([original])[KEY])
  })

  it('reports when the task was deleted in another tab while editing', async () => {
    const { user, storage } = renderTasksPage({ entries: tasksEntry([original]) })
    await user.click(screen.getByRole('button', { name: 'Edit "Original title"' }))

    storage.setItem(KEY, JSON.stringify({ version: STORAGE_VERSION, tasks: [] }))
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: KEY }))
    })
    await user.click(within(dialog()).getByRole('button', { name: 'Save changes' }))

    expect(within(dialog()).getByRole('alert')).toHaveTextContent('This task no longer exists.')
    expect(storedTasks(storage)).toEqual([])
  })
})

describe('completing and reopening tasks', () => {
  it('completes a task with a timestamp and reopens it, persisting both', async () => {
    const task = buildTask({ id: 'a', title: 'Ship it' })
    const { user, storage } = renderTasksPage({ entries: tasksEntry([task]) })
    const checkbox = screen.getByRole('checkbox', { name: 'Ship it' })
    expect(checkbox).not.toBeChecked()

    await user.click(checkbox)
    expect(checkbox).toBeChecked()
    expect(itemFor('Ship it')).toHaveClass('completed')
    expect(screen.getByText('0 active · 1 completed')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('"Ship it" completed.')
    expect(storedTasks(storage)[0]).toMatchObject({
      completed: true,
      completedAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    })

    vi.setSystemTime(LATER)
    await user.click(checkbox)
    expect(checkbox).not.toBeChecked()
    expect(screen.getByRole('status')).toHaveTextContent('"Ship it" reopened.')
    expect(storedTasks(storage)[0]).toMatchObject({
      completed: false,
      completedAt: null,
      updatedAt: LATER.toISOString(),
    })
  })

  it('toggles with the keyboard (Space)', async () => {
    const { user, storage } = renderTasksPage({ entries: tasksEntry([buildTask({ title: 'Keyboard' })]) })
    screen.getByRole('checkbox', { name: 'Keyboard' }).focus()
    await user.keyboard(' ')
    expect(storedTasks(storage)[0].completed).toBe(true)
  })
})

describe('deleting tasks', () => {
  const tasks = [buildTask({ id: 'a', title: 'Keep me' }), buildTask({ id: 'b', title: 'Remove me' })]

  it('asks for confirmation naming the task, and cancelling keeps it', async () => {
    const { user, storage } = renderTasksPage({ entries: tasksEntry(tasks) })
    await user.click(screen.getByRole('button', { name: 'Delete "Remove me"' }))

    const confirm = screen.getByRole('alertdialog', { name: 'Delete task?' })
    expect(confirm).toHaveAccessibleDescription('"Remove me" will be permanently deleted. This cannot be undone.')
    expect(within(confirm).getByRole('button', { name: 'Cancel' })).toHaveFocus()

    await user.click(within(confirm).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(itemFor('Remove me')).toBeInTheDocument()
    expect(storage.getItem(KEY)).toBe(tasksEntry(tasks)[KEY])
  })

  it('deletes and persists after confirmation', async () => {
    const { user, storage } = renderTasksPage({ entries: tasksEntry(tasks) })
    await user.click(screen.getByRole('button', { name: 'Delete "Remove me"' }))
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete task' }))

    expect(screen.queryByRole('checkbox', { name: 'Remove me' })).not.toBeInTheDocument()
    expect(itemFor('Keep me')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Task "Remove me" deleted.')
    expect(storedTasks(storage).map((task) => task.id)).toEqual(['a'])
    // Focus returns to the page heading because the triggering button is gone.
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveFocus())
  })

  it('is fully keyboard operable', async () => {
    const { user, storage } = renderTasksPage({ entries: tasksEntry(tasks) })
    screen.getByRole('button', { name: 'Delete "Remove me"' }).focus()
    await user.keyboard('{Enter}')
    await user.tab() // Cancel → Delete task
    expect(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete task' })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(storedTasks(storage).map((task) => task.id)).toEqual(['a'])
  })

  it('shows the empty state after deleting the last task', async () => {
    const { user } = renderTasksPage({ entries: tasksEntry([tasks[0]]) })
    await user.click(screen.getByRole('button', { name: 'Delete "Keep me"' }))
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete task' }))
    expect(screen.getByRole('heading', { name: 'No tasks yet' })).toBeInTheDocument()
  })

  it('reports a task that was already deleted elsewhere', async () => {
    const { user, storage } = renderTasksPage({ entries: tasksEntry(tasks) })
    await user.click(screen.getByRole('button', { name: 'Delete "Remove me"' }))
    storage.setItem(KEY, JSON.stringify({ version: STORAGE_VERSION, tasks: [tasks[0]] }))
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: KEY }))
    })
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete task' }))
    expect(screen.getByRole('status')).toHaveTextContent('This task no longer exists.')
  })
})

describe('storage failures', () => {
  it('keeps the new task visible and alerts the user when saving fails', async () => {
    const { user, storage } = renderTasksPage()
    vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw createQuotaError()
    })
    await createTask(user, { title: 'Unsaved but kept' })

    expect(itemFor('Unsaved but kept')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Storage is full')
  })

  it('alerts when a deletion cannot be saved', async () => {
    const { user, storage } = renderTasksPage({ entries: tasksEntry([buildTask({ title: 'Doomed' })]) })
    vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw new Error('disk error')
    })
    await user.click(screen.getByRole('button', { name: 'Delete "Doomed"' }))
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete task' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Changes not saved')
  })

  it('works in memory when storage is unavailable', async () => {
    const { user } = renderTasksPage({ storage: null })
    expect(screen.getAllByRole('status')[0]).toHaveTextContent('Storage unavailable')
    await createTask(user, { title: 'Memory only' })
    expect(itemFor('Memory only')).toBeInTheDocument()
  })

  it('does not overwrite data from a newer app version', async () => {
    const raw = tasksEntry([buildTask()], STORAGE_VERSION + 1)[KEY]
    const { user, storage } = renderTasksPage({ entries: { [KEY]: raw } })
    await createTask(user, { title: 'Session only' })
    expect(storage.getItem(KEY)).toBe(raw)
  })
})
