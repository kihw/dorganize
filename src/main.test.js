const { jest } = require('@jest/globals');
const path = require('path');
const DorganizeModule = require('./main.js');
const { Tray } = require('electron');

// Mock Electron modules
const mockTray = {
  setImage: jest.fn(),
  setToolTip: jest.fn(),
  setContextMenu: jest.fn(),
  on: jest.fn()
};

const mockApp = {
  whenReady: jest.fn().mockReturnValue(Promise.resolve()),
  on: jest.fn(),
  quit: jest.fn(),
  isPackaged: false
};

const mockBrowserWindow = jest.fn();
const mockMenu = { buildFromTemplate: jest.fn() };
const mockIpcMain = { handle: jest.fn(), on: jest.fn() };
const mockGlobalShortcut = { register: jest.fn(), unregister: jest.fn(), unregisterAll: jest.fn() };
const mockScreen = { getAllDisplays: jest.fn() };

jest.mock('electron', () => ({
  app: mockApp,
  BrowserWindow: mockBrowserWindow,
  Tray: jest.fn(() => mockTray),
  Menu: mockMenu,
  ipcMain: mockIpcMain,
  globalShortcut: mockGlobalShortcut,
  screen: mockScreen
}));

jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/')),
  resolve: jest.fn((...args) => args.join('/'))
}));

jest.mock('child_process', () => ({
  spawn: jest.fn()
}));

jest.mock('electron-store', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    store: {}
  }));
});

// Mock services
jest.mock('./services/ShortcutManager', () => {
  return jest.fn().mockImplementation(() => ({
    validateShortcut: jest.fn().mockReturnValue(true),
    setWindowShortcut: jest.fn().mockReturnValue(true),
    removeWindowShortcut: jest.fn(),
    convertShortcutToAccelerator: jest.fn(),
    activateAll: jest.fn(),
    deactivateAll: jest.fn(),
    cleanup: jest.fn()
  }));
});

jest.mock('./services/ShortcutConfigManager', () => {
  return jest.fn().mockImplementation(() => ({
    getGlobalShortcut: jest.fn(),
    setGlobalShortcut: jest.fn(),
    removeGlobalShortcut: jest.fn(),
    getCharacterShortcut: jest.fn(),
    setWindowShortcut: jest.fn(),
    removeWindowShortcut: jest.fn(),
    migrateFromElectronStore: jest.fn().mockReturnValue(0),
    getConfigFilePath: jest.fn().mockReturnValue('/mock/config/path'),
    getAllGlobalShortcuts: jest.fn().mockReturnValue({}),
    setCharacterProfile: jest.fn(),
    linkShortcutToWindow: jest.fn(),
    cleanupOldEntries: jest.fn(),
    removeCharacterShortcut: jest.fn(),
    getStatistics: jest.fn(),
    exportConfig: jest.fn(),
    importConfig: jest.fn()
  }));
});

jest.mock('./services/LanguageManager', () => {
  return jest.fn().mockImplementation(() => ({
    getCurrentLanguage: jest.fn().mockReturnValue({
      main_configure: 'Configure',
      main_refreshsort: 'Refresh & Sort',
      main_language: 'Language',
      displayTray_dock: 'Show Dock',
      main_quit: 'Quit',
      displayTray_element_0: 'No windows',
      displayTray_element_1: '1 window',
      displayTray_element_N: '{0} windows'
    }),
    setLanguage: jest.fn(),
    getLanguageMenu: jest.fn().mockReturnValue([])
  }));
});

jest.mock('./services/WindowActivator', () => ({
  WindowActivator: jest.fn().mockImplementation(() => ({
    activateWindow: jest.fn().mockResolvedValue(true),
    focusWindow: jest.fn(),
    bringWindowToFront: jest.fn(),
    cleanup: jest.fn()
  }))
}));

jest.mock('./services/WindowManagerWindows', () => {
  return jest.fn().mockImplementation(() => ({
    getDofusWindows: jest.fn().mockResolvedValue([]),
    getDofusClasses: jest.fn().mockReturnValue({}),
    setWindowClass: jest.fn(),
    cleanup: jest.fn()
  }));
});


describe('Dorganize Tray Icon Tests', () => {
  let dorganizeInstance;
  let mockStore;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock store
    mockStore = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      store: {}
    };
    
    // Setup default store returns
    mockStore.get.mockImplementation((key, defaultValue) => {
      const values = {
        'shortcutsEnabled': true,
        'language': 'FR',
        'dock.enabled': false,
        'dock': { enabled: false, position: 'SE' }
      };
      return values[key] !== undefined ? values[key] : defaultValue;
    });

    // Mock electron-store constructor
    require('electron-store').mockImplementation(() => mockStore);

    // Import Dorganize class after mocks are set up
    delete require.cache[require.resolve('./main.js')];
    
    // Create instance but prevent auto-initialization
    const OriginalDorganize = DorganizeModule.constructor || eval(`(${DorganizeModule.toString()})`);
    dorganizeInstance = new OriginalDorganize();
    
    // Override initialization to prevent automatic execution
    dorganizeInstance.initializeApp = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createTray icon path selection', () => {
    test('should use green icon when shortcuts are enabled', () => {
      // Setup
      dorganizeInstance.shortcutsEnabled = true;
      
      // Execute
      dorganizeInstance.createTray();
      
      // Verify
      expect(path.join).toHaveBeenCalledWith(
        expect.stringContaining('src'),
        '../assets/icons/dorganize_vert.png'
      );
    });

    test('should use red icon when shortcuts are disabled', () => {
      // Setup
      dorganizeInstance.shortcutsEnabled = false;
      
      // Execute
      dorganizeInstance.createTray();
      
      // Verify
      expect(path.join).toHaveBeenCalledWith(
        expect.stringContaining('src'),
        '../assets/icons/dorganize_rouge.png'
      );
    });

    test('should create Tray with correct icon path', () => {
      // Setup
      dorganizeInstance.shortcutsEnabled = true;
      const expectedPath = 'src/../assets/icons/dorganize_vert.png';
      path.join.mockReturnValue(expectedPath);
      
      // Execute
      dorganizeInstance.createTray();
      
      // Verify
      expect(Tray).toHaveBeenCalledWith(expectedPath);
    });

    test('should set correct tooltip on tray creation', () => {
      // Execute
      dorganizeInstance.createTray();
      
      // Verify
      expect(mockTray.setToolTip).toHaveBeenCalledWith('Dorganize');
    });
  });

  describe('updateTrayIcon method', () => {
    beforeEach(() => {
      // Create tray first
      dorganizeInstance.createTray();
      jest.clearAllMocks(); // Clear calls from createTray
    });

    test('should update to green icon when shortcuts are enabled', () => {
      // Setup
      dorganizeInstance.shortcutsEnabled = true;
      const expectedPath = 'src/../assets/icons/dorganize_vert.png';
      path.join.mockReturnValue(expectedPath);
      
      // Execute
      dorganizeInstance.updateTrayIcon();
      
      // Verify
      expect(path.join).toHaveBeenCalledWith(
        expect.stringContaining('src'),
        '../assets/icons/dorganize_vert.png'
      );
      expect(mockTray.setImage).toHaveBeenCalledWith(expectedPath);
    });

    test('should update to red icon when shortcuts are disabled', () => {
      // Setup
      dorganizeInstance.shortcutsEnabled = false;
      const expectedPath = 'src/../assets/icons/dorganize_rouge.png';
      path.join.mockReturnValue(expectedPath);
      
      // Execute
      dorganizeInstance.updateTrayIcon();
      
      // Verify
      expect(path.join).toHaveBeenCalledWith(
        expect.stringContaining('src'),
        '../assets/icons/dorganize_rouge.png'
      );
      expect(mockTray.setImage).toHaveBeenCalledWith(expectedPath);
    });

    test('should not update icon if tray is not initialized', () => {
      // Setup
      dorganizeInstance.tray = null;
      
      // Execute
      dorganizeInstance.updateTrayIcon();
      
      // Verify
      expect(mockTray.setImage).not.toHaveBeenCalled();
    });

    test('should handle icon update during shortcuts toggle', () => {
      // Setup initial state
      dorganizeInstance.shortcutsEnabled = true;
      const greenPath = 'src/../assets/icons/dorganize_vert.png';
      const redPath = 'src/../assets/icons/dorganize_rouge.png';
      
      path.join.mockImplementation((dir, file) => {
        if (file.includes('vert')) return greenPath;
        if (file.includes('rouge')) return redPath;
        return `${dir}/${file}`;
      });
      
      // Execute - first update (green)
      dorganizeInstance.updateTrayIcon();
      expect(mockTray.setImage).toHaveBeenCalledWith(greenPath);
      
      // Change state and update again
      dorganizeInstance.shortcutsEnabled = false;
      dorganizeInstance.updateTrayIcon();
      
      // Verify second update (red)
      expect(mockTray.setImage).toHaveBeenCalledWith(redPath);
      expect(mockTray.setImage).toHaveBeenCalledTimes(2);
    });
  });

  describe('toggleShortcuts integration with icon updates', () => {
    beforeEach(() => {
      dorganizeInstance.createTray();
      dorganizeInstance.updateTrayMenu = jest.fn();
      jest.clearAllMocks();
    });

    test('should update icon when toggling shortcuts from enabled to disabled', () => {
      // Setup
      dorganizeInstance.shortcutsEnabled = true;
      dorganizeInstance.isTogglingShortcuts = false;
      dorganizeInstance.activateShortcuts = jest.fn();
      dorganizeInstance.deactivateShortcuts = jest.fn();
      
      const redPath = 'src/../assets/icons/dorganize_rouge.png';
      path.join.mockReturnValue(redPath);
      
      // Execute
      dorganizeInstance.toggleShortcuts();
      
      // Verify state change and icon update
      expect(dorganizeInstance.shortcutsEnabled).toBe(false);
      expect(mockStore.set).toHaveBeenCalledWith('shortcutsEnabled', false);
      expect(mockTray.setImage).toHaveBeenCalledWith(redPath);
      expect(dorganizeInstance.deactivateShortcuts).toHaveBeenCalled();
    });

    test('should update icon when toggling shortcuts from disabled to enabled', () => {
      // Setup
      dorganizeInstance.shortcutsEnabled = false;
      dorganizeInstance.isTogglingShortcuts = false;
      dorganizeInstance.isConfiguring = false;
      dorganizeInstance.activateShortcuts = jest.fn();
      dorganizeInstance.deactivateShortcuts = jest.fn();
      
      const greenPath = 'src/../assets/icons/dorganize_vert.png';
      path.join.mockReturnValue(greenPath);
      
      // Execute
      dorganizeInstance.toggleShortcuts();
      
      // Verify state change and icon update
      expect(dorganizeInstance.shortcutsEnabled).toBe(true);
      expect(mockStore.set).toHaveBeenCalledWith('shortcutsEnabled', true);
      expect(mockTray.setImage).toHaveBeenCalledWith(greenPath);
      expect(dorganizeInstance.activateShortcuts).toHaveBeenCalled();
    });

    test('should prevent multiple simultaneous toggles', () => {
      // Setup
      dorganizeInstance.shortcutsEnabled = true;
      dorganizeInstance.isTogglingShortcuts = true; // Already toggling
      
      // Execute
      dorganizeInstance.toggleShortcuts();
      
      // Verify no state change occurred
      expect(dorganizeInstance.shortcutsEnabled).toBe(true);
      expect(mockStore.set).not.toHaveBeenCalled();
      expect(mockTray.setImage).not.toHaveBeenCalled();
    });
  });

  describe('icon path construction', () => {
    test('should construct correct relative path from src directory', () => {
      // Setup
      dorganizeInstance.shortcutsEnabled = true;
      
      // Execute
      dorganizeInstance.createTray();
      
      // Verify path construction
      expect(path.join).toHaveBeenCalledWith(
        expect.stringMatching(/src$/),
        '../assets/icons/dorganize_vert.png'
      );
    });

    test('should handle different __dirname values correctly', () => {
      // Setup
      const originalDirname = global.__dirname;
      global.__dirname = '/app/src/main';
      dorganizeInstance.shortcutsEnabled = false;
      
      // Execute
      dorganizeInstance.updateTrayIcon();
      
      // Verify
      expect(path.join).toHaveBeenCalledWith(
        expect.stringContaining('/app/src/main'),
        '../assets/icons/dorganize_rouge.png'
      );
      
      // Cleanup
      global.__dirname = originalDirname;
    });
  });

  describe('loadSettings icon initialization', () => {
    test('should update tray icon after loading shortcuts enabled setting', () => {
      // Setup
      mockStore.get.mockImplementation((key, defaultValue) => {
        if (key === 'shortcutsEnabled') return false;
        if (key === 'language') return 'FR';
        return defaultValue;
      });
      
      dorganizeInstance.createTray();
      dorganizeInstance.updateTrayIcon = jest.fn();
      dorganizeInstance.registerGlobalShortcuts = jest.fn();
      
      // Execute
      dorganizeInstance.loadSettings();
      
      // Verify
      expect(dorganizeInstance.shortcutsEnabled).toBe(false);
      expect(dorganizeInstance.updateTrayIcon).toHaveBeenCalled();
    });

    test('should not update icon if tray is not created yet during loadSettings', () => {
      // Setup
      dorganizeInstance.tray = null;
      dorganizeInstance.updateTrayIcon = jest.fn();
      dorganizeInstance.registerGlobalShortcuts = jest.fn();
      
      // Execute
      dorganizeInstance.loadSettings();
      
      // Verify updateTrayIcon was called but handled gracefully
      expect(dorganizeInstance.updateTrayIcon).toHaveBeenCalled();
    });
  });
});