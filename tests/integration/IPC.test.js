/**
 * Integration tests for IPC communication between main and renderer processes
 * 
 * Tests the communication layer between main process and renderer processes,
 * focusing on message passing, event handling, and error handling.
 */

const path = require('path');

// Define mock path for tests
const mockUserDataPath = path.join(__dirname, '../../mock-user-data-path');

// Mock Electron modules for testing
jest.mock('electron', () => {
    // Create mocks for IPC functionality
    const ipcMainHandlers = new Map();
    const ipcMainOnHandlers = new Map();
    const ipcRendererInvokeHandlers = new Map();
    const ipcRendererOnHandlers = new Map();

    const mockIpcMain = {
        handle: jest.fn((channel, handler) => {
            ipcMainHandlers.set(channel, handler);
        }),
        on: jest.fn((channel, handler) => {
            if (!ipcMainOnHandlers.has(channel)) {
                ipcMainOnHandlers.set(channel, []);
            }
            ipcMainOnHandlers.get(channel).push(handler);
        }),
        removeHandler: jest.fn((channel) => {
            ipcMainHandlers.delete(channel);
        }),
        // Helper to simulate an invoke from the renderer
        __simulateInvoke: async (channel, event = {}, ...args) => {
            const handler = ipcMainHandlers.get(channel);
            if (handler) {
                return handler(event, ...args);
            }
            throw new Error(`No handler for channel: ${channel}`);
        },
        // Helper to simulate a send from the renderer
        __simulateSend: (channel, event = {}, ...args) => {
            const handlers = ipcMainOnHandlers.get(channel) || [];
            handlers.forEach(handler => handler(event, ...args));
        }
    };

    const mockIpcRenderer = {
        invoke: jest.fn(async (channel, ...args) => {
            return mockIpcMain.__simulateInvoke(channel, {}, ...args);
        }),
        on: jest.fn((channel, handler) => {
            if (!ipcRendererOnHandlers.has(channel)) {
                ipcRendererOnHandlers.set(channel, []);
            }
            ipcRendererOnHandlers.get(channel).push(handler);
        }),
        // Helper to simulate a message from main process
        __simulateReceive: (channel, ...args) => {
            const handlers = ipcRendererOnHandlers.get(channel) || [];
            handlers.forEach(handler => handler({}, ...args));
        }
    };

    const mockWebContents = {
        send: jest.fn((channel, ...args) => {
            // Simulate the send being received by the renderer
            mockIpcRenderer.__simulateReceive(channel, ...args);
        })
    };

    const mockMainWindow = {
        webContents: mockWebContents
    }; return {
        app: {
            getPath: jest.fn(() => mockUserDataPath),
            on: jest.fn()
        },
        ipcMain: mockIpcMain,
        ipcRenderer: mockIpcRenderer,
        BrowserWindow: jest.fn().mockImplementation(() => mockMainWindow),
        __mockMainWindow: mockMainWindow,
        __mockWebContents: mockWebContents,
        dialog: {
            showMessageBox: jest.fn().mockResolvedValue({ response: 0 })
        },
        shell: {
            openExternal: jest.fn()
        },
        Menu: {
            buildFromTemplate: jest.fn().mockImplementation(template => ({
                template,
                popup: jest.fn(),
                setApplicationMenu: jest.fn()
            })),
            setApplicationMenu: jest.fn()
        }
    };
});

// Mock fs module
jest.mock('fs', () => ({
    promises: {
        mkdir: jest.fn().mockResolvedValue(undefined),
        readFile: jest.fn().mockResolvedValue('{}'),
        writeFile: jest.fn().mockResolvedValue(undefined),
        access: jest.fn().mockResolvedValue(undefined),
        stat: jest.fn().mockResolvedValue({ size: 1024 })
    },
    existsSync: jest.fn().mockReturnValue(true)
}));

// Mock child_process
jest.mock('child_process', () => ({
    exec: jest.fn((command, options, callback) => {
        if (callback) callback(null, { stdout: '[]', stderr: '' });
        return {
            on: jest.fn(),
            stdout: {
                on: jest.fn()
            },
            stderr: {
                on: jest.fn()
            }
        };
    })
}));

// Mock Logger
jest.mock('../../src/utils/Logger', () => ({
    logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
}));

// Get the electron mocks
const { ipcMain, ipcRenderer, __mockMainWindow, __mockWebContents } = require('electron');

describe('IPC Communication Integration Tests', () => {
    // Import main process modules after mock setup
    let mainProcess;
    let WindowManagerWindows;
    let ErrorHandler;
    let ShortcutConfigManager;

    beforeAll(() => {
        // Load the main process module
        mainProcess = require('../../src/main');
        WindowManagerWindows = require('../../src/services/WindowManagerWindows/WindowManagerWindows');
        ErrorHandler = require('../../src/services/ErrorHandler');
        ShortcutConfigManager = require('../../src/services/ShortcutConfigManager');
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Window Management IPC', () => {
        test('should handle window detection requests', async () => {
            // Mock the window manager to return test data
            WindowManagerWindows.prototype.detectWindows = jest.fn().mockResolvedValue([
                { id: 1, title: 'Dofus - Character1', processId: 1001, character: 'Character1' },
                { id: 2, title: 'Dofus - Character2', processId: 1002, character: 'Character2' }
            ]);

            // Simulate renderer process requesting window detection
            const windows = await ipcRenderer.invoke('detect-windows');

            // Verification
            expect(windows).toHaveLength(2);
            expect(windows[0].character).toBe('Character1');
            expect(windows[1].character).toBe('Character2');
        });

        test('should handle window activation requests', async () => {
            // Mock the window manager activate method
            WindowManagerWindows.prototype.activateWindow = jest.fn().mockResolvedValue(true);

            // Simulate renderer process requesting window activation
            const result = await ipcRenderer.invoke('activate-window', 1);

            // Verification
            expect(WindowManagerWindows.prototype.activateWindow).toHaveBeenCalledWith(1);
            expect(result).toBe(true);
        });

        test('should handle window activation errors', async () => {
            // Mock the window manager to throw an error
            WindowManagerWindows.prototype.activateWindow = jest.fn().mockRejectedValue(
                new Error('Failed to activate window')
            );

            // Simulate renderer process requesting window activation with error
            try {
                await ipcRenderer.invoke('activate-window', 999);
                fail('Should have thrown an error');
            } catch (error) {
                expect(error.message).toContain('Failed to activate window');
            }
        });
    });

    describe('Shortcut Configuration IPC', () => {
        test('should handle shortcut configuration requests', async () => {
            // Mock configuration data
            const mockConfig = {
                shortcuts: { 'window-1': 'Ctrl+1', 'window-2': 'Ctrl+2' },
                avatars: { '1': 'avatar1.jpg' },
                windowSize: { width: 800, height: 600 }
            };

            // Mock the config manager
            ShortcutConfigManager.prototype.getConfig = jest.fn().mockResolvedValue(mockConfig);

            // Simulate renderer process requesting configuration
            const config = await ipcRenderer.invoke('get-shortcuts-config');

            // Verification
            expect(config).toEqual(mockConfig);
            expect(ShortcutConfigManager.prototype.getConfig).toHaveBeenCalled();
        });

        test('should handle saving shortcut configurations', async () => {
            // Mock configuration data
            const mockConfig = {
                shortcuts: { 'window-1': 'Ctrl+1', 'window-2': 'Ctrl+2' },
                avatars: { '1': 'avatar1.jpg' }
            };

            // Mock the config manager
            ShortcutConfigManager.prototype.saveConfig = jest.fn().mockResolvedValue(true);

            // Simulate renderer process saving configuration
            await ipcRenderer.invoke('save-shortcuts-config', mockConfig);

            // Verification
            expect(ShortcutConfigManager.prototype.saveConfig).toHaveBeenCalledWith(mockConfig);
        });
    });

    describe('Error Handling IPC', () => {
        test('should handle error reports from renderer', async () => {
            // Mock the error handler
            ErrorHandler.getErrorHandler = jest.fn().mockReturnValue({
                handleError: jest.fn()
            });

            // Create error data
            const errorData = {
                error: new Error('Test error'),
                context: 'Renderer Process',
                severity: 'ERROR'
            };

            // Simulate renderer process reporting error
            await ipcRenderer.invoke('error-report', errorData);

            // Verification
            const errorHandler = ErrorHandler.getErrorHandler();
            expect(errorHandler.handleError).toHaveBeenCalledWith(
                errorData.error,
                errorData.context,
                errorData.severity,
                expect.any(Object)
            );
        });

        test('should handle dock errors', () => {
            // Mock the error handler
            ErrorHandler.getErrorHandler = jest.fn().mockReturnValue({
                handleError: jest.fn()
            });

            // Create error data
            const errorData = {
                error: 'Dock initialization failed',
                context: 'UI Rendering'
            };

            // Simulate renderer process sending dock error
            ipcMain.__simulateSend('dock-error', {}, errorData);

            // Verification
            const errorHandler = ErrorHandler.getErrorHandler();
            expect(errorHandler.handleError).toHaveBeenCalledWith(
                errorData.error,
                `Dock: ${errorData.context}`,
                'ERROR'
            );
        });
    });

    describe('UI Update Notifications', () => {
        test('should notify renderer of window list changes', () => {
            // Create a mock handler in the renderer
            const mockHandler = jest.fn();
            ipcRenderer.on('windows-changed', mockHandler);

            // Simulate main process sending windows changed notification
            const windowsData = [
                { id: 1, title: 'Dofus - Character1', character: 'Character1' },
                { id: 2, title: 'Dofus - Character2', character: 'Character2' }
            ];
            __mockWebContents.send('windows-changed', windowsData);

            // Verification
            expect(mockHandler).toHaveBeenCalledWith({}, windowsData);
        });

        test('should notify renderer of config changes', () => {
            // Create a mock handler in the renderer
            const mockHandler = jest.fn();
            ipcRenderer.on('config-changed', mockHandler);

            // Simulate main process sending config changed notification
            const configData = { shortcuts: { 'window-1': 'Ctrl+1' } };
            __mockWebContents.send('config-changed', configData);

            // Verification
            expect(mockHandler).toHaveBeenCalledWith({}, configData);
        });
    });
});
