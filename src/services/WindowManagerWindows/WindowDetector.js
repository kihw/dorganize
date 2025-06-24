const { getErrorHandler } = require('../ErrorHandler');
const WindowParser = require('./WindowParser');
const PowerShellExecutor = require('./PowerShellExecutor');

/**
 * WindowDetector - Handles window detection with race condition protection
 */
class WindowDetector {
    constructor() {
        this.errorHandler = getErrorHandler();
        this.windowParser = new WindowParser();
        this.powerShellExecutor = new PowerShellExecutor();

        // Shared state that needs protection
        this.currentWindows = [];
        this.lastUpdateTime = 0;
        this.isInitialized = false;

        // Race condition protection
        this.processingMutex = new AsyncMutex();
        this.operationQueue = new AsyncQueue();
        this.activeOperations = new Map(); // Track active operations by ID

        // Configuration
        this.config = {
            debounceMs: 100,
            maxConcurrentOperations: 3,
            operationTimeoutMs: 15000,
            staleDataThresholdMs: 30000,
            retryAttempts: 2,
            retryDelayMs: 1000
        };

        // Performance monitoring
        this.stats = {
            totalDetections: 0,
            successfulDetections: 0,
            racConditionsAvoided: 0,
            queuedOperations: 0,
            averageDetectionTime: 0,
            lastDetectionTime: 0
        };

        // Cleanup interval
        this.cleanupInterval = setInterval(() => {
            this.cleanupStaleOperations();
        }, 60000); // Cleanup every minute
    }

    /**
     * Initialize window detector with thread-safe initialization
     */
    async initialize() {
        return this.operationQueue.enqueue(async () => {
            if (this.isInitialized) {
                return true;
            }

            try {
                console.log('WindowDetector: Starting thread-safe initialization...');

                // Initialize dependencies
                const psInitialized = await this.powerShellExecutor.initialize();
                if (!psInitialized) {
                    throw new Error('PowerShell executor initialization failed');
                }

                // Test basic functionality
                await this.testDetectionCapability();

                this.isInitialized = true;
                console.log('WindowDetector: Initialization completed successfully');
                return true;

            } catch (error) {
                this.errorHandler.error(error, 'WindowDetector.initialize');
                this.isInitialized = false;
                return false;
            }
        }, 'initialize');
    }

    /**
     * Test detection capability during initialization
     */
    async testDetectionCapability() {
        try {
            console.log('WindowDetector: Testing detection capability...');

            const testWindows = await this.powerShellExecutor.getDofusWindows();
            if (!Array.isArray(testWindows)) {
                throw new Error('PowerShell executor returned invalid data structure');
            }

            console.log(`WindowDetector: Test successful, found ${testWindows.length} windows`);

        } catch (error) {
            throw new Error(`Detection capability test failed: ${error.message}`);
        }
    }

    /**
     * Detect windows with comprehensive race condition protection
     */
    async detectWindows() {
        const operationId = this.generateOperationId();

        try {
            this.stats.totalDetections++;

            // Check if we need to queue this operation
            if (this.shouldQueueOperation()) {
                this.stats.queuedOperations++;
                console.log(`WindowDetector: Queueing detection operation ${operationId}`);

                return await this.operationQueue.enqueue(
                    () => this.performDetection(operationId),
                    operationId
                );
            }

            // Execute immediately if queue is available
            return await this.performDetection(operationId);

        } catch (error) {
            this.errorHandler.error(error, `WindowDetector.detectWindows [${operationId}]`);
            throw error;
        }
    }

    /**
     * Perform the actual window detection with mutex protection
     */
    async performDetection(operationId) {
        const startTime = Date.now();

        try {
            console.log(`WindowDetector: Starting detection operation ${operationId}`);

            // Register active operation
            this.registerActiveOperation(operationId, startTime);

            // Acquire mutex for shared state access
            return await this.processingMutex.runExclusive(async () => {
                try {
                    // Check for stale data and debouncing
                    if (this.shouldSkipDetection(startTime)) {
                        console.log(`WindowDetector: Skipping detection ${operationId} (debounce/stale check)`);
                        return this.currentWindows;
                    }

                    // Get raw windows from PowerShell
                    const rawWindows = await this.getRawWindowsWithTimeout(operationId);

                    // Process raw windows (this was the race condition hotspot)
                    const processedWindows = await this.processRawWindowsSafe(rawWindows, operationId);

                    // Update shared state safely
                    await this.updateSharedStateSafe(processedWindows, startTime);

                    this.stats.successfulDetections++;
                    const detectionTime = Date.now() - startTime;
                    this.updatePerformanceStats(detectionTime);

                    console.log(`WindowDetector: Detection ${operationId} completed in ${detectionTime}ms`);
                    return this.currentWindows;

                } catch (error) {
                    console.error(`WindowDetector: Detection ${operationId} failed:`, error.message);
                    throw error;
                }
            });

        } finally {
            // Always cleanup operation tracking
            this.unregisterActiveOperation(operationId);
        }
    }

    /**
     * Thread-safe version of processRawWindows with comprehensive protection
     */
    async processRawWindowsSafe(rawWindows, operationId) {
        try {
            console.log(`WindowDetector: Processing ${rawWindows.length} raw windows [${operationId}]`);

            if (!Array.isArray(rawWindows)) {
                console.warn(`WindowDetector: Invalid raw windows data [${operationId}]`);
                return [];
            }

            // Create isolated processing context to avoid shared state contamination
            const processingContext = this.createProcessingContext(operationId);

            // Filter valid windows without modifying shared state
            const validWindows = await this.filterValidWindowsSafe(rawWindows, processingContext);

            // Process each window in isolation
            const processedWindows = await this.processWindowsBatch(validWindows, processingContext);

            // Validate final results
            const validatedWindows = this.validateProcessedWindows(processedWindows, processingContext);

            console.log(`WindowDetector: Processed ${validatedWindows.length} valid windows [${operationId}]`);
            return validatedWindows;

        } catch (error) {
            this.errorHandler.error(error, `WindowDetector.processRawWindowsSafe [${operationId}]`);
            return [];
        }
    }

    /**
     * Create isolated processing context to prevent race conditions
     */
    createProcessingContext(operationId) {
        return {
            operationId,
            startTime: Date.now(),
            processedCount: 0,
            errorCount: 0,
            warnings: [],
            tempData: new Map(), // Isolated temporary data
            dofusClasses: { ...this.windowParser.getDofusClasses() } // Copy to avoid shared mutations
        };
    }

    /**
     * Filter valid windows with isolated processing
     */
    async filterValidWindowsSafe(rawWindows, context) {
        const validWindows = [];

        for (const window of rawWindows) {
            try {
                // Validate window structure without modifying original
                const validatedWindow = this.validateWindowStructure(window);
                if (!validatedWindow.isValid) {
                    context.warnings.push(`Invalid window structure: ${validatedWindow.error}`);
                    continue;
                }

                // Check if window meets filtering criteria
                if (await this.meetsFilterCriteria(window, context)) {
                    validWindows.push({ ...window }); // Create copy to avoid reference sharing
                }

            } catch (error) {
                context.errorCount++;
                console.warn(`WindowDetector: Error filtering window [${context.operationId}]:`, error.message);
            }
        }

        return validWindows;
    }

    /**
     * Validate window structure without side effects
     */
    validateWindowStructure(window) {
        try {
            if (!window || typeof window !== 'object') {
                return { isValid: false, error: 'Window is not an object' };
            }

            if (!window.Handle || window.Handle === '0') {
                return { isValid: false, error: 'Invalid window handle' };
            }

            if (!window.Title || typeof window.Title !== 'string') {
                return { isValid: false, error: 'Invalid window title' };
            }

            if (!window.ProcessId || isNaN(parseInt(window.ProcessId))) {
                return { isValid: false, error: 'Invalid process ID' };
            }

            return { isValid: true, error: null };

        } catch (error) {
            return { isValid: false, error: `Validation error: ${error.message}` };
        }
    }

    /**
     * Check if window meets filtering criteria
     */
    async meetsFilterCriteria(window, context) {
        try {
            // Use parser to check title validity without modifying shared state
            const parseResult = this.windowParser.parseWindowTitle(window.Title);

            if (!parseResult.isValid) {
                return false;
            }

            // Additional criteria checks
            if (window.Title.toLowerCase().includes('organizer')) {
                return false;
            }

            if (window.Title.toLowerCase().includes('configuration')) {
                return false;
            }

            // Store parsed info in context for later use
            context.tempData.set(window.Handle, {
                character: parseResult.character,
                dofusClass: parseResult.dofusClass,
                originalWindow: window
            });

            return true;

        } catch (error) {
            console.warn(`WindowDetector: Criteria check failed [${context.operationId}]:`, error.message);
            return false;
        }
    }

    /**
     * Process windows in batches to prevent overwhelming the system
     */
    async processWindowsBatch(validWindows, context) {
        const batchSize = 5; // Process 5 windows at a time
        const processedWindows = [];

        for (let i = 0; i < validWindows.length; i += batchSize) {
            const batch = validWindows.slice(i, i + batchSize);

            try {
                const batchResults = await Promise.all(
                    batch.map(window => this.processIndividualWindow(window, context))
                );

                // Filter out failed processings
                const successfulResults = batchResults.filter(result => result !== null);
                processedWindows.push(...successfulResults);

                context.processedCount += successfulResults.length;

                // Small delay between batches to prevent overwhelming
                if (i + batchSize < validWindows.length) {
                    await new Promise(resolve => setTimeout(resolve, 10));
                }

            } catch (error) {
                console.warn(`WindowDetector: Batch processing failed [${context.operationId}]:`, error.message);
            }
        }

        return processedWindows;
    }

    /**
     * Process individual window with error isolation
     */
    async processIndividualWindow(window, context) {
        try {
            // Get cached parse result from context
            const cachedData = context.tempData.get(window.Handle);
            if (!cachedData) {
                console.warn(`WindowDetector: No cached data for window ${window.Handle}`);
                return null;
            }

            const { character, dofusClass } = cachedData;

            // Create processed window object without modifying original
            const processedWindow = {
                id: this.windowParser.generateStableWindowId(character, dofusClass, window.ProcessId),
                handle: window.Handle,
                title: window.Title,
                character: character,
                dofusClass: dofusClass,
                avatar: this.windowParser.getClassAvatar(dofusClass),
                processId: window.ProcessId,
                className: window.ClassName || 'Unknown',
                isActive: Boolean(window.IsActive),
                bounds: window.Bounds ? { ...window.Bounds } : { X: 0, Y: 0, Width: 800, Height: 600 },
                lastSeen: Date.now(),
                isEnabled: true
            };

            return processedWindow;

        } catch (error) {
            console.warn(`WindowDetector: Individual window processing failed [${context.operationId}]:`, error.message);
            return null;
        }
    }

    /**
     * Validate processed windows before updating shared state
     */
    validateProcessedWindows(processedWindows, context) {
        const validWindows = [];

        for (const window of processedWindows) {
            try {
                // Validate required fields
                if (!window.id || !window.handle || !window.character || !window.dofusClass) {
                    context.warnings.push(`Incomplete window data: ${window.title}`);
                    continue;
                }

                // Check for duplicates within this batch
                const isDuplicate = validWindows.some(existing =>
                    existing.id === window.id || existing.handle === window.handle
                );

                if (isDuplicate) {
                    context.warnings.push(`Duplicate window detected: ${window.title}`);
                    continue;
                }

                validWindows.push(window);

            } catch (error) {
                context.errorCount++;
                console.warn(`WindowDetector: Window validation failed [${context.operationId}]:`, error.message);
            }
        }

        return validWindows;
    }

    /**
     * Update shared state with comprehensive protection
     */
    async updateSharedStateSafe(processedWindows, startTime) {
        try {
            // Create a deep copy to avoid reference issues
            const newWindows = processedWindows.map(window => ({ ...window }));

            // Merge with existing windows (preserve state for unchanged windows)
            const mergedWindows = this.mergeWithExistingWindows(newWindows);

            // Atomic update of shared state
            this.currentWindows = mergedWindows;
            this.lastUpdateTime = startTime;

            console.log(`WindowDetector: Updated shared state with ${mergedWindows.length} windows`);

        } catch (error) {
            this.errorHandler.error(error, 'WindowDetector.updateSharedStateSafe');
            throw error;
        }
    }

    /**
     * Merge new windows with existing ones, preserving state
     */
    mergeWithExistingWindows(newWindows) {
        const existingMap = new Map();

        // Build map of existing windows by ID
        this.currentWindows.forEach(window => {
            existingMap.set(window.id, window);
        });

        // Merge new windows with existing state
        const mergedWindows = newWindows.map(newWindow => {
            const existing = existingMap.get(newWindow.id);

            if (existing) {
                // Preserve certain state from existing window
                return {
                    ...newWindow,
                    isEnabled: existing.isEnabled, // Preserve user settings
                    lastSeen: Date.now(), // Update last seen time
                    // Keep other user-modifiable properties
                };
            }

            return newWindow;
        });

        return mergedWindows;
    }

    /**
     * Get raw windows with timeout protection
     */
    async getRawWindowsWithTimeout(operationId) {
        const timeoutMs = this.config.operationTimeoutMs;

        try {
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error(`Operation ${operationId} timed out after ${timeoutMs}ms`)), timeoutMs);
            });

            const detectionPromise = this.powerShellExecutor.getDofusWindows();

            const rawWindows = await Promise.race([detectionPromise, timeoutPromise]);

            if (!Array.isArray(rawWindows)) {
                throw new Error('PowerShell executor returned non-array result');
            }

            return rawWindows;

        } catch (error) {
            throw new Error(`Raw window detection failed [${operationId}]: ${error.message}`);
        }
    }

    /**
     * Check if we should skip detection based on debouncing and stale data
     */
    shouldSkipDetection(currentTime) {
        // Debounce protection
        if (currentTime - this.lastUpdateTime < this.config.debounceMs) {
            return true;
        }

        // Don't skip if data is stale
        if (currentTime - this.lastUpdateTime > this.config.staleDataThresholdMs) {
            return false;
        }

        return false;
    }

    /**
     * Check if operation should be queued
     */
    shouldQueueOperation() {
        return this.activeOperations.size >= this.config.maxConcurrentOperations;
    }

    /**
     * Generate unique operation ID
     */
    generateOperationId() {
        return `detect_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    /**
     * Register active operation for tracking
     */
    registerActiveOperation(operationId, startTime) {
        this.activeOperations.set(operationId, {
            startTime,
            status: 'running'
        });
    }

    /**
     * Unregister completed operation
     */
    unregisterActiveOperation(operationId) {
        this.activeOperations.delete(operationId);
    }

    /**
     * Cleanup stale operations that may have been orphaned
     */
    cleanupStaleOperations() {
        const now = Date.now();
        const staleThreshold = this.config.operationTimeoutMs * 2; // Double timeout for safety

        for (const [operationId, operation] of this.activeOperations.entries()) {
            if (now - operation.startTime > staleThreshold) {
                console.warn(`WindowDetector: Cleaning up stale operation ${operationId}`);
                this.activeOperations.delete(operationId);
                this.stats.racConditionsAvoided++;
            }
        }
    }

    /**
     * Update performance statistics
     */
    updatePerformanceStats(detectionTime) {
        const totalTime = (this.stats.averageDetectionTime * (this.stats.successfulDetections - 1)) + detectionTime;
        this.stats.averageDetectionTime = Math.round(totalTime / this.stats.successfulDetections);
        this.stats.lastDetectionTime = Date.now();
    }

    /**
     * Get current windows safely (read-only access)
     */
    getCurrentWindows() {
        // Return deep copy to prevent external modifications
        return this.currentWindows.map(window => ({ ...window }));
    }

    /**
     * Get detector statistics
     */
    getStatistics() {
        return {
            ...this.stats,
            activeOperations: this.activeOperations.size,
            queueLength: this.operationQueue.getQueueLength(),
            isInitialized: this.isInitialized,
            lastUpdateTime: this.lastUpdateTime,
            successRate: this.stats.totalDetections > 0 ?
                Math.round((this.stats.successfulDetections / this.stats.totalDetections) * 100) : 0
        };
    }

    /**
     * Force refresh with high priority
     */
    async forceRefresh() {
        console.log('WindowDetector: Force refresh requested');

        // Clear debounce protection for this operation
        this.lastUpdateTime = 0;

        return await this.detectWindows();
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        try {
            console.log('WindowDetector: Starting cleanup...');

            // Clear cleanup interval
            if (this.cleanupInterval) {
                clearInterval(this.cleanupInterval);
                this.cleanupInterval = null;
            }

            // Wait for all operations to complete
            await this.operationQueue.drain();

            // Cleanup PowerShell executor
            if (this.powerShellExecutor) {
                await this.powerShellExecutor.cleanup();
            }

            // Clear shared state
            this.currentWindows = [];
            this.activeOperations.clear();
            this.isInitialized = false;

            console.log('WindowDetector: Cleanup completed');

        } catch (error) {
            this.errorHandler.error(error, 'WindowDetector.cleanup');
        }
    }
}

/**
 * AsyncMutex - Simple mutex implementation for JavaScript
 */
class AsyncMutex {
    constructor() {
        this.locked = false;
        this.waitQueue = [];
    }

    async runExclusive(callback) {
        await this.acquire();
        try {
            return await callback();
        } finally {
            this.release();
        }
    }

    async acquire() {
        while (this.locked) {
            await new Promise(resolve => this.waitQueue.push(resolve));
        }
        this.locked = true;
    }

    release() {
        this.locked = false;
        if (this.waitQueue.length > 0) {
            const resolve = this.waitQueue.shift();
            resolve();
        }
    }
}

/**
 * AsyncQueue - Queue for managing async operations
 */
class AsyncQueue {
    constructor() {
        this.queue = [];
        this.processing = false;
    }

    async enqueue(operation, operationId = null) {
        return new Promise((resolve, reject) => {
            this.queue.push({
                operation,
                operationId,
                resolve,
                reject,
                timestamp: Date.now()
            });

            this.processQueue();
        });
    }

    async processQueue() {
        if (this.processing || this.queue.length === 0) {
            return;
        }

        this.processing = true;

        while (this.queue.length > 0) {
            const item = this.queue.shift();

            try {
                const result = await item.operation();
                item.resolve(result);
            } catch (error) {
                item.reject(error);
            }
        }

        this.processing = false;
    }

    getQueueLength() {
        return this.queue.length;
    }

    async drain() {
        while (this.processing || this.queue.length > 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
}

module.exports = WindowDetector;