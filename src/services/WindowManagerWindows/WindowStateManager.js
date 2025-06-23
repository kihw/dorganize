const Store = require('electron-store');
const { getErrorHandler } = require('../ErrorHandler');

/**
 * WindowStateManager - Manages window state, storage, and persistence
 */
class WindowStateManager {
    constructor() {
        this.errorHandler = getErrorHandler();
        this.store = new Store();
        this.windows = new Map();
        this.windowIdMapping = new Map(); // Map stable IDs to current window handles
        this.stateChangeCallbacks = new Set();
        this.lastStateUpdate = 0;

        // Storage keys
        this.storageKeys = {
            customNames: 'customNames',
            initiatives: 'initiatives',
            classes: 'classes',
            shortcuts: 'shortcuts',
            enabledWindows: 'enabledWindows',
            windowPositions: 'windowPositions',
            windowStates: 'windowStates'
        };

        this.initializeStorage();
    }
}

module.exports = WindowStateManager;

/**
 * Initialize storage and load existing data
 */
initializeStorage() {
    try {
        // Ensure all storage keys exist with default values
        Object.values(this.storageKeys).forEach(key => {
            if (!this.store.has(key)) {
                this.store.set(key, {});
            }
        });

        console.log('WindowStateManager: Storage initialized');
    } catch (error) {
        this.errorHandler.error(error, 'WindowStateManager.initializeStorage');
    }
}

/**
 * Process and update window states from raw window data
 * @param {Array} rawWindows - Raw window data from detection
 * @returns {Array} Processed windows with state information
 */
processWindows(rawWindows) {
    try {
        const processedWindows = [];
        const currentWindowIds = new Set();

        for (const rawWindow of rawWindows) {
            const processedWindow = this.processWindow(rawWindow);
            if (processedWindow) {
                processedWindows.push(processedWindow);
                currentWindowIds.add(processedWindow.id);
            }
        }

        // Clean up stale windows
        this.cleanupStaleWindows(currentWindowIds);

        // Update last state update time
        this.lastStateUpdate = Date.now();

        // Notify callbacks of state change
        this.notifyStateChange(processedWindows);

        console.log(`WindowStateManager: Processed ${processedWindows.length} windows`);
        return processedWindows;

    } catch (error) {
        this.errorHandler.error(error, 'WindowStateManager.processWindows');
        return [];
    }
}

/**
 * Process individual window and enrich with state data
 * @param {Object} rawWindow - Raw window data
 * @returns {Object|null} Processed window or null if invalid
 */
processWindow(rawWindow) {
    try {
        // Validate raw window data
        if (!this.isValidRawWindow(rawWindow)) {
            return null;
        }

        const windowHandle = rawWindow.Handle.toString();

        // Parse character info from window parser
        const WindowParser = require('./WindowParser');
        const parser = new WindowParser();
        const { character, dofusClass, isValid } = parser.parseWindowTitle(rawWindow.Title);

        if (!isValid) {
            console.log(`WindowStateManager: Skipping window with invalid character info: ${rawWindow.Title}`);
            return null;
        }

        // Generate stable ID
        const stableId = this.generateStableWindowId(character, dofusClass, rawWindow.ProcessId);
        if (!stableId) {
            console.warn(`WindowStateManager: Could not generate stable ID for window: ${rawWindow.Title}`);
            return null;
        }

        // Map the stable ID to current window handle
        this.windowIdMapping.set(stableId, windowHandle);

        // Load stored state data
        const storedState = this.loadWindowState(stableId);

        // Create processed window object
        const processedWindow = {
            // Core identification
            id: stableId,
            handle: windowHandle,
            title: rawWindow.Title,
            processName: this.extractProcessName(rawWindow.ClassName),
            className: rawWindow.ClassName || 'Unknown',
            pid: (rawWindow.ProcessId || 0).toString(),

            // Character information
            character: character,
            dofusClass: storedState.dofusClass || dofusClass,
            customName: storedState.customName,

            // Game state
            initiative: storedState.initiative,
            isActive: rawWindow.IsActive || false,
            enabled: storedState.enabled,

            // Window properties
            bounds: rawWindow.Bounds || { X: 0, Y: 0, Width: 800, Height: 600 },
            avatar: parser.getClassAvatar(storedState.dofusClass || dofusClass),

            // User settings
            shortcut: storedState.shortcut,

            // Metadata
            lastSeen: new Date().toISOString(),
            detectionMethod: rawWindow.detectionMethod || 'unknown'
        };

        // Store the window in memory
        this.windows.set(stableId, {
            info: processedWindow,
            lastUpdate: Date.now(),
            stateHash: this.generateStateHash(processedWindow)
        });

        return processedWindow;

    } catch (error) {
        this.errorHandler.error(error, `WindowStateManager.processWindow: ${rawWindow.Title}`);
        return null;
    }
}

/**
 * Validate raw window data
 */
isValidRawWindow(rawWindow) {
    return rawWindow &&
        rawWindow.Handle &&
        rawWindow.Handle !== '0' &&
        rawWindow.Handle !== 0 &&
        rawWindow.Title &&
        typeof rawWindow.Title === 'string';
}

/**
 * Generate stable window ID
 */
generateStableWindowId(character, dofusClass, processId) {
    if (!character || !dofusClass) {
        return null;
    }

    const cleanCharacter = character.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanClass = dofusClass.toLowerCase().replace(/[^a-z0-9]/g, '');
    return `${cleanCharacter}_${cleanClass}_${processId}`;
}

/**
 * Load window state from storage
 */
loadWindowState(windowId) {
    try {
        return {
            customName: this.getStoredValue(this.storageKeys.customNames, windowId),
            initiative: this.getStoredValue(this.storageKeys.initiatives, windowId, 0),
            dofusClass: this.getStoredValue(this.storageKeys.classes, windowId),
            shortcut: this.getStoredValue(this.storageKeys.shortcuts, windowId),
            enabled: this.getStoredValue(this.storageKeys.enabledWindows, windowId, true),
            position: this.getStoredValue(this.storageKeys.windowPositions, windowId)
        };
    } catch (error) {
        this.errorHandler.error(error, `WindowStateManager.loadWindowState: ${windowId}`);
        return {
            customName: null,
            initiative: 0,
            dofusClass: null,
            shortcut: null,
            enabled: true,
            position: null
        };
    }
}

/**
 * Get stored value with fallback
 */
getStoredValue(storageKey, windowId, defaultValue = null) {
    try {
        const storage = this.store.get(storageKey, {});
        return storage[windowId] !== undefined ? storage[windowId] : defaultValue;
    } catch (error) {
        return defaultValue;
    }
}

/**
 * Save window state to storage
 */
saveWindowState(windowId, stateData) {
    try {
        const promises = [];

        // Save each piece of state data
        Object.entries(stateData).forEach(([key, value]) => {
            if (this.storageKeys[key] && value !== undefined) {
                promises.push(this.saveToStorage(this.storageKeys[key], windowId, value));
            }
        });

        // Wait for all saves to complete
        Promise.all(promises).catch(error => {
            this.errorHandler.error(error, `WindowStateManager.saveWindowState: ${windowId}`);
        });

        // Update in-memory state
        const windowData = this.windows.get(windowId);
        if (windowData) {
            Object.assign(windowData.info, stateData);
            windowData.lastUpdate = Date.now();
            windowData.stateHash = this.generateStateHash(windowData.info);
        }

        console.log(`WindowStateManager: Saved state for window ${windowId}`);
        return true;

    } catch (error) {
        this.errorHandler.error(error, `WindowStateManager.saveWindowState: ${windowId}`);
        return false;
        /**
         * Cleanup resources
         */
        cleanup() {
            try {
                // Clear all callbacks
                this.stateChangeCallbacks.clear();

                // Clear memory
                this.windows.clear();
                this.windowIdMapping.clear();

                console.log('WindowStateManager: Cleanup completed');
            } catch (error) {
                this.errorHandler.error(error, 'WindowStateManager.cleanup');
            }
        }

/**
 * Save to specific storage key
 */
async saveToStorage(storageKey, windowId, value) {
   * Save to specific storage key
                */
  async saveToStorage(storageKey, windowId, value) {
                try {
                    const storage = this.store.get(storageKey, {});
                    storage[windowId] = value;
                    this.store.set(storageKey, storage);
                } catch (error) {
                    this.errorHandler.error(error, `WindowStateManager.saveToStorage: ${storageKey}/${windowId}`);
                    throw error;
                }
            }

  /**
   * Update window character name
   */
  async updateCharacterName(windowId, newName) {
                if (!this.validateCharacterName(newName)) {
                    throw new Error('Invalid character name');
                }

                return this.saveWindowState(windowId, { customName: newName });
            }

  /**
   * Update window initiative
   */
  async updateInitiative(windowId, newInitiative) {
                const initiative = parseInt(newInitiative) || 0;

                if (!this.validateInitiative(initiative)) {
                    throw new Error('Invalid initiative value');
                }

                return this.saveWindowState(windowId, { initiative });
            }

  /**
   * Update window class
   */
  async updateClass(windowId, newClass) {
                if (!this.validateClass(newClass)) {
                    throw new Error('Invalid class');
                }

                return this.saveWindowState(windowId, { dofusClass: newClass });
            }

  /**
   * Update window enabled state
   */
  async updateEnabled(windowId, enabled) {
                return this.saveWindowState(windowId, { enabled: Boolean(enabled) });
            }

  /**
   * Update window shortcut
   */
  async updateShortcut(windowId, shortcut) {
                return this.saveWindowState(windowId, { shortcut });
            }

            /**
             * Update window active state
             */
            updateActiveState(activeWindowId) {
                try {
                    // Update active state for all windows
                    for (const [windowId, windowData] of this.windows) {
                        const wasActive = windowData.info.isActive;
                        const isActive = windowId === activeWindowId;

                        if (wasActive !== isActive) {
                            windowData.info.isActive = isActive;
                            windowData.lastUpdate = Date.now();
                            windowData.stateHash = this.generateStateHash(windowData.info);
                        }
                    }

                    console.log(`WindowStateManager: Updated active state for window ${activeWindowId}`);
                } catch (error) {
                    this.errorHandler.error(error, 'WindowStateManager.updateActiveState');
                }
            }

            /**
             * Get window by ID
             */
            getWindow(windowId) {
                const windowData = this.windows.get(windowId);
                return windowData ? windowData.info : null;
            }

            /**
             * Get all windows
             */
            getAllWindows() {
                return Array.from(this.windows.values()).map(windowData => windowData.info);
            }

            /**
             * Get enabled windows
             */
            getEnabledWindows() {
                return this.getAllWindows().filter(window => window.enabled !== false);
            }

            /**
             * Get window handle for stable ID
             */
            getWindowHandle(windowId) {
                return this.windowIdMapping.get(windowId);
            }

            /**
             * Clean up stale windows that are no longer detected
             */
            cleanupStaleWindows(currentWindowIds) {
                try {
                    let cleanedCount = 0;

                    for (const [windowId] of this.windows) {
                        if (!currentWindowIds.has(windowId)) {
                            this.windows.delete(windowId);
                            this.windowIdMapping.delete(windowId);
                            cleanedCount++;
                        }
                    }

                    if (cleanedCount > 0) {
                        console.log(`WindowStateManager: Cleaned up ${cleanedCount} stale windows`);
                    }

                } catch (error) {
                    this.errorHandler.error(error, 'WindowStateManager.cleanupStaleWindows');
                }
            }

            /**
             * Generate state hash for change detection
             */
            generateStateHash(windowInfo) {
                const stateString = JSON.stringify({
                    character: windowInfo.character,
                    dofusClass: windowInfo.dofusClass,
                    customName: windowInfo.customName,
                    initiative: windowInfo.initiative,
                    enabled: windowInfo.enabled,
                    shortcut: windowInfo.shortcut,
                    isActive: windowInfo.isActive
                });

                return require('crypto').createHash('md5').update(stateString).digest('hex');
            }

            /**
             * Extract process name from class name
             */
            extractProcessName(className) {
                if (!className) return 'Dofus';

                if (className.includes('Unity')) return 'Dofus 3 (Unity)';
                if (className.includes('Java') || className.includes('SunAwt')) return 'Dofus 2 (Java)';
                if (className.includes('Retro')) return 'Dofus Retro';

                return 'Dofus';
            }

            /**
             * Validation methods
             */
            validateCharacterName(name) {
                return name &&
                    typeof name === 'string' &&
                    name.trim().length > 0 &&
                    name.trim().length <= 50;
            }

            validateInitiative(initiative) {
                return Number.isInteger(initiative) && initiative >= 0 && initiative <= 9999;
            }

            validateClass(className) {
                const WindowParser = require('./WindowParser');
                const parser = new WindowParser();
                return parser.isValidClass(className);
            }

            /**
             * Register callback for state changes
             */
            onStateChange(callback) {
                if (typeof callback === 'function') {
                    this.stateChangeCallbacks.add(callback);
                }
            }

            /**
             * Remove state change callback
             */
            offStateChange(callback) {
                this.stateChangeCallbacks.delete(callback);
            }

            /**
             * Notify all callbacks of state change
             */
            notifyStateChange(windows) {
                try {
                    for (const callback of this.stateChangeCallbacks) {
                        try {
                            callback(windows);
                        } catch (error) {
                            this.errorHandler.error(error, 'WindowStateManager.notifyStateChange.callback');
                        }
                    }
                } catch (error) {
                    this.errorHandler.error(error, 'WindowStateManager.notifyStateChange');
                }
            }

            /**
             * Export all window states
             */
            exportStates() {
                try {
                    const states = {};

                    Object.values(this.storageKeys).forEach(key => {
                        states[key] = this.store.get(key, {});
                    });

                    return {
                        states,
                        exportedAt: new Date().toISOString(),
                        windowCount: this.windows.size
                    };
                } catch (error) {
                    this.errorHandler.error(error, 'WindowStateManager.exportStates');
                    return null;
                }
            }

            /**
             * Import window states
             */
            importStates(importData) {
                try {
                    if (!importData || !importData.states) {
                        throw new Error('Invalid import data');
                    }

                    let importCount = 0;

                    Object.entries(importData.states).forEach(([key, data]) => {
                        if (this.storageKeys[key] || Object.values(this.storageKeys).includes(key)) {
                            this.store.set(key, data);
                            importCount++;
                        }
                    });

                    console.log(`WindowStateManager: Imported ${importCount} state categories`);
                    return true;

                } catch (error) {
                    this.errorHandler.error(error, 'WindowStateManager.importStates');
                    return false;
                }
            }

            /**
             * Get state statistics
             */
            getStatistics() {
                const windows = this.getAllWindows();
                const enabledCount = windows.filter(w => w.enabled !== false).length;
                const activeCount = windows.filter(w => w.isActive).length;
                const withShortcuts = windows.filter(w => w.shortcut).length;
                const withCustomNames = windows.filter(w => w.customName).length;

                return {
                    totalWindows: windows.length,
                    enabledWindows: enabledCount,
                    disabledWindows: windows.length - enabledCount,
                    activeWindows: activeCount,
                    windowsWithShortcuts: withShortcuts,
                    windowsWithCustomNames: withCustomNames,
                    lastStateUpdate: this.lastStateUpdate,
                    stateChangeCallbacks: this.stateChangeCallbacks.size,
                    memoryUsage: {
                        windowsMap: this.windows.size,
                        idMappings: this.windowIdMapping.size
                    }
                };
            }

            /**
             * Reset all states (for testing/debugging)
             */
            resetAllStates() {
                try {
                    // Clear memory
                    this.windows.clear();
                    this.windowIdMapping.clear();

                    // Clear storage
                    Object.values(this.storageKeys).forEach(key => {
                        this.store.set(key, {});
                    });

                    console.log('WindowStateManager: All states reset');
                    return true;

                } catch (error) {
                    this.errorHandler.error(error, 'WindowStateManager.resetAllStates');
                    return false;
                }