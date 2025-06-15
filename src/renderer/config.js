avatar}.jpg`;
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