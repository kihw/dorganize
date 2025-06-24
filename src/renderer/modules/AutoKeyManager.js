const { getErrorHandler } = require('../../services/ErrorHandler');
const UIManager = require('./UIManager');
const ShortcutUtils = require('../../utils/ShortcutUtils');
const { logger } = require('../../utils/Logger');

/**
 * AutoKeyManager - Handles auto-key functionality with standardized null checking
 * Now using shared ShortcutUtils for shortcut validation and formatting
 */
class AutoKeyManager {
  constructor() {
    this.errorHandler = getErrorHandler();
    this.uiManager = new UIManager();

    // State management
    this.isEnabled = false;
    this.isActive = false;
    this.currentKey = null;
    this.keyInterval = null;
    this.lastKeyTime = 0;
    this.keyCount = 0;

    // Configuration
    this.config = {
      defaultInterval: 1000, // 1 second
      minInterval: 100,      // 100ms minimum
      maxInterval: 60000,    // 60 seconds maximum
      maxKeysPerMinute: 600, // Safety limit
      enableSafetyChecks: true,
      strictNullChecking: true
    };

    // Element selectors with validation
    this.selectors = {
      autoKeyEnabled: '#auto-key-enabled',
      autoKeySettings: '.auto-key-settings',
      keySelector: '#key-selector',
      intervalInput: '#interval-input',
      startButton: '#start-auto-key',
      stopButton: '#stop-auto-key',
      statusDisplay: '.auto-key-status',
      keyCountDisplay: '.key-count',
      safetyIndicator: '.safety-indicator'
    };

    // Cached elements with null tracking
    this.elements = new Map();
    this.elementStates = new Map(); // Track null states

    // Statistics for monitoring
    this.stats = {
      totalElementAccesses: 0,
      nullElementAccesses: 0,
      successfulKeyPresses: 0,
      failedKeyPresses: 0,
      safetyStops: 0,
      lastActivity: 0
    };

    // Safety monitoring
    this.safetyMonitor = {
      keyPressHistory: [],
      windowFocusLost: false,
      emergencyStop: false
    };

    this.isInitialized = false;
    this.initializationPromise = null;
  }

  /**
   * Initialize AutoKeyManager with comprehensive validation
   */
  async initialize() {
    if (this.isInitialized) {
      return true;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.performInitialization();
    return this.initializationPromise;
  }

  /**
   * Perform the actual initialization
   */
  async performInitialization() {
    try {
      console.log('AutoKeyManager: Starting initialization...');

      // Initialize UI Manager first
      const uiReady = await this.uiManager.initialize();
      if (!uiReady) {
        throw new Error('UIManager initialization failed');
      }

      // Cache and validate all elements
      await this.cacheAndValidateElements();

      // Setup event listeners with null checking
      this.setupEventListeners();

      // Initialize UI state
      this.updateUIState();

      // Setup safety monitoring
      this.setupSafetyMonitoring();

      this.isInitialized = true;
      console.log('AutoKeyManager: Initialization completed successfully');
      return true;

    } catch (error) {
      this.errorHandler.error(error, 'AutoKeyManager.initialize');
      this.isInitialized = false;
      return false;
    }
  }

  /**
   * Cache and validate all DOM elements with standardized null checking
   */
  async cacheAndValidateElements() {
    console.log('AutoKeyManager: Caching and validating elements...');

    for (const [key, selector] of Object.entries(this.selectors)) {
      try {
        const element = await this.getElementSafely(key, selector, {
          required: key === 'autoKeyEnabled', // Only checkbox is required
          timeout: 2000,
          cache: true
        });

        if (element) {
          this.elements.set(key, element);
          this.elementStates.set(key, { isNull: false, lastSeen: Date.now() });
          console.log(`AutoKeyManager: Cached element '${key}'`);
        } else {
          this.elementStates.set(key, { isNull: true, lastSeen: Date.now() });

          if (key === 'autoKeyEnabled') {
            throw new Error(`Required element not found: ${selector}`);
          } else {
            console.warn(`AutoKeyManager: Optional element not found: ${key} (${selector})`);
          }
        }

      } catch (error) {
        this.errorHandler.error(error, `AutoKeyManager.cacheElements [${key}]`);
        this.elementStates.set(key, { isNull: true, lastSeen: Date.now(), error: error.message });

        if (key === 'autoKeyEnabled') {
          throw error;
        }
      }
    }

    this.logElementCacheStatus();
  }

  /**
   * Get element safely with standardized null checking pattern
   */
  async getElementSafely(key, selector, options = {}) {
    const config = {
      required: false,
      timeout: 1000,
      cache: false,
      retries: 2,
      fallback: null,
      ...options
    };

    this.stats.totalElementAccesses++;

    try {
      // Check cache first if enabled
      if (config.cache && this.elements.has(key)) {
        const cachedElement = this.elements.get(key);
        if (this.isElementValid(cachedElement)) {
          return cachedElement;
        } else {
          // Remove invalid cached element
          this.elements.delete(key);
          this.elementStates.set(key, { isNull: true, lastSeen: Date.now() });
        }
      }

      // Try to find element
      const element = await this.uiManager.findElementSafely(selector, {
        timeout: config.timeout,
        retries: config.retries
      });

      if (element && this.isElementValid(element)) {
        // Update tracking
        this.elementStates.set(key, { isNull: false, lastSeen: Date.now() });

        if (config.cache) {
          this.elements.set(key, element);
        }

        return element;
      }

      // Element not found or invalid
      this.stats.nullElementAccesses++;
      this.elementStates.set(key, { isNull: true, lastSeen: Date.now() });

      if (config.required) {
        throw new Error(`Required element '${key}' not found or invalid: ${selector}`);
      }

      // Return fallback if provided
      if (config.fallback) {
        console.log(`AutoKeyManager: Using fallback for ${key}`);
        return config.fallback;
      }

      return null;

    } catch (error) {
      this.stats.nullElementAccesses++;
      this.errorHandler.error(error, `AutoKeyManager.getElementSafely [${key}]`);

      if (config.required) {
        throw error;
      }

      return config.fallback || null;
    }
  }

  /**
   * Validate element with comprehensive checks
   */
  isElementValid(element) {
    try {
      return element &&
        element.nodeType === Node.ELEMENT_NODE &&
        document.contains(element) &&
        typeof element.getAttribute === 'function' &&
        typeof element.addEventListener === 'function';
    } catch (error) {
      return false;
    }
  }

  /**
   * Get element with standardized null checking and error handling
   */
  getElement(key, options = {}) {
    const config = {
      required: false,
      warnOnNull: true,
      useCache: true,
      ...options
    };

    try {
      let element = null;

      // Try cache first
      if (config.useCache && this.elements.has(key)) {
        element = this.elements.get(key);

        if (this.isElementValid(element)) {
          return element;
        } else {
          // Remove invalid cached element
          this.elements.delete(key);
          this.elementStates.set(key, { isNull: true, lastSeen: Date.now() });
        }
      }

      // Try selector
      const selector = this.selectors[key];
      if (selector) {
        element = this.uiManager.getElement(selector, { required: false });
      }

      // Update tracking
      if (element && this.isElementValid(element)) {
        this.elementStates.set(key, { isNull: false, lastSeen: Date.now() });

        if (config.useCache) {
          this.elements.set(key, element);
        }

        return element;
      }

      // Handle null result
      this.stats.nullElementAccesses++;
      this.elementStates.set(key, { isNull: true, lastSeen: Date.now() });

      if (config.required) {
        throw new Error(`Required element '${key}' is null or invalid`);
      }

      if (config.warnOnNull && this.config.strictNullChecking) {
        console.warn(`AutoKeyManager: Element '${key}' is null - selector: ${selector}`);
      }

      return null;

    } catch (error) {
      this.errorHandler.error(error, `AutoKeyManager.getElement [${key}]`);

      if (config.required) {
        throw error;
      }

      return null;
    }
  }

  /**
   * Check if auto-key is enabled with comprehensive null checking
   */
  isAutoKeyEnabled() {
    try {
      const checkbox = this.getElement('autoKeyEnabled', { warnOnNull: false });

      if (!checkbox) {
        // Fallback: check if we have stored state
        const storedState = this.getStoredEnabledState();
        if (storedState !== null) {
          console.log('AutoKeyManager: Using stored enabled state due to null checkbox');
          return storedState;
        }

        // Final fallback
        console.warn('AutoKeyManager: Auto-key checkbox is null, defaulting to false');
        return false;
      }

      // Validate checkbox properties
      if (typeof checkbox.checked !== 'boolean') {
        console.warn('AutoKeyManager: Checkbox element lacks checked property');
        return false;
      }

      return checkbox.checked;

    } catch (error) {
      this.errorHandler.error(error, 'AutoKeyManager.isAutoKeyEnabled');
      return false;
    }
  }

  /**
   * Set auto-key enabled state with null checking
   */
  setAutoKeyEnabled(enabled) {
    try {
      const checkbox = this.getElement('autoKeyEnabled', { warnOnNull: true });

      if (!checkbox) {
        // Store state for later use
        this.storeEnabledState(enabled);
        console.warn('AutoKeyManager: Checkbox null, stored state for later application');
        return false;
      }

      // Validate checkbox before setting
      if (typeof checkbox.checked !== 'boolean') {
        console.error('AutoKeyManager: Checkbox element is invalid');
        return false;
      }

      checkbox.checked = Boolean(enabled);
      this.isEnabled = Boolean(enabled);

      // Store state
      this.storeEnabledState(enabled);

      // Update UI
      this.updateUIState();

      console.log(`AutoKeyManager: Auto-key enabled state set to: ${enabled}`);
      return true;

    } catch (error) {
      this.errorHandler.error(error, 'AutoKeyManager.setAutoKeyEnabled');
      return false;
    }
  }

  /**
   * Get stored enabled state from localStorage
   */
  getStoredEnabledState() {
    try {
      const stored = localStorage.getItem('autoKeyEnabled');
      return stored !== null ? JSON.parse(stored) : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Store enabled state to localStorage
   */
  storeEnabledState(enabled) {
    try {
      localStorage.setItem('autoKeyEnabled', JSON.stringify(Boolean(enabled)));
    } catch (error) {
      console.warn('AutoKeyManager: Failed to store enabled state:', error.message);
    }
  }

  /**
   * Get selected key with null checking
   */
  getSelectedKey() {
    try {
      const selector = this.getElement('keySelector', { warnOnNull: false });

      if (!selector) {
        const storedKey = this.getStoredSelectedKey();
        if (storedKey) {
          console.log('AutoKeyManager: Using stored key due to null selector');
          return storedKey;
        }

        console.warn('AutoKeyManager: Key selector is null, using default');
        return 'F1'; // Default key
      }

      // Validate selector properties
      if (typeof selector.value !== 'string') {
        console.warn('AutoKeyManager: Key selector lacks value property');
        return 'F1';
      }

      const selectedKey = selector.value || 'F1';
      this.storeSelectedKey(selectedKey);
      return selectedKey;

    } catch (error) {
      this.errorHandler.error(error, 'AutoKeyManager.getSelectedKey');
      return 'F1';
    }
  }

  /**
   * Set selected key with null checking
   */
  setSelectedKey(key) {
    try {
      if (!key || typeof key !== 'string') {
        console.warn('AutoKeyManager: Invalid key provided');
        return false;
      }

      const selector = this.getElement('keySelector', { warnOnNull: true });

      if (!selector) {
        this.storeSelectedKey(key);
        console.warn('AutoKeyManager: Selector null, stored key for later application');
        return false;
      }

      // Validate selector before setting
      if (typeof selector.value !== 'string' && selector.value !== undefined) {
        console.error('AutoKeyManager: Key selector is invalid');
        return false;
      }

      selector.value = key;
      this.currentKey = key;
      this.storeSelectedKey(key);

      console.log(`AutoKeyManager: Selected key set to: ${key}`);
      return true;

    } catch (error) {
      this.errorHandler.error(error, 'AutoKeyManager.setSelectedKey');
      return false;
    }
  }

  /**
   * Get stored selected key
   */
  getStoredSelectedKey() {
    try {
      return localStorage.getItem('autoKeySelected') || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Store selected key
   */
  storeSelectedKey(key) {
    try {
      localStorage.setItem('autoKeySelected', key);
    } catch (error) {
      console.warn('AutoKeyManager: Failed to store selected key:', error.message);
    }
  }

  /**
   * Get interval setting with null checking and validation
   */
  getInterval() {
    try {
      const input = this.getElement('intervalInput', { warnOnNull: false });

      if (!input) {
        const storedInterval = this.getStoredInterval();
        if (storedInterval !== null) {
          console.log('AutoKeyManager: Using stored interval due to null input');
          return storedInterval;
        }

        console.warn('AutoKeyManager: Interval input is null, using default');
        return this.config.defaultInterval;
      }

      // Validate input properties
      if (typeof input.value !== 'string' && typeof input.value !== 'number') {
        console.warn('AutoKeyManager: Interval input lacks value property');
        return this.config.defaultInterval;
      }

      const interval = parseInt(input.value, 10);

      // Validate interval range
      if (isNaN(interval) || interval < this.config.minInterval || interval > this.config.maxInterval) {
        console.warn(`AutoKeyManager: Invalid interval ${interval}, using default`);
        return this.config.defaultInterval;
      }

      this.storeInterval(interval);
      return interval;

    } catch (error) {
      this.errorHandler.error(error, 'AutoKeyManager.getInterval');
      return this.config.defaultInterval;
    }
  }

  /**
   * Set interval with null checking and validation
   */
  setInterval(interval) {
    try {
      // Validate interval value
      const validInterval = this.validateInterval(interval);
      if (validInterval === null) {
        return false;
      }

      const input = this.getElement('intervalInput', { warnOnNull: true });

      if (!input) {
        this.storeInterval(validInterval);
        console.warn('AutoKeyManager: Input null, stored interval for later application');
        return false;
      }

      // Validate input before setting
      if (typeof input.value !== 'string' && input.value !== undefined) {
        console.error('AutoKeyManager: Interval input is invalid');
        return false;
      }

      input.value = validInterval.toString();
      this.storeInterval(validInterval);

      console.log(`AutoKeyManager: Interval set to: ${validInterval}ms`);
      return true;

    } catch (error) {
      this.errorHandler.error(error, 'AutoKeyManager.setInterval');
      return false;
    }
  }

  /**
   * Validate interval value
   */
  validateInterval(interval) {
    try {
      const numInterval = parseInt(interval, 10);

      if (isNaN(numInterval)) {
        console.warn('AutoKeyManager: Interval is not a number');
        return null;
      }

      if (numInterval < this.config.minInterval) {
        console.warn(`AutoKeyManager: Interval too small, using minimum: ${this.config.minInterval}`);
        return this.config.minInterval;
      }

      if (numInterval > this.config.maxInterval) {
        console.warn(`AutoKeyManager: Interval too large, using maximum: ${this.config.maxInterval}`);
        return this.config.maxInterval;
      }

      return numInterval;

    } catch (error) {
      this.errorHandler.error(error, 'AutoKeyManager.validateInterval');
      return null;
    }
  }

  /**
   * Get stored interval
   */
  getStoredInterval() {
    try {
      const stored = localStorage.getItem('autoKeyInterval');
      return stored !== null ? parseInt(stored, 10) : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Store interval
   */
  storeInterval(interval) {
    try {
      localStorage.setItem('autoKeyInterval', interval.toString());
    } catch (error) {
      console.warn('AutoKeyManager: Failed to store interval:', error.message);
    }
  }

  /**
   * Start auto-key with comprehensive validation
   */
  async startAutoKey() {
    try {
      console.log('AutoKeyManager: Starting auto-key...');

      // Validate state before starting
      if (!this.validateAutoKeyStart()) {
        return false;
      }

      // Stop existing interval if running
      this.stopAutoKey();

      // Get current settings
      this.currentKey = this.getSelectedKey();
      const interval = this.getInterval();

      // Validate settings
      if (!this.currentKey || !interval) {
        throw new Error('Invalid auto-key settings');
      }

      // Start interval
      this.keyInterval = setInterval(() => {
        this.executeKeyPress();
      }, interval);

      this.isActive = true;
      this.stats.lastActivity = Date.now();

      // Update UI
      this.updateUIState();
      this.updateStartStopButtons();

      console.log(`AutoKeyManager: Auto-key started - Key: ${this.currentKey}, Interval: ${interval}ms`);
      return true;

    } catch (error) {
      this.errorHandler.error(error, 'AutoKeyManager.startAutoKey');
      this.stopAutoKey(); // Ensure clean state
      return false;
    }
  }

  /**
   * Validate conditions for starting auto-key
   */
  validateAutoKeyStart() {
    try {
      // Check if enabled
      if (!this.isAutoKeyEnabled()) {
        console.warn('AutoKeyManager: Cannot start - auto-key is disabled');
        return false;
      }

      // Check if already active
      if (this.isActive) {
        console.warn('AutoKeyManager: Auto-key is already active');
        return false;
      }

      // Check safety conditions
      if (this.safetyMonitor.emergencyStop) {
        console.warn('AutoKeyManager: Cannot start - emergency stop is active');
        return false;
      }

      // Check rate limiting
      if (!this.checkRateLimit()) {
        console.warn('AutoKeyManager: Cannot start - rate limit exceeded');
        return false;
      }

      return true;

    } catch (error) {
      this.errorHandler.error(error, 'AutoKeyManager.validateAutoKeyStart');
      return false;
    }
  }

  /**
   * Stop auto-key with cleanup
   */
  stopAutoKey() {
    try {
      console.log('AutoKeyManager: Stopping auto-key...');

      // Clear interval
      if (this.keyInterval) {
        clearInterval(this.keyInterval);
        this.keyInterval = null;
      }

      this.isActive = false;
      this.currentKey = null;

      // Update UI
      this.updateUIState();
      this.updateStartStopButtons();

      console.log('AutoKeyManager: Auto-key stopped');
      return true;

    } catch (error) {
      this.errorHandler.error(error, 'AutoKeyManager.stopAutoKey');
      return false;
    }
  }

  /**
   * Execute key press with safety checks
   */
  executeKeyPress() {
    try {
      // Safety checks
      if (!this.performSafetyChecks()) {
        this.stopAutoKey();
        return;
      }

      // Simulate key press (placeholder - implement actual key sending)
      console.log(`AutoKeyManager: Simulating key press: ${this.currentKey}`);

      // Update statistics
      this.keyCount++;
      this.lastKeyTime = Date.now();
      this.stats.successfulKeyPresses++;
      this.stats.lastActivity = Date.now();

      // Add to history for rate limiting
      this.safetyMonitor.keyPressHistory.push(Date.now());

      // Cleanup old history entries (keep only last minute)
      const oneMinuteAgo = Date.now() - 60000;
      this.safetyMonitor.keyPressHistory = this.safetyMonitor.keyPressHistory.filter(
        time => time > oneMinuteAgo
      );

      // Update display
      this.updateKeyCountDisplay();

    } catch (error) {
      this.stats.failedKeyPresses++;
      this.errorHandler.error(error, 'AutoKeyManager.executeKeyPress');
    }
  }

  /**
   * Perform safety checks before key press
   */
  performSafetyChecks() {
    try {
      if (!this.config.enableSafetyChecks) {
        return true;
      }

      // Check if window has focus
      if (document.hidden || !document.hasFocus()) {
        console.warn('AutoKeyManager: Stopping - window lost focus');
        this.safetyMonitor.windowFocusLost = true;
        this.stats.safetyStops++;
        return false;
      }

      // Check rate limiting
      if (!this.checkRateLimit()) {
        console.warn('AutoKeyManager: Stopping - rate limit exceeded');
        this.stats.safetyStops++;
        return false;
      }

      // Check if still enabled
      if (!this.isAutoKeyEnabled()) {
        console.warn('AutoKeyManager: Stopping - auto-key was disabled');
        return false;
      }

      return true;

    } catch (error) {
      this.errorHandler.error(error, 'AutoKeyManager.performSafetyChecks');
      return false;
    }
  }

  /**
   * Check rate limiting
   */
  checkRateLimit() {
    try {
      const oneMinuteAgo = Date.now() - 60000;
      const recentKeyPresses = this.safetyMonitor.keyPressHistory.filter(
        time => time > oneMinuteAgo
      ).length;

      return recentKeyPresses < this.config.maxKeysPerMinute;

    } catch (error) {
      this.errorHandler.error(error, 'AutoKeyManager.checkRateLimit');
      return false;
    }
  }

  /**
   * Update UI state with null checking
   */
  updateUIState() {
    try {
      const enabled = this.isAutoKeyEnabled();

      // Update settings panel visibility
      const settingsPanel = this.getElement('autoKeySettings', { warnOnNull: false });
      if (settingsPanel) {
        this.uiManager.setStyle(settingsPanel, 'display', enabled ? 'block' : 'none');
      }

      // Update status display
      this.updateStatusDisplay();

      // Update safety indicator
      this.updateSafetyIndicator();

    } catch (error) {
      this.errorHandler.error(error, 'AutoKeyManager.updateUIState');
    }
  }

  /**
   * Update status display with null checking
   */
  updateStatusDisplay() {
    try {
      const statusDisplay = this.getElement('statusDisplay', { warnOnNull: false });

      if (!statusDisplay) {
        return;
      }

      let status = 'Disabled';

      if (this.isAutoKeyEnabled()) {
        if (this.isActive) {
          status = `Active - ${this.currentKey || 'Unknown'} (${this.getInterval()}ms)`;
        } else {
          status = 'Enabled - Stopped';
        }
      }

      this.uiManager.setContent(statusDisplay, status, { method: 'textContent' });

    } catch (error) {
      this.errorHandler.error(error, 'AutoKeyManager.updateStatusDisplay');
    }
  }

  /**
   * Update key count display with null checking
   */
  updateKeyCountDisplay() {
    try {
      const countDisplay = this.getElement('keyCountDisplay', { warnOnNull: false });

      if (!countDisplay) {
        return;
      }

      this.uiManager.setContent(countDisplay, this.keyCount.toString(), { method: 'textContent' });

    } catch (error) {
      this.errorHandler.error(error, 'AutoKeyManager.updateKeyCountDisplay');
    }
  }

  /**
   * Update safety indicator with null checking
   */
  updateSafetyIndicator() {
    try {
      const indicator = this.getElement('safetyIndicator', { warnOnNull: false });

      if (!indicator) {
        return;
      }

      let safetyClass = 'safety-ok';
      let safetyText = 'OK';

      if (this.safetyMonitor.emergencyStop) {
        safetyClass = 'safety-emergency';
        safetyText = 'EMERGENCY STOP';
      } else if (this.safetyMonitor.windowFocusLost) {
        safetyClass = 'safety-warning';
        safetyText = 'FOCUS LOST';
      } else if (!this.checkRateLimit()) {
        safetyClass = 'safety-warning';
        safetyText = 'RATE LIMITED';
      }

      // Remove old classes
      this.uiManager.removeClass(indicator, 'safety-ok');
      this.uiManager.removeClass(indicator, 'safety-warning');
      this.uiManager.removeClass(indicator, 'safety-emergency');

      // Add new class
      this.uiManager.addClass(indicator, safetyClass);
      this.uiManager.setContent(indicator, safetyText, { method: 'textContent' });

    } catch (error) {
      this.errorHandler.error(error, 'AutoKeyManager.updateSafetyIndicator');
    }
  }

  /**
   * Update start/stop buttons with null checking
   */
  updateStartStopButtons() {
    try {
      const startButton = this.getElement('startButton', { warnOnNull: false });
      const stopButton = this.getElement('stopButton', { warnOnNull: false });

      if (startButton) {
        const disabled = !this.isAutoKeyEnabled() || this.isActive;
        startButton.disabled = disabled;
      }

      if (stopButton) {
        stopButton.disabled = !this.isActive;
      }

    } catch (error) {
      this.errorHandler.error(error, 'AutoKeyManager.updateStartStopButtons');
    }
  }

  /**
   * Setup event listeners with null checking
   */
  setupEventListeners() {
    try {
      // Auto-key enabled checkbox
      const checkbox = this.getElement('autoKeyEnabled', { warnOnNull: false });
      if (checkbox) {
        checkbox.addEventListener('change', (event) => {
          this.handleEnabledChange(event);
        });
      }

      // Key selector
      const keySelector = this.getElement('keySelector', { warnOnNull: false });
      if (keySelector) {
        keySelector.addEventListener('change', (event) => {
          this.handleKeyChange(event);
        });
      }

      // Interval input
      const intervalInput = this.getElement('intervalInput', { warnOnNull: false });
      if (intervalInput) {
        intervalInput.addEventListener('change', (event) => {
          this.handleIntervalChange(event);
        });
      }

      // Start button
      const startButton = this.getElement('startButton', { warnOnNull: false });
      if (startButton) {
        startButton.addEventListener('click', () => {
          this.startAutoKey();
        });
      }

      // Stop button
      const stopButton = this.getElement('stopButton', { warnOnNull: false });
      if (stopButton) {
        stopButton.addEventListener('click', () => {
          this.stopAutoKey();
        });
      }

      // Window focus events for safety
      window.addEventListener('blur', () => {
        this.safetyMonitor.windowFocusLost = true;
        if (this.isActive && this.config.enableSafetyChecks) {
          console.log('AutoKeyManager: Window lost focus, stopping auto-key');
          this.stopAutoKey();
        }
      });

      window.addEventListener('focus', () => {
        this.safetyMonitor.windowFocusLost = false;
        this.updateSafetyIndicator();
      });

    } catch (error) {
      this.errorHandler.error(error, 'AutoKeyManager.setupEventListeners');
    }
  }

  /**
   * Handle enabled state change
   */
  handleEnabledChange(event) {
    try {
      const enabled = event.target.checked;
      this.isEnabled = enabled;
      this.storeEnabledState(enabled);

      if (!enabled && this.isActive) {
        this.stopAutoKey();
      }

      this.updateUIState();
      console.log(`AutoKeyManager: Enabled state changed to: ${enabled}`);

    } catch (error) {
      this.errorHandler.error(error, 'AutoKeyManager.handleEnabledChange');
    }
  }

  /**
   * Handle key selection change
   */
  handleKeyChange(event) {
    try {
      const key = event.target.value;
      this.setSelectedKey(key);
      console.log(`AutoKeyManager: Selected key changed to: ${key}`);

    } catch (error) {
      this.errorHandler.error(error, 'AutoKeyManager.handleKeyChange');
    }
  }

  /**
   * Handle interval change
   */
  handleIntervalChange(event) {
    try {
      const interval = event.target.value;
      this.setInterval(interval);
      console.log(`AutoKeyManager: Interval changed to: ${interval}ms`);

    } catch (error) {
      this.errorHandler.error(error, 'AutoKeyManager.handleIntervalChange');
    }
  }

  /**
   * Setup safety monitoring
   */
  setupSafetyMonitoring() {
    try {
      // Emergency stop hotkey (Ctrl+Shift+X)
      document.addEventListener('keydown', (event) => {
        if (event.ctrlKey && event.shiftKey && event.key === 'X') {
          console.log('AutoKeyManager: Emergency stop activated');
          this.safetyMonitor.emergencyStop = true;
          this.stopAutoKey();
          this.updateSafetyIndicator();
        }
      });

      // Reset emergency stop after 10 seconds
      setInterval(() => {
        if (this.safetyMonitor.emergencyStop) {
          this.safetyMonitor.emergencyStop = false;
          this.updateSafetyIndicator();
        }
      }, 10000);

    } catch (error) {
      this.errorHandler.error(error, 'AutoKeyManager.setupSafetyMonitoring');
    }
  }

  /**
   * Log element cache status for debugging
   */
  logElementCacheStatus() {
    console.log('AutoKeyManager Element Cache Status:');
    for (const [key, state] of this.elementStates.entries()) {
      const status = state.isNull ? 'NULL' : 'OK';
      const error = state.error ? ` (Error: ${state.error})` : '';
      console.log(`  ${key}: ${status}${error}`);
    }
  }

  /**
   * Get statistics
   */
  getStatistics() {
    return {
      ...this.stats,
      elementCacheSize: this.elements.size,
      nullElementsCount: Array.from(this.elementStates.values()).filter(s => s.isNull).length,
      isInitialized: this.isInitialized,
      isEnabled: this.isEnabled,
      isActive: this.isActive,
      keyCount: this.keyCount,
      successRate: this.stats.totalElementAccesses > 0 ?
        Math.round(((this.stats.totalElementAccesses - this.stats.nullElementAccesses) / this.stats.totalElementAccesses) * 100) : 0
    };
  }

  /**
   * Emergency stop
   */
  emergencyStop() {
    try {
      console.log('AutoKeyManager: Emergency stop triggered');
      this.safetyMonitor.emergencyStop = true;
      this.stopAutoKey();
      this.setAutoKeyEnabled(false);
      this.updateUIState();

    } catch (error) {
      this.errorHandler.error(error, 'AutoKeyManager.emergencyStop');
    }
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    try {
      console.log('AutoKeyManager: Starting cleanup...');

      // Stop auto-key
      this.stopAutoKey();

      // Clear caches
      this.elements.clear();
      this.elementStates.clear();

      // Clear history
      this.safetyMonitor.keyPressHistory = [];

      // Cleanup UI manager
      if (this.uiManager) {
        this.uiManager.cleanup();
      }

      this.isInitialized = false;
      console.log('AutoKeyManager: Cleanup completed');

    } catch (error) {
      this.errorHandler.error(error, 'AutoKeyManager.cleanup');
    }
  }
}

module.exports = AutoKeyManager;

