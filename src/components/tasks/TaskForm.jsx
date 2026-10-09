import { useRef, useState } from 'react'
import { CATEGORIES, DEFAULT_CATEGORY, DEFAULT_PRIORITY, PRIORITIES, TASK_LIMITS } from '../../config/constants.js'
import { EDITABLE_FIELDS } from '../../domain/task.js'
import { Button } from '../ui/Button.jsx'
import { FormField } from '../ui/FormField.jsx'
import styles from './TaskForm.module.css'

/** Form state for a task (all strings, as form controls use them). */
function toFormValues(task) {
  return {
    title: task?.title ?? '',
    description: task?.description ?? '',
    priority: task?.priority ?? DEFAULT_PRIORITY,
    category: task?.category ?? DEFAULT_CATEGORY,
    dueDate: task?.dueDate ?? '',
  }
}

/**
 * Create/edit form for a task. It holds only form state: validation and
 * normalization happen in the domain layer, reached through `onSubmit`,
 * which must return `{ ok: true }` or `{ ok: false, errors }` (the shape of
 * the useTasks() actions). On failure the errors are shown and focus moves
 * to the first invalid field.
 *
 * `maxLength` attributes mirror the configured limits to stop over-long
 * input early; the domain validation remains the source of truth.
 */
export function TaskForm({ task, submitLabel, onSubmit, onCancel, titleInputRef }) {
  const [values, setValues] = useState(() => toFormValues(task))
  const [errors, setErrors] = useState({})
  // Guards against double submission (e.g. a double click) before the parent closes the form.
  const submittingRef = useRef(false)
  const formRef = useRef(null)

  const handleChange = (field) => (event) => {
    const { value } = event.target
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => {
      if (!current[field]) return current
      const { [field]: _removed, ...rest } = current
      return rest
    })
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (submittingRef.current) return
    submittingRef.current = true

    const result = onSubmit(values)
    if (result.ok) return // Stays locked: the parent closes the form on success.

    submittingRef.current = false
    setErrors(result.errors)
    const firstInvalid = EDITABLE_FIELDS.find((field) => result.errors[field])
    if (firstInvalid) formRef.current?.elements.namedItem(firstInvalid)?.focus()
  }

  return (
    <form ref={formRef} className={styles.form} onSubmit={handleSubmit} noValidate>
      <p className={styles.requiredNote}>
        Fields marked <span aria-hidden="true">*</span>
        <span className="visually-hidden">with an asterisk</span> are required.
      </p>

      {errors.form && (
        <p className={styles.formError} role="alert">
          {errors.form}
        </p>
      )}

      <FormField
        label="Title"
        required
        error={errors.title}
        count={values.title.length}
        maxLength={TASK_LIMITS.titleMaxLength}
      >
        {(fieldProps) => (
          <input
            {...fieldProps}
            ref={titleInputRef}
            name="title"
            type="text"
            autoComplete="off"
            maxLength={TASK_LIMITS.titleMaxLength}
            value={values.title}
            onChange={handleChange('title')}
            placeholder="What needs to be done?"
          />
        )}
      </FormField>

      <FormField
        label="Description"
        error={errors.description}
        count={values.description.length}
        maxLength={TASK_LIMITS.descriptionMaxLength}
      >
        {(fieldProps) => (
          <textarea
            {...fieldProps}
            name="description"
            rows={4}
            maxLength={TASK_LIMITS.descriptionMaxLength}
            value={values.description}
            onChange={handleChange('description')}
            placeholder="Add details, links or notes"
          />
        )}
      </FormField>

      <div className={styles.row}>
        <FormField label="Priority" required error={errors.priority}>
          {(fieldProps) => (
            <select {...fieldProps} name="priority" value={values.priority} onChange={handleChange('priority')}>
              {PRIORITIES.map((priority) => (
                <option key={priority.value} value={priority.value}>
                  {priority.label}
                </option>
              ))}
            </select>
          )}
        </FormField>

        <FormField label="Category" required error={errors.category}>
          {(fieldProps) => (
            <select {...fieldProps} name="category" value={values.category} onChange={handleChange('category')}>
              {CATEGORIES.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          )}
        </FormField>

        <FormField label="Due date" error={errors.dueDate}>
          {(fieldProps) => (
            <input {...fieldProps} name="dueDate" type="date" value={values.dueDate} onChange={handleChange('dueDate')} />
          )}
        </FormField>
      </div>

      <div className={styles.actions}>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  )
}
