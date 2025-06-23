const { getErrorHandler } = require('./ErrorHandler');
const { WindowActivator } = require('./WindowActivator');
const WindowDetector = require('./WindowManagerWindows/WindowDetector');
const WindowParser = require('./WindowManagerWindows/WindowParser');
const WindowStateManager = require('./WindowManagerWindows/WindowStateManager');

/**
 * WindowManagerWindows - Refactored main window manager with modular architecture
 * 
 * This class orchestrates window detection, parsing, state management, and activation
 * using specialized modules for better maintainability and testability.
 */
class WindowManagerWindows {
  constructor() {
    this.errorHandler = getErrorHandler();
    this.windowActivator = new WindowActivator();
    this.windowDetector = new WindowDetector();
    this.windowParser = new WindowParser();
    this.windowStateManager = new WindowStateManager();
    
    // State tracking
    this.lastDetectionTime = 0;
    this.isInitialized = false;
    this.detectionInProgress = false;
    
    // Performance metrics
    this.stats = {
      detectionsCount: 0,
      successfulDetections: 0,
      averageDetectionTime: 0,
      lastError: null,
      startTime: Date.now()
    };

    this.initialize();
  }

  /**
   * Initialize the window manager
   */
  async initialize() {
    try {
      console.log('WindowManagerWindows: Initializing modular architecture...');
      
      // Initialize all modules
      await this.windowDetector.initialize();
      
      // Setup state change listeners
      this.windowStateManager.onStateChange((windows) => {
        this.onWindowStateChange(windows);
      });

      this.isInitialized = true;
      console.log('WindowManagerWindows: Initialization complete');
      
    } catch (error) {
      this.errorHandler.error(error, 'WindowManagerWindows.initialize');
      this.isInitialized = false;
    }
  }

  /**
   * Get all Dofus windows with full state information
   * @returns {Array} Array of window objects with state data
   */
  async getDofusWindows() {
    if (this.detectionInProgress) {
      console.log('WindowManagerWindows: Detection already in progress, waiting...');
      return this.getLastKnownWindows();
    }

    try {
      this.detectionInProgress = true;
      const startTime = Date.now();
      
      console.log('WindowManagerWindows: Starting window detection...');
      this.stats.detectionsCount++;

      // Detect raw windows
      const rawWindows = await this.windowDetector.detectWindows();
      
      // Process windows with state management
      const processedWindows = this.windowStateManager.processWindows(rawWindows);

      // Update statistics
      const detectionTime = Date.now() - startTime;
      this.updateDetectionStats(detectionTime, processedWindows.length > 0);
      
      console.log(`WindowManagerWindows: Detection complete - ${processedWindows.length} windows found in ${detectionTime}ms`);
      
      return processedWindows;

    } catch (error) {
      this.errorHandler.error(error, 'WindowManagerWindows.getDofusWindows');
      this.stats.lastError = error.message;
      return this.getLastKnownWindows();
      
    } finally {
      this.detectionInProgress = false;
    }
  }

  /**
   * Get last known windows from state manager
   */
  getLastKnownWindows() {
    try {
      return this.windowStateManager.getAllWindows();
    } catch (error) {
      this.errorHandler.error(error, 'WindowManagerWindows.getLastKnownWindows');
      return [];
    }
  }

  /**
   * Activate a window by its ID
   * @param {string} windowId - Stable window ID
   * @returns {boolean} Success status
   */
  async activateWindow(windowId) {
    try {
      console.log(`WindowManagerWindows: Activating window ${windowId}`);

      // Get window information
      const windowInfo = this.windowStateManager.getWindow(windowId);
      if (!windowInfo) {
        console.error(`WindowManagerWindows: Window not found: ${windowId}`);
        return false;
      }

      // Use WindowActivator with window title
      const result = await this.windowActivator.activateWindow(windowInfo.title);

      if (result) {
        // Update active state
        this.windowStateManager.updateActiveState(windowId);
        console.log(`WindowManagerWindows: Window ${windowId} activated successfully`);
      } else {
        console.warn(`WindowManagerWindows: Failed to activate window ${windowId}`);
      }

      return result;

    } catch (error) {
      this.errorHandler.error(error, `WindowManagerWindows.activateWindow: ${windowId}`);
      return false;
    }
  }

  /**
   * Move a window to specified position
   * @param {string} windowId - Window ID
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {number} width - Width (optional)
   * @param {number} height - Height (optional)
   * @returns {boolean} Success status
   */
  async moveWindow(windowId, x, y, width = -1, height = -1) {
    try {
      console.log(`WindowManagerWindows: Moving window ${windowId} to ${x},${y} (${width}x${height})`);

      const windowInfo = this.windowStateManager.getWindow(windowId);
      if (!windowInfo) {
        console.error(`WindowManagerWindows: Window not found for move: ${windowId}`);
        return false;
      }

      // Using WindowActivator as placeholder for move operations
      console.log(`WindowManagerWindows: Move window ${windowId} - using placeholder activator`);
      return this.windowActivator.bringWindowToFront(windowInfo.title);

    } catch (error) {
      this.errorHandler.error(error, `WindowManagerWindows.moveWindow: ${windowId}`);
      return false;
    }
  }

  /**
   * Organize windows in specified layout
   * @param {string} layout - Layout type (grid, horizontal, vertical)
   * @returns {boolean} Success status
   */
  async organizeWindows(layout = 'grid') {
    try {
      const enabledWindows = this.windowStateManager.getEnabledWindows()
        .sort((a, b) => b.initiative - a.initiative);

      if (enabledWindows.length === 0) {
        console.log('WindowManagerWindows: No enabled windows to organize');
        return false;
      }

      console.log(`WindowManagerWindows: Organizing ${enabledWindows.length} windows in ${layout} layout`);

      // Using WindowActivator for organization placeholder
      this.windowActivator.bringWindowToFront('organize-windows-request');

      // Simulate organization for each window
      for (let i = 0; i < enabledWindows.length; i++) {
        const windowInfo = enabledWindows[i];
        console.log(`WindowManagerWindows: Organizing window ${i + 1}/${enabledWindows.length}: ${windowInfo.character}`);
        await this.windowActivator.activateWindow(windowInfo.title);
        
        // Add small delay to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log('WindowManagerWindows: Window organization complete');
      return true;

    } catch (error) {
      this.errorHandler.error(error, `WindowManagerWindows.organizeWindows: ${layout}`);
      return false;
    }
  }

  /**
   * Update window character name
   * @param {string} windowId - Window ID
   * @param {string} newName - New character name
   * @returns {boolean} Success status
   */
  async updateCharacterName(windowId, newName) {
    try {
      await this.windowStateManager.updateCharacterName(windowId, newName);
      console.log(`WindowManagerWindows: Updated character name for ${windowId}: ${newName}`);
      return true;
    } catch (error) {
      this.errorHandler.error(error, `WindowManagerWindows.updateCharacterName: ${windowId}`);
      return false;
    }
  }

  /**
   * Update window initiative
   * @param {string} windowId - Window ID
   * @param {number} newInitiative - New initiative value
   * @returns {boolean} Success status
   */
  async updateInitiative(windowId, newInitiative) {
    try {
      await this.windowStateManager.updateInitiative(windowId, newInitiative);
      console.log(`WindowManagerWindows: Updated initiative for ${windowId}: ${newInitiative}`);
      return true;
    } catch (error) {
      this.errorHandler.error(error, `WindowManagerWindows.updateInitiative: ${windowId}`);
      return false;
    }
  }

  /**
   * Update window class
   * @param {string} windowId - Window ID
   * @param {string} newClass - New class
   * @returns {boolean} Success status
   */
  async updateClass(windowId, newClass) {
    try {
      await this.windowStateManager.updateClass(windowId, newClass);
      console.log(`WindowManagerWindows: Updated class for ${windowId}: ${newClass}`);
      return true;
    } catch (error) {
      this.errorHandler.error(error, `WindowManagerWindows.updateClass: ${windowId}`);
      return false;
    }
  }

  /**
   * Update window enabled state
   * @param {string} windowId - Window ID
   * @param {boolean} enabled - Enabled state
   * @returns {boolean} Success status
   */
  async updateEnabled(windowId, enabled) {
    try {
      await this.windowStateManager.updateEnabled(windowId, enabled);
      console.log(`WindowManagerWindows: Updated enabled state for ${windowId}: ${enabled}`);
      return true;
    } catch (error) {
      this.errorHandler.error(error, `WindowManagerWindows.updateEnabled: ${windowId}`);
      return false;
    }
  }

  /**
   * Update window shortcut
   * @param {string} windowId - Window ID
   * @param {string} shortcut - Shortcut string
   * @returns {boolean} Success status
   */
  async updateShortcut(windowId, shortcut) {
    try {
      await this.windowStateManager.updateShortcut(windowId, shortcut);
      console.log(`WindowManagerWindows: Updated shortcut for ${windowId}: ${shortcut}`);
      return true;
    } catch (error) {
      this.errorHandler.error(error, `WindowManagerWindows.updateShortcut: ${windowId}`);
      return false;
    }
  }

  /**
   * Get Dofus classes information
   * @returns {Object} Classes information
   */
  getDofusClasses() {
    return this.windowParser.getDofusClasses();
  }

  /**
   * Get class avatar for a class name
   * @param {string} className - Class name
   * @returns {string} Avatar identifier
   */
  getClassAvatar(className) {
    return this.windowParser.getClassAvatar(className);
  }

  /**
   * Get class name for a class key
   * @param {string} classKey - Class key
   * @returns {string} Class display name
   */
  getClassName(classKey) {
    return this.windowParser.getClassName(classKey);
  }

  /**
   * Force cache refresh on next detection
   */
  invalidateCache() {
    try {
      this.windowDetector.invalidateCache();
      console.log('WindowManagerWindows: Cache invalidated');
    } catch (error) {
      this.errorHandler.error(error, 'WindowManagerWindows.invalidateCache');
    }
  }

  /**
   * Handle window state changes
   * @param {Array} windows - Updated windows array
   */
  onWindowStateChange(windows) {
    try {
      console.log(`WindowManagerWindows: State change notification - ${windows.length} windows`);
      
      // Update last detection time
      this.lastDetectionTime = Date.now();
      
      // Could emit events here for UI updates
      // this.emit('windows-updated', windows);
      
    } catch (error) {
      this.errorHandler.error(error, 'WindowManagerWindows.onWindowStateChange');
    }
  }

  /**
   * Update detection statistics
   * @param {number} detectionTime - Time taken for detection
   * @param {boolean} success - Whether detection was successful
   */
  updateDetectionStats(detectionTime, success) {
    try {
      if (success) {
        this.stats.successfulDetections++;
      }

      // Update average detection time
      const totalTime = (this.stats.averageDetectionTime * (this.stats.detectionsCount - 1)) + detectionTime;
      this.stats.averageDetectionTime = Math.round(totalTime / this.stats.detectionsCount);

      this.lastDetectionTime = Date.now();

    } catch (error) {
      this.errorHandler.error(error, 'WindowManagerWindows.updateDetectionStats');
    }
  }

  /**
   * Get window manager statistics
   * @returns {Object} Statistics object
   */
  getStatistics() {
    try {
      const detectorStats = this.windowDetector.getStatistics();
      const stateStats = this.windowStateManager.getStatistics();
      const activatorStats = this.windowActivator.getStats();

      return {
        // Overall stats
        isInitialized: this.isInitialized,
        detectionInProgress: this.detectionInProgress,
        lastDetectionTime: this.lastDetectionTime,
        uptime: Date.now() - this.stats.startTime,

        // Detection stats
        detection: {
          ...this.stats,
          successRate: this.stats.detectionsCount > 0 
            ? Math.round((this.stats.successfulDetections / this.stats.detectionsCount) * 100) 
            : 0,
          detector: detectorStats
        },

        // State management stats
        state: stateStats,

        // Window activation stats
        activation: activatorStats,

        // Memory usage
        memory: {
          modules: {
            detector: 'initialized',
            parser: 'initialized', 
            stateManager: 'initialized',
            activator: 'initialized'
          }
        }
      };

    } catch (error) {
      this.errorHandler.error(error, 'WindowManagerWindows.getStatistics');
      return {
        error: 'Failed to get statistics',
        isInitialized: this.isInitialized
      };
    }
  }

  /**
   * Test window detection methods
   * @returns {Object} Test results
   */
  async testDetectionMethods() {
    try {
      console.log('WindowManagerWindows: Testing detection methods...');
      
      const results = [];
      const methods = ['powershell', 'alternative', 'fallback'];

      for (const method of methods) {
        const result = await this.windowDetector.testMethod(method);
        results.push(result);
        console.log(`WindowManagerWindows: Method ${method} - ${result.success ? 'SUCCESS' : 'FAILED'} - ${result.windowCount} windows`);
      }

      return {
        timestamp: new Date().toISOString(),
        results,
        preferredMethod: this.windowDetector.getStatistics().preferredMethod
      };

    } catch (error) {
      this.errorHandler.error(error, 'WindowManagerWindows.testDetectionMethods');
      return {
        error: error.message,
        results: []
      };
    }
  }

  /**
   * Export window states
   * @returns {Object} Exported state data
   */
  exportStates() {
    try {
      return this.windowStateManager.exportStates();
    } catch (error) {
      this.errorHandler.error(error, 'WindowManagerWindows.exportStates');
      return null;
    }
  }

  /**
   * Import window states
   * @param {Object} stateData - State data to import
   * @returns {boolean} Success status
   */
  importStates(stateData) {
    try {
      return this.windowStateManager.importStates(stateData);
    } catch (error) {
      this.errorHandler.error(error, 'WindowManagerWindows.importStates');
      return false;
    }
  }

  /**
   * Reset all window states (for testing/debugging)
   * @returns {boolean} Success status
   */
  resetAllStates() {
    try {
      const success = this.windowStateManager.resetAllStates();
      if (success) {
        this.invalidateCache();
        console.log('WindowManagerWindows: All states reset');
      }
      return success;
    } catch (error) {
      this.errorHandler.error(error, 'WindowManagerWindows.resetAllStates');
      return false;
    }
  }

  /**
   * Cleanup all resources
   */
  async cleanup() {
    try {
      console.log('WindowManagerWindows: Starting cleanup...');

      // Cleanup all modules
      await Promise.all([
        this.windowDetector.cleanup(),
        this.windowStateManager.cleanup(),
        this.windowActivator.cleanup()
      ]);

      // Reset state
      this.isInitialized = false;
      this.detectionInProgress = false;

      console.log('WindowManagerWindows: Cleanup completed');

    } catch (error) {
      this.errorHandler.error(error, 'WindowManagerWindows.cleanup');
    }
  }
}

module.exports = WindowManagerWindows;