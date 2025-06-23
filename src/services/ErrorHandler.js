/**
 * ErrorHandler - Centralized error handling system with logging levels and user notifications
 * Provides unified error handling, logging, and notification across the application
 */

const { app, dialog, ipcMain } = require('electron');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

class ErrorHandler {
  constructor() {
    this.logLevels = {
      DEBUG: 0,
      INFO: 1,
      WARN: 2,
      ERROR: 3,
      FATAL: 4
    };

    this.currentLogLevel = this.logLevels.INFO;
    this.logFile = path.join(app.getPath('userData'), 'logs', 'error.log');
    this.maxLogSize = 10 * 1024 * 1024; // 10MB
    this.maxLogFiles = 5;
    this.errorQueue = [];
    this.isProcessingQueue = false;
    this.startTime = Date.now();
    this.errorCounts = new Map();
    this.lastErrorTimes = new Map();
    this.rateLimitWindow = 60000; // 1 minute
    this.maxErrorsPerWindow = 10;

    this.initializeLogging();
    this.setupIpcHandlers();
  }

  /**
   * Initialize logging directory and setup
   */
  async initializeLogging() {
    try {
      const logDir = path.dirname(this.logFile);
      await fs.mkdir(logDir, { recursive: true });
      
      // Rotate logs on startup if needed
      await this.rotateLogsIfNeeded();
      
      // Log startup
      await this.logToFile('INFO', 'ErrorHandler initialized', {
        nodeVersion: process.version,
        electronVersion: process.versions.electron,
        platform: process.platform,
        arch: process.arch,
        logFile: this.logFile
      });
      
      console.log('ErrorHandler: Logging system initialized');
    } catch (error) {
      console.error('ErrorHandler: Failed to initialize logging:', error);
    }
  }

  /**
   * Setup IPC handlers for renderer error reporting
   */
  setupIpcHandlers() {
    // Handle errors from renderer processes
    ipcMain.handle('error-report', (event, errorData) => {
      this.handleError(errorData.error, errorData.context, errorData.severity || 'ERROR');
    });

    // Handle dock errors
    ipcMain.on('dock-error', (event, errorData) => {
      this.handleError(errorData.error, `Dock: ${errorData.context}`, 'ERROR');
    });

    console.log('ErrorHandler: IPC handlers registered');
  }

  /**
   * Main error handling method
   * @param {Error|string} error - The error to handle
   * @param {string} context - Context where the error occurred
   * @param {string} severity - Error severity level
   * @param {Object} metadata - Additional metadata
   */
  async handleError(error, context = 'Unknown', severity = 'ERROR', metadata = {}) {
    try {
      // Rate limiting to prevent spam
      if (this.isRateLimited(error, context)) {
        return;
      }

      const errorInfo = this.parseError(error, context, severity, metadata);
      
      // Add to processing queue
      this.errorQueue.push(errorInfo);
      
      // Process queue if not already processing
      if (!this.isProcessingQueue) {
        await this.processErrorQueue();
      }

      // Handle fatal errors immediately
      if (severity === 'FATAL') {
        await this.handleFatalError(errorInfo);
      }

    } catch (processingError) {
      // Fallback logging if error handling fails
      console.error('ErrorHandler: Failed to handle error:', processingError);
      console.error('Original error:', error);
    }
  }

  /**
   * Parse error into standardized format
   */
  parseError(error, context, severity, metadata) {
    const timestamp = new Date().toISOString();
    const errorId = this.generateErrorId();

    let errorInfo = {
      id: errorId,
      timestamp,
      severity: severity.toUpperCase(),
      context,
      metadata: {
        ...metadata,
        uptime: Date.now() - this.startTime,
        memoryUsage: process.memoryUsage(),
        platform: process.platform,
        arch: process.arch
      }
    };

    if (error instanceof Error) {
      errorInfo.message = error.message;
      errorInfo.name = error.name;
      errorInfo.stack = error.stack;
      errorInfo.code = error.code;
    } else if (typeof error === 'string') {
      errorInfo.message = error;
      errorInfo.name = 'CustomError';
    } else {
      errorInfo.message = JSON.stringify(error);
      errorInfo.name = 'UnknownError';
    }

    return errorInfo;
  }

  /**
   * Generate unique error ID
   */
  generateErrorId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `${timestamp}-${random}`;
  }

  /**
   * Check if error is rate limited
   */
  isRateLimited(error, context) {
    const errorKey = `${context}:${error?.message || error}`;
    const now = Date.now();
    
    // Clean old entries
    for (const [key, time] of this.lastErrorTimes) {
      if (now - time > this.rateLimitWindow) {
        this.lastErrorTimes.delete(key);
        this.errorCounts.delete(key);
      }
    }

    const errorCount = this.errorCounts.get(errorKey) || 0;
    const lastTime = this.lastErrorTimes.get(errorKey) || 0;

    if (now - lastTime < this.rateLimitWindow && errorCount >= this.maxErrorsPerWindow) {
      return true; // Rate limited
    }

    this.errorCounts.set(errorKey, errorCount + 1);
    this.lastErrorTimes.set(errorKey, now);
    return false;
  }

  /**
   * Process error queue
   */
  async processErrorQueue() {
    if (this.isProcessingQueue || this.errorQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      while (this.errorQueue.length > 0) {
        const errorInfo = this.errorQueue.shift();
        await this.processError(errorInfo);
      }
    } catch (error) {
      console.error('ErrorHandler: Error processing queue:', error);
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Process individual error
   */
  async processError(errorInfo) {
    // Log to console with appropriate level
    this.logToConsole(errorInfo);

    // Log to file
    await this.logToFile(errorInfo.severity, errorInfo.message, errorInfo);

    // Show user notification for high severity errors
    if (this.shouldShowUserNotification(errorInfo.severity)) {
      this.showUserNotification(errorInfo);
    }

    // Send to crash reporting service (if configured)
    if (this.shouldReportCrash(errorInfo.severity)) {
      await this.reportCrash(errorInfo);
    }
  }

  /**
   * Log to console with appropriate formatting
   */
  logToConsole(errorInfo) {
    const { timestamp, severity, context, message, stack } = errorInfo;
    const logMessage = `[${timestamp}] ${severity} [${context}]: ${message}`;

    switch (severity) {
      case 'DEBUG':
        if (this.currentLogLevel <= this.logLevels.DEBUG) {
          console.debug(logMessage);
        }
        break;
      case 'INFO':
        if (this.currentLogLevel <= this.logLevels.INFO) {
          console.log(logMessage);
        }
        break;
      case 'WARN':
        if (this.currentLogLevel <= this.logLevels.WARN) {
          console.warn(logMessage);
        }
        break;
      case 'ERROR':
      case 'FATAL':
        if (this.currentLogLevel <= this.logLevels.ERROR) {
          console.error(logMessage);
          if (stack) {
            console.error(stack);
          }
        }
        break;
    }
  }

  /**
   * Log to file
   */
  async logToFile(level, message, errorInfo = {}) {
    try {
      await this.rotateLogsIfNeeded();

      const logEntry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        ...errorInfo
      };

      const logLine = JSON.stringify(logEntry) + '\n';
      await fs.appendFile(this.logFile, logLine);

    } catch (error) {
      console.error('ErrorHandler: Failed to write to log file:', error);
    }
  }

  /**
   * Rotate logs if file is too large
   */
  async rotateLogsIfNeeded() {
    try {
      const stats = await fs.stat(this.logFile).catch(() => null);
      
      if (stats && stats.size > this.maxLogSize) {
        await this.rotateLogs();
      }
    } catch (error) {
      console.error('ErrorHandler: Error checking log rotation:', error);
    }
  }

  /**
   * Rotate log files
   */
  async rotateLogs() {
    try {
      const logDir = path.dirname(this.logFile);
      const logBaseName = path.basename(this.logFile, '.log');

      // Move old logs
      for (let i = this.maxLogFiles - 1; i >= 1; i--) {
        const oldFile = path.join(logDir, `${logBaseName}.${i}.log`);
        const newFile = path.join(logDir, `${logBaseName}.${i + 1}.log`);
        
        try {
          await fs.rename(oldFile, newFile);
        } catch (error) {
          // File may not exist, which is fine
        }
      }

      // Move current log to .1
      const rotatedFile = path.join(logDir, `${logBaseName}.1.log`);
      await fs.rename(this.logFile, rotatedFile).catch(() => {});

      // Clean up old files beyond max count
      for (let i = this.maxLogFiles + 1; i <= this.maxLogFiles + 5; i++) {
        const oldFile = path.join(logDir, `${logBaseName}.${i}.log`);
        await fs.unlink(oldFile).catch(() => {});
      }

      console.log('ErrorHandler: Log files rotated');
    } catch (error) {
      console.error('ErrorHandler: Error rotating logs:', error);
    }
  }

  /**
   * Determine if user notification should be shown
   */
  shouldShowUserNotification(severity) {
    return ['ERROR', 'FATAL'].includes(severity);
  }

  /**
   * Show user notification
   */
  showUserNotification(errorInfo) {
    // Don't show notifications during development/testing
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
      return;
    }

    const { severity, message, context } = errorInfo;
    
    // Simplify message for user
    const userMessage = this.simplifyErrorMessage(message);
    
    const options = {
      type: severity === 'FATAL' ? 'error' : 'warning',
      title: 'Dorganize Error',
      message: `An error occurred in ${context}`,
      detail: userMessage,
      buttons: ['OK', 'Report Issue'],
      defaultId: 0
    };

    dialog.showMessageBox(null, options).then(result => {
      if (result.response === 1) {
        // User chose to report issue
        this.openIssueReporting(errorInfo);
      }
    }).catch(err => {
      console.error('ErrorHandler: Error showing notification:', err);
    });
  }

  /**
   * Simplify error message for users
   */
  simplifyErrorMessage(message) {
    // Common error message simplifications
    const simplifications = {
      'ENOENT': 'File or directory not found',
      'EACCES': 'Permission denied',
      'ETIMEDOUT': 'Operation timed out',
      'ECONNREFUSED': 'Connection refused',
      'Cannot read property': 'Invalid data access',
      'Cannot read properties': 'Invalid data access',
      'fetch failed': 'Network request failed',
      'JSON.parse': 'Invalid data format'
    };

    for (const [pattern, replacement] of Object.entries(simplifications)) {
      if (message.includes(pattern)) {
        return replacement;
      }
    }

    // If no simplification found, return truncated original
    return message.length > 100 ? message.substring(0, 100) + '...' : message;
  }

  /**
   * Determine if crash should be reported
   */
  shouldReportCrash(severity) {
    return severity === 'FATAL' || (severity === 'ERROR' && Math.random() < 0.1); // 10% sampling
  }

  /**
   * Report crash to external service
   */
  async reportCrash(errorInfo) {
    // Placeholder for crash reporting service integration
    // This could integrate with services like Sentry, Bugsnag, etc.
    
    try {
      const crashReport = {
        ...errorInfo,
        appVersion: app.getVersion(),
        userAgent: `Dorganize/${app.getVersion()} (${process.platform})`,
        timestamp: Date.now()
      };

      // For now, just log that we would report
      await this.logToFile('INFO', 'Crash report generated', { crashReportId: errorInfo.id });
      
    } catch (error) {
      console.error('ErrorHandler: Failed to report crash:', error);
    }
  }

  /**
   * Open issue reporting
   */
  openIssueReporting(errorInfo) {
    const { shell } = require('electron');
    
    // Create GitHub issue URL with pre-filled information
    const issueTitle = encodeURIComponent(`Error in ${errorInfo.context}: ${errorInfo.message.substring(0, 50)}...`);
    const issueBody = encodeURIComponent(`
## Error Report

**Error ID:** ${errorInfo.id}
**Timestamp:** ${errorInfo.timestamp}
**Context:** ${errorInfo.context}
**Severity:** ${errorInfo.severity}

**Error Message:**
\`\`\`
${errorInfo.message}
\`\`\`

**System Information:**
- Platform: ${errorInfo.metadata.platform}
- Architecture: ${errorInfo.metadata.arch}
- App Version: ${app.getVersion()}
- Node Version: ${process.version}
- Uptime: ${Math.round(errorInfo.metadata.uptime / 1000)}s

**Additional Details:**
Please describe what you were doing when this error occurred.
    `);

    const issueUrl = `https://github.com/kihw/dorganize/issues/new?title=${issueTitle}&body=${issueBody}`;
    shell.openExternal(issueUrl);
  }

  /**
   * Handle fatal errors
   */
  async handleFatalError(errorInfo) {
    try {
      // Log fatal error
      await this.logToFile('FATAL', 'Application fatal error', errorInfo);
      
      // Show critical error dialog
      const options = {
        type: 'error',
        title: 'Critical Error',
        message: 'Dorganize has encountered a critical error and needs to restart.',
        detail: this.simplifyErrorMessage(errorInfo.message),
        buttons: ['Restart', 'Close'],
        defaultId: 0
      };

      const result = await dialog.showMessageBox(null, options);
      
      if (result.response === 0) {
        // Restart application
        app.relaunch();
        app.exit(0);
      } else {
        // Close application
        app.exit(1);
      }
      
    } catch (error) {
      console.error('ErrorHandler: Error handling fatal error:', error);
      // Force exit as last resort
      process.exit(1);
    }
  }

  /**
   * Set log level
   */
  setLogLevel(level) {
    if (typeof level === 'string') {
      level = this.logLevels[level.toUpperCase()];
    }
    
    if (level !== undefined && level >= 0 && level <= 4) {
      this.currentLogLevel = level;
      console.log(`ErrorHandler: Log level set to ${Object.keys(this.logLevels)[level]}`);
    }
  }

  /**
   * Get error statistics
   */
  getStatistics() {
    const totalErrors = Array.from(this.errorCounts.values()).reduce((sum, count) => sum + count, 0);
    
    return {
      totalErrors,
      uniqueErrors: this.errorCounts.size,
      logFile: this.logFile,
      uptime: Date.now() - this.startTime,
      queueSize: this.errorQueue.length,
      isProcessing: this.isProcessingQueue,
      currentLogLevel: Object.keys(this.logLevels)[this.currentLogLevel]
    };
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    try {
      // Process remaining errors in queue
      await this.processErrorQueue();
      
      // Log shutdown
      await this.logToFile('INFO', 'ErrorHandler shutting down', {
        uptime: Date.now() - this.startTime,
        totalErrors: Array.from(this.errorCounts.values()).reduce((sum, count) => sum + count, 0)
      });
      
      console.log('ErrorHandler: Cleanup completed');
    } catch (error) {
      console.error('ErrorHandler: Error during cleanup:', error);
    }
  }

  /**
   * Convenience methods for different log levels
   */
  debug(message, context = 'Debug', metadata = {}) {
    return this.handleError(message, context, 'DEBUG', metadata);
  }

  info(message, context = 'Info', metadata = {}) {
    return this.handleError(message, context, 'INFO', metadata);
  }

  warn(message, context = 'Warning', metadata = {}) {
    return this.handleError(message, context, 'WARN', metadata);
  }

  error(error, context = 'Error', metadata = {}) {
    return this.handleError(error, context, 'ERROR', metadata);
  }

  fatal(error, context = 'Fatal', metadata = {}) {
    return this.handleError(error, context, 'FATAL', metadata);
  }
}

// Create singleton instance
let errorHandlerInstance = null;

/**
 * Get ErrorHandler singleton instance
 */
function getErrorHandler() {
  if (!errorHandlerInstance) {
    errorHandlerInstance = new ErrorHandler();
  }
  return errorHandlerInstance;
}

/**
 * Initialize error handler (call once at app startup)
 */
function initializeErrorHandler() {
  return getErrorHandler();
}

module.exports = {
  ErrorHandler,
  getErrorHandler,
  initializeErrorHandler
};
