# Changelog

All notable changes to this project will be documented in this file.

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
