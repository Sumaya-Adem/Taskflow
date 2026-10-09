/**
 * Turns persistence state into a user-facing notice (or null). Pure, so the
 * wording and precedence can be tested without rendering. Messages explain
 * what happened and what to do, without technical details.
 */

import { LOAD_STATUS, SAVE_ERROR } from '../storage/storage.js'
import { SYNC_NOTICE } from './tasksReducer.js'

export const NOTICE_TONES = Object.freeze({ WARNING: 'warning', ERROR: 'error' })

const BACKUP_SENTENCE = 'A backup of the original data was kept in this browser.'

function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`
}

function saveErrorNotice(reason) {
  if (reason === SAVE_ERROR.QUOTA_EXCEEDED) {
    return {
      tone: NOTICE_TONES.ERROR,
      title: 'Storage is full',
      message:
        'Your latest changes are only kept in this tab. Free up browser storage (for example by clearing data for other sites), then make another change to save again.',
    }
  }
  if (reason === SAVE_ERROR.WRITE_FAILED) {
    return {
      tone: NOTICE_TONES.ERROR,
      title: 'Changes not saved',
      message: 'Your latest changes could not be saved to this browser and will be lost when you close this tab.',
    }
  }
  return null
}

function syncNoticeFor(syncNotice) {
  if (syncNotice === SYNC_NOTICE.REMOVED) {
    return {
      tone: NOTICE_TONES.WARNING,
      title: 'Tasks were cleared in another tab',
      message:
        'Your tasks are still shown here and will be saved again when you make a change. Reload the page if you want the cleared list instead.',
    }
  }
  if (syncNotice === SYNC_NOTICE.RESTORED) {
    return {
      tone: NOTICE_TONES.WARNING,
      title: 'Saved data was damaged in another tab',
      message: `TaskFlow restored your tasks from this tab. ${BACKUP_SENTENCE}`,
    }
  }
  return null
}

function loadNotice({ loadStatus, writable, droppedCount }) {
  switch (loadStatus) {
    case LOAD_STATUS.UNAVAILABLE:
      return {
        tone: NOTICE_TONES.WARNING,
        title: 'Storage unavailable',
        message:
          'Your browser is blocking local storage, so tasks will only last until you close this tab. Check your privacy settings to enable saving.',
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
            message: `TaskFlow started with an empty list. ${BACKUP_SENTENCE}`,
          }
        : {
            tone: NOTICE_TONES.ERROR,
            title: 'Saved data could not be read',
            message:
              'Saving is paused to protect your original data, because a backup copy could not be created. Free up browser storage and reload the page.',
          }
    case LOAD_STATUS.REPAIRED:
      // Silent repairs (e.g. format migrations) need no notice; lost records do.
      if (droppedCount === 0) return null
      return {
        tone: writable ? NOTICE_TONES.WARNING : NOTICE_TONES.ERROR,
        title: 'Some tasks could not be recovered',
        message: writable
          ? `${pluralize(droppedCount, 'damaged task')} could not be loaded. ${BACKUP_SENTENCE}`
          : `${pluralize(droppedCount, 'damaged task')} could not be loaded. Saving is paused to protect your original data.`,
      }
    default:
      return null
  }
}

/**
 * Precedence: a failed save (the most recent problem), then an external change
 * this tab rejected, then the load outcome. Returns null when there is nothing
 * to show or the user dismissed the notice.
 */
export function getStorageNotice(persistence) {
  if (!persistence || persistence.noticeDismissed) return null
  return saveErrorNotice(persistence.saveError) ?? syncNoticeFor(persistence.syncNotice) ?? loadNotice(persistence)
}
