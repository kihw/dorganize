const { getErrorHandler } = require('../ErrorHandler');

/**
 * WindowParser - Handles parsing of window titles and character information
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
  }

  /**
   * Parse window title to extract character and class information
   * @param {string} title - Window title to parse
   * @returns {Object} - {character, dofusClass, isValid}
   */
  parseWindowTitle(title) {
    if (!title || typeof title !== 'string') {
      return { character: null, dofusClass: null, isValid: false };
    }

    console.log(`WindowParser: Parsing title: "${title}"`);

    try {
      // Primary parsing: "Nom - Classe - Version - Release" format
      const primaryResult = this.parsePrimaryFormat(title);
      if (primaryResult.isValid) {
        return primaryResult;
      }

      // Fallback parsing: search for known classes in title
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
    
    // Must have at least 4 parts for "Character - Class - Version - Release"
    if (parts.length < 4) {
      return false;
    }

    // Last part should be "Release"
    if (parts[parts.length - 1].trim() !== 'Release') {
      return false;
    }

    return true;
  }

  /**
   * Extract process name from class name
   */
  extractProcessName(className) {
    if (!className) return 'Dofus';

    if (className.includes('Unity')) return 'Dofus 3 (Unity)';
    if (className.includes('Java') || className.includes('SunAwt')) return 'Dofus 2 (Java)';
    if (className.includes('Retro')) return 'Dofus Retro';

    return 'Dofus';
  }

  /**
   * Generate stable window ID
   */
  generateStableWindowId(character, dofusClass, processId) {
    if (!character || !dofusClass) {
      console.warn(`WindowParser: Cannot generate stable ID - missing character (${character}) or class (${dofusClass})`);
      return null;
    }

    const cleanCharacter = character.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanClass = dofusClass.toLowerCase().replace(/[^a-z0-9]/g, '');
    return `${cleanCharacter}_${cleanClass}_${processId}`;
  }

  /**
   * Get class information
   */
  getDofusClasses() {
    return this.dofusClasses;
  }

  getClassAvatar(className) {
    const classKey = className?.toLowerCase();
    return this.dofusClasses[classKey]?.avatar || '1';
  }

  getClassName(classKey) {
    return this.dofusClasses[classKey]?.name || 'Feca';
  }
}

module.exports = WindowParser;
