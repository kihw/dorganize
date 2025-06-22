const { app, BrowserWindow, Tray, Menu, ipcMain, globalShortcut, screen } = require('electron');
const path = require('path');
const Store = require('electron-store');

// Import services
const ShortcutManager = require('./services/ShortcutManager');
const ShortcutConfigManager = require('./services/ShortcutConfigManager');
const LanguageManager = require('./services/LanguageManager');
const { WindowActivator } = require('./services/WindowActivator');
const WindowManagerWindows = require('./services/WindowManagerWindows');

console.log('Dorganize: Starting application...');

class Dorganize {
  constructor() {
    this.mainWindow = null;
    this.dockWindow = null;
    this.tray = null;
    this.dofusWindows = [];
    this.shortcutsEnabled = true;
    this.shortcutsLoaded = false;
    this.settingsLoaded = false;
    this.isConfiguring = false;
    this.isTogglingShortcuts = false;
    this.globalShortcuts = {};

    // Initialize services
    this.store = new Store();
    this.shortcutManager = new ShortcutManager();
    this.shortcutConfig = new ShortcutConfigManager();
    this.languageManager = new LanguageManager();
    this.windowActivator = new WindowActivator();

    // Initialize platform-specific window manager
    this.windowManager = new WindowManagerWindows();

    this.initializeApp();
  }

  async initializeApp() {
    console.log('Dorganize: Initializing application...');

    // Handle app ready
    if (app.isReady()) {
      await this.onReady();
    } else {
      app.whenReady().then(() => this.onReady());
    }

    // Handle app events
    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        this.quit();
      }
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.showConfigWindow();
      }
    });

    app.on('before-quit', () => {
      this.cleanup();
    });

    // Setup IPC handlers
    this.setupIpcHandlers();
  }

  async onReady() {
    console.log('Dorganize: App ready, setting up...');

    // Load settings first
    this.loadSettings();

    // Migrate from old electron-store format
    const migratedCount = this.shortcutConfig.migrateFromElectronStore(this.store);
    if (migratedCount > 0) {
      console.log(`Dorganize: Migrated ${migratedCount} shortcuts from electron-store`);
    }

    // Create tray
    this.createTray();

    // Initial window scan
    await this.refreshAndSort();

    // Start periodic window check
    this.startPeriodicCheck();

    console.log('Dorganize: Application ready');
  }

  createTray() {
    console.log('Dorganize: Creating system tray...');

    // Determine icon based on shortcuts state
    const iconName = this.shortcutsEnabled ? 'dorganize_vert.png' : 'dorganize_rouge.png';
    const iconPath = path.join(__dirname, '../assets/icons', iconName);

    this.tray = new Tray(iconPath);
    this.tray.setToolTip('Dorganize');

    this.updateTrayMenu();

    this.tray.on('click', () => {
      this.showConfigWindow();
    });

    console.log('Dorganize: System tray created');
  }

  updateTrayIcon() {
    if (!this.tray) return;

    const iconName = this.shortcutsEnabled ? 'dorganize_vert.png' : 'dorganize_rouge.png';
    const iconPath = path.join(__dirname, '../assets/icons', iconName);
    this.tray.setImage(iconPath);
  }

  updateTrayMenu() {
    if (!this.tray) return;

    const lang = this.languageManager.getCurrentLanguage();
    const shortcutsText = this.shortcutsEnabled ? 'Disable Shortcuts' : 'Enable Shortcuts';

    const configLabel = this.mainWindow && !this.mainWindow.isDestroyed() && !this.mainWindow.isVisible()
      ? 'Show Configuration'
      : 'Configure';

    const menuTemplate = [
      {
        label: configLabel,
        click: () => this.showConfigWindow()
      },
      {
        label: lang.main_refreshsort || 'Refresh & Sort',
        click: () => this.refreshAndSort()
      },
      { type: 'separator' },
      {
        label: shortcutsText,
        click: () => this.toggleShortcuts()
      },
      { type: 'separator' },
      ...this.languageManager.getLanguageMenu((langCode) => this.changeLanguage(langCode)),
      { type: 'separator' },
      {
        label: lang.displayTray_dock || 'Show Dock',
        type: 'checkbox',
        checked: this.store.get('dock.enabled', false),
        click: (item) => {
          this.store.set('dock.enabled', item.checked);
          if (item.checked) {
            this.showDockWindow();
          } else {
            this.hideDockWindow();
          }
        }
      },
      { type: 'separator' },
      {
        label: lang.main_quit || 'Quit',
        click: () => this.quit()
      }
    ];

    const menu = Menu.buildFromTemplate(menuTemplate);

    this.tray.setContextMenu(menu);
  }

  showConfigWindow() {
    // Si la fenêtre existe mais est cachée, la montrer
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      if (!this.mainWindow.isVisible()) {
        this.mainWindow.show();
        this.mainWindow.focus();
        return;
      } else {
        this.mainWindow.focus();
        return;
      }
    }

    console.log('Dorganize: Creating configuration window...');
    this.isConfiguring = true;
    this.deactivateShortcuts();

    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      },
      show: false,
      frame: false, // Pour utiliser la custom title bar
      titleBarStyle: 'hidden'
    });

    this.mainWindow.loadFile(path.join(__dirname, 'renderer/config.html'));

    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow.show();
    });

    // Modifier l'événement closed pour ne pas réactiver les raccourcis si minimisé
    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
      this.isConfiguring = false;

      if (this.shortcutsEnabled) {
        this.activateShortcuts();
      }
    });

    // Gérer l'événement hide (minimisation)
    this.mainWindow.on('hide', () => {
      console.log('Dorganize: Configuration window hidden');
      this.isConfiguring = false;
    });

    // Gérer l'événement show (restauration)
    this.mainWindow.on('show', () => {
      console.log('Dorganize: Configuration window shown');
      this.isConfiguring = true;
      this.deactivateShortcuts();
    });

    // Send initial data when ready
    this.mainWindow.webContents.once('did-finish-load', () => {
      console.log('ConfigRenderer: Sending initial data to renderer...');
      this.mainWindow.webContents.send('windows-updated', this.dofusWindows);
      this.mainWindow.webContents.send('language-changed', this.languageManager.getCurrentLanguage());
      this.mainWindow.webContents.send('settings-updated', {
        shortcutsEnabled: this.shortcutsEnabled,
        dock: this.store.get('dock', { enabled: false }),
        language: this.store.get('language', 'FR')
      });
    });
  }

  showDockWindow() {
    if (this.dockWindow && !this.dockWindow.isDestroyed()) {
      return;
    }

    const dockSettings = this.store.get('dock', { enabled: true, position: 'SE' });
    const enabledWindows = this.dofusWindows.filter(w => w.enabled);

    if (enabledWindows.length === 0) {
      console.log('Dorganize: No enabled windows, not showing dock');
      return;
    }

    console.log('Dorganize: Creating dock window...');

    // Calculate dock size
    const itemCount = enabledWindows.length + 2; // +2 for refresh and config buttons
    const dockWidth = Math.min(600, itemCount * 60 + 20);
    const dockHeight = 70;

    // Position dock based on settings
    const displays = screen.getAllDisplays();
    const primaryDisplay = displays[0];
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

    let x, y;
    switch (dockSettings.position) {
      case 'NW': x = 10; y = 10; break;
      case 'NE': x = screenWidth - dockWidth - 10; y = 10; break;
      case 'SW': x = 10; y = screenHeight - dockHeight - 10; break;
      case 'SE': x = screenWidth - dockWidth - 10; y = screenHeight - dockHeight - 10; break;
      case 'N': x = (screenWidth - dockWidth) / 2; y = 10; break;
      case 'S': x = (screenWidth - dockWidth) / 2; y = screenHeight - dockHeight - 10; break;
      default: x = screenWidth - dockWidth - 10; y = screenHeight - dockHeight - 10;
    }

    this.dockWindow = new BrowserWindow({
      width: dockWidth,
      height: dockHeight,
      x: Math.round(x),
      y: Math.round(y),
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      },
      show: false
    });

    this.dockWindow.loadFile(path.join(__dirname, 'renderer/dock.html'));

    this.dockWindow.once('ready-to-show', () => {
      this.dockWindow.show();
    });

    this.dockWindow.on('closed', () => {
      this.dockWindow = null;
    });

    // Send initial data
    this.dockWindow.webContents.once('did-finish-load', () => {
      this.dockWindow.webContents.send('windows-updated', this.dofusWindows);
      this.dockWindow.webContents.send('language-changed', this.languageManager.getCurrentLanguage());
    });
  }

  hideDockWindow() {
    if (this.dockWindow && !this.dockWindow.isDestroyed()) {
      this.dockWindow.close();
    }
    this.dockWindow = null;
  }

  startPeriodicCheck() {
    setInterval(async () => {
      if (!this.isConfiguring) {
        await this.refreshAndSort();
      }
    }, 5000); // Check every 5 seconds
  }

  registerGlobalShortcuts() {
    try {
      // Unregister existing global shortcuts
      this.unregisterGlobalShortcuts();

      if (!this.shortcutsEnabled) {
        // Only register toggle shortcut when shortcuts are disabled
        const toggleShortcut = this.shortcutConfig.getGlobalShortcut('toggleShortcuts');
        if (toggleShortcut) {
          const accelerator = this.shortcutManager.convertShortcutToAccelerator(toggleShortcut);
          if (accelerator) {
            globalShortcut.register(accelerator, () => this.toggleShortcuts());
            this.globalShortcuts.toggleShortcuts = accelerator;
          }
        }
        return;
      }

      // Register next window shortcut
      const nextWindowShortcut = this.shortcutConfig.getGlobalShortcut('nextWindow');
      if (nextWindowShortcut) {
        const accelerator = this.shortcutManager.convertShortcutToAccelerator(nextWindowShortcut);
        if (accelerator && !globalShortcut.isRegistered(accelerator)) {
          globalShortcut.register(accelerator, () => this.activateNextWindow());
          this.globalShortcuts.nextWindow = accelerator;
        }
      }

      // Register toggle shortcuts shortcut
      const toggleShortcutsShortcut = this.shortcutConfig.getGlobalShortcut('toggleShortcuts');
      if (toggleShortcutsShortcut) {
        const accelerator = this.shortcutManager.convertShortcutToAccelerator(toggleShortcutsShortcut);
        if (accelerator && !globalShortcut.isRegistered(accelerator)) {
          globalShortcut.register(accelerator, () => this.toggleShortcuts());
          this.globalShortcuts.toggleShortcuts = accelerator;
        }
      }

      console.log('Dorganize: Global shortcuts registered');
    } catch (error) {
      console.error('Dorganize: Error registering global shortcuts:', error);
    }
  }

  unregisterGlobalShortcuts() {
    try {
      Object.values(this.globalShortcuts).forEach(accelerator => {
        if (globalShortcut.isRegistered(accelerator)) {
          globalShortcut.unregister(accelerator);
        }
      });
      this.globalShortcuts = {};
    } catch (error) {
      console.error('Dorganize: Error unregistering global shortcuts:', error);
    }
  }

  activateNextWindow() {
    const enabledWindows = this.dofusWindows.filter(w => w.enabled);
    if (enabledWindows.length === 0) return;

    const currentActiveIndex = enabledWindows.findIndex(w => w.isActive);
    const nextIndex = (currentActiveIndex + 1) % enabledWindows.length;
    const nextWindow = enabledWindows[nextIndex];

    if (nextWindow) {
      this.windowActivator.activateWindow(nextWindow.title);
    }
  }

  toggleShortcuts() {
    if (this.isTogglingShortcuts) return;

    this.isTogglingShortcuts = true;

    try {
      this.shortcutsEnabled = !this.shortcutsEnabled;
      this.store.set('shortcutsEnabled', this.shortcutsEnabled);

      if (this.shortcutsEnabled && !this.isConfiguring) {
        this.activateShortcuts();
      } else {
        this.deactivateShortcuts();
      }

      this.updateTrayIcon();
      this.updateTrayMenu();

      console.log(`Dorganize: Shortcuts ${this.shortcutsEnabled ? 'enabled' : 'disabled'}`);
    } finally {
      setTimeout(() => {
        this.isTogglingShortcuts = false;
      }, 500);
    }
  }

  setupIpcHandlers() {
    console.log('Dorganize: Setting up IPC handlers...');

    // Window data handlers
    ipcMain.handle('get-dofus-windows', () => {
      console.log('IPC: get-dofus-windows called');
      console.log('IPC: Returning', this.dofusWindows.length, 'windows');
      console.log('IPC: Windows data:', this.dofusWindows.map(w => ({
        id: w.id,
        character: w.character,
        dofusClass: w.dofusClass,
        title: w.title
      })));
      return this.dofusWindows;
    });

    ipcMain.handle('get-language', () => {
      console.log('IPC: get-language called');
      return this.languageManager.getCurrentLanguage();
    });

    ipcMain.handle('get-settings', () => {
      console.log('IPC: get-settings called');
      return {
        shortcutsEnabled: this.shortcutsEnabled,
        dock: this.store.get('dock', { enabled: false }),
        language: this.store.get('language', 'FR')
      };
    });

    ipcMain.handle('get-dofus-classes', () => {
      console.log('IPC: get-dofus-classes called');
      return this.windowManager.getDofusClasses();
    });

    // Settings handlers
    ipcMain.handle('save-settings', async (event, settings) => {
      console.log('Dorganize: Saving settings:', settings);

      // Save individual settings
      Object.keys(settings).forEach(key => {
        this.store.set(key, settings[key]);
      });

      // Handle language changes
      if (settings.language) {
        this.changeLanguage(settings.language);
      }

      // Handle global shortcut changes
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

      // Handle window shortcut changes
      const shortcutChanges = Object.keys(settings).filter(key => key.startsWith('shortcuts.'));
      if (shortcutChanges.length > 0) {
        console.log('Dorganize: Window shortcuts changed, updating config file...');
        shortcutChanges.forEach(key => {
          const windowId = key.replace('shortcuts.', '');
          const shortcut = settings[key];

          // Find the window to get character info
          const window = this.dofusWindows.find(w => w.id === windowId);
          if (window) {
            // Use appropriate priority based on current auto key state
            const priority = this.shortcutConfig.isAutoKeyEnabled()
              ? this.shortcutConfig.config.priorities.AUTO_KEY
              : this.shortcutConfig.config.priorities.WINDOW;

            this.shortcutConfig.setWindowShortcut(windowId, shortcut, window.character, window.dofusClass, priority);
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

      // FIX BUG-001: Send settings update notification to renderer
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('settings-updated', settings);
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

          console.log(`IPC: Window ${windowId} activated successfully`);
        } else {
          console.warn(`IPC: Failed to activate window ${windowId}`);
        }

        return result;
      } catch (error) {
        console.error(`IPC: Error activating window ${windowId}:`, error);
        return false;
      }
    });

    ipcMain.handle('refresh-windows', async () => {
      console.log('IPC: refresh-windows called');
      try {
        await this.refreshAndSort();
        return this.dofusWindows;
      } catch (error) {
        console.error('IPC: Error refreshing windows:', error);
        return [];
      }
    });

    ipcMain.handle('set-shortcut', (event, windowId, shortcut) => {
      console.log(`IPC: set-shortcut called for ${windowId}: ${shortcut}`);

      // Validate shortcut before setting - with priority system
      const priority = this.shortcutConfig.isAutoKeyEnabled()
        ? this.shortcutConfig.config.priorities.AUTO_KEY
        : this.shortcutConfig.config.priorities.WINDOW;

      if (!this.shortcutManager.validateShortcut(shortcut, priority)) {
        console.warn(`IPC: Invalid or conflicting shortcut: ${shortcut}`);
        return false;
      }

      // Find the window to get character info
      const window = this.dofusWindows.find(w => w.id === windowId);
      if (!window) {
        console.warn(`IPC: Window not found: ${windowId}`);
        return false;
      }

      // Save shortcut to config file with character info and priority
      const success = this.shortcutConfig.setWindowShortcut(windowId, shortcut, window.character, window.dofusClass, priority);
      if (!success) {
        console.warn(`IPC: Failed to save shortcut to config: ${shortcut}`);
        return false;
      }

      // Register the shortcut with appropriate priority
      return this.shortcutManager.setWindowShortcut(windowId, shortcut, async () => {
        console.log(`ShortcutManager: Executing shortcut for window ${windowId}`);
        const windowTitle = window.title;
        await this.windowActivator.activateWindow(windowTitle);
      }, priority);
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
      console.log('IPC: Window organization using placeholder activator');
      this.windowActivator.bringWindowToFront('organization-request');
      return true;
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

    // Global shortcuts management
    ipcMain.handle('get-global-shortcuts', () => {
      console.log('IPC: get-global-shortcuts called');
      return this.shortcutConfig.getAllGlobalShortcuts();
    });

    ipcMain.handle('set-global-shortcut', (event, type, shortcut) => {
      console.log(`IPC: set-global-shortcut called for ${type}: ${shortcut}`);

      // Validate shortcut with global priority
      if (!this.shortcutManager.validateShortcut(shortcut, this.shortcutConfig.config.priorities.GLOBAL)) {
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

    ipcMain.handle('get-auto-key-settings', () => {
      console.log('IPC: get-auto-key-settings called');
      return {
        enabled: this.shortcutConfig.isAutoKeyEnabled(),
        pattern: this.shortcutConfig.getAutoKeyPattern(),
        customPattern: this.shortcutConfig.getAutoKeyCustomPattern()
      };
    });

    ipcMain.handle('apply-auto-key-configuration', (event, configData) => {
      console.log('IPC: apply-auto-key-configuration called');
      console.log('IPC: Config data received:', configData);

      try {
        // Enable auto key with the provided settings
        this.shortcutConfig.setAutoKeyEnabled(configData.enabled);
        this.shortcutConfig.setAutoKeyPattern(configData.pattern, configData.customPattern);

        // Apply the configuration to windows
        if (configData.enabled && configData.windows) {
          this.shortcutConfig.applyAutoKeyConfiguration(configData.windows);
          // Reload shortcuts
          this.loadAndRegisterShortcuts();
        }

        console.log('IPC: Auto Key configuration applied successfully');
        return true;
      } catch (error) {
        console.error('IPC: Error applying auto key configuration:', error);
        return false;
      }
    });

    ipcMain.handle('disable-auto-key', () => {
      console.log('IPC: disable-auto-key called');
      this.shortcutConfig.setAutoKeyEnabled(false);
      // Reload shortcuts to remove auto-generated ones
      this.loadAndRegisterShortcuts();
      return true;
    });

    // Ajouter ces nouveaux handlers
    ipcMain.handle('minimize-to-tray', () => {
      console.log('IPC: minimize-to-tray called');
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.hide();
        console.log('Dorganize: Configuration window minimized to tray');

        // Réactiver les raccourcis si ils étaient activés
        if (this.shortcutsEnabled) {
          this.activateShortcuts();
        }

        // Optionnel: Afficher une notification tray
        if (this.tray) {
          this.tray.displayBalloon({
            iconType: 'info',
            title: 'Dorganize',
            content: 'Configuration window minimized to tray'
          });
        }
      }
      return true;
    });

    ipcMain.handle('close-config-window', () => {
      console.log('IPC: close-config-window called');
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.close();
      }
      return true;
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

    // FIX BUG-001: Mark settings as loaded
    this.settingsLoaded = true;

    // Update the tray icon after loading settings
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

  // Load and register window shortcuts after windows are detected with priority system
  loadAndRegisterShortcuts() {
    if (this.shortcutsLoaded) {
      console.log('Dorganize: Shortcuts already loaded, clearing and reloading...');
      // Clear existing shortcuts before reloading
      this.shortcutManager.cleanup();
      this.shortcutsLoaded = false;
    }

    console.log('Dorganize: Loading and registering window shortcuts from config file...');

    let registeredCount = 0;

    // Apply auto key configuration first if enabled
    if (this.shortcutConfig.isAutoKeyEnabled()) {
      console.log('Dorganize: Auto Key is enabled, applying auto configuration...');
      this.shortcutConfig.applyAutoKeyConfiguration(this.dofusWindows);
    }

    this.dofusWindows.forEach(window => {
      // Update character profile in config
      this.shortcutConfig.setCharacterProfile(window.id, window.character, window.dofusClass);

      // Try to link existing shortcut to this window
      const existingShortcut = this.shortcutConfig.linkShortcutToWindow(window.character, window.dofusClass, window.id);

      if (existingShortcut) {
        // Get the priority for this shortcut
        const characterKey = this.shortcutConfig.generateCharacterKey(window.character, window.dofusClass);
        const priority = this.shortcutConfig.getShortcutPriority(characterKey);

        console.log(`Dorganize: Linking existing shortcut ${existingShortcut} to window ${window.id} (${window.character}) with priority ${priority}`);

        // Use WindowActivator with priority system
        const success = this.shortcutManager.setWindowShortcut(window.id, existingShortcut, async () => {
          console.log(`ShortcutManager: Executing shortcut for window ${window.id}`);
          await this.windowActivator.activateWindow(window.title);
        }, priority);

        if (success) {
          registeredCount++;
          // Update window info with shortcut
          window.shortcut = existingShortcut;
        } else {
          console.warn(`Dorganize: Failed to register shortcut ${existingShortcut} for window ${window.id} (may conflict with higher priority shortcut)`);
        }
      }
    });

    // Clean up old entries in config
    this.shortcutConfig.cleanupOldEntries(this.dofusWindows);

    console.log(`Dorganize: Successfully registered ${registeredCount} window shortcuts with priority system`);
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

        // FIX BUG-002: Apply proper sorting after updating windows
        this.sortWindowsByInitiative();

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

        // FIX BUG-002: Still apply sorting even if no changes detected
        this.sortWindowsByInitiative();
      }
    } catch (error) {
      console.error('Dorganize: Error refreshing windows:', error);
    }
  }

  // FIX BUG-002: Proper initiative-based sorting method
  sortWindowsByInitiative() {
    console.log('Dorganize: Sorting windows by initiative');

    this.dofusWindows.sort((a, b) => {
      // Sort by initiative (highest first), then by character name
      if (b.initiative !== a.initiative) {
        return b.initiative - a.initiative;
      }
      return a.character.localeCompare(b.character);
    });

    console.log('Dorganize: Windows sorted by initiative:',
      this.dofusWindows.map(w => `${w.character}: ${w.initiative}`));
  }

  updateTrayTooltip() {
    const lang = this.languageManager.getCurrentLanguage();
    const windowCount = this.dofusWindows.length;
    const enabledCount = this.dofusWindows.filter(w => w.enabled).length;
    const autoKeyCount = this.shortcutConfig.isAutoKeyEnabled() ? enabledCount : 0;

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

    if (autoKeyCount > 0) {
      tooltip += `\nAuto Keys: ${autoKeyCount} configured`;
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
  }

  activateShortcuts() {
    this.unregisterGlobalShortcuts();
    this.shortcutsEnabled = true;
    this.store.set('shortcutsEnabled', true);
    console.log('Dorganize: Activating shortcuts');
    this.shortcutManager.activateAll();
  }

  deactivateShortcuts() {
    this.shortcutsEnabled = false;
    this.store.set('shortcutsEnabled', false);
    console.log('Dorganize: Deactivating shortcuts');
    this.shortcutManager.deactivateAll();
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('language-changed', this.languageManager.getCurrentLanguage());
    }
    if (this.dockWindow && !this.dockWindow.isDestroyed()) {
      this.dockWindow.webContents.send('language-changed', this.languageManager.getCurrentLanguage());
    }
  }

  cleanup() {
    console.log('Dorganize: Cleaning up resources...');

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