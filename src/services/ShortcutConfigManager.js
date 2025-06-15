const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class ShortcutConfigManager {
  constructor() {
    this.configDir = this.getConfigDirectory();
    this.configFile = path.join(this.configDir, 'shortcuts.json');
    this.config = {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      shortcuts: {
        characters: {}, // Raccourcis par nom de personnage et classe
        global: {
          nextWindow: 'Ctrl+Tab',
          toggleShortcuts: 'Ctrl+Shift+D'
        }
      },
      characters: {} // Profils de personnages
    };

    this.ensureConfigDirectory();
    this.loadConfig();
  }

  getConfigDirectory() {
    // Get the user data directory for the app
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, 'config');
  }

  ensureConfigDirectory() {
    try {
      if (!fs.existsSync(this.configDir)) {
        fs.mkdirSync(this.configDir, { recursive: true });
        console.log('ShortcutConfigManager: Created config directory:', this.configDir);
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
            characters: {
              ...this.config.shortcuts.characters,
              ...loadedConfig.shortcuts?.characters
            },
            global: {
              ...this.config.shortcuts.global,
              ...loadedConfig.shortcuts?.global
            }
          }
        };

        console.log('ShortcutConfigManager: Loaded shortcuts config from file');
        console.log(`ShortcutConfigManager: Found ${Object.keys(this.config.shortcuts.characters).length} character shortcuts`);
        console.log(`ShortcutConfigManager: Found ${Object.keys(this.config.characters).length} character profiles`);
      } else {
        console.log('ShortcutConfigManager: No existing config file, using defaults');
        this.saveConfig();
      }
    } catch (error) {
      console.error('ShortcutConfigManager: Error loading config:', error);
      // Keep default config if loading fails
    }
  }

  saveConfig() {
    try {
      this.config.lastUpdated = new Date().toISOString();

      // Create a backup of the current config
      if (fs.existsSync(this.configFile)) {
        const backupFile = this.configFile + '.backup';
        fs.copyFileSync(this.configFile, backupFile);
      }

      const configData = JSON.stringify(this.config, null, 2);
      fs.writeFileSync(this.configFile, configData, 'utf8');

      console.log('ShortcutConfigManager: Saved shortcuts config to file');
    } catch (error) {
      console.error('ShortcutConfigManager: Error saving config:', error);
    }
  }

  // Génère une clé unique pour un personnage basée sur son nom et sa classe
  generateCharacterKey(character, dofusClass) {
    const normalizedChar = character.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normalizedClass = dofusClass.toLowerCase();
    return `${normalizedChar}_${normalizedClass}`;
  }

  // Window shortcuts management - maintenant basé sur les noms de personnages
  setWindowShortcut(windowId, shortcut, character, dofusClass) {
    if (!windowId || !shortcut || !character) return false;

    try {
      const characterKey = this.generateCharacterKey(character, dofusClass);

      this.config.shortcuts.characters[characterKey] = {
        shortcut: shortcut,
        character: character,
        class: dofusClass,
        windowId: windowId, // Garde une référence à la fenêtre actuelle
        lastUsed: new Date().toISOString(),
        usageCount: (this.config.shortcuts.characters[characterKey]?.usageCount || 0) + 1
      };

      this.saveConfig();
      console.log(`ShortcutConfigManager: Set shortcut ${shortcut} for character ${character} (${dofusClass})`);
      return true;
    } catch (error) {
      console.error('ShortcutConfigManager: Error setting character shortcut:', error);
      return false;
    }
  }

  getWindowShortcut(windowId) {
    // Trouve le raccourci par windowId (pour compatibilité)
    for (const [characterKey, shortcutData] of Object.entries(this.config.shortcuts.characters)) {
      if (shortcutData.windowId === windowId) {
        return shortcutData.shortcut;
      }
    }
    return null;
  }

  getCharacterShortcut(character, dofusClass) {
    const characterKey = this.generateCharacterKey(character, dofusClass);
    return this.config.shortcuts.characters[characterKey]?.shortcut || null;
  }

  removeWindowShortcut(windowId) {
    // Trouve et supprime le raccourci par windowId
    for (const [characterKey, shortcutData] of Object.entries(this.config.shortcuts.characters)) {
      if (shortcutData.windowId === windowId) {
        delete this.config.shortcuts.characters[characterKey];
        this.saveConfig();
        console.log(`ShortcutConfigManager: Removed shortcut for window ${windowId}`);
        return true;
      }
    }
    return false;
  }

  removeCharacterShortcut(character, dofusClass) {
    const characterKey = this.generateCharacterKey(character, dofusClass);
    if (this.config.shortcuts.characters[characterKey]) {
      delete this.config.shortcuts.characters[characterKey];
      this.saveConfig();
      console.log(`ShortcutConfigManager: Removed shortcut for character ${character} (${dofusClass})`);
      return true;
    }
    return false;
  }

  getAllWindowShortcuts() {
    const shortcuts = {};
    Object.values(this.config.shortcuts.characters).forEach(shortcutData => {
      if (shortcutData.windowId) {
        shortcuts[shortcutData.windowId] = shortcutData.shortcut;
      }
    });
    return shortcuts;
  }

  getAllCharacterShortcuts() {
    const shortcuts = {};
    Object.entries(this.config.shortcuts.characters).forEach(([characterKey, shortcutData]) => {
      shortcuts[characterKey] = {
        shortcut: shortcutData.shortcut,
        character: shortcutData.character,
        class: shortcutData.class
      };
    });
    return shortcuts;
  }

  // Méthode pour associer un raccourci existant à une nouvelle fenêtre
  linkShortcutToWindow(character, dofusClass, windowId) {
    const characterKey = this.generateCharacterKey(character, dofusClass);
    const shortcutData = this.config.shortcuts.characters[characterKey];

    if (shortcutData) {
      // Met à jour l'ID de fenêtre pour ce personnage
      shortcutData.windowId = windowId;
      shortcutData.lastSeen = new Date().toISOString();
      this.saveConfig();

      console.log(`ShortcutConfigManager: Linked existing shortcut ${shortcutData.shortcut} to window ${windowId} for ${character}`);
      return shortcutData.shortcut;
    }

    return null;
  }

  // Global shortcuts management
  setGlobalShortcut(type, shortcut) {
    if (!type || !shortcut) return false;

    try {
      this.config.shortcuts.global[type] = shortcut;
      this.saveConfig();
      console.log(`ShortcutConfigManager: Set global shortcut ${shortcut} for ${type}`);
      return true;
    } catch (error) {
      console.error('ShortcutConfigManager: Error setting global shortcut:', error);
      return false;
    }
  }

  getGlobalShortcut(type) {
    return this.config.shortcuts.global[type] || null;
  }

  getAllGlobalShortcuts() {
    return { ...this.config.shortcuts.global };
  }

  removeGlobalShortcut(type) {
    if (this.config.shortcuts.global[type]) {
      delete this.config.shortcuts.global[type];
      this.saveConfig();
      console.log(`ShortcutConfigManager: Removed global shortcut for ${type}`);
      return true;
    }
    return false;
  }

  // Character profile management
  setCharacterProfile(windowId, character, dofusClass) {
    if (!windowId || !character) return false;

    try {
      this.config.characters[windowId] = {
        character: character,
        class: dofusClass || 'feca',
        lastSeen: new Date().toISOString(),
        windowId: windowId
      };

      this.saveConfig();
      console.log(`ShortcutConfigManager: Set character profile for ${character} (${dofusClass})`);
      return true;
    } catch (error) {
      console.error('ShortcutConfigManager: Error setting character profile:', error);
      return false;
    }
  }

  getCharacterProfile(windowId) {
    return this.config.characters[windowId] || null;
  }

  findCharacterByName(characterName, dofusClass) {
    // Trouve un profil de personnage par nom et classe
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
          class: shortcutData.class
        };
      }
    }

    // Check global shortcuts
    for (const [type, globalShortcut] of Object.entries(this.config.shortcuts.global)) {
      if (globalShortcut === shortcut) {
        return { type: 'global', shortcutType: type };
      }
    }

    return null;
  }

  // Migration and cleanup
  migrateFromElectronStore(electronStore) {
    try {
      console.log('ShortcutConfigManager: Starting migration from electron-store...');

      // Migrate window shortcuts - convertir en raccourcis de personnages
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
              lastUsed: new Date().toISOString(),
              usageCount: 1,
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
    // Met à jour les windowId pour les personnages actifs
    const characterUpdates = new Map();

    activeWindows.forEach(window => {
      const characterKey = this.generateCharacterKey(window.character, window.dofusClass);
      characterUpdates.set(characterKey, window.id);
    });

    // Met à jour les windowId dans les raccourcis de personnages
    let updatedCount = 0;
    Object.entries(this.config.shortcuts.characters).forEach(([characterKey, shortcutData]) => {
      const newWindowId = characterUpdates.get(characterKey);
      if (newWindowId && newWindowId !== shortcutData.windowId) {
        shortcutData.windowId = newWindowId;
        shortcutData.lastSeen = new Date().toISOString();
        updatedCount++;
      }
    });

    // Marque les raccourcis comme inactifs s'ils n'ont pas de fenêtre correspondante
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

    // Supprime les raccourcis très anciens (plus de 30 jours d'inactivité)
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
          }
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
    const characters = Object.keys(this.config.characters).length;

    return {
      totalCharacterShortcuts: characterShortcuts,
      activeCharacterShortcuts: activeShortcuts,
      inactiveCharacterShortcuts: characterShortcuts - activeShortcuts,
      globalShortcuts: Object.keys(this.config.shortcuts.global).length,
      characters: characters,
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