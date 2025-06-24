/**
 * DOMTestHelpers.js
 * Helper utilities for DOM testing with mock document
 */

// Global constants used across tests
const TEST_CONSTANTS = {
    // Test timeouts
    SHORT_TIMEOUT: 1000,
    MEDIUM_TIMEOUT: 3000,
    LONG_TIMEOUT: 5000,

    // Test data sizes
    SMALL_DATA_SIZE: 5,
    MEDIUM_DATA_SIZE: 20,
    LARGE_DATA_SIZE: 100,

    // Element selectors used in tests
    SELECTORS: {
        WINDOWS_LIST: '#windows-list',
        WINDOW_ITEM: '.window-item',
        NO_WINDOWS: '#no-windows',
        WINDOW_COUNT: '#window-count',
        LOADING_INDICATOR: '.loading-indicator',
        ERROR_DISPLAY: '.error-display',
        REFRESH_BUTTON: '#refresh-btn'
    }
};

/**
 * Creates a mock document structure for window renderer tests
 * @returns {Object} Mock document structure
 */
function createMockDocument() {
    // Create mock DOM structure
    document.body.innerHTML = `
    <div id="windows-list"></div>
    <div id="no-windows" style="display: none;">No windows detected</div>
    <div id="window-count">0 windows detected</div>
    <div class="loading-indicator" style="display: none;"></div>
    <div class="error-display" style="display: none;"></div>
    <div id="refresh-btn"></div>
  `;

    // Return references to key elements
    return {
        windowsList: document.getElementById('windows-list'),
        noWindows: document.getElementById('no-windows'),
        windowCount: document.getElementById('window-count'),
        loadingIndicator: document.querySelector('.loading-indicator'),
        errorDisplay: document.querySelector('.error-display'),
        refreshButton: document.getElementById('refresh-btn'),
        queryAll: (selector) => document.querySelectorAll(selector)
    };
}

/**
 * Creates a window test object with configurable properties
 * @param {string} id - Window ID
 * @param {Object} overrides - Properties to override defaults
 * @returns {Object} Test window object
 */
function createTestWindow(id, overrides = {}) {
    // Default window properties
    const defaultWindow = {
        id: id.toString(),
        pid: 1000 + parseInt(id),
        handle: `handle-${id}`,
        character: `Character ${id}`,
        customName: `Custom ${id}`,
        dofusClass: `Class ${id}`,
        shortcut: `Ctrl+${id}`,
        avatar: Math.floor(Math.random() * 20) + 1,
        initiative: parseInt(id) * 10,
        enabled: true,
        isActive: false
    };

    // Override with any custom properties
    return { ...defaultWindow, ...overrides };
}

/**
 * Generates a batch of test windows
 * @param {number} count - Number of windows to generate
 * @param {function} customizer - Optional function to customize each window
 * @returns {Array} Array of window objects
 */
function generateTestWindows(count, customizer = null) {
    const windows = [];

    for (let i = 1; i <= count; i++) {
        let window = createTestWindow(i);

        // Apply custom modifications if provided
        if (typeof customizer === 'function') {
            window = customizer(window, i);
        }

        windows.push(window);
    }

    return windows;
}

/**
 * Creates a modified copy of window objects for testing updates
 * @param {Array} windows - Original windows array
 * @param {Object} options - Options for modifications
 * @returns {Array} Modified windows array
 */
function createModifiedWindows(windows, options = {}) {
    const {
        modificationRate = 0.3, // 30% of windows modified by default
        modTypes = ['name', 'class', 'initiative', 'shortcut', 'enabled', 'active']
    } = options;

    return windows.map((window, index) => {
        // Only modify a percentage of windows
        if (Math.random() > modificationRate) {
            return window;
        }

        // Clone the window to avoid modifying original
        const modified = { ...window };

        // Choose a random modification type
        const modType = modTypes[Math.floor(Math.random() * modTypes.length)];

        // Apply the modification
        switch (modType) {
            case 'name':
                modified.customName = `Modified ${window.customName}`;
                break;
            case 'class':
                modified.dofusClass = `Modified ${window.dofusClass}`;
                break;
            case 'initiative':
                modified.initiative = window.initiative + Math.floor(Math.random() * 50);
                break;
            case 'shortcut':
                modified.shortcut = `Alt+${window.id}`;
                break;
            case 'enabled':
                modified.enabled = !window.enabled;
                break;
            case 'active':
                modified.isActive = !window.isActive;
                break;
        }

        return modified;
    });
}

/**
 * Counts operations on specific DOM methods
 * @returns {Object} Counter object with methods to track, reset and restore
 */
function createDomOperationCounter() {
    let createCount = 0;
    let appendCount = 0;
    let removeCount = 0;
    let textContentCount = 0;

    // Save original methods
    const originalCreateElement = document.createElement;
    const originalAppendChild = Node.prototype.appendChild;
    const originalRemoveChild = Node.prototype.removeChild;

    // Define property descriptor for textContent
    const originalTextContentDescriptor = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent');

    // Override with counting versions
    document.createElement = function () {
        createCount++;
        return originalCreateElement.apply(document, arguments);
    };

    Node.prototype.appendChild = function () {
        appendCount++;
        return originalAppendChild.apply(this, arguments);
    };

    Node.prototype.removeChild = function () {
        removeCount++;
        return originalRemoveChild.apply(this, arguments);
    };

    // Override textContent setter
    Object.defineProperty(Node.prototype, 'textContent', {
        set(value) {
            textContentCount++;
            return originalTextContentDescriptor.set.call(this, value);
        },
        get: originalTextContentDescriptor.get
    });

    return {
        getTotals: () => ({
            createElement: createCount,
            appendChild: appendCount,
            removeChild: removeCount,
            textContent: textContentCount,
            total: createCount + appendCount + removeCount + textContentCount
        }),
        reset: () => {
            createCount = 0;
            appendCount = 0;
            removeCount = 0;
            textContentCount = 0;
        },
        restore: () => {
            document.createElement = originalCreateElement;
            Node.prototype.appendChild = originalAppendChild;
            Node.prototype.removeChild = originalRemoveChild;
            Object.defineProperty(Node.prototype, 'textContent', originalTextContentDescriptor);
        }
    };
}

module.exports = {
    TEST_CONSTANTS,
    createMockDocument,
    createTestWindow,
    generateTestWindows,
    createModifiedWindows,
    createDomOperationCounter
};
