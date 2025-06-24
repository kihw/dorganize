const Constants = require('../src/utils/Constants');

describe('Constants Validation Tests', () => {

    describe('Application Constants', () => {
        test('should have valid app configuration', () => {
            expect(Constants.APP.NAME).toBe('DOrganize');
            expect(Constants.APP.VERSION).toMatch(/^\d+\.\d+\.\d+$/);
            expect(Constants.APP.DEFAULT_LANGUAGE).toBe('FR');
            expect(Constants.VERSION).toBe(Constants.APP.VERSION);
        });

        test('should have consistent version across modules', () => {
            expect(Constants.VERSION).toBe(Constants.APP.VERSION);
            expect(Constants.CONFIG_VERSION).toBe(Constants.APP.CONFIG_VERSION);
        });
    });

    describe('UI Constants', () => {
        test('should have reasonable timeout values', () => {
            expect(Constants.UI.DEFAULT_TIMEOUT_MS).toBe(1000);
            expect(Constants.UI.QUICK_TIMEOUT_MS).toBeLessThan(Constants.UI.DEFAULT_TIMEOUT_MS);
            expect(Constants.UI.EXTENDED_TIMEOUT_MS).toBeGreaterThan(Constants.UI.DEFAULT_TIMEOUT_MS);
        });

        test('should have valid retry limits', () => {
            expect(Constants.UI.MAX_RETRIES).toBeGreaterThan(0);
            expect(Constants.UI.DEFAULT_RETRIES).toBeLessThanOrEqual(Constants.UI.MAX_RETRIES);
            expect(Constants.UI.QUICK_RETRIES).toBeLessThanOrEqual(Constants.UI.DEFAULT_RETRIES);
        });

        test('should have consistent throttle settings', () => {
            expect(Constants.UI.UPDATE_THROTTLE_MS).toBe(16); // ~60fps
            expect(Constants.UI.PERIODIC_CHECK_INTERVAL_MS).toBeGreaterThan(1000);
        });
    });

    describe('AutoKey Constants', () => {
        test('should have valid interval ranges', () => {
            expect(Constants.AUTO_KEY.MIN_INTERVAL_MS).toBeLessThan(Constants.AUTO_KEY.DEFAULT_INTERVAL_MS);
            expect(Constants.AUTO_KEY.DEFAULT_INTERVAL_MS).toBeLessThan(Constants.AUTO_KEY.MAX_INTERVAL_MS);
            expect(Constants.AUTO_KEY.MIN_INTERVAL_MS).toBeGreaterThan(0);
        });

        test('should have reasonable safety limits', () => {
            expect(Constants.AUTO_KEY.MAX_KEYS_PER_MINUTE).toBe(600);
            expect(Constants.AUTO_KEY.RATE_LIMIT_WINDOW_MS).toBe(60000);
        });

        test('should have valid pattern definitions', () => {
            const patterns = Constants.AUTO_KEY.PATTERNS;
            expect(patterns.NUMBERS).toBe('numbers');
            expect(patterns.FUNCTION).toBe('function');
            expect(patterns.CUSTOM).toBe('custom');
        });

        test('should have valid AZERTYUI key mapping', () => {
            expect(Constants.AUTO_KEY.AZERTYUI_KEYS).toHaveLength(8);
            expect(Constants.AUTO_KEY.AZERTYUI_KEYS[0]).toBe('A');
            expect(Constants.AUTO_KEY.AZERTYUI_KEYS[7]).toBe('I');
        });
    });

    describe('Window Management Constants', () => {
        test('should have valid initiative limits', () => {
            expect(Constants.WINDOW.MIN_INITIATIVE).toBe(0);
            expect(Constants.WINDOW.MAX_INITIATIVE).toBe(9999);
            expect(Constants.WINDOW.DEFAULT_INITIATIVE).toBe(0);
            expect(Constants.MAX_INITIATIVE).toBe(Constants.WINDOW.MAX_INITIATIVE);
        });

        test('should have performance thresholds', () => {
            expect(Constants.WINDOW.LARGE_WINDOW_COUNT_THRESHOLD).toBeLessThan(
                Constants.WINDOW.MASSIVE_WINDOW_COUNT_THRESHOLD
            );
            expect(Constants.WINDOW.DIFFERENTIAL_UPDATE_THRESHOLD).toBeGreaterThan(0);
        });

        test('should have cache management settings', () => {
            expect(Constants.WINDOW.MAX_WINDOW_CACHE_SIZE).toBeGreaterThan(0);
            expect(Constants.WINDOW.WINDOW_CACHE_CLEANUP_THRESHOLD).toBeGreaterThan(
                Constants.WINDOW.MAX_WINDOW_CACHE_SIZE
            );
        });
    });

    describe('Security Constants', () => {
        test('should have appropriate length limits', () => {
            const lengths = Constants.SECURITY.MAX_LENGTHS;
            expect(lengths.CHARACTER_NAME).toBe(50);
            expect(lengths.WINDOW_TITLE).toBe(200);
            expect(lengths.SHORTCUT).toBe(30);
            expect(lengths.FILE_PATH).toBe(500);
        });

        test('should have dangerous extension list', () => {
            const extensions = Constants.SECURITY.DANGEROUS_EXTENSIONS;
            expect(extensions).toContain('.exe');
            expect(extensions).toContain('.ps1');
            expect(extensions).toContain('.bat');
        });

        test('should have PowerShell security settings', () => {
            const ps = Constants.SECURITY.POWERSHELL;
            expect(ps.MAX_COMMAND_LENGTH).toBeGreaterThan(1000);
            expect(ps.EXECUTION_TIMEOUT_MS).toBeGreaterThan(ps.DEFAULT_TIMEOUT_MS);
        });
    });

    describe('PowerShell Constants', () => {
        test('should have valid timeout settings', () => {
            expect(Constants.POWERSHELL.DEFAULT_TIMEOUT_MS).toBe(5000);
            expect(Constants.POWERSHELL.EXTENDED_TIMEOUT_MS).toBeGreaterThan(
                Constants.POWERSHELL.DEFAULT_TIMEOUT_MS
            );
            expect(Constants.POWERSHELL.KILL_TIMEOUT_MS).toBeGreaterThan(0);
        });

        test('should have command limits', () => {
            expect(Constants.POWERSHELL.MAX_COMMAND_LENGTH).toBe(8192);
            expect(Constants.POWERSHELL.MAX_OUTPUT_LENGTH).toBe(1048576);
            expect(Constants.POWERSHELL.MAX_CONCURRENT_COMMANDS).toBeGreaterThan(0);
        });

        test('should have executable names', () => {
            expect(Constants.POWERSHELL.EXECUTABLE_NAMES).toContain('powershell.exe');
            expect(Constants.POWERSHELL.EXECUTABLE_NAMES).toContain('pwsh.exe');
        });

        test('should have predefined commands', () => {
            const commands = Constants.POWERSHELL.COMMANDS;
            expect(commands.VERSION_CHECK).toContain('Get-Host');
            expect(commands.PROCESS_LIST).toContain('Get-Process');
            expect(commands.WINDOW_LIST).toContain('MainWindowTitle');
        });
    });

    describe('Language Constants', () => {
        test('should have supported language codes', () => {
            const codes = Constants.LANGUAGE.SUPPORTED_CODES;
            expect(codes).toContain('FR');
            expect(codes).toContain('EN');
            expect(codes.length).toBeGreaterThan(2);
        });

        test('should have valid default language', () => {
            expect(Constants.LANGUAGE.SUPPORTED_CODES).toContain(
                Constants.LANGUAGE.DEFAULT_CODE
            );
        });

        test('should have character set patterns', () => {
            const ranges = Constants.LANGUAGE.UNICODE_RANGES;
            expect(ranges.LATIN_BASIC).toBeInstanceOf(RegExp);
            expect(ranges.LATIN_EXTENDED).toBeInstanceOf(RegExp);
            expect(ranges.SAFE_CHARACTERS).toBeInstanceOf(RegExp);
        });
    });

    describe('Dofus Game Constants', () => {
        test('should have all character classes', () => {
            const classes = Constants.DOFUS.CLASSES;
            expect(classes.FECA).toBe('feca');
            expect(classes.IOP).toBe('iop');
            expect(classes.CRA).toBe('cra');
            expect(Object.keys(classes).length).toBeGreaterThan(15);
        });

        test('should have valid default class', () => {
            expect(Object.values(Constants.DOFUS.CLASSES)).toContain(
                Constants.DOFUS.DEFAULT_CLASS
            );
        });

        test('should have process detection settings', () => {
            expect(Constants.DOFUS.PROCESS_NAMES).toContain('Dofus.exe');
            expect(Constants.DOFUS.WINDOW_TITLE_PATTERNS).toContain('Dofus');
        });
    });

    describe('Validation Patterns', () => {
        test('should have security patterns', () => {
            const patterns = Constants.PATTERNS;
            expect(patterns.CHARACTER_NAME).toBeInstanceOf(RegExp);
            expect(patterns.SHORTCUT).toBeInstanceOf(RegExp);
            expect(patterns.MALICIOUS_SCRIPT).toBeInstanceOf(RegExp);
            expect(patterns.PATH_TRAVERSAL).toBeInstanceOf(RegExp);
        });

        test('should validate character names correctly', () => {
            const pattern = Constants.PATTERNS.CHARACTER_NAME;
            expect(pattern.test('TestChar123')).toBe(true);
            expect(pattern.test('Test-Char_123')).toBe(true);
            expect(pattern.test('TestChar@123')).toBe(false);
            expect(pattern.test('')).toBe(false);
        });

        test('should validate shortcuts correctly', () => {
            const pattern = Constants.PATTERNS.SHORTCUT;
            expect(pattern.test('Ctrl+Alt+F1')).toBe(true);
            expect(pattern.test('F1')).toBe(true);
            expect(pattern.test('Ctrl+X')).toBe(true);
            expect(pattern.test('Ctrl+@')).toBe(false);
        });
    });

    describe('Helper Functions', () => {
        test('getTimeout should return correct values', () => {
            expect(Constants.getTimeout('quick')).toBe(Constants.UI.QUICK_TIMEOUT_MS);
            expect(Constants.getTimeout('extended')).toBe(Constants.UI.EXTENDED_TIMEOUT_MS);
            expect(Constants.getTimeout('powershell')).toBe(Constants.POWERSHELL.DEFAULT_TIMEOUT_MS);
            expect(Constants.getTimeout()).toBe(Constants.UI.DEFAULT_TIMEOUT_MS);
        });

        test('getMaxLength should return correct values', () => {
            expect(Constants.getMaxLength('character_name')).toBe(50);
            expect(Constants.getMaxLength('window_title')).toBe(200);
            expect(Constants.getMaxLength('unknown')).toBe(
                Constants.SECURITY.MAX_LENGTHS.GENERAL_INPUT
            );
        });

        test('isDofusClass should validate classes', () => {
            expect(Constants.isDofusClass('feca')).toBe(true);
            expect(Constants.isDofusClass('FECA')).toBe(true);
            expect(Constants.isDofusClass('iop')).toBe(true);
            expect(Constants.isDofusClass('unknown')).toBe(false);
            expect(Constants.isDofusClass(null)).toBe(false);
        });

        test('isValidLanguage should validate language codes', () => {
            expect(Constants.isValidLanguage('FR')).toBe(true);
            expect(Constants.isValidLanguage('EN')).toBe(true);
            expect(Constants.isValidLanguage('XX')).toBe(false);
            expect(Constants.isValidLanguage('fr')).toBe(false);
        });

        test('isValidDockPosition should validate positions', () => {
            expect(Constants.isValidDockPosition('NW')).toBe(true);
            expect(Constants.isValidDockPosition('SE')).toBe(true);
            expect(Constants.isValidDockPosition('XX')).toBe(false);
        });
    });

    describe('Validator Functions', () => {
        test('initiative validator should work correctly', () => {
            const validate = Constants.validators.initiative;
            expect(validate(100)).toBe(true);
            expect(validate(0)).toBe(true);
            expect(validate(9999)).toBe(true);
            expect(validate(-1)).toBe(false);
            expect(validate(10000)).toBe(false);
            expect(validate('abc')).toBe(false);
        });

        test('character name validator should work correctly', () => {
            const validate = Constants.validators.characterName;
            expect(validate('TestChar')).toBe(true);
            expect(validate('Test-Char_123')).toBe(true);
            expect(validate('')).toBe(false);
            expect(validate('a'.repeat(51))).toBe(false);
            expect(validate('Test@Char')).toBe(false);
        });

        test('shortcut validator should work correctly', () => {
            const validate = Constants.validators.shortcut;
            expect(validate('Ctrl+F1')).toBe(true);
            expect(validate('F1')).toBe(true);
            expect(validate('')).toBe(false);
            expect(validate('a'.repeat(31))).toBe(false);
            expect(validate('Ctrl+@')).toBe(false);
        });

        test('timeout validator should work correctly', () => {
            const validate = Constants.validators.timeout;
            expect(validate(1000)).toBe(true);
            expect(validate(5000)).toBe(true);
            expect(validate(0)).toBe(false);
            expect(validate(-1000)).toBe(false);
            expect(validate(100000)).toBe(false);
        });
    });

    describe('Consistency Checks', () => {
        test('timeout values should be consistent', () => {
            expect(Constants.DEFAULT_TIMEOUT).toBe(Constants.UI.DEFAULT_TIMEOUT_MS);
            expect(Constants.getTimeout('powershell')).toBe(Constants.POWERSHELL.DEFAULT_TIMEOUT_MS);
        });

        test('security and performance limits should be reasonable', () => {
            expect(Constants.SECURITY.MAX_LENGTHS.CHARACTER_NAME).toBeLessThan(
                Constants.SECURITY.MAX_LENGTHS.WINDOW_TITLE
            );
            expect(Constants.PERFORMANCE.MAX_CACHE_SIZE).toBeLessThan(
                Constants.PERFORMANCE.CACHE_CLEANUP_THRESHOLD
            );
        });

        test('PowerShell constants should be consistent', () => {
            expect(Constants.POWERSHELL.DEFAULT_TIMEOUT_MS).toBe(
                Constants.SECURITY.POWERSHELL.DEFAULT_TIMEOUT_MS
            );
            expect(Constants.POWERSHELL.MAX_COMMAND_LENGTH).toBe(
                Constants.SECURITY.POWERSHELL.MAX_COMMAND_LENGTH
            );
        });

        test('backup settings should be reasonable', () => {
            expect(Constants.PATHS.MAX_AUTO_BACKUPS).toBeGreaterThan(0);
            expect(Constants.PATHS.BACKUP_CLEANUP_DAYS).toBeGreaterThan(
                Constants.PATHS.MAX_AUTO_BACKUPS
            );
        });
    });

    describe('Theme and UI Constants', () => {
        test('should have CSS class constants', () => {
            const classes = Constants.THEME.CLASSES;
            expect(classes.ACTIVE).toBe('active');
            expect(classes.DISABLED).toBe('disabled');
            expect(classes.ERROR).toBe('error');
            expect(classes.SUCCESS).toBe('success');
        });

        test('should have safety indicator classes', () => {
            const safety = Constants.THEME.SAFETY;
            expect(safety.OK).toBe('safety-ok');
            expect(safety.WARNING).toBe('safety-warning');
            expect(safety.EMERGENCY).toBe('safety-emergency');
        });
    });

    describe('Error Constants', () => {
        test('should have error levels', () => {
            const levels = Constants.ERRORS.LEVELS;
            expect(levels.DEBUG).toBe('debug');
            expect(levels.ERROR).toBe('error');
            expect(levels.FATAL).toBe('fatal');
        });

        test('should have error codes', () => {
            const codes = Constants.ERRORS.CODES;
            expect(codes.INITIALIZATION_FAILED).toBe('INIT_FAILED');
            expect(codes.ELEMENT_NOT_FOUND).toBe('ELEMENT_NOT_FOUND');
            expect(codes.POWERSHELL_UNAVAILABLE).toBe('POWERSHELL_UNAVAILABLE');
        });

        test('should have error limits', () => {
            expect(Constants.ERRORS.MAX_ERROR_STACK_SIZE).toBeGreaterThan(0);
            expect(Constants.ERRORS.MAX_CONSECUTIVE_ERRORS).toBeGreaterThan(0);
        });
    });

    describe('Performance Constants', () => {
        test('should have reasonable performance thresholds', () => {
            expect(Constants.PERFORMANCE.MAX_RENDER_TIME_MS).toBeGreaterThan(
                Constants.PERFORMANCE.ACCEPTABLE_RENDER_TIME_MS
            );
            expect(Constants.PERFORMANCE.RENDER_TIMEOUT_MS).toBeGreaterThan(
                Constants.PERFORMANCE.MAX_RENDER_TIME_MS
            );
        });

        test('should have cache management settings', () => {
            expect(Constants.PERFORMANCE.MAX_CACHE_SIZE).toBeLessThan(
                Constants.PERFORMANCE.CACHE_CLEANUP_THRESHOLD
            );
            expect(Constants.PERFORMANCE.ELEMENT_CACHE_TTL_MS).toBeGreaterThan(0);
        });
    });

    describe('Integration with Existing Code', () => {
        test('should match values used in AutoKeyManager', () => {
            // These should match the hardcoded values we're replacing
            expect(Constants.AUTO_KEY.DEFAULT_INTERVAL_MS).toBe(1000);
            expect(Constants.AUTO_KEY.MIN_INTERVAL_MS).toBe(100);
            expect(Constants.AUTO_KEY.MAX_INTERVAL_MS).toBe(60000);
            expect(Constants.AUTO_KEY.MAX_KEYS_PER_MINUTE).toBe(600);
        });

        test('should match values used in UIManager', () => {
            expect(Constants.UI.DEFAULT_TIMEOUT_MS).toBe(1000);
            expect(Constants.UI.EXTENDED_TIMEOUT_MS).toBe(2000);
            expect(Constants.UI.MAX_RETRIES).toBe(3);
        });

        test('should match security values', () => {
            expect(Constants.SECURITY.MAX_LENGTHS.CHARACTER_NAME).toBe(50);
            expect(Constants.SECURITY.MAX_LENGTHS.WINDOW_TITLE).toBe(200);
            expect(Constants.SECURITY.MAX_LENGTHS.SHORTCUT).toBe(30);
        });
    });
});