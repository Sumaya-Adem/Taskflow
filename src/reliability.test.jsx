import { act, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NOT_SAVED_NOTE } from './components/tasks/taskFeedback.js'
import { STORAGE_KEYS, STORAGE_VERSION } from './config/constants.js'
import { buildTask } from './test/fixtures.js'
import { createQuotaError } from './test/memoryStorage.js'
import { renderApp } from './test/renderApp.jsx'

const KEY = STORAGE_KEYS.TASKS
const NOW = new Date(2026, 9, 9, 12)
const entry = (tasks, version = STORAGE_VERSION) => ({ [KEY]: JSON.stringify({ version, tasks }) })
const toast = () => screen.getByRole('status', { name: 'Notifications' })
const failWrites = (storage, error = createQuotaError()) =>
  vi.spyOn(storage, 'setItem').mockImplementation(() => {
    throw error
  })

async function createViaDialog(user, title) {
  await user.click(screen.getByRole('button', { name: /^(New task|Create your first task)$/ }))
  await user.type(within(screen.getByRole('dialog')).getByLabelText(/Title/), `${title}{Enter}`)
}

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('no false success after failed writes', () => {
  it('reports a successful save plainly', async () => {
    const { user } = renderApp({ hash: '#/tasks' })
    await createViaDialog(user, 'Saved')
    expect(toast()).toHaveTextContent('Task "Saved" created.')
    expect(toast()).not.toHaveTextContent(NOT_SAVED_NOTE)
  })

  it('warns when a new task could not be saved, and the storage alert explains why', async () => {
    const { user, storage } = renderApp({ hash: '#/tasks' })
    failWrites(storage)
    await createViaDialog(user, 'Unsaved')

    expect(toast()).toHaveTextContent(`Task "Unsaved" created. ${NOT_SAVED_NOTE}`)
    expect(screen.getByRole('alert', { name: 'Storage is full' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Unsaved' })).toBeInTheDocument() // kept in memory, not lost
  })

  it('does not claim "Changes saved" when an edit fails to save', async () => {
    const { user, storage } = renderApp({ hash: '#/tasks', entries: entry([buildTask({ title: 'Original' })]) })
    failWrites(storage, new Error('disk error'))
    await user.click(screen.getByRole('button', { name: 'Edit "Original"' }))
    const title = within(screen.getByRole('dialog')).getByLabelText(/Title/)
    await user.clear(title)
    await user.type(title, 'Edited{Enter}')

    expect(toast()).not.toHaveTextContent('Changes saved.')
    expect(toast()).toHaveTextContent(`Task updated. ${NOT_SAVED_NOTE}`)
  })

  it('warns when completing a task cannot be saved because storage is unavailable', async () => {
    const { user } = renderApp({ hash: '#/tasks', storage: null })
    await createViaDialog(user, 'Memory task')
    expect(toast()).toHaveTextContent(NOT_SAVED_NOTE)
    await user.click(screen.getByRole('checkbox', { name: 'Memory task' }))
    expect(toast()).toHaveTextContent(`"Memory task" completed. ${NOT_SAVED_NOTE}`)
  })

  it('warns when a deletion cannot be saved', async () => {
    const { user, storage } = renderApp({ hash: '#/tasks', entries: entry([buildTask({ title: 'Doomed' })]) })
    failWrites(storage)
    await user.click(screen.getByRole('button', { name: 'Delete "Doomed"' }))
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete task' }))
    expect(toast()).toHaveTextContent(`Task "Doomed" deleted. ${NOT_SAVED_NOTE}`)
  })

  it('warns from the dashboard too', async () => {
    const { user, storage } = renderApp({ entries: entry([buildTask()]) })
    failWrites(storage)
    await createViaDialog(user, 'From dashboard')
    expect(toast()).toHaveTextContent(NOT_SAVED_NOTE)
  })

  it('never shows technical error details', async () => {
    const { user, storage } = renderApp({ hash: '#/tasks' })
    failWrites(storage, new Error('SecretInternalStackDetail at foo.js:12'))
    await createViaDialog(user, 'X')
    expect(document.body).not.toHaveTextContent('SecretInternalStackDetail')
  })
})

describe('cross-tab synchronization in the UI', () => {
  const externalWrite = (storage, value) => {
    storage.setItem(KEY, value)
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: KEY }))
    })
  }

  it('shows tasks added in another tab on My Tasks and the dashboard', async () => {
    const { user, storage } = renderApp({ hash: '#/tasks', entries: entry([buildTask({ id: 'a', title: 'Mine' })]) })
    externalWrite(storage, JSON.stringify({ version: 1, tasks: [buildTask({ id: 'a', title: 'Mine' }), buildTask({ id: 'b', title: 'Theirs' })] }))

    expect(screen.getByRole('checkbox', { name: 'Theirs' })).toBeInTheDocument()
    await user.click(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', { name: 'Dashboard' }))
    expect(within(screen.getByRole('region', { name: 'Task summary' })).getByText('Total tasks').nextElementSibling).toHaveTextContent('2')
  })

  it('keeps tasks visible and explains when another tab clears storage', () => {
    const { storage } = renderApp({ hash: '#/tasks', entries: entry([buildTask({ title: 'Still here' })]) })
    storage.removeItem(KEY)
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: KEY }))
    })
    expect(screen.getByRole('checkbox', { name: 'Still here' })).toBeInTheDocument()
    expect(screen.getByRole('status', { name: 'Tasks were cleared in another tab' })).toBeInTheDocument()
  })

  it('restores tasks when another tab writes unreadable data', () => {
    const { storage } = renderApp({ hash: '#/tasks', entries: entry([buildTask({ title: 'Precious' })]) })
    externalWrite(storage, 'garbage')
    expect(screen.getByRole('checkbox', { name: 'Precious' })).toBeInTheDocument()
    expect(screen.getByRole('status', { name: 'Saved data was damaged in another tab' })).toBeInTheDocument()
    expect(JSON.parse(storage.getItem(KEY)).tasks[0].title).toBe('Precious')
  })

  it('pauses saving when another tab writes a newer version', async () => {
    const { user, storage } = renderApp({ hash: '#/tasks', entries: entry([buildTask({ title: 'Local' })]) })
    const newer = JSON.stringify({ version: STORAGE_VERSION + 1, tasks: [] })
    externalWrite(storage, newer)
    expect(screen.getByRole('status', { name: 'Saved by a newer version' })).toBeInTheDocument()

    await createViaDialog(user, 'Kept in memory')
    expect(toast()).toHaveTextContent(NOT_SAVED_NOTE)
    expect(storage.getItem(KEY)).toBe(newer)
  })

  it('shows the most recent sync problem, not an older one', () => {
    const { storage } = renderApp({ hash: '#/tasks', entries: entry([buildTask({ title: 'Local' })]) })
    storage.removeItem(KEY)
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: KEY }))
    })
    expect(screen.getByRole('status', { name: 'Tasks were cleared in another tab' })).toBeInTheDocument()

    externalWrite(storage, JSON.stringify({ version: STORAGE_VERSION + 1, tasks: [] }))
    expect(screen.getByRole('status', { name: 'Saved by a newer version' })).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: 'Tasks were cleared in another tab' })).not.toBeInTheDocument()
  })

  it('updates the theme when another tab changes it', () => {
    const { storage } = renderApp()
    storage.setItem(STORAGE_KEYS.PREFERENCES, JSON.stringify({ theme: 'dark' }))
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEYS.PREFERENCES }))
    })
    expect(document.documentElement.dataset.theme).toBe('dark')
  })
})
