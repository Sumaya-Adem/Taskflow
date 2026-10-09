import { getStorageNotice } from '../../state/storageNotice.js'
import { useTasks } from '../../state/useTasks.js'
import { Notice } from '../ui/Notice.jsx'

/** Shows storage problems (unavailable, corrupt data, failed saves) from task state. */
export function StorageNotice() {
  const { persistence, dismissStorageNotice } = useTasks()
  const notice = getStorageNotice(persistence)
  if (!notice) return null
  return <Notice {...notice} onDismiss={dismissStorageNotice} />
}
