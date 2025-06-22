/**
 * WindowRenderer - Handles all window rendering and window-related UI operations
 */
class WindowRenderer {
  constructor(configRenderer) {
    this.configRenderer = configRenderer;
  }

  renderWindows() {
    const windows = this.configRenderer.getWindows();
    const elements = this.configRenderer.getElements();

    if (!windows || windows.length === 0) {
      this.showNoWindows();
      return;
    }

    this.hideNoWindows();

    // Sort windows by initiative (highest first) then by character name
    const sortedWindows = [...windows].sort((a, b) => {
      if (b.initiative !== a.initiative) {
        return b.initiative - a.initiative;
      }
      return a.character.localeCompare(b.character);
    });

    let windowsHTML = '';
    sortedWindows.forEach((window, index) => {
      windowsHTML += this.renderWindowItem(window, index + 1);
    });

    elements.windowsList.innerHTML = windowsHTML;
    elements.windowCount.textContent = `${windows.length} windows detected`;

    this.addWindowEventListeners();
  }

  renderWindowItem(window, order) {
    const dofusClasses = this.configRenderer.getDofusClasses();
    const language = this.configRenderer.getLanguage();
    
    const displayName = window.customName || window.character;
    const className = dofusClasses[window.dofusClass]?.name || 'Feca';
    const shortcutText = window.shortcut || (language.shortcut_none || 'No shortcut');
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
    const elements = this.configRenderer.getElements();
    elements.noWindows.style.display = 'block';
    elements.windowsList.style.display = 'none';
  }

  hideNoWindows() {
    const elements = this.configRenderer.getElements();
    elements.noWindows.style.display = 'none';
    elements.windowsList.style.display = 'block';
  }

  addWindowEventListeners() {
    // Setup dynamic event listeners for window elements
    if (this.configRenderer.eventHandler) {
      this.configRenderer.eventHandler.setupWindowElementEvents();
    }
  }

  async activateWindow(windowId) {
    try {
      console.log(`WindowRenderer: Activating window ${windowId}`);
      const { ipcRenderer } = require('electron');
      const success = await ipcRenderer.invoke('activate-window', windowId);
      
      if (success) {
        const windows = this.configRenderer.getWindows();
        windows.forEach(w => {
          w.isActive = w.id === windowId;
        });
        this.renderWindows();
      }
    } catch (error) {
      console.error('WindowRenderer: Error activating window:', error);
    }
  }

  async refreshWindows() {
    try {
      const elements = this.configRenderer.getElements();
      elements.refreshBtn.disabled = true;
      elements.refreshBtn.textContent = 'Refreshing...';

      const { ipcRenderer } = require('electron');
      await ipcRenderer.invoke('refresh-windows');

      setTimeout(() => {
        elements.refreshBtn.disabled = false;
        elements.refreshBtn.innerHTML = '<img src="../../assets/icons/refresh.png" alt="Refresh" onerror="this.style.display=\'none\'"><span>Refresh</span>';
      }, 1000);
    } catch (error) {
      console.error('WindowRenderer: Error refreshing windows:', error);
      const elements = this.configRenderer.getElements();
      elements.refreshBtn.disabled = false;
      elements.refreshBtn.innerHTML = '<img src="../../assets/icons/refresh.png" alt="Refresh" onerror="this.style.display=\'none\'"><span>Refresh</span>';
    }
  }

  // Utility methods for window rendering
  generateWindowId(character, dofusClass) {
    return `${character.toLowerCase().replace(/[^a-z0-9]/g, '')}_${dofusClass}`;
  }

  getWindowById(windowId) {
    return this.configRenderer.getWindows().find(w => w.id === windowId);
  }

  updateWindowInList(windowId, updates) {
    const windows = this.configRenderer.getWindows();
    const window = windows.find(w => w.id === windowId);
    
    if (window) {
      Object.assign(window, updates);
      this.renderWindows();
      return true;
    }
    
    return false;
  }

  highlightWindow(windowId, duration = 2000) {
    const windowElement = document.querySelector(`[data-window-id="${windowId}"]`);
    if (windowElement) {
      windowElement.classList.add('highlighted');
      setTimeout(() => {
        windowElement.classList.remove('highlighted');
      }, duration);
    }
  }

  getWindowStats() {
    const windows = this.configRenderer.getWindows();
    return {
      total: windows.length,
      active: windows.filter(w => w.isActive).length,
      enabled: windows.filter(w => w.enabled).length,
      withShortcuts: windows.filter(w => w.shortcut).length,
      classes: [...new Set(windows.map(w => w.dofusClass))].length
    };
  }
}

module.exports = WindowRenderer;