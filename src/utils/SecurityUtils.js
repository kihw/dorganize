/**
 * SecurityUtils - Input sanitization and validation utilities
 * Provides security functions to prevent injection attacks and validate inputs
 */

const path = require('path');
const { getErrorHandler } = require('../services/ErrorHandler');

class SecurityUtils {
  constructor() {
    this.errorHandler = getErrorHandler();
    
    // Common malicious patterns
    this.maliciousPatterns = [
      // PowerShell injection patterns
      /[;&|`$(){}[\]]/g,
      /powershell|pwsh|cmd|exec|eval|invoke/gi,
      /\$\{.*\}/g,
      /\$\(.*\)/g,
      
      // Script injection patterns
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      
      // Path traversal patterns
      /\.\.[\/\\]/g,
      /[\/\\]\.\.$/g,
      
      // Command injection patterns
      /[;&|><]/g,
      /\|\s*\w+/g,
      
      // SQL injection patterns (basic)
      /['";]/g,
      /(union|select|insert|delete|update|drop|exec|execute)\s/gi
    ];

    // Allowed characters for different input types
    this.allowedPatterns = {
      windowTitle: /^[a-zA-Z0-9\s\-_.()[\]à-ÿÀ-Ÿ]+$/,
      characterName: /^[a-zA-Z0-9\-_À-ÿ]{1,50}$/,
      shortcut: /^[a-zA-Z0-9+\-_\s()]+$/,
      filePath: /^[a-zA-Z0-9\s\-_.()[\]\\\/À-ÿ:]+$/,
      className: /^[a-zA-Z][a-zA-Z0-9_]*$/,
      processName: /^[a-zA-Z0-9\s\-_.()]+$/
    };

    // Maximum input lengths
    this.maxLengths = {
      windowTitle: 200,
      characterName: 50,
      shortcut: 30,
      filePath: 500,
      className: 100,
      processName: 100,
      command: 1000,
      logMessage: 5000
    };

    this.initializeSecurity();
  }

  /**
   * Initialize security settings
   */
  initializeSecurity() {
    // Log security initialization
    this.errorHandler.info('SecurityUtils initialized', 'Security');
  }

  /**
   * Sanitize input string by removing potentially dangerous characters
   * @param {string} input - Input string to sanitize
   * @param {string} type - Type of input for specific sanitization rules
   * @returns {string} - Sanitized string
   */
  sanitizeInput(input, type = 'general') {
    if (!input || typeof input !== 'string') {
      return '';
    }

    try {
      let sanitized = input.trim();

      // Apply length limits
      if (this.maxLengths[type]) {
        sanitized = sanitized.substring(0, this.maxLengths[type]);
      }

      // Remove null bytes and control characters
      sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');

      // Type-specific sanitization
      switch (type) {
        case 'windowTitle':
          sanitized = this.sanitizeWindowTitle(sanitized);
          break;
        case 'characterName':
          sanitized = this.sanitizeCharacterName(sanitized);
          break;
        case 'shortcut':
          sanitized = this.sanitizeShortcut(sanitized);
          break;
        case 'filePath':
          sanitized = this.sanitizeFilePath(sanitized);
          break;
        case 'command':
          sanitized = this.sanitizeCommand(sanitized);
          break;
        case 'processName':
          sanitized = this.sanitizeProcessName(sanitized);
          break;
        default:
          sanitized = this.sanitizeGeneral(sanitized);
      }

      // Final safety check
      if (this.containsMaliciousPatterns(sanitized)) {
        this.errorHandler.warn(`Potentially malicious input detected and sanitized: ${input.substring(0, 50)}...`, 'Security');
        return this.stripMaliciousPatterns(sanitized);
      }

      return sanitized;

    } catch (error) {
      this.errorHandler.error(error, 'SecurityUtils.sanitizeInput');
      return '';
    }
  }

  /**
   * Validate input against security rules
   * @param {string} input - Input to validate
   * @param {string} type - Type of input
   * @returns {Object} - Validation result with isValid boolean and errors array
   */
  validateInput(input, type = 'general') {
    const result = {
      isValid: true,
      errors: [],
      sanitized: input
    };

    try {
      if (!input || typeof input !== 'string') {
        result.isValid = false;
        result.errors.push('Input must be a non-empty string');
        return result;
      }

      // Length validation
      if (this.maxLengths[type] && input.length > this.maxLengths[type]) {
        result.isValid = false;
        result.errors.push(`Input exceeds maximum length of ${this.maxLengths[type]} characters`);
      }

      // Pattern validation
      if (this.allowedPatterns[type] && !this.allowedPatterns[type].test(input)) {
        result.isValid = false;
        result.errors.push(`Input contains invalid characters for type: ${type}`);
      }

      // Malicious pattern detection
      if (this.containsMaliciousPatterns(input)) {
        result.isValid = false;
        result.errors.push('Input contains potentially malicious patterns');
        this.errorHandler.warn(`Malicious pattern detected in ${type}: ${input.substring(0, 50)}...`, 'Security');
      }

      // Sanitize the input
      result.sanitized = this.sanitizeInput(input, type);

      return result;

    } catch (error) {
      this.errorHandler.error(error, 'SecurityUtils.validateInput');
      result.isValid = false;
      result.errors.push('Validation error occurred');
      return result;
    }
  }

  /**
   * Sanitize window title
   */
  sanitizeWindowTitle(input) {
    // Allow normal window title characters including Unicode
    return input.replace(/[<>&"'`${}[\]]/g, '');
  }

  /**
   * Sanitize character name
   */
  sanitizeCharacterName(input) {
    // Only allow alphanumeric, hyphens, underscores, and Unicode letters
    return input.replace(/[^a-zA-Z0-9\-_À-ÿ]/g, '');
  }

  /**
   * Sanitize keyboard shortcut
   */
  sanitizeShortcut(input) {
    // Allow common shortcut patterns: Ctrl+Alt+F1, etc.
    return input.replace(/[^a-zA-Z0-9+\-\s()]/g, '');
  }

  /**
   * Sanitize file path
   */
  sanitizeFilePath(input) {
    try {
      // Normalize the path to prevent traversal
      const normalized = path.normalize(input);
      
      // Remove any remaining dangerous patterns
      return normalized.replace(/[<>&"'`${}[\]]/g, '');
    } catch (error) {
      this.errorHandler.warn(`File path sanitization failed: ${error.message}`, 'Security');
      return '';
    }
  }

  /**
   * Sanitize PowerShell command (very restrictive)
   */
  sanitizeCommand(input) {
    // For PowerShell commands, be very restrictive
    // Only allow basic alphanumeric and safe special characters
    return input.replace(/[;&|`$(){}[\]<>'"]/g, '');
  }

  /**
   * Sanitize process name
   */
  sanitizeProcessName(input) {
    // Allow basic process name characters
    return input.replace(/[^a-zA-Z0-9\s\-_.()]/g, '');
  }

  /**
   * General sanitization for unknown input types
   */
  sanitizeGeneral(input) {
    // Remove most special characters that could be dangerous
    return input.replace(/[<>&"'`${}[\];|]/g, '');
  }

  /**
   * Check if input contains malicious patterns
   */
  containsMaliciousPatterns(input) {
    if (!input || typeof input !== 'string') {
      return false;
    }

    const lowerInput = input.toLowerCase();

    // Check against known malicious patterns
    for (const pattern of this.maliciousPatterns) {
      if (pattern.test(input) || pattern.test(lowerInput)) {
        return true;
      }
    }

    // Additional checks for specific attack patterns
    if (this.containsScriptInjection(input) ||
        this.containsCommandInjection(input) ||
        this.containsPathTraversal(input)) {
      return true;
    }

    return false;
  }

  /**
   * Strip malicious patterns from input
   */
  stripMaliciousPatterns(input) {
    let cleaned = input;

    // Remove malicious patterns
    for (const pattern of this.maliciousPatterns) {
      cleaned = cleaned.replace(pattern, '');
    }

    return cleaned.trim();
  }

  /**
   * Check for script injection attempts
   */
  containsScriptInjection(input) {
    const scriptPatterns = [
      /<script/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /eval\s*\(/gi,
      /function\s*\(/gi
    ];

    return scriptPatterns.some(pattern => pattern.test(input));
  }

  /**
   * Check for command injection attempts
   */
  containsCommandInjection(input) {
    const commandPatterns = [
      /[;&|]+/g,
      /\$\([^)]*\)/g,
      /`[^`]*`/g,
      /(^|\s)(rm|del|format|shutdown|reboot)\s/gi,
      /\|\s*(curl|wget|nc|netcat)/gi
    ];

    return commandPatterns.some(pattern => pattern.test(input));
  }

  /**
   * Check for path traversal attempts
   */
  containsPathTraversal(input) {
    const pathPatterns = [
      /\.\.[\/\\]/g,
      /[\/\\]\.\.$/g,
      /\.\.$/g,
      /^\.\.$/g
    ];

    return pathPatterns.some(pattern => pattern.test(input));
  }

  /**
   * Escape string for safe use in PowerShell commands
   * @param {string} input - String to escape
   * @returns {string} - Escaped string
   */
  escapeForPowerShell(input) {
    if (!input || typeof input !== 'string') {
      return '';
    }

    try {
      // First sanitize the input
      const sanitized = this.sanitizeInput(input, 'command');
      
      // Escape special PowerShell characters
      return sanitized
        .replace(/'/g, "''")  // Escape single quotes
        .replace(/"/g, '""')  // Escape double quotes
        .replace(/`/g, '``')  // Escape backticks
        .replace(/\$/g, '`$') // Escape dollar signs
        .replace(/\[/g, '`[') // Escape brackets
        .replace(/\]/g, '`]');

    } catch (error) {
      this.errorHandler.error(error, 'SecurityUtils.escapeForPowerShell');
      return '';
    }
  }

  /**
   * Validate and sanitize PowerShell arguments
   * @param {Array} args - Array of arguments
   * @returns {Array} - Sanitized arguments
   */
  sanitizePowerShellArgs(args) {
    if (!Array.isArray(args)) {
      return [];
    }

    return args.map(arg => {
      if (typeof arg !== 'string') {
        return String(arg);
      }
      
      // Validate and sanitize each argument
      const validation = this.validateInput(arg, 'command');
      if (!validation.isValid) {
        this.errorHandler.warn(`Invalid PowerShell argument detected: ${arg.substring(0, 50)}...`, 'Security');
        return validation.sanitized || '';
      }
      
      return this.escapeForPowerShell(validation.sanitized);
    }).filter(arg => arg.length > 0);
  }

  /**
   * Validate file path for security
   * @param {string} filePath - File path to validate
   * @param {string} allowedDirectory - Optional allowed base directory
   * @returns {Object} - Validation result
   */
  validateFilePath(filePath, allowedDirectory = null) {
    const result = {
      isValid: true,
      errors: [],
      normalizedPath: ''
    };

    try {
      if (!filePath || typeof filePath !== 'string') {
        result.isValid = false;
        result.errors.push('File path must be a non-empty string');
        return result;
      }

      // Normalize the path
      const normalized = path.normalize(filePath);
      result.normalizedPath = normalized;

      // Check for path traversal
      if (this.containsPathTraversal(normalized)) {
        result.isValid = false;
        result.errors.push('Path contains traversal attempts');
        this.errorHandler.warn(`Path traversal attempt detected: ${filePath}`, 'Security');
      }

      // Check if within allowed directory
      if (allowedDirectory) {
        const normalizedAllowed = path.normalize(allowedDirectory);
        const relative = path.relative(normalizedAllowed, normalized);
        
        if (relative.startsWith('..') || path.isAbsolute(relative)) {
          result.isValid = false;
          result.errors.push('Path is outside allowed directory');
          this.errorHandler.warn(`Path outside allowed directory: ${filePath}`, 'Security');
        }
      }

      // Check for dangerous file extensions
      const ext = path.extname(normalized).toLowerCase();
      const dangerousExtensions = ['.exe', '.bat', '.cmd', '.ps1', '.vbs', '.js', '.jar'];
      if (dangerousExtensions.includes(ext)) {
        result.isValid = false;
        result.errors.push('Dangerous file extension detected');
        this.errorHandler.warn(`Dangerous file extension: ${ext} in path ${filePath}`, 'Security');
      }

      return result;

    } catch (error) {
      this.errorHandler.error(error, 'SecurityUtils.validateFilePath');
      result.isValid = false;
      result.errors.push('Path validation error occurred');
      return result;
    }
  }

  /**
   * Create secure regex pattern from user input
   * @param {string} pattern - User input pattern
   * @returns {RegExp|null} - Safe regex or null if invalid
   */
  createSecureRegex(pattern) {
    try {
      // Sanitize the pattern
      const sanitized = this.sanitizeInput(pattern, 'general');
      
      // Escape special regex characters except those we want to allow
      const escaped = sanitized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      
      // Create regex with case-insensitive flag
      return new RegExp(escaped, 'i');
      
    } catch (error) {
      this.errorHandler.warn(`Invalid regex pattern: ${pattern}`, 'Security');
      return null;
    }
  }

  /**
   * Generate security report
   * @returns {Object} - Security statistics and status
   */
  getSecurityReport() {
    return {
      timestamp: new Date().toISOString(),
      patterns: {
        maliciousPatterns: this.maliciousPatterns.length,
        allowedPatterns: Object.keys(this.allowedPatterns).length,
        maxLengths: Object.keys(this.maxLengths).length
      },
      validation: {
        supportedTypes: Object.keys(this.allowedPatterns),
        securityFeatures: [
          'Input sanitization',
          'Pattern validation',
          'Length limits',
          'PowerShell escaping',
          'Path traversal protection',
          'Command injection prevention',
          'Script injection detection'
        ]
      },
      status: 'Active'
    };
  }

  /**
   * Test security functions (for development/testing)
   * @returns {Object} - Test results
   */
  runSecurityTests() {
    const tests = [
      // Test basic sanitization
      {
        name: 'Basic sanitization',
        input: 'test<script>alert("xss")</script>',
        type: 'general',
        expected: 'testalert("xss")'
      },
      
      // Test PowerShell injection
      {
        name: 'PowerShell injection',
        input: 'test; powershell -c "malicious"',
        type: 'command',
        expected: 'test  -c "malicious"'
      },
      
      // Test path traversal
      {
        name: 'Path traversal',
        input: '../../../etc/passwd',
        type: 'filePath',
        expected: '..etcpasswd'
      },
      
      // Test character name
      {
        name: 'Character name',
        input: 'TestChar123_-',
        type: 'characterName',
        expected: 'TestChar123_-'
      }
    ];

    const results = tests.map(test => {
      try {
        const result = this.sanitizeInput(test.input, test.type);
        return {
          ...test,
          result,
          passed: result === test.expected,
          validation: this.validateInput(test.input, test.type)
        };
      } catch (error) {
        return {
          ...test,
          result: null,
          passed: false,
          error: error.message
        };
      }
    });

    const passedTests = results.filter(r => r.passed).length;
    const totalTests = results.length;

    this.errorHandler.info(`Security tests completed: ${passedTests}/${totalTests} passed`, 'Security');

    return {
      timestamp: new Date().toISOString(),
      totalTests,
      passedTests,
      success: passedTests === totalTests,
      results
    };
  }
}

// Create singleton instance
let securityUtilsInstance = null;

/**
 * Get SecurityUtils singleton instance
 */
function getSecurityUtils() {
  if (!securityUtilsInstance) {
    securityUtilsInstance = new SecurityUtils();
  }
  return securityUtilsInstance;
}

/**
 * Initialize security utilities
 */
function initializeSecurityUtils() {
  return getSecurityUtils();
}

module.exports = {
  SecurityUtils,
  getSecurityUtils,
  initializeSecurityUtils
};
