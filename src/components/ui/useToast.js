import { useCallback, useRef, useState } from 'react'

/**
 * State for the <Toast> component: `notify(message, tone)` shows a message
 * (re-announcing it even if the text repeats), `notifyOutcome({ message, tone })`
 * shows a prepared outcome, and `dismissToast` hides it.
 */
export function useToast() {
  const [toast, setToast] = useState(null)
  const idRef = useRef(0)

  const notify = useCallback((message, tone = 'success') => {
    idRef.current += 1
    setToast({ id: idRef.current, message, tone })
  }, [])
  const notifyOutcome = useCallback(({ message, tone }) => notify(message, tone), [notify])
  const dismissToast = useCallback(() => setToast(null), [])

  return { toast, notify, notifyOutcome, dismissToast }
}
