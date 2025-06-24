/**
 * Jest setup file for DOrganize tests
 * This file runs before each test file
 */

// Set up necessary DOM globals for jsdom environment
if (typeof document !== 'undefined') {
    // Initialize document body if it doesn't exist yet
    if (!document.body) {
        document.body = document.createElement('body');
    }
}

// Mock electron modules
jest.mock('electron', () => {
    return {
        app: {
            getPath: jest.fn(() => 'mock-user-data-path'),
            getName: jest.fn(() => 'dorganize'),
            getVersion: jest.fn(() => '0.4.2')
        },
        ipcMain: {
            on: jest.fn(),
            handle: jest.fn()
        },
        ipcRenderer: {
            on: jest.fn(),
            invoke: jest.fn(),
            send: jest.fn()
        },
        BrowserWindow: jest.fn().mockImplementation(() => ({
            loadFile: jest.fn(),
            webContents: {
                on: jest.fn(),
                send: jest.fn()
            }
        })),
        Tray: jest.fn(),
        Menu: {
            buildFromTemplate: jest.fn(),
            setApplicationMenu: jest.fn()
        },
        nativeImage: {
            createFromPath: jest.fn()
        },
        screen: {
            getPrimaryDisplay: jest.fn(() => ({
                workArea: { width: 1920, height: 1080 }
            }))
        },
        remote: {
            app: {
                getPath: jest.fn(() => 'mock-user-data-path')
            }
        },
        globalShortcut: {
            register: jest.fn(),
            unregister: jest.fn(),
            unregisterAll: jest.fn(),
            isRegistered: jest.fn()
        }
    };
});

// Mock electron-store
jest.mock('electron-store', () => {
    return jest.fn().mockImplementation(() => ({
        get: jest.fn((key) => {
            // Add default mock values for common keys
            const defaults = {
                'windows': [],
                'language': 'FR',
                'shortcuts': {}
            };
            return defaults[key] || null;
        }),
        set: jest.fn(),
        delete: jest.fn(),
        clear: jest.fn(),
        has: jest.fn(() => true),
        store: {},
        path: 'mock-store-path'
    }));
});

// Helper function to generate mock windows for tests
global.generateMockWindows = (count) => {
    const windows = [];
    for (let i = 1; i <= count; i++) {
        windows.push({
            id: `window-${i}`,
            pid: i * 1000,
            handle: `handle-${i}`,
            title: `Window ${i}`,
            character: `Character ${i}`,
            dofusClass: i % 2 === 0 ? 'feca' : 'iop',
            initiative: i * 10,
            enabled: true,
            isActive: i === 1,
            shortcut: `Ctrl+${i}`,
            avatar: (i % 20) + 1
        });
    }
    return windows;
};

// Set up common global mocks and variables
global.TEST_TEMP_DIR = 'mock-user-data-path';
