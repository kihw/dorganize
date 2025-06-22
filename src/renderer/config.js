const { ipcRenderer } = require('electron');

// Import modules - Vérifier que tous les chemins sont corrects
const AutoKeyManager = require('./modules/AutoKeyManager');
const ShortcutManager = require('./modules/ShortcutManager');
const ModalManager = require('./modules/ModalManager');
const WindowRenderer = require('./modules/WindowRenderer');
const UIManager = require('./modules/UIManager');
const SettingsManager = require('./modules/SettingsManager');
const EventHandler = require('./modules/EventHandler');

class ConfigRenderer {
  constructor() {
    console.log('ConfigRenderer: Starting initialization...');

    this.windows = [];
    this.language = {};
    this.settings = {};
    this.dofusClasses = {};
    this.elements = {};
    this.settingsLoaded = false;

    this.initializeElements();
    this.initializeManagers();
    this.setupEventListeners();
    this.loadInitialData();
  }

  async loadInitialData() {
    try {
      console.log('ConfigRenderer: Loading initial data...');

      // Load data in parallel
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

      console.log('ConfigRenderer: Initial data loaded successfully');
      console.log('ConfigRenderer: Windows:', this.windows.length);
      console.log('ConfigRenderer: Windows data:', this.windows);

      // Render initial state
      this.windowRenderer.renderWindows();

      // Trigger refresh in backend to ensure sync
      await ipcRenderer.invoke('refresh-windows');

    } catch (error) {
      console.error('ConfigRenderer: Error loading initial data:', error);
    }
  }

  async refreshWindows() {
    try {
      console.log('ConfigRenderer: Refreshing windows...');

      // Obtenir les fenêtres du backend
      this.windows = await ipcRenderer.invoke('get-dofus-windows');

      console.log('ConfigRenderer: Received', this.windows.length, 'windows from backend');
      console.log('ConfigRenderer: Windows data:', this.windows);

      // Mettre à jour l'UI immédiatement
      this.windowRenderer.renderWindows();

      // Déclencher un refresh dans le backend
      await ipcRenderer.invoke('refresh-windows');

      // Mettre à jour le compteur de fenêtres
      if (this.uiManager) {
        this.uiManager.updateWindowCount();
      }

      // Mettre à jour l'aperçu AutoKey si activé
      if (this.autoKeyManager) {
        this.autoKeyManager.updatePreview();
      }

      return this.windows;
    } catch (error) {
      console.error('ConfigRenderer: Error refreshing windows:', error);
      this.windows = [];
      this.windowRenderer.renderWindows();

      if (this.uiManager) {
        this.uiManager.showErrorMessage('Failed to refresh windows');
      }

      return [];
    }
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
    try {
      console.log('ConfigRenderer: Initializing managers...');

      // Initialize specialized managers with error handling
      this.autoKeyManager = new AutoKeyManager(this);
      console.log('ConfigRenderer: AutoKeyManager initialized');

      this.shortcutManager = new ShortcutManager(this);
      console.log('ConfigRenderer: ShortcutManager initialized');

      this.modalManager = new ModalManager(this);
      console.log('ConfigRenderer: ModalManager initialized');

      this.windowRenderer = new WindowRenderer(this);
      console.log('ConfigRenderer: WindowRenderer initialized');

      this.uiManager = new UIManager(this);
      console.log('ConfigRenderer: UIManager initialized');

      this.settingsManager = new SettingsManager(this);
      console.log('ConfigRenderer: SettingsManager initialized');

      this.eventHandler = new EventHandler(this);
      console.log('ConfigRenderer: EventHandler initialized');

      // Make managers globally accessible for onclick handlers
      window.autoKeyManager = this.autoKeyManager;
      window.shortcutManager = this.shortcutManager;
      window.modalManager = this.modalManager;
      window.windowRenderer = this.windowRenderer;
      window.uiManager = this.uiManager;
      window.settingsManager = this.settingsManager;
      window.eventHandler = this.eventHandler;
      window.configRenderer = this;

      console.log('ConfigRenderer: All managers initialized successfully');
    } catch (error) {
      console.error('ConfigRenderer: Error initializing managers:', error);
      throw error;
    }
  }

  setupEventListeners() {
    console.log('ConfigRenderer: Setting up event listeners...');

    const { ipcRenderer } = require('electron');

    // Listen for windows updates from backend
    ipcRenderer.on('windows-updated', (event, windows) => {
      console.log('ConfigRenderer: Received windows-updated event with', windows.length, 'windows');
      this.windows = windows;
      this.windowRenderer.renderWindows();
    });

    // Listen for language changes
    ipcRenderer.on('language-changed', (event, language) => {
      console.log('ConfigRenderer: Received language-changed event');
      this.language = language;
      this.updateUILanguage();
    });

    // Listen for settings updates
    ipcRenderer.on('settings-updated', (event, settings) => {
      console.log('ConfigRenderer: Received settings-updated event');
      this.settings = settings;
      this.updateUISettings();
    });
  }

  // Window management methods - delegated to WindowRenderer
  async activateWindow(windowId) {
    try {
      console.log('ConfigRenderer: Activating window:', windowId);
      const result = await ipcRenderer.invoke('activate-window', windowId);
      return result;
    } catch (error) {
      console.error('ConfigRenderer: Error activating window:', error);
      return false;
    }
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

  // Ajouter ces méthodes manquantes
  async applyAutoKeyConfiguration() {
    if (this.autoKeyManager) {
      return await this.autoKeyManager.applyConfiguration();
    } else {
      console.error('ConfigRenderer: AutoKeyManager not available');
      return false;
    }
  }

  async disableAutoKey() {
    if (this.autoKeyManager) {
      return await this.autoKeyManager.disableAutoKey();
    } else {
      console.error('ConfigRenderer: AutoKeyManager not available');
      return false;
    }
  }

  closeAutoKeyModal() {
    if (this.autoKeyManager) {
      this.autoKeyManager.closeModal();
    } else {
      console.error('ConfigRenderer: AutoKeyManager not available');
    }
  }

  selectAutoKeyPreset(preset) {
    if (this.autoKeyManager) {
      this.autoKeyManager.selectPreset(preset);
    } else {
      console.error('ConfigRenderer: AutoKeyManager not available');
    }
  }

  // Ajouter ces méthodes manquantes pour l'UI
  async loadLanguage() {
    try {
      this.language = await ipcRenderer.invoke('get-language');
      console.log('ConfigRenderer: Language loaded');
    } catch (error) {
      console.error('ConfigRenderer: Error loading language:', error);
    }
  }

  async loadSettings() {
    try {
      this.settings = await ipcRenderer.invoke('get-settings');
      console.log('ConfigRenderer: Settings loaded');
    } catch (error) {
      console.error('ConfigRenderer: Error loading settings:', error);
    }
  }

  async loadDofusClasses() {
    try {
      this.dofusClasses = await ipcRenderer.invoke('get-dofus-classes');
      console.log('ConfigRenderer: Dofus classes loaded');
    } catch (error) {
      console.error('ConfigRenderer: Error loading dofus classes:', error);
    }
  }

  updateUILanguage() {
    if (this.uiManager) {
      this.uiManager.updateLanguageUI();
    }
  }

  updateUISettings() {
    if (this.settingsManager) {
      this.settingsManager.updateUIFromSettings();
    }
    if (this.uiManager) {
      this.uiManager.updateShortcutsStatus();
    }
  }
}

// Global functions for onclick handlers
window.selectAutoKeyPreset = function (preset) {
  if (window.configRenderer) {
    window.configRenderer.selectAutoKeyPreset(preset);
  } else if (window.autoKeyManager) {
    window.autoKeyManager.selectPreset(preset);
  } else {
    console.error('AutoKeyManager not available');
  }
};

window.applyAutoKeyConfiguration = function () {
  if (window.configRenderer) {
    window.configRenderer.applyAutoKeyConfiguration();
  } else if (window.autoKeyManager) {
    window.autoKeyManager.applyConfiguration();
  } else {
    console.error('AutoKeyManager not available');
  }
};

window.disableAutoKey = function () {
  if (window.configRenderer) {
    window.configRenderer.disableAutoKey();
  } else if (window.autoKeyManager) {
    window.autoKeyManager.disableAutoKey();
  } else {
    console.error('AutoKeyManager not available');
  }
};

window.closeAutoKeyModal = function () {
  if (window.configRenderer) {
    window.configRenderer.closeAutoKeyModal();
  } else if (window.autoKeyManager) {
    window.autoKeyManager.closeModal();
  } else {
    console.error('AutoKeyManager not available');
  }
};

window.closeShortcutModal = function () {
  window.shortcutManager?.closeModal();
};

window.closeGlobalShortcutsModal = function () {
  window.modalManager?.closeGlobalShortcutsModal();
};

window.setGlobalShortcut = function (type) {
  window.modalManager?.setGlobalShortcut(type);
};

window.removeGlobalShortcut = function (type) {
  window.modalManager?.removeGlobalShortcut(type);
};

window.organizeWindows = function (layout) {
  window.modalManager?.organizeWindows(layout);
};

// Ajouter ces fonctions globales à la fin du fichier

window.minimizeToTray = function () {
  console.log('Config: Minimizing to tray...');
  const { ipcRenderer } = require('electron');
  ipcRenderer.invoke('minimize-to-tray');
};

window.closeWindow = function () {
  console.log('Config: Closing window...');
  const { ipcRenderer } = require('electron');
  ipcRenderer.invoke('close-config-window');
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('Config.js: DOM ready, initializing...');
    try {
      window.configRenderer = new ConfigRenderer();
    } catch (error) {
      console.error('Config.js: Error initializing ConfigRenderer:', error);
    }
  });
} else {
  console.log('Config.js: DOM already ready, initializing...');
  try {
    window.configRenderer = new ConfigRenderer();
  } catch (error) {
    console.error('Config.js: Error initializing ConfigRenderer:', error);
  }
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

