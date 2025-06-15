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