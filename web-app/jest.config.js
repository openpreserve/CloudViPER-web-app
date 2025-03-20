module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testMatch: ['**/test/**/*.test.ts'], // Matches files in the test folder ending in .test.ts
    collectCoverage: true, // Enable code coverage
    coverageDirectory: 'coverage', // Output directory for coverage reports
};