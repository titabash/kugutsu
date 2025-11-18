/**
 * ConfigurationManager
 *
 * Manages configuration file loading and environment variable management
 */
import fs from 'fs';
import path from 'path';
/**
 * Default configuration values
 */
const DEFAULT_CONFIG = {
    provider: 'claude',
    claude: {
        model: 'claude-sonnet-4-5-20250929',
    },
    codex: {
        model: 'gpt-5-codex',
    },
    parallelDev: {
        maxEngineers: 3,
        maxTurns: 50,
        baseBranch: 'main',
        worktreeBasePath: './worktrees',
        cleanup: false,
    },
    ui: {
        mode: 'electron',
    },
};
/**
 * ConfigurationManager class
 *
 * Handles loading and managing configuration from files and environment variables
 */
export class ConfigurationManager {
    projectPath;
    cachedConfig = null;
    /**
     * Create a new ConfigurationManager
     *
     * @param projectPath - Path to the project root
     */
    constructor(projectPath) {
        this.projectPath = projectPath;
    }
    /**
     * Load configuration from file and environment variables
     *
     * @returns Loaded and validated configuration
     */
    async loadConfig() {
        const configPath = this.resolveConfigPath();
        // Start with default config
        let config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
        // Try to load from file
        if (fs.existsSync(configPath)) {
            try {
                const fileContent = fs.readFileSync(configPath, 'utf-8');
                const fileConfig = JSON.parse(fileContent);
                // Merge file config with defaults
                config = this.mergeConfig(config, fileConfig);
            }
            catch (error) {
                console.warn(`⚠️ Failed to load config from ${configPath}:`, error);
                // Continue with default config
            }
        }
        // Apply environment variable overrides
        config = this.applyEnvironmentOverrides(config);
        // Validate configuration
        config = this.validateConfig(config);
        // Cache the config
        this.cachedConfig = config;
        return config;
    }
    /**
     * Get cached configuration, or load if not cached
     *
     * @param forceReload - Force reload from file instead of using cache
     * @returns Configuration object
     */
    async getConfig(forceReload = false) {
        if (forceReload || !this.cachedConfig) {
            return await this.loadConfig();
        }
        return this.cachedConfig;
    }
    /**
     * Get a specific configuration value by path
     *
     * @param path - Dot-separated path to the config value (e.g., 'claude.model')
     * @param defaultValue - Default value if path not found
     * @returns Configuration value or default
     */
    get(path, defaultValue) {
        if (!this.cachedConfig) {
            throw new Error('Configuration not loaded. Call loadConfig() first.');
        }
        const parts = path.split('.');
        let current = this.cachedConfig;
        for (const part of parts) {
            if (current && typeof current === 'object' && part in current) {
                current = current[part];
            }
            else {
                return defaultValue;
            }
        }
        return current;
    }
    /**
     * Get provider-specific configuration
     *
     * @param provider - Provider name ('claude' or 'codex')
     * @returns Provider configuration or undefined
     */
    getProviderConfig(provider) {
        if (!this.cachedConfig) {
            throw new Error('Configuration not loaded. Call loadConfig() first.');
        }
        return this.cachedConfig[provider];
    }
    /**
     * Resolve the configuration file path
     *
     * @returns Absolute path to config file
     */
    resolveConfigPath() {
        return path.join(this.projectPath, '.kugutsu', 'config.json');
    }
    /**
     * Merge file configuration with base configuration
     *
     * @param base - Base configuration
     * @param override - Override configuration
     * @returns Merged configuration
     */
    mergeConfig(base, override) {
        return {
            provider: override.provider || base.provider,
            claude: {
                ...base.claude,
                ...override.claude,
            },
            codex: {
                ...base.codex,
                ...override.codex,
            },
            parallelDev: {
                ...base.parallelDev,
                ...override.parallelDev,
            },
            ui: {
                ...base.ui,
                ...override.ui,
            },
        };
    }
    /**
     * Apply environment variable overrides
     *
     * Environment variables:
     * - ANTHROPIC_API_KEY: Overrides claude.apiKey
     * - OPENAI_API_KEY: Overrides codex.apiKey
     * - KUGUTSU_PROVIDER: Overrides provider
     * - KUGUTSU_MAX_ENGINEERS: Overrides parallelDev.maxEngineers
     * - KUGUTSU_MAX_TURNS: Overrides parallelDev.maxTurns
     * - KUGUTSU_BASE_BRANCH: Overrides parallelDev.baseBranch
     * - KUGUTSU_UI_MODE: Overrides ui.mode
     *
     * @param config - Base configuration
     * @returns Configuration with environment overrides
     */
    applyEnvironmentOverrides(config) {
        const result = { ...config };
        // Provider overrides
        if (process.env.KUGUTSU_PROVIDER) {
            const provider = process.env.KUGUTSU_PROVIDER;
            if (provider === 'claude' || provider === 'codex') {
                result.provider = provider;
            }
        }
        // Claude API key
        if (process.env.ANTHROPIC_API_KEY) {
            result.claude = {
                ...result.claude,
                apiKey: process.env.ANTHROPIC_API_KEY,
            };
        }
        // Codex API key
        if (process.env.OPENAI_API_KEY) {
            result.codex = {
                ...result.codex,
                apiKey: process.env.OPENAI_API_KEY,
            };
        }
        // Parallel development settings
        if (process.env.KUGUTSU_MAX_ENGINEERS) {
            const maxEngineers = parseInt(process.env.KUGUTSU_MAX_ENGINEERS, 10);
            if (!isNaN(maxEngineers)) {
                result.parallelDev = {
                    ...result.parallelDev,
                    maxEngineers,
                };
            }
        }
        if (process.env.KUGUTSU_MAX_TURNS) {
            const maxTurns = parseInt(process.env.KUGUTSU_MAX_TURNS, 10);
            if (!isNaN(maxTurns)) {
                result.parallelDev = {
                    ...result.parallelDev,
                    maxTurns,
                };
            }
        }
        if (process.env.KUGUTSU_BASE_BRANCH) {
            result.parallelDev = {
                ...result.parallelDev,
                baseBranch: process.env.KUGUTSU_BASE_BRANCH,
            };
        }
        // UI mode
        if (process.env.KUGUTSU_UI_MODE) {
            const mode = process.env.KUGUTSU_UI_MODE;
            if (mode === 'electron' || mode === 'cli' || mode === 'visual') {
                result.ui = {
                    ...result.ui,
                    mode,
                };
            }
        }
        return result;
    }
    /**
     * Validate and sanitize configuration values
     *
     * @param config - Configuration to validate
     * @returns Validated configuration
     */
    validateConfig(config) {
        const result = { ...config };
        // Validate provider
        if (result.provider !== 'claude' && result.provider !== 'codex') {
            console.warn(`⚠️ Invalid provider: ${result.provider}. Using default: claude`);
            result.provider = 'claude';
        }
        // Validate parallelDev settings
        if (result.parallelDev) {
            // maxEngineers: 1-10
            if (result.parallelDev.maxEngineers !== undefined) {
                if (result.parallelDev.maxEngineers < 1) {
                    console.warn(`⚠️ maxEngineers ${result.parallelDev.maxEngineers} is too low. Setting to 1.`);
                    result.parallelDev.maxEngineers = 1;
                }
                else if (result.parallelDev.maxEngineers > 10) {
                    console.warn(`⚠️ maxEngineers ${result.parallelDev.maxEngineers} is too high. Setting to 10.`);
                    result.parallelDev.maxEngineers = 10;
                }
            }
            // maxTurns: 5-50
            if (result.parallelDev.maxTurns !== undefined) {
                if (result.parallelDev.maxTurns < 5) {
                    console.warn(`⚠️ maxTurns ${result.parallelDev.maxTurns} is too low. Setting to 5.`);
                    result.parallelDev.maxTurns = 5;
                }
                else if (result.parallelDev.maxTurns > 50) {
                    console.warn(`⚠️ maxTurns ${result.parallelDev.maxTurns} is too high. Setting to 50.`);
                    result.parallelDev.maxTurns = 50;
                }
            }
        }
        // Validate UI mode
        if (result.ui?.mode) {
            const validModes = ['electron', 'cli', 'visual'];
            if (!validModes.includes(result.ui.mode)) {
                console.warn(`⚠️ Invalid UI mode: ${result.ui.mode}. Using default: electron`);
                result.ui.mode = 'electron';
            }
        }
        return result;
    }
}
/**
 * Global configuration manager instance
 */
let globalConfigManager = null;
/**
 * Get or create global configuration manager
 *
 * @param projectPath - Project root path (required for first call)
 * @returns Global configuration manager instance
 */
export function getConfigManager(projectPath) {
    if (!globalConfigManager) {
        if (!projectPath) {
            throw new Error('projectPath is required for first call to getConfigManager');
        }
        globalConfigManager = new ConfigurationManager(projectPath);
    }
    return globalConfigManager;
}
/**
 * Reset global configuration manager (for testing)
 */
export function resetConfigManager() {
    globalConfigManager = null;
}
//# sourceMappingURL=ConfigurationManager.js.map