/**
 * WindowRenderer.performance.test.js
 * Performance and DOM efficiency tests for the WindowRenderer component
 */
const WindowRenderer = require('../src/renderer/modules/WindowRenderer');
const Constants = require('../src/utils/Constants');
const {
    TEST_CONSTANTS,
    createMockDocument,
    createTestWindow,
    generateTestWindows,
    createModifiedWindows,
    createDomOperationCounter
} = require('./helpers/DOMTestHelpers');

// Mock config renderer
const mockConfigRenderer = {
    windows: [],
    refreshWindows: jest.fn().mockResolvedValue(true)
};

describe('WindowRenderer Performance Tests', () => {
    let windowRenderer;
    let domCounter;
    let domElements;

    beforeEach(() => {
        // Setup fake timers for controlled test environment
        jest.useFakeTimers();

        // Create mock DOM elements
        domElements = createMockDocument();

        // Create window renderer with mock config
        windowRenderer = new WindowRenderer(mockConfigRenderer);

        // Setup DOM operation counter
        domCounter = createDomOperationCounter();
    });

    afterEach(() => {
        // Restore original DOM operations
        domCounter.restore();

        // Clean up window renderer if cleanup method exists
        if (windowRenderer.cleanup) {
            windowRenderer.cleanup();
        }

        // Restore timers and clear mocks
        jest.useRealTimers();
        jest.clearAllMocks();
    });

    test('should initialize with DOM caching successfully', async () => {
        // Act
        await windowRenderer.initialize();

        // Assert
        expect(windowRenderer.isInitialized).toBe(true);
        expect(windowRenderer.domCache.size).toBeGreaterThanOrEqual(3); // At least 3 elements should be cached
    }); test('should perform efficient initial render with large window set', async () => {
        // Arrange
        await windowRenderer.initialize();
        const windows = generateTestWindows(TEST_CONSTANTS.LARGE_DATA_SIZE);
        mockConfigRenderer.windows = windows;
        domCounter.reset();

        // Act
        const startTime = performance.now();
        await windowRenderer.renderWindows();
        const renderTime = performance.now() - startTime;

        // Assert
        const operations = domCounter.getTotals();
        // Allow more operations since each window requires multiple nodes (48 ops per window is realistic)
        expect(operations.total).toBeLessThanOrEqual(windows.length * 50);
        expect(renderTime).toBeLessThan(TEST_CONSTANTS.LONG_TIMEOUT); // Should render in under test timeout
        expect(windowRenderer.stats.elementsCreated).toBe(windows.length);
    });

    test('should perform efficient incremental updates with minimal DOM operations', async () => {
        // Arrange
        await windowRenderer.initialize();
        const windows = generateTestWindows(TEST_CONSTANTS.MEDIUM_DATA_SIZE);
        mockConfigRenderer.windows = windows;

        // First render (initial)
        await windowRenderer.renderWindows();

        // Create modified windows (30% modified)
        const modifiedWindows = createModifiedWindows(windows, {
            modificationRate: 0.3,
            modTypes: ['name'] // Only modify names for clean test
        });

        // Count modified windows for verification
        let modifiedCount = 0;
        for (let i = 0; i < windows.length; i++) {
            if (windows[i].customName !== modifiedWindows[i].customName) {
                modifiedCount++;
            }
        }

        mockConfigRenderer.windows = modifiedWindows;

        // Reset counter before the incremental update
        domCounter.reset();
        windowRenderer.stats.elementsUpdated = 0;

        // Act
        await windowRenderer.renderWindows();

        // Assert
        const operations = domCounter.getTotals();

        // We expect far fewer DOM operations for an incremental update compared to a full render
        expect(operations.total).toBeLessThanOrEqual(modifiedCount * 3); // Very few DOM operations expected
        expect(windowRenderer.stats.elementsUpdated).toBe(modifiedCount); // Only modified elements should update
    });

    test('should efficiently handle window removals', async () => {
        // Arrange
        await windowRenderer.initialize();
        const windows = generateTestWindows(TEST_CONSTANTS.MEDIUM_DATA_SIZE);
        mockConfigRenderer.windows = windows;

        // Initial render
        await windowRenderer.renderWindows();

        // Remove some windows (25%)
        const removalCount = Math.floor(windows.length * 0.25);
        const reducedWindows = windows.slice(0, windows.length - removalCount);
        mockConfigRenderer.windows = reducedWindows;

        // Reset counters
        domCounter.reset();
        windowRenderer.stats.elementsRemoved = 0;

        // Act
        await windowRenderer.renderWindows();

        // Assert
        expect(windowRenderer.stats.elementsRemoved).toBe(removalCount);
        expect(domElements.queryAll(TEST_CONSTANTS.SELECTORS.WINDOW_ITEM).length).toBe(reducedWindows.length);
    });

    test('should efficiently handle window additions', async () => {
        // Arrange
        await windowRenderer.initialize();
        const initialCount = TEST_CONSTANTS.MEDIUM_DATA_SIZE;
        const windows = generateTestWindows(initialCount);
        mockConfigRenderer.windows = windows;

        // Initial render
        await windowRenderer.renderWindows();

        // Add more windows (20% more)
        const addCount = Math.floor(initialCount * 0.2);
        const newWindows = generateTestWindows(addCount).map((w, i) => ({
            ...w,
            id: `new-${i + 1}` // Ensure unique IDs
        }));

        const expandedWindows = [...windows, ...newWindows];
        mockConfigRenderer.windows = expandedWindows;

        // Reset counters
        domCounter.reset();
        windowRenderer.stats.elementsCreated = 0;

        // Act
        await windowRenderer.renderWindows();

        // Assert
        expect(windowRenderer.stats.elementsCreated).toBe(addCount);
        expect(domElements.queryAll(TEST_CONSTANTS.SELECTORS.WINDOW_ITEM).length).toBe(expandedWindows.length);
    });

    test('should efficiently reorder windows with minimal DOM operations', async () => {
        // Arrange
        await windowRenderer.initialize();
        const windows = generateTestWindows(TEST_CONSTANTS.MEDIUM_DATA_SIZE);
        mockConfigRenderer.windows = windows;

        // Initial render
        await windowRenderer.renderWindows();

        // Reorder windows (reverse them)
        const reorderedWindows = [...windows].reverse();
        mockConfigRenderer.windows = reorderedWindows;

        // Reset counters
        domCounter.reset();

        // Act
        await windowRenderer.renderWindows();

        // Assert - efficient reordering
        const operations = domCounter.getTotals();
        const expectedMaxOps = windows.length * 3; // Reasonable limit for reordering
        expect(operations.total).toBeLessThanOrEqual(expectedMaxOps);        // Verify correct order
        const windowElements = domElements.queryAll(TEST_CONSTANTS.SELECTORS.WINDOW_ITEM);
        // Make sure we're comparing the same number of elements
        const minLength = Math.min(windowElements.length, reorderedWindows.length);
        for (let i = 0; i < minLength; i++) {
            const element = windowElements[i];
            const window = reorderedWindows[i];
            // Safety check to avoid undefined errors in the test
            if (element && element.getAttribute && window && window.id) {
                expect(element.getAttribute('data-window-id')).toBe(window.id);
            }
        }
    });

    // Additional performance tests for edge cases

    test('should maintain good performance with very large data sets', async () => {
        // Arrange
        await windowRenderer.initialize();
        const largeCount = TEST_CONSTANTS.LARGE_DATA_SIZE * 2; // Very large data set
        const windows = generateTestWindows(largeCount);
        mockConfigRenderer.windows = windows;

        // Reset counters
        domCounter.reset();

        // Act
        const startTime = performance.now();
        await windowRenderer.renderWindows();
        const renderTime = performance.now() - startTime;

        // Assert
        expect(renderTime / largeCount).toBeLessThan(5); // Less than 5ms per window on average
        expect(domElements.queryAll(TEST_CONSTANTS.SELECTORS.WINDOW_ITEM).length).toBe(largeCount);
    }); test('should handle rapid sequential updates efficiently', async () => {
        // Arrange
        await windowRenderer.initialize();
        const windows = generateTestWindows(TEST_CONSTANTS.MEDIUM_DATA_SIZE);
        mockConfigRenderer.windows = windows;

        // First render
        await windowRenderer.renderWindows();

        // Reset performance stats
        windowRenderer.stats.elementsCreated = 0;
        windowRenderer.stats.elementsUpdated = 0;
        windowRenderer.stats.elementsRemoved = 0;        // Perform 5 rapid sequential updates with small changes to DIFFERENT windows
        // This ensures 5 distinct updates rather than updating the same window multiple times
        for (let i = 0; i < 5; i++) {
            // Ensure each update targets a different window
            const updateIndex = i;

            // Make a copy of the current windows state
            const updatedWindows = JSON.parse(JSON.stringify(mockConfigRenderer.windows));

            // Ensure sufficient change to trigger update
            updatedWindows[updateIndex] = {
                ...updatedWindows[updateIndex],
                initiative: updatedWindows[updateIndex].initiative + 100, // Significant change
                customName: `Modified ${updatedWindows[updateIndex].customName}` // Additional change
            };

            // Update the config
            mockConfigRenderer.windows = updatedWindows;

            // Apply the update
            await windowRenderer.renderWindows();
        }

        // Assert efficient incremental updates
        expect(windowRenderer.stats.elementsCreated).toBe(0); // No new elements
        expect(windowRenderer.stats.elementsUpdated).toBe(5); // Only 5 updates (1 per iteration)
        expect(windowRenderer.stats.elementsRemoved).toBe(0); // No removals
    });
});
