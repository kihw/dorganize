/**
 * LoggerUsageExample.js
 * Example of how to use the Logger module in other parts of the application
 */

// Import the Logger
const { logger, getLogger } = require('../utils/Logger');

// Import pre-configured module loggers (RECOMMENDED)
const loggers = require('../utils/LoggerModules');

// You can use the default logger directly
function exampleWithDefaultLogger() {
    // Simple logs
    logger.debug('Debug message');
    logger.info('Information message');
    logger.warn('Warning message');
    logger.error('Error message');

    // Logs with context
    logger.info('User action', {
        userId: 123,
        action: 'login',
        timestamp: new Date()
    });

    // Logging errors with stack traces
    try {
        throw new Error('Something went wrong');
    } catch (error) {
        logger.error('Operation failed', { error, operation: 'data-fetch' });
    }
}

// Creating a module-specific logger (RECOMMENDED APPROACH)
// This automatically adds the module name to all logs
const moduleLogger = getLogger('WindowManager');

function exampleWithModuleLogger() {
    // These logs will include { module: 'WindowManager' } in the context
    moduleLogger.debug('Initializing window manager');
    moduleLogger.info('Window created', { windowId: 'win1', size: { width: 800, height: 600 } });
    moduleLogger.warn('Window resize performance issue', { fps: 30, expected: 60 });
    moduleLogger.error('Failed to create window', { reason: 'Missing parameters' });
}

// You can also create a logger with custom options
const customLogger = getLogger('CustomModule', {
    logLevel: 'debug',      // Show all logs including debug
    prettyPrint: true,      // Pretty print JSON contexts
    consoleColors: true,    // Use colors in console output
});

function exampleWithCustomLogger() {
    customLogger.debug('This is a debug message with pretty-printed context', {
        complex: {
            nested: {
                data: [1, 2, 3, 4]
            }
        }
    });
}

// Using pre-configured module loggers (BEST PRACTICE)
function exampleWithModuleLoggers() {
    // Each module has its own logger with consistent naming
    loggers.windowManager.info('Window manager initialized');
    loggers.shortcutManager.debug('Registered 5 shortcuts');
    loggers.ui.warn('Slow rendering detected in window list', { renderTime: '150ms' });

    try {
        // Simulate an error
        throw new Error('Connection failed');
    } catch (error) {
        loggers.ipc.error('Failed to communicate with main process', {
            error,
            component: 'renderer',
            connectionId: 'main-1'
        });
    }

    // Diagnostics logger is preconfigured with debug level
    loggers.diagnostics.debug('Memory usage details', {
        heapUsed: process.memoryUsage().heapUsed,
        timestamp: Date.now()
    });
}

// Changing log levels dynamically
function changeLogLevels() {
    // Change the log level for a specific logger
    customLogger.setLogLevel('warn');

    // This debug message won't be logged because the level is now 'warn'
    customLogger.debug('This debug message will be filtered out');

    // But warnings and errors will still be logged
    customLogger.warn('This warning will be shown');
}

module.exports = {
    exampleWithDefaultLogger,
    exampleWithModuleLogger,
    exampleWithCustomLogger,
    exampleWithModuleLoggers, // Added new example
    changeLogLevels
};
