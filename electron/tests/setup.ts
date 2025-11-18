import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

// Mock scrollIntoView (not supported in jsdom)
Element.prototype.scrollIntoView = () => {}

// Cleanup after each test
afterEach(() => {
  cleanup()
})
