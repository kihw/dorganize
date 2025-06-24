# Dorganize API Documentation

This document provides comprehensive documentation for all IPC (Inter-Process Communication) handlers in Dorganize. The application uses Electron's IPC system to communicate between the main process and renderer processes.

## Table of Contents

- [Error Reporting](#error-reporting)
- [Window Management](#window-management)
- [Settings Management](#settings-management)
- [Shortcut Management](#shortcut-management)
- [Application Control](#application-control)
- [Auto Key Management](#auto-key-management)

---

## Error Reporting

### `error-report`

Reports errors from renderer processes to the main process for centralized handling and logging.

**Handler Type:** `ipcMain.handle`  
**Location:** `src/services/ErrorHandler.js`  
**Parameters:**
- `errorData` (Object): Error information including message, stack trace, and context

**Returns:** Promise<boolean> - Success status of error handling operation

**Example:**
```javascript
// Renderer process
const result = await window.electron.ipcRenderer.invoke('error-report', {
  message: 'Failed to load window data',
  stack: error.stack,
  context: { windowId: '12345' }
});
```

### `dock-error`

Handles errors specifically from the dock window process.

**Handler Type:** `ipcMain.on`  
**Location:** `src/services/ErrorHandler.js`  
**Parameters:**
- `errorData` (Object): Error information from the dock window

**Returns:** None (Event listener)

---

## Window Management

### `get-dofus-windows`

Retrieves the list of detected windows for display in the UI.

**Handler Type:** `ipcMain.handle`  
**Location:** `src/main.js`  
**Parameters:** None

**Returns:** Promise<Array> - Array of window objects with IDs, titles, and metadata

**Example:**
```javascript
// Renderer process
const windows = await window.electron.ipcRenderer.invoke('get-dofus-windows');
```

### `refresh-windows`

Forces a refresh of the window detection process to update the window list.

**Handler Type:** `ipcMain.handle`  
**Location:** `src/main.js`  
**Parameters:** None

**Returns:** Promise<Array> - Updated array of window objects

**Example:**
```javascript
// Renderer process
const updatedWindows = await window.electron.ipcRenderer.invoke('refresh-windows');
```

### `activate-window`

Activates (brings to front) a specific window by ID.

**Handler Type:** `ipcMain.handle`  
**Location:** `src/main.js`  
**Parameters:**
- `windowId` (String): ID of the window to activate

**Returns:** Promise<boolean> - Success status of window activation

### `activate-next-window`

Activates the next window in the window list, cycling through windows.

**Handler Type:** `ipcMain.handle`  
**Location:** `src/main.js`  
**Parameters:** None

**Returns:** Promise<boolean> - Success status of activation

### `organize-windows`

Organizes windows according to a specified layout pattern.

**Handler Type:** `ipcMain.handle`  
**Location:** `src/main.js`  
**Parameters:**
- `layout` (String): Layout identifier (e.g. 'grid', 'horizontal', 'vertical')

**Returns:** Promise<boolean> - Success status of window organization

---

## Settings Management

### `get-language`

Retrieves the current language setting.

**Handler Type:** `ipcMain.handle`  
**Location:** `src/main.js`  
**Parameters:** None

**Returns:** Promise<String> - Current language code (e.g. 'en', 'fr')

### `get-settings`

Retrieves all user settings.

**Handler Type:** `ipcMain.handle`  
**Location:** `src/main.js`  
**Parameters:** None

**Returns:** Promise<Object> - Object containing all application settings

### `save-settings`

Saves updated user settings.

**Handler Type:** `ipcMain.handle`  
**Location:** `src/main.js`  
**Parameters:**
- `settings` (Object): Updated settings object

**Returns:** Promise<boolean> - Success status of save operation

### `get-dofus-classes`

Retrieves the list of available character classes for character identification.

**Handler Type:** `ipcMain.handle`  
**Location:** `src/main.js`  
**Parameters:** None

**Returns:** Promise<Array> - Array of character class objects

---

## Shortcut Management

### `get-shortcuts-enabled`

Checks if shortcuts are currently enabled in the application.

**Handler Type:** `ipcMain.handle`  
**Location:** `src/main.js`  
**Parameters:** None

**Returns:** Promise<boolean> - Shortcut enabled status

### `toggle-shortcuts`

Toggles the enabled/disabled state of all shortcuts.

**Handler Type:** `ipcMain.handle`  
**Location:** `src/main.js`  
**Parameters:** None

**Returns:** Promise<boolean> - New shortcut enabled state

### `set-shortcut`

Sets a keyboard shortcut for a specific window.

**Handler Type:** `ipcMain.handle`  
**Location:** `src/main.js`  
**Parameters:**
- `windowId` (String): ID of the window
- `shortcut` (String): Keyboard shortcut string (e.g. 'Ctrl+1')

**Returns:** Promise<boolean> - Success status of shortcut assignment

### `remove-shortcut`

Removes a keyboard shortcut from a specific window.

**Handler Type:** `ipcMain.handle`  
**Location:** `src/main.js`  
**Parameters:**
- `windowId` (String): ID of the window

**Returns:** Promise<boolean> - Success status of shortcut removal

### `get-global-shortcuts`

Retrieves all global shortcuts currently registered.

**Handler Type:** `ipcMain.handle`  
**Location:** `src/main.js`  
**Parameters:** None

**Returns:** Promise<Object> - Object mapping shortcut types to keyboard combination strings

### `set-global-shortcut`

Sets a global shortcut for a specific function.

**Handler Type:** `ipcMain.handle`  
**Location:** `src/main.js`  
**Parameters:**
- `type` (String): Shortcut type identifier (e.g. 'toggleDock', 'nextWindow')
- `shortcut` (String): Keyboard shortcut string (e.g. 'Ctrl+Space')

**Returns:** Promise<boolean> - Success status of shortcut assignment

### `remove-global-shortcut`

Removes a global shortcut.

**Handler Type:** `ipcMain.handle`  
**Location:** `src/main.js`  
**Parameters:**
- `type` (String): Shortcut type identifier to remove

**Returns:** Promise<boolean> - Success status of shortcut removal

### `get-shortcut-config-stats`

Gets statistics about the current shortcut configuration.

**Handler Type:** `ipcMain.handle`  
**Location:** `src/main.js`  
**Parameters:** None

**Returns:** Promise<Object> - Statistics object with counts of shortcuts by type

### `export-shortcut-config`

Exports the current shortcut configuration for backup or sharing.

**Handler Type:** `ipcMain.handle`  
**Location:** `src/main.js`  
**Parameters:** None

**Returns:** Promise<Object> - Complete shortcut configuration object

### `import-shortcut-config`

Imports a shortcut configuration.

**Handler Type:** `ipcMain.handle`  
**Location:** `src/main.js`  
**Parameters:**
- `config` (Object): Shortcut configuration to import

**Returns:** Promise<boolean> - Success status of import operation

---

## Application Control

### `close-app`

Closes the application.

**Handler Type:** `ipcMain.handle`  
**Location:** `src/main.js`  
**Parameters:** None

**Returns:** None

### `show-config`

Shows the configuration window.

**Handler Type:** `ipcMain.on`  
**Location:** `src/main.js`  
**Parameters:** None

**Returns:** None (Event listener)

---

## Auto Key Management

### `get-auto-key-settings`

Retrieves the current auto-key settings.

**Handler Type:** `ipcMain.handle`  
**Location:** `src/main.js`  
**Parameters:** None

**Returns:** Promise<Object> - Auto-key configuration object

---

## Best Practices for IPC Usage

1. **Error Handling**: Always implement proper error handling on both sides of IPC communication
2. **Security**: Validate all input data received from renderer processes
3. **Performance**: Minimize large data transfers over IPC channels
4. **Versioning**: Document API version changes to maintain backwards compatibility

---

## Future Extension Points

The API design allows for extension in these areas:

1. Advanced window management features
2. Enhanced shortcut configuration options
3. Additional customization settings
4. Performance monitoring and optimization

---

**Last Updated:** June 2023
