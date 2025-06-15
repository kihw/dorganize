/**
 * DIAGNOSTIC SCRIPT - Pour identifier le vrai nom du processus Steamer/Boulonix
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

class ProcessDiagnostic {
  /**
   * Diagnostic complet des processus pour identifier Steamer/Boulonix
   */
  static async diagnoseAllProcesses() {
    console.log('\n=== DIAGNOSTIC COMPLET DES PROCESSUS ===\n');

    try {
      // 1. Lister TOUS les processus avec fenêtres
      await this.listAllProcessesWithWindows();

      // 2. Chercher spécifiquement les processus suspects
      await this.searchSuspiciousProcesses();

      // 3. Chercher par titre de fenêtre
      await this.searchByWindowTitle();

    } catch (error) {
      console.error('Diagnostic failed:', error);
    }
  }

  /**
   * Liste tous les processus avec des fenêtres
   */
  static async listAllProcessesWithWindows() {
    try {
      console.log('📋 TOUS LES PROCESSUS AVEC FENÊTRES:');

      const command = `powershell.exe -NoProfile -Command "
        Get-Process | Where-Object { 
          $_.MainWindowHandle -ne 0 -and 
          $_.MainWindowTitle -ne ''
        } | Sort-Object ProcessName | ForEach-Object { 
          [PSCustomObject]@{ 
            ProcessName = $_.ProcessName;
            Title = $_.MainWindowTitle; 
            PID = $_.Id;
            Handle = $_.MainWindowHandle.ToInt64()
          } 
        } | ConvertTo-Json -Depth 2"`;

      const { stdout } = await execAsync(command, {
        timeout: 10000,
        encoding: 'utf8',
        windowsHide: true
      });

      if (stdout && stdout.trim()) {
        const processes = JSON.parse(stdout.trim());
        const processArray = Array.isArray(processes) ? processes : [processes];

        processArray.forEach((proc, index) => {
          console.log(`${index + 1}. Process: "${proc.ProcessName}" | Title: "${proc.Title}" | PID: ${proc.PID}`);
        });

        console.log(`\nTotal: ${processArray.length} processus avec fenêtres\n`);
      }

    } catch (error) {
      console.error('❌ Erreur listing processus:', error.message);
    }
  }

  /**
   * Cherche les processus suspects (Java, Dofus, etc.)
   */
  static async searchSuspiciousProcesses() {
    try {
      console.log('🔍 PROCESSUS SUSPECTS (Java, Dofus, Steamer, etc.):');

      const command = `powershell.exe -NoProfile -Command "
        Get-Process | Where-Object { 
          $_.ProcessName -match 'java|dofus|steamer|boulonix|launcher|ankama' -and
          $_.MainWindowHandle -ne 0
        } | ForEach-Object { 
          [PSCustomObject]@{ 
            ProcessName = $_.ProcessName;
            Title = $_.MainWindowTitle; 
            PID = $_.Id;
            Handle = $_.MainWindowHandle.ToInt64();
            Path = try { $_.Path } catch { 'N/A' }
          } 
        } | ConvertTo-Json -Depth 2"`;

      const { stdout } = await execAsync(command, {
        timeout: 10000,
        encoding: 'utf8',
        windowsHide: true
      });

      if (stdout && stdout.trim() && stdout.trim() !== '[]') {
        const processes = JSON.parse(stdout.trim());
        const processArray = Array.isArray(processes) ? processes : [processes];

        processArray.forEach((proc, index) => {
          console.log(`${index + 1}. 🎯 Process: "${proc.ProcessName}"`);
          console.log(`   Title: "${proc.Title}"`);
          console.log(`   PID: ${proc.PID}`);
          console.log(`   Handle: ${proc.Handle}`);
          console.log(`   Path: ${proc.Path}`);
          console.log('');
        });
      } else {
        console.log('❌ Aucun processus suspect trouvé');
      }

    } catch (error) {
      console.error('❌ Erreur recherche processus suspects:', error.message);
    }
  }

  /**
   * Cherche par titre de fenêtre contenant "boulonix" ou "steamer"
   */
  static async searchByWindowTitle() {
    try {
      console.log('🎯 RECHERCHE PAR TITRE DE FENÊTRE (boulonix, steamer):');

      const command = `powershell.exe -NoProfile -Command "
        Get-Process | Where-Object { 
          $_.MainWindowHandle -ne 0 -and
          $_.MainWindowTitle -match 'boulonix|steamer|Boulonix|Steamer'
        } | ForEach-Object { 
          [PSCustomObject]@{ 
            ProcessName = $_.ProcessName;
            Title = $_.MainWindowTitle; 
            PID = $_.Id;
            Handle = $_.MainWindowHandle.ToInt64();
            WindowClass = try { 
              Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;using System.Text;public class Win32{[DllImport("user32.dll")]public static extern int GetClassName(IntPtr hWnd,StringBuilder lpClassName,int nMaxCount);}'
              $sb = New-Object System.Text.StringBuilder 256
              [Win32]::GetClassName([IntPtr]$_.MainWindowHandle, $sb, 256)
              $sb.ToString()
            } catch { 'N/A' }
          } 
        } | ConvertTo-Json -Depth 2"`;

      const { stdout } = await execAsync(command, {
        timeout: 10000,
        encoding: 'utf8',
        windowsHide: true
      });

      if (stdout && stdout.trim() && stdout.trim() !== '[]') {
        const processes = JSON.parse(stdout.trim());
        const processArray = Array.isArray(processes) ? processes : [processes];

        processArray.forEach((proc, index) => {
          console.log(`${index + 1}. 🎯 TROUVÉ! Process: "${proc.ProcessName}"`);
          console.log(`   Title: "${proc.Title}"`);
          console.log(`   PID: ${proc.PID}`);
          console.log(`   Handle: ${proc.Handle}`);
          console.log(`   Window Class: ${proc.WindowClass}`);
          console.log('');
        });

        console.log('✅ Ces processus devraient être détectables!\n');
      } else {
        console.log('❌ Aucune fenêtre avec "boulonix" ou "steamer" dans le titre');
      }

    } catch (error) {
      console.error('❌ Erreur recherche par titre:', error.message);
    }
  }

  /**
   * Test d'activation directe si on trouve un handle
   */
  static async testDirectActivation(handle) {
    try {
      console.log(`🧪 TEST D'ACTIVATION DIRECTE pour handle ${handle}`);

      const command = `powershell.exe -NoProfile -Command "
        Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class Win32 { [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd); [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow); }'
        $hwnd = [IntPtr]${handle}
        [Win32]::ShowWindow($hwnd, 9)
        $result = [Win32]::SetForegroundWindow($hwnd)
        Write-Output $result
      "`;

      const { stdout } = await execAsync(command, {
        timeout: 3000,
        encoding: 'utf8',
        windowsHide: true
      });

      const success = stdout.trim().toLowerCase() === 'true';
      console.log(`${success ? '✅' : '❌'} Activation ${success ? 'RÉUSSIE' : 'ÉCHOUÉE'}`);

      return success;

    } catch (error) {
      console.error('❌ Erreur test activation:', error.message);
      return false;
    }
  }
}

module.exports = ProcessDiagnostic;
