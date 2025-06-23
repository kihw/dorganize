const { getErrorHandler } = require('../ErrorHandler');
const PowerShellExecutor = require('./PowerShellExecutor');
const WindowParser = require('./WindowParser');

/**
 * WindowDetector - Handles Dofus window detection using multiple methods
 */
class WindowDetector {
    constructor() {
        this.errorHandler = getErrorHandler();
        this.powerShellExecutor = new PowerShellExecutor();
        this.windowParser = new WindowParser();
        this.lastDetectionTime = 0;
        this.detectionCache = new Map();
        this.cacheTimeout = 2000; // 2 seconds cache
        this.detectionMethods = ['powershell', 'alternative', 'fallback'];
        this.preferredMethod = 'powershell';
    }

    /**
     * Initialize the window detector
     */
    async initialize() {
        try {
            console.log('WindowDetector: Initializing...');

            // Initialize PowerShell executor
            await this.powerShellExecutor.initialize();

            // Test detection methods and select the best one
            await this.selectBestDetectionMethod();

            console.log(`WindowDetector: Initialized with method: ${this.preferredMethod}`);
        } catch (error) {
            this.errorHandler.error(error, 'WindowDetector.initialize');
            this.preferredMethod = 'fallback';
        }
    }

    /**
     * Detect all Dofus windows
     * @returns {Array} Array of detected window objects
     */
    async detectWindows() {
        try {
            const now = Date.now();
            const cacheKey = 'all_windows';

            // Check cache first
            if (this.shouldUseCache(cacheKey, now)) {
                console.log('WindowDetector: Using cached results');
                return this.detectionCache.get(cacheKey).data;
            }

            console.log('WindowDetector: Starting window detection...');

            let rawWindows = [];
            let detectionSuccess = false;

            // Try detection methods in order of preference
            for (const method of this.getOrderedMethods()) {
                try {
                    console.log(`WindowDetector: Trying method: ${method}`);
                    rawWindows = await this.detectWithMethod(method);

                    if (rawWindows && rawWindows.length > 0) {
                        console.log(`WindowDetector: Method ${method} found ${rawWindows.length} windows`);
                        detectionSuccess = true;
                        break;
                    }
                } catch (error) {
                    this.errorHandler.warn(`Detection method ${method} failed: ${error.message}`, 'WindowDetector');
                    continue;
                }
            }

            if (!detectionSuccess) {
                console.log('WindowDetector: No windows found with any method');
                rawWindows = [];
            }

            // Filter and validate windows
            const validWindows = this.windowParser.filterValidWindows(rawWindows);

            // Cache the results
            this.detectionCache.set(cacheKey, {
                data: validWindows,
                timestamp: now
            });

            console.log(`WindowDetector: Detection complete - ${validWindows.length} valid windows found`);
            this.lastDetectionTime = now;

            return validWindows;

        } catch (error) {
            this.errorHandler.error(error, 'WindowDetector.detectWindows');
            return [];
        }
    }

    /**
     * Detect windows using specific method
     * @param {string} method - Detection method to use
     * @returns {Array} Raw window data
     */
    async detectWithMethod(method) {
        switch (method) {
            case 'powershell':
                return await this.detectWithPowerShell();
            case 'alternative':
                return await this.detectWithAlternativeMethod();
            case 'fallback':
                return await this.detectWithFallbackMethod();
            default:
                throw new Error(`Unknown detection method: ${method}`);
        }
    }

    /**
     * Detect windows using PowerShell script
     */
    async detectWithPowerShell() {
        try {
            return await this.powerShellExecutor.getDofusWindows();
        } catch (error) {
            this.errorHandler.error(error, 'WindowDetector.detectWithPowerShell');
            throw error;
        }
    }

    /**
     * Detect windows using alternative PowerShell method
     */
    async detectWithAlternativeMethod() {
        try {
            return await this.powerShellExecutor.getWindowsAlternative();
        } catch (error) {
            this.errorHandler.error(error, 'WindowDetector.detectWithAlternativeMethod');
            throw error;
        }
    }

    /**
     * Fallback detection method using basic process enumeration
     */
    async detectWithFallbackMethod() {
        try {
            console.log('WindowDetector: Using fallback method (process enumeration)');

            const { exec } = require('child_process');
            const { promisify } = require('util');
            const execAsync = promisify(exec);

            // Simple process enumeration fallback
            const command = 'tasklist /fo csv /nh | findstr /i "dofus\\|java"';
            const { stdout } = await execAsync(command, { timeout: 10000 });

            if (!stdout || !stdout.trim()) {
                return [];
            }

            // Parse CSV output and create minimal window objects
            const lines = stdout.trim().split('\n');
            const windows = [];

            for (const line of lines) {
                try {
                    const parts = line.split(',').map(part => part.replace(/"/g, '').trim());
                    if (parts.length >= 2) {
                        const processName = parts[0];
                        const processId = parts[1];

                        // Create a minimal window object for Dofus processes
                        if (processName.toLowerCase().includes('dofus') ||
                            processName.toLowerCase().includes('java')) {
                            windows.push({
                                Handle: Math.random().toString(36).substr(2, 9), // Generate fake handle
                                Title: `${processName} - Unknown Character - Dofus - Release`,
                                ProcessId: parseInt(processId) || 0,
                                ClassName: 'FallbackDetection',
                                IsActive: false,
                                Bounds: { X: 0, Y: 0, Width: 800, Height: 600 }
                            });
                        }
                    }
                } catch (parseError) {
                    // Skip malformed lines
                    continue;
                }
            }

            console.log(`WindowDetector: Fallback method found ${windows.length} potential windows`);
            return windows;

        } catch (error) {
            this.errorHandler.error(error, 'WindowDetector.detectWithFallbackMethod');
            return [];
        }
    }

    /**
     * Test detection methods and select the best one
     */
    async selectBestDetectionMethod() {
        const testResults = [];

        for (const method of this.detectionMethods) {
            try {
                const startTime = Date.now();
                const windows = await this.detectWithMethod(method);
                const duration = Date.now() - startTime;

                testResults.push({
                    method,
                    windowCount: windows ? windows.length : 0,
                    duration,
                    success: true
                });

                console.log(`WindowDetector: Method ${method} - ${windows.length} windows in ${duration}ms`);
            } catch (error) {
                testResults.push({
                    method,
                    windowCount: 0,
                    duration: 0,
                    success: false,
                    error: error.message
                });

                console.log(`WindowDetector: Method ${method} failed - ${error.message}`);
            }
        }

        // Select best method based on success and window count
        const successfulMethods = testResults.filter(r => r.success && r.windowCount > 0);

        if (successfulMethods.length > 0) {
            // Prefer method with most windows found, then fastest
            successfulMethods.sort((a, b) => {
                if (b.windowCount !== a.windowCount) {
                    return b.windowCount - a.windowCount;
                }
                return a.duration - b.duration;
            });

            this.preferredMethod = successfulMethods[0].method;
        } else {
            // No method found windows, prefer by reliability
            const workingMethods = testResults.filter(r => r.success);
            if (workingMethods.length > 0) {
                this.preferredMethod = workingMethods[0].method;
            } else {
                this.preferredMethod = 'fallback';
            }
        }

        console.log(`WindowDetector: Selected preferred method: ${this.preferredMethod}`);
    }

    /**
     * Get detection methods in order of preference
     */
    getOrderedMethods() {
        const methods = [...this.detectionMethods];

        // Move preferred method to front
        const preferredIndex = methods.indexOf(this.preferredMethod);
        if (preferredIndex > 0) {
            methods.splice(preferredIndex, 1);
            methods.unshift(this.preferredMethod);
        }

        return methods;
    }

    /**
     * Check if cache should be used
     */
    shouldUseCache(cacheKey, currentTime) {
        const cached = this.detectionCache.get(cacheKey);
        return cached && (currentTime - cached.timestamp) < this.cacheTimeout;
    }

    /**
     * Clear detection cache
     */
    clearCache() {
        this.detectionCache.clear();
        console.log('WindowDetector: Cache cleared');
    }

    /**
     * Force cache refresh on next detection
     */
    invalidateCache() {
        this.lastDetectionTime = 0;
        this.clearCache();
    }

    /**
     * Get detection statistics
     */
    getStatistics() {
        return {
            preferredMethod: this.preferredMethod,
            lastDetectionTime: this.lastDetectionTime,
            cacheSize: this.detectionCache.size,
            cacheTimeout: this.cacheTimeout,
            availableMethods: this.detectionMethods,
            powerShellReady: this.powerShellExecutor.isReady
        };
    }

    /**
     * Test specific detection method
     * @param {string} method - Method to test
     * @returns {Object} Test results
     */
    async testMethod(method) {
        try {
            const startTime = Date.now();
            const windows = await this.detectWithMethod(method);
            const duration = Date.now() - startTime;

            return {
                method,
                success: true,
                windowCount: windows.length,
                duration,
                windows: windows.map(w => ({
                    title: w.Title,
                    handle: w.Handle,
                    processId: w.ProcessId
                }))
            };
        } catch (error) {
            return {
                method,
                success: false,
                error: error.message,
                windowCount: 0,
                duration: 0
            };
        }
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        try {
            this.clearCache();

            if (this.powerShellExecutor) {
                await this.powerShellExecutor.cleanup();
            }

            console.log('WindowDetector: Cleanup completed');
        } catch (error) {
            this.errorHandler.error(error, 'WindowDetector.cleanup');
        }
    }
}

module.exports = WindowDetector;