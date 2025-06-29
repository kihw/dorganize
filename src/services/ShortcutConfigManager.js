const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { app } = require('electron');
const { logger } = require('../utils/Logger');

/**
 * ShortcutConfigManager - Manages shortcuts configuration with proper Electron paths
 * Uses asynchronous file operations with proper error handling
 */
class ShortcutConfigManager {
  constructor() {
    // Use proper Electron userData path instead of os.homedir()
    this.configDir = this.getConfigDirectory();
    this.configFile = path.join(this.configDir, 'shortcuts.json');
    this.backupDir = path.join(this.configDir, 'backups');

    // Legacy path for migration
    this.legacyConfigFile = path.join(require('os').homedir(), '.dorganize', 'shortcuts.json');

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
      paths: {
        configDir: this.configDir,
        configFile: this.configFile,
        backupDir: this.backupDir
      },
      version: '1.0.0',
      lastUpdated: new Date().toISOString()
    };

    // Initialize config (will call async methods)
    this._initPromise = this.initialize();

    logger.info(`ShortcutConfigManager: Using config directory: ${this.configDir}`);
  }

  /**
   * Wait for initialization to complete
   * Call this before using any config methods if you need to ensure config is loaded
   */
  async waitForInitialization() {
    return await this._initPromise;
  }

  /**
   * Initialize the configuration system asynchronously
   */
  async initialize() {
    try {
      await this.ensureConfigDirectory();
      await this.migrateLegacyConfig();
      await this.loadConfig();
      return true;
    } catch (error) {
      logger.error('ShortcutConfigManager: Initialization failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Get proper Electron configuration directory
   */
  getConfigDirectory() {
    try {
      // Use Electron's userData path which is platform-appropriate
      const userDataPath = app.getPath('userData');
      return path.join(userDataPath, 'config');
    } catch (error) {
      // Fallback for development/testing when app might not be available
      logger.warn('ShortcutConfigManager: app.getPath not available, using fallback');
      const os = require('os');
      return path.join(os.homedir(), '.dorganize');
    }
  }

  /**
   * Ensure configuration directory exists with proper permissions
   */
  async ensureConfigDirectory() {
    try {
      // Create main config directory
      await fs.mkdir(this.configDir, { recursive: true, mode: 0o755 });
      logger.debug(`ShortcutConfigManager: Ensured config directory: ${this.configDir}`);

      // Create backup directory
      await fs.mkdir(this.backupDir, { recursive: true, mode: 0o755 });
      logger.debug(`ShortcutConfigManager: Ensured backup directory: ${this.backupDir}`);

      // Verify write permissions
      await this.verifyDirectoryPermissions();

    } catch (error) {
      logger.error('ShortcutConfigManager: Error creating config directory', { error: error.message });
      throw new Error(`Failed to create configuration directory: ${error.message}`);
    }
  }

  /**
   * Verify directory permissions
   */
  async verifyDirectoryPermissions() {
    try {
      // Test write permission by creating a temp file
      const testFile = path.join(this.configDir, '.write-test');
      await fs.writeFile(testFile, 'test');
      await fs.unlink(testFile);

      logger.debug('ShortcutConfigManager: Directory permissions verified');
    } catch (error) {
      logger.error('ShortcutConfigManager: Directory permissions verification failed', { error: error.message });
      throw new Error(`Configuration directory is not writable: ${this.configDir}`);
    }
  }

  /**
   * Migrate configuration from legacy location
   */
  async migrateLegacyConfig() {
    try {
      let legacyExists = false;
      let newExists = false;

      try {
        await fs.access(this.legacyConfigFile);
        legacyExists = true;
      } catch (err) {
        // Legacy file doesn't exist, which is fine
      }

      try {
        await fs.access(this.configFile);
        newExists = true;
      } catch (err) {
        // New config doesn't exist, which is fine if we're migrating
      }

      // Check if legacy config exists and new config doesn't
      if (legacyExists && !newExists) {
        logger.info('ShortcutConfigManager: Migrating configuration from legacy location...');

        // Read legacy config
        const legacyData = await fs.readFile(this.legacyConfigFile, 'utf8');
        const legacyConfig = JSON.parse(legacyData);

        // Create backup of legacy config
        const legacyBackupFile = path.join(this.backupDir, `legacy-migration-${Date.now()}.json`);
        await fs.writeFile(legacyBackupFile, legacyData, 'utf8');

        // Update config with migration info
        legacyConfig.migration = {
          from: this.legacyConfigFile,
          to: this.configFile,
          migratedAt: new Date().toISOString(),
          backupLocation: legacyBackupFile
        };

        // Write to new location
        await fs.writeFile(this.configFile, JSON.stringify(legacyConfig, null, 2), 'utf8');

        logger.info(`ShortcutConfigManager: Successfully migrated config from ${this.legacyConfigFile} to ${this.configFile}`);
        logger.info(`ShortcutConfigManager: Legacy config backed up to ${legacyBackupFile}`);

        // Optionally remove legacy config after successful migration
        await this.cleanupLegacyConfig();

      } else if (legacyExists && newExists) {
        logger.info('ShortcutConfigManager: Both legacy and new config exist, keeping new config');
        await this.archiveLegacyConfig();
      }

    } catch (error) {
      logger.error('ShortcutConfigManager: Error during legacy config migration', { error: error.message });
      // Don't throw here as this shouldn't prevent startup
    }
  }

  /**
   * Archive legacy config file
   */
  async archiveLegacyConfig() {
    try {
      const archiveFile = path.join(this.backupDir, `legacy-archive-${Date.now()}.json`);
      await fs.copyFile(this.legacyConfigFile, archiveFile);
      logger.info(`ShortcutConfigManager: Archived legacy config to ${archiveFile}`);
    } catch (error) {
      logger.warn('ShortcutConfigManager: Failed to archive legacy config', { error: error.message });
    }
  }

  /**
   * Clean up legacy config after migration
   */
  async cleanupLegacyConfig() {
    try {
      // Create a final backup before deletion
      const finalBackupFile = path.join(this.backupDir, `legacy-final-backup-${Date.now()}.json`);
      await fs.copyFile(this.legacyConfigFile, finalBackupFile);

      // Remove legacy config file
      await fs.unlink(this.legacyConfigFile);

      // Try to remove legacy directory if empty
      const legacyDir = path.dirname(this.legacyConfigFile);
      try {
        await fs.rmdir(legacyDir);
        logger.info(`ShortcutConfigManager: Removed empty legacy directory: ${legacyDir}`);
      } catch (error) {
        // Directory not empty or other error - ignore
      }

      logger.info('ShortcutConfigManager: Legacy config cleanup completed');

    } catch (error) {
      logger.warn('ShortcutConfigManager: Error during legacy config cleanup', { error: error.message });
    }
  }

  /**
   * Load configuration from file
   */
  async loadConfig() {
    try {
      let fileExists = false;
      try {
        await fs.access(this.configFile);
        fileExists = true;
      } catch (err) {
        // File doesn't exist, we'll create it
      }

      if (fileExists) {
        const data = await fs.readFile(this.configFile, 'utf8');
        const loadedConfig = JSON.parse(data);

        // Validate config structure
        this.validateConfigStructure(loadedConfig);

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
          characters: loadedConfig.characters || {},
          paths: {
            ...this.config.paths,
            ...loadedConfig.paths
          }
        };

        // Update paths in config to current values
        this.config.paths.configDir = this.configDir;
        this.config.paths.configFile = this.configFile;
        this.config.paths.backupDir = this.backupDir;

        logger.info('ShortcutConfigManager: Config loaded successfully');
        logger.debug('ShortcutConfigManager: Config file location', { path: this.configFile });

      } else {
        logger.info('ShortcutConfigManager: No existing config found, creating default config');
        await this.saveConfig();
      }
    } catch (error) {
      logger.error('ShortcutConfigManager: Error loading config', { error: error.message });
      logger.info('ShortcutConfigManager: Using default configuration');

      // Create backup of corrupted config if it exists
      await this.backupCorruptedConfig();
    }
  }

  /**
   * Validate configuration structure
   */
  validateConfigStructure(config) {
    const requiredPaths = ['shortcuts', 'characters', 'priorities'];
    const requiredShortcutPaths = ['global', 'characters', 'autoKey'];

    for (const path of requiredPaths) {
      if (!config[path]) {
        throw new Error(`Invalid config: missing ${path} section`);
      }
    }

    for (const path of requiredShortcutPaths) {
      if (!config.shortcuts[path]) {
        throw new Error(`Invalid config: missing shortcuts.${path} section`);
      }
    }
  }

  /**
   * Backup corrupted configuration file
   */
  async backupCorruptedConfig() {
    try {
      try {
        await fs.access(this.configFile);

        const corruptedBackupFile = path.join(this.backupDir, `corrupted-${Date.now()}.json`);
        await fs.copyFile(this.configFile, corruptedBackupFile);
        logger.info(`ShortcutConfigManager: Backed up corrupted config to ${corruptedBackupFile}`);
      } catch (err) {
        // File doesn't exist, nothing to backup
      }
    } catch (error) {
      logger.error('ShortcutConfigManager: Failed to backup corrupted config', { error: error.message });
    }
  }

  /**
   * Save configuration to file with atomic write
   */
  async saveConfig() {
    try {
      this.config.lastUpdated = new Date().toISOString();

      // Create backup before saving
      await this.createAutomaticBackup();

      const configData = JSON.stringify(this.config, null, 2);

      // Atomic write using temporary file
      const tempFile = this.configFile + '.tmp';
      await fs.writeFile(tempFile, configData, 'utf8');

      // Atomic rename
      await fs.rename(tempFile, this.configFile);

      logger.info('ShortcutConfigManager: Config saved successfully');
      return true;
    } catch (error) {
      logger.error('ShortcutConfigManager: Error saving config', { error: error.message });

      // Clean up temp file if it exists
      try {
        const tempFile = this.configFile + '.tmp';
        try {
          await fs.access(tempFile);
          await fs.unlink(tempFile);
        } catch (err) {
          // Temp file doesn't exist, which is fine
        }
      } catch (cleanupError) {
        logger.error('ShortcutConfigManager: Error cleaning up temp file', { error: cleanupError.message });
      }

      return false;
    }
  }

  /**
   * Create automatic backup of current config
   */
  async createAutomaticBackup() {
    try {
      try {
        await fs.access(this.configFile);

        const backupFile = path.join(this.backupDir, `auto-backup-${Date.now()}.json`);
        await fs.copyFile(this.configFile, backupFile);

        // Keep only last 10 automatic backups
        await this.cleanupOldBackups();
      } catch (err) {
        // File doesn't exist, nothing to backup
        logger.debug('ShortcutConfigManager: No existing config to backup');
      }
    } catch (error) {
      logger.warn('ShortcutConfigManager: Failed to create automatic backup', { error: error.message });
    }
  }

  /**
   * Clean up old backup files
   */
  async cleanupOldBackups() {
    try {
      const files = await fs.readdir(this.backupDir);

      const backupFiles = await Promise.all(
        files
          .filter(file => file.startsWith('auto-backup-') && file.endsWith('.json'))
          .map(async (file) => {
            const filePath = path.join(this.backupDir, file);
            const stats = await fs.stat(filePath);
            return {
              name: file,
              path: filePath,
              mtime: stats.mtime
            };
          })
      );

      // Sort by modification time (newest first)
      backupFiles.sort((a, b) => b.mtime - a.mtime);

      // Keep only the 10 most recent backups
      const backupsToDelete = backupFiles.slice(10);

      for (const backup of backupsToDelete) {
        await fs.unlink(backup.path);
      }

      if (backupsToDelete.length > 0) {
        logger.info(`ShortcutConfigManager: Cleaned up ${backupsToDelete.length} old backup files`);
      }

    } catch (error) {
      logger.warn('ShortcutConfigManager: Error cleaning up old backups', { error: error.message });
    }
  }

  /**
   * Get available backup files
   */
  async getAvailableBackups() {
    try {
      try {
        await fs.access(this.backupDir);
      } catch (err) {
        // Backup directory doesn't exist
        return [];
      }

      const files = await fs.readdir(this.backupDir);

      const backups = await Promise.all(
        files
          .filter(file => file.endsWith('.json'))
          .map(async (file) => {
            const filePath = path.join(this.backupDir, file);
            const stats = await fs.stat(filePath);
            return {
              filename: file,
              path: filePath,
              size: stats.size,
              created: stats.birthtime,
              modified: stats.mtime
            };
          })
      );

      // Sort by modification time (newest first)
      return backups.sort((a, b) => b.modified - a.modified);

    } catch (error) {
      logger.error('ShortcutConfigManager: Error getting available backups', { error: error.message });
      return [];
    }
  }

  /**
   * Restore configuration from backup file
   */
  async restoreFromBackup(backupPath) {
    try {
      // Validate backup path
      if (!backupPath.startsWith(this.backupDir)) {
        throw new Error('Invalid backup path: must be in backup directory');
      }

      // Check if backup file exists
      await fs.access(backupPath);

      // Backup current config before restore
      const preRestoreBackup = path.join(this.backupDir, `pre-restore-${Date.now()}.json`);
      try {
        await fs.access(this.configFile);
        await fs.copyFile(this.configFile, preRestoreBackup);
        logger.info(`ShortcutConfigManager: Created pre-restore backup at ${preRestoreBackup}`);
      } catch (err) {
        // Current config doesn't exist, which is fine
      }

      // Read backup file
      const backupData = await fs.readFile(backupPath, 'utf8');
      const backupConfig = JSON.parse(backupData);

      // Validate backup structure
      this.validateConfigStructure(backupConfig);

      // Copy backup to config file using atomic write
      const tempFile = this.configFile + '.tmp';
      await fs.writeFile(tempFile, backupData, 'utf8');
      await fs.rename(tempFile, this.configFile);

      // Reload config
      await this.loadConfig();

      logger.info(`ShortcutConfigManager: Successfully restored config from backup: ${path.basename(backupPath)}`);
      return true;
    } catch (error) {
      logger.error('ShortcutConfigManager: Failed to restore from backup', { error: error.message });
      return false;
    }
  }

  /**
   * Get the current configuration
   */
  getConfig() {
    return this.config;
  }

  /**
   * Update part of the configuration and save
   * @param {string} path - Dot notation path to the config property
   * @param {any} value - New value
   */
  async updateConfig(path, value) {
    try {
      // Set nested property using path notation
      const parts = path.split('.');
      let current = this.config;

      // Navigate to the property location
      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) {
          current[parts[i]] = {};
        }
        current = current[parts[i]];
      }

      // Update the property
      current[parts[parts.length - 1]] = value;

      // Save the config
      const success = await this.saveConfig();
      return success;
    } catch (error) {
      logger.error('ShortcutConfigManager: Error updating config', { path, error: error.message });
      return false;
    }
  }

  /**
   * Synchronous methods for backward compatibility
   * These should be used only when absolutely necessary
   */

  getConfigSync() {
    return this.config;
  }

  /**
   * Save configuration to file synchronously
   * @deprecated Use saveConfig() async method instead
   * @returns {boolean} success
   */
  saveConfigSync() {
    logger.warn('ShortcutConfigManager: saveConfigSync is deprecated, use saveConfig() instead');

    // Create a promise and immediately wait for it (still blocking)
    try {
      return new Promise(resolve => {
        // Use the async version internally
        this.saveConfig()
          .then(success => resolve(success))
          .catch(error => {
            logger.error('ShortcutConfigManager: Error in saveConfigSync', { error: error.message });
            resolve(false);
          });
      });
    } catch (error) {
      logger.error('ShortcutConfigManager: Critical error in saveConfigSync', { error: error.message });
      return false;
    }
  }

  /**
   * Update configuration value synchronously
   * @deprecated Use updateConfig() async method instead
   * @param {string} path - Dot notation path to config property
   * @param {any} value - New value
   */
  updateConfigSync(path, value) {
    logger.warn('ShortcutConfigManager: updateConfigSync is deprecated, use updateConfig() instead');

    try {
      // Set nested property using path notation
      const parts = path.split('.');
      let current = this.config;

      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) {
          current[parts[i]] = {};
        }
        current = current[parts[i]];
      }

      current[parts[parts.length - 1]] = value;

      // Use the async version internally but wait synchronously
      return new Promise(resolve => {
        this.saveConfig()
          .then(success => resolve(success))
          .catch(error => {
            logger.error('ShortcutConfigManager: Error in updateConfigSync', { error: error.message });
            resolve(false);
          });
      });
    } catch (error) {
      logger.error('ShortcutConfigManager: Error updating config (sync)', { path, error: error.message });
      return false;
    }
  }

  /**
   * Safe async check if file exists
   * @param {string} filePath - Path to check
   * @returns {Promise<boolean>} true if file exists
   */
  async fileExists(filePath) {
    try {
      await fs.access(filePath, fsSync.constants.F_OK);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Safe async file deletion with error handling
   * @param {string} filePath - Path to file to delete
   * @returns {Promise<boolean>} true if successful
   */
  async safeDelete(filePath) {
    try {
      if (await this.fileExists(filePath)) {
        await fs.unlink(filePath);
      }
      return true;
    } catch (error) {
      logger.warn('ShortcutConfigManager: Failed to delete file', { path: filePath, error: error.message });
      return false;
    }
  }
}

module.exports = ShortcutConfigManager;
