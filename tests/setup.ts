/**
 * Jest Setup File
 *
 * Common test configuration and mocks
 */

// Import @testing-library/jest-dom for custom matchers
import '@testing-library/jest-dom';

// Import React Flow mock
import { mockReactFlow } from './mocks/reactFlowMock';

// Initialize React Flow mocks
mockReactFlow();

// Note: Due to Jest ESM bug (https://github.com/jestjs/jest/issues/13660),
// jest method calls in setup files can break unstable_mockModule resolution.
// Set timeout in individual test files instead.
