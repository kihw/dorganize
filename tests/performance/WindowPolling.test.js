/**
 * Performance tests for WindowDetector polling mechanisms
 * Tests window polling performance under various conditions and loads
 */

const path = require('path');
const { performance } = require('perf_hooks');

// Mock modules
jest.mock('electron');

jest.mock('child_process', () => {
    return {
        exec: jest.fn((command, callback) => {
            setTimeout(() => {
                if (command.includes('failing-test')) {
                    callback(new Error('Command failed'), '', 'Error output');
                } else {
                    // Use the global helper from setup.js
                    const mockSize = parseInt(command.match(/mock-size-(\d+)/)?.[1] || '10', 10);
                    callback(null, JSON.stringify(global.generateMockWindows(mockSize)), '');
                }
            }, 10);
        })
    };
});

// Mock logger
jest.mock('../../src/utils/Logger', () => ({
    getLogger: () => ({
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        performance: jest.fn()
    })
}));

// Helper function to create a performance measure
function createPerformanceMeasure(name) {
    return {
        name,
        startTime: performance.now(),
        stop() {
            return performance.now() - this.startTime;
        }
    };
}

// Import modules (after mocks are set up)
const WindowDetector = require('../../src/services/WindowManagerWindows/WindowDetector');
const { POLLING_INTERVALS } = require('../../src/utils/Constants');

describe('Window Polling Performance Tests', () => {
    let windowDetector;

    beforeEach(() => {
        jest.clearAllMocks();
        windowDetector = new WindowDetector();
    });

    afterEach(() => {
        if (windowDetector && windowDetector.stopPolling) {
            windowDetector.stopPolling();
        }
    });

    // Utility function for measuring execution time
    const measureExecutionTime = async (func, args = []) => {
        const start = performance.now();
        const result = await func.apply(windowDetector, args);
        const end = performance.now();
        return {
            executionTime: end - start,
            result
        };
    };

    describe('Basic Performance', () => {
        test('should have acceptable detection time for small window list (10 windows)', async () => {
            // Setup mock to return 10 windows
            const mockExec = require('child_process').exec;
            mockExec.mockImplementationOnce((command, callback) => {
                setTimeout(() => {
                    callback(null, JSON.stringify(generateMockWindows(10)), '');
                }, 20);
            });

            const { executionTime } = await measureExecutionTime(windowDetector.detectWindows);
            expect(executionTime).toBeLessThan(100); // Should process 10 windows in under 100ms
        });

        test('should have acceptable detection time for medium window list (50 windows)', async () => {
            // Setup mock to return 50 windows
            const mockExec = require('child_process').exec;
            mockExec.mockImplementationOnce((command, callback) => {
                setTimeout(() => {
                    callback(null, JSON.stringify(generateMockWindows(50)), '');
                }, 50);
            });

            const { executionTime } = await measureExecutionTime(windowDetector.detectWindows);
            expect(executionTime).toBeLessThan(200); // Should process 50 windows in under 200ms
        });

        test('should handle large window lists efficiently (100 windows)', async () => {
            // Setup mock to return 100 windows
            const mockExec = require('child_process').exec;
            mockExec.mockImplementationOnce((command, callback) => {
                setTimeout(() => {
                    callback(null, JSON.stringify(generateMockWindows(100)), '');
                }, 100);
            });

            const { executionTime } = await measureExecutionTime(windowDetector.detectWindows);
            expect(executionTime).toBeLessThan(300); // Should process 100 windows in under 300ms
        });
    });

    describe('Polling Interval Optimization', () => {
        test('should adapt polling interval based on system load', async () => {
            const initialInterval = POLLING_INTERVALS.NORMAL;
            windowDetector.setPollingInterval(initialInterval);

            // Simulate high load
            const mockHighLoad = () => {
                windowDetector.consecutiveHighLatencyDetections = 3;
                windowDetector.lastDetectionTime = 150; // High latency
                windowDetector.adaptPollingInterval();
            };

            mockHighLoad();
            expect(windowDetector.pollingInterval).toBeGreaterThan(initialInterval);

            // Simulate normal load
            const mockNormalLoad = () => {
                windowDetector.consecutiveHighLatencyDetections = 0;
                windowDetector.lastDetectionTime = 50; // Normal latency
                windowDetector.adaptPollingInterval();
            };

            mockNormalLoad();
            expect(windowDetector.pollingInterval).toBeLessThanOrEqual(POLLING_INTERVALS.NORMAL);
        });

        test('should return to normal polling interval after user activity', async () => {
            // Start with a slower polling interval
            windowDetector.setPollingInterval(POLLING_INTERVALS.LOW);
            expect(windowDetector.pollingInterval).toBe(POLLING_INTERVALS.LOW);

            // Simulate user activity
            windowDetector.handleUserActivity();

            // Should switch to normal polling
            expect(windowDetector.pollingInterval).toBe(POLLING_INTERVALS.NORMAL);
        });

        test('should use high frequency polling during active window changes', async () => {
            windowDetector.setPollingInterval(POLLING_INTERVALS.NORMAL);

            // Simulate active window operations
            windowDetector.trackActiveWindowSequence('window-1');
            windowDetector.trackActiveWindowSequence('window-2');
            windowDetector.trackActiveWindowSequence('window-3');

            // Should have switched to high frequency
            expect(windowDetector.pollingInterval).toBe(POLLING_INTERVALS.HIGH);

            // Let some time pass in the simulation
            jest.advanceTimersByTime(POLLING_INTERVALS.ACTIVITY_TIMEOUT + 1000);

            // After timeout, should go back to normal
            windowDetector.checkActivityTimeout();
            expect(windowDetector.pollingInterval).toBe(POLLING_INTERVALS.NORMAL);
        });
    });

    describe('Memory Usage', () => {
        test('should not have memory leaks during extended polling', async () => {
            // Note: This test uses Node.js memory usage stats and may be
            // less precise than true memory profiling, but can catch obvious issues
            const memoryBefore = process.memoryUsage();

            // Run 50 detection cycles
            for (let i = 0; i < 50; i++) {
                await windowDetector.detectWindows();
            }

            const memoryAfter = process.memoryUsage();

            // Memory should not increase dramatically (some increase is normal due to V8)
            // Using heap used as the most relevant metric
            const heapIncreaseMB = (memoryAfter.heapUsed - memoryBefore.heapUsed) / (1024 * 1024);
            expect(heapIncreaseMB).toBeLessThan(10); // Allow up to 10MB increase
        });
    });
});
