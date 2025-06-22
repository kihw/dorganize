/**
 * UIManager - Handles UI updates, status indicators, and visual feedback
 */
class UIManager {
  constructor(configRenderer) {
    this.configRenderer = configRenderer;
  }

  updateShortcutsStatus() {
    const settings = this.configRenderer.getSettings();
    if (settings && typeof settings.shortcutsEnabled === 'boolean') {
      this.updateShortcutsStatusText(settings.shortcutsEnabled);
    }
  }

  updateShortcutsStatusText(enabled) {
    const elements = this.configRenderer.getElements();

    if (elements.shortcutsStatusText) {
      elements.shortcutsStatusText.textContent = `Shortcuts: ${enabled ? 'Enabled' : 'Disabled'}`;
      const statusEl = elements.shortcutsStatus;
      statusEl.className = `shortcuts-status show ${enabled ? 'enabled' : 'disabled'}`;

      setTimeout(() => statusEl.classList.remove('show'), 3000);
    }

    if (elements.toggleShortcutsText) {
      elements.toggleShortcutsText.textContent = enabled ? 'Disable Shortcuts' : 'Enable Shortcuts';
    }
  }

  updateLanguageUI() {
    const language = this.configRenderer.getLanguage();
    if (language && Object.keys(language).length > 0) {
      console.log('UIManager: Language UI updated');
      // Update language-dependent text in the UI
      this.updateButtonTexts();
      this.updateLabels();
    }
  }

  updateButtonTexts() {
    const language = this.configRenderer.getLanguage();
    const elements = this.configRenderer.getElements();

    // Update button texts based on current language
    if (elements.refreshBtn) {
      const refreshSpan = elements.refreshBtn.querySelector('span');
      if (refreshSpan) {
        refreshSpan.textContent = language.displayGUI_refreshsort || 'Refresh';
      }
    }

    // Update other button texts as needed
    this.updateDockLabels();
  }

  updateLabels() {
    const language = this.configRenderer.getLanguage();

    // Update static labels
    const labelMappings = [
      { selector: '#dock-label', key: 'displayGUI_dock' },
      { selector: '.detail-label', key: 'displayGUI_personnage', index: 0 },
      { selector: '.detail-label', key: 'displayGUI_classe', index: 1 },
      { selector: '.detail-label', key: 'displayGUI_initiative', index: 2 },
      { selector: '.detail-label', key: 'displayGUI_raccourci', index: 3 }
    ];

    labelMappings.forEach(mapping => {
      const elements = document.querySelectorAll(mapping.selector);
      const element = mapping.index !== undefined ? elements[mapping.index] : elements[0];

      if (element && language[mapping.key]) {
        element.textContent = language[mapping.key];
      }
    });
  }

  updateDockLabels() {
    const language = this.configRenderer.getLanguage();
    const dockLabel = document.getElementById('dock-label');

    if (dockLabel && language.displayGUI_dock) {
      dockLabel.textContent = language.displayGUI_dock;
    }

    // Update dock position options
    const dockPosition = document.getElementById('dock-position');
    if (dockPosition && language) {
      const options = dockPosition.querySelectorAll('option');
      const positionMappings = {
        'NW': language.displayGUI_dock_NW || 'Top Left',
        'NE': language.displayGUI_dock_NE || 'Top Right',
        'SW': language.displayGUI_dock_SW || 'Bottom Left',
        'SE': language.displayGUI_dock_SE || 'Bottom Right',
        'N': language.displayGUI_dock_N || 'Top (Horizontal)',
        'S': language.displayGUI_dock_S || 'Bottom (Horizontal)'
      };

      options.forEach(option => {
        if (positionMappings[option.value]) {
          option.textContent = positionMappings[option.value];
        }
      });
    }
  }

  showMessage(message, type = 'info', duration = 3000) {
    // Create a temporary message element
    const messageEl = document.createElement('div');
    messageEl.className = `ui-message ${type}`;
    messageEl.textContent = message;
    messageEl.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 6px;
      font-weight: 500;
      z-index: 10000;
      transition: all 0.3s ease;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      ${type === 'success' ? 'background: #27ae60; color: white;' : ''}
      ${type === 'error' ? 'background: #e74c3c; color: white;' : ''}
      ${type === 'info' ? 'background: #3498db; color: white;' : ''}
      ${type === 'warning' ? 'background: #f39c12; color: white;' : ''}
    `;

    document.body.appendChild(messageEl);

    // Animate in
    setTimeout(() => {
      messageEl.style.transform = 'translateX(0)';
      messageEl.style.opacity = '1';
    }, 10);

    // Remove after duration
    setTimeout(() => {
      messageEl.style.opacity = '0';
      messageEl.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (messageEl.parentNode) {
          messageEl.parentNode.removeChild(messageEl);
        }
      }, 300);
    }, duration);
  }

  showSuccessMessage(message) {
    this.showMessage(message, 'success');
  }

  showErrorMessage(message) {
    this.showMessage(message, 'error');
  }

  showWarningMessage(message) {
    this.showMessage(message, 'warning');
  }

  showInfoMessage(message) {
    this.showMessage(message, 'info');
  }

  updateWindowCount() {
    const elements = this.configRenderer.getElements();
    const windows = this.configRenderer.getWindows();

    if (elements.windowCount) {
      const count = windows.length;
      const language = this.configRenderer.getLanguage();

      let text = `${count} windows detected`;
      if (language) {
        if (count === 0) {
          text = language.displayTray_window_0 || 'no window';
        } else if (count === 1) {
          text = language.displayTray_window_1 || 'one window';
        } else {
          text = (language.displayTray_window_N || '{0} windows').replace('{0}', count);
        }
      }

      elements.windowCount.textContent = text;
    }
  }

  setElementEnabled(elementId, enabled) {
    const element = document.getElementById(elementId);
    if (element) {
      element.disabled = !enabled;
      if (enabled) {
        element.classList.remove('disabled');
      } else {
        element.classList.add('disabled');
      }
    }
  }

  setElementVisible(elementId, visible) {
    const element = document.getElementById(elementId);
    if (element) {
      element.style.display = visible ? '' : 'none';
    }
  }

  addLoadingState(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
      element.classList.add('loading');
      element.disabled = true;
    }
  }

  removeLoadingState(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
      element.classList.remove('loading');
      element.disabled = false;
    }
  }

  updateProgressIndicator(current, total, message = '') {
    // Create or update a progress indicator
    let progressEl = document.getElementById('ui-progress-indicator');

    if (!progressEl) {
      progressEl = document.createElement('div');
      progressEl.id = 'ui-progress-indicator';
      progressEl.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 20px;
        border-radius: 8px;
        z-index: 10001;
        min-width: 300px;
        text-align: center;
      `;
      document.body.appendChild(progressEl);
    }

    const percentage = Math.round((current / total) * 100);
    progressEl.innerHTML = `
      <div style="margin-bottom: 10px;">${message}</div>
      <div style="background: #34495e; height: 4px; border-radius: 2px; overflow: hidden;">
        <div style="background: #3498db; height: 100%; width: ${percentage}%; transition: width 0.3s ease;"></div>
      </div>
      <div style="margin-top: 10px; font-size: 14px;">${current}/${total} (${percentage}%)</div>
    `;

    if (current >= total) {
      setTimeout(() => {
        if (progressEl.parentNode) {
          progressEl.parentNode.removeChild(progressEl);
        }
      }, 1000);
    }
  }

  hideProgressIndicator() {
    const progressEl = document.getElementById('ui-progress-indicator');
    if (progressEl && progressEl.parentNode) {
      progressEl.parentNode.removeChild(progressEl);
    }
  }

  // Theme management
  setTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('dorganize-theme', theme);
  }

  getCurrentTheme() {
    return localStorage.getItem('dorganize-theme') || 'light';
  }

  toggleTheme() {
    const currentTheme = this.getCurrentTheme();
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    this.setTheme(newTheme);
    return newTheme;
  }

  // Accessibility helpers
  announceToScreenReader(message) {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = message;

    document.body.appendChild(announcement);

    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  }

  setFocusToElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
      element.focus();
    }
  }

  // Animation helpers
  fadeInElement(element, duration = 300) {
    element.style.opacity = '0';
    element.style.transition = `opacity ${duration}ms ease`;

    setTimeout(() => {
      element.style.opacity = '1';
    }, 10);
  }

  fadeOutElement(element, duration = 300) {
    element.style.transition = `opacity ${duration}ms ease`;
    element.style.opacity = '0';

    return new Promise(resolve => {
      setTimeout(() => {
        resolve();
      }, duration);
    });
  }

  slideInElement(element, direction = 'right', duration = 300) {
    const transforms = {
      'right': 'translateX(100%)',
      'left': 'translateX(-100%)',
      'up': 'translateY(-100%)',
      'down': 'translateY(100%)'
    };

    element.style.transform = transforms[direction];
    element.style.transition = `transform ${duration}ms ease`;

    setTimeout(() => {
      element.style.transform = 'translateX(0)';
    }, 10);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = UIManager;
}