/**
 * LocalizedErrorMessages - Utility to provide localized error messages
 * Provides consistent error translations across the application
 */

const { logger } = require('./Logger');
const LanguageManager = require('../services/LanguageManager');

class LocalizedErrorMessages {
    constructor() {
        try {
            this.languageManager = new LanguageManager();
        } catch (error) {
            logger.error('Failed to initialize LanguageManager in LocalizedErrorMessages', { error: error.message });
            // Create a fallback
            this.languageManager = {
                translate: (key, ...args) => {
                    let text = key;
                    args.forEach((arg, index) => {
                        text = text.replace(new RegExp(`\\{${index}\\}`, 'g'), arg);
                    });
                    return text;
                }
            };
        }
    }

    /**
     * Get a localized error message
     * @param {string} key - The translation key
     * @param  {...any} args - Arguments for the translation
     * @returns {string} - The localized message
     */
    getMessage(key, ...args) {
        return this.languageManager.translate(key, ...args);
    }

    /**
     * Simplify an error message using localized translations
     * @param {string} message - The error message to simplify
     * @returns {string} - The simplified localized message
     */
    simplifyErrorMessage(message) {
        // Common error message simplifications with translation keys
        const simplifications = {
            'ENOENT': ['error_file_not_found', message],
            'EACCES': ['error_permission_denied', message],
            'ETIMEDOUT': ['error_operation_timeout', message],
            'ECONNREFUSED': ['error_connection_failed', message],
            'Cannot read property': ['error_invalid_format', message],
            'Cannot read properties': ['error_invalid_format', message],
            'fetch failed': ['error_connection_failed', message],
            'JSON.parse': ['error_invalid_format', message]
        };

        for (const [pattern, [translationKey, param]] of Object.entries(simplifications)) {
            if (message.includes(pattern)) {
                return this.languageManager.translate(translationKey, param);
            }
        }

        // If no simplification found, use generic error translation
        const truncatedMessage = message.length > 100 ? message.substring(0, 100) + '...' : message;
        return this.languageManager.translate('error_unknown', truncatedMessage);
    }

    /**
     * Get singleton instance
     * @returns {LocalizedErrorMessages}
     */
    static getInstance() {
        if (!LocalizedErrorMessages.instance) {
            LocalizedErrorMessages.instance = new LocalizedErrorMessages();
        }
        return LocalizedErrorMessages.instance;
    }
}

module.exports = {
    localizedErrors: LocalizedErrorMessages.getInstance(),
    LocalizedErrorMessages
};
