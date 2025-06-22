const { ipcRenderer } = require('electron');

class ConfigRenderer {
  constructor() {
    this.windows = [];
    this.language = {};
    this.settings = {};
    this.dofusClasses = {};
    this.shortcutRecorder = null;
    this.currentShortcutWindowId = null;
    this.currentClassWindowId = null;
    this.currentGlobalShortcutType = null;
    this.settingsLoaded = false;
    this.isRecording = false;

    this.initializeElements();
    this.setupEventListeners();
    this.loadData();
  }

  initializeElements() {
    this.elements = {
      refreshBtn: document.getElementById('refresh-btn'),
      languageBtn: document.getElementById('language-btn'),
      organizeBtn: document.getElementById('organize-btn'),
      globalShortcutsBtn: document.getElementById('global-shortcuts-btn'),
      autoKeyConfigBtn: document.getElementById('auto-key-config-btn'), // NEW FEAT-001
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

  setupEventListeners() {
    // Button event listeners
    this.elements.refreshBtn?.addEventListener('click', () => this.refreshWindows());
    this.elements.languageBtn?.addEventListener('click', () => this.showLanguageModal());
    this.elements.organizeBtn?.addEventListener('click', () => this.showOrganizeModal());
    this.elements.globalShortcutsBtn?.addEventListener('click', () => this.showGlobalShortcutsModal());
    this.elements.autoKeyConfigBtn?.addEventListener('click', () => this.showAutoKeyModal()); // NEW FEAT-001
    this.elements.nextWindowBtn?.addEventListener('click', () => this.activateNextWindow());
    this.elements.toggleShortcutsBtn?.addEventListener('click', () => this.toggleShortcuts());

    // Dock settings
    this.elements.dockEnabled?.addEventListener('change', () => this.updateDockSettings());
    this.elements.dockPosition?.addEventListener('change', () => this.updateDockSettings());

    // Language modal
    document.getElementById('language-save')?.addEventListener('click', () => this.saveLanguage());
    document.getElementById('language-cancel')?.addEventListener('click', () => this.closeLanguageModal());

    // Shortcut modal
    document.getElementById('shortcut-save')?.addEventListener('click', () => this.saveShortcut());
    document.getElementById('shortcut-cancel')?.addEventListener('click', () => this.closeShortcutModal());
    document.getElementById('shortcut-remove')?.addEventListener('click', () => this.removeShortcut());

    // IPC event listeners
    ipcRenderer.on('windows-updated', (event, windows) => {
      console.log('Config.js: Received windows-updated event with', windows.length, 'windows');
      this.windows = windows;
      this.renderWindows();
    });

    ipcRenderer.on('language-changed', (event, language) => {
      console.log('Config.js: Received language-changed event');
      this.language = language;
      this.updateLanguageUI();
    });

    // FIX BUG-001: Listen for settings updates from main process
    ipcRenderer.on('settings-updated', (event, updatedSettings) => {
      console.log('Config.js: Received settings-updated event');
      // Update local settings without triggering save
      Object.assign(this.settings, updatedSettings);
      this.updateUIFromSettings();
    });

    // Keyboard shortcut capture
    document.addEventListener('keydown', (e) => this.handleKeyboardInput(e));

    // Prevent default context menu
    document.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  async loadData() {
    try {
      console.log('Config.js: Loading initial data...');

      // Load all data in parallel
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
      this.settingsLoaded = true; // FIX BUG-001: Mark settings as loaded

      console.log('Config.js: Data loaded successfully');
      console.log('Config.js: Windows:', this.windows.length);
      console.log('Config.js: Settings:', this.settings);

      this.renderWindows();
      this.updateLanguageUI();
      this.updateUIFromSettings(); // FIX BUG-001: Update UI from loaded settings
      this.updateShortcutsStatus();

    } catch (error) {
      console.error('Config.js: Error loading data:', error);
    }
  }

  // FIX BUG-001: Method to update UI from loaded settings
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

      // Update shortcuts status
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

    // FIX BUG-002: Sort windows by initiative (highest first) then by character name
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

    // Add event listeners to newly created elements
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
            <!-- NEW FEAT-001: Initiative order badge -->
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
              <div class="class-display" onclick="configRenderer.showClassModal('${window.id}')" title="Click to change class">
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
              ${window.shortcut ? `<button class="btn btn-danger btn-small" onclick="configRenderer.removeWindowShortcut('${window.id}')" title="Remove shortcut">×</button>` : ''}
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
    // Add any additional event listeners for window items
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
        // Update UI immediately for better feedback
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

      // Update local data
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

      // Update local data and re-sort
      const window = this.windows.find(w => w.id === windowId);
      if (window) {
        window.initiative = initiative;
        this.renderWindows(); // Re-render to update sorting
      }
    } catch (error) {
      console.error('Config.js: Error updating initiative:', error);
    }
  }

  // Shortcut management
  showShortcutModal(windowId) {
    this.currentShortcutWindowId = windowId;
    const window = this.windows.find(w => w.id === windowId);
    const displayName = window ? (window.customName || window.character) : 'Unknown';

    document.getElementById('shortcut-title').textContent = `Set Shortcut for ${displayName}`;
    document.getElementById('shortcut-display').textContent = 'Press any key or combination...';
    document.getElementById('shortcut-display').className = 'shortcut-display-modal';
    document.getElementById('shortcut-modal').style.display = 'flex';

    this.startShortcutRecording();
  }

  closeShortcutModal() {
    document.getElementById('shortcut-modal').style.display = 'none';
    this.stopShortcutRecording();
    this.currentShortcutWindowId = null;
  }

  startShortcutRecording() {
    this.isRecording = true;
    document.getElementById('shortcut-display').className = 'shortcut-display-modal recording';
    document.getElementById('shortcut-display').textContent = 'Press any key combination...';
  }

  stopShortcutRecording() {
    this.isRecording = false;
  }

  handleKeyboardInput(e) {
    if (!this.isRecording || !document.getElementById('shortcut-modal').style.display === 'flex') {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    const shortcut = this.buildShortcutString(e);

    document.getElementById('shortcut-display').textContent = shortcut;
    document.getElementById('shortcut-display').className = 'shortcut-display-modal captured';

    this.stopShortcutRecording();
  }

  buildShortcutString(e) {
    const parts = [];

    if (e.ctrlKey) parts.push('Ctrl');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');
    if (e.metaKey) parts.push('Meta');

    const key = this.getKeyName(e);
    if (key && !['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
      parts.push(key);
    }

    return parts.join('+');
  }

  getKeyName(e) {
    const keyMap = {
      ' ': 'Space',
      'ArrowUp': 'Up',
      'ArrowDown': 'Down',
      'ArrowLeft': 'Left',
      'ArrowRight': 'Right',
      'Enter': 'Return',
      'Escape': 'Escape',
      'Backspace': 'Backspace',
      'Delete': 'Delete',
      'Tab': 'Tab',
      'Insert': 'Insert',
      'Home': 'Home',
      'End': 'End',
      'PageUp': 'PageUp',
      'PageDown': 'PageDown'
    };

    if (keyMap[e.key]) return keyMap[e.key];
    if (e.key.startsWith('F') && e.key.length <= 3) return e.key;
    if (e.key.length === 1) return e.key.toUpperCase();

    return e.key;
  }

  async saveShortcut() {
    const shortcut = document.getElementById('shortcut-display').textContent;
    if (shortcut && shortcut !== 'Press any key or combination...' && this.currentShortcutWindowId) {
      try {
        const success = await ipcRenderer.invoke('set-shortcut', this.currentShortcutWindowId, shortcut);
        if (success) {
          // Update local data
          const window = this.windows.find(w => w.id === this.currentShortcutWindowId);
          if (window) {
            window.shortcut = shortcut;
            this.renderWindows();
          }
        }
      } catch (error) {
        console.error('Config.js: Error saving shortcut:', error);
      }
    }
    this.closeShortcutModal();
  }

  async removeShortcut() {
    if (this.currentShortcutWindowId) {
      try {
        await ipcRenderer.invoke('remove-shortcut', this.currentShortcutWindowId);

        // Update local data
        const window = this.windows.find(w => w.id === this.currentShortcutWindowId);
        if (window) {
          window.shortcut = null;
          this.renderWindows();
        }
      } catch (error) {
        console.error('Config.js: Error removing shortcut:', error);
      }
    }
    this.closeShortcutModal();
  }

  async removeWindowShortcut(windowId) {
    try {
      await ipcRenderer.invoke('remove-shortcut', windowId);

      // Update local data
      const window = this.windows.find(w => w.id === windowId);
      if (window) {
        window.shortcut = null;
        this.renderWindows();
      }
    } catch (error) {
      console.error('Config.js: Error removing window shortcut:', error);
    }
  }

  // Global shortcuts modal
  async showGlobalShortcutsModal() {
    try {
      const globalShortcuts = await ipcRenderer.invoke('get-global-shortcuts');

      // Update the modal with current shortcuts
      document.getElementById('next-window-shortcut-display').textContent =
        globalShortcuts.nextWindow || 'Ctrl+Tab';
      document.getElementById('toggle-shortcuts-shortcut-display').textContent =
        globalShortcuts.toggleShortcuts || 'Ctrl+Shift+D';

      document.getElementById('global-shortcuts-modal').style.display = 'flex';
    } catch (error) {
      console.error('Config.js: Error loading global shortcuts:', error);
    }
  }

  closeGlobalShortcutsModal() {
    document.getElementById('global-shortcuts-modal').style.display = 'none';
  }

  setGlobalShortcut(type) {
    this.currentGlobalShortcutType = type;
    this.showShortcutModal('global');
  }

  async removeGlobalShortcut(type) {
    try {
      await ipcRenderer.invoke('remove-global-shortcut', type);
      this.showGlobalShortcutsModal(); // Refresh the modal
    } catch (error) {
      console.error('Config.js: Error removing global shortcut:', error);
    }
  }

  // NEW FEAT-001: Auto Key Configuration Modal
  showAutoKeyModal() {
    // Load current auto key settings
    this.loadAutoKeySettings();
    document.getElementById('auto-key-config-modal').style.display = 'flex';
  }

  closeAutoKeyModal() {
    document.getElementById('auto-key-config-modal').style.display = 'none';
  }

  async loadAutoKeySettings() {
    try {
      // Implementation for loading auto key settings
      console.log('Config.js: Loading auto key settings...');
    } catch (error) {
      console.error('Config.js: Error loading auto key settings:', error);
    }
  }

  selectAutoKeyPreset(preset) {
    console.log(`Config.js: Selected auto key preset: ${preset}`);
    // Implementation for preset selection
  }

  async applyAutoKeyConfiguration() {
    try {
      console.log('Config.js: Applying auto key configuration...');
      // Implementation for applying auto key configuration
      this.closeAutoKeyModal();
    } catch (error) {
      console.error('Config.js: Error applying auto key configuration:', error);
    }
  }

  async disableAutoKey() {
    try {
      console.log('Config.js: Disabling auto key...');
      // Implementation for disabling auto key
      this.closeAutoKeyModal();
    } catch (error) {
      console.error('Config.js: Error disabling auto key:', error);
    }
  }

  // Language modal
  showLanguageModal() {
    document.getElementById('language-modal').style.display = 'flex';
  }

  closeLanguageModal() {
    document.getElementById('language-modal').style.display = 'none';
  }

  async saveLanguage() {
    const selectedLanguage = document.querySelector('input[name="language"]:checked')?.value;
    if (selectedLanguage) {
      try {
        await ipcRenderer.invoke('save-settings', { language: selectedLanguage });
        this.closeLanguageModal();
      } catch (error) {
        console.error('Config.js: Error saving language:', error);
      }
    }
  }

  // Organize modal
  showOrganizeModal() {
    document.getElementById('organize-modal').style.display = 'flex';
  }

  async organizeWindows(layout) {
    try {
      await ipcRenderer.invoke('organize-windows', layout);
      document.getElementById('organize-modal').style.display = 'none';
    } catch (error) {
      console.error('Config.js: Error organizing windows:', error);
    }
  }

  // Class modal
  showClassModal(windowId) {
    this.currentClassWindowId = windowId;
    const modal = document.getElementById('class-modal');
    const classGrid = document.getElementById('class-grid');

    if (!classGrid || !modal) {
      console.error('Config.js: Class modal elements not found');
      return;
    }

    let classHTML = '';
    Object.entries(this.dofusClasses).forEach(([classKey, classInfo]) => {
      const avatarSrc = `../../assets/avatars/${classInfo.avatar}.jpg`;
      const window = this.windows.find(w => w.id === windowId);
      const isSelected = window && window.dofusClass === classKey;

      classHTML += `
        <div class="class-option ${isSelected ? 'selected' : ''}" 
             onclick="configRenderer.selectClass('${classKey}')"
             data-class="${classKey}">
          <img src="${avatarSrc}" alt="${classInfo.name}" class="class-avatar" 
               onerror="this.src='../../assets/avatars/1.jpg'">
          <div class="class-name">${classInfo.name}</div>
        </div>
      `;
    });

    classGrid.innerHTML = classHTML;
    modal.style.display = 'flex';
  }

  selectClass(classKey) {
    const classOptions = document.querySelectorAll('.class-option');
    classOptions.forEach(option => {
      option.classList.remove('selected');
    });

    const selectedOption = document.querySelector(`[data-class="${classKey}"]`);
    if (selectedOption) {
      selectedOption.classList.add('selected');
    }
    this.saveClassChange(classKey);
  }

  async saveClassChange(classKey) {
    if (this.currentClassWindowId) {
      try {
        const settings = { [`classes.${this.currentClassWindowId}`]: classKey };
        await ipcRenderer.invoke('save-settings', settings);
        const window = this.windows.find(w => w.id === this.currentClassWindowId);
        if (window) {
          window.dofusClass = classKey;
          window.avatar = this.dofusClasses[classKey].avatar;
          this.renderWindows();
        }
        setTimeout(() => {
          this.closeClassModal();
        }, 300);
      } catch (error) {
        console.error('Config.js: Error saving class change:', error);
      }
    }
  }

  closeClassModal() {
    const modal = document.getElementById('class-modal');
    if (modal) {
      modal.style.display = 'none';
    }
    this.currentClassWindowId = null;
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
    // Update UI text based on current language
    if (this.language && Object.keys(this.language).length > 0) {
      // Update button texts and other UI elements
      console.log('Config.js: Language UI updated');
    }
  }
}

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
console.log('Config.js: File loaded completely');