/**
 * AIProviderFactory Unit Tests (Jest)
 */

import { AIProviderFactory } from '../../src/providers/AIProviderFactory.js';
import { MockAIProvider } from '../../src/providers/MockAIProvider.js';

describe('AIProviderFactory', () => {
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
    expect(providers).toContain('mock');
  });

  test('should check provider support', () => {
    expect(AIProviderFactory.isProviderSupported('claude')).toBe(true);
    expect(AIProviderFactory.isProviderSupported('mock')).toBe(true);
    expect(AIProviderFactory.isProviderSupported('unsupported')).toBe(false);
  });
});
