const { ipcRenderer } = require('electron');

// Import modules
const AutoKeyManager = require('./modules/AutoKeyManager');
const ShortcutManager = require('./modules/ShortcutManager');
const ModalManager = require('./modules/ModalManager');
const WindowRenderer = require('./modules/WindowRenderer');
const UIManager = require('./modules/UIManager');
const SettingsManager = require('./modules/SettingsManager');
const EventHandler = require('./modules/EventHandler');

class ConfigRenderer {
  constructor() {
    this.windows = [];
    this.language = {};
    this.settings = {};
    this.dofusClasses = {};
    this.settingsLoaded = false;

    this.initializeElements();
    this.initializeManagers();
    this.setupEventListeners();
    this.loadData();
  }

  initializeElements() {
    this.elements = {
      refreshBtn: document.getElementById('refresh-btn'),
      languageBtn: document.getElementById('language-btn'),
      organizeBtn: document.getElementById('organize-btn'),
      globalShortcutsBtn: document.getElementById('global-shortcuts-btn'),
      autoKeyConfigBtn: document.getElementById('auto-key-config-btn'),
      nextWindowBtn: document.getElementById('next-window-btn'),
      toggleShortcutsBtn: document.getElementById('toggle-shortcuts-btn'),
      toggleShortcutsText: document.getElementById('toggle-shortcuts-text'),
      noWindows: document.getElementById('no-windows'),
      windowsList: document.getElementById('windows-list'),
      windowCount: document.getElementById('window-count'),
      dockEnabled: document.getElementById('dock-enabled'),
      dockPosition: document.getElementById('dock-position'),
      shortcutsStatus: document.getElementById('shortcuts-status'),
      shortcutsStatusText: document.getElementById('shortcuts-status-text')
    };
  }

  initializeManagers() {
    // Initialize specialized managers
    this.autoKeyManager = new AutoKeyManager(this);
    this.shortcutManager = new ShortcutManager(this);
    this.modalManager = new ModalManager(this);
    this.windowRenderer = new WindowRenderer(this);
    this.uiManager = new UIManager(this);
    this.settingsManager = new SettingsManager(this);
    this.eventHandler = new EventHandler(this);

    // Make managers globally accessible for onclick handlers
    window.autoKeyManager = this.autoKeyManager;
    window.shortcutManager = this.shortcutManager;
    window.modalManager = this.modalManager;
    window.windowRenderer = this.windowRenderer;
    window.uiManager = this.uiManager;
    window.settingsManager = this.settingsManager;
    window.eventHandler = this.eventHandler;
    window.configRenderer = this;
  }

  setupEventListeners() {
    // Event handling is now managed by EventHandler
    // Keep only critical IPC listeners here for immediate response
    
    // IPC event listeners
    ipcRenderer.on('windows-updated', (event, windows) => {
      this.eventHandler.handleWindowsUpdated(event, windows);
    });

    ipcRenderer.on('language-changed', (event, language) => {
      this.eventHandler.handleLanguageChanged(event, language);
    });

    ipcRenderer.on('settings-updated', (event, updatedSettings) => {
      this.eventHandler.handleSettingsUpdated(event, updatedSettings);
    });
  }

  async loadData() {
    try {
      console.log('Config.js: Loading initial data...');

      const [windows, language, settings, dofusClasses] = await Promise.all([
        ipcRenderer.invoke('get-dofus-windows'),
        ipcRenderer.invoke('get-language'),
        ipcRenderer.invoke('get-settings'),
        ipcRenderer.invoke('get-dofus-classes')
      ]);

      this.windows = windows;
      this.language = language;
      this.settings = settings;
      this.dofusClasses = dofusClasses;
      this.settingsLoaded = true;

      console.log('Config.js: Data loaded successfully');
      console.log('Config.js: Windows:', this.windows.length);

      this.windowRenderer.renderWindows();
      this.uiManager.updateLanguageUI();
      this.settingsManager.updateUIFromSettings();
      this.uiManager.updateShortcutsStatus();

    } catch (error) {
      console.error('Config.js: Error loading data:', error);
    }
  }

  // Window management methods - delegated to WindowRenderer
  async activateWindow(windowId) {
    return this.windowRenderer.activateWindow(windowId);
  }

  async refreshWindows() {
    return this.windowRenderer.refreshWindows();
  }

  async activateNextWindow() {
    try {
      await ipcRenderer.invoke('activate-next-window');
    } catch (error) {
      console.error('Config.js: Error activating next window:', error);
    }
  }

  async toggleShortcuts() {
    try {
      const enabled = await ipcRenderer.invoke('toggle-shortcuts');
      this.uiManager.updateShortcutsStatusText(enabled);
    } catch (error) {
      console.error('Config.js: Error toggling shortcuts:', error);
    }
  }

  // Settings update methods - delegated to SettingsManager
  async updateCharacterName(windowId, newName) {
    return this.settingsManager.updateCharacterName(windowId, newName);
  }

  async updateInitiative(windowId, newInitiative) {
    return this.settingsManager.updateInitiative(windowId, newInitiative);
  }

  // Shortcut management - delegate to ShortcutManager
  showShortcutModal(windowId) {
    const window = this.windows.find(w => w.id === windowId);
    const displayName = window ? (window.customName || window.character) : 'Unknown';
    this.shortcutManager.showModal(windowId, displayName);
  }

  // Getters for managers
  getWindows() {
    return this.windows;
  }

  getLanguage() {
    return this.language;
  }

  getSettings() {
    return this.settings;
  }

  getDofusClasses() {
    return this.dofusClasses;
  }

  getElements() {
    return this.elements;
  }

  // Application state management
  isReady() {
    return this.settingsLoaded && 
           this.autoKeyManager && 
           this.shortcutManager && 
           this.modalManager && 
           this.windowRenderer && 
           this.uiManager && 
           this.settingsManager && 
           this.eventHandler;
  }

  // Performance monitoring
  getPerformanceMetrics() {
    return {
      windowCount: this.windows.length,
      managersLoaded: Object.keys(this).filter(key => key.endsWith('Manager')).length,
      memoryUsage: performance.memory ? {
        used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
        total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024)
      } : null,
      loadTime: performance.now()
    };
  }

  // Cleanup method
  cleanup() {
    console.log('ConfigRenderer: Cleaning up...');
    
    if (this.eventHandler) {
      this.eventHandler.cleanup();
    }
    
    // Clean up other managers if they have cleanup methods
    [this.autoKeyManager, this.shortcutManager, this.modalManager, 
     this.windowRenderer, this.uiManager, this.settingsManager].forEach(manager => {
      if (manager && typeof manager.cleanup === 'function') {
        manager.cleanup();
      }
    });
  }
}

// Global functions for onclick handlers
window.selectAutoKeyPreset = function(preset) {
  window.autoKeyManager?.selectPreset(preset);
};

window.applyAutoKeyConfiguration = function() {
  window.autoKeyManager?.applyConfiguration();
};

window.disableAutoKey = function() {
  window.autoKeyManager?.disableAutoKey();
};

window.closeAutoKeyModal = function() {
  window.autoKeyManager?.closeModal();
};

window.closeShortcutModal = function() {
  window.shortcutManager?.closeModal();
};

window.closeGlobalShortcutsModal = function() {
  window.modalManager?.closeGlobalShortcutsModal();
};

window.setGlobalShortcut = function(type) {
  window.modalManager?.setGlobalShortcut(type);
};

window.removeGlobalShortcut = function(type) {
  window.modalManager?.removeGlobalShortcut(type);
};

window.organizeWindows = function(layout) {
  window.modalManager?.organizeWindows(layout);
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('Config.js: DOM ready, initializing...');
    window.configRenderer = new ConfigRenderer();
  });
} else {
  console.log('Config.js: DOM already ready, initializing...');
  window.configRenderer = new ConfigRenderer();
}

// Cleanup on window unload
window.addEventListener('beforeunload', () => {
  if (window.configRenderer) {
    window.configRenderer.cleanup();
  }
});

// Debug: Make IPC available globally
window.ipc = ipcRenderer;
console.log('Config.js: Refactored file loaded completely');

// Export for testing purposes
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ConfigRenderer;
}