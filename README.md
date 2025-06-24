# Dorganize v0.4.2 - Windows Edition

A modern Windows-only window organizer for Dofus with keyboard shortcuts, window management, and navigation dock. This version includes **major code quality improvements**, **performance optimizations**, and **bug fixes**.

## 🆕 What's New in v0.4.1

### ✅ **Critical Bug Fixes**
- **🐛 Configuration Persistence Fixed**: Settings no longer reset when opening the configuration window
- **🐛 Initiative Sorting Fixed**: Proper sorting by initiative (highest first) + character name
- **🔧 Enhanced Settings Management**: Improved synchronization between UI and backend

### ⚡ **New Feature: Auto Key Configuration System**
- **🎯 Automatic Assignment**: Assign shortcuts automatically based on initiative order
- **📋 Preset Configurations**: 
  - Numbers (1, 2, 3, 4...)
  - Function Keys (F1, F2, F3, F4...)
  - Numpad (Num1, Num2, Num3...)
- **🎨 Custom Patterns**: Use templates like `Ctrl+Alt+{n}` for advanced configurations
- **👁️ Real-time Preview**: See exactly which shortcuts will be assigned before applying
- **🏆 Initiative-based Ordering**: Higher initiative = lower number (1st, 2nd, 3rd...)

## 🎮 Core Features

### **Advanced Window Management**
- **Automatic Detection**: Automatically detects and lists all Dofus game windows
- **Smart Character Recognition**: Extracts character names and classes from window titles
- **Title Format Support**: Supports the format "Nom - Classe - Version - Release"
- **Initiative-based Sorting**: Organizes windows based on character initiative values
- **Window Activation**: Quick window switching with keyboard shortcuts or dock clicks

### **⌨️ Keyboard Shortcuts**
- **Custom Shortcuts**: Assign personalized keyboard shortcuts to each window
- **Global Hotkeys**: System-wide shortcuts work even when the game isn't focused
- **Auto Configuration**: NEW! Automatic shortcut assignment based on initiative order
- **Shortcut Management**: Easy shortcut assignment and removal through the GUI

### **🎯 Navigation Dock**
- **Floating Dock**: Customizable floating dock with window thumbnails
- **Multiple Positions**: Position dock at any screen corner or edge
- **Visual Indicators**: Shows active windows and character avatars
- **Quick Access**: One-click window switching and refresh functionality

### **🌍 Multi-language Support**
- **French (Français)**: Complete French localization
- **English**: Full English translation
- **German (Deutsch)**: German language support
- **Spanish (Español)**: Spanish language support
- **Italian (Italiano)**: Italian language support
- **Easy Switching**: Change language on-the-fly through the interface

## 🚀 Quick Start Guide

### 1. **Installation**
1. Download the latest release for your platform
2. Run the installer (Windows) or extract the archive (Linux/macOS)
3. Launch Dorganize

### 2. **First Setup**
1. Start Dofus with your characters (format: "Name - Class - Version - Release")
2. Open Dorganize configuration (right-click tray icon → Configure)
3. Click **Refresh** to detect your characters
4. Set initiative values for proper sorting

### 3. **Auto Key Configuration** ⚡
1. Click the **⚡ Auto Keys** button in the configuration
2. Choose a preset (Numbers, Function Keys, or Numpad) OR create a custom pattern
3. Preview the assignments (ordered by initiative)
4. Click **Apply Configuration**
5. Your shortcuts are now ready!

### 4. **Manual Shortcuts** (Optional)
- Click on any shortcut field to set individual shortcuts
- Use combinations like `Ctrl+1`, `Alt+F1`, `F1`, etc.
- Remove shortcuts by clicking the remove button

## 🎯 Auto Key Configuration Examples

### **Numbers Preset**
```
1st Initiative (Highest): 1
2nd Initiative:          2
3rd Initiative:          3
4th Initiative:          4
```

### **Function Keys Preset**
```
1st Initiative (Highest): F1
2nd Initiative:          F2
3rd Initiative:          F3
4th Initiative:          F4
```

### **Custom Pattern Examples**
```
Ctrl+Alt+{n}  →  Ctrl+Alt+1, Ctrl+Alt+2, Ctrl+Alt+3...
Shift+{n}     →  Shift+1, Shift+2, Shift+3...
Ctrl+F{n}     →  Ctrl+F1, Ctrl+F2, Ctrl+F3...
```

## 🎮 Supported Game Types

### **Dofus 3 (Unity Client)** - Recommended
- New Unity-based client (Beta/Production)
- Window title pattern: "Character - Class - Dofus 3 - Release"
- Best performance and compatibility

### **Dofus 2 (Flash/AIR Client)**
- Classic Dofus 2.x client
- Window title pattern: "Character - Class - Dofus 2 - Release"
- Full support with enhanced title detection

### **Dofus Retro (1.29)**
- Classic Dofus 1.29 client
- Window title pattern: "Character - Class - Dofus Retro - 1.29"
- Complete compatibility

## 🏆 Character Classes Supported

**All 19 Dofus classes are supported:**
- Feca, Osamodas, Enutrof, Sram, Xelor, Ecaflip, Eniripsa, Iop, Cra
- Sadida, Sacrieur, Pandawa, Roublard, Zobal, Steamer, Eliotrope
- Huppermage, Ouginak, Forgelance

*Automatic detection works in both French and English.*

## ⚙️ Configuration

### **Initiative Management**
- Set initiative values for each character (0-9999)
- Higher initiative = higher priority in sorting
- Auto Key Configuration uses this order for assignment

### **Window Title Format**
Ensure your Dofus windows follow this format:
```
CharacterName - ClassName - Version - Release
```
Examples:
- `Gandalf - Iop - Dofus 3 - Release`
- `Legolas - Cra - Dofus 2 - Release` 
- `Gimli - Enutrof - Dofus Retro - 1.29`

## 🔧 Troubleshooting

### **Characters not detected?**
1. Ensure Dofus windows follow the correct title format
2. Click the **Refresh** button
3. Check that characters have valid class names
4. Verify windows are visible (not minimized)

### **Auto Keys not working?**
1. Make sure characters have different initiative values
2. Enable the windows in the configuration
3. Check that shortcuts aren't conflicting with system shortcuts
4. Close the configuration window to activate shortcuts

### **Shortcuts not responding?**
1. Close the configuration window (shortcuts are disabled during configuration)
2. Check if shortcuts are enabled (toggle with global shortcut)
3. Verify shortcuts don't conflict with other applications
4. Try different key combinations

## 🖥️ System Requirements

### Platform Compatibility
- **Windows Only**: This application is designed to work exclusively on Windows operating systems
- **Supported Windows Versions**: Windows 10 and Windows 11
- **Not Compatible**: macOS and Linux platforms are not supported

### Technical Requirements
- **PowerShell**: Required for window detection and activation
- **Windows API Access**: Requires necessary permissions to interact with window handles
- **Administrator Rights**: May be needed for some window operations

### Recommended Hardware
- **Memory**: At least 4GB RAM
- **Storage**: 200MB available space
- **Display**: 1280×720 or higher resolution

## 📊 Performance & Compatibility

- **Memory Usage**: ~50-100MB RAM
- **CPU Usage**: Minimal (<1% when idle)
- **Game Impact**: Zero performance impact on Dofus
- **Compatibility**: Works with all Dofus client versions
- **Multi-account**: Supports unlimited characters

## 🆘 Support & Community

### **Getting Help**
1. Check the [Troubleshooting](#troubleshooting) section
2. Review the [Issues](https://github.com/kihw/dorganize/issues) page
3. Create a new issue with detailed information

### **Contributing**
- Report bugs with detailed reproduction steps
- Suggest features or improvements
- Submit translations for additional languages
- Contribute code via pull requests

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Credits

- **Original Inspiration**: AutoIt-based Dofus organizers
- **Windows-focused**: Modern Electron-based architecture optimized for Windows  
- **Community**: Bug reports and feature suggestions
- **Version 0.4.1**: Bug fixes and Auto Key Configuration by VaL

## 📈 Version History

- **v0.4.1** (2025-06-15): Bug fixes + Auto Key Configuration System
- **v0.4.0** (2024-12-XX): Initial cross-platform release

---

**🎮 Happy Multi-boxing!** - The Dorganize Team

*This application is not affiliated with Ankama Games. It's a community tool designed to enhance the multi-account gaming experience.*