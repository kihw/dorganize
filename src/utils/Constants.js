/**
 * Constants - Centralized configuration constants for the application
 * Contains all magic numbers, limits, and configuration values used throughout the codebase
 */

/**
 * Application Configuration
 */
const APP = {
    NAME: 'DOrganize',
    VERSION: '1.0.0',
    DEFAULT_LANGUAGE: 'FR',
    CONFIG_VERSION: '1.0.0'
};

/**
 * Polling Intervals (in milliseconds)
 */
const POLLING_INTERVALS = {
    // Standard intervals based on activity level
    HIGH: 1000,     // 1 second - responsive polling for active usage
    NORMAL: 5000,   // 5 seconds - standard polling interval
    LOW: 10000,     // 10 seconds - reduced polling for battery saving
    IDLE: 20000,    // 20 seconds - minimal polling when system is idle

    // Timeout constants
    ACTIVITY_TIMEOUT: 30000, // 30 seconds of no activity before reducing polling rate
    IDLE_TIMEOUT: 300000,    // 5 minutes of no activity before switching to idle

    // Thresholds
    HIGH_LATENCY_THRESHOLD: 200, // ms threshold for considering detection "slow"
};

/**
 * UI and DOM Constants
 */
const UI = {
    // Timeouts and delays
    DEFAULT_TIMEOUT_MS: 1000,
    EXTENDED_TIMEOUT_MS: 2000,
    QUICK_TIMEOUT_MS: 500,
    RETRY_DELAY_MS: 100,
    INITIALIZATION_RETRY_DELAY_MS: 100,

    // Update intervals
    UPDATE_THROTTLE_MS: 16, // ~60fps
    PERIODIC_CHECK_INTERVAL_MS: 5000,
    PERFORMANCE_LOG_INTERVAL_MS: 30000,
    EMERGENCY_STOP_RESET_MS: 10000,

    // Retry limits
    MAX_RETRIES: 3,
    DEFAULT_RETRIES: 2,
    QUICK_RETRIES: 1,

    // Element validation
    REQUIRED_ELEMENT_TIMEOUT_MS: 2000,
    OPTIONAL_ELEMENT_TIMEOUT_MS: 500,

    // Animation and transitions
    ANIMATION_DURATION_MS: 300,
    FADE_DURATION_MS: 150,
    TOAST_DURATION_MS: 3000,
    SUCCESS_MESSAGE_DURATION_MS: 1500
};

/**
 * AutoKey Configuration
 */
const AUTO_KEY = {
    // Intervals
    DEFAULT_INTERVAL_MS: 1000,
    MIN_INTERVAL_MS: 100,
    MAX_INTERVAL_MS: 60000,

    // Safety limits
    MAX_KEYS_PER_MINUTE: 600,
    RATE_LIMIT_WINDOW_MS: 60000,

    // Patterns
    PATTERNS: {
        NUMBERS: 'numbers',
        FUNCTION: 'function',
        NUMPAD: 'numpad',
        AZERTYUI: 'azertyui',
        CUSTOM: 'custom'
    },

    // Default custom pattern
    DEFAULT_CUSTOM_PATTERN: 'Ctrl+Alt+{n}',

    // Function key mapping
    AZERTYUI_KEYS: ['A', 'Z', 'E', 'R', 'T', 'Y', 'U', 'I'],
    MAX_FUNCTION_KEYS: 12,
    MAX_NUMPAD_KEYS: 10
};

/**
 * Window Management
 */
const WINDOW = {
    // Initiative limits
    MIN_INITIATIVE: 0,
    MAX_INITIATIVE: 9999,
    DEFAULT_INITIATIVE: 0,

    // Limits for rendering efficiency
    LARGE_WINDOW_COUNT_THRESHOLD: 20,
    MASSIVE_WINDOW_COUNT_THRESHOLD: 100,
    DIFFERENTIAL_UPDATE_THRESHOLD: 5,
    MAX_POSITION_CHANGES_PERCENT: 30,

    // Cache limits
    MAX_WINDOW_CACHE_SIZE: 100,
    WINDOW_CACHE_CLEANUP_THRESHOLD: 150,

    // Update batching
    BATCH_UPDATE_SIZE: 50,
    MAX_CONCURRENT_UPDATES: 10
};

/**
 * Shortcut Configuration
 */
const SHORTCUTS = {
    // Priority levels
    PRIORITIES: {
        GLOBAL: 1,
        AUTO_KEY: 2,
        WINDOW: 3
    },

    // Default global shortcuts
    DEFAULTS: {
        NEXT_WINDOW: 'Ctrl+Tab',
        TOGGLE_SHORTCUTS: 'Ctrl+Shift+D',
        EMERGENCY_STOP: 'Ctrl+Shift+X'
    },

    // Validation limits
    MAX_SHORTCUT_LENGTH: 30,
    MAX_CHARACTER_NAME_LENGTH: 50
};

/**
 * File and Path Constants
 */
const PATHS = {
    // Configuration files
    CONFIG_DIR: 'config',
    SHORTCUTS_FILE: 'shortcuts.json',
    BACKUP_DIR: 'backups',
    TEMP_FILE_SUFFIX: '.tmp',

    // Legacy paths
    LEGACY_CONFIG_DIR: '.dorganize',

    // File permissions (octal)
    DIR_PERMISSIONS: 0o755,
    FILE_PERMISSIONS: 0o644,
    READ_ONLY_PERMISSIONS: 0o444,

    // Backup management
    MAX_AUTO_BACKUPS: 10,
    BACKUP_CLEANUP_DAYS: 30
};

/**
 * Security Constants
 */
const SECURITY = {
    // Input length limits
    MAX_LENGTHS: {
        WINDOW_TITLE: 200,
        CHARACTER_NAME: 50,
        SHORTCUT: 30,
        FILE_PATH: 500,
        CLASS_NAME: 100,
        PROCESS_NAME: 100,
        COMMAND: 1000,
        LOG_MESSAGE: 5000,
        GENERAL_INPUT: 1000
    },

    // Dangerous file extensions
    DANGEROUS_EXTENSIONS: ['.exe', '.bat', '.cmd', '.ps1', '.vbs', '.js', '.jar'],

    // PowerShell security
    POWERSHELL: {
        MAX_COMMAND_LENGTH: 8192,
        MAX_OUTPUT_LENGTH: 1048576, // 1MB
        EXECUTION_TIMEOUT_MS: 30000,
        DEFAULT_TIMEOUT_MS: 5000,
        KILL_TIMEOUT_MS: 5000
    }
};

/**
 * Performance and Monitoring
 */
const PERFORMANCE = {
    // Statistics tracking
    STATS_RESET_INTERVAL_MS: 3600000, // 1 hour
    MAX_HISTORY_ENTRIES: 1000,
    PERFORMANCE_SAMPLE_SIZE: 100,

    // Memory management
    MAX_CACHE_SIZE: 100,
    CACHE_CLEANUP_THRESHOLD: 150,
    MEMORY_PRESSURE_THRESHOLD_MB: 100,

    // Render performance
    MAX_RENDER_TIME_MS: 1000,
    ACCEPTABLE_RENDER_TIME_MS: 100,
    RENDER_TIMEOUT_MS: 5000,

    // DOM efficiency
    MAX_DOM_QUERIES_PER_OPERATION: 10,
    ELEMENT_CACHE_TTL_MS: 300000, // 5 minutes

    // Error handling
    MAX_ERROR_LOG_ENTRIES: 500,
    ERROR_THROTTLE_MS: 1000
};

/**
 * Language and Localization
 */
const LANGUAGE = {
    // Supported languages
    SUPPORTED_CODES: ['FR', 'EN', 'DE', 'ES', 'IT'],
    DEFAULT_CODE: 'FR',

    // Character sets
    UNICODE_RANGES: {
        LATIN_BASIC: /^[a-zA-Z0-9\s\-_.()]+$/,
        LATIN_EXTENDED: /^[a-zA-Z0-9\s\-_.()À-ÿ]+$/,
        SAFE_CHARACTERS: /^[a-zA-Z0-9\-_À-ÿ]+$/
    }
};

/**
 * Dofus Game Constants
 */
const DOFUS = {
    // Default classes
    CLASSES: {
        FECA: 'feca',
        OSAMODAS: 'osamodas',
        ENUTROF: 'enutrof',
        SRAM: 'sram',
        XELOR: 'xelor',
        ECAFLIP: 'ecaflip',
        ENIRIPSA: 'eniripsa',
        IOP: 'iop',
        CRA: 'cra',
        SADIDA: 'sadida',
        SACRIEUR: 'sacrieur',
        PANDAWA: 'pandawa',
        ROUBLARD: 'roublard',
        ZOBAL: 'zobal',
        STEAMER: 'steamer',
        ELIOTROPE: 'eliotrope',
        HUPPERMAGE: 'huppermage',
        OUGINAK: 'ouginak',
        FORGELANCE: 'forgelance'
    },

    // Default class for unknown windows
    DEFAULT_CLASS: 'feca',

    // Process detection
    PROCESS_NAMES: ['Dofus.exe', 'DofusInvoker.exe'],
    WINDOW_TITLE_PATTERNS: ['Dofus', 'DOFUS']
};

/**
 * Dock Configuration
 */
const DOCK = {
    // Position constants
    POSITIONS: {
        NORTH_WEST: 'NW',
        NORTH_EAST: 'NE',
        SOUTH_WEST: 'SW',
        SOUTH_EAST: 'SE',
        NORTH: 'N',
        SOUTH: 'S'
    },

    DEFAULT_POSITION: 'SE',

    // Animation settings
    HOVER_DELAY_MS: 200,
    HIDE_DELAY_MS: 1000,
    ANIMATION_DURATION_MS: 300,

    // Size constraints
    MAX_ITEMS: 20,
    ITEM_SIZE_PX: 48,
    SPACING_PX: 8,
    MARGIN_PX: 10
};

/**
 * PowerShell Executor Constants
 */
const POWERSHELL = {
    // Execution settings
    DEFAULT_TIMEOUT_MS: 5000,
    EXTENDED_TIMEOUT_MS: 30000,
    KILL_TIMEOUT_MS: 5000,

    // Command limits
    MAX_COMMAND_LENGTH: 8192,
    MAX_OUTPUT_LENGTH: 1048576, // 1MB
    MAX_CONCURRENT_COMMANDS: 5,

    // Availability check
    AVAILABILITY_CHECK_TIMEOUT_MS: 2000,
    AVAILABILITY_CACHE_TTL_MS: 300000, // 5 minutes

    // Retry settings
    MAX_RETRIES: 3,
    RETRY_DELAY_MS: 1000,
    BACKOFF_MULTIPLIER: 2,

    // PowerShell executable names
    EXECUTABLE_NAMES: ['powershell.exe', 'pwsh.exe'],

    // Commands for system checks
    COMMANDS: {
        VERSION_CHECK: 'Get-Host | Select-Object Version',
        PROCESS_LIST: 'Get-Process | Where-Object {$_.ProcessName -like "*Dofus*"}',
        WINDOW_LIST: 'Get-Process | Where-Object {$_.MainWindowTitle -ne ""}'
    }
};

/**
 * Error Handling
 */
const ERRORS = {
    // Error levels
    LEVELS: {
        DEBUG: 'debug',
        INFO: 'info',
        WARN: 'warn',
        ERROR: 'error',
        FATAL: 'fatal'
    },

    // Error codes
    CODES: {
        INITIALIZATION_FAILED: 'INIT_FAILED',
        ELEMENT_NOT_FOUND: 'ELEMENT_NOT_FOUND',
        INVALID_INPUT: 'INVALID_INPUT',
        SECURITY_VIOLATION: 'SECURITY_VIOLATION',
        TIMEOUT: 'TIMEOUT',
        PERMISSION_DENIED: 'PERMISSION_DENIED',
        POWERSHELL_UNAVAILABLE: 'POWERSHELL_UNAVAILABLE',
        CONFIG_CORRUPTED: 'CONFIG_CORRUPTED'
    },

    // Error limits
    MAX_ERROR_STACK_SIZE: 100,
    ERROR_REPORT_THROTTLE_MS: 5000,
    MAX_CONSECUTIVE_ERRORS: 10
};

/**
 * Network and IPC
 */
const NETWORK = {
    // IPC timeouts
    IPC_TIMEOUT_MS: 5000,
    IPC_RETRY_DELAY_MS: 100,
    MAX_IPC_RETRIES: 3,

    // Data limits
    MAX_MESSAGE_SIZE_BYTES: 10485760, // 10MB
    MAX_BATCH_SIZE: 100,

    // Update intervals
    STATUS_UPDATE_INTERVAL_MS: 1000,
    HEARTBEAT_INTERVAL_MS: 30000
};

/**
 * Testing and Development
 */
const TESTING = {
    // Test timeouts
    UNIT_TEST_TIMEOUT_MS: 5000,
    INTEGRATION_TEST_TIMEOUT_MS: 30000,
    E2E_TEST_TIMEOUT_MS: 60000,

    // Mock data limits
    MAX_MOCK_WINDOWS: 50,
    MAX_MOCK_CHARACTERS: 20,

    // Performance test thresholds
    PERFORMANCE_TEST_ITERATIONS: 100,
    ACCEPTABLE_PERFORMANCE_MS: 100,
    MAX_PERFORMANCE_MS: 1000
};

/**
 * Validation Patterns
 */
const PATTERNS = {
    // Input validation
    CHARACTER_NAME: /^[a-zA-Z0-9\-_À-ÿ]{1,50}$/,
    WINDOW_TITLE: /^[a-zA-Z0-9\s\-_.()[\]à-ÿÀ-Ÿ]+$/,
    SHORTCUT: /^[a-zA-Z0-9+\-_\s()]+$/,
    FILE_PATH: /^[a-zA-Z0-9\s\-_.()[\]\\\/À-ÿ:]+$/,
    PROCESS_NAME: /^[a-zA-Z0-9\s\-_.()]+$/,

    // Security patterns
    MALICIOUS_SCRIPT: /<script[^>]*>.*?<\/script>/gi,
    MALICIOUS_COMMAND: /[;&|><]/g,
    PATH_TRAVERSAL: /\.\.[\/\\]/g,
    POWERSHELL_INJECTION: /powershell|pwsh|cmd|exec|eval|invoke/gi,

    // PowerShell specific
    POWERSHELL_SAFE_COMMAND: /^[a-zA-Z0-9\s\-_.()]+$/,
    POWERSHELL_PARAMETER: /^-[a-zA-Z]+$/
};

/**
 * Color and Theme Constants
 */
const THEME = {
    // CSS class names
    CLASSES: {
        ACTIVE: 'active',
        DISABLED: 'disabled',
        ERROR: 'error',
        SUCCESS: 'success',
        WARNING: 'warning',
        LOADING: 'loading',
        HIDDEN: 'hidden',
        FALLBACK: 'fallback'
    },

    // Safety indicator classes
    SAFETY: {
        OK: 'safety-ok',
        WARNING: 'safety-warning',
        EMERGENCY: 'safety-emergency'
    },

    // Status indicators
    STATUS: {
        ONLINE: 'status-online',
        OFFLINE: 'status-offline',
        CONNECTING: 'status-connecting',
        ERROR: 'status-error'
    }
};

/**
 * Migration and Compatibility
 */
const MIGRATION = {
    // Version compatibility
    SUPPORTED_VERSIONS: ['0.9.0', '1.0.0'],
    CURRENT_VERSION: '1.0.0',

    // Migration settings
    MAX_MIGRATION_RETRIES: 3,
    MIGRATION_TIMEOUT_MS: 30000,
    BACKUP_BEFORE_MIGRATION: true,

    // Legacy support
    LEGACY_CONFIG_RETENTION_DAYS: 30,
    LEGACY_CLEANUP_DELAY_MS: 5000
};

/**
 * Avatar and Visual Constants
 */
const AVATARS = {
    // Default avatar settings
    DEFAULT_AVATAR: '1.jpg',
    AVATAR_PATH: '../../assets/avatars/',
    FALLBACK_AVATAR: '../../assets/avatars/1.jpg',

    // Size constraints
    MAX_AVATAR_SIZE_KB: 100,
    SUPPORTED_FORMATS: ['.jpg', '.jpeg', '.png', '.gif'],

    // Display settings
    AVATAR_SIZE_PX: 48,
    AVATAR_BORDER_RADIUS_PX: 4
};

/**
 * Keyboard and Input
 */
const KEYBOARD = {
    // Special key codes
    KEYS: {
        ESCAPE: 'Escape',
        ENTER: 'Enter',
        TAB: 'Tab',
        SPACE: ' ',
        CTRL: 'Control',
        ALT: 'Alt',
        SHIFT: 'Shift'
    },

    // Function keys
    FUNCTION_KEYS: Array.from({ length: 12 }, (_, i) => `F${i + 1}`),

    // Number keys
    NUMBER_KEYS: Array.from({ length: 10 }, (_, i) => i.toString()),

    // Modifier combinations
    MODIFIERS: ['Ctrl', 'Alt', 'Shift', 'Meta'],

    // Input validation
    MAX_SHORTCUT_COMPONENTS: 4,
    VALID_SEPARATORS: ['+', '-']
};

/**
 * Export all constants
 */
module.exports = {
    APP,
    POLLING_INTERVALS,
    UI,
    AUTO_KEY,
    WINDOW,
    SHORTCUTS,
    PATHS,
    SECURITY,
    PERFORMANCE,
    LANGUAGE,
    DOFUS,
    DOCK,
    POWERSHELL,
    ERRORS,
    NETWORK,
    TESTING,
    PATTERNS,
    THEME,
    MIGRATION,
    AVATARS,
    KEYBOARD,

    // Convenience exports for commonly used values
    DEFAULT_TIMEOUT: UI.DEFAULT_TIMEOUT_MS,
    MAX_RETRIES: UI.MAX_RETRIES,
    DEFAULT_LANGUAGE: APP.DEFAULT_LANGUAGE,
    MAX_INITIATIVE: WINDOW.MAX_INITIATIVE,
    MIN_INITIATIVE: WINDOW.MIN_INITIATIVE,

    // Version information
    VERSION: APP.VERSION,
    CONFIG_VERSION: APP.CONFIG_VERSION,

    // Quick access to commonly used patterns
    SAFE_CHARACTER_PATTERN: PATTERNS.CHARACTER_NAME,
    SAFE_SHORTCUT_PATTERN: PATTERNS.SHORTCUT,

    // Helper functions for constants
    getTimeout: (type = 'default') => {
        switch (type) {
            case 'quick': return UI.QUICK_TIMEOUT_MS;
            case 'extended': return UI.EXTENDED_TIMEOUT_MS;
            case 'powershell': return POWERSHELL.DEFAULT_TIMEOUT_MS;
            default: return UI.DEFAULT_TIMEOUT_MS;
        }
    },

    getMaxLength: (type) => {
        return SECURITY.MAX_LENGTHS[type.toUpperCase()] || SECURITY.MAX_LENGTHS.GENERAL_INPUT;
    },

    getPattern: (type) => {
        return PATTERNS[type.toUpperCase()] || PATTERNS.CHARACTER_NAME;
    },

    isDofusClass: (className) => {
        return Object.values(DOFUS.CLASSES).includes(className?.toLowerCase());
    },

    isValidLanguage: (langCode) => {
        return LANGUAGE.SUPPORTED_CODES.includes(langCode);
    },

    isValidDockPosition: (position) => {
        return Object.values(DOCK.POSITIONS).includes(position);
    },

    // Validation helpers
    validators: {
        initiative: (value) => {
            const num = parseInt(value);
            return !isNaN(num) && num >= WINDOW.MIN_INITIATIVE && num <= WINDOW.MAX_INITIATIVE;
        }, characterName: (name) => {
            return name &&
                name.length <= SECURITY.MAX_LENGTHS.CHARACTER_NAME &&
                PATTERNS.CHARACTER_NAME.test(name) ? true : false;
        },

        shortcut: (shortcut) => {
            return shortcut &&
                shortcut.length <= SECURITY.MAX_LENGTHS.SHORTCUT &&
                PATTERNS.SHORTCUT.test(shortcut) ? true : false;
        },

        timeout: (ms) => {
            return typeof ms === 'number' && ms > 0 && ms <= POWERSHELL.EXTENDED_TIMEOUT_MS;
        }
    }
};