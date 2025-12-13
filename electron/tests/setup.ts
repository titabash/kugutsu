import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

// Mock scrollIntoView (not supported in jsdom)
Element.prototype.scrollIntoView = () => {}

// Mock ResizeObserver (not supported in jsdom, needed by Radix UI)
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// Mock hasPointerCapture (not supported in jsdom, needed by Radix UI)
if (typeof Element.prototype.hasPointerCapture === 'undefined') {
  Element.prototype.hasPointerCapture = () => false
}
if (typeof Element.prototype.setPointerCapture === 'undefined') {
  Element.prototype.setPointerCapture = () => {}
}
if (typeof Element.prototype.releasePointerCapture === 'undefined') {
  Element.prototype.releasePointerCapture = () => {}
}

// Cleanup after each test
afterEach(() => {
  cleanup()
})
