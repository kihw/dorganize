/**
 * ModalManager - Handles all modal dialogs (Language, Class, Organize, Global Shortcuts)
 */
class ModalManager {
  constructor(configRenderer) {
    this.configRenderer = configRenderer;
    this.currentClassWindowId = null;
    this.elements = {};

    this.initializeElements();
    this.setupEventListeners();
  }

  initializeElements() {
    this.elements = {
      // Language Modal
      languageModal: document.getElementById('language-modal'),
      languageSave: document.getElementById('language-save'),
      languageCancel: document.getElementById('language-cancel'),

      // Class Modal
      classModal: document.getElementById('class-modal'),
      classGrid: document.getElementById('class-grid'),
      classCancel: document.getElementById('class-cancel'),

      // Organize Modal
      organizeModal: document.getElementById('organize-modal'),

      // Global Shortcuts Modal
      globalShortcutsModal: document.getElementById('global-shortcuts-modal'),
      nextWindowShortcutDisplay: document.getElementById('next-window-shortcut-display'),
      toggleShortcutsShortcutDisplay: document.getElementById('toggle-shortcuts-shortcut-display')
    };
  }

  setupEventListeners() {
    // Language modal events
    this.elements.languageSave?.addEventListener('click', () => this.saveLanguage());
    this.elements.languageCancel?.addEventListener('click', () => this.closeLanguageModal());

    // Class modal events
    this.elements.classCancel?.addEventListener('click', () => this.closeClassModal());
  }

  // Language Modal Methods
  showLanguageModal() {
    this.elements.languageModal.style.display = 'flex';
  }

  closeLanguageModal() {
    this.elements.languageModal.style.display = 'none';
  }

  async saveLanguage() {
    const selectedLanguage = document.querySelector('input[name="language"]:checked')?.value;
    if (selectedLanguage) {
      try {
        const { ipcRenderer } = require('electron');
        await ipcRenderer.invoke('save-settings', { language: selectedLanguage });
        this.closeLanguageModal();
      } catch (error) {
        console.error('ModalManager: Error saving language:', error);
      }
    }
  }

  // Class Modal Methods
  showClassModal(windowId) {
    this.currentClassWindowId = windowId;

    if (!this.elements.classGrid || !this.elements.classModal) {
      console.error('ModalManager: Class modal elements not found');
      return;
    }

    let classHTML = '';
    Object.entries(this.configRenderer.dofusClasses).forEach(([classKey, classInfo]) => {
      const avatarSrc = `../../assets/avatars/${classInfo.avatar}.jpg`;
      const window = this.configRenderer.windows.find(w => w.id === windowId);
      const isSelected = window && window.dofusClass === classKey;

      classHTML += `
        <div class="class-option ${isSelected ? 'selected' : ''}" 
             onclick="window.modalManager.selectClass('${classKey}')"
             data-class="${classKey}">
          <img src="${avatarSrc}" alt="${classInfo.name}" class="class-avatar" 
               onerror="this.src='../../assets/avatars/1.jpg'">
          <div class="class-name">${classInfo.name}</div>
        </div>
      `;
    });

    this.elements.classGrid.innerHTML = classHTML;
    this.elements.classModal.style.display = 'flex';
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
        const { ipcRenderer } = require('electron');
        const settings = { [`classes.${this.currentClassWindowId}`]: classKey };
        await ipcRenderer.invoke('save-settings', settings);

        const window = this.configRenderer.windows.find(w => w.id === this.currentClassWindowId);
        if (window) {
          window.dofusClass = classKey;
          window.avatar = this.configRenderer.dofusClasses[classKey].avatar;
          this.configRenderer.renderWindows();
        }

        setTimeout(() => {
          this.closeClassModal();
        }, 300);
      } catch (error) {
        console.error('ModalManager: Error saving class change:', error);
      }
    }
  }

  closeClassModal() {
    if (this.elements.classModal) {
      this.elements.classModal.style.display = 'none';
    }
    this.currentClassWindowId = null;
  }

  // Organize Modal Methods
  showOrganizeModal() {
    this.elements.organizeModal.style.display = 'flex';
  }

  closeOrganizeModal() {
    this.elements.organizeModal.style.display = 'none';
  }

  async organizeWindows(layout) {
    try {
      const { ipcRenderer } = require('electron');
      await ipcRenderer.invoke('organize-windows', layout);
      this.closeOrganizeModal();
    } catch (error) {
      console.error('ModalManager: Error organizing windows:', error);
    }
  }

  // Global Shortcuts Modal Methods
  async showGlobalShortcutsModal() {
    try {
      const { ipcRenderer } = require('electron');
      const globalShortcuts = await ipcRenderer.invoke('get-global-shortcuts');

      // Update the modal with current shortcuts
      if (this.elements.nextWindowShortcutDisplay) {
        this.elements.nextWindowShortcutDisplay.textContent = globalShortcuts.nextWindow || 'Ctrl+Tab';
      }
      if (this.elements.toggleShortcutsShortcutDisplay) {
        this.elements.toggleShortcutsShortcutDisplay.textContent = globalShortcuts.toggleShortcuts || 'Ctrl+Shift+D';
      }

      this.elements.globalShortcutsModal.style.display = 'flex';
    } catch (error) {
      console.error('ModalManager: Error loading global shortcuts:', error);
    }
  }

  closeGlobalShortcutsModal() {
    this.elements.globalShortcutsModal.style.display = 'none';
  }

  setGlobalShortcut(type) {
    // This will be handled by the shortcut manager
    this.configRenderer.shortcutManager.showGlobalShortcutModal(type);
  }

  async removeGlobalShortcut(type) {
    try {
      const { ipcRenderer } = require('electron');
      await ipcRenderer.invoke('remove-global-shortcut', type);
      this.showGlobalShortcutsModal(); // Refresh the modal
    } catch (error) {
      console.error('ModalManager: Error removing global shortcut:', error);
    }
  }

  // Utility method to close all modals
  closeAllModals() {
    const modals = [
      this.elements.languageModal,
      this.elements.classModal,
      this.elements.organizeModal,
      this.elements.globalShortcutsModal
    ];

    modals.forEach(modal => {
      if (modal) {
        modal.style.display = 'none';
      }
    });

    // Reset state
    this.currentClassWindowId = null;
  }

  // Method to handle escape key to close modals
  handleEscapeKey() {
    this.closeAllModals();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ModalManager;
}