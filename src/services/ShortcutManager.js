const { globalShortcut } = require('electron');

class ShortcutManager {
  constructor() {
    this.shortcuts = new Map();
    this.active = false;
    this.registeredAccelerators = new Set();
  }

  setWindowShortcut(windowId, shortcut, callback) {
    // Remove existing shortcut for this window
    this.removeWindowShortcut(windowId);
    
    if (!shortcut || !callback) return false;

    try {
      const accelerator = this.convertShortcutToAccelerator(shortcut);
      
      // Check if accelerator is already registered
      if (this.registeredAccelerators.has(accelerator)) {
        console.warn(`Shortcut ${accelerator} is already registered`);
        return false;
      }
      
      const success = globalShortcut.register(accelerator, () => {
        try {
          console.log(`ShortcutManager: Executing shortcut ${accelerator} for window ${windowId}`);
          callback();
        } catch (error) {
          console.error('Error executing shortcut callback:', error);
        }
      });
      
      if (success) {
        this.shortcuts.set(windowId, {
          accelerator,
          callback,
          original: shortcut
        });
        
        this.registeredAccelerators.add(accelerator);
        
        console.log(`ShortcutManager: Successfully registered shortcut ${accelerator} for window ${windowId}`);
        return true;
      } else {
        console.warn(`Failed to register shortcut: ${accelerator}`);
      }
    } catch (error) {
      console.error('Error setting shortcut:', error);
    }
    
    return false;
  }

  removeWindowShortcut(windowId) {
    const shortcutInfo = this.shortcuts.get(windowId);
    if (shortcutInfo) {
      try {
        globalShortcut.unregister(shortcutInfo.accelerator);
        this.registeredAccelerators.delete(shortcutInfo.accelerator);
        this.shortcuts.delete(windowId);
        
        console.log(`ShortcutManager: Removed shortcut ${shortcutInfo.accelerator} for window ${windowId}`);
        return true;
      } catch (error) {
        console.error('Error removing shortcut:', error);
      }
    }
    return false;
  }

  convertShortcutToAccelerator(shortcut) {
    if (!shortcut) return '';
    
    console.log(`ShortcutManager: Converting shortcut "${shortcut}" to accelerator`);
    
    // Clean up the shortcut string
    let accelerator = shortcut.trim();
    
    // Handle different separator formats
    accelerator = accelerator.replace(/\s*\+\s*/g, '+');
    
    // Convert modifiers to Electron format
    const modifierMappings = {
      'ctrl': 'CommandOrControl',
      'control': 'CommandOrControl',
      'cmd': 'CommandOrControl',
      'command': 'CommandOrControl',
      'alt': 'Alt',
      'shift': 'Shift',
      'win': 'Super',
      'super': 'Super',
      'meta': 'Super'
    };
    
    // Split by + and process each part
    const parts = accelerator.split('+').map(part => part.trim().toLowerCase());
    const processedParts = [];
    
    parts.forEach(part => {
      if (modifierMappings[part]) {
        processedParts.push(modifierMappings[part]);
      } else {
        // Handle special keys and single keys
        const keyMappings = {
          'space': 'Space',
          'enter': 'Return',
          'return': 'Return',
          'backspace': 'Backspace',
          'tab': 'Tab',
          'escape': 'Escape',
          'esc': 'Escape',
          'delete': 'Delete',
          'del': 'Delete',
          'insert': 'Insert',
          'ins': 'Insert',
          'home': 'Home',
          'end': 'End',
          'pageup': 'PageUp',
          'pagedown': 'PageDown',
          'up': 'Up',
          'down': 'Down',
          'left': 'Left',
          'right': 'Right',
          'plus': 'Plus',
          'minus': 'Minus',
          // Function keys
          'f1': 'F1', 'f2': 'F2', 'f3': 'F3', 'f4': 'F4',
          'f5': 'F5', 'f6': 'F6', 'f7': 'F7', 'f8': 'F8',
          'f9': 'F9', 'f10': 'F10', 'f11': 'F11', 'f12': 'F12',
          // Number pad
          'num0': 'num0', 'num1': 'num1', 'num2': 'num2', 'num3': 'num3',
          'num4': 'num4', 'num5': 'num5', 'num6': 'num6', 'num7': 'num7',
          'num8': 'num8', 'num9': 'num9',
          'numadd': 'numadd',
          'numsub': 'numsub',
          'nummult': 'nummult',
          'numdiv': 'numdiv',
          'numdec': 'numdec'
        };
        
        // Check if it's a mapped key first
        if (keyMappings[part]) {
          processedParts.push(keyMappings[part]);
        } else {
          // For single character keys (letters, numbers, symbols), convert to uppercase
          const mappedKey = part.toUpperCase();
          processedParts.push(mappedKey);
        }
      }
    });
    
    const result = processedParts.join('+');
    console.log(`ShortcutManager: Converted "${shortcut}" to "${result}"`);
    return result;
  }

  validateShortcut(shortcut) {
    if (!shortcut) return false;
    
    try {
      const accelerator = this.convertShortcutToAccelerator(shortcut);
      
      // Much more permissive validation - allow almost any key combination
      const isValidFormat = accelerator.length > 0;
      const isNotConflicting = !this.registeredAccelerators.has(accelerator);
      
      console.log(`ShortcutManager: Validating "${shortcut}" -> "${accelerator}": format=${isValidFormat}, noConflict=${isNotConflicting}`);
      
      return isValidFormat && isNotConflicting;
    } catch (error) {
      console.error('ShortcutManager: Error validating shortcut:', error);
      return false;
    }
  }

  activateAll() {
    this.active = true;
    // Re-register all shortcuts
    const shortcuts = Array.from(this.shortcuts.entries());
    this.shortcuts.clear();
    this.registeredAccelerators.clear();
    
    shortcuts.forEach(([windowId, info]) => {
      this.setWindowShortcut(windowId, info.original, info.callback);
    });
    
    console.log(`ShortcutManager: Activated ${shortcuts.length} shortcuts`);
  }

  deactivateAll() {
    this.active = false;
    try {
      globalShortcut.unregisterAll();
      this.registeredAccelerators.clear();
      console.log('ShortcutManager: Deactivated all shortcuts');
    } catch (error) {
      console.error('Error deactivating shortcuts:', error);
    }
  }

  cleanup() {
    try {
      globalShortcut.unregisterAll();
      this.shortcuts.clear();
      this.registeredAccelerators.clear();
      console.log('ShortcutManager: Cleaned up all shortcuts');
    } catch (error) {
      console.error('Error cleaning up shortcuts:', error);
    }
  }

  getShortcutLabel(shortcut) {
    if (!shortcut) return 'No shortcut';
    
    return shortcut
      .replace(/CommandOrControl/g, 'Ctrl')
      .replace(/\+/g, ' + ')
      .split(' + ')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' + ');
  }

  getAllShortcuts() {
    const shortcuts = {};
    this.shortcuts.forEach((info, windowId) => {
      shortcuts[windowId] = info.original;
    });
    return shortcuts;
  }
}

module.exports = ShortcutManager;