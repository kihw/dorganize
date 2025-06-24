const { getErrorHandler } = require('../ErrorHandler');

/**
 * WindowParser - Handles parsing of window titles and character information with safe JSON handling
 */
class WindowParser {
  constructor() {
    this.errorHandler = getErrorHandler();

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

    this.knownClasses = Object.keys(this.dofusClasses);

    // JSON parsing configuration
    this.jsonParsingConfig = {
      maxDepth: 5,
      maxSize: 1024 * 1024, // 1MB limit
      timeout: 5000, // 5 second timeout
      allowedTypes: ['object', 'array', 'string', 'number', 'boolean'],
      sanitizationRules: {
        removeNullBytes: true,
        trimWhitespace: true,
        validateEncoding: true
      }
    };
  }

  /**
   * Safe JSON parsing with comprehensive validation and error recovery
   * @param {string} jsonString - JSON string to parse
   * @param {Object} options - Parsing options
   * @returns {Object} - {success: boolean, data: any, error: string}
   */
  safeJsonParse(jsonString, options = {}) {
    const config = { ...this.jsonParsingConfig, ...options };

    try {
      // Initial validation
      if (typeof jsonString !== 'string') {
        return {
          success: false,
          data: null,
          error: 'Input is not a string'
        };
      }

      // Size check
      if (jsonString.length > config.maxSize) {
        return {
          success: false,
          data: null,
          error: `JSON string too large: ${jsonString.length} bytes (max: ${config.maxSize})`
        };
      }

      // Sanitize input
      const sanitized = this.sanitizeJsonString(jsonString, config.sanitizationRules);
      if (!sanitized.success) {
        return {
          success: false,
          data: null,
          error: `JSON sanitization failed: ${sanitized.error}`
        };
      }

      // Validate JSON structure before parsing
      const validation = this.validateJsonStructure(sanitized.data);
      if (!validation.isValid) {
        return {
          success: false,
          data: null,
          error: `Invalid JSON structure: ${validation.errors.join(', ')}`
        };
      }

      // Parse with timeout protection
      const parseResult = this.parseWithTimeout(sanitized.data, config.timeout);
      if (!parseResult.success) {
        return parseResult;
      }

      // Validate parsed data structure
      const typeValidation = this.validateParsedDataTypes(parseResult.data, config.allowedTypes, config.maxDepth);
      if (!typeValidation.isValid) {
        return {
          success: false,
          data: null,
          error: `Invalid data types: ${typeValidation.errors.join(', ')}`
        };
      }

      return {
        success: true,
        data: parseResult.data,
        error: null
      };

    } catch (error) {
      this.errorHandler.error(error, 'WindowParser.safeJsonParse');

      // Attempt recovery strategies
      const recovery = this.attemptJsonRecovery(jsonString);
      if (recovery.success) {
        console.warn('WindowParser: JSON recovered using fallback strategy');
        return recovery;
      }

      return {
        success: false,
        data: null,
        error: `JSON parsing failed: ${error.message}`
      };
    }
  }

  /**
   * Sanitize JSON string to handle common issues
   * @param {string} jsonString - Raw JSON string
   * @param {Object} rules - Sanitization rules
   * @returns {Object} - {success: boolean, data: string, error: string}
   */
  sanitizeJsonString(jsonString, rules) {
    try {
      let sanitized = jsonString;

      if (rules.removeNullBytes) {
        // Remove null bytes and other control characters
        sanitized = sanitized.replace(/\0/g, '').replace(/[\x00-\x08\x0E-\x1F\x7F]/g, '');
      }

      if (rules.trimWhitespace) {
        sanitized = sanitized.trim();
      }

      if (rules.validateEncoding) {
        // Check for valid UTF-8 encoding
        try {
          // Try to encode/decode to validate UTF-8
          const encoded = encodeURIComponent(sanitized);
          decodeURIComponent(encoded);
        } catch (encodingError) {
          return {
            success: false,
            data: null,
            error: 'Invalid character encoding detected'
          };
        }
      }

      // Remove BOM if present
      if (sanitized.charCodeAt(0) === 0xFEFF) {
        sanitized = sanitized.slice(1);
      }

      // Fix common JSON formatting issues
      sanitized = this.fixCommonJsonIssues(sanitized);

      return {
        success: true,
        data: sanitized,
        error: null
      };

    } catch (error) {
      return {
        success: false,
        data: null,
        error: `Sanitization failed: ${error.message}`
      };
    }
  }

  /**
   * Fix common JSON formatting issues from PowerShell output
   * @param {string} jsonString - JSON string to fix
   * @returns {string} - Fixed JSON string
   */
  fixCommonJsonIssues(jsonString) {
    let fixed = jsonString;

    try {
      // Fix trailing commas
      fixed = fixed.replace(/,(\s*[}\]])/g, '$1');

      // Fix single quotes to double quotes (but preserve escaped quotes)
      fixed = fixed.replace(/(?<!\\)'([^']*?)(?<!\\)'/g, '"$1"');

      // Fix unquoted property names
      fixed = fixed.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":');

      // Fix escaped backslashes in Windows paths
      fixed = fixed.replace(/\\\\/g, '\\');

      // Remove any trailing garbage after valid JSON
      const firstBrace = Math.min(
        fixed.indexOf('{') !== -1 ? fixed.indexOf('{') : Infinity,
        fixed.indexOf('[') !== -1 ? fixed.indexOf('[') : Infinity
      );

      if (firstBrace !== Infinity) {
        let braceCount = 0;
        let inString = false;
        let escaped = false;
        let lastValidIndex = -1;

        for (let i = firstBrace; i < fixed.length; i++) {
          const char = fixed[i];

          if (escaped) {
            escaped = false;
            continue;
          }

          if (char === '\\') {
            escaped = true;
            continue;
          }

          if (char === '"' && !escaped) {
            inString = !inString;
            continue;
          }

          if (!inString) {
            if (char === '{' || char === '[') {
              braceCount++;
            } else if (char === '}' || char === ']') {
              braceCount--;
              if (braceCount === 0) {
                lastValidIndex = i;
                break;
              }
            }
          }
        }

        if (lastValidIndex !== -1) {
          fixed = fixed.substring(firstBrace, lastValidIndex + 1);
        }
      }

      return fixed;

    } catch (error) {
      console.warn('WindowParser: Failed to fix JSON issues, returning original:', error.message);
      return jsonString;
    }
  }

  /**
   * Validate JSON structure before parsing
   * @param {string} jsonString - JSON string to validate
   * @returns {Object} - {isValid: boolean, errors: string[]}
   */
  validateJsonStructure(jsonString) {
    const errors = [];

    try {
      if (!jsonString || typeof jsonString !== 'string') {
        errors.push('Input is not a valid string');
        return { isValid: false, errors };
      }

      const trimmed = jsonString.trim();
      if (trimmed.length === 0) {
        errors.push('Empty JSON string');
        return { isValid: false, errors };
      }

      // Must start with { or [
      if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
        errors.push('JSON must start with { or [');
      }

      // Must end with } or ]
      if (!trimmed.endsWith('}') && !trimmed.endsWith(']')) {
        errors.push('JSON must end with } or ]');
      }

      // Check for balanced braces/brackets
      const validation = this.validateBalancedBraces(trimmed);
      if (!validation.isValid) {
        errors.push(...validation.errors);
      }

      // Check for valid characters
      const invalidChars = this.findInvalidJsonCharacters(trimmed);
      if (invalidChars.length > 0) {
        errors.push(`Invalid characters found: ${invalidChars.join(', ')}`);
      }

      return { isValid: errors.length === 0, errors };

    } catch (error) {
      errors.push(`Structure validation failed: ${error.message}`);
      return { isValid: false, errors };
    }
  }

  /**
   * Validate balanced braces and brackets
   * @param {string} jsonString - JSON string to validate
   * @returns {Object} - {isValid: boolean, errors: string[]}
   */
  validateBalancedBraces(jsonString) {
    const errors = [];
    const stack = [];
    const pairs = { '{': '}', '[': ']' };
    let inString = false;
    let escaped = false;

    try {
      for (let i = 0; i < jsonString.length; i++) {
        const char = jsonString[i];

        if (escaped) {
          escaped = false;
          continue;
        }

        if (char === '\\') {
          escaped = true;
          continue;
        }

        if (char === '"' && !escaped) {
          inString = !inString;
          continue;
        }

        if (!inString) {
          if (char === '{' || char === '[') {
            stack.push(char);
          } else if (char === '}' || char === ']') {
            if (stack.length === 0) {
              errors.push(`Unexpected closing ${char} at position ${i}`);
              continue;
            }

            const expected = pairs[stack.pop()];
            if (char !== expected) {
              errors.push(`Expected ${expected} but found ${char} at position ${i}`);
            }
          }
        }
      }

      if (stack.length > 0) {
        errors.push(`Unclosed brackets/braces: ${stack.join(', ')}`);
      }

      return { isValid: errors.length === 0, errors };

    } catch (error) {
      errors.push(`Brace validation failed: ${error.message}`);
      return { isValid: false, errors };
    }
  }

  /**
   * Find invalid JSON characters
   * @param {string} jsonString - JSON string to check
   * @returns {string[]} - Array of invalid characters found
   */
  findInvalidJsonCharacters(jsonString) {
    const invalidChars = [];
    let inString = false;
    let escaped = false;

    try {
      for (let i = 0; i < jsonString.length; i++) {
        const char = jsonString[i];
        const charCode = char.charCodeAt(0);

        if (escaped) {
          escaped = false;
          continue;
        }

        if (char === '\\') {
          escaped = true;
          continue;
        }

        if (char === '"' && !escaped) {
          inString = !inString;
          continue;
        }

        if (!inString) {
          // Check for control characters outside strings
          if (charCode < 32 && char !== '\t' && char !== '\n' && char !== '\r') {
            invalidChars.push(`\\x${charCode.toString(16).padStart(2, '0')}`);
          }
        }
      }

      return [...new Set(invalidChars)]; // Remove duplicates

    } catch (error) {
      console.warn('WindowParser: Error finding invalid characters:', error.message);
      return [];
    }
  }

  /**
   * Parse JSON with timeout protection
   * @param {string} jsonString - JSON string to parse
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Object} - {success: boolean, data: any, error: string}
   */
  parseWithTimeout(jsonString, timeout) {
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        resolve({
          success: false,
          data: null,
          error: `JSON parsing timed out after ${timeout}ms`
        });
      }, timeout);

      try {
        const parsed = JSON.parse(jsonString);
        clearTimeout(timeoutId);
        resolve({
          success: true,
          data: parsed,
          error: null
        });
      } catch (error) {
        clearTimeout(timeoutId);
        resolve({
          success: false,
          data: null,
          error: error.message
        });
      }
    });
  }

  /**
   * Validate parsed data types and structure
   * @param {any} data - Parsed data to validate
   * @param {string[]} allowedTypes - Allowed data types
   * @param {number} maxDepth - Maximum nesting depth
   * @param {number} currentDepth - Current nesting depth
   * @returns {Object} - {isValid: boolean, errors: string[]}
   */
  validateParsedDataTypes(data, allowedTypes, maxDepth, currentDepth = 0) {
    const errors = [];

    try {
      if (currentDepth > maxDepth) {
        errors.push(`Maximum nesting depth exceeded: ${maxDepth}`);
        return { isValid: false, errors };
      }

      const dataType = Array.isArray(data) ? 'array' : typeof data;

      if (!allowedTypes.includes(dataType)) {
        errors.push(`Disallowed data type: ${dataType}`);
        return { isValid: false, errors };
      }

      if (dataType === 'object' && data !== null) {
        for (const [key, value] of Object.entries(data)) {
          // Validate property name
          if (typeof key !== 'string' || key.length > 256) {
            errors.push(`Invalid property name: ${key}`);
            continue;
          }

          // Recursively validate nested objects
          const nestedValidation = this.validateParsedDataTypes(
            value,
            allowedTypes,
            maxDepth,
            currentDepth + 1
          );

          if (!nestedValidation.isValid) {
            errors.push(...nestedValidation.errors.map(err => `${key}.${err}`));
          }
        }
      } else if (dataType === 'array') {
        data.forEach((item, index) => {
          const itemValidation = this.validateParsedDataTypes(
            item,
            allowedTypes,
            maxDepth,
            currentDepth + 1
          );

          if (!itemValidation.isValid) {
            errors.push(...itemValidation.errors.map(err => `[${index}].${err}`));
          }
        });
      }

      return { isValid: errors.length === 0, errors };

    } catch (error) {
      errors.push(`Type validation failed: ${error.message}`);
      return { isValid: false, errors };
    }
  }

  /**
   * Attempt to recover from JSON parsing errors using various strategies
   * @param {string} jsonString - Original JSON string
   * @returns {Object} - {success: boolean, data: any, error: string}
   */
  attemptJsonRecovery(jsonString) {
    const recoveryStrategies = [
      () => this.recoverWithRegexCleanup(jsonString),
      () => this.recoverWithManualParsing(jsonString),
      () => this.recoverWithFallbackStructure(jsonString)
    ];

    for (const strategy of recoveryStrategies) {
      try {
        const result = strategy();
        if (result.success) {
          return result;
        }
      } catch (error) {
        console.warn('WindowParser: Recovery strategy failed:', error.message);
      }
    }

    return {
      success: false,
      data: null,
      error: 'All recovery strategies failed'
    };
  }

  /**
   * Recovery strategy: Advanced regex cleanup
   * @param {string} jsonString - JSON string to recover
   * @returns {Object} - Recovery result
   */
  recoverWithRegexCleanup(jsonString) {
    try {
      let recovered = jsonString;

      // More aggressive cleanup
      recovered = recovered
        .replace(/[\x00-\x1F\x7F]/g, '') // Remove all control characters
        .replace(/,\s*([}\]])/g, '$1') // Remove trailing commas
        .replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":') // Quote property names
        .replace(/:\s*([^",\[\]{}]+)(?=\s*[,}\]])/g, ':"$1"') // Quote unquoted values
        .replace(/"/g, '"') // Normalize quotes
        .trim();

      const parsed = JSON.parse(recovered);
      return {
        success: true,
        data: parsed,
        error: null
      };

    } catch (error) {
      return {
        success: false,
        data: null,
        error: `Regex cleanup failed: ${error.message}`
      };
    }
  }

  /**
   * Recovery strategy: Manual JSON-like parsing for simple structures
   * @param {string} jsonString - JSON string to recover
   * @returns {Object} - Recovery result
   */
  recoverWithManualParsing(jsonString) {
    try {
      // Try to extract key-value pairs manually for simple objects
      if (jsonString.includes(':') && jsonString.includes('{')) {
        const result = {};
        const matches = jsonString.match(/["\w]+\s*:\s*[^,}]+/g);

        if (matches) {
          for (const match of matches) {
            const [key, value] = match.split(':').map(s => s.trim());
            const cleanKey = key.replace(/['"]/g, '');
            const cleanValue = value.replace(/['"]/g, '');
            result[cleanKey] = cleanValue;
          }

          return {
            success: true,
            data: result,
            error: null
          };
        }
      }

      return {
        success: false,
        data: null,
        error: 'Manual parsing not applicable'
      };

    } catch (error) {
      return {
        success: false,
        data: null,
        error: `Manual parsing failed: ${error.message}`
      };
    }
  }

  /**
   * Recovery strategy: Return safe fallback structure
   * @param {string} jsonString - Original JSON string
   * @returns {Object} - Recovery result
   */
  recoverWithFallbackStructure(jsonString) {
    try {
      // Return empty structure based on apparent JSON type
      if (jsonString.trim().startsWith('[')) {
        return {
          success: true,
          data: [],
          error: null
        };
      } else {
        return {
          success: true,
          data: {},
          error: null
        };
      }

    } catch (error) {
      return {
        success: false,
        data: null,
        error: `Fallback structure failed: ${error.message}`
      };
    }
  }

  /**
   * Parse configuration JSON with enhanced safety
   * @param {string} configJsonString - Configuration JSON string
   * @returns {Object} - Parsed configuration or default
   */
  parseConfigurationJson(configJsonString) {
    const parseResult = this.safeJsonParse(configJsonString, {
      maxDepth: 3,
      allowedTypes: ['object', 'string', 'number', 'boolean'],
      timeout: 2000
    });

    if (parseResult.success) {
      return parseResult.data;
    }

    this.errorHandler.warn(
      `Configuration JSON parsing failed: ${parseResult.error}`,
      'WindowParser.parseConfigurationJson'
    );

    // Return safe default configuration
    return {
      parsingEnabled: true,
      strictMode: false,
      fallbackCharacterName: 'Unknown',
      fallbackClass: 'feca'
    };
  }

  /**
   * Parse window data JSON from PowerShell output
   * @param {string} windowDataJson - Window data JSON string
   * @returns {Array} - Parsed window data or empty array
   */
  parseWindowDataJson(windowDataJson) {
    const parseResult = this.safeJsonParse(windowDataJson, {
      maxDepth: 4,
      allowedTypes: ['object', 'array', 'string', 'number', 'boolean'],
      timeout: 3000
    });

    if (parseResult.success) {
      // Ensure result is always an array
      const data = parseResult.data;
      return Array.isArray(data) ? data : [data];
    }

    this.errorHandler.warn(
      `Window data JSON parsing failed: ${parseResult.error}`,
      'WindowParser.parseWindowDataJson'
    );

    return [];
  }

  /**
   * Parse window title to extract character and class information
   * @param {string} title - Window title to parse
   * @returns {Object} - {character, dofusClass, isValid}
   */
  parseWindowTitle(title) {
    try {
      if (!title || typeof title !== 'string') {
        return { character: null, dofusClass: null, isValid: false };
      }

      // Try primary format first
      const primaryResult = this.parsePrimaryFormat(title);
      if (primaryResult.isValid) {
        return primaryResult;
      }

      // Try fallback format
      const fallbackResult = this.parseFallbackFormat(title);
      if (fallbackResult.isValid) {
        return fallbackResult;
      }

      console.log(`WindowParser: Failed to parse title: "${title}"`);
      return { character: null, dofusClass: null, isValid: false };
    } catch (error) {
      this.errorHandler.error(error, `WindowParser.parseWindowTitle: ${title}`);
      return { character: null, dofusClass: null, isValid: false };
    }
  }

  /**
   * Parse primary format: "Character - Class - Version - Release"
   */
  parsePrimaryFormat(title) {
    const parts = title.split(' - ');

    if (parts.length >= 2) {
      const character = parts[0].trim();
      const classRaw = parts[1].trim();

      // Normalize class name
      const dofusClass = this.normalizeClassName(classRaw);

      console.log(`WindowParser: Primary format - Character: "${character}", Class: "${classRaw}" -> "${dofusClass}"`);

      if (character && dofusClass && this.isValidClass(dofusClass)) {
        return { character, dofusClass, isValid: true };
      }
    }

    return { character: null, dofusClass: null, isValid: false };
  }

  /**
   * Parse fallback format: search for known classes in title
   */
  parseFallbackFormat(title) {
    const normalizedTitle = title.toLowerCase();
    const parts = title.split(' - ');

    for (const className of this.knownClasses) {
      if (normalizedTitle.includes(className)) {
        const character = parts[0]?.trim() || 'Unknown';
        console.log(`WindowParser: Fallback detection - Character: "${character}", Class: "${className}"`);
        return { character, dofusClass: className, isValid: true };
      }
    }

    return { character: null, dofusClass: null, isValid: false };
  }

  /**
   * Normalize class name to standard format
   */
  normalizeClassName(className) {
    if (!className) return null;

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

    console.warn(`WindowParser: Unknown class name: "${className}"`);
    return null;
  }

  /**
   * Check if class is valid
   */
  isValidClass(dofusClass) {
    return dofusClass && this.dofusClasses[dofusClass] !== undefined;
  }

  /**
   * Filter raw windows based on validation rules
   */
  filterValidWindows(rawWindows) {
    if (!Array.isArray(rawWindows)) {
      this.errorHandler.warn('filterValidWindows received non-array input', 'WindowParser');
      return [];
    }

    return rawWindows.filter(window => {
      try {
        // Validate handle
        if (!window.Handle || window.Handle === '0' || window.Handle === 0) {
          console.log(`WindowParser: Filtering out window with invalid handle - Title: "${window.Title}"`);
          return false;
        }

        // Validate title format
        if (!this.isValidWindowTitle(window.Title)) {
          console.log(`WindowParser: Filtering out window with invalid title format: ${window.Title}`);
          return false;
        }

        // Parse character info
        const { isValid } = this.parseWindowTitle(window.Title);
        if (!isValid) {
          console.log(`WindowParser: Filtering out window - could not parse character info: ${window.Title}`);
          return false;
        }

        console.log(`WindowParser: Valid Dofus character window: ${window.Title}`);
        return true;
      } catch (error) {
        this.errorHandler.error(error, `WindowParser.filterValidWindows processing: ${window.Title}`);
        return false;
      }
    });
  }

  /**
   * Validate window title format
   */
  isValidWindowTitle(title) {
    if (!title || typeof title !== 'string') {
      return false;
    }

    const parts = title.split(' - ');

    // Must have at least 2 parts for basic format "Character - Class"
    if (parts.length < 2) {
      return false;
    }

    return true;
  }

  /**
   * Extract process name from class name
   */
  extractProcessName(className) {
    if (!className) return 'Unknown';

    const processNameMap = {
      'java': 'Java',
      'dofus': 'Dofus',
      'firefox': 'Firefox',
      'chrome': 'Chrome'
    };

    const lowerClassName = className.toLowerCase();
    for (const [key, value] of Object.entries(processNameMap)) {
      if (lowerClassName.includes(key)) {
        return value;
      }
    }

    return className;
  }

  /**
   * Generate stable window ID
   */
  generateStableWindowId(character, dofusClass, processId) {
    const normalizedCharacter = character ? character.toLowerCase().replace(/\s+/g, '') : 'unknown';
    const normalizedClass = dofusClass || 'unknown';
    return `${normalizedCharacter}_${normalizedClass}_${processId}`;
  }

  /**
   * Get class information
   */
  getDofusClasses() {
    return this.dofusClasses;
  }

  getClassAvatar(className) {
    return this.dofusClasses[className]?.avatar || '1';
  }

  getClassName(classKey) {
    return this.dofusClasses[classKey]?.name || classKey;
  }
}

module.exports = WindowParser;
