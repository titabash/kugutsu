/**
 * Jest Setup File
 *
 * Common test configuration and mocks
 */

// Import @testing-library/jest-dom for custom matchers
import '@testing-library/jest-dom';

// Import React Flow mock
import { mockReactFlow } from './mocks/reactFlowMock';

// Initialize React Flow mocks (only in jsdom environment)
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  mockReactFlow();
}

// Polyfill TextEncoder/TextDecoder for Node.js environment
if (typeof TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = await import('util');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder as any;
}

// Polyfill Web Streams API for Node.js environment
if (typeof ReadableStream === 'undefined') {
  const { ReadableStream, WritableStream, TransformStream } = await import('stream/web');
  global.ReadableStream = ReadableStream as any;
  global.WritableStream = WritableStream as any;
  global.TransformStream = TransformStream as any;
}

// Polyfill AbortController and AbortSignal for tests
// Add throwIfAborted method if it doesn't exist (required by LangGraph)
if (typeof AbortController !== 'undefined') {
  const OriginalAbortSignal = AbortSignal.prototype;
  if (!('throwIfAborted' in OriginalAbortSignal)) {
    Object.defineProperty(OriginalAbortSignal, 'throwIfAborted', {
      value: function throwIfAborted() {
        if (this.aborted) {
          const error = new Error('signal is aborted without reason');
          error.name = 'AbortError';
          throw error;
        }
      },
      writable: true,
      configurable: true,
    });
  }
}

// Note: Due to Jest ESM bug (https://github.com/jestjs/jest/issues/13660),
// jest method calls in setup files can break unstable_mockModule resolution.
// Set timeout in individual test files instead.
