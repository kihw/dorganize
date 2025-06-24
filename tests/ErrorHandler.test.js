/**
 * ErrorHandler unit tests
 */

// Set up mocks before requiring any modules
jest.mock('electron', () => ({
    app: {
        getPath: jest.fn(() => '/mock/path'),
        getVersion: jest.fn(() => '1.0.0'),
        relaunch: jest.fn(),
        exit: jest.fn()
    },
    dialog: {
        showMessageBox: jest.fn().mockResolvedValue({ response: 0 })
    },
    ipcMain: {
        handle: jest.fn(),
        on: jest.fn()
    }
}));

jest.mock('fs', () => ({
    promises: {
        mkdir: jest.fn().mockResolvedValue(undefined),
        stat: jest.fn().mockResolvedValue({ size: 1000 }),
        appendFile: jest.fn().mockResolvedValue(undefined),
        rename: jest.fn().mockResolvedValue(undefined),
        unlink: jest.fn().mockResolvedValue(undefined)
    }
}));

jest.mock('../src/utils/LocalizedErrorMessages', () => ({
    localizedErrors: {
        getMessage: jest.fn((key, ...args) => {
            if (key === 'error_title') return 'Test Error Title';
            if (key === 'error_occurred') return `Test Error in ${args[0]}`;
            if (key === 'error_ok_button') return 'Test OK';
            if (key === 'error_report_button') return 'Test Report';
            if (key === 'error_fatal') return 'Test Fatal Error';
            if (key === 'error_restart_button') return 'Test Restart';
            if (key === 'error_close_button') return 'Test Close';
            return `${key}:${args.join(',')}`;
        }),
        simplifyErrorMessage: jest.fn(msg => `Simplified: ${msg}`)
    }
}));

// Now require the modules after mocking
const { ErrorHandler, getErrorHandler } = require('../src/services/ErrorHandler');
const { dialog, app, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const { localizedErrors } = require('../src/utils/LocalizedErrorMessages');

// Get references to the mock functions for testing
const mockGetMessage = localizedErrors.getMessage;
const mockSimplifyErrorMessage = localizedErrors.simplifyErrorMessage;
const mockAppendFile = fs.promises.appendFile;

describe('ErrorHandler', () => {
    let errorHandler;

    beforeEach(() => {
        jest.clearAllMocks();
        errorHandler = new ErrorHandler();
    });

    test('should initialize with correct defaults', () => {
        expect(errorHandler).toBeDefined();
        expect(errorHandler.currentLogLevel).toBe(1); // INFO
        expect(errorHandler.logLevels.DEBUG).toBe(0);
        expect(errorHandler.logLevels.FATAL).toBe(4);
        expect(ipcMain.handle).toHaveBeenCalledWith('error-report', expect.any(Function));
    });
    test('should handle an error and log properly', async () => {
        // Clear any previous calls first
        mockAppendFile.mockClear();

        const testError = new Error('Test error message');
        await errorHandler.handleError(testError, 'TestContext', 'ERROR');

        // Verify appendFile was called at least once
        expect(mockAppendFile).toHaveBeenCalled();

        // Find the call that contains our error message
        let found = false;
        for (let i = 0; i < mockAppendFile.mock.calls.length; i++) {
            if (mockAppendFile.mock.calls[i][1] &&
                mockAppendFile.mock.calls[i][1].includes('Test error message')) {
                found = true;
                break;
            }
        }
        expect(found).toBe(true);
    });

    test('should show user notification with localized text', async () => {
        const errorInfo = {
            severity: 'ERROR',
            message: 'Test error message',
            context: 'TestContext'
        };

        // Set up environment to ensure notifications are shown
        process.env.NODE_ENV = 'production';

        errorHandler.showUserNotification(errorInfo);

        expect(mockGetMessage).toHaveBeenCalledWith('error_title');
        expect(mockGetMessage).toHaveBeenCalledWith('error_occurred', 'TestContext');
        expect(mockGetMessage).toHaveBeenCalledWith('error_ok_button');
        expect(mockGetMessage).toHaveBeenCalledWith('error_report_button');

        expect(dialog.showMessageBox).toHaveBeenCalledWith(
            null,
            expect.objectContaining({
                title: 'Test Error Title',
                message: 'Test Error in TestContext'
            })
        );
    });
    test('should handle fatal errors with localized messages', async () => {
        const errorInfo = {
            severity: 'FATAL',
            message: 'Fatal error message',
            context: 'TestContext'
        };

        await errorHandler.handleFatalError(errorInfo);

        expect(mockGetMessage).toHaveBeenCalledWith('error_title');
        expect(mockGetMessage).toHaveBeenCalledWith('error_fatal');
        expect(mockGetMessage).toHaveBeenCalledWith('error_restart_button');
        expect(mockGetMessage).toHaveBeenCalledWith('error_close_button');

        expect(dialog.showMessageBox).toHaveBeenCalledWith(
            null,
            expect.objectContaining({
                title: 'Test Error Title',
                message: 'Test Fatal Error',
                buttons: ['Test Restart', 'Test Close']
            })
        );

        expect(app.relaunch).toHaveBeenCalled();
        expect(app.exit).toHaveBeenCalledWith(0);
    });

    test('singleton instance works correctly', () => {
        const instance1 = getErrorHandler();
        const instance2 = getErrorHandler();
        expect(instance1).toBe(instance2);
    });

    test('should use localizedErrors to simplify error messages', () => {
        const result = errorHandler.simplifyErrorMessage('Test complicated error message');
        expect(mockSimplifyErrorMessage).toHaveBeenCalledWith('Test complicated error message');
        expect(result).toBe('Simplified: Test complicated error message');
    });
});
