/**
 * Jest configuration for DOrganize tests
 */
module.exports = {
    // Use jsdom for DOM testing
    testEnvironment: 'jsdom',

    // Global setup for mocks
    setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

    // Directories to scan for tests
    testMatch: [
        '**/tests/**/*.test.js',
        '**/tests/**/*.spec.js'
    ],

    // Global coverage settings
    collectCoverage: false,

    // Timeouts for tests
    testTimeout: 10000,

    // Mock extensions and modules
    moduleFileExtensions: ['js', 'json'],

    // Exclude node_modules from transformations
    transformIgnorePatterns: [
        'node_modules/(?!(some-module-to-transform)/)'
    ],

    // Per-file test environment overrides
    testEnvironmentOptions: {
        customExportConditions: ['node', 'node-addons'],
    }
};
