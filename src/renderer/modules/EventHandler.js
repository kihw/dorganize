/**
 * EventHandler - Centralizes all event handling logic
 */
class EventHandler {
  constructor(configRenderer) {
    this.configRenderer = configRenderer;
    this.setupEventListeners();
  }

  setupEventListeners() {
    this.setupButtonEvents();
    this.setupFormEvents();
    this.setupKeyboardEvents();
    this.setupWindowEvents();
  }

  setupButtonEvents() {
    const elements = this.configRenderer.getElements();

    // Main action buttons
    this.addClickHandler(elements.refreshBtn, () => this.handleRefresh());
    this.addClickHandler(elements.languageBtn, () => this.handleLanguageClick());
    this.addClickHandler(elements.organizeBtn, () => this.handleOrganizeClick());
    this.addClickHandler(elements.globalShortcutsBtn, () => this.handleGlobalShortcutsClick());
    this.addClickHandler(elements.autoKeyConfigBtn, () => this.handleAutoKeyConfigClick());
    this.addClickHandler(elements.nextWindowBtn, () => this.handleNextWindowClick());
    this.addClickHandler(elements.toggleShortcutsBtn, () => this.handleToggleShortcutsClick());
  }

  setupFormEvents() {
    const elements = this.configRenderer.getElements();

    // Dock settings
    this.addChangeHandler(elements.dockEnabled, () => this.handleDockSettingsChange());
    this.addChangeHandler(elements.dockPosition, () => this.handleDockSettingsChange());

    // Window-specific events will be handled dynamically when windows are rendered
  }

  setupKeyboardEvents() {
    // Global keyboard shortcuts
    document.addEventListener('keydown', (e) => this.handleGlobalKeyDown(e));
    document.addEventListener('keyup', (e) => this.handleGlobalKeyUp(e));

    // Prevent context menu
    document.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  setupWindowEvents() {
    // Window focus/blur
    window.addEventListener('focus', () => this.handleWindowFocus());
    window.addEventListener('blur', () => this.handleWindowBlur());

    // Window resize
    window.addEventListener('resize', () => this.handleWindowResize());

    // Before unload
    window.addEventListener('beforeunload', (e) => this.handleBeforeUnload(e));
  }

  // Event handlers
  async handleRefresh() {
    try {
      console.log('EventHandler: Refresh button clicked');
      // CORRECTION: Appeler refreshWindows() sur configRenderer, pas sur windowRenderer
      await this.configRenderer.refreshWindows();
    } catch (error) {
      console.error('EventHandler: Error during refresh:', error);
      this.configRenderer.uiManager.showErrorMessage('Failed to refresh windows');
    }
  }

  handleLanguageClick() {
    console.log('EventHandler: Language button clicked');
    this.configRenderer.modalManager.showLanguageModal();
  }

  handleOrganizeClick() {
    console.log('EventHandler: Organize button clicked');
    this.configRenderer.modalManager.showOrganizeModal();
  }

  handleGlobalShortcutsClick() {
    console.log('EventHandler: Global shortcuts button clicked');
    this.configRenderer.modalManager.showGlobalShortcutsModal();
  }

  handleAutoKeyConfigClick() {
    console.log('EventHandler: Auto key config button clicked');
    this.configRenderer.autoKeyManager.showModal();
  }

  async handleNextWindowClick() {
    try {
      console.log('EventHandler: Next window button clicked');
      await this.configRenderer.activateNextWindow();
    } catch (error) {
      console.error('EventHandler: Error activating next window:', error);
      this.configRenderer.uiManager.showErrorMessage('Failed to activate next window');
    }
  }

  async handleToggleShortcutsClick() {
    try {
      console.log('EventHandler: Toggle shortcuts button clicked');
      await this.configRenderer.toggleShortcuts();
    } catch (error) {
      console.error('EventHandler: Error toggling shortcuts:', error);
      this.configRenderer.uiManager.showErrorMessage('Failed to toggle shortcuts');
    }
  }

  async handleDockSettingsChange() {
    try {
      console.log('EventHandler: Dock settings changed');
      await this.configRenderer.settingsManager.updateDockSettings();
    } catch (error) {
      console.error('EventHandler: Error updating dock settings:', error);
      this.configRenderer.uiManager.showErrorMessage('Failed to update dock settings');
    }
  }

  handleGlobalKeyDown(e) {
    // Handle global keyboard shortcuts
    if (e.key === 'Escape') {
      this.configRenderer.modalManager.handleEscapeKey();
    }

    // Debug shortcuts (Ctrl+Shift+D for debug info)
    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
      e.preventDefault();
      this.showDebugInfo();
    }

    // Refresh shortcut (F5 or Ctrl+R)
    if (e.key === 'F5' || (e.ctrlKey && e.key === 'r')) {
      e.preventDefault();
      this.handleRefresh();
    }

    // Auto Key shortcut (Ctrl+Shift+A)
    if (e.ctrlKey && e.shiftKey && e.key === 'A') {
      e.preventDefault();
      this.handleAutoKeyConfigClick();
    }

    // Settings export/import shortcuts
    if (e.ctrlKey && e.shiftKey && e.key === 'E') {
      e.preventDefault();
      this.configRenderer.settingsManager.exportSettings();
    }
  }

  handleGlobalKeyUp(e) {
    // Handle key release events if needed
    // Currently not used, but available for future functionality
  }

  handleWindowsUpdated(event, windows) {
    console.log('EventHandler: Windows updated event received with', windows.length, 'windows');
    this.configRenderer.windows = windows;
    this.configRenderer.windowRenderer.renderWindows();

    // CORRECTION: Appeler updatePreview au lieu de onWindowsUpdated
    if (this.configRenderer.autoKeyManager) {
      this.configRenderer.autoKeyManager.updatePreview();
    }

    this.configRenderer.uiManager.updateWindowCount();
  }

  handleLanguageChanged(event, language) {
    console.log('EventHandler: Language changed event received');
    this.configRenderer.language = language;
    this.configRenderer.uiManager.updateLanguageUI();
  }

  handleSettingsUpdated(event, settings) {
    console.log('EventHandler: Settings updated event received');
    Object.assign(this.configRenderer.settings, settings);
    this.configRenderer.settingsManager.updateUIFromSettings();
  }

  handleError(event, error) {
    console.error('EventHandler: IPC error received:', error);
    this.configRenderer.uiManager.showErrorMessage('An error occurred: ' + error.message);
  }

  handleWindowFocus() {
    console.log('EventHandler: Window focused');
    // Could refresh window data when window regains focus
  }

  handleWindowBlur() {
    console.log('EventHandler: Window blurred');
    // Could save pending changes when window loses focus
  }

  handleWindowResize() {
    // Handle window resize if needed
    // Could adjust layout or notify components
  }

  handleBeforeUnload(e) {
    const hasUnsavedChanges = this.configRenderer.settingsManager.hasUnsavedChanges();

    if (hasUnsavedChanges) {
      e.preventDefault();
      e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
      return e.returnValue;
    }
  }

  // Dynamic event handlers for window-specific elements
  setupWindowElementEvents() {
    // Character name inputs
    document.querySelectorAll('.character-name-input').forEach(input => {
      this.addChangeHandler(input, (e) => this.handleCharacterNameChange(e));
    });

    // Initiative inputs
    document.querySelectorAll('.initiative-input').forEach(input => {
      this.addChangeHandler(input, (e) => this.handleInitiativeChange(e));
    });

    // Window avatars
    document.querySelectorAll('.window-avatar').forEach(avatar => {
      this.addClickHandler(avatar, (e) => this.handleWindowAvatarClick(e));
    });

    // Class displays
    document.querySelectorAll('.class-display').forEach(display => {
      this.addClickHandler(display, (e) => this.handleClassDisplayClick(e));
    });

    // Shortcut displays
    document.querySelectorAll('.shortcut-display').forEach(display => {
      this.addClickHandler(display, (e) => this.handleShortcutDisplayClick(e));
    });
  }

  async handleCharacterNameChange(e) {
    const windowId = e.target.dataset.windowId;
    const newName = e.target.value;

    if (this.configRenderer.settingsManager.validateCharacterName(newName)) {
      await this.configRenderer.settingsManager.updateCharacterName(windowId, newName);
    } else {
      this.configRenderer.uiManager.showErrorMessage('Invalid character name');
      // Reset to previous value
      const window = this.configRenderer.windows.find(w => w.id === windowId);
      if (window) {
        e.target.value = window.customName || window.character;
      }
    }
  }

  async handleInitiativeChange(e) {
    const windowId = e.target.dataset.windowId;
    const newInitiative = e.target.value;

    if (this.configRenderer.settingsManager.validateInitiative(newInitiative)) {
      await this.configRenderer.settingsManager.updateInitiative(windowId, newInitiative);
    } else {
      this.configRenderer.uiManager.showErrorMessage('Invalid initiative value (0-9999)');
      // Reset to previous value
      const window = this.configRenderer.windows.find(w => w.id === windowId);
      if (window) {
        e.target.value = window.initiative || 0;
      }
    }
  }

  async handleWindowAvatarClick(e) {
    e.preventDefault();
    const windowId = e.target.closest('.window-item').dataset.windowId;
    await this.configRenderer.activateWindow(windowId);
  }

  handleClassDisplayClick(e) {
    const windowId = e.target.closest('.window-item').dataset.windowId;
    this.configRenderer.modalManager.showClassModal(windowId);
  }

  handleShortcutDisplayClick(e) {
    const windowId = e.target.closest('.window-item').dataset.windowId;
    this.configRenderer.showShortcutModal(windowId);
  }

  // Utility methods
  addClickHandler(element, handler) {
    if (element) {
      element.addEventListener('click', handler);
    }
  }

  addChangeHandler(element, handler) {
    if (element) {
      element.addEventListener('change', handler);
    }
  }

  removeEventListener(element, event, handler) {
    if (element) {
      element.removeEventListener(event, handler);
    }
  }

  showDebugInfo() {
    const debugInfo = {
      windows: this.configRenderer.windows.length,
      settings: Object.keys(this.configRenderer.settings).length,
      language: this.configRenderer.language ? 'loaded' : 'not loaded',
      managers: {
        autoKey: !!this.configRenderer.autoKeyManager,
        shortcuts: !!this.configRenderer.shortcutManager,
        modal: !!this.configRenderer.modalManager,
        windowRenderer: !!this.configRenderer.windowRenderer,
        ui: !!this.configRenderer.uiManager,
        settings: !!this.configRenderer.settingsManager,
        events: !!this.configRenderer.eventHandler
      },
      performance: {
        loadTime: performance.now(),
        memory: performance.memory ? {
          used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
          total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
          limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
        } : 'not available'
      }
    };

    console.log('Debug Info:', debugInfo);
    this.configRenderer.uiManager.showInfoMessage('Debug info logged to console');
  }

  // Performance monitoring
  measurePerformance(operation, fn) {
    const start = performance.now();
    const result = fn();
    const end = performance.now();

    console.log(`EventHandler: ${operation} took ${end - start} milliseconds`);
    return result;
  }

  // Throttle and debounce utilities
  throttle(fn, delay) {
    let timeoutId;
    let lastExecTime = 0;

    return function (...args) {
      const currentTime = Date.now();

      if (currentTime - lastExecTime > delay) {
        fn.apply(this, args);
        lastExecTime = currentTime;
      } else {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          fn.apply(this, args);
          lastExecTime = Date.now();
        }, delay - (currentTime - lastExecTime));
      }
    };
  }

  debounce(fn, delay) {
    let timeoutId;

    return function (...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  // Error boundary handling
  handleComponentError(error, componentName) {
    console.error(`EventHandler: Error in ${componentName}:`, error);
    this.configRenderer.uiManager.showErrorMessage(`Error in ${componentName}: ${error.message}`);

    // Could send error reports to a logging service here
    this.reportError(error, componentName);
  }

  reportError(error, context) {
    // Placeholder for error reporting
    const errorReport = {
      timestamp: new Date().toISOString(),
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      },
      context,
      userAgent: navigator.userAgent,
      url: window.location.href,
      appVersion: '0.4.1'
    };

    console.log('Error Report:', errorReport);
    // In a real app, this would send to an error tracking service
  }

  cleanup() {
    // Remove all event listeners if needed
    console.log('EventHandler: Cleaning up event listeners');

    // Clear any pending timeouts
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = EventHandler;
}