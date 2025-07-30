module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testMatch: ['**/test/**/*.test.ts'], // Matches files in the test folder ending in .test.ts
    setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'], // Add setup file
    // collectCoverage: true, // Enable code coverage
    // coverageDirectory: 'coverage', // Output directory for coverage reports

    // collectCoverage: true, // Enable code coverage
    // coverageDirectory: 'coverage', // Output directory for coverage reports
    // collectCoverageFrom: ['src/**/*.ts'], // Files to collect coverage from
    // coveragePathIgnorePatterns: ['/node_modules/', '/test/'], // Files to ignore in coverage reports
    // moduleFileExtensions: ['ts', 'js'], // File extensions to consider
    // moduleNameMapper: {
    //     '^@/(.*)$': '<rootDir>/src/$1',
    // },
    // transform: {
    //     '^.+\\.ts$': 'ts-jest',
    // },
    verbose: true,
    forceExit: true,
    // clearMocks: true,
};