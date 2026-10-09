/**
 * Turns persistence state into a user-facing notice (or null). Pure, so the
 * wording and precedence can be tested without rendering.
 */

import { LOAD_STATUS, SAVE_ERROR } from '../storage/storage.js'

export const NOTICE_TONES = Object.freeze({ WARNING: 'warning', ERROR: 'error' })

function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`
}

function saveErrorNotice(reason) {
  if (reason === SAVE_ERROR.QUOTA_EXCEEDED) {
    return {
      tone: NOTICE_TONES.ERROR,
      title: 'Storage is full',
      message: 'Your latest changes could not be saved. Free up browser storage, then try again.',
    }
  }
  if (reason === SAVE_ERROR.WRITE_FAILED) {
    return {
      tone: NOTICE_TONES.ERROR,
      title: 'Changes not saved',
      message: 'Your latest changes could not be saved to this browser. They will be lost when you close this tab.',
    }
  }
  return null
}

function loadNotice({ loadStatus, writable, backupKey, droppedCount }) {
  switch (loadStatus) {
    case LOAD_STATUS.UNAVAILABLE:
      return {
        tone: NOTICE_TONES.WARNING,
        title: 'Storage unavailable',
        message:
          'Your browser is blocking local storage, so tasks will only last until you close this tab.',
      }
    case LOAD_STATUS.UNSUPPORTED_VERSION:
      return {
        tone: NOTICE_TONES.WARNING,
        title: 'Saved by a newer version',
        message:
          'Your tasks were saved by a newer version of TaskFlow. Saving is paused so they are not overwritten. Reload the page to update.',
      }
    case LOAD_STATUS.CORRUPT:
      return writable
        ? {
            tone: NOTICE_TONES.WARNING,
            title: 'Saved data could not be read',
            message: `TaskFlow started with an empty list. A copy of the original data was kept as "${backupKey}".`,
          }
        : {
            tone: NOTICE_TONES.ERROR,
            title: 'Saved data could not be read',
            message: 'Saving is paused to protect your original data, because a backup copy could not be created.',
          }
    case LOAD_STATUS.REPAIRED:
      // Silent repairs (e.g. format migrations) need no notice; lost records do.
      if (droppedCount === 0) return null
      return {
        tone: writable ? NOTICE_TONES.WARNING : NOTICE_TONES.ERROR,
        title: 'Some tasks could not be recovered',
        message: writable
          ? `${pluralize(droppedCount, 'damaged task')} could not be loaded. A copy of the original data was kept as "${backupKey}".`
          : `${pluralize(droppedCount, 'damaged task')} could not be loaded. Saving is paused to protect your original data.`,
      }
    default:
      return null
  }
}

/**
 * Save errors take precedence (they are the most recent problem); otherwise
 * the load outcome is reported. Returns null when there is nothing to show
 * or the user dismissed the notice.
 */
export function getStorageNotice(persistence) {
  if (!persistence || persistence.noticeDismissed) return null
  return saveErrorNotice(persistence.saveError) ?? loadNotice(persistence)
}
