/**
 * ShortcutUtils - Shared utility functions for shortcut validation and formatting
 * Used by both ShortcutManager and AutoKeyManager to ensure consistent behavior
 */
const { logger } = require('./Logger');

class ShortcutUtils {
    /**
     * Validate a shortcut string
     * @param {string} shortcut - The shortcut to validate
     * @returns {boolean} - Whether the shortcut is valid
     */
    static validateShortcut(shortcut) {
        try {
            // Basic validation checks
            if (!shortcut) return false;
            if (typeof shortcut !== 'string') return false;

            const trimmed = shortcut.trim();
            if (trimmed.length === 0) return false;
            if (trimmed === 'Press any key or combination...') return false;

            // Check for modifiers in shortcuts with + symbol
            if (trimmed.includes('+')) {
                const parts = trimmed.split('+').map(p => p.trim());

                // Shortcuts with + should have at least one modifier
                const validModifiers = ['ctrl', 'alt', 'shift', 'command', 'option', 'commandorcontrol'];
                const hasModifier = parts.some(part =>
                    validModifiers.includes(part.toLowerCase())
                );

                if (!hasModifier) {
                    logger.debug('ShortcutUtils: Shortcut missing valid modifier', { shortcut });
                    return false;
                }
            }

            return true;
        } catch (error) {
            logger.error('ShortcutUtils: Error validating shortcut', {
                shortcut,
                error: error.message
            });
            return false;
        }
    }

    /**
     * Format a shortcut for display
     * @param {string} shortcut - The shortcut to format
     * @returns {string} - Formatted shortcut
     */
    static formatShortcut(shortcut) {
        try {
            if (!shortcut) return 'No shortcut';

            return shortcut
                .replace(/CommandOrControl/g, 'Ctrl')
                .replace(/Command/g, 'Cmd')
                .replace(/Control/g, 'Ctrl')
                .replace(/Option/g, 'Alt')
                .replace(/\+/g, ' + ')
                .split(' + ')
                .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
                .join(' + ');
        } catch (error) {
            logger.error('ShortcutUtils: Error formatting shortcut', {
                shortcut,
                error: error.message
            });
            return shortcut || 'No shortcut';
        }
    }

    /**
     * Parse a shortcut string into its components
     * @param {string} shortcut - The shortcut to parse
     * @returns {Object} - The parsed shortcut components
     */
    static parseShortcut(shortcut) {
        try {
            if (!this.validateShortcut(shortcut)) {
                return { modifiers: [], key: '', valid: false };
            }

            const parts = shortcut.split('+').map(part => part.trim());

            const validModifiers = ['ctrl', 'alt', 'shift', 'command', 'option', 'commandorcontrol'];
            const modifiers = parts
                .filter(part =>
                    validModifiers.includes(part.toLowerCase())
                )
                .map(mod => mod.toLowerCase());

            // The last part that is not a modifier is the key
            const nonModifiers = parts.filter(part =>
                !validModifiers.includes(part.toLowerCase())
            );

            const key = nonModifiers.length > 0 ? nonModifiers[nonModifiers.length - 1] : '';

            return {
                modifiers,
                key,
                valid: true
            };
        } catch (error) {
            logger.error('ShortcutUtils: Error parsing shortcut', {
                shortcut,
                error: error.message
            });
            return { modifiers: [], key: '', valid: false };
        }
    }
}

module.exports = ShortcutUtils;
