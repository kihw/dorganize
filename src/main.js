utChanges = Object.keys(settings).filter(key => key.startsWith('globalShortcuts.'));
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

      // Handle window shortcut changes - now using config file with character names and priority system
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

      // Register the shortcut with appropriate priority - MODIFIÉ: utiliser WindowActivator
      return this.shortcutManager.setWindowShortcut(windowId, shortcut, async () => {
        console.log(`ShortcutManager: Executing shortcut for window ${windowId} (dummy)`);
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

        // MODIFIÉ: utiliser WindowActivator avec priority system
        const success = this.shortcutManager.setWindowShortcut(window.id, existingShortcut, async () => {
          console.log(`ShortcutManager: Executing shortcut for window ${window.id} (dummy)`);
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