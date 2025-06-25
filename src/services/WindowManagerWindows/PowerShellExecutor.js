const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const { getErrorHandler } = require('../ErrorHandler');
const { getSecurityUtils } = require('../../utils/SecurityUtils');
const os = require('os');
const fs = require('fs').promises;
const path = require('path');

/**
 * PowerShellExecutor - Handles secure PowerShell command execution with configurable timeouts and availability checking
 */
class PowerShellExecutor {
  constructor(options = {}) {
    this.errorHandler = getErrorHandler();
    this.securityUtils = getSecurityUtils();

    // Configuration with user-configurable timeouts
    this.config = {
      // Timeout settings (all in milliseconds)
      defaultTimeout: options.defaultTimeout || 15000,     // 15 seconds
      initTimeout: options.initTimeout || 10000,           // 10 seconds for initialization
      testTimeout: options.testTimeout || 5000,            // 5 seconds for tests
      fallbackTimeout: options.fallbackTimeout || 3000,    // 3 seconds for fallback methods
      availabilityTimeout: options.availabilityTimeout || 2000, // 2 seconds for availability check

      // Retry settings
      maxRetries: options.maxRetries || 3,
      retryDelayBase: options.retryDelayBase || 1000,      // Base delay for exponential backoff
      maxRetryDelay: options.maxRetryDelay || 10000,       // Maximum retry delay

      // Buffer and security limits
      maxBufferSize: options.maxBufferSize || (1024 * 1024 * 5), // 5MB default
      maxCommandLength: options.maxCommandLength || 8000,

      // Feature flags
      enableAvailabilityCheck: options.enableAvailabilityCheck !== false,
      enableFallbackMethods: options.enableFallbackMethods !== false,
      enableRetryOnFailure: options.enableRetryOnFailure !== false,
      strictValidation: options.strictValidation !== false,

      // Environment settings
      executionPolicy: options.executionPolicy || 'Bypass',
      windowsHide: options.windowsHide !== false,
      encoding: options.encoding || 'utf8'
    };    // State management
    this.scriptPath = null;
    this.isReady = false;
    this.isInitializing = false;
    this.isPowerShellAvailable = null; // Cache availability check
    this.powershellAvailability = {
      isAvailable: false,
      features: {
        basicExecution: false,
        scriptExecution: false,
        jsonSupport: false
      }
    };

    // Operation tracking
    this.activeOperations = new Map();
    this.operationIdCounter = 0;

    // Statistics
    this.stats = {
      totalExecutions: 0,
      successfulExecutions: 0,
      errors: 0,
      totalExecutionTime: 0,
      averageExecutionTime: 0
    };    // Configurable timeouts
    this.timeouts = {
      default: 30000,      // 30 seconds for regular operations (increased from 15s)
      initialization: 40000, // 40 seconds for initialization (increased from 20s)
      test: 15000,         // 15 seconds for tests (increased from 10s)
      availability: 5000   // 5 seconds for availability checks
    };

    // Retry configuration
    this.retryConfig = {
      maxRetries: 3,
      retryDelay: 1000  // 1 second between retries
    };
  }

  /**
   * Wait for initialization to complete
   */
  async waitForInitialization() {
    console.log('PowerShellExecutor: Waiting for initialization to complete...');

    // Wait for a maximum of 30 seconds for initialization to complete
    const startTime = Date.now();
    const maxWaitTime = 30000; // 30 seconds

    while (this.isInitializing && (Date.now() - startTime) < maxWaitTime) {
      await this.delay(500); // Check every 500ms
    }

    // Check if we timed out
    if (this.isInitializing) {
      this.isInitializing = false; // Reset the flag to prevent deadlocks
      console.error('PowerShellExecutor: Initialization timed out after 30 seconds');
      throw new Error('Initialization timed out after 30 seconds');
    }

    // Return initialization status
    return this.isReady;
  }

  /**
   * Initialize PowerShell executor with comprehensive availability checking
   */
  async initialize() {
    if (this.isInitializing) {
      return this.waitForInitialization();
    }

    if (this.isReady) {
      return true;
    }

    this.isInitializing = true;

    try {
      // Check PowerShell availability first
      const isAvailable = await this.checkPowerShellAvailability();
      if (!isAvailable) {
        this.isInitializing = false; // Important: reset flag on failure
        throw new Error('PowerShell is not available on this system');
      }

      const script = this.generateWindowDetectionScript();
      if (!script || script.trim().length === 0) {
        this.isInitializing = false; // Important: reset flag on failure
        throw new Error('Failed to generate PowerShell detection script');
      }

      // Step 3: Create temporary script file
      this.scriptPath = await this.createTempScript(script);
      if (!this.scriptPath) {
        this.isInitializing = false; // Important: reset flag on failure
        throw new Error('Failed to create temporary script file');
      }

      // Step 4: Test script functionality
      await this.testScript();

      // Step 5: Final validation
      await this.validateInitialization();

      this.isReady = true;
      this.isInitializing = false; // Important: reset flag when complete
      this.initRetryCount = 0;
      console.log('PowerShellExecutor: Initialization completed successfully');
      return true;

    } catch (error) {
      this.isReady = false;
      this.isInitializing = false; // Important: reset flag on failure
      console.error('PowerShellExecutor: Initialization failed:', error.message);
      throw error; // Re-throw to let caller handle initialization failure
    }
  }

  /**
   * Wait for ongoing initialization to complete
   */
  async executeCommand(command, timeout = null) {
    try {
      // Validate inputs
      if (!command || typeof command !== 'string') {
        throw new Error('Invalid command provided');
      }

      // Check PowerShell availability if not cached
      if (this.isPowerShellAvailable === null) {
        this.isPowerShellAvailable = await this.checkPowerShellAvailability();
      }

      if (!this.isPowerShellAvailable) {
        throw new Error('PowerShell is not available');
      }      // Use provided timeout or default
      const effectiveTimeout = timeout || this.timeouts.default;

      // Skip security validation for internal commands (those that use our script)
      let commandToExecute = command;
      if (command.includes('-File') && command.includes(this.scriptPath)) {
        // This is our own script, safe to execute
        console.log('PowerShellExecutor: Executing trusted internal script');
      } else {
        // External command, validate and sanitize
        const validation = this.securityUtils.validateInput(command, 'command');
        if (!validation.isValid) {
          throw new Error(`Command validation failed: ${validation.errors.join(', ')}`);
        }
        commandToExecute = validation.sanitized;
      }

      // Execute with retry logic
      return await this.executeWithRetry(commandToExecute, effectiveTimeout);

    } catch (error) {
      this.errorHandler.error(error, 'PowerShellExecutor.executeCommand');

      // Return empty array as fallback for window detection operations
      if (error.message.includes('timeout') || error.message.includes('PowerShell')) {
        console.warn('PowerShellExecutor: Falling back to empty result due to error:', error.message);
        return [];
      }

      throw error;
    }
  }
  /**
   * Execute command with retry logic
   */
  async executeWithRetry(command, timeout) {
    let lastError;
    const startTime = Date.now();
    const commandExcerpt = command.length > 40 ? command.substring(0, 40) + '...' : command;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        // Add attempt logging for debugging
        if (attempt > 0) {
          const elapsed = Date.now() - startTime;
          console.log(`PowerShellExecutor: Retry attempt ${attempt}/${this.retryConfig.maxRetries} after ${elapsed}ms for command: ${commandExcerpt}`);
        }

        // Use a higher maxBuffer to handle larger outputs
        const { stdout, stderr } = await execAsync(command, {
          timeout,
          encoding: 'utf8',
          windowsHide: true,
          maxBuffer: this.config.maxBufferSize || (5 * 1024 * 1024) // 5MB buffer limit (increased)
        });

        // Log stderr as warning but don't fail
        if (stderr && stderr.trim()) {
          console.warn('PowerShellExecutor: Command stderr:', stderr.substring(0, 200));
        }

        const result = this.parseOutput(stdout);
        const elapsed = Date.now() - startTime;

        if (attempt > 0) {
          console.log(`PowerShellExecutor: Succeeded after ${attempt + 1} attempts in ${elapsed}ms`);
        }

        return result;

      } catch (error) {
        lastError = error;
        const elapsed = Date.now() - startTime;
        const isTimeout = error.message && error.message.includes('timeout');

        if (isTimeout) {
          console.warn(`PowerShellExecutor: Command timed out after ${elapsed}ms: ${commandExcerpt}`);
        } else {
          console.error(`PowerShellExecutor: Command error after ${elapsed}ms:`, error.message);
        }

        // Don't retry for certain types of errors
        if (error.code === 'ENOENT' || error.message.includes('not recognized')) {
          console.error('PowerShellExecutor: PowerShell not found, aborting retries');
          this.isPowerShellAvailable = false;
          break;
        }

        // Don't retry for validation errors
        if (error.message.includes('validation')) {
          break;
        }

        // Don't retry on timeout if this is a long-running task
        if (isTimeout && timeout > 15000) {
          console.warn('PowerShellExecutor: Not retrying timeout for long-running task');
          break;
        }

        // Wait before retry (except on last attempt)
        if (attempt < this.retryConfig.maxRetries) {
          const retryDelay = Math.min(
            this.retryConfig.retryDelay * Math.pow(2, attempt),
            this.config.maxRetryDelay || 10000
          );
          console.log(`PowerShellExecutor: Waiting ${retryDelay}ms before retry ${attempt + 1}`);
          await this.delay(retryDelay);
        }
      }
    }

    // If we get here, all retries failed
    throw lastError;
  }
  /**
   * Get Dofus windows using the initialized script
   */
  async getDofusWindows() {
    try {
      console.log('PowerShellExecutor: Starting window detection with timeout', this.timeouts.default);
      const startTime = Date.now();

      if (!this.isReady || !this.scriptPath) {
        console.log('PowerShellExecutor: Not ready, initializing...');
        try {
          await this.initialize();
        } catch (initError) {
          console.warn('PowerShellExecutor: Initialization failed, falling back to alternative method:', initError.message);
          return await this.getWindowsAlternative();
        }
      }

      if (!this.isReady) {
        console.warn('PowerShellExecutor: Not ready after initialization, using alternative method');
        return await this.getWindowsAlternative();
      }

      const command = `powershell.exe -ExecutionPolicy Bypass -File "${this.scriptPath}" get-windows`;
      const result = await this.executeCommand(command, this.timeouts.default);

      const duration = Date.now() - startTime;
      console.log(`PowerShellExecutor: Window detection completed in ${duration}ms, found ${Array.isArray(result) ? result.length : 0} windows`);

      return result;
    } catch (error) {
      const isTimeout = error.message && error.message.includes('timeout');

      if (isTimeout) {
        console.warn(`PowerShellExecutor: Window detection timed out after ${this.timeouts.default}ms`);
      } else {
        this.errorHandler.error(error, 'PowerShellExecutor.getDofusWindows');
      }

      // Try alternative method as fallback
      console.warn('PowerShellExecutor: Primary method failed, trying alternative...');
      try {
        return await this.getWindowsAlternative();
      } catch (fallbackError) {
        console.error('PowerShellExecutor: Alternative method also failed:', fallbackError.message);
        return []; // Return empty array as last resort
      }
    }
  }

  /**
   * Fallback method with configurable timeout
   */  async getWindowsAlternative() {
    try {
      const command = 'powershell.exe -Command "Get-Process | Where-Object { $_.MainWindowTitle -and $_.MainWindowTitle -ne \'\' } | Where-Object { $_.MainWindowTitle -like \'* Release *\' -or $_.MainWindowTitle -like \'* Dofus *\' } | Where-Object { $_.MainWindowTitle -notlike \'* Ankama Launcher *\' -and $_.MainWindowTitle -notlike \'* Organizer *\' } | ForEach-Object { @{ Handle = [string]$_.MainWindowHandle.ToInt64(); Title = $_.MainWindowTitle; ProcessId = $_.Id; ClassName = \'Unknown\'; IsActive = $false; Bounds = @{ X = 0; Y = 0; Width = 800; Height = 600 } } } | ConvertTo-Json -Depth 2"';

      return await this.executeCommand(command, this.timeouts.default);
    } catch (error) {
      this.errorHandler.error(error, 'PowerShellExecutor.getWindowsAlternative');
      return []; // Always return array for window detection
    }
  }

  /**
   * Test script with configurable timeout
   */
  async testScript() {
    if (!this.scriptPath) {
      throw new Error('Script path not set');
    }

    try {
      console.log('PowerShellExecutor: Testing script functionality...');

      const operationId = this.generateOperationId('test-script');
      const command = `powershell.exe -ExecutionPolicy ${this.config.executionPolicy} -NoProfile -NonInteractive -File "${this.scriptPath}" get-windows`;

      const startTime = Date.now();
      const { stdout, stderr } = await this.executeWithTimeout(command, this.config.testTimeout, operationId);

      const testTime = Date.now() - startTime;
      console.log(`PowerShellExecutor: Script test completed in ${testTime}ms`);

      if (stderr && stderr.trim()) {
        console.warn('PowerShellExecutor: Test stderr:', stderr.substring(0, 300));

        if (this.containsCriticalError(stderr)) {
          throw new Error(`PowerShell script test failed: ${stderr.substring(0, 200)}`);
        }
      }

      // Validate output format
      if (stdout) {
        const testResult = this.parseOutput(stdout);
        if (!Array.isArray(testResult)) {
          throw new Error('Script test failed: Invalid output format');
        }
      }

      console.log('PowerShellExecutor: Script test successful');

    } catch (error) {
      this.errorHandler.error(error, 'PowerShellExecutor.testScript');
      throw new Error(`PowerShell script test failed: ${error.message}`);
    }
  }

  /**
   * Validate initialization state
   */
  async validateInitialization() {
    try {
      // Check script file exists
      if (!this.scriptPath || !(await this.fileExists(this.scriptPath))) {
        throw new Error('Script file not found after creation');
      }

      // Check PowerShell features required for operation
      if (!this.powershellAvailability.features.basicExecution) {
        throw new Error('Basic PowerShell execution not available');
      }

      console.log('PowerShellExecutor: Initialization validation passed');

    } catch (error) {
      throw new Error(`Initialization validation failed: ${error.message}`);
    }
  }

  /**
   * Create temporary script with enhanced error handling
   */
  async createTempScript(script) {
    try {
      if (!script || typeof script !== 'string' || script.trim().length === 0) {
        throw new Error('Invalid script content provided');
      }

      const tempDir = os.tmpdir();
      const scriptName = `dorganize-windows-detector-${Date.now()}-${Math.random().toString(36).substring(7)}.ps1`;
      const scriptPath = path.join(tempDir, scriptName);

      // Normalize line endings for Windows
      const normalizedScript = script.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');

      await fs.writeFile(scriptPath, normalizedScript, {
        encoding: 'utf8',
        mode: 0o600 // Restrict permissions for security
      });

      // Verify file creation
      if (!(await this.fileExists(scriptPath))) {
        throw new Error('Failed to verify script file creation');
      }

      console.log(`PowerShellExecutor: Created script at ${scriptPath}`);
      return scriptPath;

    } catch (error) {
      this.errorHandler.error(error, 'PowerShellExecutor.createTempScript');
      throw new Error(`Failed to create PowerShell script: ${error.message}`);
    }
  }

  /**
   * Parse output with enhanced error handling
   */  parseOutput(stdout) {
    if (!stdout || typeof stdout !== 'string') {
      return [];
    }

    const trimmed = stdout.trim();
    if (trimmed === '' || trimmed === '[]' || trimmed === 'null') {
      return [];
    }

    // Handle special case when output is just "true" or "false" as text
    if (trimmed === 'true' || trimmed === 'false') {
      console.log(`PowerShellExecutor: Received boolean value: ${trimmed}`);
      return [];
    }

    try {
      // Pre-validate JSON structure
      if (!this.isValidJson(trimmed)) {
        console.warn('PowerShellExecutor: Invalid JSON received, attempting cleanup');

        // Check if the output contains "Usage:" text or help text
        if (trimmed.includes('Usage:') || trimmed.includes('-') && trimmed.includes('[') && !trimmed.includes('{')) {
          console.log('PowerShellExecutor: Help text detected in output, returning empty result');
          return [];
        }

        const cleaned = this.cleanJsonString(trimmed);
        if (!this.isValidJson(cleaned)) {
          console.warn('PowerShellExecutor: Failed to parse output:', trimmed.substring(0, 500));
          return []; // Return empty array instead of throwing error
        }

        const result = JSON.parse(cleaned);
        return Array.isArray(result) ? result : [result];
      }

      const result = JSON.parse(trimmed);
      return Array.isArray(result) ? result : [result];

    } catch (parseError) {
      this.errorHandler.error(parseError, 'PowerShellExecutor.parseOutput');
      console.warn('PowerShellExecutor: Failed to parse output:', trimmed.substring(0, 500));
      return [];
    }
  }

  /**
   * Enhanced JSON validation
   */
  isValidJson(jsonString) {
    if (!jsonString || typeof jsonString !== 'string') {
      return false;
    }

    try {
      const trimmed = jsonString.trim();
      if (trimmed.length === 0) return false;

      if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
        return false;
      }

      if (!trimmed.endsWith('}') && !trimmed.endsWith(']')) {
        return false;
      }

      JSON.parse(trimmed);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clean JSON string to handle PowerShell output issues
   */
  cleanJsonString(jsonString) {
    if (!jsonString) return '[]';

    try {
      let cleaned = jsonString.trim();

      // Remove BOM if present
      if (cleaned.charCodeAt(0) === 0xFEFF) {
        cleaned = cleaned.slice(1);
      }

      // Remove trailing garbage after valid JSON
      const openBraces = (cleaned.match(/[{[]/g) || []).length;
      const closeBraces = (cleaned.match(/[}\]]/g) || []).length;

      if (openBraces !== closeBraces) {
        let bracketCount = 0;
        let lastValidIndex = -1;

        for (let i = 0; i < cleaned.length; i++) {
          const char = cleaned[i];
          if (char === '{' || char === '[') bracketCount++;
          if (char === '}' || char === ']') {
            bracketCount--;
            if (bracketCount === 0) {
              lastValidIndex = i;
            }
          }
        }

        if (lastValidIndex > -1) {
          cleaned = cleaned.substring(0, lastValidIndex + 1);
        }
      }

      return cleaned;
    } catch (error) {
      console.warn('PowerShellExecutor: Failed to clean JSON string:', error.message);
      return '[]';
    }
  }

  /**
   * Check if stderr contains critical errors
   */
  containsCriticalError(stderr) {
    const criticalPatterns = [
      'execution policy',
      'access denied',
      'cannot be loaded',
      'unauthorized access',
      'security error',
      'fatal error'
    ];

    const lowerStderr = stderr.toLowerCase();
    return criticalPatterns.some(pattern => lowerStderr.includes(pattern));
  }

  /**
   * Generate unique operation ID
   */
  generateOperationId(operation) {
    return `${operation}-${Date.now()}-${++this.operationIdCounter}`;
  }

  /**
   * Get operation execution time
   */
  getOperationTime(operationId) {
    const operation = this.activeOperations.get(operationId);
    return operation ? Date.now() - operation.startTime : 0;
  }

  /**
   * Check if file exists
   */
  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delay utility
   */
  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Update performance statistics
   */
  updateStats(success, executionTime) {
    if (success) {
      this.stats.successfulExecutions++;
    } else {
      this.stats.errors++;
    }

    this.stats.totalExecutionTime += executionTime;
    this.stats.averageExecutionTime = Math.round(this.stats.totalExecutionTime / this.stats.totalExecutions);
  }

  /**
   * Get comprehensive statistics
   */
  getStatistics() {
    return {
      ...this.stats,
      successRate: this.stats.totalExecutions > 0 ?
        Math.round((this.stats.successfulExecutions / this.stats.totalExecutions) * 100) : 0,
      isReady: this.isReady,
      powershellAvailability: this.powershellAvailability,
      activeOperations: this.activeOperations.size,
      configuration: {
        timeouts: {
          default: this.config.defaultTimeout,
          init: this.config.initTimeout,
          test: this.config.testTimeout,
          fallback: this.config.fallbackTimeout,
          availability: this.config.availabilityTimeout
        },
        features: {
          availabilityCheck: this.config.enableAvailabilityCheck,
          fallbackMethods: this.config.enableFallbackMethods,
          retryOnFailure: this.config.enableRetryOnFailure,
          strictValidation: this.config.strictValidation
        }
      }
    };
  }

  /**
   * Update configuration at runtime
   */
  updateConfig(newConfig) {
    const allowedUpdates = [
      'defaultTimeout', 'initTimeout', 'testTimeout', 'fallbackTimeout', 'availabilityTimeout',
      'maxRetries', 'retryDelayBase', 'maxRetryDelay', 'maxBufferSize', 'maxCommandLength',
      'enableAvailabilityCheck', 'enableFallbackMethods', 'enableRetryOnFailure', 'strictValidation'
    ];

    for (const [key, value] of Object.entries(newConfig)) {
      if (allowedUpdates.includes(key)) {
        this.config[key] = value;
        console.log(`PowerShellExecutor: Updated config ${key} = ${value}`);
      }
    }
  }

  /**
   * Cancel all active operations
   */
  cancelAllOperations() {
    console.log(`PowerShellExecutor: Cancelling ${this.activeOperations.size} active operations`);

    for (const [operationId, operation] of this.activeOperations) {
      try {
        operation.abortController.abort();
        console.log(`PowerShellExecutor: Cancelled operation ${operationId}`);
      } catch (error) {
        console.warn(`PowerShellExecutor: Failed to cancel operation ${operationId}:`, error.message);
      }
    }

    this.activeOperations.clear();
  }

  /**
   * Get system information for debugging
   */
  async getSystemInfo() {
    try {
      const systemInfo = {
        platform: os.platform(),
        arch: os.arch(),
        release: os.release(),
        powershellAvailability: this.powershellAvailability,
        nodeVersion: process.version,
        timestamp: new Date().toISOString()
      };

      // Try to get PowerShell version if available
      if (this.powershellAvailability.isAvailable) {
        try {
          const versionCommand = `powershell.exe -ExecutionPolicy ${this.config.executionPolicy} -NoProfile -NonInteractive -Command "$PSVersionTable | ConvertTo-Json"`;
          const result = await this.executeWithTimeout(versionCommand, this.config.availabilityTimeout, this.generateOperationId('system-info'));
          systemInfo.powershellVersionTable = this.parseOutput(result.stdout);
        } catch (error) {
          systemInfo.powershellVersionError = error.message;
        }
      }

      return systemInfo;

    } catch (error) {
      this.errorHandler.error(error, 'PowerShellExecutor.getSystemInfo');
      return {
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Execute command with timeout tracking
   */
  async executeWithTimeout(command, timeout, operationId) {
    if (!operationId) {
      operationId = this.generateOperationId('exec');
    }

    try {
      // Initialize operation tracking
      if (!this.activeOperations) {
        this.activeOperations = new Map();
      }

      if (!this.operationIdCounter) {
        this.operationIdCounter = 0;
      }

      // Execute command with specified timeout
      const result = await execAsync(command, {
        timeout,
        encoding: 'utf8',
        windowsHide: true,
        maxBuffer: this.config.maxBufferSize || 1024 * 1024
      });

      return result;
    } catch (error) {
      console.error(`PowerShellExecutor: Operation ${operationId} failed:`, error.message);
      throw error;
    }
  }

  /**
   * Check if PowerShell is available on the system
   * @returns {Promise<boolean>} True if PowerShell is available
   */
  async checkPowerShellAvailability() {
    try {
      console.log('PowerShellExecutor: Checking PowerShell availability...');

      // Try a simple PowerShell command to check availability
      const { stdout, stderr } = await execAsync(
        'powershell.exe -NoProfile -NonInteractive -Command "echo $PSVersionTable.PSVersion"',
        { timeout: this.timeouts.availability, windowsHide: true }
      );

      if (stderr && stderr.trim()) {
        console.warn('PowerShellExecutor: Warning during availability check:', stderr.trim());
      }

      // Store availability state
      this.powershellAvailability = {
        isAvailable: true,
        features: {
          basicExecution: true,
          scriptExecution: true,
          jsonSupport: true
        }
      };

      this.isPowerShellAvailable = true;
      console.log('PowerShellExecutor: PowerShell availability confirmed');

      return true;
    } catch (error) {
      console.error('PowerShellExecutor: PowerShell not available:', error.message);

      this.powershellAvailability = {
        isAvailable: false,
        features: {
          basicExecution: false,
          scriptExecution: false,
          jsonSupport: false
        },
        error: error.message
      };

      this.isPowerShellAvailable = false;
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
    
    # Élargie la détection pour inclure plus de processus potentiels
    $targetProcesses = @("Dofus", "Dofus.exe", "DofusRetro", "DofusRetro.exe", "java", "java.exe")
    
    $callback = {
        param($hwnd, $lparam)
        
        try {
            if ([WindowsAPI]::IsWindowVisible($hwnd)) {
                $length = [WindowsAPI]::GetWindowTextLength($hwnd)
                if ($length -gt 0) {
                    $builder = New-Object System.Text.StringBuilder($length + 1)
                    [WindowsAPI]::GetWindowText($hwnd, $builder, $builder.Capacity)
                    $title = $builder.ToString()
                    
                    # Afficher plus d'informations pour le débogage
                    # Write-Host "Window found: $title"
                    
                    $classBuilder = New-Object System.Text.StringBuilder(256)
                    [WindowsAPI]::GetClassName($hwnd, $classBuilder, $classBuilder.Capacity)
                    $className = $classBuilder.ToString()
                    
                    # Afficher la classe pour le débogage
                    # Write-Host "Class: $className"
                    
                    $processId = 0
                    [WindowsAPI]::GetWindowThreadProcessId($hwnd, [ref]$processId)
                    
                    try {
                        $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
                        $processName = if ($process) { $process.ProcessName } else { "Unknown" }
                        
                        # Vérification plus large pour capturer toutes les fenêtres Dofus
                        # Nous recherchons "Dofus" dans le titre OU dans le nom de la classe OU dans le nom du processus
                        $titleLower = $title.ToLower()
                        $classNameLower = $className.ToLower()
                        $processNameLower = $processName.ToLower()
                        
                        $isDofusWindow = 
                            ($titleLower -match "dofus|ankama|retro|steamer|boulonix") -or
                            ($classNameLower -match "dofus|ankama") -or
                            ($targetProcesses -contains $processName) -or
                            ($processNameLower -match "dofus|ankama")
                            
                        $isExcluded =
                            ($titleLower -match "organizer|configuration|launcher|updater")
                            
                        if ($isDofusWindow -and -not $isExcluded) {
                            $rect = New-Object WindowsAPI+RECT
                            [WindowsAPI]::GetWindowRect($hwnd, [ref]$rect)
                            
                            $foregroundWindow = [WindowsAPI]::GetForegroundWindow()
                            $isActive = $hwnd -eq $foregroundWindow
                            
                            $window = @{
                                Handle = $hwnd.ToInt64()
                                Title = $title
                                ClassName = $className
                                ProcessId = $processId
                                ProcessName = $processName
                                IsActive = $isActive
                                Bounds = @{
                                    X = $rect.Left
                                    Y = $rect.Top
                                    Width = $rect.Right - $rect.Left
                                    Height = $rect.Bottom - $rect.Top
                                }
                            }
                            
                            # Ajouter à la liste des fenêtres
                            $script:windows += $window
                        }
                    } catch {
                        # Ignorer les erreurs pour ce processus
                    }
                }
            }
        } catch {
            # Ignorer les erreurs pour cette fenêtre
            # Write-Warning "Window error: $_"
        }
        
        return $true
    }
    
    try {
        $script:windows = @()
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
        "debug-windows" {
            $allWindows = @()
            
            $callback = {
                param($hwnd, $lparam)
                
                try {
                    if ([WindowsAPI]::IsWindowVisible($hwnd)) {
                        $length = [WindowsAPI]::GetWindowTextLength($hwnd)
                        if ($length -gt 0) {
                            $titleBuilder = New-Object System.Text.StringBuilder($length + 1)
                            [WindowsAPI]::GetWindowText($hwnd, $titleBuilder, $titleBuilder.Capacity)
                            $title = $titleBuilder.ToString()
                            
                            $classBuilder = New-Object System.Text.StringBuilder(256)
                            [WindowsAPI]::GetClassName($hwnd, $classBuilder, $classBuilder.Capacity)
                            $className = $classBuilder.ToString()
                            
                            $processId = 0
                            [WindowsAPI]::GetWindowThreadProcessId($hwnd, [ref]$processId)
                            
                            try {
                                $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
                                $processName = if ($process) { $process.ProcessName } else { "Unknown" }
                                
                                $window = @{
                                    Handle = $hwnd.ToInt64()
                                    Title = $title
                                    ClassName = $className
                                    ProcessId = $processId
                                    ProcessName = $processName
                                }
                                
                                $script:allWindows += $window
                            } catch {
                                # Ignorer les erreurs de processus
                            }
                        }
                    }
                    
                    return $true
                } catch {
                    # Ignorer les erreurs pour cette fenêtre
                    return $true
                }
            }
            
            $script:allWindows = @()
            [WindowsAPI]::EnumWindows($callback, [IntPtr]::Zero)
            $script:allWindows | ConvertTo-Json -Depth 3
        }
        default { 
            Write-Host "Usage: script.ps1 [get-windows|debug-windows]" 
        }
    }
} catch {
    Write-Error "Script execution failed: $_"
    exit 1
}
`;
  }
}

module.exports = PowerShellExecutor;
