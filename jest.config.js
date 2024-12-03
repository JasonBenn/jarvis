module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/src'],
    transform: {
      '^.+\\.tsx?': 'ts-jest'
    },
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
    testRegex: '\\.test\\.tsx?',
    moduleNameMapper: {
      '^@/(.*)': '<rootDir>/src/$1'
    },
    coverageDirectory: 'coverage',
    collectCoverageFrom: [
      'src/**/*.{ts,tsx}',
      '!src/**/*.d.ts',
      '!src/**/*.test.ts'
    ]
  };