const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const os = require('os');

// Mock Electron - this is defined in setup.js with app.getPath
jest.mock('electron');

// Mock Logger
jest.mock('../src/utils/Logger', () => ({
    logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
}));

const ShortcutConfigManager = require('../src/services/ShortcutConfigManager');

describe('ShortcutConfigManager', () => {
    let configManager;
    let testConfigDir;
    let testBackupDir;
    let testConfigFile;

    beforeEach(async () => {
        // Create test directories in the mock path
        testConfigDir = path.join('mock-user-data-path', 'config');
        testBackupDir = path.join(testConfigDir, 'backups');
        testConfigFile = path.join(testConfigDir, 'shortcuts.json');

        // Clean up any existing test files
        try {
            // Check if directory exists
            try {
                await fs.access(testConfigDir);

                // Clean up the directory - list files asynchronously
                const files = await fs.readdir(testConfigDir);
                for (const file of files) {
                    if (file === 'backups') continue;
                    await fs.unlink(path.join(testConfigDir, file)).catch(() => { });
                }

                // Check for backups directory
                try {
                    await fs.access(testBackupDir);
                    const backups = await fs.readdir(testBackupDir);
                    for (const file of backups) {
                        await fs.unlink(path.join(testBackupDir, file)).catch(() => { });
                    }
                } catch (err) {
                    // Backups directory doesn't exist, which is fine
                }
            } catch (err) {
                // testConfigDir doesn't exist, which is fine
            }
        } catch (error) {
            console.log('Test cleanup error:', error);
        }

        // Create fresh config manager
        configManager = new ShortcutConfigManager();

        // Wait for initialization
        await configManager.waitForInitialization();
    });

    afterAll(async () => {
        // Final cleanup
        try {
            // Clean up the test directory recursively
            if (fsSync.existsSync(testBackupDir)) {
                const backups = fsSync.readdirSync(testBackupDir);
                for (const file of backups) {
                    fsSync.unlinkSync(path.join(testBackupDir, file));
                }
                fsSync.rmdirSync(testBackupDir);
            }

            if (fsSync.existsSync(testConfigDir)) {
                const files = fsSync.readdirSync(testConfigDir);
                for (const file of files) {
                    const filePath = path.join(testConfigDir, file);
                    if (fsSync.lstatSync(filePath).isDirectory()) {
                        continue; // Skip directories, should be removed already
                    }
                    fsSync.unlinkSync(filePath);
                }
                fsSync.rmdirSync(testConfigDir);
            }

            const parentDir = path.dirname(testConfigDir);
            if (fsSync.existsSync(parentDir)) {
                fsSync.rmdirSync(parentDir);
            }
        } catch (error) {
            console.log('Test final cleanup error:', error);
        }
    });

    test('should initialize with correct paths', async () => {
        expect(configManager.configDir).toBe(testConfigDir);
        expect(configManager.configFile).toBe(testConfigFile);
        expect(configManager.backupDir).toBe(testBackupDir);
    });

    test('should create necessary directories', async () => {
        expect(fsSync.existsSync(testConfigDir)).toBe(true);
        expect(fsSync.existsSync(testBackupDir)).toBe(true);
    });

    test('should create default config file on initialization', async () => {
        expect(fsSync.existsSync(testConfigFile)).toBe(true);

        const data = await fs.readFile(testConfigFile, 'utf8');
        const config = JSON.parse(data);

        expect(config).toHaveProperty('shortcuts');
        expect(config.shortcuts).toHaveProperty('global');
        expect(config.shortcuts).toHaveProperty('characters');
        expect(config.shortcuts).toHaveProperty('autoKey');
    });

    test('should save config changes asynchronously', async () => {
        // Make changes
        configManager.config.shortcuts.global['Ctrl+A'] = 'test-action';

        // Save async
        const success = await configManager.saveConfig();
        expect(success).toBe(true);

        // Verify changes were saved
        const data = await fs.readFile(testConfigFile, 'utf8');
        const savedConfig = JSON.parse(data);

        expect(savedConfig.shortcuts.global['Ctrl+A']).toBe('test-action');
    });

    test('should load saved config correctly', async () => {
        // Make changes and save
        configManager.config.shortcuts.global['Ctrl+B'] = 'test-action-b';
        await configManager.saveConfig();

        // Create new config manager to load from file
        const newConfigManager = new ShortcutConfigManager();
        await newConfigManager.waitForInitialization();

        expect(newConfigManager.config.shortcuts.global['Ctrl+B']).toBe('test-action-b');
    });

    test('should create backup when saving config', async () => {
        // Save with changes to trigger backup
        configManager.config.shortcuts.global['Ctrl+C'] = 'test-action-c';
        await configManager.saveConfig();

        // Should have created backup
        const backups = await configManager.getAvailableBackups();
        expect(backups.length).toBeGreaterThan(0);

        // Backup should contain previous version
        const latestBackup = backups[0];
        const backupData = await fs.readFile(latestBackup.path, 'utf8');
        const backupConfig = JSON.parse(backupData);

        // The backup should NOT have the latest change since it was made before saving
        expect(backupConfig.shortcuts.global['Ctrl+C']).toBeUndefined();
    });

    test('should update config partially with updateConfig', async () => {
        const success = await configManager.updateConfig('shortcuts.autoKey.enabled', true);
        expect(success).toBe(true);

        // Check in-memory config
        expect(configManager.config.shortcuts.autoKey.enabled).toBe(true);

        // Check saved config
        const data = await fs.readFile(testConfigFile, 'utf8');
        const savedConfig = JSON.parse(data);
        expect(savedConfig.shortcuts.autoKey.enabled).toBe(true);
    });

    test('should update nested config paths', async () => {
        await configManager.updateConfig('shortcuts.characters.Character1', {
            name: 'Character1',
            shortcut: 'F1',
            enabled: true
        });

        // Check in-memory
        expect(configManager.config.shortcuts.characters.Character1).toHaveProperty('name', 'Character1');
        expect(configManager.config.shortcuts.characters.Character1).toHaveProperty('shortcut', 'F1');

        // Check saved config
        const data = await fs.readFile(testConfigFile, 'utf8');
        const savedConfig = JSON.parse(data);
        expect(savedConfig.shortcuts.characters.Character1).toHaveProperty('name', 'Character1');
    });

    test('should handle errors gracefully when saving to invalid location', async () => {
        // Force an error by setting config file to invalid location
        configManager.configFile = path.join('/invalid/path/that/does/not/exist', 'shortcuts.json');

        const success = await configManager.saveConfig();
        expect(success).toBe(false);
    });

    test('should validate config structure', async () => {
        // Attempt to load invalid config
        const invalidConfig = {
            // Missing required sections
            version: '1.0.0'
        };

        expect(() => {
            configManager.validateConfigStructure(invalidConfig);
        }).toThrow('Invalid config: missing shortcuts section');
    });

    test('should restore from backup successfully', async () => {
        // Create original state
        await configManager.updateConfig('shortcuts.global.Ctrl+D', 'original-action');
        await configManager.saveConfig();

        // Get backup info
        const backups = await configManager.getAvailableBackups();
        const originalBackupPath = backups[0].path;

        // Make changes
        await configManager.updateConfig('shortcuts.global.Ctrl+D', 'modified-action');
        await configManager.saveConfig();

        // Confirm change was saved
        let data = await fs.readFile(testConfigFile, 'utf8');
        let currentConfig = JSON.parse(data);
        expect(currentConfig.shortcuts.global['Ctrl+D']).toBe('modified-action');

        // Restore from backup
        const restoreSuccess = await configManager.restoreFromBackup(originalBackupPath);
        expect(restoreSuccess).toBe(true);

        // Verify restore worked
        data = await fs.readFile(testConfigFile, 'utf8');
        currentConfig = JSON.parse(data);
        expect(currentConfig.shortcuts.global['Ctrl+D']).toBe('original-action');
    });

    test('should handle excessive backups cleanup', async () => {
        // Create multiple backups
        for (let i = 0; i < 15; i++) {
            await configManager.updateConfig('test.value', i);
            await configManager.saveConfig();
        }

        // Should have cleaned up and kept only 10
        const backups = await configManager.getAvailableBackups();
        const autoBackups = backups.filter(b => b.filename.startsWith('auto-backup-'));
        expect(autoBackups.length).toBeLessThanOrEqual(10);
    }); test('should provide backward compatible sync methods', async () => {
        // Test sync getter
        const configSync = configManager.getConfigSync();
        expect(configSync).toBe(configManager.config);

        // Test sync update
        const success = await configManager.updateConfigSync('shortcuts.global.Ctrl+S', 'sync-action');
        expect(success).toBe(true);

        // Verify change was saved
        const data = await fs.readFile(testConfigFile, 'utf8');
        const savedConfig = JSON.parse(data);
        expect(savedConfig.shortcuts.global['Ctrl+S']).toBe('sync-action');
    });

    test('should use async methods for file operations', async () => {
        // Test async update
        const success = await configManager.updateConfig('shortcuts.global.Ctrl+A', 'async-action');
        expect(success).toBe(true);

        // Verify change was saved
        const data = await fs.readFile(testConfigFile, 'utf8');
        const savedConfig = JSON.parse(data);
        expect(savedConfig.shortcuts.global['Ctrl+A']).toBe('async-action');

        // Test file existence helper
        expect(await configManager.fileExists(testConfigFile)).toBe(true);
        expect(await configManager.fileExists(testConfigFile + '.nonexistent')).toBe(false);
    });
});
