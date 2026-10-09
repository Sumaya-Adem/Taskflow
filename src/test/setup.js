import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
  localStorage.clear()
  // Reset global browser state that components touch.
  window.history.replaceState(null, '', '/')
  delete document.documentElement.dataset.theme
  document.title = ''
})
