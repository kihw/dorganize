const { ipcRenderer } = require('electron');

console.log('Config.js: Loading...');

class ConfigRenderer {
  constructor() {
    this.windows = [];
    this.language = {};
    this.settings = {};
    this.dofusClasses = {};
    this.currentShortcutWindowId = null;
    this.currentClassWindowId = null;
    this.currentShortcut = '';
    this.currentKeyHandler = null;
    this.shortcutsEnabled = true;
    this.globalShortcuts = {};
    this.currentGlobalShortcutType = null;

    this.initializeElements();
    this.setupEventListeners();
    this.loadData();

    console.log('Config.js: Initialized');
  }

  initializeElements() {
    this.elements = {
      windowsList: document.getElementById('windows-list'),
      noWindows: document.getElementById('no-windows'),
      refreshBtn: document.getElementById('refresh-btn'),
      languageBtn: document.getElementById('language-btn'),
      organizeBtn: document.getElementById('organize-btn'),
      globalShortcutsBtn: document.getElementById('global-shortcuts-btn'),
      nextWindowBtn: document.getElementById('next-window-btn'),
      toggleShortcutsBtn: document.getElementById('toggle-shortcuts-btn'),
      toggleShortcutsText: document.getElementById('toggle-shortcuts-text'),
      dockEnabled: document.getElementById('dock-enabled'),
      dockPosition: document.getElementById('dock-position'),
      windowCount: document.getElementById('window-count'),
      shortcutsStatus: document.getElementById('shortcuts-status'),
      shortcutsStatusText: document.getElementById('shortcuts-status-text')
    };

    console.log('Config.js: Elements found:', Object.keys(this.elements).filter(k => this.elements[k]));
  }

  setupEventListeners() {
    // IPC listeners
    ipcRenderer.on('windows-updated', (event, windows) => {
      console.log('Config.js: Received windows-updated:', windows);
      this.windows = windows;
      this.renderWindows();
      this.updateWindowCount();
    });

    ipcRenderer.on('language-changed', (event, language) => {
      console.log('Config.js: Received language-changed');
      this.language = language;
      this.updateLanguage();
    });

    ipcRenderer.on('shortcuts-toggled', (event, enabled) => {
      console.log('Config.js: Received shortcuts-toggled:', enabled);
      this.shortcutsEnabled = enabled;
      this.updateShortcutsUI();
      this.showShortcutsStatus();
    });

    // Button listeners
    if (this.elements.refreshBtn) {
      this.elements.refreshBtn.addEventListener('click', () => {
        console.log('Config.js: Refresh button clicked');
        this.refreshWindows();
      });
    }

    if (this.elements.languageBtn) {
      this.elements.languageBtn.addEventListener('click', () => {
        this.showLanguageModal();
      });
    }

    if (this.elements.organizeBtn) {
      this.elements.organizeBtn.addEventListener('click', () => {
        this.showOrganizeModal();
      });
    }

    if (this.elements.globalShortcutsBtn) {
      this.elements.globalShortcutsBtn.addEventListener('click', () => {
        this.showGlobalShortcutsModal();
      });
    }

    if (this.elements.nextWindowBtn) {
      this.elements.nextWindowBtn.addEventListener('click', () => {
        this.activateNextWindow();
      });
    }

    if (this.elements.toggleShortcutsBtn) {
      this.elements.toggleShortcutsBtn.addEventListener('click', () => {
        this.toggleShortcuts();
      });
    }

    // Dock settings
    if (this.elements.dockEnabled) {
      this.elements.dockEnabled.addEventListener('change', () => {
        this.updateDockSettings();
      });
    }

    if (this.elements.dockPosition) {
      this.elements.dockPosition.addEventListener('change', () => {
        this.updateDockSettings();
      });
    }

    // Modal event listeners
    this.setupModalEventListeners();
  }

  setupModalEventListeners() {
    // Language modal
    const languageSave = document.getElementById('language-save');
    const languageCancel = document.getElementById('language-cancel');

    if (languageSave) {
      languageSave.addEventListener('click', () => {
        this.saveLanguage();
      });
    }

    if (languageCancel) {
      languageCancel.addEventListener('click', () => {
        this.hideLanguageModal();
      });
    }

    // Shortcut modal
    const shortcutSave = document.getElementById('shortcut-save');
    const shortcutCancel = document.getElementById('shortcut-cancel');
    const shortcutRemove = document.getElementById('shortcut-remove');

    if (shortcutSave) {
      shortcutSave.addEventListener('click', () => {
        this.saveShortcut();
      });
    }

    if (shortcutCancel) {
      shortcutCancel.addEventListener('click', () => {
        this.closeShortcutModal();
      });
    }

    if (shortcutRemove) {
      shortcutRemove.addEventListener('click', () => {
        this.removeShortcut();
      });
    }

    // Class modal
    const classCancel = document.getElementById('class-cancel');
    if (classCancel) {
      classCancel.addEventListener('click', () => {
        this.closeClassModal();
      });
    }
  }

  async loadData() {
    try {
      console.log('Config.js: Loading initial data...');

      this.windows = await ipcRenderer.invoke('get-dofus-windows');
      console.log('Config.js: Loaded windows:', this.windows);

      this.language = await ipcRenderer.invoke('get-language');
      console.log('Config.js: Loaded language with keys:', Object.keys(this.language));

      this.settings = await ipcRenderer.invoke('get-settings');
      console.log('Config.js: Loaded settings with keys:', Object.keys(this.settings));

      // Get Dofus classes
      this.dofusClasses = await ipcRenderer.invoke('get-dofus-classes');
      console.log('Config.js: Loaded Dofus classes:', Object.keys(this.dofusClasses));

      // Get shortcuts enabled state
      this.shortcutsEnabled = await ipcRenderer.invoke('get-shortcuts-enabled');
      console.log('Config.js: Shortcuts enabled:', this.shortcutsEnabled);

      // Get global shortcuts - now from config file
      this.globalShortcuts = await ipcRenderer.invoke('get-global-shortcuts');
      console.log('Config.js: Global shortcuts:', this.globalShortcuts);

      this.renderWindows();
      this.updateLanguage();
      this.loadDockSettings();
      this.updateWindowCount();
      this.updateShortcutsUI();
      this.updateGlobalShortcutsDisplay();

    } catch (error) {
      console.error('Config.js: Error loading data:', error);
    }
  }

  renderWindows() {
    console.log(`Config.js: Rendering ${this.windows.length} windows`);

    if (!this.elements.windowsList || !this.elements.noWindows) {
      console.error('Config.js: Missing DOM elements for rendering');
      return;
    }

    if (this.windows.length === 0) {
      this.elements.noWindows.style.display = 'block';
      this.elements.windowsList.style.display = 'none';
      this.elements.windowsList.innerHTML = '';
      return;
    }

    this.elements.noWindows.style.display = 'none';
    this.elements.windowsList.style.display = 'grid';

    let windowsHTML = '';

    this.windows.forEach((window, _index) => {
      const displayName = window.customName || window.character || 'Unknown';
      const shortcutText = window.shortcut || 'No shortcut';
      const avatarSrc = `../../assets/avatars/${window.avatar}.jpg`;
      const className = this.dofusClasses[window.dofusClass]?.name || 'Feca';
      const enabledClass = window.enabled ? 'enabled' : 'disabled';

      windowsHTML += `
                <div class="window-item ${enabledClass}" data-window-id="${window.id}" data-class="${window.dofusClass}">
                    <div class="window-header">
                        <div class="window-avatar" onclick="configRenderer.showClassModal('${window.id}')" title="Click to change class">
                            <img src="${avatarSrc}" alt="Avatar" onerror="this.src='../../assets/avatars/1.jpg'" title="${className}">
                        </div>
                        <div class="window-info">
                            <div class="window-title">${this.escapeHtml(window.title)}</div>
                            <div class="window-character">${this.escapeHtml(displayName)} - ${className}</div>
                        </div>
                        <div class="window-controls">
                            <button class="btn btn-primary" onclick="configRenderer.activateWindow('${window.id}')" title="Activate window">
                                Activate
                            </button>
                        </div>
                    </div>
                    
                    <div class="window-details">
                        <div class="detail-item">
                            <div class="detail-label">Initiative</div>
                            <div class="detail-value">
                                <input type="number" 
                                       class="initiative-input" 
                                       value="${window.initiative || 0}"
                                       min="0"
                                       max="9999"
                                       onchange="configRenderer.updateInitiative('${window.id}', this.value)"
                                       title="Set character initiative for sorting">
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
                            <div class="detail-label">Shortcut</div>
                            <div class="detail-value">
                                <div class="shortcut-display" onclick="configRenderer.setShortcut('${window.id}')" title="Click to set keyboard shortcut">
                                    ${this.escapeHtml(shortcutText)}
                                </div>
                            </div>
                        </div>
                        
                        <div class="detail-item">
                            <div class="detail-label">Enabled</div>
                            <div class="detail-value">
                                <div class="toggle-switch ${window.enabled ? 'active' : ''}" 
                                     onclick="configRenderer.toggleWindow('${window.id}')"
                                     title="Enable/disable this window"></div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
    });

    this.elements.windowsList.innerHTML = windowsHTML;
    console.log('Config.js: Windows rendered successfully');
  }

  updateWindowCount() {
    if (this.elements.windowCount) {
      const enabledCount = this.windows.filter(w => w.enabled).length;
      const totalCount = this.windows.length;

      if (totalCount === 0) {
        this.elements.windowCount.textContent = 'No windows detected';
      } else if (enabledCount === totalCount) {
        this.elements.windowCount.textContent = `${totalCount} window${totalCount > 1 ? 's' : ''} detected`;
      } else {
        this.elements.windowCount.textContent = `${enabledCount}/${totalCount} windows enabled`;
      }
    }
  }

  updateShortcutsUI() {
    if (this.elements.toggleShortcutsText) {
      this.elements.toggleShortcutsText.textContent = this.shortcutsEnabled ? 'Disable Shortcuts' : 'Enable Shortcuts';
    }

    if (this.elements.toggleShortcutsBtn) {
      this.elements.toggleShortcutsBtn.className = this.shortcutsEnabled ? 'btn btn-secondary' : 'btn btn-primary';
    }
  }

  updateGlobalShortcutsDisplay() {
    const nextWindowDisplay = document.getElementById('next-window-shortcut-display');
    const toggleShortcutsDisplay = document.getElementById('toggle-shortcuts-shortcut-display');

    if (nextWindowDisplay && this.globalShortcuts.nextWindow) {
      nextWindowDisplay.textContent = this.globalShortcuts.nextWindow;
    }

    if (toggleShortcutsDisplay && this.globalShortcuts.toggleShortcuts) {
      toggleShortcutsDisplay.textContent = this.globalShortcuts.toggleShortcuts;
    }
  }

  showShortcutsStatus() {
    if (this.elements.shortcutsStatus && this.elements.shortcutsStatusText) {
      this.elements.shortcutsStatusText.textContent = `Shortcuts: ${this.shortcutsEnabled ? 'Enabled' : 'Disabled'}`;
      this.elements.shortcutsStatus.className = `shortcuts-status show ${this.shortcutsEnabled ? 'enabled' : 'disabled'}`;

      // Hide after 3 seconds
      setTimeout(() => {
        this.elements.shortcutsStatus.classList.remove('show');
      }, 3000);
    }
  }

  updateLanguage() {
    // Basic language update - extend as needed
    if (this.language.displayGUI_nowindow) {
      const noWindowsText = document.getElementById('no-windows-text');
      if (noWindowsText) {
        noWindowsText.textContent = this.language.displayGUI_nowindow;
      }
    }

    // Update labels
    const labels = {
      'dock-label': this.language.displayGUI_dock || 'Enable navigation dock',
      'title': 'Dorganize - Configuration'
    };

    Object.keys(labels).forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.textContent = labels[id];
      }
    });
  }

  loadDockSettings() {
    if (this.elements.dockEnabled && this.settings.dock) {
      this.elements.dockEnabled.checked = this.settings.dock.enabled || false;
    }

    if (this.elements.dockPosition && this.settings.dock) {
      this.elements.dockPosition.value = this.settings.dock.position || 'SE';
    }
  }

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  async refreshWindows() {
    try {
      console.log('Config.js: Refreshing windows...');
      this.elements.refreshBtn.disabled = true;
      this.elements.refreshBtn.textContent = 'Refreshing...';

      await ipcRenderer.invoke('refresh-windows');

      setTimeout(() => {
        this.elements.refreshBtn.disabled = false;
        this.elements.refreshBtn.textContent = 'Refresh';
      }, 1000);
    } catch (error) {
      console.error('Config.js: Error refreshing windows:', error);
      this.elements.refreshBtn.disabled = false;
      this.elements.refreshBtn.textContent = 'Refresh';
    }
  }

  async activateWindow(windowId) {
    try {
      console.log(`Config.js: Activating window ${windowId}`);
      await ipcRenderer.invoke('activate-window', windowId);
    } catch (error) {
      console.error('Config.js: Error activating window:', error);
    }
  }

  async activateNextWindow() {
    try {
      console.log('Config.js: Activating next window');
      await ipcRenderer.invoke('activate-next-window');
    } catch (error) {
      console.error('Config.js: Error activating next window:', error);
    }
  }

  async toggleShortcuts() {
    try {
      console.log('Config.js: Toggling shortcuts');
      this.shortcutsEnabled = await ipcRenderer.invoke('toggle-shortcuts');
      this.updateShortcutsUI();
      this.showShortcutsStatus();
    } catch (error) {
      console.error('Config.js: Error toggling shortcuts:', error);
    }
  }

  async updateInitiative(windowId, initiative) {
    try {
      console.log(`Config.js: Updating initiative for ${windowId}: ${initiative}`);
      const settings = { [`initiatives.${windowId}`]: parseInt(initiative) || 0 };
      await ipcRenderer.invoke('save-settings', settings);
    } catch (error) {
      console.error('Config.js: Error updating initiative:', error);
    }
  }

  async toggleWindow(windowId) {
    try {
      console.log(`Config.js: Toggling window ${windowId}`);
      const window = this.windows.find(w => w.id === windowId);
      if (window) {
        const settings = { [`enabled.${windowId}`]: !window.enabled };
        await ipcRenderer.invoke('save-settings', settings);
        window.enabled = !window.enabled;
        this.renderWindows();
        this.updateWindowCount();
      }
    } catch (error) {
      console.error('Config.js: Error toggling window:', error);
    }
  }

  // Global Shortcuts Modal
  showGlobalShortcutsModal() {
    const modal = document.getElementById('global-shortcuts-modal');
    if (modal) {
      this.updateGlobalShortcutsDisplay();
      modal.style.display = 'flex';
    }
  }

  closeGlobalShortcutsModal() {
    const modal = document.getElementById('global-shortcuts-modal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  setGlobalShortcut(type) {
    console.log(`Config.js: Setting global shortcut for ${type}`);
    this.currentGlobalShortcutType = type;
    this.showShortcutModal(null, true);
  }

  async removeGlobalShortcut(type) {
    try {
      console.log(`Config.js: Removing global shortcut for ${type}`);
      await ipcRenderer.invoke('remove-global-shortcut', type);

      // Update local data
      this.globalShortcuts[type] = '';
      this.updateGlobalShortcutsDisplay();
    } catch (error) {
      console.error('Config.js: Error removing global shortcut:', error);
    }
  }

  // Language Modal
  showLanguageModal() {
    const modal = document.getElementById('language-modal');
    if (modal) {
      // Set current language
      const currentLanguage = this.settings.language || 'FR';
      const radioButton = modal.querySelector(`input[name="language"][value="${currentLanguage}"]`);
      if (radioButton) {
        radioButton.checked = true;
      }

      modal.style.display = 'flex';
    }
  }

  hideLanguageModal() {
    const modal = document.getElementById('language-modal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  async saveLanguage() {
    const modal = document.getElementById('language-modal');
    const selectedRadio = modal.querySelector('input[name="language"]:checked');

    if (selectedRadio) {
      try {
        const settings = { language: selectedRadio.value };
        await ipcRenderer.invoke('save-settings', settings);
        this.hideLanguageModal();
      } catch (error) {
        console.error('Config.js: Error saving language:', error);
      }
    }
  }

  // Organize Modal
  showOrganizeModal() {
    const modal = document.getElementById('organize-modal');
    if (modal) {
      modal.style.display = 'flex';
    }
  }

  async organizeWindows(layout) {
    try {
      console.log(`Config.js: Organizing windows with layout: ${layout}`);
      await ipcRenderer.invoke('organize-windows', layout);

      // Close the modal
      const modal = document.getElementById('organize-modal');
      if (modal) {
        modal.style.display = 'none';
      }
    } catch (error) {
      console.error('Config.js: Error organizing windows:', error);
    }
  }

  // Shortcut Modal
  setShortcut(windowId) {
    console.log(`Config.js: Setting shortcut for ${windowId}`);
    this.showShortcutModal(windowId, false);
  }

  showShortcutModal(windowId, isGlobal = false) {
    const modal = document.getElementById('shortcut-modal');
    const display = document.getElementById('shortcut-display');
    const title = document.getElementById('shortcut-title');

    if (modal && display && title) {
      if (isGlobal) {
        this.currentShortcutWindowId = null;
        title.textContent = `Set Global Shortcut - ${this.currentGlobalShortcutType === 'nextWindow' ? 'Next Window' : 'Toggle Shortcuts'}`;
        display.textContent = this.globalShortcuts[this.currentGlobalShortcutType] || 'Press any key or combination...';
      } else {
        this.currentShortcutWindowId = windowId;
        this.currentGlobalShortcutType = null;
        title.textContent = 'Set Keyboard Shortcut';
        const window = this.windows.find(w => w.id === windowId);
        display.textContent = window?.shortcut || 'Press any key or combination...';
      }

      this.currentShortcut = '';
      display.classList.add('recording');
      modal.style.display = 'flex';

      this.setupShortcutCapture();
    }
  }

  setupShortcutCapture() {
    const display = document.getElementById('shortcut-display');

    const keyHandler = (e) => {
      e.preventDefault();
      e.stopPropagation();

      console.log('Key pressed:', e.key, 'Code:', e.code, 'Modifiers:', {
        ctrl: e.ctrlKey,
        alt: e.altKey,
        shift: e.shiftKey,
        meta: e.metaKey
      });

      // Build the shortcut string
      const keys = [];

      // Add modifiers
      if (e.ctrlKey || e.metaKey) keys.push('Ctrl');
      if (e.altKey) keys.push('Alt');
      if (e.shiftKey) keys.push('Shift');

      // Handle the main key
      let mainKey = '';

      // Special keys mapping
      const specialKeys = {
        ' ': 'Space',
        'Enter': 'Return',
        'Escape': 'Escape',
        'Backspace': 'Backspace',
        'Tab': 'Tab',
        'Delete': 'Delete',
        'Insert': 'Insert',
        'Home': 'Home',
        'End': 'End',
        'PageUp': 'PageUp',
        'PageDown': 'PageDown',
        'ArrowUp': 'Up',
        'ArrowDown': 'Down',
        'ArrowLeft': 'Left',
        'ArrowRight': 'Right',
        ';': ';',
        '=': '=',
        ',': ',',
        '.': '.',
        '/': '/',
        '\'': '\'',
        '`': '`',
        '[': '[',
        ']': ']',
        '\\': '\\'
      };

      // Function keys
      if (e.key.match(/^F\d+$/)) {
        mainKey = e.key;
      }
      // Special keys
      else if (specialKeys[e.key]) {
        mainKey = specialKeys[e.key];
      }
      // Regular keys (letters, numbers)
      else if (e.key.length === 1 && e.key.match(/[a-zA-Z0-9]/)) {
        mainKey = e.key.toUpperCase();
      }
      // Other single character keys
      else if (e.key.length === 1) {
        mainKey = e.key;
      }
      // Skip modifier-only presses
      else if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
        return;
      }

      // If we have a main key, create the shortcut
      if (mainKey) {
        keys.push(mainKey);
        this.currentShortcut = keys.join('+');
        display.textContent = this.currentShortcut;
        display.classList.remove('recording');
        display.classList.add('captured');

        console.log('Captured shortcut:', this.currentShortcut);
      }
    };

    // Clean up any existing handler
    if (this.currentKeyHandler) {
      document.removeEventListener('keydown', this.currentKeyHandler);
    }

    document.addEventListener('keydown', keyHandler);
    this.currentKeyHandler = keyHandler;

    // Focus the modal to ensure it receives key events
    const modal = document.getElementById('shortcut-modal');
    if (modal) {
      modal.focus();
    }
  }

  async saveShortcut() {
    if (this.currentShortcut) {
      try {
        if (this.currentGlobalShortcutType) {
          // Save global shortcut - now using config file
          console.log(`Config.js: Saving global shortcut ${this.currentShortcut} for ${this.currentGlobalShortcutType}`);

          const success = await ipcRenderer.invoke('set-global-shortcut', this.currentGlobalShortcutType, this.currentShortcut);

          if (success) {
            // Update local data
            this.globalShortcuts[this.currentGlobalShortcutType] = this.currentShortcut;
            this.updateGlobalShortcutsDisplay();
            console.log('Config.js: Global shortcut saved successfully');
          } else {
            console.error('Config.js: Failed to save global shortcut - may be invalid or conflicting');
            alert('Failed to save shortcut. It may be invalid or already in use.');
          }
        } else if (this.currentShortcutWindowId) {
          // Save window shortcut - now using config file
          console.log(`Config.js: Saving shortcut ${this.currentShortcut} for window ${this.currentShortcutWindowId}`);

          const success = await ipcRenderer.invoke('set-shortcut', this.currentShortcutWindowId, this.currentShortcut);

          if (success) {
            // Update local data
            const window = this.windows.find(w => w.id === this.currentShortcutWindowId);
            if (window) {
              window.shortcut = this.currentShortcut;
              this.renderWindows();
            }
            console.log('Config.js: Shortcut saved successfully');
          } else {
            console.error('Config.js: Failed to save shortcut - may be invalid or conflicting');
            alert('Failed to save shortcut. It may be invalid or already in use.');
          }
        }
      } catch (error) {
        console.error('Config.js: Error saving shortcut:', error);
        alert('Error saving shortcut: ' + error.message);
      }
    } else {
      console.warn('Config.js: No shortcut to save');
      alert('Please press a key or key combination first.');
    }

    this.closeShortcutModal();
  }

  async removeShortcut() {
    if (this.currentGlobalShortcutType) {
      // Remove global shortcut
      await this.removeGlobalShortcut(this.currentGlobalShortcutType);
    } else if (this.currentShortcutWindowId) {
      // Remove window shortcut
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

  closeShortcutModal() {
    const modal = document.getElementById('shortcut-modal');
    const display = document.getElementById('shortcut-display');

    if (modal) {
      modal.style.display = 'none';
    }

    if (display) {
      display.classList.remove('recording', 'captured');
    }

    // Clean up event listener
    if (this.currentKeyHandler) {
      document.removeEventListener('keydown', this.currentKeyHandler);
      this.currentKeyHandler = null;
    }

    this.currentShortcutWindowId = null;
    this.currentGlobalShortcutType = null;
    this.currentShortcut = '';
  }

  // Class Modal
  showClassModal(windowId) {
    const modal = document.getElementById('class-modal');
    const classGrid = document.getElementById('class-grid');

    if (modal && classGrid) {
      this.currentClassWindowId = windowId;

      // Populate class grid
      let classHTML = '';
      Object.keys(this.dofusClasses).forEach(classKey => {
        const classInfo = this.dofusClasses[classKey];
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
  }

  selectClass(classKey) {
    // Update visual selection
    const classOptions = document.querySelectorAll('.class-option');
    classOptions.forEach(option => {
      option.classList.remove('selected');
    });

    const selectedOption = document.querySelector(`[data-class="${classKey}"]`);
    if (selectedOption) {
      selectedOption.classList.add('selected');
    }

    // Save the class change
    this.saveClassChange(classKey);
  }

  async saveClassChange(classKey) {
    if (this.currentClassWindowId) {
      try {
        const settings = { [`classes.${this.currentClassWindowId}`]: classKey };
        await ipcRenderer.invoke('save-settings', settings);

        // Update local data
        const window = this.windows.find(w => w.id === this.currentClassWindowId);
        if (window) {
          window.dofusClass = classKey;
          window.avatar = this.dofusClasses[classKey].avatar;
          this.renderWindows();
        }

        // Close modal after a short delay
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