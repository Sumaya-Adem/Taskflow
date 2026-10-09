import { describe, expect, it } from 'vitest'
import { LOAD_STATUS, SAVE_ERROR } from '../storage/storage.js'
import { NOTICE_TONES, getStorageNotice } from './storageNotice.js'

const persistence = (overrides = {}) => ({
  loadStatus: LOAD_STATUS.OK,
  writable: true,
  backupKey: null,
  droppedCount: 0,
  saveError: null,
  noticeDismissed: false,
  ...overrides,
})

describe('getStorageNotice', () => {
  it.each([LOAD_STATUS.OK, LOAD_STATUS.EMPTY])('shows nothing when status is %s', (loadStatus) => {
    expect(getStorageNotice(persistence({ loadStatus }))).toBeNull()
  })

  it('shows nothing for silent repairs where no task was lost', () => {
    expect(getStorageNotice(persistence({ loadStatus: LOAD_STATUS.REPAIRED, droppedCount: 0 }))).toBeNull()
  })

  it('warns when storage is unavailable', () => {
    expect(getStorageNotice(persistence({ loadStatus: LOAD_STATUS.UNAVAILABLE, writable: false }))).toMatchObject({
      tone: NOTICE_TONES.WARNING,
      title: 'Storage unavailable',
    })
  })

  it('warns about newer-version data', () => {
    const notice = getStorageNotice(persistence({ loadStatus: LOAD_STATUS.UNSUPPORTED_VERSION, writable: false }))
    expect(notice.title).toBe('Saved by a newer version')
    expect(notice.message).toMatch(/Saving is paused/)
  })

  it('mentions the backup in plain language, without exposing storage keys', () => {
    const notice = getStorageNotice(persistence({ loadStatus: LOAD_STATUS.CORRUPT, backupKey: 'taskflow:tasks:backup:x' }))
    expect(notice.tone).toBe(NOTICE_TONES.WARNING)
    expect(notice.message).toContain('A backup of the original data was kept in this browser.')
    expect(notice.message).not.toContain('taskflow:')
  })

  it('reports an error when corrupt data could not be backed up', () => {
    const notice = getStorageNotice(persistence({ loadStatus: LOAD_STATUS.CORRUPT, writable: false }))
    expect(notice.tone).toBe(NOTICE_TONES.ERROR)
    expect(notice.message).toMatch(/Saving is paused/)
  })

  it('counts lost tasks with correct pluralization', () => {
    const one = getStorageNotice(persistence({ loadStatus: LOAD_STATUS.REPAIRED, droppedCount: 1, backupKey: 'k' }))
    const many = getStorageNotice(persistence({ loadStatus: LOAD_STATUS.REPAIRED, droppedCount: 3, backupKey: 'k' }))
    expect(one.message).toMatch(/^1 damaged task could not/)
    expect(many.message).toMatch(/^3 damaged tasks could not/)
  })

  it('reports lost tasks as an error when the backup failed', () => {
    const notice = getStorageNotice(persistence({ loadStatus: LOAD_STATUS.REPAIRED, droppedCount: 2, writable: false }))
    expect(notice.tone).toBe(NOTICE_TONES.ERROR)
  })

  it.each([
    [SAVE_ERROR.QUOTA_EXCEEDED, 'Storage is full'],
    [SAVE_ERROR.WRITE_FAILED, 'Changes not saved'],
  ])('reports save error %s', (saveError, title) => {
    expect(getStorageNotice(persistence({ saveError }))).toMatchObject({ tone: NOTICE_TONES.ERROR, title })
  })

  it('gives a save error precedence over the load status', () => {
    const notice = getStorageNotice(persistence({ loadStatus: LOAD_STATUS.CORRUPT, backupKey: 'k', saveError: SAVE_ERROR.QUOTA_EXCEEDED }))
    expect(notice.title).toBe('Storage is full')
  })

  it('falls back to the load notice for save errors without their own message', () => {
    const notice = getStorageNotice(
      persistence({ loadStatus: LOAD_STATUS.UNSUPPORTED_VERSION, writable: false, saveError: SAVE_ERROR.READ_ONLY }),
    )
    expect(notice.title).toBe('Saved by a newer version')
  })

  it('shows nothing once dismissed or without input', () => {
    expect(getStorageNotice(persistence({ saveError: SAVE_ERROR.WRITE_FAILED, noticeDismissed: true }))).toBeNull()
    expect(getStorageNotice(undefined)).toBeNull()
  })
})

describe('Phase 6: sync notices and wording', () => {
  it('explains tasks cleared in another tab', () => {
    const notice = getStorageNotice(persistence({ syncNotice: 'removed' }))
    expect(notice).toMatchObject({ tone: NOTICE_TONES.WARNING, title: 'Tasks were cleared in another tab' })
    expect(notice.message).toMatch(/still shown here/)
  })

  it('explains data restored after damage in another tab', () => {
    const notice = getStorageNotice(persistence({ syncNotice: 'restored', backupKey: 'taskflow:tasks:backup:y' }))
    expect(notice.title).toBe('Saved data was damaged in another tab')
    expect(notice.message).not.toContain('taskflow:')
  })

  it('puts save errors before sync notices, and sync notices before load notices', () => {
    expect(getStorageNotice(persistence({ syncNotice: 'removed', saveError: SAVE_ERROR.WRITE_FAILED })).title).toBe('Changes not saved')
    expect(getStorageNotice(persistence({ loadStatus: LOAD_STATUS.CORRUPT, syncNotice: 'restored' })).title).toBe(
      'Saved data was damaged in another tab',
    )
  })

  it('tells the user what to do next in every notice', () => {
    const cases = [
      persistence({ loadStatus: LOAD_STATUS.UNAVAILABLE, writable: false }),
      persistence({ loadStatus: LOAD_STATUS.UNSUPPORTED_VERSION, writable: false }),
      persistence({ loadStatus: LOAD_STATUS.CORRUPT, writable: false }),
      persistence({ saveError: SAVE_ERROR.QUOTA_EXCEEDED }),
      persistence({ syncNotice: 'removed' }),
    ]
    for (const state of cases) {
      expect(getStorageNotice(state).message).toMatch(/reload|free up|check|make a change|lost when/i)
    }
  })
})
