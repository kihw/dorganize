const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const { getErrorHandler } = require('../ErrorHandler');
const { getSecurityUtils } = require('../../utils/SecurityUtils');

/**
 * PowerShellExecutor - Handles secure PowerShell command execution with error handling
 */
class PowerShellExecutor {
  constructor() {
    this.errorHandler = getErrorHandler();
    this.securityUtils = getSecurityUtils();
    this.scriptPath = null;
    this.isReady = false;
  }

  /**
   * Initialize PowerShell script for window detection
   */
  async initialize() {
    try {
      const script = this.generateWindowDetectionScript();
      this.scriptPath = await this.createTempScript(script);
      await this.testScript();
      this.isReady = true;
      console.log('PowerShellExecutor: Initialized successfully');
    } catch (error) {
      this.errorHandler.error(error, 'PowerShellExecutor.initialize');
      this.isReady = false;
    }
  }

  /**
   * Execute PowerShell command with timeout and error handling
   */
  async executeCommand(command, timeout = 15000) {
    try {
      if (!command || typeof command !== 'string') {
        throw new Error('Invalid command provided');
      }

      // Validate and sanitize command
      const validation = this.securityUtils.validateInput(command, 'command');
      if (!validation.isValid) {
        throw new Error(`Command validation failed: ${validation.errors.join(', ')}`);
      }

      const { stdout, stderr } = await execAsync(command, {
        timeout,
        encoding: 'utf8',
        windowsHide: true
      });

      if (stderr && stderr.trim()) {
        console.warn('PowerShellExecutor: Command stderr:', stderr);
      }

      return this.parseOutput(stdout);
    } catch (error) {
      this.errorHandler.error(error, 'PowerShellExecutor.executeCommand');
      return [];
    }
  }

  /**
   * Get Dofus windows using the initialized script
   */
  async getDofusWindows() {
    if (!this.isReady || !this.scriptPath) {
      await this.initialize();
    }

    if (!this.isReady) {
      return [];
    }

    const command = `powershell.exe -ExecutionPolicy Bypass -File "${this.scriptPath}" get-windows`;
    return await this.executeCommand(command);
  }

  /**
   * Get windows using alternative method (direct PowerShell command)
   */
  async getWindowsAlternative() {
    const command = 'powershell.exe -Command "Get-Process | Where-Object { $_.MainWindowTitle -and $_.MainWindowTitle -ne \\'\\' } | Where-Object { $_.MainWindowTitle -like \\'*Release*\\' -or $_.MainWindowTitle -like \\'*Dofus*\\' } | Where-Object { $_.MainWindowTitle -notlike \\'*Ankama Launcher*\\' -and $_.MainWindowTitle -notlike \\'*Organizer*\\' } | ForEach-Object { @{ Handle = [string]$_.MainWindowHandle.ToInt64(); Title = $_.MainWindowTitle; ProcessId = $_.Id; ClassName = \\'Unknown\\'; IsActive = $false; Bounds = @{ X = 0; Y = 0; Width = 800; Height = 600 } } } | ConvertTo-Json -Depth 2"';
    
    return await this.executeCommand(command);
  }

  /**
   * Parse PowerShell output safely
   */
  parseOutput(stdout) {
    if (!stdout || !stdout.trim() || stdout.trim() === '[]' || stdout.trim() === 'null') {
      return [];
    }

    try {
      const jsonData = stdout.trim();
      
      // Validate JSON before parsing
      if (!this.isValidJson(jsonData)) {
        throw new Error('Invalid JSON format received from PowerShell');
      }

      const result = JSON.parse(jsonData);
      return Array.isArray(result) ? result : [result];
    } catch (parseError) {
      this.errorHandler.error(parseError, 'PowerShellExecutor.parseOutput');
      console.log('PowerShellExecutor: Raw output:', stdout.substring(0, 500));
      return [];
    }
  }

  /**
   * Validate JSON string before parsing
   */
  isValidJson(jsonString) {
    if (!jsonString || typeof jsonString !== 'string') {
      return false;
    }
    
    try {
      const trimmed = jsonString.trim();
      if (trimmed.length === 0) return false;
      
      // Must start with { or [
      if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
        return false;
      }
      
      // Must end with } or ]
      if (!trimmed.endsWith('}') && !trimmed.endsWith(']')) {
        return false;
      }
      
      // Test parse without throwing
      JSON.parse(trimmed);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Generate PowerShell script for window detection
   */
  generateWindowDetectionScript() {
    return `
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
        return @()
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
        default { 
            Write-Host "Usage: script.ps1 [get-windows]" 
        }
    }
} catch {
    Write-Error "Script execution failed: $_"
    exit 1
}
`;
  }

  /**
   * Create temporary PowerShell script file
   */
  async createTempScript(script) {
    const os = require('os');
    const path = require('path');
    const fs = require('fs').promises;

    const scriptPath = path.join(os.tmpdir(), 'dorganize-windows-detector.ps1');
    
    try {
      await fs.writeFile(scriptPath, script, 'utf8');
      return scriptPath;
    } catch (error) {
      this.errorHandler.error(error, 'PowerShellExecutor.createTempScript');
      throw error;
    }
  }

  /**
   * Test PowerShell script
   */
  async testScript() {
    if (!this.scriptPath) {
      throw new Error('Script path not set');
    }

    const command = `powershell.exe -ExecutionPolicy Bypass -File "${this.scriptPath}" get-windows`;
    const { stderr } = await execAsync(command, { 
      timeout: 10000,
      encoding: 'utf8',
      windowsHide: true 
    });

    if (stderr && stderr.trim()) {
      console.warn('PowerShellExecutor: Test stderr:', stderr);
      throw new Error(`PowerShell test failed: ${stderr}`);
    }

    console.log('PowerShellExecutor: Test successful');
  }

  /**
   * Check if PowerShell is available
   */
  async checkPowerShellAvailability() {
    try {
      await execAsync('powershell.exe -Command "Write-Output test"', { 
        timeout: 5000,
        windowsHide: true 
      });
      return true;
    } catch (error) {
      this.errorHandler.warn('PowerShell not available', 'PowerShellExecutor');
      return false;
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    if (this.scriptPath) {
      try {
        const fs = require('fs').promises;
        await fs.unlink(this.scriptPath);
        console.log('PowerShellExecutor: Cleaned up script file');
      } catch (error) {
        this.errorHandler.warn(`Failed to cleanup script: ${error.message}`, 'PowerShellExecutor');
      }
    }
  }
}

module.exports = PowerShellExecutor;
