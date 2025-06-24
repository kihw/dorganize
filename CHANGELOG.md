# Changelog

All notable changes to this project will be documented in this file.

## [0.4.2] - 2025-07-12

### 🔧 Code Quality & Bug Fixes
- **Critical Stability**: Fixed PowerShellExecutor causing app crashes with robust error handling
  - Added timeout handling for all async operations
  - Implemented PowerShell availability check with graceful fallbacks
  - Created unit tests for error scenarios and system dependencies

- **Improved JSON Handling**: Enhanced WindowParser to prevent crashes from malformed data
  - Added safe JSON parsing with validation and error recovery
  - Implemented comprehensive JSON parsing error tests

- **Race Condition Resolution**: Fixed WindowDetector race conditions with concurrent operations
  - Added mutex/lock mechanism for window detection
  - Created concurrency tests to verify thread safety

- **DOM Performance**: Major rendering performance improvements in WindowRenderer
  - Implemented incremental DOM updates instead of full regeneration
  - Added DOM element caching to reduce expensive lookups
  - Created comprehensive DOM performance and visual tests

- **Structured Logging**: Implemented robust Logger system
  - Added configurable log levels (debug, info, warn, error)
  - Created file and console output options with rotation
  - Added error/stack trace handling and context support
  - Created module-specific loggers for consistent logging

- **Enhanced Error Handling**: Improved error management with localization
  - Refactored ErrorHandler to use LocalizedErrorMessages utility
  - Added consistent error message translations in all supported languages
  - Improved user-facing error notifications with simplified messages
  - Created comprehensive error handler tests

### 🧰 Technical Improvements
- Created centralized Constants.js to eliminate magic numbers
- Improved null checking across UI modules with graceful fallbacks
- Updated ShortcutConfigManager to use Electron's userData path
- Added comprehensive test coverage for all critical components

---

## [0.4.1] - 2025-06-15

### 🚀 New Features
- **Auto Key Configuration System**: New automated keyboard shortcut assignment based on initiative order
  - Preset configurations: Numbers (1,2,3...), Function Keys (F1,F2,F3...), Numpad (Num1,Num2,Num3...)
  - Custom pattern support with `{n}` variable (e.g., `Ctrl+Alt+{n}`)
  - Real-time preview of shortcut assignments
  - Initiative-based ordering with visual indicators

### 🐛 Bug Fixes
- **BUG-001**: Fixed configuration window opening issue that reset settings
  - Settings now properly persist when opening the configuration window
  - Added proper state tracking for settings loading
  - Implemented `settings-updated` IPC event for real-time synchronization
- **BUG-002**: Fixed initiative sorting bug
  - Correct sorting order: highest initiative first, then alphabetical by character name
  - Sorting now applied consistently across all window operations
  - Added dedicated `sortWindowsByInitiative()` method

### ✨ Improvements
- Enhanced UI with initiative order badges on character avatars
- Better error handling and logging throughout the application
- Improved settings persistence architecture
- More intuitive auto-configuration interface
- Real-time feedback for configuration changes

### 🔧 Technical Changes
- Centralized sorting logic with reusable methods
- Enhanced IPC communication for settings synchronization
- Better separation of concerns in configuration management
- Improved state tracking for UI consistency

### 📚 Documentation
- Updated TODO.md with completion status of all items
- Enhanced README with new feature descriptions
- Added detailed changelog for tracking improvements

---

## [0.4.0] - 2024-12-XX

### Initial Features
- Cross-platform window organizer for Dofus
- Automatic window detection and character recognition
- Keyboard shortcuts management
- Navigation dock with floating interface
- Multi-language support (FR, EN, DE, ES, IT)
- Initiative-based window sorting
- Avatar customization based on character classes
