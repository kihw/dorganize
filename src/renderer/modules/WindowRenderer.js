const Constants = require('../../utils/Constants');

/**
 * WindowRenderer - Handles all window rendering with incremental DOM updates
 * Completely eliminates innerHTML usage for maximum performance
 */
class WindowRenderer {
  constructor(configRenderer) {
    this.configRenderer = configRenderer;

    // Enhanced DOM element cache with detailed tracking
    this.domCache = new Map();
    this.windowElementCache = new Map(); // Cache for individual window DOM elements
    this.elementTemplates = new Map(); // Reusable element templates

    // State tracking for incremental updates
    this.lastWindowsState = new Map();
    this.lastWindowCount = 0;
    this.isInitialized = false;

    // Performance monitoring with detailed metrics
    this.stats = {
      totalRenders: 0,
      incrementalUpdates: 0,
      fullRenders: 0,
      elementsCreated: 0,
      elementsUpdated: 0,
      elementsRemoved: 0,
      domQueries: 0,
      cacheHits: 0,
      renderTime: 0,
      updateTime: 0
    };

    // Enhanced configuration
    this.config = {
      enableIncrementalUpdates: true,
      enableElementReuse: true,
      enableTemplateCache: true,
      batchUpdates: true,
      updateThrottleMs: Constants.UI.UPDATE_THROTTLE_MS,
      maxCacheSize: Constants.WINDOW.MAX_WINDOW_CACHE_SIZE,
      enablePerformanceMonitoring: true
    };

    // Update batching
    this.pendingUpdates = new Set();
    this.updateThrottleTimeout = null;

    // Element factory for creating optimized DOM elements
    this.elementFactory = new WindowElementFactory();

    this.initialize();
    console.log('WindowRenderer: Initialized with incremental DOM updates');
  }

  /**
   * Initialize DOM caching and setup observers
   */
  async initialize() {
    try {
      // Wait for DOM readiness
      if (document.readyState === 'loading') {
        await new Promise(resolve => {
          document.addEventListener('DOMContentLoaded', resolve, { once: true });
        });
      }

      // Cache critical DOM elements
      await this.cacheElements();

      // Initialize element templates
      this.initializeElementTemplates();

      // Setup MutationObserver for dynamic content
      this.setupDOMObserver();

      // Setup performance monitoring
      if (this.config.enablePerformanceMonitoring) {
        this.setupPerformanceMonitoring();
      }

      this.isInitialized = true;
      console.log('WindowRenderer: Initialization complete');

    } catch (error) {
      console.error('WindowRenderer: Initialization failed:', error);
    }
  }

  /**
   * Initialize reusable element templates
   */
  initializeElementTemplates() {
    try {
      // Create template for window item container
      const windowItemTemplate = document.createElement('div');
      windowItemTemplate.className = 'window-item';
      this.elementTemplates.set('windowItem', windowItemTemplate);

      // Create template for window header
      const headerTemplate = document.createElement('div');
      headerTemplate.className = 'window-header';
      this.elementTemplates.set('windowHeader', headerTemplate);

      // Create template for window controls
      const controlsTemplate = document.createElement('div');
      controlsTemplate.className = 'window-controls';
      this.elementTemplates.set('windowControls', controlsTemplate);

      console.log('WindowRenderer: Element templates initialized');

    } catch (error) {
      console.error('WindowRenderer: Error initializing templates:', error);
    }
  }

  /**
   * Cache DOM elements with comprehensive validation
   */
  async cacheElements() {
    const elements = [
      { key: 'windowsList', selector: '#windows-list', required: true },
      { key: 'noWindows', selector: '#no-windows', required: true },
      { key: 'windowCount', selector: '#window-count', required: true },
      { key: 'loadingIndicator', selector: '.loading-indicator', required: false },
      { key: 'errorDisplay', selector: '.error-display', required: false },
      { key: 'refreshButton', selector: '#refresh-btn', required: false }
    ];

    for (const elementConfig of elements) {
      try {
        const element = await this.findElementSafely(elementConfig.selector, {
          timeout: elementConfig.required ? Constants.UI.REQUIRED_ELEMENT_TIMEOUT_MS : Constants.UI.OPTIONAL_ELEMENT_TIMEOUT_MS,
          retries: elementConfig.required ? Constants.UI.MAX_RETRIES : Constants.UI.QUICK_RETRIES
        });

        if (element) {
          this.domCache.set(elementConfig.key, element);
          console.log(`WindowRenderer: Cached element '${elementConfig.key}'`);
        } else if (elementConfig.required) {
          throw new Error(`Required element not found: ${elementConfig.selector}`);
        }

      } catch (error) {
        console.error(`WindowRenderer: Failed to cache element '${elementConfig.key}':`, error.message);
        if (elementConfig.required) throw error;
      }
    }

    this.validateCachedElements();
  }

  /**
   * Find element safely with timeout and retries
   */
  async findElementSafely(selector, options = {}) {
    const config = {
      timeout: Constants.UI.DEFAULT_TIMEOUT_MS,
      retries: Constants.UI.DEFAULT_RETRIES,
      retryDelay: Constants.UI.RETRY_DELAY_MS,
      ...options
    };

    for (let attempt = 0; attempt <= config.retries; attempt++) {
      try {
        const element = document.querySelector(selector);
        if (element && this.isValidElement(element)) {
          this.stats.domQueries++;
          return element;
        }

        if (attempt < config.retries) {
          await new Promise(resolve => setTimeout(resolve, config.retryDelay));
        }

      } catch (error) {
        console.warn(`WindowRenderer: Query attempt ${attempt + 1} failed for '${selector}':`, error.message);
      }
    }

    return null;
  }

  /**
   * Validate if element is usable
   */
  isValidElement(element) {
    try {
      return element &&
        element.nodeType === Node.ELEMENT_NODE &&
        document.contains(element) &&
        typeof element.style === 'object';
    } catch (error) {
      return false;
    }
  }

  /**
   * Get cached DOM element with fallback
   */
  getElement(key, fallbackSelector = null) {
    this.stats.cacheHits++;

    let element = this.domCache.get(key);

    if (element && this.isValidElement(element)) {
      return element;
    }

    if (element) {
      this.domCache.delete(key);
      console.warn(`WindowRenderer: Removed invalid cached element: ${key}`);
    }

    if (fallbackSelector) {
      this.stats.domQueries++;
      element = document.querySelector(fallbackSelector);

      if (element && this.isValidElement(element)) {
        this.domCache.set(key, element);
        return element;
      }
    }

    return null;
  }

  /**
   * Main render method with incremental updates
   */
  async renderWindows() {
    const startTime = performance.now();
    this.stats.totalRenders++;

    try {
      const windows = this.configRenderer?.windows || [];
      console.log(`WindowRenderer: Rendering ${windows.length} windows (render #${this.stats.totalRenders})`);

      if (!this.isInitialized) {
        console.warn('WindowRenderer: Not initialized, performing basic render');
        return this.renderWindowsBasic(windows);
      }

      // Always use incremental updates
      await this.renderWindowsIncremental(windows);

      // Update state tracking
      this.updateStateTracking(windows);

      // Update window count display
      this.updateWindowCount(windows.length);

      // Performance tracking
      const renderTime = performance.now() - startTime;
      this.stats.renderTime += renderTime;

      console.log(`WindowRenderer: Incremental render completed in ${renderTime.toFixed(2)}ms`);

    } catch (error) {
      console.error('WindowRenderer: Render failed:', error);
      this.renderErrorState(error);
    }
  }

  /**
   * Incremental render - only update what has changed
   */
  async renderWindowsIncremental(windows) {
    const updateStartTime = performance.now();

    console.log('WindowRenderer: Performing incremental render');

    const windowsList = this.getElement('windowsList', '#windows-list');
    const noWindows = this.getElement('noWindows', '#no-windows');

    if (!windowsList) {
      throw new Error('Windows list element not found');
    }

    // Handle empty state
    if (windows.length === 0) {
      return this.showNoWindowsState(windowsList, noWindows);
    }

    // Hide no-windows message if visible
    if (noWindows && noWindows.style.display !== 'none') {
      noWindows.style.display = 'none';
    }

    // Show windows list if hidden
    if (windowsList.style.display === 'none') {
      windowsList.style.display = 'block';
    }

    // Detect changes
    const changes = this.detectDetailedWindowChanges(windows);
    console.log(`WindowRenderer: Detected changes - ${changes.added.length} added, ${changes.updated.length} updated, ${changes.removed.length} removed, ${changes.moved.length} moved`);

    // Batch all updates for optimal performance
    if (this.config.batchUpdates) {
      await this.batchUpdates(changes, windows, windowsList);
    } else {
      await this.processChangesSequentially(changes, windows, windowsList);
    }

    this.stats.incrementalUpdates++;
    this.stats.updateTime += performance.now() - updateStartTime;

    console.log('WindowRenderer: Incremental render complete');
  }

  /**
   * Detect detailed changes between current and previous window states
   */
  detectDetailedWindowChanges(windows) {
    const changes = {
      added: [],
      updated: [],
      removed: [],
      moved: [],
      reorderNeeded: false
    };

    const currentWindowsMap = new Map(windows.map(w => [w.id, w]));
    const currentOrder = windows.map(w => w.id);
    const lastOrder = Array.from(this.lastWindowsState.keys());

    // Find removed windows
    for (const windowId of this.lastWindowsState.keys()) {
      if (!currentWindowsMap.has(windowId)) {
        changes.removed.push(windowId);
      }
    }

    // Find added and updated windows
    for (const window of windows) {
      if (!this.lastWindowsState.has(window.id)) {
        changes.added.push(window);
      } else {
        const lastState = this.lastWindowsState.get(window.id);
        if (this.hasWindowChanged(window, lastState)) {
          const specificChanges = this.getSpecificChanges(window, lastState);
          // Only add to updates if there are actual changes
          if (specificChanges.length > 0) {
            changes.updated.push({
              window,
              changes: specificChanges
            });
          }
        }
      }
    }

    // Detect moved windows (position changes)
    changes.moved = this.detectMovedWindows(currentOrder, lastOrder);
    changes.reorderNeeded = changes.moved.length > 0;

    return changes;
  }

  /**
   * Get specific changes between two window states
   * @returns {Array} Array of changed field names
   */
  getSpecificChanges(current, last) {
    const changedFields = [];
    const trackFields = ['customName', 'character', 'dofusClass', 'shortcut', 'enabled', 'initiative', 'isActive'];

    for (const field of trackFields) {
      if (current[field] !== last[field]) {
        changedFields.push(field);
      }
    }

    return changedFields;
  }

  /**
   * Check if window has changed
   * @returns {boolean} True if window has changed
   */
  hasWindowChanged(current, last) {
    // Quickly detect if any of the tracked fields have changed
    const trackFields = ['customName', 'character', 'dofusClass', 'shortcut', 'enabled', 'initiative', 'isActive'];

    for (const field of trackFields) {
      if (current[field] !== last[field]) {
        return true;
      }
    }

    return false;
  }

  /**
   * Detect moved windows based on position changes
   * @param {Array} currentOrder - Current window IDs
   * @param {Array} lastOrder - Previous window IDs
   * @returns {Array} Array of moved window objects
   */
  detectMovedWindows(currentOrder, lastOrder) {
    const moved = [];

    for (let i = 0; i < currentOrder.length; i++) {
      const windowId = currentOrder[i];
      const lastIndex = lastOrder.indexOf(windowId);

      if (lastIndex !== -1 && lastIndex !== i) {
        moved.push({
          windowId,
          fromIndex: lastIndex,
          toIndex: i
        });
      }
    }

    return moved;
  }
  /**
   * Batch updates for optimal performance
   */
  async batchUpdates(changes, windows, container) {
    // Fix #4: Don't reset the counter here to allow it to properly accumulate during test runs
    // Instead track the updates in this batch separately
    const updatesBefore = this.stats.elementsUpdated;

    // Step 1: Remove elements that are no longer needed
    if (changes.removed.length > 0) {
      // Create a document fragment for better performance
      for (const windowId of changes.removed) {
        this.removeWindowElementIncremental(windowId);
      }
    }

    // Step 2: Use fragment for new elements
    let fragment = null;
    if (changes.added.length > 0) {
      fragment = document.createDocumentFragment();
      for (const window of changes.added) {
        const element = await this.createWindowElementIncremental(window, windows);
        fragment.appendChild(element);
        this.stats.elementsCreated++;
      }
    }

    // Step 3: Update existing elements - now tracked individually
    for (const updateInfo of changes.updated) {
      await this.updateWindowElementIncremental(updateInfo.window, updateInfo.changes);
      // Note: elementsUpdated now incremented inside updateWindowElementIncremental
    }

    // Step 4: Handle position changes with minimal DOM operations
    if (changes.reorderNeeded) {
      this.reorderElementsOptimized(windows, container);
    }

    // Step 5: Append new elements all at once
    if (fragment && fragment.hasChildNodes()) {
      this.insertElementsOptimized(fragment, windows, container);
    }

    // Log how many updates were processed in this batch for debugging
    const updatesInThisBatch = this.stats.elementsUpdated - updatesBefore;
    console.log(`WindowRenderer: Processed ${updatesInThisBatch} element updates in this batch`);
  }  /**
   * Reorder elements with minimal DOM operations
   */
  reorderElementsOptimized(windows, container) {
    // Use the more efficient algorithm with fewer DOM operations
    // Create an ordered map of window IDs
    const windowIdToIndex = new Map();
    windows.forEach((window, index) => {
      windowIdToIndex.set(window.id, index);
    });

    // Get all elements that need reordering
    const windowElements = Array.from(container.querySelectorAll('[data-window-id]'));

    // Create a map of current positions
    const currentPositions = new Map();
    windowElements.forEach((el, index) => {
      if (el && el.getAttribute) { // Safety check
        const id = el.getAttribute('data-window-id');
        if (id) currentPositions.set(id, index);
      }
    });

    // Create a map of elements by ID for quick access
    const elementsById = new Map();
    windowElements.forEach(el => {
      if (el && el.getAttribute) { // Safety check
        const id = el.getAttribute('data-window-id');
        if (id) elementsById.set(id, el);
      }
    });    // Find out of order elements - only move what's needed
    let needsMove = false;
    const elementMoves = [];

    for (let i = 0; i < windows.length; i++) {
      const windowId = windows[i].id;
      const element = elementsById.get(windowId);
      if (element) {
        const currentIndex = currentPositions.get(windowId);
        if (currentIndex !== i) {
          needsMove = true;
          elementMoves.push({
            element,
            targetIndex: i
          });
        }
      }
    }

    // If no reordering needed, exit early
    if (!needsMove) return;

    // Only perform the DOM operations once by using a documentFragment
    const fragment = document.createDocumentFragment();

    // Add elements to fragment in correct order
    windows.forEach(window => {
      const element = elementsById.get(window.id);
      if (element) fragment.appendChild(element);
    });    // Replace all at once with one DOM operation
    if (fragment.childNodes.length > 0) {
      // Clean container first - but safely
      while (container && container.firstChild) {
        container.removeChild(container.firstChild);
      }

      // Add the properly ordered fragment
      if (container && fragment) {
        container.appendChild(fragment);
      }
    }
  }

  /**
   * Insert elements optimized
   */
  insertElementsOptimized(fragment, windows, container) {
    container.appendChild(fragment);
  }

  /**
   * Process changes sequentially (fallback method)
   */
  async processChangesSequentially(changes, windows, container) {
    // Remove elements
    for (const windowId of changes.removed) {
      this.removeWindowElementIncremental(windowId);
    }

    // Add new elements
    for (const window of changes.added) {
      await this.addWindowElementIncremental(window, windows, container);
    }

    // Update existing elements
    for (const updateInfo of changes.updated) {
      await this.updateWindowElementIncremental(updateInfo.window, updateInfo.changes);
    }

    // Reorder if needed
    if (changes.reorderNeeded) {
      this.reorderElementsIncremental(windows, container);
    }
  }

  /**
   * Create window element incrementally without innerHTML
   */
  async createWindowElementIncremental(window, allWindows) {
    const order = allWindows.findIndex(w => w.id === window.id) + 1;

    // Use cached template if available
    let container;
    if (this.config.enableTemplateCache && this.elementTemplates.has('windowItem')) {
      container = this.elementTemplates.get('windowItem').cloneNode(false);
    } else {
      container = document.createElement('div');
      container.className = 'window-item';
    }

    // Set important attributes directly without additional DOM manipulation
    container.setAttribute('data-window-id', window.id);
    container.setAttribute('data-order', order);
    container.setAttribute('data-class', window.dofusClass || 'unknown');

    // Update classes in one operation
    container.className = this.getWindowClassNames(window);

    // Create header section using optimized method
    const header = this.createHeaderOptimized(window, order);
    container.appendChild(header);

    // Create controls section using optimized method
    const controls = this.createControlsOptimized(window);
    container.appendChild(controls);

    // Cache the element
    this.windowElementCache.set(window.id, container);

    return container;
  }

  /**
   * Create header section with minimal DOM operations
   */
  createHeaderOptimized(window, order) {
    let header;
    if (this.config.enableTemplateCache && this.elementTemplates.has('windowHeader')) {
      header = this.elementTemplates.get('windowHeader').cloneNode(false);
    } else {
      header = document.createElement('div');
      header.className = 'window-header';
    }

    // Create name and class elements directly
    const displayName = window.customName || window.character || 'Unknown Character';
    const className = window.dofusClass || 'Unknown Class';

    // Create avatar element if needed
    if (window.avatar) {
      const avatar = document.createElement('div');
      avatar.className = 'window-avatar';
      avatar.style.backgroundImage = `url(../assets/avatars/${window.avatar}.jpg)`;

      // Add img element inside avatar div (Fix #2)
      const img = document.createElement('img');
      img.src = `../assets/avatars/${window.avatar}.jpg`;
      img.alt = window.dofusClass || 'Unknown Class';
      avatar.appendChild(img);

      header.appendChild(avatar);
    }

    // Create name element
    const nameElement = document.createElement('input');
    nameElement.className = 'window-name';
    nameElement.value = displayName;
    nameElement.setAttribute('data-window-id', window.id);
    nameElement.setAttribute('placeholder', 'Character name');
    header.appendChild(nameElement);

    // Create class element
    const classElement = document.createElement('div');
    classElement.className = 'window-class';
    classElement.textContent = className;
    header.appendChild(classElement);

    // Create process info element (Fix #1)
    const processInfo = document.createElement('div');
    processInfo.className = 'process-info';
    processInfo.textContent = `PID: ${window.pid || 'Unknown'} | Handle: ${window.handle || 'Unknown'}`;
    header.appendChild(processInfo);

    return header;
  }

  /**
   * Create controls section with minimal DOM operations
   */
  createControlsOptimized(window) {
    let controls;
    if (this.config.enableTemplateCache && this.elementTemplates.has('windowControls')) {
      controls = this.elementTemplates.get('windowControls').cloneNode(false);
    } else {
      controls = document.createElement('div');
      controls.className = 'window-controls';
    }

    // Add toggle control
    const toggleDiv = document.createElement('div');
    toggleDiv.className = 'window-toggle';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = window.enabled !== false;
    checkbox.setAttribute('data-window-id', window.id);
    toggleDiv.appendChild(checkbox);

    controls.appendChild(toggleDiv);

    // Add shortcut display with minimal elements
    const shortcutDisplay = document.createElement('div');
    shortcutDisplay.className = 'shortcut-display';
    shortcutDisplay.textContent = window.shortcut || 'No shortcut';
    shortcutDisplay.setAttribute('data-window-id', window.id);

    controls.appendChild(shortcutDisplay);

    // Add initiative input if needed
    if (typeof window.initiative !== 'undefined') {
      const initiativeInput = document.createElement('input');
      initiativeInput.type = 'number';
      initiativeInput.className = 'initiative-input';
      initiativeInput.value = window.initiative || 0;
      initiativeInput.setAttribute('data-window-id', window.id);

      controls.appendChild(initiativeInput);
    }

    return controls;
  }

  /**
   * Get window class names in one efficient operation
   */
  getWindowClassNames(window) {
    const classes = ['window-item'];

    if (window.isActive) classes.push('active');
    if (window.enabled === false) classes.push('disabled');
    if (window.dofusClass) classes.push(`class-${window.dofusClass.toLowerCase().replace(/\s+/g, '-')}`);

    return classes.join(' ');
  }

  /**
   * Update window element incrementally
   */  async updateWindowElementIncremental(window, changedFields) {
    const element = this.getWindowElement(window.id);
    if (!element) {
      console.warn(`WindowRenderer: Element not found for window ${window.id}`);
      return false;
    }

    // Track if we actually made any updates
    let updated = false;

    // Update only the changed fields
    for (const field of changedFields) {
      const fieldUpdated = this.updateSpecificField(element, window, field);
      updated = updated || fieldUpdated;
    }

    // Update CSS classes if active state changed
    if (changedFields.includes('isActive') || changedFields.includes('enabled')) {
      this.updateElementClasses(element, window);
      updated = true;
    }

    // Only count this as an update if we actually changed something
    // And only increment once per window regardless of how many fields changed
    if (updated) {
      this.stats.elementsUpdated++; // Increment once per window update
    }

    return updated;
  }

  /**
   * Update specific field in DOM element
   */
  updateSpecificField(element, window, field) {
    try {
      switch (field) {
        case 'customName':
        case 'character':
          return this.updateCharacterName(element, window);
        case 'dofusClass':
          return this.updateCharacterClass(element, window);
        case 'initiative':
          return this.updateInitiative(element, window);
        case 'shortcut':
          return this.updateShortcut(element, window);
        case 'enabled':
          return this.updateEnabledState(element, window);
        case 'isActive':
          return this.updateActiveState(element, window);
      }
    } catch (error) {
      console.warn(`WindowRenderer: Error updating field ${field}:`, error);
    }
    return false;
  }

  /**
   * Update character name display
   */
  updateCharacterName(element, window) {
    const nameInput = element.querySelector('.window-name');
    if (nameInput) {
      const displayName = window.customName || window.character || 'Unknown Character';
      if (nameInput.value !== displayName) {
        nameInput.value = displayName;
        return true;
      }
    }
    return false;
  }

  /**
   * Update character class display
   */
  updateCharacterClass(element, window) {
    const classDiv = element.querySelector('.window-class');
    let updated = false;

    if (classDiv) {
      const className = window.dofusClass || 'Unknown Class';
      if (classDiv.textContent !== className) {
        classDiv.textContent = className;
        updated = true;
      }
    }

    // Update data attribute
    const currentClass = element.getAttribute('data-class');
    const newClass = window.dofusClass || 'unknown';
    if (currentClass !== newClass) {
      element.setAttribute('data-class', newClass);
      updated = true;
    }

    return updated;
  }

  /**
   * Update initiative display
   */
  updateInitiative(element, window) {
    const initiativeInput = element.querySelector('.initiative-input');
    if (initiativeInput) {
      const initiative = window.initiative || 0;
      if (parseInt(initiativeInput.value) !== initiative) {
        initiativeInput.value = initiative.toString();
        return true;
      }
    }
    return false;
  }

  /**
   * Update shortcut display
   */
  updateShortcut(element, window) {
    const shortcutDisplay = element.querySelector('.shortcut-display');
    if (shortcutDisplay) {
      const shortcutText = window.shortcut || 'No shortcut';
      if (shortcutDisplay.textContent !== shortcutText) {
        shortcutDisplay.textContent = shortcutText;
      }
    }
  }

  /**
   * Update enabled state
   */
  updateEnabledState(element, window) {
    const checkbox = element.querySelector('.window-toggle input[type="checkbox"]');
    if (checkbox) {
      const isEnabled = window.enabled !== false;
      if (checkbox.checked !== isEnabled) {
        checkbox.checked = isEnabled;
      }
    }
  }

  /**
   * Update active state
   */
  updateActiveState(element, window) {
    if (window.isActive) {
      element.classList.add('active');
    } else {
      element.classList.remove('active');
    }
  }

  /**
   * Update element CSS classes
   */
  updateElementClasses(element, window) {
    const classes = ['window-item'];

    if (window.isActive) classes.push('active');
    if (!window.enabled) classes.push('disabled');

    element.className = classes.join(' ');
  }

  /**
   * Add window element incrementally
   */
  async addWindowElementIncremental(window, allWindows, container) {
    const element = await this.createWindowElementIncremental(window, allWindows);

    // Find correct insertion point
    const insertionPoint = this.findInsertionPoint(container, window.id, allWindows);

    if (insertionPoint) {
      container.insertBefore(element, insertionPoint);
    } else {
      container.appendChild(element);
    }

    this.stats.elementsCreated++;
  }

  /**
   * Remove window element incrementally
   */
  removeWindowElementIncremental(windowId) {
    const element = this.getWindowElement(windowId);

    if (element) {
      element.remove();
      this.windowElementCache.delete(windowId);
      this.stats.elementsRemoved++;
      console.log(`WindowRenderer: Removed window element: ${windowId}`);
    }
  }

  /**
   * Get window element from cache or DOM
   */
  getWindowElement(windowId) {
    // Try cache first
    let element = this.windowElementCache.get(windowId);

    if (element && this.isValidElement(element)) {
      return element;
    }

    // Fallback to DOM query
    element = document.querySelector(`[data-window-id="${windowId}"]`);

    if (element) {
      this.windowElementCache.set(windowId, element);
      return element;
    }

    return null;
  }

  /**
   * Reorder elements incrementally without full DOM rebuild
   */
  reorderElementsIncremental(windows, container) {
    const fragment = document.createDocumentFragment();

    // Remove all elements from container but keep them in order
    for (const window of windows) {
      const element = this.getWindowElement(window.id);
      if (element && element.parentNode === container) {
        fragment.appendChild(element);
      }
    }

    // Reinsert in correct order
    container.appendChild(fragment);
  }

  /**
   * Insert elements at correct positions
   */
  insertElementsAtCorrectPositions(fragment, windows, container) {
    const fragmentChildren = Array.from(fragment.children);

    for (const newElement of fragmentChildren) {
      const windowId = newElement.getAttribute('data-window-id');
      const windowIndex = windows.findIndex(w => w.id === windowId);

      if (windowIndex === -1) continue;

      // Find insertion point
      const insertionPoint = this.findInsertionPointByIndex(container, windowIndex, windows);

      if (insertionPoint) {
        container.insertBefore(newElement, insertionPoint);
      } else {
        container.appendChild(newElement);
      }
    }
  }

  /**
   * Find insertion point by window index
   */
  findInsertionPointByIndex(container, targetIndex, allWindows) {
    // Find the next window that already exists in DOM
    for (let i = targetIndex + 1; i < allWindows.length; i++) {
      const nextWindowId = allWindows[i].id;
      const nextElement = container.querySelector(`[data-window-id="${nextWindowId}"]`);
      if (nextElement) {
        return nextElement;
      }
    }

    return null; // Insert at end
  }

  /**
   * Find correct insertion point for maintaining order
   */
  findInsertionPoint(container, windowId, allWindows) {
    const windowIndex = allWindows.findIndex(w => w.id === windowId);
    return this.findInsertionPointByIndex(container, windowIndex, allWindows);
  }

  /**
   * Check if window data has changed
   */
  hasWindowChanged(current, last) {
    if (!last) return true;

    const fields = ['customName', 'character', 'dofusClass', 'shortcut', 'enabled', 'initiative', 'isActive'];
    return fields.some(field => current[field] !== last[field]);
  }

  /**
   * Basic render for fallback scenarios (now also incremental)
   */
  renderWindowsBasic(windows) {
    console.log('WindowRenderer: Performing basic incremental render');

    const windowsList = document.getElementById('windows-list');
    const noWindows = document.getElementById('no-windows');
    const windowCount = document.getElementById('window-count');

    if (!windows || windows.length === 0) {
      if (windowsList) {
        this.clearElementIncremental(windowsList);
        windowsList.style.display = 'none';
      }
      if (noWindows) noWindows.style.display = 'block';
      if (windowCount) windowCount.textContent = '0 windows detected';
      return;
    }

    if (windowsList) {
      windowsList.style.display = 'block';
      this.populateWindowsListIncremental(windowsList, windows);
    }

    if (noWindows) noWindows.style.display = 'none';
    if (windowCount) windowCount.textContent = `${windows.length} window(s) detected`;
  }

  /**
   * Populate windows list incrementally
   */
  async populateWindowsListIncremental(container, windows) {
    // Clear existing content incrementally
    this.clearElementIncremental(container);

    // Create elements incrementally
    const fragment = document.createDocumentFragment();

    for (const window of windows) {
      const element = await this.createWindowElementIncremental(window, windows);
      fragment.appendChild(element);
    }

    container.appendChild(fragment);
  }

  /**
   * Clear element content incrementally
   */
  clearElementIncremental(element) {
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
  }

  /**
   * Show no windows state
   */
  showNoWindowsState(windowsList, noWindows) {
    if (windowsList) {
      windowsList.style.display = 'none';
      this.clearElementIncremental(windowsList);
    }

    if (noWindows) {
      noWindows.style.display = 'block';
    }

    this.updateWindowCount(0);
  }

  /**
   * Update window count display
   */
  updateWindowCount(count) {
    const windowCount = this.getElement('windowCount', '#window-count');
    if (windowCount) {
      const text = count === 0 ? '0 windows detected' : `${count} window(s) detected`;
      if (windowCount.textContent !== text) {
        windowCount.textContent = text;
      }
    }
  }

  /**
   * Update state tracking for next incremental update
   */
  updateStateTracking(windows) {
    this.lastWindowsState.clear();

    for (const window of windows) {
      this.lastWindowsState.set(window.id, {
        customName: window.customName,
        character: window.character,
        dofusClass: window.dofusClass,
        shortcut: window.shortcut,
        enabled: window.enabled,
        initiative: window.initiative,
        isActive: window.isActive
      });
    }

    this.lastWindowCount = windows.length;
  }

  /**
   * Render error state
   */
  renderErrorState(error) {
    const windowsList = this.getElement('windowsList', '#windows-list');
    const errorDisplay = this.getElement('errorDisplay', '.error-display');

    if (windowsList) {
      windowsList.style.display = 'none';
    }

    if (errorDisplay) {
      errorDisplay.style.display = 'block';
      errorDisplay.textContent = `Error rendering windows: ${error.message}`;
    } else {
      console.error('WindowRenderer: No error display element found');
    }
  }

  /**
   * Validate all cached elements
   */
  validateCachedElements() {
    const invalidElements = [];

    for (const [key, element] of this.domCache.entries()) {
      if (!this.isValidElement(element)) {
        invalidElements.push(key);
      }
    }

    invalidElements.forEach(key => {
      this.domCache.delete(key);
      console.warn(`WindowRenderer: Removed invalid cached element: ${key}`);
    });

    console.log(`WindowRenderer: Validated ${this.domCache.size} cached elements, removed ${invalidElements.length} invalid`);
  }

  /**
   * Setup DOM observer for dynamic changes
   */
  setupDOMObserver() {
    try {
      this.domObserver = new MutationObserver((mutations) => {
        let shouldRevalidate = false;

        mutations.forEach((mutation) => {
          mutation.removedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Check if any cached elements were removed
              for (const [key, element] of this.domCache.entries()) {
                if (node.contains && node.contains(element)) {
                  this.domCache.delete(key);
                  shouldRevalidate = true;
                }
              }

              // Check window element cache
              for (const [windowId, element] of this.windowElementCache.entries()) {
                if (node.contains && node.contains(element)) {
                  this.windowElementCache.delete(windowId);
                }
              }
            }
          });
        });

        if (shouldRevalidate) {
          console.log('WindowRenderer: DOM changes detected, revalidating cache');
          this.validateCachedElements();
        }
      });

      this.domObserver.observe(document.body, {
        childList: true,
        subtree: true
      });

    } catch (error) {
      console.warn('WindowRenderer: Failed to setup DOM observer:', error);
    }
  }

  /**
   * Setup performance monitoring
   */
  setupPerformanceMonitoring() {
    setInterval(() => {
      if (this.stats.totalRenders > 0) {
        const avgRenderTime = this.stats.renderTime / this.stats.totalRenders;
        const avgUpdateTime = this.stats.updateTime / Math.max(this.stats.incrementalUpdates, 1);
        console.log(`WindowRenderer Performance: ${this.stats.totalRenders} renders, avg ${avgRenderTime.toFixed(2)}ms, ${this.stats.incrementalUpdates} incremental updates, avg update ${avgUpdateTime.toFixed(2)}ms`);
        console.log(`WindowRenderer Elements: ${this.stats.elementsCreated} created, ${this.stats.elementsUpdated} updated, ${this.stats.elementsRemoved} removed`);
      }
    }, Constants.UI.PERFORMANCE_LOG_INTERVAL_MS);
  }

  /**
   * Get performance statistics
   */
  getStatistics() {
    return {
      ...this.stats,
      cacheSize: this.domCache.size,
      windowElementCacheSize: this.windowElementCache.size,
      isInitialized: this.isInitialized,
      averageRenderTime: this.stats.totalRenders > 0 ?
        (this.stats.renderTime / this.stats.totalRenders).toFixed(2) + 'ms' : '0ms',
      averageUpdateTime: this.stats.incrementalUpdates > 0 ?
        (this.stats.updateTime / this.stats.incrementalUpdates).toFixed(2) + 'ms' : '0ms',
      cacheHitRate: this.stats.cacheHits > 0 ?
        Math.round((this.stats.cacheHits / (this.stats.cacheHits + this.stats.domQueries)) * 100) + '%' : '0%',
      incrementalUpdateRatio: this.stats.totalRenders > 0 ?
        Math.round((this.stats.incrementalUpdates / this.stats.totalRenders) * 100) + '%' : '0%'
    };
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    try {
      if (this.domObserver) {
        this.domObserver.disconnect();
        this.domObserver = null;
      }

      this.domCache.clear();
      this.windowElementCache.clear();
      this.elementTemplates.clear();
      this.lastWindowsState.clear();

      if (this.updateThrottleTimeout) {
        clearTimeout(this.updateThrottleTimeout);
        this.updateThrottleTimeout = null;
      }

      this.isInitialized = false;
      console.log('WindowRenderer: Cleanup completed');

    } catch (error) {
      console.error('WindowRenderer: Cleanup error:', error);
    }
  }

  // Legacy methods for compatibility
  async refreshWindows() {
    console.log('WindowRenderer: Delegating refresh to ConfigRenderer...');
    return await this.configRenderer.refreshWindows();
  }

  showNoWindows() {
    const windowsList = this.getElement('windowsList', '#windows-list');
    const noWindows = this.getElement('noWindows', '#no-windows');
    this.showNoWindowsState(windowsList, noWindows);
  }

  hideNoWindows() {
    const windowsList = this.getElement('windowsList', '#windows-list');
    const noWindows = this.getElement('noWindows', '#no-windows');

    if (windowsList) windowsList.style.display = 'block';
    if (noWindows) noWindows.style.display = 'none';
  }
}

/**
 * WindowElementFactory - Creates DOM elements without innerHTML
 */
class WindowElementFactory {
  constructor() {
    this.avatarBasePath = Constants.AVATARS.AVATAR_PATH;
    this.fallbackAvatar = Constants.AVATARS.FALLBACK_AVATAR;
  }

  /**
   * Create window container element
   */
  createWindowContainer(window) {
    const container = document.createElement('div');
    container.className = this.getWindowItemClasses(window);
    container.setAttribute('data-window-id', window.id);
    container.setAttribute('data-class', window.dofusClass || 'unknown');
    return container;
  }

  /**
   * Create window header section
   */
  createWindowHeader(window, order) {
    const header = document.createElement('div');
    header.className = 'window-header';

    // Avatar section
    const avatarContainer = this.createAvatarContainer(window, order);
    header.appendChild(avatarContainer);

    // Info section
    const infoContainer = this.createInfoContainer(window);
    header.appendChild(infoContainer);

    return header;
  }

  /**
   * Create avatar container
   */  createAvatarContainer(window, order) {
    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'window-avatar';
    avatarDiv.setAttribute('onclick', `configRenderer.activateWindow('${window.id}')`);
    avatarDiv.setAttribute('title', 'Click to activate window');

    // Avatar image - ensure it's always created
    const img = document.createElement('img');
    const avatarNumber = window.avatar || '1';
    img.src = `${this.avatarBasePath}${avatarNumber}.jpg`;
    img.alt = window.dofusClass || 'Unknown Class';
    img.setAttribute('onerror', `this.src='${this.fallbackAvatar}'`);

    // Order badge
    const badge = document.createElement('div');
    badge.className = 'initiative-order-badge';
    badge.textContent = order.toString();

    avatarDiv.appendChild(img);
    avatarDiv.appendChild(badge);

    return avatarDiv;
  }

  /**
   * Create info container
   */
  createInfoContainer(window) {
    const infoDiv = document.createElement('div');
    infoDiv.className = 'window-info';

    // Name container
    const nameContainer = this.createNameContainer(window);
    infoDiv.appendChild(nameContainer);

    // Details container
    const detailsContainer = this.createDetailsContainer(window);
    infoDiv.appendChild(detailsContainer);

    return infoDiv;
  }

  /**
   * Create name container
   */
  createNameContainer(window) {
    const nameDiv = document.createElement('div');
    nameDiv.className = 'window-name-container';

    // Name input
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'window-name';
    nameInput.value = window.customName || window.character || 'Unknown Character';
    nameInput.setAttribute('onchange', `configRenderer.updateCharacterName('${window.id}', this.value)`);
    nameInput.setAttribute('placeholder', 'Character name');

    // Class div
    const classDiv = document.createElement('div');
    classDiv.className = 'window-class';
    classDiv.setAttribute('onclick', `configRenderer.showClassModal('${window.id}')`);
    classDiv.setAttribute('title', 'Click to change class');
    classDiv.textContent = window.dofusClass || 'Unknown Class';

    nameDiv.appendChild(nameInput);
    nameDiv.appendChild(classDiv);

    return nameDiv;
  }

  /**
   * Create details container
   */
  createDetailsContainer(window) {
    const detailsDiv = document.createElement('div');
    detailsDiv.className = 'window-details';

    // Initiative container
    const initiativeContainer = this.createInitiativeContainer(window);
    detailsDiv.appendChild(initiativeContainer);

    // Process info
    const processInfo = this.createProcessInfo(window);
    detailsDiv.appendChild(processInfo);

    return detailsDiv;
  }

  /**
   * Create initiative container
   */
  createInitiativeContainer(window) {
    const initiativeDiv = document.createElement('div');
    initiativeDiv.className = 'initiative-container';

    // Label
    const label = document.createElement('label');
    label.textContent = 'Initiative:';

    // Input
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'initiative-input';
    input.value = (window.initiative || 0).toString();
    input.min = Constants.WINDOW.MIN_INITIATIVE.toString();
    input.max = Constants.WINDOW.MAX_INITIATIVE.toString();
    input.setAttribute('onchange', `configRenderer.updateInitiative('${window.id}', parseInt(this.value) || 0)`);

    initiativeDiv.appendChild(label);
    initiativeDiv.appendChild(input);

    return initiativeDiv;
  }

  /**
   * Create process info
   */
  createProcessInfo(window) {
    const processDiv = document.createElement('div');
    processDiv.className = 'process-info';
    processDiv.textContent = `PID: ${window.pid || 'Unknown'} | Handle: ${window.handle || 'Unknown'}`;

    return processDiv;
  }

  /**
   * Create window controls section
   */
  createWindowControls(window) {
    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'window-controls';

    // Shortcut container
    const shortcutContainer = this.createShortcutContainer(window);
    controlsDiv.appendChild(shortcutContainer);

    // Actions container
    const actionsContainer = this.createActionsContainer(window);
    controlsDiv.appendChild(actionsContainer);

    return controlsDiv;
  }

  /**
   * Create shortcut container
   */
  createShortcutContainer(window) {
    const shortcutDiv = document.createElement('div');
    shortcutDiv.className = 'shortcut-container';

    const shortcutDisplay = document.createElement('div');
    shortcutDisplay.className = 'shortcut-display';
    shortcutDisplay.setAttribute('onclick', `configRenderer.showShortcutModal('${window.id}')`);
    shortcutDisplay.setAttribute('title', 'Click to set shortcut');
    shortcutDisplay.textContent = window.shortcut || 'No shortcut';

    shortcutDiv.appendChild(shortcutDisplay);

    return shortcutDiv;
  }

  /**
   * Create actions container
   */
  createActionsContainer(window) {
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'window-actions';

    // Toggle label
    const toggleLabel = document.createElement('label');
    toggleLabel.className = 'window-toggle';

    // Checkbox
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = window.enabled !== false;
    checkbox.setAttribute('onchange', `configRenderer.toggleWindow('${window.id}', this.checked)`);

    // Slider
    const slider = document.createElement('span');
    slider.className = 'toggle-slider';

    toggleLabel.appendChild(checkbox);
    toggleLabel.appendChild(slider);
    actionsDiv.appendChild(toggleLabel);

    return actionsDiv;
  }

  /**
   * Get CSS classes for window item
   */
  getWindowItemClasses(window) {
    const classes = ['window-item'];

    if (window.isActive) classes.push('active');
    if (!window.enabled) classes.push('disabled');

    return classes.join(' ');
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = WindowRenderer;
}