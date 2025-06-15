/**
 * WindowActivator - Fonction factice pour remplacer la logique de mise au premier plan
 * Cette fonction sert de placeholder uniforme pour tous les appels de mise au premier plan
 */

const { spawn } = require('child_process');
const path = require('path');
const { app } = require('electron');

class WindowActivator {
  constructor() {
    console.log('WindowActivator: Initialized (using Python script)');
    this.scriptPath = app.isPackaged
      ? path.join(process.resourcesPath, 'script', 'afficher_fenetre.py')
      : path.join(__dirname, '..', 'script', 'afficher_fenetre.py');
  }

  /**
     * Fonction factice pour la mise au premier plan des fenêtres
     * @param {string} windowId - ID de la fenêtre (ignoré)
     * @returns {boolean} - Toujours true pour maintenir la compatibilité
     */
  bringWindowToFront(windowTitle = null) {
    if (!windowTitle) {
      console.log('WindowActivator: bringWindowToFront called with no title');
      return false;
    }
    return this.runPythonScript(windowTitle);
  }

  /**
     * Fonction factice pour l'activation des fenêtres
     * @param {string} windowId - ID de la fenêtre (ignoré)
     * @returns {Promise<boolean>} - Toujours true pour maintenir la compatibilité
     */
  async activateWindow(windowTitle) {
    if (!windowTitle) {
      console.log('WindowActivator: activateWindow called with no title');
      return false;
    }
    return this.runPythonScript(windowTitle);
  }

  /**
     * Fonction factice pour le focus des fenêtres
     * @param {string} windowId - ID de la fenêtre (ignoré)
     * @returns {boolean} - Toujours true pour maintenir la compatibilité
     */
  focusWindow(windowTitle = null) {
    if (!windowTitle) {
      console.log('WindowActivator: focusWindow called with no title');
      return false;
    }
    return this.runPythonScript(windowTitle);
  }

  runPythonScript(title) {
    return new Promise((resolve) => {
      const scriptPath = this.scriptPath;
      const proc = spawn('python', [scriptPath, title]);

      let resolved = false;
      const finish = (code) => {
        if (!resolved) {
          resolved = true;
          resolve(code === 0);
        }
      };

      proc.on('error', () => {
        const proc3 = spawn('python3', [scriptPath, title]);
        proc3.on('close', finish);
        proc3.on('error', () => finish(1));
      });

      proc.on('close', finish);
    });
  }

  /**
     * Fonction factice pour obtenir les statistiques
     * @returns {Object} - Statistiques factices
     */
  getStats() {
    return {
      activations: 0,
      successes: 0,
      failures: 0,
      successRate: 100,
      avgTime: 0,
      nativeAvailable: false,
      method: 'Dummy (no activation)'
    };
  }

  /**
     * Fonction factice de nettoyage
     */
  cleanup() {
    console.log('WindowActivator: Cleanup completed (no resources to clean)');
  }
}

// Export des fonctions pour compatibilité
function bringWindowToFront(windowTitle = null) {
  const activator = new WindowActivator();
  return activator.bringWindowToFront(windowTitle);
}

function activateWindow(windowTitle) {
  const activator = new WindowActivator();
  return activator.activateWindow(windowTitle);
}

function focusWindow(windowTitle = null) {
  const activator = new WindowActivator();
  return activator.focusWindow(windowTitle);
}

module.exports = WindowActivator;
module.exports.WindowActivator = WindowActivator;
module.exports.bringWindowToFront = bringWindowToFront;
module.exports.activateWindow = activateWindow;
module.exports.focusWindow = focusWindow;
