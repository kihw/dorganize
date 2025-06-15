const { ipcRenderer } = require('electron');

class DockRenderer {
  constructor() {
    this.windows = [];
    this.language = {};
    this.settings = {};
    this.refreshing = false;
    this.dofusClasses = {};
        
    this.initializeElements();
    this.setupEventListeners();
    this.loadData();
  }

  initializeElements() {
    this.elements = {
      dockItems: document.getElementById('dock-items')
    };
  }

  setupEventListeners() {
    // IPC listeners
    ipcRenderer.on('windows-updated', (event, windows) => {
      this.windows = windows;
      this.renderDock();
    });

    ipcRenderer.on('language-changed', (event, language) => {
      this.language = language;
      this.renderDock();
    });

    // Prevent context menu on dock
    document.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });

    // Handle window focus/blur
    window.addEventListener('blur', () => {
      // Keep dock always on top
      setTimeout(() => {
        if (window.electronAPI) {
          window.electronAPI.setAlwaysOnTop(true);
        }
      }, 100);
    });

    // Handle keyboard shortcuts for quick window access
    document.addEventListener('keydown', (e) => {
      this.handleKeyboardShortcuts(e);
    });
  }

  async loadData() {
    try {
      this.windows = await ipcRenderer.invoke('get-dofus-windows');
      this.language = await ipcRenderer.invoke('get-language');
      this.settings = await ipcRenderer.invoke('get-settings');
      this.dofusClasses = await ipcRenderer.invoke('get-dofus-classes');
      this.renderDock();
    } catch (error) {
      console.error('Error loading dock data:', error);
    }
  }

  renderDock() {
    const enabledWindows = this.windows.filter(w => w.enabled);
        
    let dockHTML = '';
        
    // Refresh button
    const refreshClass = this.refreshing ? 'refreshing' : '';
    const refreshTooltip = this.language.dock_REFRESH_tooltip || 'Refresh windows';
        
    dockHTML += `
            <div class="dock-item dock-refresh ${refreshClass}" 
                 onclick="dockRenderer.refreshWindows()" 
                 title="${refreshTooltip}">
                <div class="window-icon">⟳</div>
                <div class="tooltip">${refreshTooltip}</div>
            </div>
        `;
        
    // Window items - sorted by initiative (desc) then by character name
    const sortedWindows = enabledWindows.sort((a, b) => {
      if (b.initiative !== a.initiative) {
        return b.initiative - a.initiative;
      }
      return a.character.localeCompare(b.character);
    });

    sortedWindows.forEach((window, index) => {
      // Display only character name, not full title
      const displayName = window.customName || window.character;
      const className = this.dofusClasses[window.dofusClass]?.name || 'Feca';
      const shortcutText = window.shortcut || (this.language.shortcut_none || 'No shortcut');
      const tooltip = `${displayName} (${className})\n${this.language.dock_FENETRE_tooltip?.replace('{0}', shortcutText) || `Shortcut: ${shortcutText}`}`;
      const activeClass = window.isActive ? 'active' : '';
            
      // Use .jpg extension for avatars - avatar is now determined by class
      const avatarSrc = `../../assets/avatars/${window.avatar}.jpg`;
      const fallbackSrc = '../../assets/avatars/1.jpg';
            
      dockHTML += `
                <div class="dock-item window-item ${activeClass}" 
                     onclick="dockRenderer.activateWindow('${window.id}')"
                     onmouseenter="dockRenderer.showTooltip(this, '${this.escapeHtml(tooltip)}')"
                     onmouseleave="dockRenderer.hideTooltip(this)"
                     data-window-id="${window.id}"
                     data-class="${window.dofusClass}"
                     data-index="${index + 1}">
                    <img src="${avatarSrc}" 
                         alt="${this.escapeHtml(displayName)}"
                         onerror="this.src='${fallbackSrc}'"
                         title="${className}">
                    <div class="tooltip">${this.escapeHtml(displayName)}<br>${this.escapeHtml(className)}<br>${this.escapeHtml(shortcutText)}</div>
                    ${window.shortcut ? `<div class="shortcut-label">${this.escapeHtml(window.shortcut)}</div>` : ''}
                    ${window.initiative > 0 ? `<div class="initiative-badge">${window.initiative}</div>` : ''}
                    <div class="index-badge">${index + 1}</div>
                    <div class="class-indicator" title="${className}"></div>
                </div>
            `;
    });
        
    // Config button
    const configTooltip = this.language.dock_CONFIG_tooltip || 'Configuration';
    dockHTML += `
            <div class="dock-item dock-config" 
                 onclick="dockRenderer.showConfig()" 
                 title="${configTooltip}">
                <div class="window-icon">⚙</div>
                <div class="tooltip">${configTooltip}</div>
            </div>
        `;
        
    this.elements.dockItems.innerHTML = dockHTML;
        
    // Apply class-specific styling
    this.applyClassStyling();
        
    // Update dock size based on content
    this.updateDockSize();
  }

  applyClassStyling() {
    // Apply class-specific colors and effects
    const windowItems = document.querySelectorAll('.dock-item.window-item');
        
    windowItems.forEach(item => {
      const className = item.dataset.class;
      const classIndicator = item.querySelector('.class-indicator');
            
      if (className && this.dofusClasses[className] && classIndicator) {
        // Apply class-specific colors
        const classColors = this.getClassColors(className);
        classIndicator.style.background = classColors.gradient;
        classIndicator.style.borderColor = classColors.border;
                
        // Add subtle glow effect
        item.style.setProperty('--class-color', classColors.primary);
      }
    });
  }

  getClassColors(className) {
    const colorMap = {
      'feca': { primary: '#8e44ad', gradient: 'linear-gradient(135deg, #8e44ad, #9b59b6)', border: '#8e44ad' },
      'osamodas': { primary: '#27ae60', gradient: 'linear-gradient(135deg, #27ae60, #2ecc71)', border: '#27ae60' },
      'enutrof': { primary: '#f39c12', gradient: 'linear-gradient(135deg, #f39c12, #f1c40f)', border: '#f39c12' },
      'sram': { primary: '#2c3e50', gradient: 'linear-gradient(135deg, #2c3e50, #34495e)', border: '#2c3e50' },
      'xelor': { primary: '#3498db', gradient: 'linear-gradient(135deg, #3498db, #5dade2)', border: '#3498db' },
      'ecaflip': { primary: '#e74c3c', gradient: 'linear-gradient(135deg, #e74c3c, #ec7063)', border: '#e74c3c' },
      'eniripsa': { primary: '#f1c40f', gradient: 'linear-gradient(135deg, #f1c40f, #f7dc6f)', border: '#f1c40f' },
      'iop': { primary: '#e67e22', gradient: 'linear-gradient(135deg, #e67e22, #f39c12)', border: '#e67e22' },
      'cra': { primary: '#16a085', gradient: 'linear-gradient(135deg, #16a085, #1abc9c)', border: '#16a085' },
      'sadida': { primary: '#2ecc71', gradient: 'linear-gradient(135deg, #2ecc71, #58d68d)', border: '#2ecc71' },
      'sacrieur': { primary: '#c0392b', gradient: 'linear-gradient(135deg, #c0392b, #e74c3c)', border: '#c0392b' },
      'pandawa': { primary: '#9b59b6', gradient: 'linear-gradient(135deg, #9b59b6, #bb8fce)', border: '#9b59b6' },
      'roublard': { primary: '#34495e', gradient: 'linear-gradient(135deg, #34495e, #5d6d7e)', border: '#34495e' },
      'zobal': { primary: '#95a5a6', gradient: 'linear-gradient(135deg, #95a5a6, #bdc3c7)', border: '#95a5a6' },
      'steamer': { primary: '#d35400', gradient: 'linear-gradient(135deg, #d35400, #e67e22)', border: '#d35400' },
      'eliotrope': { primary: '#1abc9c', gradient: 'linear-gradient(135deg, #1abc9c, #48c9b0)', border: '#1abc9c' },
      'huppermage': { primary: '#8e44ad', gradient: 'linear-gradient(135deg, #8e44ad, #a569bd)', border: '#8e44ad' },
      'ouginak': { primary: '#7f8c8d', gradient: 'linear-gradient(135deg, #7f8c8d, #95a5a6)', border: '#7f8c8d' },
      'forgelance': { primary: '#bdc3c7', gradient: 'linear-gradient(135deg, #bdc3c7, #d5dbdb)', border: '#bdc3c7' }
    };
        
    return colorMap[className] || { primary: '#3498db', gradient: 'linear-gradient(135deg, #3498db, #5dade2)', border: '#3498db' };
  }

  updateDockSize() {
    const itemCount = this.elements.dockItems.children.length;
    const itemWidth = 60; // Including gaps
    const padding = 16;
    const newWidth = Math.min(600, itemCount * itemWidth + padding);
        
    // Send resize request to main process if available
    if (window.electronAPI && window.electronAPI.resizeDock) {
      window.electronAPI.resizeDock(newWidth, 70);
    }
  }

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  async activateWindow(windowId) {
    try {
      const success = await ipcRenderer.invoke('activate-window', windowId);
            
      if (success) {
        // Visual feedback
        const windowElement = document.querySelector(`[data-window-id="${windowId}"]`);
        if (windowElement) {
          windowElement.classList.add('activating');
          setTimeout(() => {
            windowElement.classList.remove('activating');
          }, 300);
        }
                
        // Update active state immediately for better UX
        this.windows.forEach(w => {
          w.isActive = w.id === windowId;
        });
        this.renderDock();
      }
    } catch (error) {
      console.error('Error activating window:', error);
    }
  }

  async refreshWindows() {
    if (this.refreshing) return;
        
    try {
      this.refreshing = true;
      this.renderDock(); // Update UI to show refreshing state
            
      await ipcRenderer.invoke('refresh-windows');
            
      // Visual feedback
      setTimeout(() => {
        this.refreshing = false;
        this.renderDock();
      }, 1000);
    } catch (error) {
      console.error('Error refreshing windows:', error);
      this.refreshing = false;
      this.renderDock();
    }
  }

  showConfig() {
    // Send message to main process to show config window
    ipcRenderer.send('show-config');
  }

  showTooltip(element, text) {
    // Enhanced tooltip functionality
    const tooltip = element.querySelector('.tooltip');
    if (tooltip) {
      tooltip.innerHTML = text.replace(/\n/g, '<br>');
      tooltip.style.opacity = '1';
      tooltip.style.visibility = 'visible';
    }
  }

  hideTooltip(element) {
    const tooltip = element.querySelector('.tooltip');
    if (tooltip) {
      tooltip.style.opacity = '0';
      tooltip.style.visibility = 'hidden';
    }
  }

  handleKeyboardShortcuts(e) {
    // Handle dock-specific keyboard shortcuts
        
    // ESC to close dock (if implemented)
    if (e.key === 'Escape') {
      // Could implement dock hiding functionality
      return;
    }
        
    // Number keys 1-9 to activate windows by position
    if (e.key >= '1' && e.key <= '9') {
      e.preventDefault();
      const index = parseInt(e.key) - 1;
      const enabledWindows = this.windows.filter(w => w.enabled);
      if (enabledWindows[index]) {
        this.activateWindow(enabledWindows[index].id);
      }
      return;
    }

    // R key to refresh
    if (e.key.toLowerCase() === 'r' && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      this.refreshWindows();
      return;
    }

    // C key to show config
    if (e.key.toLowerCase() === 'c' && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      this.showConfig();
      return;
    }

    // Arrow keys for navigation
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      e.preventDefault();
      this.navigateWindows(e.key);
      return;
    }
  }

  navigateWindows(direction) {
    const enabledWindows = this.windows.filter(w => w.enabled);
    if (enabledWindows.length === 0) return;

    const currentActiveIndex = enabledWindows.findIndex(w => w.isActive);
    let nextIndex;

    switch (direction) {
    case 'ArrowLeft':
    case 'ArrowUp':
      nextIndex = currentActiveIndex > 0 ? currentActiveIndex - 1 : enabledWindows.length - 1;
      break;
    case 'ArrowRight':
    case 'ArrowDown':
      nextIndex = currentActiveIndex < enabledWindows.length - 1 ? currentActiveIndex + 1 : 0;
      break;
    default:
      return;
    }

    if (enabledWindows[nextIndex]) {
      this.activateWindow(enabledWindows[nextIndex].id);
    }
  }

  // Add method to handle window organization
  async organizeWindows(layout = 'grid') {
    try {
      const success = await ipcRenderer.invoke('organize-windows', layout);
      if (success) {
        // Visual feedback
        const refreshElement = document.querySelector('.dock-refresh');
        if (refreshElement) {
          refreshElement.classList.add('activating');
          setTimeout(() => {
            refreshElement.classList.remove('activating');
          }, 500);
        }
      }
    } catch (error) {
      console.error('Error organizing windows:', error);
    }
  }
}

// Initialize the dock renderer
const dockRenderer = new DockRenderer();

// Export for global access if needed
window.dockRenderer = dockRenderer;

// Add additional CSS for enhanced features
const additionalStyle = document.createElement('style');
additionalStyle.textContent = `
    .index-badge {
        position: absolute;
        top: -6px;
        left: -6px;
        background: linear-gradient(135deg, #3498db, #2980b9);
        color: white;
        font-size: 10px;
        font-weight: bold;
        padding: 2px 6px;
        border-radius: 10px;
        min-width: 16px;
        text-align: center;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        opacity: 0.8;
        transition: opacity 0.3s ease;
    }

    .dock-item:hover .index-badge {
        opacity: 1;
    }

    .class-indicator {
        position: absolute;
        bottom: -3px;
        right: -3px;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
        opacity: 0.9;
        transition: all 0.3s ease;
    }

    .dock-item:hover .class-indicator {
        opacity: 1;
        transform: scale(1.2);
    }

    .dock-item.window-item {
        position: relative;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .dock-item.window-item:hover {
        box-shadow: 0 8px 24px rgba(var(--class-color, 52, 152, 219), 0.3);
    }

    .dock-item.window-item::after {
        content: '';
        position: absolute;
        bottom: -2px;
        left: 50%;
        transform: translateX(-50%);
        width: 0;
        height: 2px;
        background: var(--class-color, #3498db);
        transition: width 0.3s ease;
    }

    .dock-item.window-item.active::after {
        width: 80%;
    }

    /* Avatar image styling - fill container properly */
    .dock-item img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        object-position: center;
        border-radius: 8px;
        transition: all 0.3s ease;
    }

    .dock-item:hover img {
        transform: scale(1.05);
        filter: brightness(1.1);
    }

    /* Enhanced character name display */
    .character-name {
        font-weight: 600;
        font-size: 14px;
        color: #2c3e50;
    }

    /* Class-specific hover effects */
    .dock-item[data-class="feca"]:hover { 
        border-color: rgba(142, 68, 173, 0.7); 
        background: rgba(142, 68, 173, 0.1);
    }
    .dock-item[data-class="osamodas"]:hover { 
        border-color: rgba(39, 174, 96, 0.7); 
        background: rgba(39, 174, 96, 0.1);
    }
    .dock-item[data-class="enutrof"]:hover { 
        border-color: rgba(243, 156, 18, 0.7); 
        background: rgba(243, 156, 18, 0.1);
    }
    .dock-item[data-class="sram"]:hover { 
        border-color: rgba(44, 62, 80, 0.7); 
        background: rgba(44, 62, 80, 0.1);
    }
    .dock-item[data-class="xelor"]:hover { 
        border-color: rgba(52, 152, 219, 0.7); 
        background: rgba(52, 152, 219, 0.1);
    }
    .dock-item[data-class="ecaflip"]:hover { 
        border-color: rgba(231, 76, 60, 0.7); 
        background: rgba(231, 76, 60, 0.1);
    }
    .dock-item[data-class="eniripsa"]:hover { 
        border-color: rgba(241, 196, 15, 0.7); 
        background: rgba(241, 196, 15, 0.1);
    }
    .dock-item[data-class="iop"]:hover { 
        border-color: rgba(230, 126, 34, 0.7); 
        background: rgba(230, 126, 34, 0.1);
    }
    .dock-item[data-class="cra"]:hover { 
        border-color: rgba(22, 160, 133, 0.7); 
        background: rgba(22, 160, 133, 0.1);
    }
    .dock-item[data-class="sadida"]:hover { 
        border-color: rgba(46, 204, 113, 0.7); 
        background: rgba(46, 204, 113, 0.1);
    }
    .dock-item[data-class="steamer"]:hover { 
        border-color: rgba(211, 84, 0, 0.7); 
        background: rgba(211, 84, 0, 0.1);
    }

    @media (max-width: 600px) {
        .index-badge {
            font-size: 8px;
            padding: 1px 4px;
            min-width: 12px;
        }
        
        .initiative-badge {
            font-size: 8px;
            padding: 1px 4px;
            min-width: 12px;
        }

        .class-indicator {
            width: 10px;
            height: 10px;
            border-width: 1px;
        }
    }
`;
document.head.appendChild(additionalStyle);