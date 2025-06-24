const WindowParser = require('../src/services/WindowManagerWindows/WindowParser');

describe('WindowParser JSON Parsing Safety', () => {
    let windowParser;

    // Create a mock object with the required getPath method
    const mockDependency = {
        getPath: jest.fn().mockReturnValue('some/path')
    };

    beforeEach(() => {
        windowParser = new WindowParser(mockDependency);
    });

    describe('safeJsonParse', () => {
        test('should parse valid JSON correctly', () => {
            const validJson = '{"test": "value", "number": 123}';
            const result = windowParser.safeJsonParse(validJson);

            expect(result.success).toBe(true);
            expect(result.data).toEqual({ test: 'value', number: 123 });
            expect(result.error).toBeNull();
        });

        test('should handle invalid JSON gracefully', () => {
            const invalidJson = '{"test": "value", "incomplete":';
            const result = windowParser.safeJsonParse(invalidJson);

            expect(result.success).toBe(false);
            expect(result.data).toBeNull();
            expect(result.error).toContain('JSON parsing failed');
        });

        test('should handle null input', () => {
            const result = windowParser.safeJsonParse(null);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Input is not a string');
        });

        test('should handle empty string', () => {
            const result = windowParser.safeJsonParse('');

            expect(result.success).toBe(false);
            expect(result.error).toContain('Empty JSON string');
        });

        test('should handle oversized JSON', () => {
            const largeJson = '{"data": "' + 'x'.repeat(2 * 1024 * 1024) + '"}';
            const result = windowParser.safeJsonParse(largeJson);

            expect(result.success).toBe(false);
            expect(result.error).toContain('JSON string too large');
        });

        test('should sanitize and parse malformed JSON', () => {
            const malformedJson = "{test: 'value', number: 123,}";
            const result = windowParser.safeJsonParse(malformedJson);

            expect(result.success).toBe(true);
            expect(result.data.test).toBe('value');
            expect(result.data.number).toBe(123);
        });

        test('should handle JSON with control characters', () => {
            const jsonWithControl = '{"test": "value\x00\x08", "clean": "data"}';
            const result = windowParser.safeJsonParse(jsonWithControl);

            expect(result.success).toBe(true);
            expect(result.data.clean).toBe('data');
        });

        test('should validate data types', () => {
            const jsonWithFunction = '{"test": function() { return "bad"; }}';
            const result = windowParser.safeJsonParse(jsonWithFunction, {
                allowedTypes: ['object', 'string', 'number']
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Invalid JSON structure');
        });

        test('should enforce depth limits', () => {
            const deepJson = JSON.stringify({
                level1: {
                    level2: {
                        level3: {
                            level4: {
                                level5: {
                                    level6: 'too deep'
                                }
                            }
                        }
                    }
                }
            });

            const result = windowParser.safeJsonParse(deepJson, { maxDepth: 3 });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Maximum nesting depth exceeded');
        });
    });

    describe('JSON Recovery Strategies', () => {
        test('should recover from trailing commas', () => {
            const jsonWithTrailingComma = '{"test": "value", "number": 123,}';
            const result = windowParser.attemptJsonRecovery(jsonWithTrailingComma);

            expect(result.success).toBe(true);
            expect(result.data.test).toBe('value');
        });

        test('should recover from unquoted property names', () => {
            const jsonWithUnquoted = '{test: "value", number: 123}';
            const result = windowParser.attemptJsonRecovery(jsonWithUnquoted);

            expect(result.success).toBe(true);
            expect(result.data.test).toBe('value');
        });

        test('should use fallback for completely broken JSON', () => {
            const brokenJson = 'completely broken {not json at all';
            const result = windowParser.attemptJsonRecovery(brokenJson);

            expect(result.success).toBe(true);
            expect(Array.isArray(result.data) || typeof result.data === 'object').toBe(true);
        });
    });

    describe('Window Data JSON Parsing', () => {
        test('should parse valid window data', () => {
            const windowDataJson = JSON.stringify([
                { Handle: '12345', Title: 'Test - Feca - 2.70 - Release' },
                { Handle: '67890', Title: 'Player - Iop - 2.70 - Release' }
            ]);

            const result = windowParser.parseWindowDataJson(windowDataJson);

            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(2);
            expect(result[0].Handle).toBe('12345');
        });

        test('should handle single object as array', () => {
            const windowDataJson = JSON.stringify(
                { Handle: '12345', Title: 'Test - Feca - 2.70 - Release' }
            );

            const result = windowParser.parseWindowDataJson(windowDataJson);

            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(1);
            expect(result[0].Handle).toBe('12345');
        });

        test('should return empty array for invalid JSON', () => {
            const invalidJson = 'invalid window data';
            const result = windowParser.parseWindowDataJson(invalidJson);

            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(0);
        });
    });

    describe('Configuration JSON Parsing', () => {
        test('should parse valid configuration', () => {
            const configJson = JSON.stringify({
                parsingEnabled: true,
                strictMode: false,
                customClass: 'feca'
            });

            const result = windowParser.parseConfigurationJson(configJson);

            expect(result.parsingEnabled).toBe(true);
            expect(result.strictMode).toBe(false);
            expect(result.customClass).toBe('feca');
        });

        test('should return default config for invalid JSON', () => {
            const invalidConfig = 'invalid config json';
            const result = windowParser.parseConfigurationJson(invalidConfig);

            expect(result.parsingEnabled).toBe(true);
            expect(result.fallbackCharacterName).toBe('Unknown');
            expect(result.fallbackClass).toBe('feca');
        });
    });

    describe('Edge Cases and Error Scenarios', () => {
        test('should handle JSON with BOM', () => {
            const jsonWithBOM = '\uFEFF{"test": "value"}';
            const result = windowParser.safeJsonParse(jsonWithBOM);

            expect(result.success).toBe(true);
            expect(result.data.test).toBe('value');
        });

        test('should handle mixed quote types', () => {
            const mixedQuotes = `{"test": 'value', 'property': "data"}`;
            const result = windowParser.safeJsonParse(mixedQuotes);

            expect(result.success).toBe(true);
            expect(result.data.test).toBe('value');
            expect(result.data.property).toBe('data');
        });

        test('should handle Windows file paths', () => {
            const windowsPaths = '{"path": "C:\\\\Users\\\\test\\\\file.txt"}';
            const result = windowParser.safeJsonParse(windowsPaths);

            expect(result.success).toBe(true);
            expect(result.data.path).toContain('C:');
        });

        test('should handle concurrent parsing calls', async () => {
            const jsonString = '{"test": "concurrent", "number": 456}';

            const promises = Array.from({ length: 10 }, () =>
                Promise.resolve(windowParser.safeJsonParse(jsonString))
            );

            const results = await Promise.all(promises);

            results.forEach(result => {
                expect(result.success).toBe(true);
                expect(result.data.test).toBe('concurrent');
            });
        });
    });
});