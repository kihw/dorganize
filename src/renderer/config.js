const { ipcRenderer } = require('electron');

// Import modules
const AutoKeyManager = require('./modules/AutoKeyManager');
const ShortcutManager = require('./modules/ShortcutManager');
const ModalManager = require('./modules/ModalManager');

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

    // Make managers globally accessible for onclick handlers
    window.autoKeyManager = this.autoKeyManager;
    window.shortcutManager = this.shortcutManager;
    window.modalManager = this.modalManager;
    window.configRenderer = this;
  }

  setupEventListeners() {
    // Main button event listeners
    this.elements.refreshBtn?.addEventListener('click', () => this.refreshWindows());
    this.elements.languageBtn?.addEventListener('click', () => this.modalManager.showLanguageModal());
    this.elements.organizeBtn?.addEventListener('click', () => this.modalManager.showOrganizeModal());
    this.elements.globalShortcutsBtn?.addEventListener('click', () => this.modalManager.showGlobalShortcutsModal());
    this.elements.autoKeyConfigBtn?.addEventListener('click', () => this.autoKeyManager.showModal());
    this.elements.nextWindowBtn?.addEventListener('click', () => this.activateNextWindow());
    this.elements.toggleShortcutsBtn?.addEventListener('click', () => this.toggleShortcuts());

    // Dock settings
    this.elements.dockEnabled?.addEventListener('change', () => this.updateDockSettings());
    this.elements.dockPosition?.addEventListener('change', () => this.updateDockSettings());

    // IPC event listeners
    ipcRenderer.on('windows-updated', (event, windows) => {
      console.log('Config.js: Received windows-updated event with', windows.length, 'windows');
      this.windows = windows;
      this.renderWindows();
      // Notify managers of window updates
      this.autoKeyManager.onWindowsUpdated();
    });

    ipcRenderer.on('language-changed', (event, language) => {
      console.log('Config.js: Received language-changed event');
      this.language = language;
      this.updateLanguageUI();
    });

    ipcRenderer.on('settings-updated', (event, updatedSettings) => {
      console.log('Config.js: Received settings-updated event');
      Object.assign(this.settings, updatedSettings);
      this.updateUIFromSettings();
    });

    // Global keyboard events
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.modalManager.handleEscapeKey();
      }
    });

    // Prevent default context menu
    document.addEventListener('contextmenu', (e) => e.preventDefault());
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

      this.renderWindows();
      this.updateLanguageUI();
      this.updateUIFromSettings();
      this.updateShortcutsStatus();

    } catch (error) {
      console.error('Config.js: Error loading data:', error);
    }
  }

  updateUIFromSettings() {
    if (!this.settingsLoaded || !this.settings) return;

    try {
      // Update dock settings
      if (this.elements.dockEnabled) {
        this.elements.dockEnabled.checked = this.settings.dock?.enabled || false;
      }
      if (this.elements.dockPosition) {
        this.elements.dockPosition.value = this.settings.dock?.position || 'SE';
      }

      this.updateShortcutsStatus();
      console.log('Config.js: UI updated from settings');
    } catch (error) {
      console.error('Config.js: Error updating UI from settings:', error);
    }
  }

  renderWindows() {
    if (!this.windows || this.windows.length === 0) {
      this.showNoWindows();
      return;
    }

    this.hideNoWindows();

    // Sort windows by initiative (highest first) then by character name
    const sortedWindows = [...this.windows].sort((a, b) => {
      if (b.initiative !== a.initiative) {
        return b.initiative - a.initiative;
      }
      return a.character.localeCompare(b.character);
    });

    let windowsHTML = '';
    sortedWindows.forEach((window, index) => {
      windowsHTML += this.renderWindowItem(window, index + 1);
    });

    this.elements.windowsList.innerHTML = windowsHTML;
    this.elements.windowCount.textContent = `${this.windows.length} windows detected`;

    this.addWindowEventListeners();
  }

  renderWindowItem(window, order) {
    const displayName = window.customName || window.character;
    const className = this.dofusClasses[window.dofusClass]?.name || 'Feca';
    const shortcutText = window.shortcut || (this.language.shortcut_none || 'No shortcut');
    const avatarSrc = `../../assets/avatars/${window.avatar}.jpg`;
    const isActive = window.isActive ? 'active' : '';
    const isDisabled = !window.enabled ? 'disabled' : '';

    return `
      <div class="window-item ${isActive} ${isDisabled}" data-window-id="${window.id}" data-class="${window.dofusClass}">
        <div class="window-header">
          <div class="window-avatar" onclick="configRenderer.activateWindow('${window.id}')" title="Click to activate window">
            <div class="initiative-order-badge">${order}</div>
            <img src="${avatarSrc}" alt="${displayName}" onerror="this.src='../../assets/avatars/1.jpg'">
          </div>
          <div class="window-info">
            <div class="window-title">${window.title}</div>
            <div class="window-character">${displayName}</div>
          </div>
          <div class="window-controls">
            <button class="btn btn-small" onclick="configRenderer.activateWindow('${window.id}')" title="Activate window">
              <span>⚡</span>
            </button>
          </div>
        </div>
        <div class="window-details">
          <div class="detail-item">
            <div class="detail-label">Character</div>
            <div class="detail-value">
              <input type="text" 
                     class="character-name-input" 
                     value="${displayName}" 
                     data-window-id="${window.id}"
                     onchange="configRenderer.updateCharacterName('${window.id}', this.value)"
                     placeholder="Character name">
            </div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Class</div>
            <div class="detail-value">
              <div class="class-display" onclick="modalManager.showClassModal('${window.id}')" title="Click to change class">
                ${className}
              </div>
            </div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Initiative</div>
            <div class="detail-value">
              <input type="number" 
                     class="initiative-input" 
                     value="${window.initiative || 0}" 
                     min="0" 
                     max="9999"
                     data-window-id="${window.id}"
                     onchange="configRenderer.updateInitiative('${window.id}', this.value)">
            </div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Shortcut</div>
            <div class="detail-value">
              <div class="shortcut-display" 
                   onclick="configRenderer.showShortcutModal('${window.id}')" 
                   title="Click to set shortcut">
                ${shortcutText}
              </div>
              ${window.shortcut ? `<button class="btn btn-danger btn-small" onclick="shortcutManager.removeWindowShortcut('${window.id}')" title="Remove shortcut">×</button>` : ''}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  showNoWindows() {
    this.elements.noWindows.style.display = 'block';
    this.elements.windowsList.style.display = 'none';
  }

  hideNoWindows() {
    this.elements.noWindows.style.display = 'none';
    this.elements.windowsList.style.display = 'block';
  }

  addWindowEventListeners() {
    document.querySelectorAll('.window-avatar').forEach(avatar => {
      avatar.addEventListener('click', (e) => {
        e.preventDefault();
        const windowId = e.target.closest('.window-item').dataset.windowId;
        this.activateWindow(windowId);
      });
    });
  }

  // Window management methods
  async activateWindow(windowId) {
    try {
      console.log(`Config.js: Activating window ${windowId}`);
      const success = await ipcRenderer.invoke('activate-window', windowId);
      if (success) {
        this.windows.forEach(w => {
          w.isActive = w.id === windowId;
        });
        this.renderWindows();
      }
    } catch (error) {
      console.error('Config.js: Error activating window:', error);
    }
  }

  async refreshWindows() {
    try {
      this.elements.refreshBtn.disabled = true;
      this.elements.refreshBtn.textContent = 'Refreshing...';

      await ipcRenderer.invoke('refresh-windows');

      setTimeout(() => {
        this.elements.refreshBtn.disabled = false;
        this.elements.refreshBtn.innerHTML = '<img src="../../assets/icons/refresh.png" alt="Refresh" onerror="this.style.display=\'none\'"><span>Refresh</span>';
      }, 1000);
    } catch (error) {
      console.error('Config.js: Error refreshing windows:', error);
      this.elements.refreshBtn.disabled = false;
      this.elements.refreshBtn.innerHTML = '<img src="../../assets/icons/refresh.png" alt="Refresh" onerror="this.style.display=\'none\'"><span>Refresh</span>';
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
      this.updateShortcutsStatusText(enabled);
    } catch (error) {
      console.error('Config.js: Error toggling shortcuts:', error);
    }
  }

  updateShortcutsStatus() {
    if (this.settings && typeof this.settings.shortcutsEnabled === 'boolean') {
      this.updateShortcutsStatusText(this.settings.shortcutsEnabled);
    }
  }

  updateShortcutsStatusText(enabled) {
    if (this.elements.shortcutsStatusText) {
      this.elements.shortcutsStatusText.textContent = `Shortcuts: ${enabled ? 'Enabled' : 'Disabled'}`;
      const statusEl = this.elements.shortcutsStatus;
      statusEl.className = `shortcuts-status show ${enabled ? 'enabled' : 'disabled'}`;

      setTimeout(() => statusEl.classList.remove('show'), 3000);
    }

    if (this.elements.toggleShortcutsText) {
      this.elements.toggleShortcutsText.textContent = enabled ? 'Disable Shortcuts' : 'Enable Shortcuts';
    }
  }

  // Settings update methods
  async updateCharacterName(windowId, newName) {
    try {
      const settings = { [`customNames.${windowId}`]: newName };
      await ipcRenderer.invoke('save-settings', settings);

      const window = this.windows.find(w => w.id === windowId);
      if (window) {
        window.customName = newName;
      }
    } catch (error) {
      console.error('Config.js: Error updating character name:', error);
    }
  }

  async updateInitiative(windowId, newInitiative) {
    try {
      const initiative = parseInt(newInitiative) || 0;
      const settings = { [`initiatives.${windowId}`]: initiative };
      await ipcRenderer.invoke('save-settings', settings);

      const window = this.windows.find(w => w.id === windowId);
      if (window) {
        window.initiative = initiative;
        this.renderWindows();
        this.autoKeyManager.onWindowsUpdated();
      }
    } catch (error) {
      console.error('Config.js: Error updating initiative:', error);
    }
  }

  // Shortcut management - delegate to ShortcutManager
  showShortcutModal(windowId) {
    const window = this.windows.find(w => w.id === windowId);
    const displayName = window ? (window.customName || window.character) : 'Unknown';
    this.shortcutManager.showModal(windowId, displayName);
  }

  async updateDockSettings() {
    try {
      const dockSettings = {
        'dock.enabled': this.elements.dockEnabled?.checked || false,
        'dock.position': this.elements.dockPosition?.value || 'SE'
      };

      await ipcRenderer.invoke('save-settings', dockSettings);
      console.log('Config.js: Updated dock settings:', dockSettings);
    } catch (error) {
      console.error('Config.js: Error updating dock settings:', error);
    }
  }

  updateLanguageUI() {
    if (this.language && Object.keys(this.language).length > 0) {
      console.log('Config.js: Language UI updated');
    }
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

// Debug: Make IPC available globally
window.ipc = ipcRenderer;
console.log('Config.js: Refactored file loaded completely');