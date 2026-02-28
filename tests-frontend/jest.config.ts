import type { Config } from 'jest'

const config: Config = {
  rootDir: '.',
  testEnvironment: 'jsdom',
  testMatch: ['<rootDir>/tests/**/*.test.ts', '<rootDir>/tests/**/*.test.tsx'],
  moduleDirectories: ['node_modules', '<rootDir>/../frontend/node_modules'],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.jest.json' }],
  },
  moduleNameMapper: {
    '^react$': '<rootDir>/../frontend/node_modules/react',
    '^react/jsx-runtime$': '<rootDir>/../frontend/node_modules/react/jsx-runtime',
    '^react-dom$': '<rootDir>/../frontend/node_modules/react-dom',
    '^react-dom/(.*)$': '<rootDir>/../frontend/node_modules/react-dom/$1',
    '^@tanstack/react-query$': '<rootDir>/../frontend/node_modules/@tanstack/react-query',
    '^@/(.*)$': '<rootDir>/../frontend/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/setupTests.ts'],
}

export default config
