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

      const keys = [];

      if (e.ctrlKey || e.metaKey) keys.push('Ctrl');
      if (e.altKey) keys.push('Alt');
      if (e.shiftKey) keys.push('Shift');

      let mainKey = '';

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

      if (e.key.match(/^F\d+$/)) {
        mainKey = e.key;
      } else if (specialKeys[e.key]) {
        mainKey = specialKeys[e.key];
      } else if (e.key.length === 1 && e.key.match(/[a-zA-Z0-9]/)) {
        mainKey = e.key.toUpperCase();
      } else if (e.key.length === 1) {
        mainKey = e.key;
      } else if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
        return;
      }

      if (mainKey) {
        keys.push(mainKey);
        this.currentShortcut = keys.join('+');
        display.textContent = this.currentShortcut;
        display.classList.remove('recording');
        display.classList.add('captured');

        console.log('Captured shortcut:', this.currentShortcut);
      }
    };

    if (this.currentKeyHandler) {
      document.removeEventListener('keydown', this.currentKeyHandler);
    }

    document.addEventListener('keydown', keyHandler);
    this.currentKeyHandler = keyHandler;

    const modal = document.getElementById('shortcut-modal');
    if (modal) {
      modal.focus();
    }
  }

  async saveShortcut() {
    if (this.currentShortcut) {
      try {
        if (this.currentGlobalShortcutType) {
          console.log(`Config.js: Saving global shortcut ${this.currentShortcut} for ${this.currentGlobalShortcutType}`);

          const success = await ipcRenderer.invoke('set-global-shortcut', this.currentGlobalShortcutType, this.currentShortcut);

          if (success) {
            this.globalShortcuts[this.currentGlobalShortcutType] = this.currentShortcut;
            this.updateGlobalShortcutsDisplay();
            console.log('Config.js: Global shortcut saved successfully');
          } else {
            console.error('Config.js: Failed to save global shortcut - may be invalid or conflicting');
            alert('Failed to save shortcut. It may be invalid or already in use.');
          }
        } else if (this.currentShortcutWindowId) {
          console.log(`Config.js: Saving shortcut ${this.currentShortcut} for window ${this.currentShortcutWindowId}`);

          const success = await ipcRenderer.invoke('set-shortcut', this.currentShortcutWindowId, this.currentShortcut);

          if (success) {
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
      await this.removeGlobalShortcut(this.currentGlobalShortcutType);
    } else if (this.currentShortcutWindowId) {
      try {
        await ipcRenderer.invoke('remove-shortcut', this.currentShortcutWindowId);

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