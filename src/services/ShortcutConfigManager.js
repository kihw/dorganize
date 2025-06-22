const fs = require('fs');
const path = require('path');
const os = require('os');
const { app } = require('electron');

class ShortcutConfigManager {
  constructor() {
    this.configFile = path.join(os.homedir(), '.dorganize', 'shortcuts.json');
    this.config = {
      shortcuts: {
        global: {},
        characters: {},
        autoKey: {
          enabled: false,
          pattern: 'numbers',
          customPattern: 'Ctrl+Alt+{n}'
        }
      },
      characters: {},
      priorities: {
        GLOBAL: 1,
        AUTO_KEY: 2,
        WINDOW: 3
      },
      lastUpdated: new Date().toISOString()
    };

    this.ensureConfigDirectory();
    this.loadConfig();
  }

  ensureConfigDirectory() {
    try {
      const configDir = path.dirname(this.configFile);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
        console.log('ShortcutConfigManager: Created config directory');
      }
    } catch (error) {
      console.error('ShortcutConfigManager: Error creating config directory:', error);
    }
  }

  loadConfig() {
    try {
      if (fs.existsSync(this.configFile)) {
        const data = fs.readFileSync(this.configFile, 'utf8');
        const loadedConfig = JSON.parse(data);

        // Merge with default config to ensure all properties exist
        this.config = {
          ...this.config,
          ...loadedConfig,
          shortcuts: {
            ...this.config.shortcuts,
            ...loadedConfig.shortcuts,
            characters: loadedConfig.shortcuts?.characters || {},
            global: loadedConfig.shortcuts?.global || {},
            autoKey: {
              ...this.config.shortcuts.autoKey,
              ...loadedConfig.shortcuts?.autoKey
            }
          },
          priorities: {
            ...this.config.priorities,
            ...loadedConfig.priorities
          },
          characters: loadedConfig.characters || {}
        };

        console.log('ShortcutConfigManager: Config loaded successfully');
      } else {
        console.log('ShortcutConfigManager: No existing config found, using defaults');
        this.saveConfig();
      }
    } catch (error) {
      console.error('ShortcutConfigManager: Error loading config:', error);
      console.log('ShortcutConfigManager: Using default configuration');
    }
  }

  saveConfig() {
    try {
      this.config.lastUpdated = new Date().toISOString();
      const configData = JSON.stringify(this.config, null, 2);
      fs.writeFileSync(this.configFile, configData, 'utf8');
      console.log('ShortcutConfigManager: Config saved successfully');
      return true;
    } catch (error) {
      console.error('ShortcutConfigManager: Error saving config:', error);
      return false;
    }
  }

  // Character key generation
  generateCharacterKey(character, dofusClass) {
    if (!character || !dofusClass) {
      console.warn('ShortcutConfigManager: Cannot generate character key without character and class');
      return null;
    }
    const cleanCharacter = character.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanClass = dofusClass.toLowerCase().replace(/[^a-z0-9]/g, '');
    return `${cleanCharacter}_${cleanClass}`;
  }

  // Character profile management
  setCharacterProfile(windowId, character, dofusClass) {
    if (!windowId || !character || !dofusClass) return false;

    this.config.characters[windowId] = {
      character: character,
      class: dofusClass,
      lastSeen: new Date().toISOString(),
      windowId: windowId
    };

    return this.saveConfig();
  }

  // Global shortcuts management
  getGlobalShortcut(type) {
    return this.config.shortcuts.global[type] || null;
  }

  setGlobalShortcut(type, shortcut) {
    if (!type || !shortcut) return false;

    this.config.shortcuts.global[type] = shortcut;
    return this.saveConfig();
  }

  removeGlobalShortcut(type) {
    if (this.config.shortcuts.global[type]) {
      delete this.config.shortcuts.global[type];
      return this.saveConfig();
    }
    return false;
  }

  getAllGlobalShortcuts() {
    return { ...this.config.shortcuts.global };
  }

  // Character shortcuts management
  getCharacterShortcut(character, dofusClass) {
    const characterKey = this.generateCharacterKey(character, dofusClass);
    if (!characterKey) return null;

    const shortcutData = this.config.shortcuts.characters[characterKey];
    return shortcutData ? shortcutData.shortcut : null;
  }

  setWindowShortcut(windowId, shortcut, character, dofusClass, priority = this.config.priorities.WINDOW) {
    if (!windowId || !shortcut || !character || !dofusClass) {
      console.warn('ShortcutConfigManager: Missing required parameters for setWindowShortcut');
      return false;
    }

    const characterKey = this.generateCharacterKey(character, dofusClass);
    if (!characterKey) return false;

    this.config.shortcuts.characters[characterKey] = {
      shortcut: shortcut,
      character: character,
      class: dofusClass,
      windowId: windowId,
      priority: priority,
      lastUsed: new Date().toISOString(),
      usageCount: (this.config.shortcuts.characters[characterKey]?.usageCount || 0) + 1,
      autoGenerated: priority === this.config.priorities.AUTO_KEY
    };

    return this.saveConfig();
  }

  removeWindowShortcut(windowId) {
    // Find and remove shortcut by windowId
    let removed = false;
    Object.keys(this.config.shortcuts.characters).forEach(characterKey => {
      if (this.config.shortcuts.characters[characterKey].windowId === windowId) {
        delete this.config.shortcuts.characters[characterKey];
        removed = true;
      }
    });

    if (removed) {
      this.saveConfig();
    }
    return removed;
  }

  removeCharacterShortcut(character, dofusClass) {
    const characterKey = this.generateCharacterKey(character, dofusClass);
    if (!characterKey) return false;

    if (this.config.shortcuts.characters[characterKey]) {
      delete this.config.shortcuts.characters[characterKey];
      return this.saveConfig();
    }
    return false;
  }

  linkShortcutToWindow(character, dofusClass, windowId) {
    const characterKey = this.generateCharacterKey(character, dofusClass);
    if (!characterKey) return null;

    const shortcutData = this.config.shortcuts.characters[characterKey];
    if (shortcutData) {
      // Update the windowId to link to current window
      shortcutData.windowId = windowId;
      shortcutData.lastUsed = new Date().toISOString();
      this.saveConfig();
      return shortcutData.shortcut;
    }

    return null;
  }

  getShortcutPriority(characterKey) {
    const shortcutData = this.config.shortcuts.characters[characterKey];
    return shortcutData ? shortcutData.priority : this.config.priorities.WINDOW;
  }

  // Auto Key Configuration
  isAutoKeyEnabled() {
    return this.config.shortcuts.autoKey.enabled;
  }

  getAutoKeyPattern() {
    return this.config.shortcuts.autoKey.pattern;
  }

  getAutoKeyCustomPattern() {
    return this.config.shortcuts.autoKey.customPattern;
  }

  setAutoKeyEnabled(enabled) {
    this.config.shortcuts.autoKey.enabled = enabled;
    return this.saveConfig();
  }

  setAutoKeyPattern(pattern, customPattern = null) {
    this.config.shortcuts.autoKey.pattern = pattern;
    if (customPattern) {
      this.config.shortcuts.autoKey.customPattern = customPattern;
    }
    return this.saveConfig();
  }

  applyAutoKeyConfiguration(windows) {
    if (!this.isAutoKeyEnabled()) {
      console.log('ShortcutConfigManager: AutoKey is disabled, skipping configuration');
      return false;
    }

    console.log('ShortcutConfigManager: Applying AutoKey configuration to', windows.length, 'windows');

    // Sort windows by initiative (highest first)
    const sortedWindows = [...windows].sort((a, b) => {
      if (b.initiative !== a.initiative) {
        return b.initiative - a.initiative;
      }
      return a.character.localeCompare(b.character);
    });

    // Apply shortcuts based on initiative order
    sortedWindows.forEach((window, index) => {
      const position = index + 1;
      const shortcut = this.generateShortcutForPosition(position);

      if (shortcut) {
        this.setWindowShortcut(
          window.id,
          shortcut,
          window.character,
          window.dofusClass,
          this.config.priorities.AUTO_KEY
        );
        console.log(`ShortcutConfigManager: Assigned ${shortcut} to ${window.character} (initiative: ${window.initiative})`);
      }
    });

    this.saveConfig();
    return true;
  }

  generateShortcutForPosition(position) {
    const pattern = this.getAutoKeyPattern();

    switch (pattern) {
      case 'numbers':
        return position.toString();
      case 'function':
        return `F${position}`;
      case 'numpad':
        return `Num${position}`;
      case 'azertyui':
        const azertyuiKeys = ['A', 'Z', 'E', 'R', 'T', 'Y', 'U', 'I'];
        return azertyuiKeys[position - 1] || `Pos${position}`;
      case 'custom':
        const customPattern = this.getAutoKeyCustomPattern();
        return customPattern.replace('{n}', position.toString());
      default:
        return position.toString();
    }
  }

  // Utility methods
  findCharacterByName(characterName, dofusClass) {
    // Find a character profile by name and class
    for (const [windowId, profile] of Object.entries(this.config.characters)) {
      if (profile.character.toLowerCase() === characterName.toLowerCase() &&
        profile.class === dofusClass) {
        return { windowId, profile };
      }
    }
    return null;
  }

  // Shortcut validation
  isShortcutInUse(shortcut, excludeCharacterKey = null) {
    // Check character shortcuts
    for (const [characterKey, shortcutData] of Object.entries(this.config.shortcuts.characters)) {
      if (characterKey !== excludeCharacterKey && shortcutData.shortcut === shortcut) {
        return {
          type: 'character',
          characterKey,
          character: shortcutData.character,
          class: shortcutData.class,
          priority: this.getShortcutPriority(characterKey),
          autoGenerated: shortcutData.autoGenerated || false
        };
      }
    }

    // Check global shortcuts
    for (const [type, globalShortcut] of Object.entries(this.config.shortcuts.global)) {
      if (globalShortcut === shortcut) {
        return {
          type: 'global',
          shortcutType: type,
          priority: this.config.priorities.GLOBAL
        };
      }
    }

    return null;
  }

  // Migration and cleanup
  migrateFromElectronStore(electronStore) {
    try {
      console.log('ShortcutConfigManager: Starting migration from electron-store...');

      // Migrate window shortcuts - convert to character shortcuts
      const oldShortcuts = electronStore.get('shortcuts', {});
      const oldClasses = electronStore.get('classes', {});
      const oldCustomNames = electronStore.get('customNames', {});
      let migratedCount = 0;

      Object.keys(oldShortcuts).forEach(windowId => {
        const shortcut = oldShortcuts[windowId];
        const dofusClass = oldClasses[windowId] || 'feca';
        const character = oldCustomNames[windowId] || `Player_${windowId}`;

        if (shortcut) {
          const characterKey = this.generateCharacterKey(character, dofusClass);

          if (!this.config.shortcuts.characters[characterKey]) {
            this.config.shortcuts.characters[characterKey] = {
              shortcut: shortcut,
              character: character,
              class: dofusClass,
              windowId: windowId,
              priority: this.config.priorities.WINDOW,
              lastUsed: new Date().toISOString(),
              usageCount: 1,
              autoGenerated: false,
              migrated: true
            };
            migratedCount++;
          }
        }
      });

      // Migrate global shortcuts
      const oldGlobalShortcuts = electronStore.get('globalShortcuts', {});
      Object.keys(oldGlobalShortcuts).forEach(type => {
        const shortcut = oldGlobalShortcuts[type];
        if (shortcut && !this.config.shortcuts.global[type]) {
          this.config.shortcuts.global[type] = shortcut;
        }
      });

      // Migrate character data
      const oldInitiatives = electronStore.get('initiatives', {});

      Object.keys(oldClasses).forEach(windowId => {
        if (!this.config.characters[windowId]) {
          this.config.characters[windowId] = {
            character: oldCustomNames[windowId] || 'Unknown',
            class: oldClasses[windowId] || 'feca',
            initiative: oldInitiatives[windowId] || 0,
            lastSeen: new Date().toISOString(),
            windowId: windowId,
            migrated: true
          };
        }
      });

      if (migratedCount > 0) {
        this.saveConfig();
        console.log(`ShortcutConfigManager: Migrated ${migratedCount} shortcuts from electron-store`);
      }

      return migratedCount;
    } catch (error) {
      console.error('ShortcutConfigManager: Error during migration:', error);
      return 0;
    }
  }

  cleanupOldEntries(activeWindows) {
    // Update windowId for active characters
    const characterUpdates = new Map();

    activeWindows.forEach(window => {
      const characterKey = this.generateCharacterKey(window.character, window.dofusClass);
      characterUpdates.set(characterKey, window.id);
    });

    // Update windowId in character shortcuts
    let updatedCount = 0;
    Object.entries(this.config.shortcuts.characters).forEach(([characterKey, shortcutData]) => {
      const newWindowId = characterUpdates.get(characterKey);
      if (newWindowId && newWindowId !== shortcutData.windowId) {
        shortcutData.windowId = newWindowId;
        shortcutData.lastSeen = new Date().toISOString();
        updatedCount++;
      }
    });

    // Mark shortcuts as inactive if they don't have corresponding windows
    Object.entries(this.config.shortcuts.characters).forEach(([characterKey, shortcutData]) => {
      const hasActiveWindow = characterUpdates.has(characterKey);
      if (!hasActiveWindow && !shortcutData.inactive) {
        shortcutData.inactive = true;
        shortcutData.lastInactive = new Date().toISOString();
      } else if (hasActiveWindow && shortcutData.inactive) {
        delete shortcutData.inactive;
        delete shortcutData.lastInactive;
      }
    });

    // Remove very old shortcuts (more than 30 days of inactivity)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    let cleanedCount = 0;

    Object.keys(this.config.shortcuts.characters).forEach(characterKey => {
      const shortcutData = this.config.shortcuts.characters[characterKey];
      if (shortcutData.inactive && shortcutData.lastInactive) {
        const lastInactiveDate = new Date(shortcutData.lastInactive);
        if (lastInactiveDate < thirtyDaysAgo) {
          delete this.config.shortcuts.characters[characterKey];
          cleanedCount++;
        }
      }
    });

    if (updatedCount > 0 || cleanedCount > 0) {
      this.saveConfig();
      console.log(`ShortcutConfigManager: Updated ${updatedCount} character shortcuts, cleaned ${cleanedCount} old entries`);
    }

    return { updated: updatedCount, cleaned: cleanedCount };
  }

  // Export/Import functionality
  exportConfig() {
    return {
      ...this.config,
      exportedAt: new Date().toISOString()
    };
  }

  importConfig(importedConfig) {
    try {
      // Validate imported config
      if (!importedConfig.shortcuts || !importedConfig.version) {
        throw new Error('Invalid config format');
      }

      // Backup current config
      // const _backupConfig = { ...this.config }; // TODO: Implement backup logic

      // Merge imported config
      this.config = {
        ...this.config,
        ...importedConfig,
        shortcuts: {
          ...this.config.shortcuts,
          ...importedConfig.shortcuts,
          characters: {
            ...this.config.shortcuts.characters,
            ...importedConfig.shortcuts?.characters
          },
          global: {
            ...this.config.shortcuts.global,
            ...importedConfig.shortcuts?.global
          },
          autoKey: {
            ...this.config.shortcuts.autoKey,
            ...importedConfig.shortcuts?.autoKey
          }
        },
        priorities: {
          ...this.config.priorities,
          ...importedConfig.priorities
        },
        importedAt: new Date().toISOString()
      };

      this.saveConfig();
      console.log('ShortcutConfigManager: Successfully imported config');
      return true;
    } catch (error) {
      console.error('ShortcutConfigManager: Error importing config:', error);
      return false;
    }
  }

  // Statistics and debugging
  getStatistics() {
    const characterShortcuts = Object.keys(this.config.shortcuts.characters).length;
    const activeShortcuts = Object.values(this.config.shortcuts.characters)
      .filter(s => !s.inactive).length;
    const autoGeneratedShortcuts = Object.values(this.config.shortcuts.characters)
      .filter(s => s.autoGenerated).length;
    const characters = Object.keys(this.config.characters).length;

    return {
      totalCharacterShortcuts: characterShortcuts,
      activeCharacterShortcuts: activeShortcuts,
      inactiveCharacterShortcuts: characterShortcuts - activeShortcuts,
      autoGeneratedShortcuts: autoGeneratedShortcuts,
      manualShortcuts: characterShortcuts - autoGeneratedShortcuts,
      globalShortcuts: Object.keys(this.config.shortcuts.global).length,
      characters: characters,
      autoKeyEnabled: this.config.shortcuts.autoKey.enabled,
      autoKeyPattern: this.config.shortcuts.autoKey.pattern,
      configFile: this.configFile,
      lastUpdated: this.config.lastUpdated
    };
  }

  // Get config file path for debugging
  getConfigFilePath() {
    return this.configFile;
  }
}

module.exports = ShortcutConfigManager;