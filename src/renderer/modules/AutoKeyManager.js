/**
 * AutoKeyManager - Handles all Auto Key Configuration functionality
 */
class AutoKeyManager {
  constructor(configRenderer) {
    this.configRenderer = configRenderer;
    this.settings = {
      enabled: false,
      pattern: 'numbers',
      customPattern: 'Ctrl+Alt+{n}',
      assignments: {}
    };
    this.currentPreset = null;
    this.elements = {};

    this.initializeElements();
    this.setupEventListeners();
  }

  initializeElements() {
    this.elements = {
      autoKeyEnabled: document.getElementById('auto-key-enabled'),
      autoKeySettings: document.getElementById('auto-key-settings'),
      customPatternInput: document.getElementById('custom-pattern-input'),
      autoKeyPreviewList: document.getElementById('auto-key-preview-list'),
      manualShortcutsList: document.getElementById('manual-shortcuts-list'),
      autoKeyApply: document.getElementById('auto-key-apply'),
      autoKeyDisable: document.getElementById('auto-key-disable'),
      modal: document.getElementById('auto-key-config-modal')
    };
  }

  setupEventListeners() {
    // Auto Key settings
    this.elements.autoKeyEnabled?.addEventListener('change', (e) => this.toggleEnabled(e.target.checked));
    this.elements.customPatternInput?.addEventListener('input', () => this.updatePreview());
  }

  async showModal() {
    try {
      console.log('AutoKeyManager: Opening Auto Key modal...');
      await this.loadSettings();

      if (this.elements.modal) {
        this.elements.modal.style.display = 'flex';
        console.log('AutoKeyManager: Modal displayed');
      } else {
        console.error('AutoKeyManager: Modal element not found');
      }
    } catch (error) {
      console.error('AutoKeyManager: Error showing modal:', error);
    }
  }

  closeModal() {
    console.log('AutoKeyManager: Closing Auto Key modal...');
    try {
      if (this.elements.modal) {
        this.elements.modal.style.display = 'none';
        console.log('AutoKeyManager: Modal closed successfully');
      } else {
        console.error('AutoKeyManager: Modal element not found for closing');
      }
    } catch (error) {
      console.error('AutoKeyManager: Error closing modal:', error);
    }
  }

  async loadSettings() {
    try {
      console.log('AutoKeyManager: Loading auto key settings...');

      // Load current settings from backend
      const { ipcRenderer } = require('electron');
      const settings = await ipcRenderer.invoke('get-auto-key-settings').catch(() => ({}));
      this.settings = { ...this.settings, ...settings };

      // Update UI elements
      if (this.elements.autoKeyEnabled) {
        this.elements.autoKeyEnabled.checked = this.settings.enabled;
      }

      if (this.elements.customPatternInput) {
        this.elements.customPatternInput.value = this.settings.customPattern || 'Ctrl+Alt+{n}';
      }

      // Show/hide settings panel
      this.toggleSettingsPanel(this.settings.enabled);

      // Update preview and buttons
      this.updatePreview();
      this.updateButtons();

      console.log('AutoKeyManager: Settings loaded:', this.settings);
    } catch (error) {
      console.error('AutoKeyManager: Error loading settings:', error);
    }
  }

  toggleEnabled(enabled) {
    console.log(`AutoKeyManager: Toggling Auto Key: ${enabled}`);
    this.settings.enabled = enabled;
    this.toggleSettingsPanel(enabled);
    this.updateButtons();
    this.updatePreview();
  }

  toggleSettingsPanel(show) {
    if (this.elements.autoKeySettings) {
      this.elements.autoKeySettings.style.display = show ? 'block' : 'none';
    }
  }

  updateButtons() {
    const enabled = this.settings.enabled;

    if (this.elements.autoKeyApply) {
      this.elements.autoKeyApply.style.display = enabled ? 'inline-block' : 'none';
      this.elements.autoKeyApply.textContent = enabled ? 'Apply Configuration' : 'Enable Auto Key';
    }

    if (this.elements.autoKeyDisable) {
      this.elements.autoKeyDisable.style.display = enabled ? 'inline-block' : 'none';
    }

    // Update preset button states
    document.querySelectorAll('.preset-btn').forEach(btn => {
      btn.classList.remove('btn-primary', 'btn-secondary');
      btn.classList.add('btn-secondary');
    });

    if (this.currentPreset) {
      const activeBtn = document.querySelector(`[onclick*="${this.currentPreset}"]`);
      if (activeBtn) {
        activeBtn.classList.remove('btn-secondary');
        activeBtn.classList.add('btn-primary');
      }
    }
  }

  selectPreset(preset) {
    console.log(`AutoKeyManager: Selected preset: ${preset}`);
    this.currentPreset = preset;
    this.settings.pattern = preset;

    // Update custom pattern if needed
    if (preset === 'custom' && this.elements.customPatternInput) {
      this.settings.customPattern = this.elements.customPatternInput.value;
    }

    this.updateButtons();
    this.updatePreview();
  }

  updatePreview() {
    if (!this.elements.autoKeyPreviewList || !this.settings.enabled) {
      if (this.elements.autoKeyPreviewList) {
        this.elements.autoKeyPreviewList.innerHTML = '<p style="color: #7f8c8d; font-style: italic;">Enable Auto Key to see preview</p>';
      }
      return;
    }

    try {
      this.generatePreview();
    } catch (error) {
      console.error('AutoKeyManager: Error updating preview:', error);
      this.elements.autoKeyPreviewList.innerHTML = '<p style="color: #e74c3c;">Error generating preview</p>';
    }
  }

  generatePreview() {
    const windows = this.configRenderer.windows;

    if (!windows || windows.length === 0) {
      if (this.elements.autoKeyPreviewList) {
        this.elements.autoKeyPreviewList.innerHTML = '<p>No windows detected</p>';
      }
      return;
    }

    // Sort by initiative (highest first)
    const sortedWindows = [...windows].sort((a, b) => {
      if (b.initiative !== a.initiative) {
        return b.initiative - a.initiative;
      }
      return a.character.localeCompare(b.character);
    });

    let previewHTML = '';

    sortedWindows.forEach((window, index) => {
      const position = index + 1;
      const shortcut = this.generateShortcutForPosition(position);
      const displayName = window.customName || window.character;
      const className = window.dofusClass || 'Unknown';

      previewHTML += `
        <div class="preview-item">
          <div class="preview-order">${position}</div>
          <div class="preview-character">${displayName}</div>
          <div class="preview-class">${className}</div>
          <div class="preview-initiative">Initiative: ${window.initiative || 0}</div>
          <div class="preview-shortcut">${shortcut}</div>
        </div>
      `;
    });

    if (this.elements.autoKeyPreviewList) {
      this.elements.autoKeyPreviewList.innerHTML = previewHTML;
    }
  }

  generateShortcutForPosition(position) {
    const pattern = this.settings.pattern;

    switch (pattern) {
      case 'numbers':
        return position.toString();
      case 'function':
        return `F${position}`;
      case 'numpad':
        return `Num${position}`;
      case 'azertyui':
        const azertyuiKeys = ['A', 'Z', 'E', 'R', 'T', 'Y', 'U', 'I'];
        return azertyuiKeys[position - 1] || `Pos${position}`;
      case 'custom':
        const customPattern = this.settings.customPattern;
        return customPattern.replace('{n}', position.toString());
      default:
        return position.toString();
    }
  }

  async applyConfiguration() {
    try {
      console.log('AutoKeyManager: Applying configuration...');

      // Désactiver le bouton pendant l'opération
      if (this.elements.autoKeyApply) {
        this.elements.autoKeyApply.disabled = true;
        this.elements.autoKeyApply.textContent = 'Applying...';
      }

      const configData = {
        enabled: this.settings.enabled,
        pattern: this.settings.pattern,
        customPattern: this.settings.customPattern,
        windows: this.configRenderer.windows
      };

      console.log('AutoKeyManager: Sending config data:', configData);

      const { ipcRenderer } = require('electron');
      const success = await ipcRenderer.invoke('apply-auto-key-configuration', configData);

      if (success) {
        this.showSuccess('Auto Key configuration applied successfully');
        // Pas besoin de rafraîchir les fenêtres ici
        console.log('AutoKeyManager: Configuration applied successfully');
      } else {
        this.showError('Failed to apply Auto Key configuration');
      }
    } catch (error) {
      console.error('AutoKeyManager: Error applying configuration:', error);
      this.showError('Error applying configuration: ' + error.message);
    } finally {
      // Réactiver le bouton
      if (this.elements.autoKeyApply) {
        this.elements.autoKeyApply.disabled = false;
        this.elements.autoKeyApply.textContent = 'Apply Configuration';
      }
    }
  }

  async disableAutoKey() {
    try {
      console.log('AutoKeyManager: Disabling Auto Key...');

      // Désactiver le bouton pendant l'opération
      if (this.elements.autoKeyDisable) {
        this.elements.autoKeyDisable.disabled = true;
        this.elements.autoKeyDisable.textContent = 'Disabling...';
      }

      const { ipcRenderer } = require('electron');
      const success = await ipcRenderer.invoke('disable-auto-key');

      if (success) {
        this.settings.enabled = false;
        this.toggleEnabled(false);
        this.showSuccess('Auto Key disabled successfully');
        console.log('AutoKeyManager: Auto Key disabled successfully');
      } else {
        this.showError('Failed to disable Auto Key');
      }
    } catch (error) {
      console.error('AutoKeyManager: Error disabling Auto Key:', error);
      this.showError('Error disabling Auto Key: ' + error.message);
    } finally {
      // Réactiver le bouton
      if (this.elements.autoKeyDisable) {
        this.elements.autoKeyDisable.disabled = false;
        this.elements.autoKeyDisable.textContent = 'Disable Auto Key';
      }
    }
  }

  showSuccess(message) {
    console.log('AutoKeyManager: Success -', message);

    // Créer une notification visuelle simple
    this.showNotification(message, 'success');
  }

  showError(message) {
    console.error('AutoKeyManager: Error -', message);

    // Créer une notification visuelle simple
    this.showNotification(message, 'error');
  }

  showNotification(message, type = 'info') {
    // Créer une notification simple dans le modal
    const notificationContainer = document.querySelector('.modal-body') || document.body;

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      padding: 10px 15px;
      border-radius: 4px;
      color: white;
      font-size: 14px;
      z-index: 10000;
      max-width: 300px;
      word-wrap: break-word;
      ${type === 'success' ? 'background: #27ae60;' : ''}
      ${type === 'error' ? 'background: #e74c3c;' : ''}
      ${type === 'info' ? 'background: #3498db;' : ''}
    `;

    notification.textContent = message;
    notificationContainer.appendChild(notification);

    // Supprimer la notification après 3 secondes
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 3000);
  }
}

// IMPORTANT: Ajouter l'export à la fin
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AutoKeyManager;
}

