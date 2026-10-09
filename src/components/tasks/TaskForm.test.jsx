import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TASK_LIMITS } from '../../config/constants.js'
import { validateTaskInput } from '../../domain/task.js'
import { buildTask } from '../../test/fixtures.js'
import { TaskForm } from './TaskForm.jsx'

/** onSubmit backed by the real domain validation, like the useTasks() actions. */
const validatingSubmit = vi.fn((values) => {
  const result = validateTaskInput(values)
  return result.isValid ? { ok: true } : { ok: false, errors: result.errors }
})

function setup(props = {}) {
  const onSubmit = props.onSubmit ?? vi.fn(() => ({ ok: true }))
  const onCancel = vi.fn()
  const user = userEvent.setup()
  render(<TaskForm submitLabel="Create task" onSubmit={onSubmit} onCancel={onCancel} {...props} />)
  return { user, onSubmit, onCancel }
}

const field = (name) => screen.getByLabelText(name, { exact: false })

describe('TaskForm', () => {
  it('labels every field and marks required ones', () => {
    setup()
    expect(screen.getByRole('textbox', { name: /Title/ })).toHaveAttribute('aria-required', 'true')
    expect(screen.getByRole('textbox', { name: /Description/ })).not.toHaveAttribute('aria-required')
    expect(screen.getByRole('combobox', { name: /Priority/ })).toHaveAttribute('aria-required', 'true')
    expect(screen.getByRole('combobox', { name: /Category/ })).toHaveAttribute('aria-required', 'true')
    expect(field('Due date')).toHaveAttribute('type', 'date')
    expect(screen.getByText(/are required/)).toBeInTheDocument()
  })

  it('starts with sensible defaults for a new task', () => {
    setup()
    expect(field('Title')).toHaveValue('')
    expect(field('Priority')).toHaveValue('medium')
    expect(field('Category')).toHaveValue('other')
    expect(field('Due date')).toHaveValue('')
  })

  it('pre-fills the values of an existing task', () => {
    setup({
      task: buildTask({ title: 'Existing', description: 'Notes', priority: 'high', category: 'health', dueDate: '2026-10-20' }),
    })
    expect(field('Title')).toHaveValue('Existing')
    expect(field('Description')).toHaveValue('Notes')
    expect(field('Priority')).toHaveValue('high')
    expect(field('Category')).toHaveValue('health')
    expect(field('Due date')).toHaveValue('2026-10-20')
  })

  it('applies the configured length limits and shows character counters', async () => {
    const { user } = setup()
    expect(field('Title')).toHaveAttribute('maxLength', String(TASK_LIMITS.titleMaxLength))
    expect(field('Description')).toHaveAttribute('maxLength', String(TASK_LIMITS.descriptionMaxLength))

    await user.type(field('Title'), 'Hello')
    expect(screen.getByText(`5/${TASK_LIMITS.titleMaxLength}`)).toBeInTheDocument()
    expect(field('Title')).toHaveAccessibleDescription(`5 of ${TASK_LIMITS.titleMaxLength} characters used`)
  })

  it('submits the raw values to onSubmit (normalization is left to the domain layer)', async () => {
    const { user, onSubmit } = setup()
    await user.type(field('Title'), '  Buy milk  ')
    await user.selectOptions(field('Priority'), 'high')
    await user.selectOptions(field('Category'), 'shopping')
    fireEvent.change(field('Due date'), { target: { value: '2026-10-12' } })
    await user.click(screen.getByRole('button', { name: 'Create task' }))

    expect(onSubmit).toHaveBeenCalledWith({
      title: '  Buy milk  ',
      description: '',
      priority: 'high',
      category: 'shopping',
      dueDate: '2026-10-12',
    })
  })

  it('submits with the Enter key', async () => {
    const { user, onSubmit } = setup()
    await user.type(field('Title'), 'Keyboard task{Enter}')
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('shows field errors accessibly and focuses the first invalid field', async () => {
    const { user } = setup({ onSubmit: validatingSubmit })
    await user.type(field('Title'), '   ')
    await user.click(screen.getByRole('button', { name: 'Create task' }))

    const title = field('Title')
    expect(title).toHaveAttribute('aria-invalid', 'true')
    expect(title).toHaveAccessibleDescription(expect.stringContaining('Title is required.'))
    expect(title).toHaveFocus()
  })

  it('shows domain errors for priority, category and due date', async () => {
    const onSubmit = () => ({
      ok: false,
      errors: {
        priority: 'Choose a valid priority.',
        category: 'Choose a valid category.',
        dueDate: 'Enter a valid date.',
      },
    })
    const { user } = setup({ onSubmit })
    await user.type(field('Title'), 'Valid title')
    await user.click(screen.getByRole('button', { name: 'Create task' }))

    expect(field('Priority')).toHaveAccessibleDescription('Choose a valid priority.')
    expect(field('Category')).toHaveAccessibleDescription('Choose a valid category.')
    expect(field('Due date')).toHaveAccessibleDescription('Enter a valid date.')
    expect(field('Priority')).toHaveFocus()
  })

  it('reports an over-limit title that bypassed maxLength (e.g. programmatic input)', async () => {
    const { user } = setup({ onSubmit: validatingSubmit })
    fireEvent.change(field('Title'), { target: { value: 'a'.repeat(TASK_LIMITS.titleMaxLength + 1) } })
    await user.click(screen.getByRole('button', { name: 'Create task' }))
    expect(screen.getByText(`Title must be ${TASK_LIMITS.titleMaxLength} characters or fewer.`)).toBeInTheDocument()
  })

  it('reports an over-limit description', async () => {
    const { user } = setup({ onSubmit: validatingSubmit })
    await user.type(field('Title'), 'Valid')
    fireEvent.change(field('Description'), { target: { value: 'd'.repeat(TASK_LIMITS.descriptionMaxLength + 1) } })
    await user.click(screen.getByRole('button', { name: 'Create task' }))
    expect(field('Description')).toHaveAttribute('aria-invalid', 'true')
    expect(field('Description')).toHaveFocus()
  })

  it('clears a field error once the user edits that field', async () => {
    const { user } = setup({ onSubmit: validatingSubmit })
    await user.click(screen.getByRole('button', { name: 'Create task' }))
    expect(screen.getByText('Title is required.')).toBeInTheDocument()
    await user.type(field('Title'), 'x')
    expect(screen.queryByText('Title is required.')).not.toBeInTheDocument()
    expect(field('Title')).not.toHaveAttribute('aria-invalid')
  })

  it('shows form-level errors in an alert', async () => {
    const { user } = setup({ onSubmit: () => ({ ok: false, errors: { form: 'This task no longer exists.' } }) })
    await user.type(field('Title'), 'Anything')
    await user.click(screen.getByRole('button', { name: 'Create task' }))
    expect(screen.getByRole('alert')).toHaveTextContent('This task no longer exists.')
  })

  it('ignores a second submission while the first one succeeds', () => {
    const { onSubmit } = setup()
    const form = field('Title').closest('form')
    fireEvent.submit(form)
    fireEvent.submit(form)
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('allows resubmitting after a failed attempt', async () => {
    const { user } = setup({ onSubmit: validatingSubmit })
    validatingSubmit.mockClear()
    await user.click(screen.getByRole('button', { name: 'Create task' }))
    await user.type(field('Title'), 'Fixed')
    await user.click(screen.getByRole('button', { name: 'Create task' }))
    expect(validatingSubmit).toHaveBeenCalledTimes(2)
    expect(validatingSubmit.mock.results[1].value).toEqual({ ok: true })
  })

  it('calls onCancel without submitting', async () => {
    const { user, onCancel, onSubmit } = setup()
    await user.type(field('Title'), 'Draft')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
