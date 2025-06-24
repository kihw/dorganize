/**
 * WindowRenderer.visual.test.js
 * Visual verification tests for the WindowRenderer component
 */
const WindowRenderer = require('../src/renderer/modules/WindowRenderer');
const Constants = require('../src/utils/Constants');
const {
    TEST_CONSTANTS,
    createMockDocument,
    createTestWindow,
    generateTestWindows,
    createModifiedWindows
} = require('./helpers/DOMTestHelpers');

// Helper to log DOM structure for visual verification
const logDomStructure = (element, depth = 0) => {
    if (!element) return;

    const indent = ' '.repeat(depth * 2);
    const classes = element.className ? `class="${element.className}"` : '';
    const id = element.id ? `id="${element.id}"` : '';
    const dataAttrs = Array.from(element.attributes || [])
        .filter(attr => attr.name.startsWith('data-'))
        .map(attr => `${attr.name}="${attr.value}"`)
        .join(' ');

    console.log(`${indent}<${element.tagName.toLowerCase()} ${id} ${classes} ${dataAttrs}>`);

    if (element.children && element.children.length > 0) {
        Array.from(element.children).forEach(child => {
            logDomStructure(child, depth + 1);
        });
        console.log(`${indent}</${element.tagName.toLowerCase()}>`);
    } else {
        const content = element.textContent.trim();
        if (content) {
            console.log(`${indent}  ${content}`);
        }
        console.log(`${indent}</${element.tagName.toLowerCase()}>`);
    }
};

// Mock config renderer
const mockConfigRenderer = {
    windows: [],
    refreshWindows: jest.fn().mockResolvedValue(true)
};

describe('WindowRenderer Visual Tests', () => {
    let windowRenderer;
    let domElements;

    beforeEach(() => {
        domElements = createMockDocument();
        windowRenderer = new WindowRenderer(mockConfigRenderer);
    });

    afterEach(() => {
        if (windowRenderer.cleanup) {
            windowRenderer.cleanup();
        }
    });

    test('should render single window correctly', async () => {
        // Arrange
        await windowRenderer.initialize();
        const singleWindow = createTestWindow('1', { isActive: true });
        mockConfigRenderer.windows = [singleWindow];

        // Act
        await windowRenderer.renderWindows();

        // Assert
        expect(domElements.windowsList.children.length).toBe(1);

        const windowElement = domElements.windowsList.children[0];
        expect(windowElement.getAttribute('data-window-id')).toBe('1');

        // Basic checks
        expect(windowElement.querySelector('.window-name').value).toBe('Custom 1');
        expect(windowElement.querySelector('.window-class').textContent).toBe('Class 1');
        expect(windowElement.querySelector('.initiative-input').value).toBe('10');
        expect(windowElement.querySelector('.shortcut-display').textContent).toBe('Ctrl+1');
        expect(windowElement.querySelector('.window-toggle input[type="checkbox"]').checked).toBe(true);
        expect(windowElement.classList.contains('active')).toBe(true);

        // Log structure for visual verification
        console.log('--- Single window DOM structure ---');
        logDomStructure(windowElement);
    });

    test('should render multiple windows in correct order', async () => {
        // Arrange
        await windowRenderer.initialize();
        const windows = [
            createTestWindow('1', { isActive: true }),
            createTestWindow('2'),
            createTestWindow('3', { enabled: false })
        ];
        mockConfigRenderer.windows = windows;

        // Act
        await windowRenderer.renderWindows();

        // Assert
        expect(domElements.windowsList.children.length).toBe(3);

        // Check order and basic properties
        expect(domElements.windowsList.children[0].getAttribute('data-window-id')).toBe('1');
        expect(domElements.windowsList.children[1].getAttribute('data-window-id')).toBe('2');
        expect(domElements.windowsList.children[2].getAttribute('data-window-id')).toBe('3');

        // Check active states
        expect(domElements.windowsList.children[0].classList.contains('active')).toBe(true);
        expect(domElements.windowsList.children[1].classList.contains('active')).toBe(false);

        // Check disabled state
        expect(domElements.windowsList.children[2].classList.contains('disabled')).toBe(true);

        // Log structure for visual verification
        console.log('--- Multiple windows DOM structure ---');
        Array.from(domElements.windowsList.children).forEach((windowElement, index) => {
            console.log(`Window ${index + 1}:`);
            logDomStructure(windowElement);
            console.log('---');
        });
    });

    test('should update windows incrementally', async () => {
        // Arrange
        await windowRenderer.initialize();
        const windows = [
            createTestWindow('1', { isActive: true }),
            createTestWindow('2')
        ];
        mockConfigRenderer.windows = windows;

        // Initial render
        await windowRenderer.renderWindows();

        // Modify the windows with specific changes for testing
        const modifiedWindows = [
            { ...windows[0], customName: 'Modified Name', isActive: false },
            { ...windows[1], initiative: 999, enabled: false }
        ];
        mockConfigRenderer.windows = modifiedWindows;

        // Act
        await windowRenderer.renderWindows();

        // Assert
        const window1 = domElements.windowsList.children[0];
        const window2 = domElements.windowsList.children[1];

        expect(window1.querySelector('.window-name').value).toBe('Modified Name');
        expect(window1.classList.contains('active')).toBe(false);

        expect(window2.querySelector('.initiative-input').value).toBe('999');
        expect(window2.classList.contains('disabled')).toBe(true);

        // Log final structure
        console.log('--- After update DOM structure ---');
        Array.from(domElements.windowsList.children).forEach((windowElement, index) => {
            console.log(`Window ${index + 1}:`);
            logDomStructure(windowElement);
            console.log('---');
        });
    });

    test('should show no-windows message when empty', async () => {
        // Arrange
        await windowRenderer.initialize();
        mockConfigRenderer.windows = [];

        // Act
        await windowRenderer.renderWindows();

        // Assert
        expect(domElements.windowsList.style.display).toBe('none');
        expect(domElements.noWindows.style.display).toBe('block');
    });

    test('should handle switching between empty and populated states', async () => {
        // Arrange
        await windowRenderer.initialize();
        mockConfigRenderer.windows = [];

        // Initial render (empty)
        await windowRenderer.renderWindows();

        // Add windows
        const windows = [createTestWindow('1'), createTestWindow('2')];
        mockConfigRenderer.windows = windows;

        // Act
        await windowRenderer.renderWindows();

        // Assert
        expect(domElements.windowsList.style.display).toBe('block');
        expect(domElements.noWindows.style.display).toBe('none');
        expect(domElements.windowsList.children.length).toBe(2);

        // Now remove all windows
        mockConfigRenderer.windows = [];
        await windowRenderer.renderWindows();

        expect(domElements.windowsList.style.display).toBe('none');
        expect(domElements.noWindows.style.display).toBe('block');
    });

    // Additional visual tests for UI elements

    test('should correctly show window character and class information', async () => {
        // Arrange
        await windowRenderer.initialize();
        const specialWindow = createTestWindow('1', {
            dofusClass: 'Ecaflip',
            character: 'TestCharacter',
            customName: 'CustomNameTest'
        });
        mockConfigRenderer.windows = [specialWindow];

        // Act
        await windowRenderer.renderWindows();

        // Assert
        const windowElement = domElements.windowsList.children[0];

        expect(windowElement.querySelector('.window-name').value).toBe('CustomNameTest');
        expect(windowElement.querySelector('.window-class').textContent).toBe('Ecaflip');
        expect(windowElement.getAttribute('data-class')).toBe('Ecaflip');

        // Test fallback to character name when no custom name
        const noCustomNameWindow = { ...specialWindow, customName: null };
        mockConfigRenderer.windows = [noCustomNameWindow];
        await windowRenderer.renderWindows();

        expect(windowElement.querySelector('.window-name').value).toBe('TestCharacter');
    });

    test('should correctly display process information', async () => {
        // Arrange
        await windowRenderer.initialize();
        const testWindow = createTestWindow('1', {
            pid: 12345,
            handle: '0xABCDEF'
        });
        mockConfigRenderer.windows = [testWindow];

        // Act
        await windowRenderer.renderWindows();

        // Assert
        const processInfo = domElements.windowsList.children[0].querySelector('.process-info');
        expect(processInfo).not.toBeNull();
        expect(processInfo.textContent).toContain('PID: 12345');
        expect(processInfo.textContent).toContain('Handle: 0xABCDEF');
    });

    test('should handle specified avatar images', async () => {
        // Arrange
        await windowRenderer.initialize();
        const avatarWindow = createTestWindow('1', {
            avatar: 5 // Specific avatar number
        });
        mockConfigRenderer.windows = [avatarWindow];

        // Act
        await windowRenderer.renderWindows();

        // Assert
        const avatarImage = domElements.windowsList.children[0].querySelector('.window-avatar img');
        expect(avatarImage).not.toBeNull();
        expect(avatarImage.src).toContain('5.jpg');
    });
});
