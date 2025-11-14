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
});
