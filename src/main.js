const { app, BrowserWindow, Tray, Menu, ipcMain, globalShortcut, screen } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const Store = require('electron-store');
const ShortcutManager = require('./services/ShortcutManager');
const ShortcutConfigManager = require('./services/ShortcutConfigManager');
const LanguageManager = require('./services/LanguageManager');

// Import the WindowActivator placeholder implementation
const { WindowActivator } = require('./services/WindowActivator');

// Import the appropriate WindowManager based on platform
let WindowManager;
if (process.platform === 'win32') {
  try {
    WindowManager = require('./services/WindowManagerWindows');
  } catch (error) {
    console.error('Failed to load WindowManagerWindows:', error);
    WindowManager = null;
  }
} else {
  console.warn('Non-Windows platform detected - WindowManager not available');
  WindowManager = null;
}

class Dorganize {
  constructor() {
    this.store = new Store();
    this.shortcutConfig = new ShortcutConfigManager();
    this.mainWindow = null;
    this.tray = null;
    this.dockWindow = null;
    this.windowManager = WindowManager ? new WindowManager() : null;
    this.shortcutManager = new ShortcutManager();
    this.languageManager = new LanguageManager();
    this.isConfiguring = false;
    this.dofusWindows = [];
    this.shortcutsEnabled = true;
    this.globalShortcuts = {
      nextWindow: null,
      toggleShortcuts: null
    };
    this.isTogglingShortcuts = false;
    this.shortcutsLoaded = false;

    // Use the WindowActivator placeholder instead of a native implementation
    this.windowActivator = new WindowActivator();

    console.log('Dorganize: Initializing application...');
    this.initializeApp();
  }

  initializeApp() {
    app.whenReady().then(() => {
      console.log('Dorganize: App ready, setting up...');
      this.createTray();
      this.setupEventHandlers();
      this.loadSettings();

      // Migrate from old electron-store if needed
      this.migrateOldSettings();

      // Initial scan and shortcut setup
      console.log('Dorganize: Performing initial window scan...');
      this.refreshAndSort().then(() => {
        // Load shortcuts after windows are detected
        this.loadAndRegisterShortcuts();
      });
    });

    app.on('window-all-closed', (e) => {
      e.preventDefault(); // Keep app running in tray
    });

    app.on('activate', () => {
      if (this.mainWindow === null) {
        this.showConfigWindow();
      }
    });

    app.on('before-quit', () => {
      this.cleanup();
    });
  }

  migrateOldSettings() {
    try {
      console.log('Dorganize: Checking for old settings to migrate...');
      const migratedCount = this.shortcutConfig.migrateFromElectronStore(this.store);

      if (migratedCount > 0) {
        console.log(`Dorganize: Migrated ${migratedCount} settings to new config system`);

        // Clear old settings from electron-store to avoid confusion
        this.store.delete('shortcuts');
        this.store.delete('globalShortcuts');
        console.log('Dorganize: Cleaned up old electron-store settings');
      }
    } catch (error) {
      console.error('Dorganize: Error during migration:', error);
    }
  }

  createTray() {
    console.log('Dorganize: Creating tray icon');

    // Utiliser l'icône appropriée selon l'état des raccourcis
    const iconPath = this.shortcutsEnabled
      ? path.join(__dirname, '../assets/icons/dorganize_vert.png')
      : path.join(__dirname, '../assets/icons/dorganize_rouge.png');

    this.tray = new Tray(iconPath);
    this.tray.setToolTip('Dorganize');

    this.tray.on('click', () => {
      this.showConfigWindow();
    });

    this.updateTrayMenu();
  }

  // Nouvelle méthode pour mettre à jour l'icône du tray
  updateTrayIcon() {
    if (!this.tray) return;

    const iconPath = this.shortcutsEnabled
      ? path.join(__dirname, '../assets/icons/dorganize_vert.png')
      : path.join(__dirname, '../assets/icons/dorganize_rouge.png');

    this.tray.setImage(iconPath);
    console.log(`Dorganize: Tray icon updated to ${this.shortcutsEnabled ? 'green' : 'red'}`);
  }

  updateTrayMenu() {
    const lang = this.languageManager.getCurrentLanguage();

    console.log('Dorganize: Updating tray menu');

    const nextWindowShortcut = this.shortcutConfig.getGlobalShortcut('nextWindow') || 'Ctrl+Tab';
    const toggleShortcutsShortcut = this.shortcutConfig.getGlobalShortcut('toggleShortcuts') || 'Ctrl+Shift+D';

    const contextMenu = Menu.buildFromTemplate([
      {
        label: lang.main_configure,
        click: () => this.showConfigWindow()
      },
      {
        label: lang.main_refreshsort,
        click: () => this.refreshAndSort()
      },
      { type: 'separator' },
      {
        label: `Next Window (${nextWindowShortcut})`,
        click: () => this.activateNextWindow()
      },
      {
        label: `${this.shortcutsEnabled ? 'Disable' : 'Enable'} Shortcuts (${toggleShortcutsShortcut})`,
        click: () => this.toggleShortcuts()
      },
      { type: 'separator' },
      {
        label: lang.main_language,
        submenu: this.languageManager.getLanguageMenu((langCode) => {
          this.changeLanguage(langCode);
        })
      },
      { type: 'separator' },
      {
        label: lang.displayTray_dock,
        type: 'checkbox',
        checked: this.store.get('dock.enabled', false),
        click: () => this.toggleDock()
      },
      { type: 'separator' },
      {
        label: 'Show Config File',
        click: () => this.showConfigFile()
      },
      {
        label: 'Show Python Interface',
        click: () => this.showPythonInterface()
      },
      { type: 'separator' },
      {
        label: lang.main_quit,
        click: () => this.quit()
      }
    ]);

    this.tray.setContextMenu(contextMenu);
  }

  showConfigFile() {
    const { shell } = require('electron');
    const configPath = this.shortcutConfig.getConfigFilePath();

    try {
      // Show the config file in the file explorer
      shell.showItemInFolder(configPath);
      console.log('Dorganize: Opened config file location:', configPath);
    } catch (error) {
      console.error('Dorganize: Error opening config file location:', error);
    }
  }

  // NOUVELLE MÉTHODE: Affichage de l'interface Python
  showPythonInterface() {
    console.log('Dorganize: Launching Python interface...');

    try {
      const pythonScript = app.isPackaged
        ? path.join(process.resourcesPath, 'script', 'afficher_fenetre.py')
        : path.join(__dirname, '..', 'script', 'afficher_fenetre.py');

      // Lancer le script Python en mode détaché
      const pythonProcess = spawn('python', [pythonScript], {
        detached: true,
        stdio: 'inherit'
      });

      pythonProcess.on('error', (error) => {
        console.error('Dorganize: Error launching Python script:', error);

        // Fallback: essayer avec python3
        console.log('Dorganize: Trying with python3...');
        const python3Process = spawn('python3', [pythonScript], {
          detached: true,
          stdio: 'inherit'
        });

        python3Process.on('error', (error) => {
          console.error('Dorganize: Error launching Python3 script:', error);
        });
      });

      pythonProcess.on('exit', (code) => {
        console.log(`Dorganize: Python script exited with code ${code}`);
      });

    } catch (error) {
      console.error('Dorganize: Failed to launch Python interface:', error);
    }
  }

  showConfigWindow() {
    console.log('Dorganize: showConfigWindow called');

    if (this.mainWindow) {
      console.log('Dorganize: Config window already exists, using placeholder activator...');
      // Utiliser le WindowActivator au lieu de focus()
      this.windowActivator.focusWindow('config-window');
      return;
    }

    console.log('Dorganize: Creating new config window...');
    this.mainWindow = new BrowserWindow({
      width: 900,
      height: 700,
      minWidth: 800,
      minHeight: 600,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      },
      icon: path.join(__dirname, '../assets/icons/dorganize.png'),
      title: 'Dorganize - Configuration',
      show: false, // Ne pas afficher immédiatement
      frame: false,
      titleBarStyle: 'hidden'
    });

    this.mainWindow.loadFile(path.join(__dirname, 'renderer/config.html'));

    this.mainWindow.once('ready-to-show', () => {
      console.log('Dorganize: Config window ready to show');

      // Display the configuration window once it's ready
      this.mainWindow.show();


      // Force refresh windows when config opens
      setTimeout(() => {
        console.log('Dorganize: Forcing window refresh for config...');
        this.refreshAndSort();

        // Also force send current windows to the renderer
        setTimeout(() => {
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            console.log(`Dorganize: Force sending ${this.dofusWindows.length} windows to config renderer`);
            this.mainWindow.webContents.send('windows-updated', this.dofusWindows);
          }
        }, 500);
      }, 1000);
    });

    this.mainWindow.on('closed', () => {
      console.log('Dorganize: Config window closed');
      this.mainWindow = null;
      this.isConfiguring = false;
      this.activateShortcuts();
    });

    this.isConfiguring = true;
    this.deactivateShortcuts();
  }

  showDockWindow() {
    const dockSettings = this.store.get('dock', { enabled: false, position: 'SE' });

    if (!dockSettings.enabled || this.dockWindow) return;

    const enabledWindows = this.dofusWindows.filter(w => w.enabled);
    if (enabledWindows.length === 0) return;

    const displays = screen.getAllDisplays();
    const primaryDisplay = displays.find(display => display.bounds.x === 0 && display.bounds.y === 0) || displays[0];

    let x, y, width, height;
    const dockSize = 70;
    const itemWidth = 60;
    const windowCount = enabledWindows.length + 2; // +2 for refresh and config buttons

    switch (dockSettings.position) {
    case 'NW': // Top-left
      x = primaryDisplay.bounds.x + 10;
      y = primaryDisplay.bounds.y + 10;
      width = Math.min(600, windowCount * itemWidth);
      height = dockSize;
      break;
    case 'NE': // Top-right
      x = primaryDisplay.bounds.x + primaryDisplay.bounds.width - Math.min(600, windowCount * itemWidth) - 10;
      y = primaryDisplay.bounds.y + 10;
      width = Math.min(600, windowCount * itemWidth);
      height = dockSize;
      break;
    case 'SW': // Bottom-left
      x = primaryDisplay.bounds.x + 10;
      y = primaryDisplay.bounds.y + primaryDisplay.bounds.height - dockSize - 10;
      width = Math.min(600, windowCount * itemWidth);
      height = dockSize;
      break;
    case 'SE': // Bottom-right (default)
    default:
      x = primaryDisplay.bounds.x + primaryDisplay.bounds.width - Math.min(600, windowCount * itemWidth) - 10;
      y = primaryDisplay.bounds.y + primaryDisplay.bounds.height - dockSize - 10;
      width = Math.min(600, windowCount * itemWidth);
      height = dockSize;
      break;
    case 'N': // Top horizontal
      x = primaryDisplay.bounds.x + (primaryDisplay.bounds.width - Math.min(600, windowCount * itemWidth)) / 2;
      y = primaryDisplay.bounds.y + 10;
      width = Math.min(600, windowCount * itemWidth);
      height = dockSize;
      break;
    case 'S': // Bottom horizontal
      x = primaryDisplay.bounds.x + (primaryDisplay.bounds.width - Math.min(600, windowCount * itemWidth)) / 2;
      y = primaryDisplay.bounds.y + primaryDisplay.bounds.height - dockSize - 10;
      width = Math.min(600, windowCount * itemWidth);
      height = dockSize;
      break;
    }

    this.dockWindow = new BrowserWindow({
      x, y, width, height,
      frame: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      transparent: true,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    this.dockWindow.loadFile(path.join(__dirname, 'renderer/dock.html'));

    this.dockWindow.on('closed', () => {
      this.dockWindow = null;
    });

    // SUPPRIMÉ: setVisibleOnAllWorkspaces et autres méthodes de focus
    // Utiliser le WindowActivator
    this.windowActivator.bringWindowToFront('dock-window');
  }

  hideDockWindow() {
    if (this.dockWindow) {
      this.dockWindow.close();
      this.dockWindow = null;
    }
  }

  toggleDock() {
    const currentState = this.store.get('dock.enabled', false);
    this.store.set('dock.enabled', !currentState);

    if (!currentState) {
      this.showDockWindow();
    } else {
      this.hideDockWindow();
    }

    this.updateTrayMenu();
  }

  // New method: Activate next window
  activateNextWindow() {
    const enabledWindows = this.dofusWindows.filter(w => w.enabled);
    if (enabledWindows.length === 0) return;

    // Sort by initiative (descending), then by character name
    enabledWindows.sort((a, b) => {
      if (b.initiative !== a.initiative) {
        return b.initiative - a.initiative;
      }
      return a.character.localeCompare(b.character);
    });

    // Find current active window
    const currentActiveIndex = enabledWindows.findIndex(w => w.isActive);

    // Get next window (cycle to first if at end)
    const nextIndex = currentActiveIndex < enabledWindows.length - 1 ? currentActiveIndex + 1 : 0;
    const nextWindow = enabledWindows[nextIndex];

    if (nextWindow) {
      console.log(`Dorganize: Activating next window: ${nextWindow.character}`);
      // Send the window title to the WindowActivator
      this.windowActivator.activateWindow(nextWindow.title);
    }
  }

  // New method: Toggle shortcuts on/off
  toggleShortcuts() {
    // Prevent infinite loops
    if (this.isTogglingShortcuts) {
      console.log('Dorganize: Toggle already in progress, ignoring...');
      return;
    }

    this.isTogglingShortcuts = true;

    try {
      this.shortcutsEnabled = !this.shortcutsEnabled;
      this.store.set('shortcutsEnabled', this.shortcutsEnabled);

      console.log(`Dorganize: Shortcuts ${this.shortcutsEnabled ? 'enabled' : 'disabled'}`);

      if (this.shortcutsEnabled && !this.isConfiguring) {
        this.activateShortcuts();
      } else {
        this.deactivateShortcuts();
      }

      // Mettre à jour l'icône du tray
      this.updateTrayIcon();
      this.updateTrayMenu();

      // Notify user
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('shortcuts-toggled', this.shortcutsEnabled);
      }
    } finally {
      // Reset the flag after a short delay
      setTimeout(() => {
        this.isTogglingShortcuts = false;
      }, 200);
    }
  }

  // Register global shortcuts
  registerGlobalShortcuts() {
    try {
      // Unregister existing global shortcuts
      this.unregisterGlobalShortcuts();

      const nextWindowShortcut = this.shortcutConfig.getGlobalShortcut('nextWindow');
      const toggleShortcutsShortcut = this.shortcutConfig.getGlobalShortcut('toggleShortcuts');

      // Register next window shortcut (only when shortcuts are enabled)
      if (nextWindowShortcut && this.shortcutsEnabled) {
        const accelerator = this.shortcutManager.convertShortcutToAccelerator(nextWindowShortcut);
        if (accelerator) {
          const success = globalShortcut.register(accelerator, () => {
            this.activateNextWindow();
          });

          if (success) {
            this.globalShortcuts.nextWindow = accelerator;
            console.log(`Dorganize: Registered next window shortcut: ${accelerator}`);
          } else {
            console.warn(`Dorganize: Failed to register next window shortcut: ${accelerator}`);
          }
        }
      }

      // CRITICAL: Toggle shortcuts shortcut should ALWAYS work
      if (toggleShortcutsShortcut) {
        const accelerator = this.shortcutManager.convertShortcutToAccelerator(toggleShortcutsShortcut);
        if (accelerator) {
          const success = globalShortcut.register(accelerator, () => {
            // This shortcut always works, even when shortcuts are disabled
            this.toggleShortcuts();
          });

          if (success) {
            this.globalShortcuts.toggleShortcuts = accelerator;
            console.log(`Dorganize: Registered toggle shortcuts shortcut: ${accelerator}`);
          } else {
            console.warn(`Dorganize: Failed to register toggle shortcuts shortcut: ${accelerator}`);
          }
        }
      }

    } catch (error) {
      console.error('Dorganize: Error registering global shortcuts:', error);
    }
  }

  // Unregister global shortcuts
  unregisterGlobalShortcuts() {
    try {
      if (this.globalShortcuts.nextWindow) {
        globalShortcut.unregister(this.globalShortcuts.nextWindow);
        this.globalShortcuts.nextWindow = null;
      }

      if (this.globalShortcuts.toggleShortcuts) {
        globalShortcut.unregister(this.globalShortcuts.toggleShortcuts);
        this.globalShortcuts.toggleShortcuts = null;
      }
    } catch (error) {
      console.error('Dorganize: Error unregistering global shortcuts:', error);
    }
  }

  setupEventHandlers() {
    console.log('Dorganize: Setting up IPC event handlers...');

    // IPC handlers for renderer processes
    ipcMain.handle('get-dofus-windows', () => {
      console.log(`IPC: get-dofus-windows called, returning ${this.dofusWindows.length} windows`);
      return this.dofusWindows;
    });

    ipcMain.handle('get-dofus-classes', () => {
      console.log('IPC: get-dofus-classes called');
      return this.windowManager ? this.windowManager.getDofusClasses() : {};
    });

    ipcMain.handle('get-language', () => {
      const lang = this.languageManager.getCurrentLanguage();
      console.log('IPC: get-language called, returning:', Object.keys(lang).length, 'keys');
      return lang;
    });

    ipcMain.handle('get-settings', () => {
      const settings = this.store.store;
      console.log('IPC: get-settings called, returning:', Object.keys(settings).length, 'settings');
      return settings;
    });

    ipcMain.handle('save-settings', (event, settings) => {
      console.log('IPC: save-settings called with:', Object.keys(settings));
      Object.keys(settings).forEach(key => {
        this.store.set(key, settings[key]);
      });

      // Special handling for class changes
      const classChanges = Object.keys(settings).filter(key => key.startsWith('classes.'));
      if (classChanges.length > 0 && this.windowManager) {
        classChanges.forEach(key => {
          const windowId = key.replace('classes.', '');
          const classKey = settings[key];
          this.windowManager.setWindowClass(windowId, classKey);
        });

        // Force refresh to update avatars
        setTimeout(() => this.refreshAndSort(), 100);
      }

      // Handle global shortcut changes - now using config file
      const globalShortcutChanges = Object.keys(settings).filter(key => key.startsWith('globalShortcuts.'));
      if (globalShortcutChanges.length > 0) {
        console.log('Dorganize: Global shortcuts changed, updating config file...');
        globalShortcutChanges.forEach(key => {
          const type = key.replace('globalShortcuts.', '');
          const shortcut = settings[key];
          this.shortcutConfig.setGlobalShortcut(type, shortcut);
        });
        setTimeout(() => this.registerGlobalShortcuts(), 100);
        this.updateTrayMenu();
      }

      // Handle window shortcut changes - now using config file with character names
      const shortcutChanges = Object.keys(settings).filter(key => key.startsWith('shortcuts.'));
      if (shortcutChanges.length > 0) {
        console.log('Dorganize: Window shortcuts changed, updating config file...');
        shortcutChanges.forEach(key => {
          const windowId = key.replace('shortcuts.', '');
          const shortcut = settings[key];

          // Find the window to get character info
          const window = this.dofusWindows.find(w => w.id === windowId);
          if (window) {
            this.shortcutConfig.setWindowShortcut(windowId, shortcut, window.character, window.dofusClass);
          }
        });
        setTimeout(() => this.loadAndRegisterShortcuts(), 100);
      }

      // Update dock if settings changed
      if (settings.dock) {
        this.hideDockWindow();
        if (settings.dock.enabled) {
          setTimeout(() => this.showDockWindow(), 100);
        }
      }
    });

    ipcMain.handle('activate-window', async (event, windowId) => {
      console.log(`IPC: activate-window called for: ${windowId}`);

      try {
        const window = this.dofusWindows.find(w => w.id === windowId);
        const title = window ? window.title : null;

        // Send the title to the WindowActivator
        const result = await this.windowActivator.activateWindow(title);

        // Enhanced activation with immediate feedback
        if (result) {
          // Update the active state in our local data immediately
          this.dofusWindows.forEach(w => {
            w.isActive = w.id === windowId;
          });

          // Notify all windows about the state change immediately
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('windows-updated', this.dofusWindows);
          }

          if (this.dockWindow && !this.dockWindow.isDestroyed()) {
            this.dockWindow.webContents.send('windows-updated', this.dofusWindows);
          }

          console.log(`IPC: Window ${windowId} activated successfully (dummy)`);
        } else {
          console.warn(`IPC: Failed to activate window ${windowId} (dummy)`);
        }

        return result;
      } catch (error) {
        console.error(`IPC: Error activating window ${windowId}:`, error);
        return false;
      }
    });

    ipcMain.handle('refresh-windows', () => {
      console.log('IPC: refresh-windows called');
      return this.refreshAndSort();
    });

    ipcMain.handle('set-shortcut', (event, windowId, shortcut) => {
      console.log(`IPC: set-shortcut called for ${windowId}: ${shortcut}`);

      // Validate shortcut before setting
      if (!this.shortcutManager.validateShortcut(shortcut)) {
        console.warn(`IPC: Invalid or conflicting shortcut: ${shortcut}`);
        return false;
      }

      // Find the window to get character info
      const window = this.dofusWindows.find(w => w.id === windowId);
      if (!window) {
        console.warn(`IPC: Window not found: ${windowId}`);
        return false;
      }

      // Save shortcut to config file with character info
      const success = this.shortcutConfig.setWindowShortcut(windowId, shortcut, window.character, window.dofusClass);
      if (!success) {
        console.warn(`IPC: Failed to save shortcut to config: ${shortcut}`);
        return false;
      }

      // Register the shortcut - MODIFIÉ: utiliser WindowActivator
      return this.shortcutManager.setWindowShortcut(windowId, shortcut, async () => {
        console.log(`ShortcutManager: Executing shortcut for window ${windowId} (dummy)`);
        const windowTitle = window.title;
        await this.windowActivator.activateWindow(windowTitle);
      });
    });

    ipcMain.handle('remove-shortcut', (event, windowId) => {
      console.log(`IPC: remove-shortcut called for: ${windowId}`);

      // Find the window to get character info
      const window = this.dofusWindows.find(w => w.id === windowId);
      if (window) {
        // Remove from config file using character info
        this.shortcutConfig.removeCharacterShortcut(window.character, window.dofusClass);
      } else {
        // Fallback: remove by windowId
        this.shortcutConfig.removeWindowShortcut(windowId);
      }

      // Remove from shortcut manager
      this.shortcutManager.removeWindowShortcut(windowId);
    });

    ipcMain.handle('organize-windows', (event, layout) => {
      console.log(`IPC: organize-windows called with layout: ${layout}`);
      // MODIFIÉ: Ne plus utiliser windowManager.organizeWindows, utiliser WindowActivator
      console.log('IPC: Window organization disabled - using placeholder activator');
      this.windowActivator.bringWindowToFront('organization-request');
      return true; // Simuler le succès
    });

    ipcMain.on('show-config', () => {
      console.log('IPC: show-config called');
      this.showConfigWindow();
    });

    ipcMain.handle('close-app', () => {
      console.log('IPC: close-app called');
      this.quit();
    });

    // New IPC handlers for global shortcuts
    ipcMain.handle('activate-next-window', () => {
      console.log('IPC: activate-next-window called');
      this.activateNextWindow();
    });

    ipcMain.handle('toggle-shortcuts', () => {
      console.log('IPC: toggle-shortcuts called');
      this.toggleShortcuts();
      return this.shortcutsEnabled;
    });

    ipcMain.handle('get-shortcuts-enabled', () => {
      return this.shortcutsEnabled;
    });

    // Global shortcuts management - now using config file
    ipcMain.handle('get-global-shortcuts', () => {
      console.log('IPC: get-global-shortcuts called');
      return this.shortcutConfig.getAllGlobalShortcuts();
    });

    ipcMain.handle('set-global-shortcut', (event, type, shortcut) => {
      console.log(`IPC: set-global-shortcut called for ${type}: ${shortcut}`);

      // Validate shortcut
      if (!this.shortcutManager.validateShortcut(shortcut)) {
        console.warn(`IPC: Invalid or conflicting global shortcut: ${shortcut}`);
        return false;
      }

      // Save the shortcut to config file
      const success = this.shortcutConfig.setGlobalShortcut(type, shortcut);
      if (!success) {
        console.warn(`IPC: Failed to save global shortcut to config: ${shortcut}`);
        return false;
      }

      // Re-register global shortcuts
      this.registerGlobalShortcuts();
      this.updateTrayMenu();

      return true;
    });

    ipcMain.handle('remove-global-shortcut', (event, type) => {
      console.log(`IPC: remove-global-shortcut called for: ${type}`);
      this.shortcutConfig.removeGlobalShortcut(type);
      this.registerGlobalShortcuts();
      this.updateTrayMenu();
    });

    // Config file management
    ipcMain.handle('get-shortcut-config-stats', () => {
      return this.shortcutConfig.getStatistics();
    });

    ipcMain.handle('export-shortcut-config', () => {
      return this.shortcutConfig.exportConfig();
    });

    ipcMain.handle('import-shortcut-config', (event, config) => {
      return this.shortcutConfig.importConfig(config);
    });
  }

  loadSettings() {
    console.log('Dorganize: Loading settings...');

    const language = this.store.get('language', 'FR');
    console.log(`Dorganize: Setting language to ${language}`);
    this.languageManager.setLanguage(language);

    // Load shortcuts enabled state
    this.shortcutsEnabled = this.store.get('shortcutsEnabled', true);
    console.log(`Dorganize: Shortcuts enabled: ${this.shortcutsEnabled}`);

    // Mettre à jour l'icône du tray après le chargement des paramètres
    if (this.tray) {
      this.updateTrayIcon();
    }

    // Set default global shortcuts if not set in config file
    if (!this.shortcutConfig.getGlobalShortcut('nextWindow')) {
      this.shortcutConfig.setGlobalShortcut('nextWindow', 'Ctrl+Tab');
    }
    if (!this.shortcutConfig.getGlobalShortcut('toggleShortcuts')) {
      this.shortcutConfig.setGlobalShortcut('toggleShortcuts', 'Ctrl+Shift+D');
    }

    // Register global shortcuts FIRST
    this.registerGlobalShortcuts();
  }

  // Load and register window shortcuts after windows are detected
  loadAndRegisterShortcuts() {
    if (this.shortcutsLoaded) {
      console.log('Dorganize: Shortcuts already loaded, clearing and reloading...');
      // Clear existing shortcuts before reloading
      this.shortcutManager.cleanup();
      this.shortcutsLoaded = false;
    }

    console.log('Dorganize: Loading and registering window shortcuts from config file...');

    let registeredCount = 0;

    this.dofusWindows.forEach(window => {
      // Update character profile in config
      this.shortcutConfig.setCharacterProfile(window.id, window.character, window.dofusClass);

      // Try to link existing shortcut to this window
      const existingShortcut = this.shortcutConfig.linkShortcutToWindow(window.character, window.dofusClass, window.id);

      if (existingShortcut) {
        console.log(`Dorganize: Linking existing shortcut ${existingShortcut} to window ${window.id} (${window.character})`);

        // MODIFIÉ: utiliser WindowActivator
        const success = this.shortcutManager.setWindowShortcut(window.id, existingShortcut, async () => {
          console.log(`ShortcutManager: Executing shortcut for window ${window.id} (dummy)`);
          await this.windowActivator.activateWindow(window.title);
        });

        if (success) {
          registeredCount++;
          // Update window info with shortcut
          window.shortcut = existingShortcut;
        } else {
          console.warn(`Dorganize: Failed to register shortcut ${existingShortcut} for window ${window.id}`);
        }
      }
    });

    // Clean up old entries in config
    this.shortcutConfig.cleanupOldEntries(this.dofusWindows);

    console.log(`Dorganize: Successfully registered ${registeredCount} window shortcuts`);
    this.shortcutsLoaded = true;

    // Re-register global shortcuts to ensure they work
    this.registerGlobalShortcuts();

    // Update UI with shortcut information
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('windows-updated', this.dofusWindows);
    }

    if (this.dockWindow && !this.dockWindow.isDestroyed()) {
      this.dockWindow.webContents.send('windows-updated', this.dofusWindows);
    }
  }

  async refreshAndSort() {
    try {
      console.log('Dorganize: Manual refresh requested');

      if (!this.windowManager) {
        console.warn('Dorganize: WindowManager not available');
        return;
      }

      const windows = await this.windowManager.getDofusWindows();
      console.log(`Dorganize: WindowManager returned ${windows.length} windows`);

      const hasChanged = JSON.stringify(windows.map(w => ({ id: w.id, title: w.title, isActive: w.isActive, dofusClass: w.dofusClass }))) !==
        JSON.stringify(this.dofusWindows.map(w => ({ id: w.id, title: w.title, isActive: w.isActive, dofusClass: w.dofusClass })));

      // FORCE UPDATE: Always update the array to ensure IPC gets fresh data
      const forceUpdate = this.dofusWindows.length === 0 && windows.length > 0;

      if (hasChanged || this.dofusWindows.length !== windows.length || forceUpdate) {
        console.log(`Dorganize: Window list updating... (hasChanged: ${hasChanged}, lengthDiff: ${this.dofusWindows.length !== windows.length}, forceUpdate: ${forceUpdate})`);

        // Load shortcuts from config for each window based on character name
        windows.forEach(window => {
          const existingShortcut = this.shortcutConfig.getCharacterShortcut(window.character, window.dofusClass);
          if (existingShortcut) {
            window.shortcut = existingShortcut;
          }
        });

        this.dofusWindows = windows;
        console.log(`Dorganize: Updated dofusWindows array, now has ${this.dofusWindows.length} windows`);
        this.updateTrayTooltip();

        // If shortcuts haven't been loaded yet and we have windows, load them
        if (!this.shortcutsLoaded && this.dofusWindows.length > 0) {
          console.log('Dorganize: Windows detected, loading shortcuts...');
          this.loadAndRegisterShortcuts();
        } else if (this.shortcutsLoaded && this.dofusWindows.length > 0) {
          // If shortcuts were already loaded, reload them to handle window changes
          console.log('Dorganize: Windows changed, reloading shortcuts...');
          this.loadAndRegisterShortcuts();
        }

        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          console.log('Dorganize: Sending windows-updated to config window');
          this.mainWindow.webContents.send('windows-updated', this.dofusWindows);
        }

        if (this.dockWindow && !this.dockWindow.isDestroyed()) {
          console.log('Dorganize: Sending windows-updated to dock window');
          this.dockWindow.webContents.send('windows-updated', this.dofusWindows);
        }

        // Update dock visibility
        const dockSettings = this.store.get('dock', { enabled: false });
        if (dockSettings.enabled) {
          if (this.dofusWindows.filter(w => w.enabled).length > 0) {
            if (!this.dockWindow) {
              this.showDockWindow();
            }
          } else {
            this.hideDockWindow();
          }
        }
      } else {
        console.log(`Dorganize: No changes in window list (current: ${this.dofusWindows.length}, new: ${windows.length})`);
        // But still update the array to ensure consistency
        this.dofusWindows = windows;
      }
    } catch (error) {
      console.error('Dorganize: Error refreshing windows:', error);
    }
  }

  updateTrayTooltip() {
    const lang = this.languageManager.getCurrentLanguage();
    const windowCount = this.dofusWindows.length;
    const enabledCount = this.dofusWindows.filter(w => w.enabled).length;

    let tooltip = 'Dorganize\n';
    if (windowCount === 0) {
      tooltip += lang.displayTray_element_0;
    } else if (windowCount === 1) {
      tooltip += lang.displayTray_element_1;
    } else {
      tooltip += lang.displayTray_element_N.replace('{0}', windowCount);
    }

    if (enabledCount !== windowCount) {
      tooltip += ` (${enabledCount} enabled)`;
    }

    tooltip += `\nShortcuts: ${this.shortcutsEnabled ? 'Enabled' : 'Disabled'}`;

    console.log(`Dorganize: Updating tray tooltip: ${tooltip}`);
    this.tray.setToolTip(tooltip);
  }

  changeLanguage(langCode) {
    console.log(`Dorganize: Changing language to ${langCode}`);
    this.languageManager.setLanguage(langCode);
    this.store.set('language', langCode);
    this.updateTrayMenu();

    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('language-changed', this.languageManager.getCurrentLanguage());
    }

    if (this.dockWindow && !this.dockWindow.isDestroyed()) {
      this.dockWindow.webContents.send('language-changed', this.languageManager.getCurrentLanguage());
    }
  }

  activateShortcuts() {
    if (this.shortcutsEnabled) {
      console.log('Dorganize: Activating shortcuts');
      this.shortcutManager.activateAll();
      // Re-register global shortcuts
      this.registerGlobalShortcuts();
    }
  }

  deactivateShortcuts() {
    console.log('Dorganize: Deactivating shortcuts');
    this.shortcutManager.deactivateAll();

    // IMPORTANT: Keep the toggle shortcut active even when shortcuts are disabled
    const toggleShortcutsShortcut = this.shortcutConfig.getGlobalShortcut('toggleShortcuts');
    if (toggleShortcutsShortcut) {
      const accelerator = this.shortcutManager.convertShortcutToAccelerator(toggleShortcutsShortcut);
      if (accelerator && !globalShortcut.isRegistered(accelerator)) {
        globalShortcut.register(accelerator, () => {
          this.toggleShortcuts();
        });
        this.globalShortcuts.toggleShortcuts = accelerator;
        console.log('Dorganize: Keeping toggle shortcut active while shortcuts are disabled');
      }
    }
  }

  cleanup() {
    console.log('Dorganize: Cleaning up...');
    this.shortcutManager.cleanup();

    // Unregister global shortcuts
    try {
      this.unregisterGlobalShortcuts();
      globalShortcut.unregisterAll();
    } catch (error) {
      console.error('Dorganize: Error unregistering global shortcuts:', error);
    }

    // Clean up WindowActivator
    if (this.windowActivator && typeof this.windowActivator.cleanup === 'function') {
      this.windowActivator.cleanup();
    }

    // Clean up Windows-specific resources
    if (this.windowManager && typeof this.windowManager.cleanup === 'function') {
      this.windowManager.cleanup();
    }
  }

  quit() {
    console.log('Dorganize: Quitting application...');
    this.cleanup();
    if (this.dockWindow && !this.dockWindow.isDestroyed()) this.dockWindow.close();
    if (this.mainWindow && !this.mainWindow.isDestroyed()) this.mainWindow.close();
    app.quit();
  }
}

// Initialize the application
console.log('Starting Dorganize...');
new Dorganize();
