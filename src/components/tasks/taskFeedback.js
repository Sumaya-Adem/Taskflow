/**
 * Feedback text for task actions. A change that could not be saved must never
 * be reported as a plain success, so it gets a warning tone and says what
 * will happen to it.
 */

export const NOT_SAVED_NOTE = 'This change was not saved and will be lost when you reload or close this tab.'

/** `{ message, tone }` for the Toast, based on whether the change was saved. */
export function describeOutcome(message, saved) {
  return saved ? { message, tone: 'success' } : { message: `${message} ${NOT_SAVED_NOTE}`, tone: 'warning' }
}
