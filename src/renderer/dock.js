const { ipcRenderer } = require('electron');

class DockRenderer {
  constructor() {
    this.windows = [];
    this.language = {};
    this.settings = {};
    this.refreshing = false;
    this.dofusClasses = {};
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.elements = {};

    // Attendre que le DOM soit prêt
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.init();
      });
    } else {
      this.init();
    }
  }

  init() {
    console.log('DockRenderer: Initializing...');
    this.initializeElements();
    this.setupEventListeners();
    this.setupDragAndDrop();
    this.loadData();
  }

  initializeElements() {
    this.elements = {
      dockContainer: document.querySelector('.dock-container'),
      dockItems: document.getElementById('dock-items')
    };

    console.log('DockRenderer: Elements found:', {
      dockContainer: !!this.elements.dockContainer,
      dockItems: !!this.elements.dockItems
    });

    if (!this.elements.dockContainer || !this.elements.dockItems) {
      console.error('DockRenderer: Required elements not found!');
      return false;
    }

    return true;
  }

  setupDragAndDrop() {
    if (!this.elements.dockContainer) {
      console.error('DockRenderer: Cannot setup drag and drop - dock container not found');
      return;
    }

    const dockContainer = this.elements.dockContainer;

    // Variables pour le drag
    let isDragging = false;
    let startX, startY;
    let initialMouseX, initialMouseY;

    // Ajouter les événements de drag
    dockContainer.addEventListener('mousedown', async (e) => {
      // Permettre le drag seulement si on clique sur l'arrière-plan du dock
      if (e.target === dockContainer || e.target.closest('.dock-items') === dockContainer.querySelector('.dock-items')) {
        isDragging = true;
        dockContainer.style.cursor = 'grabbing';

        // Position initiale de la souris
        initialMouseX = e.clientX;
        initialMouseY = e.clientY;

        // Position initiale de la fenêtre
        try {
          const pos = await ipcRenderer.invoke('get-dock-position');
          startX = pos[0] || 0;
          startY = pos[1] || 0;
        } catch (error) {
          console.error('DockRenderer: Error getting window position:', error);
          startX = 0;
          startY = 0;
        }

        e.preventDefault();
      }
    });

    document.addEventListener('mousemove', async (e) => {
      if (isDragging) {
        const deltaX = e.clientX - initialMouseX;
        const deltaY = e.clientY - initialMouseY;

        const newX = startX + deltaX;
        const newY = startY + deltaY;

        // Envoyer la nouvelle position au processus principal
        try {
          await ipcRenderer.invoke('move-dock-window', newX, newY);
        } catch (error) {
          console.error('DockRenderer: Error moving window:', error);
        }

        e.preventDefault();
      }
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        dockContainer.style.cursor = 'grab';
      }
    });

    // Curseur de déplacement au hover
    dockContainer.addEventListener('mouseenter', () => {
      if (!isDragging) {
        dockContainer.style.cursor = 'grab';
      }
    });

    dockContainer.addEventListener('mouseleave', () => {
      if (!isDragging) {
        dockContainer.style.cursor = 'default';
      }
    });

    console.log('DockRenderer: Drag and drop setup complete');
  }

  setupEventListeners() {
    console.log('DockRenderer: Setting up event listeners...');

    // IPC listeners
    ipcRenderer.on('windows-updated', (event, windows) => {
      console.log('DockRenderer: Received windows-updated event with', windows.length, 'windows');
      console.log('DockRenderer: Windows data received:', windows);

      // Debug: vérifier les fenêtres enabled
      const enabledCount = windows.filter(w => w.enabled).length;
      console.log('DockRenderer: Enabled windows count:', enabledCount);

      this.windows = windows;
      this.renderDock();
    });

    ipcRenderer.on('language-changed', (event, language) => {
      console.log('DockRenderer: Received language-changed event');
      this.language = language;
      this.renderDock();
    });

    // Prevent context menu on dock
    document.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.showContextMenu(e);
    });

    // Maintenir le dock toujours au-dessus
    window.addEventListener('blur', () => {
      setTimeout(async () => {
        try {
          await ipcRenderer.invoke('set-dock-always-on-top', true);
        } catch (error) {
          console.error('DockRenderer: Error setting always on top:', error);
        }
      }, 100);
    });

    // Double-clic pour basculer la visibilité
    document.addEventListener('dblclick', (e) => {
      if (e.target.closest('.dock-container')) {
        this.toggleDockVisibility();
      }
    });

    // Raccourcis clavier pour masquer/afficher le dock
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.hideDock();
      } else if (e.ctrlKey && e.key === 'd') {
        e.preventDefault();
        this.toggleDockVisibility();
      } else {
        this.handleKeyboardShortcuts(e);
      }
    });

    // Gérer le redimensionnement pour repositionner si nécessaire
    window.addEventListener('resize', () => {
      this.repositionIfNeeded();
    });

    console.log('DockRenderer: Event listeners setup complete');
  }

  async loadData() {
    try {
      console.log('DockRenderer: Loading initial data...');

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

      console.log('DockRenderer: Data loaded successfully');
      console.log('DockRenderer: Windows:', this.windows.length);
      console.log('DockRenderer: Dofus classes:', Object.keys(this.dofusClasses).length);

      this.renderDock();
    } catch (error) {
      console.error('DockRenderer: Error loading dock data:', error);
      // Fallback: render empty dock
      this.renderDock();
    }
  }

  renderDock() {
    if (!this.elements.dockItems) {
      console.error('DockRenderer: Cannot render dock - dockItems element not found');
      return;
    }

    console.log('DockRenderer: Rendering dock with', this.windows.length, 'windows');

    // CORRECTION: Activer toutes les fenêtres si aucune n'est activée
    let enabledWindows = this.windows.filter(w => w.enabled);

    if (enabledWindows.length === 0 && this.windows.length > 0) {
      console.log('DockRenderer: No enabled windows found, enabling all windows as fallback');
      this.windows.forEach(w => w.enabled = true);
      enabledWindows = this.windows;
    }

    console.log('DockRenderer: Final enabled windows:', enabledWindows.length);

    let dockHTML = '';

    // Refresh button
    const refreshClass = this.refreshing ? 'refreshing' : '';
    const refreshTooltip = this.language.dock_REFRESH_tooltip || 'Refresh windows';

    dockHTML += `
      <div class="dock-item dock-refresh ${refreshClass}" 
           onclick="window.dockRenderer.refreshWindows()" 
           title="${refreshTooltip}">
          <div class="window-icon">⟳</div>
          <div class="tooltip">${refreshTooltip}</div>
      </div>
    `;

    // CORRECTION: Afficher quelque chose même si pas de fenêtres activées
    if (enabledWindows.length === 0) {
      console.log('DockRenderer: No enabled windows, showing all windows as fallback');
      // Fallback: afficher toutes les fenêtres
      enabledWindows.push(...this.windows);
    }

    // Window items - sorted by initiative (desc) then by character name
    const sortedWindows = enabledWindows.sort((a, b) => {
      if (b.initiative !== a.initiative) {
        return b.initiative - a.initiative;
      }
      return a.character.localeCompare(b.character);
    });

    console.log('DockRenderer: Sorted windows for display:', sortedWindows);

    sortedWindows.forEach((window, index) => {
      // Display only character name, not full title
      const displayName = window.customName || window.character;
      const className = this.dofusClasses[window.dofusClass]?.name || window.dofusClass || 'Unknown';
      const shortcutText = window.shortcut || (this.language.shortcut_none || 'No shortcut');
      const tooltip = `${displayName} (${className})\\n${this.language.dock_FENETRE_tooltip?.replace('{0}', shortcutText) || `Shortcut: ${shortcutText}`}`;
      const activeClass = window.isActive ? 'active' : '';

      // Use .jpg extension for avatars - avatar is now determined by class
      const avatarSrc = `../../assets/avatars/${window.avatar || '1'}.jpg`;
      const fallbackSrc = '../../assets/avatars/1.jpg';

      dockHTML += `
        <div class="dock-item window-item ${activeClass}" 
             onclick="window.dockRenderer.activateWindow('${window.id}')"
             onmouseenter="window.dockRenderer.showTooltip(this, '${this.escapeHtml(tooltip)}')"
             onmouseleave="window.dockRenderer.hideTooltip(this)"
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
           onclick="window.dockRenderer.showConfig()" 
           title="${configTooltip}">
          <div class="window-icon">⚙</div>
          <div class="tooltip">${configTooltip}</div>
      </div>
    `;

    this.elements.dockItems.innerHTML = dockHTML;
    console.log('DockRenderer: HTML set, dock should now show', sortedWindows.length, 'windows');

    // Apply class-specific styling
    this.applyClassStyling();

    // Update dock size based on content
    this.updateDockSize();

    // Ajouter l'effet de magnification après le rendu
    setTimeout(() => {
      this.addMagnificationEffect();
      this.addParallaxEffect();
    }, 100);

    console.log('DockRenderer: Dock rendered successfully');
  }

  // Ajouter cette méthode pour débugger
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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

  async snapToPosition(position) {
    try {
      const [screenBounds, dockBounds] = await Promise.all([
        ipcRenderer.invoke('get-screen-bounds'),
        ipcRenderer.invoke('get-dock-bounds')
      ]);

      let x, y;

      switch (position) {
        case 'top-left':
          x = 10;
          y = 10;
          break;
        case 'top-right':
          x = screenBounds.width - dockBounds.width - 10;
          y = 10;
          break;
        case 'bottom-left':
          x = 10;
          y = screenBounds.height - dockBounds.height - 10;
          break;
        case 'bottom-right':
          x = screenBounds.width - dockBounds.width - 10;
          y = screenBounds.height - dockBounds.height - 10;
          break;
        case 'center':
          x = (screenBounds.width - dockBounds.width) / 2;
          y = (screenBounds.height - dockBounds.height) / 2;
          break;
        default:
          return;
      }

      await ipcRenderer.invoke('move-dock-window', Math.round(x), Math.round(y));
    } catch (error) {
      console.error('DockRenderer: Error snapping to position:', error);
    }
  }

  async updateDockSize() {
    const itemCount = this.elements.dockItems.children.length;
    const itemWidth = 60; // Including gaps
    const padding = 16;
    const newWidth = Math.min(600, itemCount * itemWidth + padding);

    // Send resize request to main process
    try {
      await ipcRenderer.invoke('resize-dock-window', newWidth, 70);
    } catch (error) {
      console.error('DockRenderer: Error resizing dock:', error);
    }
  }

  toggleDockVisibility() {
    const dock = document.querySelector('.dock-container');
    if (dock.style.opacity === '0') {
      this.showDock();
    } else {
      this.hideDock();
    }
  }

  hideDock() {
    const dock = document.querySelector('.dock-container');
    dock.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    dock.style.opacity = '0';
    dock.style.transform = 'scale(0.8)';
    dock.style.pointerEvents = 'none';
  }

  showDock() {
    const dock = document.querySelector('.dock-container');
    dock.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    dock.style.opacity = '1';
    dock.style.transform = 'scale(1)';
    dock.style.pointerEvents = 'auto';
  }

  repositionIfNeeded() {
    // Vérifier si le dock est encore visible à l'écran
    if (window.electronAPI && window.electronAPI.getWindowBounds && window.electronAPI.moveWindow) {
      const bounds = window.electronAPI.getWindowBounds();
      const screenBounds = window.electronAPI.getScreenBounds();

      let newX = bounds.x;
      let newY = bounds.y;
      let needsReposition = false;

      // Vérifier les limites horizontales
      if (bounds.x < 0) {
        newX = 10;
        needsReposition = true;
      } else if (bounds.x + bounds.width > screenBounds.width) {
        newX = screenBounds.width - bounds.width - 10;
        needsReposition = true;
      }

      // Vérifier les limites verticales
      if (bounds.y < 0) {
        newY = 10;
        needsReposition = true;
      } else if (bounds.y + bounds.height > screenBounds.height) {
        newY = screenBounds.height - bounds.height - 10;
        needsReposition = true;
      }

      if (needsReposition) {
        window.electronAPI.moveWindow(newX, newY);
      }
    }
  }

  // Ajouter menu contextuel pour les options de positionnement
  showContextMenu(e) {
    e.preventDefault();

    const contextMenu = document.createElement('div');
    contextMenu.className = 'dock-context-menu';
    contextMenu.style.cssText = `
      position: fixed;
      top: ${e.clientY}px;
      left: ${e.clientX}px;
      background: rgba(0, 0, 0, 0.9);
      border-radius: 8px;
      padding: 8px 0;
      z-index: 10000;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      min-width: 150px;
    `;

    const menuItems = [
      { label: 'Top Left', action: () => this.snapToPosition('top-left') },
      { label: 'Top Right', action: () => this.snapToPosition('top-right') },
      { label: 'Bottom Left', action: () => this.snapToPosition('bottom-left') },
      { label: 'Bottom Right', action: () => this.snapToPosition('bottom-right') },
      { label: 'Center', action: () => this.snapToPosition('center') },
      { label: '---', action: null },
      { label: 'Hide Dock', action: () => this.hideDock() },
      { label: 'Refresh', action: () => this.refreshWindows() },
      { label: 'Config', action: () => this.showConfig() }
    ];

    menuItems.forEach(item => {
      if (item.label === '---') {
        const separator = document.createElement('div');
        separator.style.cssText = `
          height: 1px;
          background: rgba(255, 255, 255, 0.1);
          margin: 4px 8px;
        `;
        contextMenu.appendChild(separator);
      } else {
        const menuItem = document.createElement('div');
        menuItem.textContent = item.label;
        menuItem.style.cssText = `
          padding: 8px 16px;
          color: white;
          font-size: 12px;
          cursor: pointer;
          transition: background 0.2s ease;
        `;

        menuItem.addEventListener('mouseenter', () => {
          menuItem.style.background = 'rgba(255, 255, 255, 0.1)';
        });

        menuItem.addEventListener('mouseleave', () => {
          menuItem.style.background = 'transparent';
        });

        if (item.action) {
          menuItem.addEventListener('click', () => {
            item.action();
            document.body.removeChild(contextMenu);
          });
        }

        contextMenu.appendChild(menuItem);
      }
    });

    document.body.appendChild(contextMenu);

    // Fermer le menu quand on clique ailleurs
    const closeMenu = () => {
      if (document.body.contains(contextMenu)) {
        document.body.removeChild(contextMenu);
      }
      document.removeEventListener('click', closeMenu);
    };

    setTimeout(() => {
      document.addEventListener('click', closeMenu);
    }, 100);
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

      await ipcRenderer.invoke('refresh-windows'); er.invoke('refresh-windows');

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

  // Effet de magnification intelligent
  addMagnificationEffect() {
    const dockItems = document.querySelectorAll('.dock-item');

    dockItems.forEach((item, index) => {
      item.addEventListener('mouseenter', () => {
        this.applyMagnificationEffect(index);
      });

      item.addEventListener('mouseleave', () => {
        this.resetMagnificationEffect();
      });
    });
  }

  applyMagnificationEffect(centerIndex) {
    const items = document.querySelectorAll('.dock-item');

    items.forEach((item, index) => {
      const distance = Math.abs(index - centerIndex);
      let scale = 1;

      if (distance === 0) {
        scale = 1.4; // Centre
      } else if (distance === 1) {
        scale = 1.2; // Adjacent
      } else if (distance === 2) {
        scale = 1.1; // Deux places
      }

      item.style.transform = `scale(${scale}) translateY(${distance === 0 ? -12 : distance === 1 ? -6 : 0}px)`;
      item.style.zIndex = 10 - distance;
    });
  }

  resetMagnificationEffect() {
    const items = document.querySelectorAll('.dock-item');
    items.forEach(item => {
      item.style.transform = '';
      item.style.zIndex = '';
    });
  }

  // Effet parallaxe subtil
  addParallaxEffect() {
    const dock = document.querySelector('.dock-container');

    dock.addEventListener('mousemove', (e) => {
      const rect = dock.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const moveX = (x / rect.width - 0.5) * 10;
      const moveY = (y / rect.height - 0.5) * 5;

      dock.style.transform = `translateX(${moveX}px) translateY(${moveY}px)`;
    });

    dock.addEventListener('mouseleave', () => {
      dock.style.transform = '';
    });
  }

  // Effets sonores (optionnel)
  addSoundEffects() {
    const items = document.querySelectorAll('.dock-item');

    items.forEach(item => {
      item.addEventListener('mouseenter', () => {
        this.playHoverSound();
      });

      item.addEventListener('click', () => {
        this.playClickSound();
      });
    });
  }

  playHoverSound() {
    // Son de hover subtil (optionnel)
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmojBSuIy/LXdyMFl...');
    audio.volume = 0.1;
    audio.play().catch(() => { }); // Ignore les erreurs
  }

  playClickSound() {
    // Son de clic (optionnel)
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmojBSuIy/LXdyMFl...');
    audio.volume = 0.2;
    audio.play().catch(() => { });
  }

  // Améliorer les animations de loading
  showLoadingState() {
    const refreshButton = document.querySelector('.dock-refresh');
    if (refreshButton) {
      refreshButton.classList.add('loading');
      refreshButton.style.pointerEvents = 'none';

      setTimeout(() => {
        refreshButton.classList.remove('loading');
        refreshButton.style.pointerEvents = '';
      }, 2000);
    }
  }

  // Ajouter un mode compact pour les petits écrans
  toggleCompactMode() {
    const dock = document.querySelector('.dock-container');
    dock.classList.toggle('compact-mode');
  }
}

// Initialiser seulement quand le DOM est prêt
let dockRenderer;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('DockRenderer: DOM ready, initializing...');
    dockRenderer = new DockRenderer();
    window.dockRenderer = dockRenderer;
  });
} else {
  console.log('DockRenderer: DOM already ready, initializing...');
  dockRenderer = new DockRenderer();
  window.dockRenderer = dockRenderer;
}

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