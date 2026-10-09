import { useEffect, useId, useRef } from 'react'
import { Button } from './Button.jsx'
import { Icon } from './Icon.jsx'
import styles from './Modal.module.css'

/** Where focus goes if the element that opened the dialog no longer exists (e.g. it was deleted). */
function getFallbackFocusTarget() {
  return document.querySelector('main h1') ?? document.body
}

/**
 * Accessible modal dialog built on the native <dialog> element, which
 * provides focus containment, an inert background and Escape handling.
 * Mount it to open and unmount it to close; `onClose` is called for the
 * close button and Escape (the native `cancel` event).
 *
 * On open, focus moves to `initialFocusRef` (or the dialog); on close it
 * returns to the element that was focused before opening.
 */
export function Modal({ title, description, onClose, initialFocusRef, role = 'dialog', children }) {
  const dialogRef = useRef(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    const previouslyFocused = document.activeElement

    // showModal() is supported by all current browsers; the attribute
    // fallback keeps older browsers (and jsdom) usable as a non-modal dialog.
    if (typeof dialog.showModal === 'function') dialog.showModal()
    else dialog.setAttribute('open', '')
    ;(initialFocusRef?.current ?? dialog).focus()

    return () => {
      if (typeof dialog.close === 'function' && dialog.open) dialog.close()
      const target = previouslyFocused?.isConnected ? previouslyFocused : getFallbackFocusTarget()
      target.focus?.()
    }
  }, [initialFocusRef])

  const handleCancel = (event) => {
    event.preventDefault() // Let React state decide when the dialog closes.
    onClose()
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      role={role === 'alertdialog' ? 'alertdialog' : undefined}
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      tabIndex={-1}
      onCancel={handleCancel}
    >
      <div className={styles.header}>
        <div className={styles.headings}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          {description && (
            <p id={descriptionId} className={styles.description}>
              {description}
            </p>
          )}
        </div>
        <Button variant="ghost" iconOnly className={styles.close} onClick={onClose} aria-label="Close dialog">
          <Icon name="close" />
        </Button>
      </div>
      <div className={styles.body}>{children}</div>
    </dialog>
  )
}
