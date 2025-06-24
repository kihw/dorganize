/**
 * Tests for ShortcutUtils shared utility class
 */
jest.mock('../src/utils/Logger', () => ({
    logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
}));

const ShortcutUtils = require('../src/utils/ShortcutUtils');

describe('ShortcutUtils', () => {
    describe('validateShortcut', () => {
        test('should return false for null or empty shortcuts', () => {
            expect(ShortcutUtils.validateShortcut(null)).toBe(false);
            expect(ShortcutUtils.validateShortcut('')).toBe(false);
            expect(ShortcutUtils.validateShortcut('   ')).toBe(false);
        });

        test('should return false for placeholder text', () => {
            expect(ShortcutUtils.validateShortcut('Press any key or combination...')).toBe(false);
        });

        test('should return true for valid shortcuts', () => {
            expect(ShortcutUtils.validateShortcut('Ctrl+A')).toBe(true);
            expect(ShortcutUtils.validateShortcut('Alt+F4')).toBe(true);
            expect(ShortcutUtils.validateShortcut('Shift+Tab')).toBe(true);
            expect(ShortcutUtils.validateShortcut('CommandOrControl+S')).toBe(true);
        });

        test('should validate shortcuts with multiple modifiers', () => {
            expect(ShortcutUtils.validateShortcut('Ctrl+Alt+Delete')).toBe(true);
            expect(ShortcutUtils.validateShortcut('Ctrl+Shift+Esc')).toBe(true);
        });

        test('should reject shortcuts without modifiers when + is present', () => {
            expect(ShortcutUtils.validateShortcut('A+B')).toBe(false);
        });

        test('should accept single keys without modifiers', () => {
            expect(ShortcutUtils.validateShortcut('F1')).toBe(true);
            expect(ShortcutUtils.validateShortcut('Tab')).toBe(true);
        });
    });

    describe('formatShortcut', () => {
        test('should handle null or empty shortcuts', () => {
            expect(ShortcutUtils.formatShortcut(null)).toBe('No shortcut');
            expect(ShortcutUtils.formatShortcut('')).toBe('No shortcut');
        });

        test('should format shortcuts with consistent spacing and capitalization', () => {
            expect(ShortcutUtils.formatShortcut('ctrl+a')).toBe('Ctrl + A');
            expect(ShortcutUtils.formatShortcut('ALT+f4')).toBe('Alt + F4');
        });

        test('should replace CommandOrControl with Ctrl', () => {
            expect(ShortcutUtils.formatShortcut('CommandOrControl+S')).toBe('Ctrl + S');
        });

        test('should replace other platform-specific modifiers', () => {
            expect(ShortcutUtils.formatShortcut('Command+Option+Esc')).toBe('Cmd + Alt + Esc');
            expect(ShortcutUtils.formatShortcut('Control+Alt+Delete')).toBe('Ctrl + Alt + Delete');
        });
    });

    describe('parseShortcut', () => {
        test('should correctly parse shortcut components', () => {
            const result = ShortcutUtils.parseShortcut('Ctrl+Alt+A');
            expect(result.modifiers).toContain('ctrl');
            expect(result.modifiers).toContain('alt');
            expect(result.key).toBe('A');
            expect(result.valid).toBe(true);
        });

        test('should handle invalid shortcuts', () => {
            const result = ShortcutUtils.parseShortcut('');
            expect(result.valid).toBe(false);
        });

        test('should extract modifiers and keys correctly', () => {
            const result = ShortcutUtils.parseShortcut('Shift+Ctrl+Alt+D');
            expect(result.modifiers).toContain('shift');
            expect(result.modifiers).toContain('ctrl');
            expect(result.modifiers).toContain('alt');
            expect(result.key).toBe('D');
        });
    });
});
