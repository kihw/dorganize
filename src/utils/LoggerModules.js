/**
 * LoggerModules.js
 * Exports pre-configured logger instances for each module in the application
 * This ensures consistent module names and log formatting
 */

const { getLogger } = require('./Logger');
const Constants = require('./Constants');

// Create logger instances for each module with appropriate log levels
module.exports = {
    // Main process modules
    main: getLogger('Main'),
    ipc: getLogger('IPC'),

    // UI/Renderer modules
    ui: getLogger('UI'),
    windowRenderer: getLogger('WindowRenderer'),
    dockRenderer: getLogger('DockRenderer'),
    modalManager: getLogger('ModalManager'),
    configRenderer: getLogger('ConfigRenderer'),

    // Services
    windowManager: getLogger('WindowManager'),
    windowDetector: getLogger('WindowDetector'),
    windowParser: getLogger('WindowParser'),
    windowStateManager: getLogger('WindowStateManager'),
    languageManager: getLogger('LanguageManager'),
    shortcutManager: getLogger('ShortcutManager'),
    shortcutConfigManager: getLogger('ShortcutConfigManager'),
    autoKeyManager: getLogger('AutoKeyManager'),

    // Utilities
    diagnostics: getLogger('Diagnostics', { logLevel: 'debug' }),
    security: getLogger('Security'),

    // Create a logger instance for a custom module
    forModule: (moduleName, options) => getLogger(moduleName, options)
};
