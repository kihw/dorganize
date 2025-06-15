const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Import du WindowActivator au lieu de la logique native
const { WindowActivator } = require('./WindowActivator');

class WindowManagerWindows {
  constructor() {
    this.windows = new Map();
    this.lastWindowCheck = 0;
    this.psScriptPath = null;
    this.psScriptReady = false;
    this.windowIdMapping = new Map(); // Map stable IDs to current window handles

    // AJOUTÉ: Utiliser WindowActivator au lieu de la logique d'activation native
    this.windowActivator = new WindowActivator();

    // Define available classes and their corresponding avatars
    this.dofusClasses = {
      'feca': { name: 'Feca', avatar: '1' },
      'osamodas': { name: 'Osamodas', avatar: '2' },
      'enutrof': { name: 'Enutrof', avatar: '3' },
      'sram': { name: 'Sram', avatar: '4' },
      'xelor': { name: 'Xelor', avatar: '5' },
      'ecaflip': { name: 'Ecaflip', avatar: '6' },
      'eniripsa': { name: 'Eniripsa', avatar: '7' },
      'iop': { name: 'Iop', avatar: '8' },
      'cra': { name: 'Cra', avatar: '9' },
      'sadida': { name: 'Sadida', avatar: '10' },
      'sacrieur': { name: 'Sacrieur', avatar: '11' },
      'pandawa': { name: 'Pandawa', avatar: '12' },
      'roublard': { name: 'Roublard', avatar: '13' },
      'zobal': { name: 'Zobal', avatar: '14' },
      'steamer': { name: 'Steamer', avatar: '15' },
      'eliotrope': { name: 'Eliotrope', avatar: '16' },
      'huppermage': { name: 'Huppermage', avatar: '17' },
      'ouginak': { name: 'Ouginak', avatar: '18' },
      'forgelance': { name: 'Forgelance', avatar: '20' }
    };

    // Class name mappings for French/English detection
    this.classNameMappings = {
      // French names
      'feca': 'feca',
      'féca': 'feca',
      'osamodas': 'osamodas',
      'enutrof': 'enutrof',
      'sram': 'sram',
      'xelor': 'xelor',
      'xélor': 'xelor',
      'ecaflip': 'ecaflip',
      'eniripsa': 'eniripsa',
      'iop': 'iop',
      'cra': 'cra',
      'sadida': 'sadida',
      'sacrieur': 'sacrieur',
      'pandawa': 'pandawa',
      'roublard': 'roublard',
      'zobal': 'zobal',
      'steamer': 'steamer',
      'eliotrope': 'eliotrope',
      'huppermage': 'huppermage',
      'ouginak': 'ouginak',
      'forgelance': 'forgelance',

      // English names
      'masqueraider': 'zobal',
      'foggernaut': 'steamer',
      'rogue': 'roublard',

      // Alternative spellings
      'eliotrop': 'eliotrope',
      'elio': 'eliotrope',
      'hupper': 'huppermage',
      'ougi': 'ouginak'
    };

    this.initializePowerShell();
  }

  async initializePowerShell() {
    // SIMPLIFIÉ: Script PowerShell basique sans logique d'activation
    const script = `
# Dorganize Windows Management Script - Detection Only
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Diagnostics;

public class WindowsAPI {
    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);
    
    [DllImport("user32.dll")]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    
    [DllImport("user32.dll")]
    public static extern int GetWindowTextLength(IntPtr hWnd);
    
    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);
    
    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
    
    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
    
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
    
    [DllImport("user32.dll")]
    public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);
    
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    
    public struct RECT {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }
}
"@

function Get-DofusWindows {
    $windows = @()
    $dofusProcesses = @()
    
    # Get all Dofus-related processes
    try {
        $dofusProcesses = Get-Process | Where-Object { 
            $_.ProcessName -match "Dofus|dofus|java" -and 
            $_.MainWindowTitle -and 
            $_.MainWindowTitle -notmatch "Organizer|Configuration"
        }
    } catch {
        Write-Warning "Failed to get processes: $_"
    }
    
    $callback = {
        param($hwnd, $lparam)
        
        try {
            if ([WindowsAPI]::IsWindowVisible($hwnd)) {
                $length = [WindowsAPI]::GetWindowTextLength($hwnd)
                if ($length -gt 0) {
                    $builder = New-Object System.Text.StringBuilder($length + 1)
                    [WindowsAPI]::GetWindowText($hwnd, $builder, $builder.Capacity)
                    $title = $builder.ToString()
                    
                    $classBuilder = New-Object System.Text.StringBuilder(256)
                    [WindowsAPI]::GetClassName($hwnd, $classBuilder, $classBuilder.Capacity)
                    $className = $classBuilder.ToString()
                    
                    $processId = 0
                    [WindowsAPI]::GetWindowThreadProcessId($hwnd, [ref]$processId)
                    
                    # Check if this window belongs to a Dofus process
                    $isDofusProcess = $script:dofusProcesses | Where-Object { $_.Id -eq $processId }
                    
                    if ($isDofusProcess) {
                        $rect = New-Object WindowsAPI+RECT
                        [WindowsAPI]::GetWindowRect($hwnd, [ref]$rect)
                        
                        $foregroundWindow = [WindowsAPI]::GetForegroundWindow()
                        $isActive = $hwnd -eq $foregroundWindow
                        
                        # Additional validation - check title contains expected patterns
                        $titleLower = $title.ToLower()
                        if ($titleLower -match "dofus|steamer|boulonix" -and 
                            $titleLower -notmatch "organizer|configuration") {
                            
                            $window = @{
                                Handle = $hwnd.ToInt64()
                                Title = $title
                                ClassName = $className
                                ProcessId = $processId
                                IsActive = $isActive
                                Bounds = @{
                                    X = $rect.Left
                                    Y = $rect.Top
                                    Width = $rect.Right - $rect.Left
                                    Height = $rect.Bottom - $rect.Top
                                }
                            }
                            $script:windows += $window
                        }
                    }
                }
            }
        } catch {
            # Ignore errors for individual windows
        }
        return $true
    }
    
    try {
        $script:windows = @()
        $script:dofusProcesses = $dofusProcesses
        [WindowsAPI]::EnumWindows($callback, [IntPtr]::Zero)
        return $script:windows
    } catch {
        Write-Error "Failed to enumerate windows: $_"
        return @()
    }
}

# SUPPRIMÉ: Toutes les fonctions d'activation (Activate-Window, Move-Window)
# Remplacées par des fonctions factices

function Dummy-ActivateWindow {
    param([int64]$Handle)
    
    Write-Host "Dummy-ActivateWindow called for handle $Handle - no action taken"
    return $true
}

function Dummy-MoveWindow {
    param([int64]$Handle, [int]$X, [int]$Y, [int]$Width = -1, [int]$Height = -1)
    
    Write-Host "Dummy-MoveWindow called for handle $Handle - no action taken"
    return $true
}

# Main command dispatcher
try {
    switch ($args[0]) {
        "get-windows" { 
            $result = Get-DofusWindows
            if ($result.Count -gt 0) {
                $result | ConvertTo-Json -Depth 3
            } else {
                "[]"
            }
        }
        "activate" { 
            $result = Dummy-ActivateWindow -Handle $args[1]
            $result.ToString().ToLower()
        }
        "move" { 
            $result = Dummy-MoveWindow -Handle $args[1] -X $args[2] -Y $args[3] -Width $args[4] -Height $args[5]
            $result.ToString().ToLower()
        }
        default { 
            Write-Host "Usage: script.ps1 [get-windows|activate|move] [args...]" 
        }
    }
} catch {
    Write-Error "Script execution failed: $_"
    exit 1
}
`;

    // Create a temporary PowerShell script file
    const os = require('os');
    const path = require('path');
    const fs = require('fs');

    this.psScriptPath = path.join(os.tmpdir(), 'dorganize-windows-dummy.ps1');

    try {
      fs.writeFileSync(this.psScriptPath, script, 'utf8');
      console.log('WindowManagerWindows: PowerShell script initialized (dummy version)');

      // Test the script to make sure it works
      await this.testPowerShellScript();
    } catch (error) {
      console.error('WindowManagerWindows: Error creating PowerShell script:', error);
      this.psScriptReady = false;
    }
  }

  async testPowerShellScript() {
    try {
      const command = `powershell.exe -ExecutionPolicy Bypass -File "${this.psScriptPath}" get-windows`;
      const { stderr } = await execAsync(command, { timeout: 5000 });

      if (stderr && stderr.trim()) {
        console.warn('WindowManagerWindows: PowerShell test stderr:', stderr);
        this.psScriptReady = false;
      } else {
        console.log('WindowManagerWindows: PowerShell script test successful (dummy version)');
        this.psScriptReady = true;
      }
    } catch (error) {
      console.error('WindowManagerWindows: PowerShell script test failed:', error);
      this.psScriptReady = false;
    }
  }

  getDofusClasses() {
    return this.dofusClasses;
  }

  getClassAvatar(className) {
    const classKey = className.toLowerCase();
    return this.dofusClasses[classKey]?.avatar || '1';
  }

  getClassName(classKey) {
    return this.dofusClasses[classKey]?.name || 'Feca';
  }

  // Generate stable window ID based on character name and class
  generateStableWindowId(character, dofusClass, processId) {
    // CORRECTION: Vérifier si dofusClass est null
    if (!character || !dofusClass) {
      console.warn(`WindowManagerWindows: Cannot generate stable ID - missing character (${character}) or class (${dofusClass})`);
      return null;
    }

    const cleanCharacter = character.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanClass = dofusClass.toLowerCase().replace(/[^a-z0-9]/g, '');
    return `${cleanCharacter}_${cleanClass}_${processId}`;
  }

  async getDofusWindows() {
    try {
      console.log('WindowManagerWindows: Scanning for Dofus windows...');

      // CORRECTION: Utiliser directement la méthode alternative qui fonctionne
      let rawWindows = await this.getWindowsWithAlternativeMethod();

      if (!rawWindows || rawWindows.length === 0) {
        console.log('WindowManagerWindows: No windows found with alternative method');
        return [];
      }

      console.log(`WindowManagerWindows: Found ${rawWindows.length} raw windows`);
      rawWindows.forEach(window => {
        console.log(`WindowManagerWindows: Raw window - Title: "${window.Title}", Handle: ${window.Handle}, ProcessId: ${window.ProcessId}`);
      });

      const processedWindows = this.processRawWindows(rawWindows);

      console.log(`WindowManagerWindows: Found ${processedWindows.length} Dofus windows`);

      return processedWindows;

    } catch (error) {
      console.error('WindowManagerWindows: Error getting Dofus windows:', error);
      return [];
    }
  }

  async getWindowsWithPowerShell() {
    try {
      const command = `powershell.exe -ExecutionPolicy Bypass -File "${this.psScriptPath}" get-windows`;
      const { stdout, stderr } = await execAsync(command, { timeout: 8000 });

      if (stderr && stderr.trim()) {
        console.warn('WindowManagerWindows: PowerShell stderr:', stderr);
      }

      if (stdout && stdout.trim() && stdout.trim() !== '[]') {
        try {
          const windows = JSON.parse(stdout.trim());
          return Array.isArray(windows) ? windows : [windows];
        } catch (parseError) {
          console.error('WindowManagerWindows: Failed to parse PowerShell output:', parseError);
          console.log('WindowManagerWindows: Raw output:', stdout);
        }
      }

      return [];
    } catch (error) {
      console.error('WindowManagerWindows: PowerShell command failed:', error);
      return [];
    }
  }

  async getWindowsWithAlternativeMethod() {
    try {
      console.log('WindowManagerWindows: Using PowerShell method...');

      // CORRECTION: Commande PowerShell optimisée pour détecter toutes les fenêtres Dofus
      const command = 'powershell.exe -Command "Get-Process | Where-Object { $_.MainWindowTitle -and $_.MainWindowTitle -ne \'\' } | Where-Object { $_.MainWindowTitle -like \'*Release*\' -or $_.MainWindowTitle -like \'*Dofus*\' } | Where-Object { $_.MainWindowTitle -notlike \'*Ankama Launcher*\' -and $_.MainWindowTitle -notlike \'*Organizer*\' } | ForEach-Object { @{ Handle = [string]$_.MainWindowHandle.ToInt64(); Title = $_.MainWindowTitle; ProcessId = $_.Id; ClassName = \'Unknown\'; IsActive = $false; Bounds = @{ X = 0; Y = 0; Width = 800; Height = 600 } } } | ConvertTo-Json -Depth 2"';

      const { stdout, stderr } = await execAsync(command, { timeout: 10000 });

      if (stderr && stderr.trim()) {
        console.warn('WindowManagerWindows: PowerShell stderr:', stderr);
      }

      if (stdout && stdout.trim() && stdout.trim() !== '[]' && stdout.trim() !== 'null') {
        try {
          const result = JSON.parse(stdout.trim());
          let windows = Array.isArray(result) ? result : [result];

          console.log(`WindowManagerWindows: PowerShell found ${windows.length} potential windows`);

          // Filter and validate windows
          windows = windows.filter(window => {
            // CORRECTION: Validation plus stricte des handles
            if (!window.Title || !window.Handle || window.Handle === '0' || window.Handle === 0) {
              console.log(`WindowManagerWindows: Filtering out window with invalid data - Title: "${window.Title}", Handle: "${window.Handle}"`);
              return false;
            }

            const title = window.Title;

            // CORRECTION: Vérifier que c'est bien une fenêtre de personnage (format: Nom - Classe - Version - Release)
            const parts = title.split(' - ');
            if (parts.length < 4) {
              console.log(`WindowManagerWindows: Filtering out window with invalid format: ${title}`);
              return false;
            }

            // Vérifier que le dernier élément est "Release"
            if (parts[parts.length - 1].trim() !== 'Release') {
              console.log(`WindowManagerWindows: Filtering out non-release window: ${title}`);
              return false;
            }

            console.log(`WindowManagerWindows: Found valid Dofus character window: ${title}`);
            return true;
          });

          console.log(`WindowManagerWindows: After filtering, ${windows.length} valid Dofus character windows found`);
          return windows;

        } catch (parseError) {
          console.error('WindowManagerWindows: Failed to parse PowerShell output:', parseError);
          console.log('WindowManagerWindows: Raw output:', stdout);
        }
      } else {
        console.log('WindowManagerWindows: PowerShell method returned no results');
      }

      return [];
    } catch (error) {
      console.error('WindowManagerWindows: PowerShell method failed:', error);
      return [];
    }
  }

  processRawWindows(rawWindows) {
    const processedWindows = [];
    const currentWindowIds = new Set();

    for (const rawWindow of rawWindows) {
      // CORRECTION: Validation stricte du handle
      if (!rawWindow.Handle || rawWindow.Handle === true || rawWindow.Handle === 'true' || rawWindow.Handle === '0' || rawWindow.Handle === 0) {
        console.warn('WindowManagerWindows: Skipping window with invalid Handle:', rawWindow.Handle, 'for title:', rawWindow.Title);
        continue;
      }

      const windowHandle = rawWindow.Handle.toString();

      // Parse character info from title
      const { character, dofusClass } = this.parseWindowTitle(rawWindow.Title);

      // Skip si pas de classe valide
      if (!character || !dofusClass) {
        console.log(`WindowManagerWindows: Skipping window without valid character/class: ${rawWindow.Title}`);
        continue;
      }

      // Generate stable ID
      const stableId = this.generateStableWindowId(character, dofusClass, rawWindow.ProcessId);
      if (!stableId) {
        console.warn(`WindowManagerWindows: Could not generate stable ID for window: ${rawWindow.Title}`);
        continue;
      }

      console.log(`WindowManagerWindows: Processing window - ID: ${stableId}, Handle: ${windowHandle}, Title: ${rawWindow.Title}`);

      // Map the stable ID to the current window handle
      this.windowIdMapping.set(stableId, windowHandle);
      currentWindowIds.add(stableId);

      // Get stored class or use detected class
      const storedClass = this.getStoredClass(stableId);
      const finalClass = storedClass !== 'feca' ? storedClass : dofusClass;

      const windowInfo = {
        id: stableId, // Use stable ID instead of window handle
        handle: windowHandle, // Keep the actual handle for activation
        title: rawWindow.Title || 'Unknown Window',
        processName: this.extractProcessName(rawWindow.ClassName),
        className: rawWindow.ClassName || 'Unknown',
        pid: (rawWindow.ProcessId || 0).toString(),
        character: character,
        dofusClass: finalClass,
        customName: this.getStoredCustomName(stableId),
        initiative: this.getStoredInitiative(stableId),
        isActive: rawWindow.IsActive || false,
        bounds: rawWindow.Bounds || { X: 0, Y: 0, Width: 800, Height: 600 },
        avatar: this.getClassAvatar(finalClass),
        shortcut: this.getStoredShortcut(stableId),
        enabled: this.getStoredEnabled(stableId)
      };

      processedWindows.push(windowInfo);
      this.windows.set(stableId, { info: windowInfo });
    }

    // Remove windows that no longer exist
    for (const [windowId] of this.windows) {
      if (!currentWindowIds.has(windowId)) {
        this.windows.delete(windowId);
        this.windowIdMapping.delete(windowId);
      }
    }

    return processedWindows;
  }

  parseWindowTitle(title) {
    if (!title || typeof title !== 'string') {
      return { character: null, dofusClass: null };
    }

    console.log(`WindowManagerWindows: Parsing title: "${title}"`);

    // Format: "Nom - Classe - Version - Release" ou "Nom du Personnage - Nom de la Classe - ..."
    const parts = title.split(' - ');

    if (parts.length >= 2) {
      const character = parts[0].trim();
      const classRaw = parts[1].trim();

      // Normalize class name
      const dofusClass = this.normalizeClassName(classRaw);

      console.log(`WindowManagerWindows: Parsed - Character: "${character}", Class: "${classRaw}" -> "${dofusClass}"`);

      // MODIFIÉ: Accepter la fenêtre si elle a une classe valide, même si le format n'est pas parfait
      if (character && dofusClass && dofusClass !== 'unknown') {
        return { character, dofusClass };
      }
    }

    // Fallback: essayer de détecter dans le titre complet
    const normalizedTitle = title.toLowerCase();
    const knownClasses = ['steamer', 'ecaflip', 'eniripsa', 'iop', 'cra', 'sadida', 'sacrieur', 'pandawa', 'osamodas', 'enutrof', 'sram', 'xelor', 'feca', 'roublard', 'zobal', 'ouginak', 'huppermage', 'eliotrope', 'forgelance'];

    for (const className of knownClasses) {
      if (normalizedTitle.includes(className)) {
        const character = parts[0]?.trim() || 'Unknown';
        console.log(`WindowManagerWindows: Fallback detection - Character: "${character}", Class: "${className}"`);
        return { character, dofusClass: className };
      }
    }

    console.log(`WindowManagerWindows: Failed to parse title: "${title}"`);
    return { character: null, dofusClass: null };
  }

  normalizeClassName(className) {
    if (!className) return 'feca';

    const normalized = className.toLowerCase()
      .replace(/[àáâãäå]/g, 'a')
      .replace(/[èéêë]/g, 'e')
      .replace(/[ìíîï]/g, 'i')
      .replace(/[òóôõö]/g, 'o')
      .replace(/[ùúûü]/g, 'u')
      .replace(/[ç]/g, 'c')
      .trim();

    // Check direct mappings first
    if (this.classNameMappings[normalized]) {
      return this.classNameMappings[normalized];
    }

    // Check partial matches
    for (const [key, value] of Object.entries(this.classNameMappings)) {
      if (normalized.includes(key) || key.includes(normalized)) {
        return value;
      }
    }

    // Default fallback
    console.warn(`WindowManagerWindows: Unknown class name: "${className}", using default "feca"`);
    return 'feca';
  }

  extractProcessName(className) {
    if (!className) return 'Dofus';

    // Extract a readable process name from the class name
    if (className.includes('Unity')) return 'Dofus 3 (Unity)';
    if (className.includes('Java') || className.includes('SunAwt')) return 'Dofus 2 (Java)';
    if (className.includes('Retro')) return 'Dofus Retro';

    return 'Dofus';
  }

  extractCharacterNameFallback(title) {
    if (!title) return { character: 'Dofus Player', dofusClass: 'feca' };

    // For Dofus 3, the title is usually just "Dofus"
    if (title.trim() === 'Dofus') {
      return { character: 'Dofus Player', dofusClass: 'feca' };
    }

    // Try to extract character name from window title using various patterns
    const patterns = [
      /^([^-]+)\s*-\s*([^-]+)/i,  // "Name - Class" format
      /dofus\s*-\s*(.+?)(?:\s*\(|$)/i,
      /(.+?)\s*-\s*dofus/i,
      /retro\s*-\s*(.+?)(?:\s*\(|$)/i,
      /(.+?)\s*-\s*retro/i
    ];

    for (const pattern of patterns) {
      const match = title.match(pattern);
      if (match && match[1]) {
        let name = match[1].trim();
        let detectedClass = 'feca';

        // If we have a second capture group, it might be the class
        if (match[2]) {
          detectedClass = this.normalizeClassName(match[2].trim());
        }

        // Clean up common suffixes
        name = name.replace(/\s*\(.*\)$/, '');
        name = name.replace(/\s*-.*$/, '');

        if (name.length > 0 && name.length < 50 && name !== 'Dofus') {
          return { character: name, dofusClass: detectedClass };
        }
      }
    }

    return { character: 'Dofus Player', dofusClass: 'feca' };
  }

  async activateWindow(windowId) {
    try {
      console.log(`WindowManagerWindows: Activating window ${windowId} (using placeholder activator)`);

      // Get the actual window handle from the stable ID
      const windowHandle = this.windowIdMapping.get(windowId);
      if (!windowHandle) {
        console.error(`WindowManagerWindows: No handle found for window ID ${windowId}`);
        return false;
      }

      const windowInfo = this.windows.get(windowId);
      const title = windowInfo ? windowInfo.info.title : null;

      // Utiliser le WindowActivator avec le titre de la fenêtre
      const result = await this.windowActivator.activateWindow(title);

      if (result) {
        // Update active state immediately
        this.updateActiveState(windowId);
        console.log(`WindowManagerWindows: Window ${windowId} activated successfully (dummy)`);
      } else {
        console.warn(`WindowManagerWindows: Failed to activate window ${windowId} (dummy)`);
      }

      return result;
    } catch (error) {
      console.error('WindowManagerWindows: Error activating window:', error);
      return false;
    }
  }

  updateActiveState(activeWindowId) {
    // Update the active state of all windows
    for (const [windowId, windowData] of this.windows) {
      windowData.info.isActive = windowId === activeWindowId;
    }
  }

  async moveWindow(windowId, x, y, width = -1, height = -1) {
    try {
      console.log(`WindowManagerWindows: Moving window ${windowId} (using placeholder activator)`);

      const windowHandle = this.windowIdMapping.get(windowId);
      if (!windowHandle) {
        console.error(`WindowManagerWindows: No handle found for window ID ${windowId}`);
        return false;
      }

      // MODIFIÉ: Utiliser WindowActivator au lieu de la logique PowerShell
      console.log(`WindowManagerWindows: Move window ${windowId} to ${x},${y} (${width}x${height}) - using placeholder activator`);
      return this.windowActivator.bringWindowToFront(windowId);
    } catch (error) {
      console.error('WindowManagerWindows: Error moving window:', error);
      return false;
    }
  }

  async organizeWindows(layout = 'grid') {
    const enabledWindows = Array.from(this.windows.values())
      .filter(w => w.info.enabled)
      .sort((a, b) => b.info.initiative - a.info.initiative);

    if (enabledWindows.length === 0) return false;

    try {
      console.log(`WindowManagerWindows: Organizing ${enabledWindows.length} windows in ${layout} layout (using placeholder activator)`);

      // MODIFIÉ: Utiliser WindowActivator au lieu de la logique de repositionnement
      this.windowActivator.bringWindowToFront('organize-windows-request');

      // Simuler l'organisation pour chaque fenêtre
      for (let i = 0; i < enabledWindows.length; i++) {
        const windowData = enabledWindows[i];
        console.log(`WindowManagerWindows: Organizing window ${i + 1}/${enabledWindows.length}: ${windowData.info.character} (dummy)`);
        await this.windowActivator.activateWindow(windowData.info.title);
      }

      return true;
    } catch (error) {
      console.error('WindowManagerWindows: Error organizing windows:', error);
      return false;
    }
  }

  async arrangeInGrid(_windows, _startX, _startY, _totalWidth, _totalHeight) {
    console.log('WindowManagerWindows: arrangeInGrid called (dummy implementation)');
    // SUPPRIMÉ: Toute logique de repositionnement réel
    return this.windowActivator.bringWindowToFront('arrange-grid');
  }

  async arrangeHorizontally(_windows, _startX, _startY, _totalWidth, _totalHeight) {
    console.log('WindowManagerWindows: arrangeHorizontally called (dummy implementation)');
    // SUPPRIMÉ: Toute logique de repositionnement réel
    return this.windowActivator.bringWindowToFront('arrange-horizontal');
  }

  async arrangeVertically(_windows, _startX, _startY, _totalWidth, _totalHeight) {
    console.log('WindowManagerWindows: arrangeVertically called (dummy implementation)');
    // SUPPRIMÉ: Toute logique de repositionnement réel
    return this.windowActivator.bringWindowToFront('arrange-vertical');
  }

  // Class management methods
  setWindowClass(windowId, classKey) {
    const Store = require('electron-store');
    const store = new Store();
    const classes = store.get('classes', {});
    classes[windowId] = classKey;
    store.set('classes', classes);

    // Update the window info in memory
    if (this.windows.has(windowId)) {
      const windowData = this.windows.get(windowId);
      windowData.info.dofusClass = classKey;
      windowData.info.avatar = this.getClassAvatar(classKey);
      this.windows.set(windowId, windowData);
    }
  }

  getNextClass(currentClass) {
    const classKeys = Object.keys(this.dofusClasses);
    const currentIndex = classKeys.indexOf(currentClass);
    const nextIndex = (currentIndex + 1) % classKeys.length;
    return classKeys[nextIndex];
  }

  // Storage methods
  getStoredCustomName(windowId) {
    const Store = require('electron-store');
    const store = new Store();
    const customNames = store.get('customNames', {});
    return customNames[windowId] || null;
  }

  getStoredInitiative(windowId) {
    const Store = require('electron-store');
    const store = new Store();
    const initiatives = store.get('initiatives', {});
    return initiatives[windowId] || 0;
  }

  getStoredClass(windowId) {
    const Store = require('electron-store');
    const store = new Store();
    const classes = store.get('classes', {});
    return classes[windowId] || 'feca'; // Default to Feca
  }

  getStoredShortcut(windowId) {
    const Store = require('electron-store');
    const store = new Store();
    const shortcuts = store.get('shortcuts', {});
    return shortcuts[windowId] || null;
  }

  getStoredEnabled(windowId) {
    const Store = require('electron-store');
    const store = new Store();
    const enabled = store.get('enabled', {});
    return enabled[windowId] !== false;
  }

  cleanup() {
    // Clean up PowerShell script file
    if (this.psScriptPath) {
      try {
        const fs = require('fs');
        fs.unlinkSync(this.psScriptPath);
        console.log('WindowManagerWindows: PowerShell script cleaned up');
      } catch (error) {
        console.warn('WindowManagerWindows: Error cleaning up PowerShell script:', error);
      }
    }

    // Clean up WindowActivator
    if (this.windowActivator && typeof this.windowActivator.cleanup === 'function') {
      this.windowActivator.cleanup();
    }

    // Clear mappings
    this.windowIdMapping.clear();
  }
}

module.exports = WindowManagerWindows;
