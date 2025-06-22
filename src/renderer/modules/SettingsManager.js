/**
 * SettingsManager - Handles all settings-related operations and persistence
 */
class SettingsManager {
  constructor(configRenderer) {
    this.configRenderer = configRenderer;
  }

  updateUIFromSettings() {
    const settings = this.configRenderer.getSettings();
    const elements = this.configRenderer.getElements();

    if (!this.configRenderer.settingsLoaded || !settings) return;

    try {
      // Update dock settings
      if (elements.dockEnabled) {
        elements.dockEnabled.checked = settings.dock?.enabled || false;
      }
      if (elements.dockPosition) {
        elements.dockPosition.value = settings.dock?.position || 'SE';
      }

      this.configRenderer.uiManager.updateShortcutsStatus();
      console.log('SettingsManager: UI updated from settings');
    } catch (error) {
      console.error('SettingsManager: Error updating UI from settings:', error);
    }
  }

  async saveSettings(settings) {
    try {
      console.log('SettingsManager: Saving settings:', settings);
      const { ipcRenderer } = require('electron');
      await ipcRenderer.invoke('save-settings', settings);

      // Update local settings
      Object.assign(this.configRenderer.settings, settings);

      console.log('SettingsManager: Settings saved successfully');
      return true;
    } catch (error) {
      console.error('SettingsManager: Error saving settings:', error);
      this.configRenderer.uiManager.showErrorMessage('Failed to save settings');
      return false;
    }
  }

  async updateCharacterName(windowId, newName) {
    try {
      const settings = { [`customNames.${windowId}`]: newName };
      const success = await this.saveSettings(settings);

      if (success) {
        const windows = this.configRenderer.getWindows();
        const window = windows.find(w => w.id === windowId);
        if (window) {
          window.customName = newName;
          this.configRenderer.uiManager.showSuccessMessage('Character name updated');
        }
      }

      return success;
    } catch (error) {
      console.error('SettingsManager: Error updating character name:', error);
      this.configRenderer.uiManager.showErrorMessage('Failed to update character name');
      return false;
    }
  }

  async updateInitiative(windowId, newInitiative) {
    try {
      const initiative = parseInt(newInitiative) || 0;
      const settings = { [`initiatives.${windowId}`]: initiative };
      const success = await this.saveSettings(settings);

      if (success) {
        const windows = this.configRenderer.getWindows();
        const window = windows.find(w => w.id === windowId);
        if (window) {
          window.initiative = initiative;
          this.configRenderer.windowRenderer.renderWindows();

          // CORRIGER: Appeler updatePreview au lieu de onWindowsUpdated
          if (this.configRenderer.autoKeyManager) {
            this.configRenderer.autoKeyManager.updatePreview();
          }

          this.configRenderer.uiManager.showSuccessMessage('Initiative updated');
        }
      }

      return success;
    } catch (error) {
      console.error('SettingsManager: Error updating initiative:', error);
      this.configRenderer.uiManager.showErrorMessage('Failed to update initiative');
      return false;
    }
  }

  async updateDockSettings() {
    try {
      const elements = this.configRenderer.getElements();
      const dockSettings = {
        'dock.enabled': elements.dockEnabled?.checked || false,
        'dock.position': elements.dockPosition?.value || 'SE'
      };

      const success = await this.saveSettings(dockSettings);
      if (success) {
        console.log('SettingsManager: Updated dock settings:', dockSettings);
        this.configRenderer.uiManager.showSuccessMessage('Dock settings updated');
      }

      return success;
    } catch (error) {
      console.error('SettingsManager: Error updating dock settings:', error);
      this.configRenderer.uiManager.showErrorMessage('Failed to update dock settings');
      return false;
    }
  }

  async updateLanguage(languageCode) {
    try {
      const settings = { language: languageCode };
      const success = await this.saveSettings(settings);

      if (success) {
        this.configRenderer.uiManager.showSuccessMessage('Language updated');
      }

      return success;
    } catch (error) {
      console.error('SettingsManager: Error updating language:', error);
      this.configRenderer.uiManager.showErrorMessage('Failed to update language');
      return false;
    }
  }

  async updateClassForWindow(windowId, classKey) {
    try {
      const settings = { [`classes.${windowId}`]: classKey };
      const success = await this.saveSettings(settings);

      if (success) {
        const windows = this.configRenderer.getWindows();
        const window = windows.find(w => w.id === windowId);
        if (window) {
          const dofusClasses = this.configRenderer.getDofusClasses();
          window.dofusClass = classKey;
          window.avatar = dofusClasses[classKey]?.avatar || '1';
          this.configRenderer.windowRenderer.renderWindows();
          this.configRenderer.uiManager.showSuccessMessage('Character class updated');
        }
      }

      return success;
    } catch (error) {
      console.error('SettingsManager: Error updating class:', error);
      this.configRenderer.uiManager.showErrorMessage('Failed to update character class');
      return false;
    }
  }

  async toggleWindowEnabled(windowId) {
    try {
      const windows = this.configRenderer.getWindows();
      const window = windows.find(w => w.id === windowId);

      if (!window) return false;

      const newEnabledState = !window.enabled;
      const settings = { [`enabled.${windowId}`]: newEnabledState };
      const success = await this.saveSettings(settings);

      if (success) {
        window.enabled = newEnabledState;
        this.configRenderer.windowRenderer.renderWindows();
        this.configRenderer.uiManager.showSuccessMessage(
          `Window ${newEnabledState ? 'enabled' : 'disabled'}`
        );
      }

      return success;
    } catch (error) {
      console.error('SettingsManager: Error toggling window enabled state:', error);
      this.configRenderer.uiManager.showErrorMessage('Failed to update window state');
      return false;
    }
  }

  async resetAllSettings() {
    try {
      const { ipcRenderer } = require('electron');
      const success = await ipcRenderer.invoke('reset-all-settings');

      if (success) {
        // Reload the page to refresh with default settings
        window.location.reload();
      } else {
        this.configRenderer.uiManager.showErrorMessage('Failed to reset settings');
      }

      return success;
    } catch (error) {
      console.error('SettingsManager: Error resetting settings:', error);
      this.configRenderer.uiManager.showErrorMessage('Failed to reset settings');
      return false;
    }
  }

  async exportSettings() {
    try {
      const { ipcRenderer } = require('electron');
      const settings = await ipcRenderer.invoke('export-settings');

      if (settings) {
        // Create download link
        const dataStr = JSON.stringify(settings, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `dorganize-settings-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        URL.revokeObjectURL(url);

        this.configRenderer.uiManager.showSuccessMessage('Settings exported successfully');
        return true;
      }

      return false;
    } catch (error) {
      console.error('SettingsManager: Error exporting settings:', error);
      this.configRenderer.uiManager.showErrorMessage('Failed to export settings');
      return false;
    }
  }

  async importSettings(file) {
    try {
      const fileContent = await this.readFile(file);
      const settings = JSON.parse(fileContent);

      const { ipcRenderer } = require('electron');
      const success = await ipcRenderer.invoke('import-settings', settings);

      if (success) {
        this.configRenderer.uiManager.showSuccessMessage('Settings imported successfully');
        // Refresh the page to apply imported settings
        setTimeout(() => window.location.reload(), 1500);
      } else {
        this.configRenderer.uiManager.showErrorMessage('Failed to import settings');
      }

      return success;
    } catch (error) {
      console.error('SettingsManager: Error importing settings:', error);
      this.configRenderer.uiManager.showErrorMessage('Failed to import settings - Invalid file format');
      return false;
    }
  }

  readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file);
    });
  }

  // Validation methods
  validateInitiative(value) {
    const num = parseInt(value);
    return !isNaN(num) && num >= 0 && num <= 9999;
  }

  validateCharacterName(name) {
    return name && name.trim().length > 0 && name.trim().length <= 50;
  }

  validateLanguageCode(code) {
    const validCodes = ['FR', 'EN', 'DE', 'ES', 'IT'];
    return validCodes.includes(code);
  }

  validateDockPosition(position) {
    const validPositions = ['NW', 'NE', 'SW', 'SE', 'N', 'S'];
    return validPositions.includes(position);
  }

  // Getters for current settings
  getCurrentLanguage() {
    return this.configRenderer.getSettings().language || 'FR';
  }

  getDockSettings() {
    return this.configRenderer.getSettings().dock || { enabled: false, position: 'SE' };
  }

  isShortcutsEnabled() {
    return this.configRenderer.getSettings().shortcutsEnabled !== false;
  }

  // Utility methods
  getSettingsForExport() {
    const settings = this.configRenderer.getSettings();
    const windows = this.configRenderer.getWindows();

    return {
      ...settings,
      exportInfo: {
        version: '0.4.1',
        exportDate: new Date().toISOString(),
        windowCount: windows.length,
        charactersIncluded: windows.map(w => ({
          character: w.character,
          class: w.dofusClass,
          initiative: w.initiative
        }))
      }
    };
  }

  hasUnsavedChanges() {
    // This could track if there are pending changes
    // For now, assume all changes are immediately saved
    return false;
  }

  // Backup and restore functionality
  createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupKey = `backup_${timestamp}`;
    const currentSettings = this.configRenderer.getSettings();

    localStorage.setItem(backupKey, JSON.stringify(currentSettings));

    // Keep only last 5 backups
    const backupKeys = Object.keys(localStorage).filter(key => key.startsWith('backup_'));
    if (backupKeys.length > 5) {
      backupKeys.sort();
      localStorage.removeItem(backupKeys[0]);
    }

    return backupKey;
  }

  getAvailableBackups() {
    const backupKeys = Object.keys(localStorage).filter(key => key.startsWith('backup_'));
    return backupKeys.map(key => ({
      key,
      timestamp: key.replace('backup_', '').replace(/-/g, ':'),
      size: localStorage.getItem(key).length
    })).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  async restoreFromBackup(backupKey) {
    try {
      const backupData = localStorage.getItem(backupKey);
      if (!backupData) {
        throw new Error('Backup not found');
      }

      const settings = JSON.parse(backupData);
      const success = await this.saveSettings(settings);

      if (success) {
        this.configRenderer.uiManager.showSuccessMessage('Settings restored from backup');
        setTimeout(() => window.location.reload(), 1500);
      }

      return success;
    } catch (error) {
      console.error('SettingsManager: Error restoring from backup:', error);
      this.configRenderer.uiManager.showErrorMessage('Failed to restore from backup');
      return false;
    }
  }

  // Settings synchronization (for future cloud sync feature)
  async syncSettings() {
    // Placeholder for future cloud synchronization
    console.log('SettingsManager: Sync settings (not implemented)');
    this.configRenderer.uiManager.showInfoMessage('Settings sync is not available yet');
  }

  // Performance optimization
  debounceSave(settings, delay = 1000) {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = setTimeout(() => {
      this.saveSettings(settings);
    }, delay);
  }

  // Settings validation and sanitization
  sanitizeSettings(settings) {
    const sanitized = {};

    Object.keys(settings).forEach(key => {
      const value = settings[key];

      // Sanitize based on key patterns
      if (key.startsWith('customNames.')) {
        sanitized[key] = this.validateCharacterName(value) ? value.trim() : '';
      } else if (key.startsWith('initiatives.')) {
        sanitized[key] = this.validateInitiative(value) ? parseInt(value) : 0;
      } else if (key === 'language') {
        sanitized[key] = this.validateLanguageCode(value) ? value : 'FR';
      } else if (key === 'dock.position') {
        sanitized[key] = this.validateDockPosition(value) ? value : 'SE';
      } else {
        sanitized[key] = value;
      }
    });

    return sanitized;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SettingsManager;
}