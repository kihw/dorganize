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
      this.elements.modal.style.display = 'flex';
    } catch (error) {
      console.error('AutoKeyManager: Error showing modal:', error);
    }
  }

  closeModal() {
    this.elements.modal.style.display = 'none';
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
      this.elements.autoKeyPreviewList.innerHTML = '<p style="color: #7f8c8d; font-style: italic;">No windows available for preview</p>';
      return;
    }

    // Sort windows by initiative (highest first), then by character name
    const sortedWindows = [...windows].sort((a, b) => {
      if (b.initiative !== a.initiative) {
        return b.initiative - a.initiative;
      }
      return a.character.localeCompare(b.character);
    });

    const enabledWindows = sortedWindows.filter(w => w.enabled !== false);
    
    if (enabledWindows.length === 0) {
      this.elements.autoKeyPreviewList.innerHTML = '<p style="color: #7f8c8d; font-style: italic;">No enabled windows for preview</p>';
      return;
    }

    let previewHTML = '';
    
    enabledWindows.forEach((window, index) => {
      const position = index + 1;
      const shortcut = this.generateShortcutForPosition(position);
      const displayName = window.customName || window.character;
      const dofusClasses = this.configRenderer.dofusClasses;
      const className = dofusClasses[window.dofusClass]?.name || 'Feca';

      previewHTML += `
        <div class="preview-item">
          <div class="preview-order">${position}</div>
          <div class="preview-character">${displayName}</div>
          <div class="preview-initiative">Initiative: ${window.initiative || 0}</div>
          <div class="preview-shortcut">${shortcut}</div>
        </div>
      `;
    });

    this.elements.autoKeyPreviewList.innerHTML = previewHTML;
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
        // AZERTYUI preset: use the top row letters
        const azertyuiKeys = ['A', 'Z', 'E', 'R', 'T', 'Y', 'U', 'I'];
        return azertyuiKeys[position - 1] || `Pos${position}`;
      case 'custom':
        const customPattern = this.settings.customPattern || 'Ctrl+Alt+{n}';
        return customPattern.replace('{n}', position.toString());
      default:
        return position.toString();
    }
  }

  async applyConfiguration() {
    try {
      console.log('AutoKeyManager: Applying configuration...');
      
      if (!this.settings.enabled) {
        console.warn('AutoKeyManager: Auto Key is not enabled');
        return;
      }

      // Prepare configuration data
      const configData = {
        enabled: this.settings.enabled,
        pattern: this.settings.pattern,
        customPattern: this.settings.customPattern,
        windows: this.configRenderer.windows
      };

      // Send to backend
      const { ipcRenderer } = require('electron');
      const success = await ipcRenderer.invoke('apply-auto-key-configuration', configData);
      
      if (success) {
        console.log('AutoKeyManager: Configuration applied successfully');
        
        // Refresh windows to get updated shortcuts
        await this.configRenderer.refreshWindows();
        
        // Show success message
        this.showMessage('Auto Key configuration applied successfully!', 'success');
        
        // Close modal after short delay
        setTimeout(() => {
          this.closeModal();
        }, 1500);
      } else {
        this.showMessage('Failed to apply Auto Key configuration', 'error');
      }
    } catch (error) {
      console.error('AutoKeyManager: Error applying configuration:', error);
      this.showMessage('Error applying Auto Key configuration', 'error');
    }
  }

  async disableAutoKey() {
    try {
      console.log('AutoKeyManager: Disabling Auto Key...');
      
      // Disable Auto Key
      const { ipcRenderer } = require('electron');
      const success = await ipcRenderer.invoke('disable-auto-key');
      
      if (success) {
        console.log('AutoKeyManager: Auto Key disabled successfully');
        
        // Update local settings
        this.settings.enabled = false;
        this.elements.autoKeyEnabled.checked = false;
        this.toggleSettingsPanel(false);
        this.updateButtons();
        
        // Refresh windows to remove auto-generated shortcuts
        await this.configRenderer.refreshWindows();
        
        // Show success message
        this.showMessage('Auto Key disabled successfully!', 'success');
        
        // Close modal after short delay
        setTimeout(() => {
          this.closeModal();
        }, 1500);
      } else {
        this.showMessage('Failed to disable Auto Key', 'error');
      }
    } catch (error) {
      console.error('AutoKeyManager: Error disabling Auto Key:', error);
      this.showMessage('Error disabling Auto Key', 'error');
    }
  }

  showMessage(message, type = 'info') {
    // Create a temporary message element
    const messageEl = document.createElement('div');
    messageEl.className = `auto-key-message ${type}`;
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

  // Method to update preview when windows change
  onWindowsUpdated() {
    this.updatePreview();
  }
}

module.exports = AutoKeyManager;