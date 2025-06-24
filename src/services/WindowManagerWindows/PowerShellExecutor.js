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
    };

    // State management
    this.scriptPath = null;
    this.isReady = false;
    this.isInitializing = false;
    this.initRetryCount = 0;

    // PowerShell availability state
    this.powershellAvailability = {
      isAvailable: null,
      version: null,
      lastCheck: null,
      checkInterval: 30000, // Re-check every 30 seconds if needed
      features: {
        basicExecution: false,
        jsonConversion: false,
        windowsAPI: false,
        errorHandling: false
      }
    };

    // Performance tracking
    this.stats = {
      totalExecutions: 0,
      successfulExecutions: 0,
      timeouts: 0,
      errors: 0,
      retries: 0,
      fallbackUsage: 0,
      totalExecutionTime: 0,
      averageExecutionTime: 0,
      availabilityChecks: 0,
      lastSuccessfulExecution: null,
      lastError: null
    };

    // Active operation tracking
    this.activeOperations = new Map();
    this.operationIdCounter = 0;

    console.log('PowerShellExecutor: Initialized with configurable timeouts and availability checking');
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
      console.log('PowerShellExecutor: Starting initialization with availability checking...');

      // Step 1: Check PowerShell availability
      const isAvailable = await this.checkPowerShellAvailability();
      if (!isAvailable) {
        throw new Error('PowerShell is not available or functional on this system');
      }

      // Step 2: Generate detection script
      const script = this.generateWindowDetectionScript();
      if (!script || script.trim().length === 0) {
        throw new Error('Failed to generate PowerShell detection script');
      }

      // Step 3: Create temporary script file
      this.scriptPath = await this.createTempScript(script);
      if (!this.scriptPath) {
        throw new Error('Failed to create temporary script file');
      }

      // Step 4: Test script functionality
      await this.testScript();

      // Step 5: Final validation
      await this.validateInitialization();

      this.isReady = true;
      this.initRetryCount = 0;
      console.log('PowerShellExecutor: Initialization completed successfully');
      return true;

    } catch (error) {
      this.isReady = false;
      this.initRetryCount++;
      this.stats.lastError = error.message;

      this.errorHandler.error(error, 'PowerShellExecutor.initialize');

      // Retry logic for transient failures
      if (this.config.enableRetryOnFailure && this.initRetryCount < this.config.maxRetries) {
        console.warn(`PowerShellExecutor: Initialization failed, retrying (${this.initRetryCount}/${this.config.maxRetries})...`);

        const retryDelay = Math.min(
          this.config.retryDelayBase * Math.pow(2, this.initRetryCount),
          this.config.maxRetryDelay
        );

        await this.delay(retryDelay);
        this.isInitializing = false;
        return this.initialize();
      }

      console.error('PowerShellExecutor: Failed to initialize after maximum retries');
      return false;

    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Wait for ongoing initialization to complete
   */
  async waitForInitialization() {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (!this.isInitializing) {
          clearInterval(checkInterval);
          resolve(this.isReady);
        }
      }, 100);

      // Timeout after 30 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve(false);
      }, 30000);
    });
  }

  /**
   * Comprehensive PowerShell availability check with feature detection
   */
  async checkPowerShellAvailability() {
    if (this.config.enableAvailabilityCheck === false) {
      console.log('PowerShellExecutor: Availability check disabled, assuming PowerShell is available');
      this.powershellAvailability.isAvailable = true;
      return true;
    }

    // Check cache first
    const now = Date.now();
    if (this.powershellAvailability.isAvailable !== null &&
      this.powershellAvailability.lastCheck &&
      (now - this.powershellAvailability.lastCheck) < this.powershellAvailability.checkInterval) {
      return this.powershellAvailability.isAvailable;
    }

    this.stats.availabilityChecks++;
    this.powershellAvailability.lastCheck = now;

    try {
      console.log('PowerShellExecutor: Checking PowerShell availability and features...');

      // Test 1: Basic PowerShell execution
      const basicTest = await this.testBasicExecution();
      if (!basicTest.success) {
        throw new Error(`Basic execution test failed: ${basicTest.error}`);
      }

      // Test 2: JSON conversion capability
      const jsonTest = await this.testJsonConversion();
      if (!jsonTest.success) {
        console.warn('PowerShellExecutor: JSON conversion test failed, limited functionality available');
      }

      // Test 3: Windows API access
      const apiTest = await this.testWindowsAPIAccess();
      if (!apiTest.success) {
        console.warn('PowerShellExecutor: Windows API test failed, using fallback methods');
      }

      // Test 4: Error handling capability
      const errorTest = await this.testErrorHandling();

      // Update availability state
      this.powershellAvailability = {
        ...this.powershellAvailability,
        isAvailable: true,
        version: basicTest.version,
        features: {
          basicExecution: basicTest.success,
          jsonConversion: jsonTest.success,
          windowsAPI: apiTest.success,
          errorHandling: errorTest.success
        }
      };

      console.log('PowerShellExecutor: PowerShell availability check completed successfully');
      console.log('PowerShellExecutor: Available features:', this.powershellAvailability.features);

      return true;

    } catch (error) {
      this.powershellAvailability.isAvailable = false;
      this.powershellAvailability.lastCheck = now;

      this.errorHandler.warn(`PowerShell availability check failed: ${error.message}`, 'PowerShellExecutor');
      console.error('PowerShellExecutor: PowerShell is not available or functional');

      return false;
    }
  }

  /**
   * Test basic PowerShell execution
   */
  async testBasicExecution() {
    try {
      const operationId = this.generateOperationId('basic-test');

      const command = `powershell.exe -ExecutionPolicy ${this.config.executionPolicy} -NoProfile -NonInteractive -Command "$PSVersionTable.PSVersion.ToString()"`;

      const { stdout, stderr } = await this.executeWithTimeout(command, this.config.availabilityTimeout, operationId);

      if (stderr && this.containsCriticalError(stderr)) {
        throw new Error(`PowerShell execution produced critical errors: ${stderr.substring(0, 200)}`);
      }

      const version = stdout.trim();
      if (!version || version.length === 0) {
        throw new Error('PowerShell did not return version information');
      }

      return {
        success: true,
        version: version,
        executionTime: this.getOperationTime(operationId)
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Test JSON conversion capability
   */
  async testJsonConversion() {
    try {
      const operationId = this.generateOperationId('json-test');

      const command = `powershell.exe -ExecutionPolicy ${this.config.executionPolicy} -NoProfile -NonInteractive -Command "@{test='success'; number=42} | ConvertTo-Json"`;

      const { stdout, stderr } = await this.executeWithTimeout(command, this.config.availabilityTimeout, operationId);

      if (stderr && this.containsCriticalError(stderr)) {
        throw new Error(`JSON test produced errors: ${stderr}`);
      }

      const result = JSON.parse(stdout.trim());
      if (result.test !== 'success' || result.number !== 42) {
        throw new Error('JSON conversion test returned unexpected results');
      }

      return {
        success: true,
        executionTime: this.getOperationTime(operationId)
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Test Windows API access capability
   */
  async testWindowsAPIAccess() {
    try {
      const operationId = this.generateOperationId('api-test');

      const testScript = `
        Add-Type -TypeDefinition @"
        using System;
        using System.Runtime.InteropServices;
        public class TestAPI {
          [DllImport("user32.dll")]
          public static extern IntPtr GetForegroundWindow();
        }
"@
        [TestAPI]::GetForegroundWindow().ToInt64()
      `;

      const command = `powershell.exe -ExecutionPolicy ${this.config.executionPolicy} -NoProfile -NonInteractive -Command "${testScript.replace(/"/g, '""')}"`;

      const { stdout, stderr } = await this.executeWithTimeout(command, this.config.availabilityTimeout, operationId);

      if (stderr && this.containsCriticalError(stderr)) {
        throw new Error(`Windows API test failed: ${stderr}`);
      }

      const handle = parseInt(stdout.trim());
      if (isNaN(handle)) {
        throw new Error('Windows API test did not return valid handle');
      }

      return {
        success: true,
        executionTime: this.getOperationTime(operationId)
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Test error handling capability
   */
  async testErrorHandling() {
    try {
      const operationId = this.generateOperationId('error-test');

      const command = `powershell.exe -ExecutionPolicy ${this.config.executionPolicy} -NoProfile -NonInteractive -Command "try { throw 'test error' } catch { Write-Output 'error handled' }"`;

      const { stdout } = await this.executeWithTimeout(command, this.config.availabilityTimeout, operationId);

      if (!stdout.includes('error handled')) {
        throw new Error('Error handling test failed');
      }

      return {
        success: true,
        executionTime: this.getOperationTime(operationId)
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Execute command with configurable timeout and comprehensive error handling
   */
  async executeCommand(command, customTimeout = null, operationId = null) {
    const timeout = customTimeout || this.config.defaultTimeout;
    const opId = operationId || this.generateOperationId('execute');

    this.stats.totalExecutions++;
    const startTime = Date.now();

    try {
      // Input validation
      if (!command || typeof command !== 'string') {
        throw new Error('Invalid command provided');
      }

      if (command.length > this.config.maxCommandLength) {
        throw new Error(`Command too long (${command.length} > ${this.config.maxCommandLength}), potential security risk`);
      }

      // Security validation
      if (this.config.strictValidation) {
        const validation = this.securityUtils.validateInput(command, 'command');
        if (!validation.isValid) {
          throw new Error(`Command validation failed: ${validation.errors.join(', ')}`);
        }
      }

      // Execute with timeout
      const { stdout, stderr } = await this.executeWithTimeout(command, timeout, opId);

      // Handle stderr warnings
      if (stderr && stderr.trim()) {
        console.warn(`PowerShellExecutor: Command stderr (${opId}):`, stderr.substring(0, 500));

        if (this.containsCriticalError(stderr)) {
          throw new Error(`PowerShell execution error: ${stderr.substring(0, 200)}`);
        }
      }

      // Parse and validate output
      const result = this.parseOutput(stdout);

      // Update statistics
      const executionTime = Date.now() - startTime;
      this.updateStats(true, executionTime);
      this.stats.lastSuccessfulExecution = new Date().toISOString();

      return result;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.updateStats(false, executionTime);
      this.stats.lastError = error.message;

      // Handle specific error types
      if (error.code === 'ABORT_ERR' || error.signal === 'SIGTERM') {
        this.stats.timeouts++;
        throw new Error(`Command timed out after ${timeout}ms (${opId})`);
      }

      if (error.code === 'ENOENT') {
        throw new Error('PowerShell executable not found');
      }

      this.errorHandler.error(error, `PowerShellExecutor.executeCommand [${opId}]`);

      // Return empty array for graceful degradation
      console.warn('PowerShellExecutor: Command failed, returning empty result for graceful degradation');
      return [];
    }
  }

  /**
   * Execute command with timeout protection and operation tracking
   */
  async executeWithTimeout(command, timeout, operationId) {
    const abortController = new AbortController();
    const operation = {
      id: operationId,
      command: command.substring(0, 100) + '...',
      startTime: Date.now(),
      timeout: timeout,
      abortController: abortController
    };

    this.activeOperations.set(operationId, operation);

    // Setup timeout
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, timeout);

    try {
      const result = await execAsync(command, {
        timeout: timeout,
        encoding: this.config.encoding,
        windowsHide: this.config.windowsHide,
        signal: abortController.signal,
        maxBuffer: this.config.maxBufferSize,
        env: {
          ...process.env,
          PSExecutionPolicyPreference: this.config.executionPolicy
        }
      });

      clearTimeout(timeoutId);
      this.activeOperations.delete(operationId);

      return result;

    } catch (execError) {
      clearTimeout(timeoutId);
      this.activeOperations.delete(operationId);
      throw execError;
    }
  }

  /**
   * Get Dofus windows with availability checking and fallback
   */
  async getDofusWindows() {
    try {
      // Ensure PowerShell is available
      if (!await this.ensurePowerShellAvailable()) {
        return this.handleUnavailablePowerShell();
      }

      // Ensure initialization
      if (!this.isReady || !this.scriptPath) {
        console.log('PowerShellExecutor: Not ready, attempting initialization...');
        const initialized = await this.initialize();
        if (!initialized) {
          console.warn('PowerShellExecutor: Initialization failed, using fallback method');
          return await this.getWindowsFallback();
        }
      }

      const operationId = this.generateOperationId('get-windows');
      const command = `powershell.exe -ExecutionPolicy ${this.config.executionPolicy} -NoProfile -NonInteractive -File "${this.scriptPath}" get-windows`;

      const result = await this.executeCommand(command, this.config.defaultTimeout, operationId);

      // Validate result
      if (!Array.isArray(result)) {
        console.warn('PowerShellExecutor: Invalid result format, using fallback');
        this.stats.fallbackUsage++;
        return await this.getWindowsFallback();
      }

      return result;

    } catch (error) {
      this.errorHandler.error(error, 'PowerShellExecutor.getDofusWindows');
      console.warn('PowerShellExecutor: Main method failed, using fallback');
      this.stats.fallbackUsage++;
      return await this.getWindowsFallback();
    }
  }

  /**
   * Ensure PowerShell is available before attempting operations
   */
  async ensurePowerShellAvailable() {
    if (this.powershellAvailability.isAvailable === null) {
      return await this.checkPowerShellAvailability();
    }

    // Re-check if last check was too long ago
    const now = Date.now();
    if (now - this.powershellAvailability.lastCheck > this.powershellAvailability.checkInterval) {
      return await this.checkPowerShellAvailability();
    }

    return this.powershellAvailability.isAvailable;
  }

  /**
   * Handle scenarios where PowerShell is unavailable
   */
  handleUnavailablePowerShell() {
    console.error('PowerShellExecutor: PowerShell is not available on this system');

    if (this.config.enableFallbackMethods) {
      console.log('PowerShellExecutor: Attempting alternative detection methods...');
      // Could implement alternative detection methods here
      return [];
    }

    return [];
  }

  /**
   * Fallback method with configurable timeout
   */
  async getWindowsFallback() {
    try {
      console.log('PowerShellExecutor: Using fallback detection method');

      const operationId = this.generateOperationId('fallback');
      const command = `powershell.exe -ExecutionPolicy ${this.config.executionPolicy} -NoProfile -NonInteractive -Command "Get-Process | Where-Object MainWindowTitle | Where-Object { $_.MainWindowTitle -match 'Dofus|Release' } | Select-Object @{n='Handle';e={$_.MainWindowHandle.ToInt64()}}, @{n='Title';e={$_.MainWindowTitle}}, @{n='ProcessId';e={$_.Id}} | ConvertTo-Json"`;

      const result = await this.executeCommand(command, this.config.fallbackTimeout, operationId);

      // Ensure proper format for fallback results
      if (Array.isArray(result)) {
        return result.map(window => ({
          Handle: window.Handle || '0',
          Title: window.Title || 'Unknown',
          ProcessId: window.ProcessId || 0,
          ClassName: 'Unknown',
          IsActive: false,
          Bounds: { X: 0, Y: 0, Width: 800, Height: 600 }
        }));
      }

      return [];

    } catch (error) {
      this.errorHandler.error(error, 'PowerShellExecutor.getWindowsFallback');
      return [];
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
   */
  parseOutput(stdout) {
    if (!stdout || typeof stdout !== 'string') {
      return [];
    }

    const trimmed = stdout.trim();
    if (trimmed === '' || trimmed === '[]' || trimmed === 'null') {
      return [];
    }

    try {
      // Pre-validate JSON structure
      if (!this.isValidJson(trimmed)) {
        console.warn('PowerShellExecutor: Invalid JSON received, attempting cleanup');

        const cleaned = this.cleanJsonString(trimmed);
        if (!this.isValidJson(cleaned)) {
          throw new Error('Unable to parse PowerShell output as valid JSON');
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
   * Cleanup resources with enhanced error handling
   */
  async cleanup() {
    try {
      console.log('PowerShellExecutor: Starting cleanup...');

      // Cancel active operations
      this.cancelAllOperations();

      // Cleanup script file
      if (this.scriptPath) {
        try {
          await fs.unlink(this.scriptPath);
          console.log('PowerShellExecutor: Cleaned up script file');
        } catch (unlinkError) {
          this.errorHandler.warn(`Failed to cleanup script: ${unlinkError.message}`, 'PowerShellExecutor');
        }
      }

      // Reset state
      this.scriptPath = null;
      this.isReady = false;
      this.isInitializing = false;
      this.initRetryCount = 0;
      this.powershellAvailability.isAvailable = null;
      this.powershellAvailability.lastCheck = null;

      console.log('PowerShellExecutor: Cleanup completed');

    } catch (error) {
      this.errorHandler.error(error, 'PowerShellExecutor.cleanup');
    }
  }
}

module.exports = PowerShellExecutor;
