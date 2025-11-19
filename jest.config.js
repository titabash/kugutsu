/** @type {import('jest').Config} */
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'jsdom',
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  moduleDirectories: ['node_modules', '<rootDir>/node_modules'],
  modulePaths: ['<rootDir>/node_modules'],
  moduleNameMapper: {
    // Force React to use root node_modules (avoid multiple React instances)
    '^react$': '<rootDir>/node_modules/react',
    '^react-dom$': '<rootDir>/node_modules/react-dom',
    '^react/(.*)$': '<rootDir>/node_modules/react/$1',
    '^react-dom/(.*)$': '<rootDir>/node_modules/react-dom/$1',
    // CSS files (must be before .js mapping)
    '\\.module\\.css$': 'identity-obj-proxy',
    '\\.css$': 'identity-obj-proxy',
    // @xyflow/react mocking (must be before generic @xyflow mapping)
    '^@xyflow/react/dist/style\\.css$': 'identity-obj-proxy',
    '^@xyflow/react$': '<rootDir>/tests/mocks/xyflowReactMock.tsx',
    '^@xyflow/(.*)$': '<rootDir>/electron/node_modules/@xyflow/$1',
    // JS file extension handling (must be last)
    '^(.+)\\.js$': '$1',
  },
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: {
          jsx: 'react',
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          skipLibCheck: true,
        },
        diagnostics: false, // Disable TypeScript diagnostics for tests
      },
    ],
  },
  testMatch: [
    '**/tests/**/*.test.ts',
    '**/tests/**/*.test.tsx',
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  // Mock modules that require filesystem or external resources
  modulePathIgnorePatterns: [
    '<rootDir>/dist/',
    '<rootDir>/node_modules/',
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!(@langchain|@anthropic-ai|@xyflow)/)',
  ],
};
