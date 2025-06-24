/**
 * Unit tests for WindowDetector core functionality
 * Tests window detection logic independently from UI components
 */

const path = require('path');

// Mock Electron
jest.mock('electron');

// Mock fs module
jest.mock('fs', () => ({
    promises: {
        mkdir: jest.fn().mockResolvedValue(undefined),
        readFile: jest.fn(),
        writeFile: jest.fn()
    }
}));

// Mock Logger
jest.mock('../../src/utils/Logger', () => ({
    logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
}));

// Mock LocalizedErrorMessages
jest.mock('../../src/utils/LocalizedErrorMessages', () => ({
    localizedErrors: {
        getMessage: jest.fn((key) => key),
        simplifyErrorMessage: jest.fn(msg => msg)
    }
}));

// Get the modules after mocking
const WindowDetector = require('../../src/services/WindowManagerWindows/WindowDetector');
const WindowParser = require('../../src/services/WindowManagerWindows/WindowParser');
const PowerShellExecutor = require('../../src/services/WindowManagerWindows/PowerShellExecutor');
const { logger } = require('../../src/utils/Logger');

// Mock PowerShellExecutor and WindowParser
jest.mock('../../src/services/WindowManagerWindows/PowerShellExecutor');
jest.mock('../../src/services/WindowManagerWindows/WindowParser');

describe('WindowDetector Core Functionality', () => {
    let windowDetector;
    let mockConsoleLog;
    let originalConsoleLog;

    beforeEach(() => {
        // Save original console.log
        originalConsoleLog = console.log;
        mockConsoleLog = jest.fn();
        console.log = mockConsoleLog;

        // Mock PowerShellExecutor implementation
        PowerShellExecutor.execAsync.mockResolvedValue({
            stdout: JSON.stringify([
                { id: 1, title: "Dofus - Character1", processId: 1001 },
                { id: 2, title: "Dofus - Character2", processId: 1002 }
            ]),
            stderr: ""
        });

        // Mock WindowParser implementation
        WindowParser.prototype.parseWindowsData.mockImplementation((data) => {
            const parsed = JSON.parse(data);
            return parsed.map(window => ({
                ...window,
                character: window.title.split(' - ')[1] || 'Unknown',
                parsed: true
            }));
        });

        // Initialize WindowDetector with mocked dependencies
        windowDetector = new WindowDetector();
    });

    afterEach(() => {
        // Restore console.log
        console.log = originalConsoleLog;

        // Clean up
        if (windowDetector && windowDetector.cleanup) {
            windowDetector.cleanup();
        }

        jest.clearAllMocks();
    });

    describe('Window Detection Logic', () => {
        test('should detect windows correctly', async () => {
            const windows = await windowDetector.detectWindows();

            // Verify PowerShell was called
            expect(PowerShellExecutor.execAsync).toHaveBeenCalled();

            // Verify parser was used
            expect(WindowParser.prototype.parseWindowsData).toHaveBeenCalled();

            // Verify results
            expect(windows).toHaveLength(2);
            expect(windows[0].id).toBe(1);
            expect(windows[0].character).toBe('Character1');
            expect(windows[1].character).toBe('Character2');
        });

        test('should handle empty results gracefully', async () => {
            // Override mock to return empty array
            PowerShellExecutor.execAsync.mockResolvedValueOnce({
                stdout: "[]",
                stderr: ""
            });

            const windows = await windowDetector.detectWindows();
            expect(windows).toHaveLength(0);
        });

        test('should handle PowerShell errors', async () => {
            // Mock a PowerShell error
            PowerShellExecutor.execAsync.mockRejectedValueOnce(new Error('PowerShell execution failed'));

            const windows = await windowDetector.detectWindows();

            // Should log error and return empty array
            expect(logger.error).toHaveBeenCalled();
            expect(windows).toHaveLength(0);
        });

        test('should handle parsing errors', async () => {
            // Mock a parsing error
            WindowParser.prototype.parseWindowsData.mockImplementationOnce(() => {
                throw new Error('Parsing failed');
            });

            const windows = await windowDetector.detectWindows();

            // Should log error and return empty array
            expect(logger.error).toHaveBeenCalled();
            expect(windows).toHaveLength(0);
        });
    });

    describe('Window Filtering', () => {
        test('should filter windows by title pattern', async () => {
            const dofusWindows = await windowDetector.getWindowsByPattern('Dofus');
            expect(dofusWindows).toHaveLength(2);

            const otherWindows = await windowDetector.getWindowsByPattern('OtherTitle');
            expect(otherWindows).toHaveLength(0);
        });

        test('should filter windows by process ID', async () => {
            const windows = await windowDetector.detectWindows();
            const filtered = windowDetector.filterWindowsByProcess(windows, 1001);

            expect(filtered).toHaveLength(1);
            expect(filtered[0].processId).toBe(1001);
            expect(filtered[0].character).toBe('Character1');
        });
    });

    describe('Mutex Protection', () => {
        test('should prevent concurrent execution', async () => {
            // Delay the PowerShell execution to simulate longer running process
            PowerShellExecutor.execAsync.mockImplementationOnce(() => {
                return new Promise(resolve => {
                    setTimeout(() => {
                        resolve({
                            stdout: JSON.stringify([{ id: 1, title: "Dofus - Delayed", processId: 1001 }]),
                            stderr: ""
                        });
                    }, 50);
                });
            });

            // Start two concurrent detections
            const promise1 = windowDetector.detectWindows();
            const promise2 = windowDetector.detectWindows();

            // Both should resolve successfully
            const [results1, results2] = await Promise.all([promise1, promise2]);

            // But the PowerShell exec should have been called only once
            expect(PowerShellExecutor.execAsync).toHaveBeenCalledTimes(1);

            // Both promises should resolve to the same result
            expect(results1).toEqual(results2);
        });
    });

    describe('Performance Tracking', () => {
        test('should track detection time', async () => {
            await windowDetector.detectWindows();

            // Check that performance tracking was logged
            expect(mockConsoleLog).toHaveBeenCalledWith(
                expect.stringContaining('Window detection completed in')
            );
        });
    });

    describe('Events and Callbacks', () => {
        test('should call onWindowsChanged callback when windows change', async () => {
            const mockCallback = jest.fn();
            windowDetector.onWindowsChanged(mockCallback);

            // First detection
            await windowDetector.detectWindows();
            expect(mockCallback).not.toHaveBeenCalled();

            // Change the return value to simulate window change
            PowerShellExecutor.execAsync.mockResolvedValueOnce({
                stdout: JSON.stringify([
                    { id: 1, title: "Dofus - Character1", processId: 1001 },
                    { id: 2, title: "Dofus - Character2", processId: 1002 },
                    { id: 3, title: "Dofus - Character3", processId: 1003 }
                ]),
                stderr: ""
            });

            // Second detection should trigger the callback
            await windowDetector.detectWindows();
            expect(mockCallback).toHaveBeenCalled();
        });
    });
});
