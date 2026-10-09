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

  it('names the backup when corrupt data was preserved', () => {
    const notice = getStorageNotice(persistence({ loadStatus: LOAD_STATUS.CORRUPT, backupKey: 'taskflow:tasks:backup:x' }))
    expect(notice.tone).toBe(NOTICE_TONES.WARNING)
    expect(notice.message).toContain('taskflow:tasks:backup:x')
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
