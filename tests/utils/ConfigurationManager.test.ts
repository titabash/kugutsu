/**
 * ConfigurationManager Test
 *
 * Tests configuration file loading and environment variable management
 */

import { jest } from '@jest/globals';

// Mock fs module BEFORE importing
const mockExistsSync = jest.fn<any>();
const mockReadFileSync = jest.fn<any>();

jest.unstable_mockModule('fs', () => ({
  default: {
    existsSync: mockExistsSync,
    readFileSync: mockReadFileSync,
  },
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
}));

// Import after mocking
const { ConfigurationManager } = await import('../../src/utils/ConfigurationManager.js');

describe('ConfigurationManager', () => {
  const mockConfigPath = '/test/project/.kugutsu/config.json';
  const mockConfig = {
    provider: 'claude',
    claude: {
      model: 'claude-sonnet-4-5-20250929',
      apiKey: 'config-api-key',
    },
    codex: {
      model: 'gpt-5-codex',
      apiKey: 'config-codex-key',
    },
    parallelDev: {
      maxEngineers: 3,
      maxTurns: 30,
      baseBranch: 'main',
      worktreeBasePath: './worktrees',
      cleanup: false,
    },
    ui: {
      mode: 'electron',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Clear environment variables
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.KUGUTSU_PROVIDER;
    delete process.env.KUGUTSU_MAX_ENGINEERS;
  });

  describe('loadConfig', () => {
    test('should load configuration from file', async () => {
      // Mock fs.existsSync to return true
      mockExistsSync.mockReturnValue(true);
      // Mock fs.readFileSync to return config
      mockReadFileSync.mockReturnValue(JSON.stringify(mockConfig));

      const manager = new ConfigurationManager('/test/project');
      const config = await manager.loadConfig();

      expect(config.provider).toBe('claude');
      expect(config.claude?.model).toBe('claude-sonnet-4-5-20250929');
      expect(config.parallelDev?.maxEngineers).toBe(3);
    });

    test('should return default config when file does not exist', async () => {
      // Mock fs.existsSync to return false
      mockExistsSync.mockReturnValue(false);

      const manager = new ConfigurationManager('/test/project');
      const config = await manager.loadConfig();

      // Should return default values
      expect(config.provider).toBe('claude');
      expect(config.parallelDev?.maxEngineers).toBe(3);
      expect(config.parallelDev?.maxTurns).toBe(30);
      expect(config.ui?.mode).toBe('electron');
    });

    test('should handle invalid JSON gracefully', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('invalid json {');

      const manager = new ConfigurationManager('/test/project');
      const config = await manager.loadConfig();

      // Should return default config on parse error
      expect(config.provider).toBe('claude');
    });
  });

  describe('environment variable override', () => {
    test('should override API key from environment', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockConfig));

      // Set environment variable
      process.env.ANTHROPIC_API_KEY = 'env-api-key';

      const manager = new ConfigurationManager('/test/project');
      const config = await manager.loadConfig();

      // Environment variable should take precedence
      expect(config.claude?.apiKey).toBe('env-api-key');
    });

    test('should override provider from environment', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockConfig));

      process.env.KUGUTSU_PROVIDER = 'codex';

      const manager = new ConfigurationManager('/test/project');
      const config = await manager.loadConfig();

      expect(config.provider).toBe('codex');
    });

    test('should override maxEngineers from environment', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockConfig));

      process.env.KUGUTSU_MAX_ENGINEERS = '5';

      const manager = new ConfigurationManager('/test/project');
      const config = await manager.loadConfig();

      expect(config.parallelDev?.maxEngineers).toBe(5);
    });
  });

  describe('getConfig', () => {
    test('should return cached config after initial load', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockConfig));

      const manager = new ConfigurationManager('/test/project');

      // First call loads from file
      const config1 = await manager.getConfig();
      expect(mockReadFileSync).toHaveBeenCalledTimes(1);

      // Second call uses cache
      const config2 = await manager.getConfig();
      expect(mockReadFileSync).toHaveBeenCalledTimes(1);

      expect(config1).toBe(config2);
    });

    test('should reload config when forceReload is true', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockConfig));

      const manager = new ConfigurationManager('/test/project');

      await manager.getConfig();
      expect(mockReadFileSync).toHaveBeenCalledTimes(1);

      // Force reload
      await manager.getConfig(true);
      expect(mockReadFileSync).toHaveBeenCalledTimes(2);
    });
  });

  describe('get', () => {
    test('should get specific config value by path', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockConfig));

      const manager = new ConfigurationManager('/test/project');
      await manager.loadConfig();

      expect(manager.get('provider')).toBe('claude');
      expect(manager.get('claude.model')).toBe('claude-sonnet-4-5-20250929');
      expect(manager.get('parallelDev.maxEngineers')).toBe(3);
      expect(manager.get('ui.mode')).toBe('electron');
    });

    test('should return undefined for non-existent path', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockConfig));

      const manager = new ConfigurationManager('/test/project');
      await manager.loadConfig();

      expect(manager.get('nonexistent')).toBeUndefined();
      expect(manager.get('claude.nonexistent')).toBeUndefined();
    });

    test('should return default value when path not found', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockConfig));

      const manager = new ConfigurationManager('/test/project');
      await manager.loadConfig();

      expect(manager.get('nonexistent', 'default')).toBe('default');
      expect(manager.get('claude.nonexistent', 'fallback')).toBe('fallback');
    });
  });

  describe('validation', () => {
    test('should validate maxEngineers range', async () => {
      const invalidConfig = {
        ...mockConfig,
        parallelDev: {
          ...mockConfig.parallelDev,
          maxEngineers: 15, // exceeds maximum of 10
        },
      };

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(invalidConfig));

      const manager = new ConfigurationManager('/test/project');
      const config = await manager.loadConfig();

      // Should clamp to maximum
      expect(config.parallelDev?.maxEngineers).toBe(10);
    });

    test('should validate maxTurns range', async () => {
      const invalidConfig = {
        ...mockConfig,
        parallelDev: {
          ...mockConfig.parallelDev,
          maxTurns: 100, // exceeds maximum of 50
        },
      };

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(invalidConfig));

      const manager = new ConfigurationManager('/test/project');
      const config = await manager.loadConfig();

      // Should clamp to maximum
      expect(config.parallelDev?.maxTurns).toBe(50);
    });

    test('should validate provider enum', async () => {
      const invalidConfig = {
        ...mockConfig,
        provider: 'invalid-provider',
      };

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(invalidConfig));

      const manager = new ConfigurationManager('/test/project');
      const config = await manager.loadConfig();

      // Should fall back to default
      expect(config.provider).toBe('claude');
    });
  });

  describe('resolveConfigPath', () => {
    test('should resolve config path correctly', () => {
      const manager = new ConfigurationManager('/test/project');
      const configPath = manager['resolveConfigPath']();

      expect(configPath).toContain('.kugutsu');
      expect(configPath).toContain('config.json');
    });
  });

  describe('getProviderConfig', () => {
    test('should get Claude provider config', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockConfig));

      const manager = new ConfigurationManager('/test/project');
      await manager.loadConfig();

      const claudeConfig = manager.getProviderConfig('claude');
      expect(claudeConfig?.model).toBe('claude-sonnet-4-5-20250929');
      expect(claudeConfig?.apiKey).toBe('config-api-key');
    });

    test('should get Codex provider config', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockConfig));

      const manager = new ConfigurationManager('/test/project');
      await manager.loadConfig();

      const codexConfig = manager.getProviderConfig('codex');
      expect(codexConfig?.model).toBe('gpt-5-codex');
      expect(codexConfig?.apiKey).toBe('config-codex-key');
    });

    test('should return undefined for invalid provider', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockConfig));

      const manager = new ConfigurationManager('/test/project');
      await manager.loadConfig();

      const invalidConfig = manager.getProviderConfig('invalid' as any);
      expect(invalidConfig).toBeUndefined();
    });
  });
});
