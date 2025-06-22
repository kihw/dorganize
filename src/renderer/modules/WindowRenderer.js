/**
 * WindowRenderer - Handles all window rendering and window-related UI operations
 */
class WindowRenderer {
  constructor(configRenderer) {
    this.configRenderer = configRenderer;
    console.log('WindowRenderer: Initialized');
  }

  // Ajouter cette méthode pour éviter les erreurs futures
  async refreshWindows() {
    console.log('WindowRenderer: Delegating refresh to ConfigRenderer...');
    return await this.configRenderer.refreshWindows();
  }

  renderWindows() {
    const windows = this.configRenderer.windows || [];
    console.log('WindowRenderer: Rendering', windows.length, 'windows');
    console.log('WindowRenderer: Windows data:', windows);

    // Find elements directly instead of using configRenderer.elements
    const windowsList = document.getElementById('windows-list');
    const noWindows = document.getElementById('no-windows');
    const windowCount = document.getElementById('window-count');

    console.log('WindowRenderer: Found elements:', {
      windowsList: !!windowsList,
      noWindows: !!noWindows,
      windowCount: !!windowCount
    });

    if (!windows || windows.length === 0) {
      console.log('WindowRenderer: No windows to display, showing no-windows message');
      if (windowsList) {
        windowsList.style.display = 'none';
        windowsList.innerHTML = '';
      }
      if (noWindows) {
        noWindows.style.display = 'block';
      }
      if (windowCount) {
        windowCount.textContent = '0 windows detected';
      }
      return;
    }

    console.log('WindowRenderer: Displaying', windows.length, 'windows');

    if (windowsList) {
      windowsList.style.display = 'block';
      // Generate HTML for all windows
      const windowsHTML = windows.map((window, index) =>
        this.renderWindowItem(window, index + 1)
      ).join('');
      windowsList.innerHTML = windowsHTML;
      console.log('WindowRenderer: HTML updated with', windows.length, 'windows');
    }

    if (noWindows) {
      noWindows.style.display = 'none';
    }

    if (windowCount) {
      windowCount.textContent = `${windows.length} window(s) detected`;
    }
  }

  renderWindowItem(window, order) {
    // Ensure we have default values
    const displayName = window.customName || window.character || 'Unknown Character';
    const className = window.dofusClass || 'Unknown Class';
    const shortcutText = window.shortcut || 'No shortcut';
    const avatarSrc = `../../assets/avatars/${window.avatar || '1'}.jpg`;
    const isActive = window.isActive ? 'active' : '';
    const isDisabled = !window.enabled ? 'disabled' : '';
    const initiative = window.initiative || 0;

    console.log(`WindowRenderer: Rendering window ${order}: ${displayName} (${className})`);

    return `
      <div class="window-item ${isActive} ${isDisabled}" data-window-id="${window.id}" data-class="${window.dofusClass}">
        <div class="window-header">
          <div class="window-avatar" onclick="configRenderer.activateWindow('${window.id}')" title="Click to activate window">
            <img src="${avatarSrc}" alt="${className}" onerror="this.src='../../assets/avatars/1.jpg'">
            <div class="initiative-order-badge">${order}</div>
          </div>
          <div class="window-info">
            <div class="window-name-container">
              <input type="text" class="window-name" value="${displayName}" 
                     onchange="configRenderer.updateCharacterName('${window.id}', this.value)"
                     placeholder="Character name">
              <div class="window-class" onclick="configRenderer.showClassModal('${window.id}')" title="Click to change class">
                ${className}
              </div>
            </div>
            <div class="window-details">
              <div class="initiative-container">
                <label>Initiative:</label>
                <input type="number" class="initiative-input" value="${initiative}" min="0" max="9999"
                       onchange="configRenderer.updateInitiative('${window.id}', parseInt(this.value) || 0)">
              </div>
              <div class="process-info">
                PID: ${window.pid || 'Unknown'} | Handle: ${window.handle || 'Unknown'}
              </div>
            </div>
          </div>
        </div>
        <div class="window-controls">
          <div class="shortcut-container">
            <div class="shortcut-display" onclick="configRenderer.showShortcutModal('${window.id}')" 
                 title="Click to set shortcut">
              ${shortcutText}
            </div>
          </div>
          <div class="window-actions">
            <label class="window-toggle">
              <input type="checkbox" ${window.enabled !== false ? 'checked' : ''} 
                     onchange="configRenderer.toggleWindow('${window.id}', this.checked)">
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>
      </div>
    `;
  }

  showNoWindows() {
    const windowsList = document.getElementById('windows-list');
    const noWindows = document.getElementById('no-windows');

    if (windowsList) windowsList.style.display = 'none';
    if (noWindows) noWindows.style.display = 'block';
  }

  hideNoWindows() {
    const windowsList = document.getElementById('windows-list');
    const noWindows = document.getElementById('no-windows');

    if (windowsList) windowsList.style.display = 'block';
    if (noWindows) noWindows.style.display = 'none';
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = WindowRenderer;
}