/**
 * ShortcutManager - Handles all shortcut recording and management functionality
 */
class ShortcutManager {
  constructor(configRenderer) {
    this.configRenderer = configRenderer;
    this.isRecording = false;
    this.currentWindowId = null;
    this.currentGlobalShortcutType = null;
    this.elements = {};
    
    this.initializeElements();
    this.setupEventListeners();
  }

  initializeElements() {
    this.elements = {
      shortcutModal: document.getElementById('shortcut-modal'),
      shortcutTitle: document.getElementById('shortcut-title'),
      shortcutDisplay: document.getElementById('shortcut-display'),
      shortcutInstruction: document.getElementById('shortcut-instruction'),
      shortcutSave: document.getElementById('shortcut-save'),
      shortcutCancel: document.getElementById('shortcut-cancel'),
      shortcutRemove: document.getElementById('shortcut-remove')
    };
  }

  setupEventListeners() {
    // Shortcut modal events
    this.elements.shortcutSave?.addEventListener('click', () => this.saveShortcut());
    this.elements.shortcutCancel?.addEventListener('click', () => this.closeModal());
    this.elements.shortcutRemove?.addEventListener('click', () => this.removeShortcut());

    // Keyboard shortcut capture
    document.addEventListener('keydown', (e) => this.handleKeyboardInput(e));
  }

  showModal(windowId, windowName = 'Unknown') {
    this.currentWindowId = windowId;
    this.currentGlobalShortcutType = null;

    this.elements.shortcutTitle.textContent = `Set Shortcut for ${windowName}`;
    this.elements.shortcutDisplay.textContent = 'Press any key or combination...';
    this.elements.shortcutDisplay.className = 'shortcut-display-modal';
    this.elements.shortcutModal.style.display = 'flex';

    this.startRecording();
  }

  showGlobalShortcutModal(type) {
    this.currentGlobalShortcutType = type;
    this.currentWindowId = null;

    const typeNames = {
      'nextWindow': 'Next Window',
      'toggleShortcuts': 'Toggle Shortcuts'
    };

    this.elements.shortcutTitle.textContent = `Set Global Shortcut for ${typeNames[type] || type}`;
    this.elements.shortcutDisplay.textContent = 'Press any key or combination...';
    this.elements.shortcutDisplay.className = 'shortcut-display-modal';
    this.elements.shortcutModal.style.display = 'flex';

    this.startRecording();
  }

  closeModal() {
    this.elements.shortcutModal.style.display = 'none';
    this.stopRecording();
    this.currentWindowId = null;
    this.currentGlobalShortcutType = null;
  }

  startRecording() {
    this.isRecording = true;
    this.elements.shortcutDisplay.className = 'shortcut-display-modal recording';
    this.elements.shortcutDisplay.textContent = 'Press any key combination...';
  }

  stopRecording() {
    this.isRecording = false;
  }

  handleKeyboardInput(e) {
    if (!this.isRecording || this.elements.shortcutModal.style.display !== 'flex') {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    const shortcut = this.buildShortcutString(e);

    this.elements.shortcutDisplay.textContent = shortcut;
    this.elements.shortcutDisplay.className = 'shortcut-display-modal captured';

    this.stopRecording();
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
    const shortcut = this.elements.shortcutDisplay.textContent;
    if (shortcut && shortcut !== 'Press any key or combination...') {
      try {
        const { ipcRenderer } = require('electron');
        let success = false;

        if (this.currentGlobalShortcutType) {
          // Save global shortcut
          success = await ipcRenderer.invoke('set-global-shortcut', this.currentGlobalShortcutType, shortcut);
          if (success) {
            console.log(`ShortcutManager: Global shortcut ${this.currentGlobalShortcutType} set to ${shortcut}`);
            // Update the global shortcuts modal if it's open
            this.updateGlobalShortcutDisplay(this.currentGlobalShortcutType, shortcut);
          }
        } else if (this.currentWindowId) {
          // Save window shortcut
          success = await ipcRenderer.invoke('set-shortcut', this.currentWindowId, shortcut);
          if (success) {
            console.log(`ShortcutManager: Window shortcut for ${this.currentWindowId} set to ${shortcut}`);
            // Update local data in config renderer
            const window = this.configRenderer.windows.find(w => w.id === this.currentWindowId);
            if (window) {
              window.shortcut = shortcut;
              this.configRenderer.renderWindows();
            }
          }
        }

        if (!success) {
          this.showMessage('Failed to save shortcut. It may conflict with an existing shortcut.', 'error');
        }
      } catch (error) {
        console.error('ShortcutManager: Error saving shortcut:', error);
        this.showMessage('Error saving shortcut', 'error');
      }
    }
    this.closeModal();
  }

  async removeShortcut() {
    try {
      const { ipcRenderer } = require('electron');
      let success = false;

      if (this.currentGlobalShortcutType) {
        // Remove global shortcut
        success = await ipcRenderer.invoke('remove-global-shortcut', this.currentGlobalShortcutType);
        if (success) {
          console.log(`ShortcutManager: Global shortcut ${this.currentGlobalShortcutType} removed`);
          this.updateGlobalShortcutDisplay(this.currentGlobalShortcutType, 'No shortcut');
        }
      } else if (this.currentWindowId) {
        // Remove window shortcut
        success = await ipcRenderer.invoke('remove-shortcut', this.currentWindowId);
        if (success) {
          console.log(`ShortcutManager: Window shortcut for ${this.currentWindowId} removed`);
          // Update local data in config renderer
          const window = this.configRenderer.windows.find(w => w.id === this.currentWindowId);
          if (window) {
            window.shortcut = null;
            this.configRenderer.renderWindows();
          }
        }
      }

      if (!success) {
        this.showMessage('Failed to remove shortcut', 'error');
      }
    } catch (error) {
      console.error('ShortcutManager: Error removing shortcut:', error);
      this.showMessage('Error removing shortcut', 'error');
    }
    this.closeModal();
  }

  async removeWindowShortcut(windowId) {
    try {
      const { ipcRenderer } = require('electron');
      await ipcRenderer.invoke('remove-shortcut', windowId);

      // Update local data
      const window = this.configRenderer.windows.find(w => w.id === windowId);
      if (window) {
        window.shortcut = null;
        this.configRenderer.renderWindows();
      }
    } catch (error) {
      console.error('ShortcutManager: Error removing window shortcut:', error);
      this.showMessage('Error removing shortcut', 'error');
    }
  }

  updateGlobalShortcutDisplay(type, shortcut) {
    const displayElement = document.getElementById(`${type.replace(/([A-Z])/g, '-$1').toLowerCase()}-shortcut-display`);
    if (displayElement) {
      displayElement.textContent = shortcut;
    }
  }

  showMessage(message, type = 'info') {
    // Create a temporary message element
    const messageEl = document.createElement('div');
    messageEl.className = `shortcut-message ${type}`;
    messageEl.textContent = message;
    messageEl.style.cssText = `
      position: fixed;
      top: 50px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 6px;
      font-weight: 500;
      z-index: 10000;
      transition: all 0.3s ease;
      ${type === 'success' ? 'background: #27ae60; color: white;' : ''}
      ${type === 'error' ? 'background: #e74c3c; color: white;' : ''}
      ${type === 'info' ? 'background: #3498db; color: white;' : ''}
    `;
    
    document.body.appendChild(messageEl);
    
    // Remove after 3 seconds
    setTimeout(() => {
      messageEl.style.opacity = '0';
      messageEl.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (messageEl.parentNode) {
          messageEl.parentNode.removeChild(messageEl);
        }
      }, 300);
    }, 3000);
  }

  // Utility methods for external use
  validateShortcut(shortcut) {
    // Basic validation - could be expanded
    return shortcut && shortcut.trim().length > 0 && shortcut !== 'Press any key or combination...';
  }

  formatShortcut(shortcut) {
    if (!shortcut) return 'No shortcut';
    
    return shortcut
      .replace(/CommandOrControl/g, 'Ctrl')
      .replace(/\+/g, ' + ')
      .split(' + ')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' + ');
  }
}

module.exports = ShortcutManager;