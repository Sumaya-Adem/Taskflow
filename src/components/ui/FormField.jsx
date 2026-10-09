import { useId } from 'react'
import { Icon } from './Icon.jsx'
import styles from './FormField.module.css'

/**
 * Label, hint, character counter and error message wiring for one control.
 * `children` is a render function that receives the id, class name and
 * accessibility props to spread onto the control, so labels and messages are
 * always associated:
 *
 *   <FormField label="Title" required>{(props) => <input {...props} />}</FormField>
 *
 * Set `showOptional={false}` for controls where "(optional)" adds no meaning,
 * such as filters.
 */
export function FormField({
  label,
  required = false,
  showOptional = true,
  hint,
  error,
  count,
  maxLength,
  children,
}) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const counterId = `${id}-counter`
  const showCounter = maxLength !== undefined && count !== undefined

  const describedBy = [error && errorId, hint && hintId, showCounter && counterId].filter(Boolean).join(' ')

  return (
    <div className={styles.field}>
      <div className={styles.labelRow}>
        <label htmlFor={id} className={styles.label}>
          {label}
          {required ? (
            <span className={styles.required} aria-hidden="true">
              *
            </span>
          ) : (
            showOptional && <span className={styles.optional}>(optional)</span>
          )}
        </label>
        {showCounter && (
          <span id={counterId} className={`${styles.counter} ${count >= maxLength ? styles.counterLimit : ''}`}>
            <span aria-hidden="true">
              {count}/{maxLength}
            </span>
            <span className="visually-hidden">
              {count} of {maxLength} characters used
            </span>
          </span>
        )}
      </div>
      {children({
        id,
        className: styles.control,
        'aria-required': required || undefined,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy || undefined,
      })}
      {hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className={styles.error}>
          <Icon name="alert" size={14} />
          {error}
        </p>
      )}
    </div>
  )
}
