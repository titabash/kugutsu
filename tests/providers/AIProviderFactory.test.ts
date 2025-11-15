/**
 * AIProviderFactory Unit Tests (Jest)
 */

import { AIProviderFactory } from '../../src/providers/AIProviderFactory.js';
import { MockAIProvider } from '../../src/providers/MockAIProvider.js';
import { FallbackAIProvider } from '../../src/providers/FallbackAIProvider.js';

describe('AIProviderFactory', () => {
  describe('Basic provider creation', () => {
    test('should create mock provider', () => {
      const provider = AIProviderFactory.create({ provider: 'mock' });
      expect(provider).toBeDefined();
      expect(provider).toBeInstanceOf(MockAIProvider);
      expect(provider.getProviderName()).toBe('mock');
    });

    test('should throw for unsupported provider', () => {
      expect(() => {
        AIProviderFactory.create({ provider: 'unsupported' as any });
      }).toThrow();
    });

    test('should return supported providers list', () => {
      const providers = AIProviderFactory.getSupportedProviders();
      expect(Array.isArray(providers)).toBe(true);
      expect(providers).toContain('claude');
      expect(providers).toContain('codex');
      expect(providers).toContain('mock');
    });

    test('should check provider support', () => {
      expect(AIProviderFactory.isProviderSupported('claude')).toBe(true);
      expect(AIProviderFactory.isProviderSupported('codex')).toBe(true);
      expect(AIProviderFactory.isProviderSupported('mock')).toBe(true);
      expect(AIProviderFactory.isProviderSupported('unsupported')).toBe(false);
    });
  });

  describe('Fallback integration', () => {
    test('should create provider with fallback by default (claude)', () => {
      const config = AIProviderFactory.buildProviderConfig({
        provider: 'claude',
      });
      const provider = AIProviderFactory.create(config);

      expect(provider).toBeDefined();
      expect(provider).toBeInstanceOf(FallbackAIProvider);
      expect(provider.getProviderName()).toContain('with-fallback');
    });

    test('should create provider with fallback by default (codex)', () => {
      const config = AIProviderFactory.buildProviderConfig({
        provider: 'codex',
      });
      const provider = AIProviderFactory.create(config);

      expect(provider).toBeDefined();
      expect(provider).toBeInstanceOf(FallbackAIProvider);
      expect(provider.getProviderName()).toContain('with-fallback');
    });

    test('should create provider without fallback when disabled', () => {
      const config = AIProviderFactory.buildProviderConfig({
        provider: 'claude',
      });
      const provider = AIProviderFactory.create(config, false);

      expect(provider).toBeDefined();
      expect(provider.getProviderName()).toBe('claude');
    });

    test('should not create fallback for mock provider', () => {
      const provider = AIProviderFactory.create({ provider: 'mock' });

      expect(provider).toBeDefined();
      expect(provider).toBeInstanceOf(MockAIProvider);
      expect(provider.getProviderName()).toBe('mock');
    });
  });

  describe('getFallbackProviderConfig', () => {
    test('should return codex config for claude', () => {
      const claudeConfig = AIProviderFactory.buildProviderConfig({
        provider: 'claude',
      });
      const fallbackConfig =
        AIProviderFactory.getFallbackProviderConfig(claudeConfig);

      expect(fallbackConfig).not.toBeNull();
      expect(fallbackConfig?.provider).toBe('codex');
    });

    test('should return claude config for codex', () => {
      const codexConfig = AIProviderFactory.buildProviderConfig({
        provider: 'codex',
      });
      const fallbackConfig =
        AIProviderFactory.getFallbackProviderConfig(codexConfig);

      expect(fallbackConfig).not.toBeNull();
      expect(fallbackConfig?.provider).toBe('claude');
    });

    test('should return null for mock provider', () => {
      const mockConfig = AIProviderFactory.buildProviderConfig({
        provider: 'mock',
      });
      const fallbackConfig =
        AIProviderFactory.getFallbackProviderConfig(mockConfig);

      expect(fallbackConfig).toBeNull();
    });
  });

  describe('buildProviderConfig', () => {
    test('should build claude config with defaults', () => {
      const config = AIProviderFactory.buildProviderConfig({
        provider: 'claude',
      });

      expect(config.provider).toBe('claude');
      expect(config.claude).toBeDefined();
    });

    test('should build codex config with defaults', () => {
      const config = AIProviderFactory.buildProviderConfig({
        provider: 'codex',
      });

      expect(config.provider).toBe('codex');
      expect(config.codex).toBeDefined();
    });
  });

  describe('Failed provider management', () => {
    beforeEach(() => {
      // Reset failed providers before each test
      AIProviderFactory.syncWithState([]);
    });

    test('should sync with empty state', () => {
      AIProviderFactory.syncWithState([]);
      const failedProviders = AIProviderFactory.getFailedProviders();
      expect(failedProviders).toEqual([]);
    });

    test('should sync with state containing failed providers', () => {
      AIProviderFactory.syncWithState(['codex']);
      const failedProviders = AIProviderFactory.getFailedProviders();
      expect(failedProviders).toEqual(['codex']);
    });

    test('should record provider failure', () => {
      AIProviderFactory.recordFailure('codex');
      const failedProviders = AIProviderFactory.getFailedProviders();
      expect(failedProviders).toContain('codex');
    });

    test('should not duplicate failed providers', () => {
      AIProviderFactory.recordFailure('codex');
      AIProviderFactory.recordFailure('codex');
      const failedProviders = AIProviderFactory.getFailedProviders();
      expect(failedProviders).toEqual(['codex']);
    });

    test('should record multiple provider failures', () => {
      AIProviderFactory.recordFailure('codex');
      AIProviderFactory.recordFailure('claude');
      const failedProviders = AIProviderFactory.getFailedProviders();
      expect(failedProviders).toContain('codex');
      expect(failedProviders).toContain('claude');
      expect(failedProviders.length).toBe(2);
    });

    test('should skip failed provider and use fallback', () => {
      AIProviderFactory.syncWithState(['codex']);

      const config = AIProviderFactory.buildProviderConfig({
        provider: 'codex',
      });
      const provider = AIProviderFactory.create(config);

      // Should create Claude (fallback) instead of Codex
      expect(provider).toBeDefined();
      expect(provider.getProviderName()).toContain('claude');
    });

    test('should throw error when both provider and fallback have failed', () => {
      AIProviderFactory.syncWithState(['codex', 'claude']);

      const config = AIProviderFactory.buildProviderConfig({
        provider: 'codex',
      });

      // Should throw error when both providers are unavailable
      expect(() => AIProviderFactory.create(config)).toThrow(/使用不可です.*利用できません/);
    });

    test('should persist failed providers across create calls', () => {
      AIProviderFactory.syncWithState(['codex']);

      // First create
      const config1 = AIProviderFactory.buildProviderConfig({
        provider: 'codex',
      });
      AIProviderFactory.create(config1);

      // Second create should still skip codex
      const config2 = AIProviderFactory.buildProviderConfig({
        provider: 'codex',
      });
      const provider2 = AIProviderFactory.create(config2);

      expect(provider2.getProviderName()).toContain('claude');
    });

    test('should clear failed providers when syncing with empty state', () => {
      AIProviderFactory.recordFailure('codex');
      expect(AIProviderFactory.getFailedProviders()).toContain('codex');

      AIProviderFactory.syncWithState([]);
      expect(AIProviderFactory.getFailedProviders()).toEqual([]);
    });
  });
});
