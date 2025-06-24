/**
 * Logger - Structured logging with levels
 * Provides consistent logging across the application with appropriate log levels
 */
const fs = require('fs').promises;
const path = require('path');
const { app } = require('electron');

class Logger {
    constructor(options = {}) {
        this.options = {
            appName: 'Dorganize',
            logToConsole: true,
            logToFile: false,
            logLevel: 'info', // debug, info, warn, error
            maxLogSize: 5 * 1024 * 1024, // 5MB
            maxLogFiles: 5,
            prettyPrint: false,
            includeTimestamp: true,
            moduleNameColor: true,
            consoleColors: true,
            ...options
        };

        this.levels = {
            debug: 0,
            info: 1,
            warn: 2,
            error: 3
        };

        this.currentLevel = this.levels[this.options.logLevel] || this.levels.info;

        if (this.options.logToFile) {
            this.setupLogDirectory();
        }
    }

    setupLogDirectory() {
        try {
            let logDir;
            if (app) {
                // Use Electron's userData path which is platform-appropriate
                logDir = path.join(app.getPath('userData'), 'logs');
            } else {
                // Fallback for testing
                logDir = path.join(require('os').homedir(), '.dorganize', 'logs');
            }

            this.logDir = logDir;
            this.currentLogFile = path.join(logDir, `${this.options.appName}-${new Date().toISOString().split('T')[0]}.log`);

            // Ensure directory exists (async)
            fs.mkdir(logDir, { recursive: true })
                .catch(error => {
                    console.error(`[Logger] Failed to create log directory: ${error.message}`);
                    this.options.logToFile = false;
                });
        } catch (error) {
            console.error(`[Logger] Error setting up log directory: ${error.message}`);
            this.options.logToFile = false;
        }
    }

    formatMessage(level, message, context = {}) {
        const timestamp = new Date().toISOString();

        // Process any Error objects in the context to include stack traces
        const processedContext = { ...context };
        Object.keys(processedContext).forEach(key => {
            if (processedContext[key] instanceof Error) {
                const err = processedContext[key];
                processedContext[key] = {
                    message: err.message,
                    stack: err.stack,
                    name: err.name,
                    ...(err.code ? { code: err.code } : {})
                };
            }
        });

        const contextStr = Object.keys(processedContext).length > 0 ?
            JSON.stringify(processedContext, null, this.options.prettyPrint ? 2 : 0) : '';

        return {
            formatted: `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr ? ' ' + contextStr : ''}`,
            raw: {
                timestamp,
                level,
                message,
                context: processedContext
            }
        };
    }

    async writeToFile(formattedMessage) {
        if (!this.options.logToFile || !this.logDir) return;

        try {
            // Append to file
            await fs.appendFile(this.currentLogFile, formattedMessage + '\n');

            // Check file size and rotate if needed
            const stats = await fs.stat(this.currentLogFile);
            if (stats.size > this.options.maxLogSize) {
                await this.rotateLogFiles();
            }
        } catch (error) {
            // Fallback to console
            console.error(`[Logger] Failed to write to log file: ${error.message}`);
        }
    }

    async rotateLogFiles() {
        try {
            const baseFilename = path.basename(this.currentLogFile);
            const rotatedFile = path.join(this.logDir, `${baseFilename}.${Date.now()}`);

            await fs.rename(this.currentLogFile, rotatedFile);

            // Cleanup old rotated files
            const files = await fs.readdir(this.logDir);
            const rotatedLogs = files.filter(f => f.startsWith(baseFilename) && f !== baseFilename)
                .sort((a, b) => {
                    const timeA = parseInt(a.split('.').pop()) || 0;
                    const timeB = parseInt(b.split('.').pop()) || 0;
                    return timeB - timeA; // Descending
                });

            // Keep only the specified number of log files
            const filesToDelete = rotatedLogs.slice(this.options.maxLogFiles - 1);
            for (const file of filesToDelete) {
                await fs.unlink(path.join(this.logDir, file))
                    .catch(err => console.error(`[Logger] Failed to delete old log: ${err.message}`));
            }
        } catch (error) {
            console.error(`[Logger] Log rotation failed: ${error.message}`);
        }
    }

    async log(level, message, context = {}) {
        if (this.levels[level] < this.currentLevel) return;

        const { formatted, raw } = this.formatMessage(level, message, context);

        // Console logging
        if (this.options.logToConsole) {
            // Add colors for console output if enabled
            let consoleMessage = formatted;

            if (this.options.consoleColors) {
                const colors = {
                    debug: '\x1b[36m', // Cyan
                    info: '\x1b[32m',  // Green
                    warn: '\x1b[33m',  // Yellow
                    error: '\x1b[31m', // Red
                    reset: '\x1b[0m'   // Reset
                };

                consoleMessage = `${colors[level] || ''}${formatted}${colors.reset}`;
            }

            switch (level) {
                case 'debug':
                    console.debug(consoleMessage);
                    break;
                case 'info':
                    console.info(consoleMessage);
                    break;
                case 'warn':
                    console.warn(consoleMessage);
                    break;
                case 'error':
                    console.error(consoleMessage);
                    break;
                default:
                    console.log(consoleMessage);
            }
        }

        // File logging (without colors)
        if (this.options.logToFile) {
            await this.writeToFile(formatted);
        }

        return raw;
    }

    async debug(message, context = {}) {
        return await this.log('debug', message, context);
    }

    async info(message, context = {}) {
        return await this.log('info', message, context);
    }

    async warn(message, context = {}) {
        return await this.log('warn', message, context);
    }

    async error(message, context = {}) {
        return await this.log('error', message, context);
    }

    setLogLevel(level) {
        if (this.levels[level] !== undefined) {
            this.currentLevel = this.levels[level];
            this.options.logLevel = level;
        }
    }

    getLogLevel() {
        return this.options.logLevel;
    }

    /**
     * Create a new logger for a specific module/component
     * @param {string} moduleName - The name of the module
     * @param {object} options - Additional logger options
     * @returns {Logger} A new logger instance with module name in context
     */
    static forModule(moduleName, options = {}) {
        const moduleLogger = new Logger(options);

        // Create wrapper functions that add the module name
        const wrapLogMethod = (method) => {
            return (message, context = {}) => {
                return moduleLogger[method](message, { ...context, module: moduleName });
            };
        };

        // Create a specialized object with bound methods
        return {
            debug: wrapLogMethod('debug'),
            info: wrapLogMethod('info'),
            warn: wrapLogMethod('warn'),
            error: wrapLogMethod('error'),
            setLogLevel: (level) => moduleLogger.setLogLevel(level),
            getLogLevel: () => moduleLogger.getLogLevel()
        };
    }
}

// Create default instance
const defaultLogger = new Logger();

// Provide a way to get logger instances for modules
const getLogger = (moduleName, options = {}) => {
    return Logger.forModule(moduleName, options);
};

module.exports = {
    Logger,
    logger: defaultLogger,
    getLogger,
    debug: (message, context) => defaultLogger.debug(message, context),
    info: (message, context) => defaultLogger.info(message, context),
    warn: (message, context) => defaultLogger.warn(message, context),
    error: (message, context) => defaultLogger.error(message, context),
    setLogLevel: (level) => defaultLogger.setLogLevel(level)
};
