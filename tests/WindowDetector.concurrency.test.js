const WindowDetector = require('../src/services/WindowManagerWindows/WindowDetector');

describe('WindowDetector Concurrency Tests', () => {
    let windowDetector;
    let mockPowerShellExecutor;

    beforeEach(() => {
        // Mock PowerShell executor to simulate various scenarios
        mockPowerShellExecutor = {
            initialize: jest.fn().mockResolvedValue(true),
            getDofusWindows: jest.fn().mockResolvedValue([
                { Handle: '12345', Title: 'Test - Feca - 2.70 - Release', ProcessId: 1001 },
                { Handle: '67890', Title: 'Player - Iop - 2.70 - Release', ProcessId: 1002 }
            ]),
            cleanup: jest.fn().mockResolvedValue()
        };

        windowDetector = new WindowDetector();
        windowDetector.powerShellExecutor = mockPowerShellExecutor;
    });

    afterEach(async () => {
        await windowDetector.cleanup();
    });

    describe('Race Condition Protection', () => {
        test('should handle concurrent detection calls without race conditions', async () => {
            await windowDetector.initialize();

            // Start multiple concurrent detection operations
            const promises = Array.from({ length: 10 }, (_, i) =>
                windowDetector.detectWindows()
            );

            const results = await Promise.all(promises);

            // All operations should succeed
            results.forEach(result => {
                expect(Array.isArray(result)).toBe(true);
            });

            // Check that shared state is consistent
            const finalState = windowDetector.getCurrentWindows();
            expect(Array.isArray(finalState)).toBe(true);

            // Verify no race conditions occurred
            const stats = windowDetector.getStatistics();
            expect(stats.racConditionsAvoided).toBeGreaterThanOrEqual(0);
        });

        test('should queue operations when max concurrency reached', async () => {
            await windowDetector.initialize();

            // Mock slow operations
            mockPowerShellExecutor.getDofusWindows.mockImplementation(() =>
                new Promise(resolve => setTimeout(() => resolve([]), 500))
            );

            // Start more operations than max concurrency allows
            const promises = Array.from({ length: 8 }, () =>
                windowDetector.detectWindows()
            );

            const results = await Promise.all(promises);

            // All should complete successfully
            expect(results).toHaveLength(8);

            // Check that some operations were queued
            const stats = windowDetector.getStatistics();
            expect(stats.queuedOperations).toBeGreaterThan(0);
        });

        test('should prevent shared state corruption during concurrent access', async () => {
            await windowDetector.initialize();

            // Mock varying results to test state consistency
            let callCount = 0;
            mockPowerShellExecutor.getDofusWindows.mockImplementation(() => {
                callCount++;
                return Promise.resolve([
                    { Handle: `${callCount}001`, Title: `Test${callCount} - Feca - 2.70 - Release`, ProcessId: callCount + 1000 }
                ]);
            });

            // Start concurrent operations
            const promises = Array.from({ length: 5 }, () =>
                windowDetector.detectWindows()
            );

            await Promise.all(promises);

            // Verify state consistency
            const finalWindows = windowDetector.getCurrentWindows();
            const handleSet = new Set();

            finalWindows.forEach(window => {
                // No duplicate handles should exist
                expect(handleSet.has(window.handle)).toBe(false);
                handleSet.add(window.handle);

                // All windows should have valid data
                expect(window.id).toBeDefined();
                expect(window.character).toBeDefined();
                expect(window.dofusClass).toBeDefined();
            });
        });
    });

    describe('Mutex Protection', () => {
        test('should serialize access to shared state using mutex', async () => {
            await windowDetector.initialize();

            const accessOrder = [];

            // Mock operation that tracks execution order
            const originalMethod = windowDetector.updateSharedStateSafe;
            windowDetector.updateSharedStateSafe = jest.fn().mockImplementation(async function (windows, startTime) {
                accessOrder.push(startTime);
                await new Promise(resolve => setTimeout(resolve, 100)); // Simulate work
                return originalMethod.call(this, windows, startTime);
            });

            // Start concurrent operations
            const promises = Array.from({ length: 3 }, () =>
                windowDetector.detectWindows()
            );

            await Promise.all(promises);

            // Verify serialized access (calls should be in order)
            expect(accessOrder.length).toBe(3);
            for (let i = 1; i < accessOrder.length; i++) {
                expect(accessOrder[i]).toBeGreaterThan(accessOrder[i - 1]);
            }
        });

        test('should handle mutex acquisition timeouts gracefully', async () => {
            await windowDetector.initialize();

            // Mock a very slow operation
            mockPowerShellExecutor.getDofusWindows.mockImplementation(() =>
                new Promise(resolve => setTimeout(() => resolve([]), 2000))
            );

            // Start operation and immediately try another
            const slowPromise = windowDetector.detectWindows();

            // This should be queued
            const fastPromise = windowDetector.detectWindows();

            const results = await Promise.all([slowPromise, fastPromise]);

            expect(results).toHaveLength(2);
            results.forEach(result => {
                expect(Array.isArray(result)).toBe(true);
            });
        });
    });

    describe('Operation Queue Management', () => {
        test('should process queued operations in order', async () => {
            await windowDetector.initialize();

            const executionOrder = [];
            let operationCounter = 0;

            // Mock operations with tracking
            mockPowerShellExecutor.getDofusWindows.mockImplementation(async () => {
                const opId = ++operationCounter;
                executionOrder.push(opId);
                await new Promise(resolve => setTimeout(resolve, 50));
                return [{
                    Handle: `${opId}000`,
                    Title: `Op${opId} - Feca - 2.70 - Release`,
                    ProcessId: opId + 2000
                }];
            });

            // Queue multiple operations
            const promises = Array.from({ length: 5 }, () =>
                windowDetector.detectWindows()
            );

            await Promise.all(promises);

            // Operations should be processed (order may vary due to concurrency limits)
            expect(executionOrder.length).toBe(5);
            expect(new Set(executionOrder).size).toBe(5); // All unique
        });

        test('should handle queue drainage on cleanup', async () => {
            await windowDetector.initialize();

            // Start long-running operations
            mockPowerShellExecutor.getDofusWindows.mockImplementation(() =>
                new Promise(resolve => setTimeout(() => resolve([]), 200))
            );

            // Start several operations
            const promises = Array.from({ length: 3 }, () =>
                windowDetector.detectWindows()
            );

            // Don't wait for completion, trigger cleanup
            const cleanupPromise = windowDetector.cleanup();

            // Wait for both cleanup and operations
            await Promise.all([cleanupPromise, ...promises]);

            // Should complete without errors
            const stats = windowDetector.getStatistics();
            expect(stats.activeOperations).toBe(0);
        });
    });

    describe('Error Handling in Concurrent Scenarios', () => {
        test('should isolate errors between concurrent operations', async () => {
            await windowDetector.initialize();

            let callCount = 0;
            mockPowerShellExecutor.getDofusWindows.mockImplementation(() => {
                callCount++;
                if (callCount === 2) {
                    throw new Error('Simulated error in operation 2');
                }
                return Promise.resolve([{
                    Handle: `${callCount}000`,
                    Title: `Test${callCount} - Feca - 2.70 - Release`,
                    ProcessId: callCount + 3000
                }]);
            });

            // Start multiple operations, one will fail
            const promises = Array.from({ length: 4 }, () =>
                windowDetector.detectWindows().catch(error => ({ error: error.message }))
            );

            const results = await Promise.all(promises);

            // Some should succeed, one should fail
            const successes = results.filter(r => Array.isArray(r));
            const failures = results.filter(r => r.error);

            expect(successes.length).toBeGreaterThan(0);
            expect(failures.length).toBe(1);
            expect(failures[0].error).toContain('Simulated error');
        });

        test('should maintain system stability despite concurrent errors', async () => {
            await windowDetector.initialize();

            // Mock all operations to fail
            mockPowerShellExecutor.getDofusWindows.mockRejectedValue(
                new Error('System unavailable')
            );

            // Try multiple concurrent operations
            const promises = Array.from({ length: 5 }, () =>
                windowDetector.detectWindows().catch(error => ({ error: error.message }))
            );

            const results = await Promise.all(promises);

            // All should fail gracefully
            results.forEach(result => {
                expect(result.error).toContain('System unavailable');
            });

            // System should remain stable
            const stats = windowDetector.getStatistics();
            expect(stats.activeOperations).toBe(0);
        });
    });

    describe('Performance Under Concurrency', () => {
        test('should maintain reasonable performance with concurrent operations', async () => {
            await windowDetector.initialize();

            const startTime = Date.now();

            // Start many concurrent operations
            const promises = Array.from({ length: 20 }, () =>
                windowDetector.detectWindows()
            );

            const results = await Promise.all(promises);

            const totalTime = Date.now() - startTime;

            // Should complete in reasonable time (less than 5 seconds)
            expect(totalTime).toBeLessThan(5000);

            // All operations should succeed
            expect(results).toHaveLength(20);
            results.forEach(result => {
                expect(Array.isArray(result)).toBe(true);
            });

            // Check performance stats
            const stats = windowDetector.getStatistics();
            expect(stats.averageDetectionTime).toBeGreaterThan(0);
            expect(stats.successRate).toBeGreaterThan(80); // At least 80% success rate
        });

        test('should handle burst operations efficiently', async () => {
            await windowDetector.initialize();

            // Simulate burst of rapid operations
            const burstSize = 10;
            const burstInterval = 50; // 50ms between bursts

            const allPromises = [];

            for (let burst = 0; burst < 3; burst++) {
                const burstPromises = Array.from({ length: burstSize }, () =>
                    windowDetector.detectWindows()
                );

                allPromises.push(...burstPromises);

                if (burst < 2) {
                    await new Promise(resolve => setTimeout(resolve, burstInterval));
                }
            }

            const results = await Promise.all(allPromises);

            // All operations should complete successfully
            expect(results).toHaveLength(30);
            results.forEach(result => {
                expect(Array.isArray(result)).toBe(true);
            });

            // System should have handled the load efficiently
            const stats = windowDetector.getStatistics();
            expect(stats.queuedOperations).toBeGreaterThan(0); // Some should have been queued
        });
    });

    describe('Memory Management Under Concurrency', () => {
        test('should not leak memory during concurrent operations', async () => {
            await windowDetector.initialize();

            const initialStats = windowDetector.getStatistics();

            // Run many operations to test for leaks
            for (let batch = 0; batch < 5; batch++) {
                const promises = Array.from({ length: 10 }, () =>
                    windowDetector.detectWindows()
                );
                await Promise.all(promises);
            }

            const finalStats = windowDetector.getStatistics();

            // Active operations should return to 0
            expect(finalStats.activeOperations).toBe(0);

            // Queue should be empty
            expect(finalStats.queueLength).toBe(0);
        });
    });
});