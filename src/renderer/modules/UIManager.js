const { getErrorHandler } = require('../../services/ErrorHandler');

/**
 * UIManager - Handles DOM manipulation with comprehensive null checking and graceful fallbacks
 */
class UIManager {
  constructor() {
    this.errorHandler = getErrorHandler();
    this.elements = new Map(); // Cache for DOM elements
    this.observers = new Map(); // MutationObservers for dynamic content
    this.isInitialized = false;
    this.retryAttempts = 3;
    this.retryDelay = 500;

    // Configuration for element access
    this.config = {
      timeoutMs: 5000,
      maxRetries: 3,
      retryDelayMs: 100,
      enableCaching: true,
      enableObservers: true,
      strictMode: false, // Set to true for development/testing
      fallbackElements: new Map() // Fallback elements for critical UI
    };

    // Statistics for monitoring
    this.stats = {
      totalAccesses: 0,
      nullAccesses: 0,
      cachedAccesses: 0,
      fallbacksUsed: 0,
      errorsHandled: 0
    };

    // Bind methods to preserve context
    this.handleDOMContentLoaded = this.handleDOMContentLoaded.bind(this);
    this.handleWindowLoad = this.handleWindowLoad.bind(this);
    this.handleWindowUnload = this.handleWindowUnload.bind(this);

    this.initializeEventListeners();
  }

  /**
   * Initialize event listeners for DOM lifecycle
   */
  initializeEventListeners() {
    try {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', this.handleDOMContentLoaded);
      } else if (document.readyState === 'interactive') {
        // DOM is ready but resources may still be loading
        setTimeout(() => this.initialize(), 0);
      } else {
        // Document is fully loaded
        this.initialize();
      }

      window.addEventListener('load', this.handleWindowLoad);
      window.addEventListener('beforeunload', this.handleWindowUnload);

    } catch (error) {
      this.errorHandler.error(error, 'UIManager.initializeEventListeners');
    }
  }

  /**
   * Handle DOMContentLoaded event
   */
  handleDOMContentLoaded() {
    console.log('UIManager: DOM content loaded, initializing...');
    this.initialize();
  }

  /**
   * Handle window load event
   */
  handleWindowLoad() {
    console.log('UIManager: Window fully loaded');
    this.validateCriticalElements();
  }

  /**
   * Handle window unload event
   */
  handleWindowUnload() {
    this.cleanup();
  }

  /**
   * Initialize UIManager with comprehensive validation
   */
  async initialize() {
    if (this.isInitialized) {
      return true;
    }

    try {
      console.log('UIManager: Starting initialization...');

      // Validate DOM is ready
      if (!this.isDOMReady()) {
        console.warn('UIManager: DOM not ready, retrying...');
        setTimeout(() => this.initialize(), this.config.retryDelayMs);
        return false;
      }

      // Cache critical elements
      await this.cacheElements();

      // Setup MutationObservers for dynamic content
      if (this.config.enableObservers) {
        this.setupMutationObservers();
      }

      // Create fallback elements if needed
      this.createFallbackElements();

      this.isInitialized = true;
      console.log('UIManager: Initialization completed successfully');
      return true;

    } catch (error) {
      this.errorHandler.error(error, 'UIManager.initialize');
      this.stats.errorsHandled++;
      return false;
    }
  }

  /**
   * Check if DOM is ready for manipulation
   */
  isDOMReady() {
    try {
      return document &&
        document.body &&
        document.readyState !== 'loading' &&
        typeof document.createElement === 'function' &&
        typeof document.querySelector === 'function';
    } catch (error) {
      return false;
    }
  }

  /**
   * Cache critical DOM elements with comprehensive validation
   */
  async cacheElements() {
    const criticalSelectors = [
      { key: 'body', selector: 'body', required: true },
      { key: 'dockContainer', selector: '.dock-container', required: false },
      { key: 'dockItems', selector: '#dock-items', required: false },
      { key: 'windowsList', selector: '#windows-list', required: false },
      { key: 'settingsPanel', selector: '#settings-panel', required: false },
      { key: 'configModal', selector: '#config-modal', required: false },
      { key: 'refreshButton', selector: '.refresh-button', required: false },
      { key: 'toggleButton', selector: '.toggle-button', required: false },
      { key: 'statusIndicator', selector: '.status-indicator', required: false },
      { key: 'errorDisplay', selector: '.error-display', required: false }
    ];

    for (const elementConfig of criticalSelectors) {
      try {
        const element = await this.findElementSafely(elementConfig.selector, {
          timeout: elementConfig.required ? this.config.timeoutMs : 1000,
          retries: elementConfig.required ? this.config.maxRetries : 1
        });

        if (element) {
          this.elements.set(elementConfig.key, element);
          console.log(`UIManager: Cached element '${elementConfig.key}'`);
        } else if (elementConfig.required) {
          throw new Error(`Required element '${elementConfig.key}' not found: ${elementConfig.selector}`);
        } else {
          console.warn(`UIManager: Optional element '${elementConfig.key}' not found: ${elementConfig.selector}`);
        }

      } catch (error) {
        this.errorHandler.error(error, `UIManager.cacheElements [${elementConfig.key}]`);

        if (elementConfig.required) {
          throw error;
        }
      }
    }
  }

  /**
   * Find element safely with retry logic and timeout
   */
  async findElementSafely(selector, options = {}) {
    const config = {
      timeout: 2000,
      retries: 2,
      retryDelay: 100,
      ...options
    };

    for (let attempt = 0; attempt <= config.retries; attempt++) {
      try {
        // Validate selector
        if (!this.isValidSelector(selector)) {
          throw new Error(`Invalid selector: ${selector}`);
        }

        // Try to find element with timeout
        const element = await this.queryElementWithTimeout(selector, config.timeout);

        if (element) {
          return element;
        }

        if (attempt < config.retries) {
          console.log(`UIManager: Element '${selector}' not found, retrying (${attempt + 1}/${config.retries})...`);
          await new Promise(resolve => setTimeout(resolve, config.retryDelay));
        }

      } catch (error) {
        console.warn(`UIManager: Error finding element '${selector}' (attempt ${attempt + 1}):`, error.message);

        if (attempt === config.retries) {
          throw error;
        }
      }
    }

    return null;
  }

  /**
   * Query element with timeout protection
   */
  async queryElementWithTimeout(selector, timeoutMs) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        resolve(null); // Return null instead of rejecting for timeout
      }, timeoutMs);

      try {
        // Immediate check
        const element = this.queryElementSafely(selector);
        if (element) {
          clearTimeout(timeoutId);
          resolve(element);
          return;
        }

        // If not found immediately, use MutationObserver to wait for it
        const observer = new MutationObserver((mutations) => {
          const element = this.queryElementSafely(selector);
          if (element) {
            clearTimeout(timeoutId);
            observer.disconnect();
            resolve(element);
          }
        });

        observer.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: false
        });

      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  /**
   * Query element with comprehensive null checking
   */
  queryElementSafely(selector) {
    try {
      if (!selector || typeof selector !== 'string') {
        throw new Error('Invalid selector provided');
      }

      if (!document || typeof document.querySelector !== 'function') {
        throw new Error('Document or querySelector not available');
      }

      const element = document.querySelector(selector);

      // Additional validation for the found element
      if (element && this.isValidElement(element)) {
        return element;
      }

      return null;

    } catch (error) {
      this.errorHandler.warn(`Query failed for selector '${selector}': ${error.message}`, 'UIManager');
      return null;
    }
  }

  /**
   * Validate if selector string is valid
   */
  isValidSelector(selector) {
    try {
      if (!selector || typeof selector !== 'string' || selector.trim().length === 0) {
        return false;
      }

      // Test selector by trying to parse it
      document.createDocumentFragment().querySelector(selector);
      return true;

    } catch (error) {
      return false;
    }
  }

  /**
   * Validate if element is valid and accessible
   */
  isValidElement(element) {
    try {
      return element &&
        element.nodeType === Node.ELEMENT_NODE &&
        typeof element.getAttribute === 'function' &&
        typeof element.classList === 'object' &&
        element.ownerDocument === document;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get element with comprehensive fallback chain
   */
  getElement(keyOrSelector, options = {}) {
    this.stats.totalAccesses++;

    try {
      const config = {
        useCache: this.config.enableCaching,
        createFallback: false,
        required: false,
        fallbackTag: 'div',
        fallbackClass: 'ui-fallback',
        ...options
      };

      let element = null;

      // Try cached element first
      if (config.useCache && this.elements.has(keyOrSelector)) {
        element = this.elements.get(keyOrSelector);
        if (this.isValidElement(element) && document.contains(element)) {
          this.stats.cachedAccesses++;
          return element;
        } else {
          // Remove invalid cached element
          this.elements.delete(keyOrSelector);
          console.warn(`UIManager: Removed invalid cached element: ${keyOrSelector}`);
        }
      }

      // Try to find element by selector
      if (!element) {
        const selector = this.elements.has(keyOrSelector) ? keyOrSelector : keyOrSelector;
        element = this.queryElementSafely(selector);
      }

      // Try fallback element
      if (!element && this.config.fallbackElements.has(keyOrSelector)) {
        element = this.config.fallbackElements.get(keyOrSelector);
        if (this.isValidElement(element)) {
          this.stats.fallbacksUsed++;
          console.log(`UIManager: Using fallback element for: ${keyOrSelector}`);
        } else {
          element = null;
        }
      }

      // Create fallback if requested and element is critical
      if (!element && config.createFallback) {
        element = this.createFallbackElement(keyOrSelector, config);
        if (element) {
          this.stats.fallbacksUsed++;
          console.log(`UIManager: Created fallback element for: ${keyOrSelector}`);
        }
      }

      // Handle null result
      if (!element) {
        this.stats.nullAccesses++;

        if (config.required) {
          throw new Error(`Required element not found: ${keyOrSelector}`);
        }

        if (this.config.strictMode) {
          console.error(`UIManager: Element not found in strict mode: ${keyOrSelector}`);
        }

        return null;
      }

      // Cache valid element if caching is enabled
      if (config.useCache && !this.elements.has(keyOrSelector)) {
        this.elements.set(keyOrSelector, element);
      }

      return element;

    } catch (error) {
      this.stats.errorsHandled++;
      this.errorHandler.error(error, `UIManager.getElement [${keyOrSelector}]`);

      if (options.required) {
        throw error;
      }

      return null;
    }
  }

  /**
   * Set content safely with null checking
   */
  setContent(keyOrSelector, content, options = {}) {
    try {
      const config = {
        method: 'innerHTML', // 'innerHTML', 'textContent', 'innerText'
        clearFirst: false,
        required: false,
        ...options
      };

      const element = this.getElement(keyOrSelector, { required: config.required });

      if (!element) {
        if (config.required) {
          throw new Error(`Cannot set content: element not found: ${keyOrSelector}`);
        }
        return false;
      }

      // Validate content
      if (content === null || content === undefined) {
        content = '';
      }

      // Clear first if requested
      if (config.clearFirst) {
        this.clearElement(element);
      }

      // Set content based on method
      switch (config.method) {
        case 'innerHTML':
          if (typeof content === 'string') {
            element.innerHTML = content;
          } else {
            element.innerHTML = String(content);
          }
          break;

        case 'textContent':
          element.textContent = String(content);
          break;

        case 'innerText':
          element.innerText = String(content);
          break;

        default:
          throw new Error(`Invalid content method: ${config.method}`);
      }

      return true;

    } catch (error) {
      this.stats.errorsHandled++;
      this.errorHandler.error(error, `UIManager.setContent [${keyOrSelector}]`);

      if (options.required) {
        throw error;
      }

      return false;
    }
  }

  /**
   * Add CSS class safely with null checking
   */
  addClass(keyOrSelector, className, options = {}) {
    try {
      const element = this.getElement(keyOrSelector, options);

      if (!element) {
        if (options.required) {
          throw new Error(`Cannot add class: element not found: ${keyOrSelector}`);
        }
        return false;
      }

      if (!className || typeof className !== 'string') {
        throw new Error('Invalid class name provided');
      }

      // Validate classList exists
      if (!element.classList || typeof element.classList.add !== 'function') {
        // Fallback for very old browsers
        const classes = element.className ? element.className.split(' ') : [];
        if (!classes.includes(className)) {
          classes.push(className);
          element.className = classes.join(' ');
        }
      } else {
        element.classList.add(className);
      }

      return true;

    } catch (error) {
      this.stats.errorsHandled++;
      this.errorHandler.error(error, `UIManager.addClass [${keyOrSelector}]`);

      if (options.required) {
        throw error;
      }

      return false;
    }
  }

  /**
   * Remove CSS class safely with null checking
   */
  removeClass(keyOrSelector, className, options = {}) {
    try {
      const element = this.getElement(keyOrSelector, options);

      if (!element) {
        if (options.required) {
          throw new Error(`Cannot remove class: element not found: ${keyOrSelector}`);
        }
        return false;
      }

      if (!className || typeof className !== 'string') {
        throw new Error('Invalid class name provided');
      }

      // Validate classList exists
      if (!element.classList || typeof element.classList.remove !== 'function') {
        // Fallback for very old browsers
        const classes = element.className ? element.className.split(' ') : [];
        const filteredClasses = classes.filter(cls => cls !== className);
        element.className = filteredClasses.join(' ');
      } else {
        element.classList.remove(className);
      }

      return true;

    } catch (error) {
      this.stats.errorsHandled++;
      this.errorHandler.error(error, `UIManager.removeClass [${keyOrSelector}]`);

      if (options.required) {
        throw error;
      }

      return false;
    }
  }

  /**
   * Toggle CSS class safely with null checking
   */
  toggleClass(keyOrSelector, className, force = null, options = {}) {
    try {
      const element = this.getElement(keyOrSelector, options);

      if (!element) {
        if (options.required) {
          throw new Error(`Cannot toggle class: element not found: ${keyOrSelector}`);
        }
        return false;
      }

      if (!className || typeof className !== 'string') {
        throw new Error('Invalid class name provided');
      }

      // Validate classList exists
      if (!element.classList || typeof element.classList.toggle !== 'function') {
        // Fallback for very old browsers
        const hasClass = this.hasClass(keyOrSelector, className);
        if (force === null) {
          if (hasClass) {
            this.removeClass(keyOrSelector, className);
          } else {
            this.addClass(keyOrSelector, className);
          }
        } else if (force && !hasClass) {
          this.addClass(keyOrSelector, className);
        } else if (!force && hasClass) {
          this.removeClass(keyOrSelector, className);
        }
      } else {
        if (force === null) {
          element.classList.toggle(className);
        } else {
          element.classList.toggle(className, force);
        }
      }

      return true;

    } catch (error) {
      this.stats.errorsHandled++;
      this.errorHandler.error(error, `UIManager.toggleClass [${keyOrSelector}]`);

      if (options.required) {
        throw error;
      }

      return false;
    }
  }

  /**
   * Check if element has CSS class safely
   */
  hasClass(keyOrSelector, className, options = {}) {
    try {
      const element = this.getElement(keyOrSelector, options);

      if (!element) {
        return false;
      }

      if (!className || typeof className !== 'string') {
        return false;
      }

      // Validate classList exists
      if (!element.classList || typeof element.classList.contains !== 'function') {
        // Fallback for very old browsers
        const classes = element.className ? element.className.split(' ') : [];
        return classes.includes(className);
      } else {
        return element.classList.contains(className);
      }

    } catch (error) {
      this.stats.errorsHandled++;
      this.errorHandler.error(error, `UIManager.hasClass [${keyOrSelector}]`);
      return false;
    }
  }

  /**
   * Set style property safely with null checking
   */
  setStyle(keyOrSelector, property, value, options = {}) {
    try {
      const element = this.getElement(keyOrSelector, options);

      if (!element) {
        if (options.required) {
          throw new Error(`Cannot set style: element not found: ${keyOrSelector}`);
        }
        return false;
      }

      if (!property || typeof property !== 'string') {
        throw new Error('Invalid style property provided');
      }

      if (!element.style) {
        throw new Error('Element does not support style property');
      }

      // Validate and set style
      if (typeof value === 'string' || typeof value === 'number') {
        element.style[property] = value;
      } else {
        throw new Error(`Invalid style value: ${value}`);
      }

      return true;

    } catch (error) {
      this.stats.errorsHandled++;
      this.errorHandler.error(error, `UIManager.setStyle [${keyOrSelector}]`);

      if (options.required) {
        throw error;
      }

      return false;
    }
  }

  /**
   * Get style property safely with null checking
   */
  getStyle(keyOrSelector, property, options = {}) {
    try {
      const element = this.getElement(keyOrSelector, options);

      if (!element) {
        return null;
      }

      if (!property || typeof property !== 'string') {
        return null;
      }

      if (!element.style) {
        return null;
      }

      // Get computed style for more accurate values
      if (window.getComputedStyle) {
        const computed = window.getComputedStyle(element);
        return computed.getPropertyValue(property);
      } else {
        // Fallback to direct style access
        return element.style[property] || null;
      }

    } catch (error) {
      this.stats.errorsHandled++;
      this.errorHandler.error(error, `UIManager.getStyle [${keyOrSelector}]`);
      return null;
    }
  }

  /**
   * Add event listener safely with null checking
   */
  addEventListener(keyOrSelector, eventType, handler, options = {}) {
    try {
      const config = {
        once: false,
        passive: false,
        capture: false,
        ...options
      };

      const element = this.getElement(keyOrSelector, { required: config.required });

      if (!element) {
        if (config.required) {
          throw new Error(`Cannot add event listener: element not found: ${keyOrSelector}`);
        }
        return false;
      }

      if (!eventType || typeof eventType !== 'string') {
        throw new Error('Invalid event type provided');
      }

      if (!handler || typeof handler !== 'function') {
        throw new Error('Invalid event handler provided');
      }

      // Wrap handler for error protection
      const safeHandler = (event) => {
        try {
          handler(event);
        } catch (error) {
          this.errorHandler.error(error, `UIManager.eventHandler [${eventType}]`);
        }
      };

      // Add event listener with options
      element.addEventListener(eventType, safeHandler, {
        once: config.once,
        passive: config.passive,
        capture: config.capture
      });

      return true;

    } catch (error) {
      this.stats.errorsHandled++;
      this.errorHandler.error(error, `UIManager.addEventListener [${keyOrSelector}]`);

      if (options.required) {
        throw error;
      }

      return false;
    }
  }

  /**
   * Show element safely
   */
  show(keyOrSelector, options = {}) {
    const config = {
      display: 'block',
      transition: false,
      ...options
    };

    return this.setStyle(keyOrSelector, 'display', config.display, options);
  }

  /**
   * Hide element safely
   */
  hide(keyOrSelector, options = {}) {
    return this.setStyle(keyOrSelector, 'display', 'none', options);
  }

  /**
   * Clear element content safely
   */
  clearElement(element) {
    try {
      if (!this.isValidElement(element)) {
        return false;
      }

      // Remove all child nodes safely
      while (element.firstChild) {
        element.removeChild(element.firstChild);
      }

      return true;

    } catch (error) {
      this.errorHandler.error(error, 'UIManager.clearElement');
      return false;
    }
  }

  /**
   * Create fallback element for critical UI components
   */
  createFallbackElement(key, config) {
    try {
      const element = document.createElement(config.fallbackTag || 'div');

      if (config.fallbackClass) {
        element.className = config.fallbackClass;
      }

      element.setAttribute('data-fallback-for', key);
      element.textContent = `Fallback for ${key}`;

      // Try to append to body or suitable parent
      const parent = document.body || document.documentElement;
      if (parent) {
        parent.appendChild(element);
        this.config.fallbackElements.set(key, element);
        return element;
      }

      return null;

    } catch (error) {
      this.errorHandler.error(error, `UIManager.createFallbackElement [${key}]`);
      return null;
    }
  }

  /**
   * Create fallback elements for critical components
   */
  createFallbackElements() {
    const criticalElements = [
      { key: 'errorDisplay', tag: 'div', class: 'error-display fallback' },
      { key: 'statusIndicator', tag: 'div', class: 'status-indicator fallback' }
    ];

    for (const elementConfig of criticalElements) {
      try {
        if (!this.elements.has(elementConfig.key)) {
          const fallback = this.createFallbackElement(elementConfig.key, {
            fallbackTag: elementConfig.tag,
            fallbackClass: elementConfig.class
          });

          if (fallback) {
            console.log(`UIManager: Created fallback for ${elementConfig.key}`);
          }
        }
      } catch (error) {
        this.errorHandler.error(error, `UIManager.createFallbackElements [${elementConfig.key}]`);
      }
    }
  }

  /**
   * Setup MutationObservers for dynamic content
   */
  setupMutationObservers() {
    try {
      // Observer for dynamically added elements
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              this.handleDynamicElement(node);
            }
          });
        });
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      this.observers.set('dynamic-content', observer);
      console.log('UIManager: MutationObserver setup complete');

    } catch (error) {
      this.errorHandler.error(error, 'UIManager.setupMutationObservers');
    }
  }

  /**
   * Handle dynamically added elements
   */
  handleDynamicElement(element) {
    try {
      // Check if this element matches any of our cached selectors
      for (const [key, cachedElement] of this.elements.entries()) {
        if (!this.isValidElement(cachedElement) || !document.contains(cachedElement)) {
          // Try to find a replacement
          const selector = this.getSelectorForKey(key);
          if (selector && element.matches && element.matches(selector)) {
            this.elements.set(key, element);
            console.log(`UIManager: Updated cached element for ${key}`);
          }
        }
      }
    } catch (error) {
      this.errorHandler.warn(`Error handling dynamic element: ${error.message}`, 'UIManager');
    }
  }

  /**
   * Get selector string for cached element key
   */
  getSelectorForKey(key) {
    const selectorMap = {
      'dockContainer': '.dock-container',
      'dockItems': '#dock-items',
      'windowsList': '#windows-list',
      'settingsPanel': '#settings-panel',
      'configModal': '#config-modal',
      'refreshButton': '.refresh-button',
      'toggleButton': '.toggle-button',
      'statusIndicator': '.status-indicator',
      'errorDisplay': '.error-display'
    };

    return selectorMap[key] || null;
  }

  /**
   * Validate critical elements are accessible
   */
  validateCriticalElements() {
    const criticalElements = ['body'];

    for (const key of criticalElements) {
      const element = this.getElement(key);
      if (!element) {
        console.error(`UIManager: Critical element missing: ${key}`);
        this.stats.errorsHandled++;
      }
    }
  }

  /**
   * Get UIManager statistics
   */
  getStatistics() {
    return {
      ...this.stats,
      cachedElements: this.elements.size,
      fallbackElements: this.config.fallbackElements.size,
      activeObservers: this.observers.size,
      isInitialized: this.isInitialized,
      successRate: this.stats.totalAccesses > 0 ?
        Math.round(((this.stats.totalAccesses - this.stats.nullAccesses) / this.stats.totalAccesses) * 100) : 0
    };
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    try {
      console.log('UIManager: Starting cleanup...');

      // Disconnect all observers
      for (const [key, observer] of this.observers.entries()) {
        try {
          observer.disconnect();
        } catch (error) {
          console.warn(`UIManager: Error disconnecting observer ${key}:`, error.message);
        }
      }
      this.observers.clear();

      // Clear element cache
      this.elements.clear();
      this.config.fallbackElements.clear();

      // Remove event listeners
      document.removeEventListener('DOMContentLoaded', this.handleDOMContentLoaded);
      window.removeEventListener('load', this.handleWindowLoad);
      window.removeEventListener('beforeunload', this.handleWindowUnload);

      this.isInitialized = false;
      console.log('UIManager: Cleanup completed');

    } catch (error) {
      this.errorHandler.error(error, 'UIManager.cleanup');
    }
  }
}

module.exports = UIManager;