/**
 * Plugin Registry Tests
 */

import { beforeEach, describe, expect, test } from 'bun:test';
import type { TransformPlugin } from '@pie-framework/transform-types';
import { PluginRegistry } from '../src/registry/plugin-registry';

// Simple mock plugins
const createMockPlugin = (
  id: string,
  sourceFormat: 'qti22' | 'pie',
  targetFormat: 'pie' | 'qti22'
): TransformPlugin => ({
  id,
  version: '1.0.0',
  name: `Mock ${id}`,
  sourceFormat,
  targetFormat,
  async canHandle() { return true; },
  async transform() {
    return {
      items: [],
      format: targetFormat,
      metadata: {
        sourceFormat,
        targetFormat,
        pluginId: id,
        timestamp: new Date(),
        itemCount: 0,
        processingTime: 0,
      },
    };
  },
});

describe('PluginRegistry', () => {
  let registry: PluginRegistry;

  beforeEach(() => {
    registry = new PluginRegistry();
  });

  test('should register a plugin', () => {
    const plugin = createMockPlugin('test-plugin', 'qti22', 'pie');
    registry.register(plugin);

    expect(registry.has('test-plugin')).toBe(true);
    expect(registry.size).toBe(1);
  });

  test('should throw error when registering duplicate plugin', () => {
    const plugin = createMockPlugin('test-plugin', 'qti22', 'pie');
    registry.register(plugin);

    expect(() => registry.register(plugin)).toThrow('already registered');
  });

  test('should unregister a plugin', () => {
    const plugin = createMockPlugin('test-plugin', 'qti22', 'pie');
    registry.register(plugin);

    const removed = registry.unregister('test-plugin');
    expect(removed).toBe(true);
    expect(registry.has('test-plugin')).toBe(false);
    expect(registry.size).toBe(0);
  });

  test('should get plugin by id', () => {
    const plugin = createMockPlugin('test-plugin', 'qti22', 'pie');
    registry.register(plugin);

    const found = registry.get('test-plugin');
    expect(found).toBeDefined();
    expect(found?.id).toBe('test-plugin');
  });

  test('should get all plugins', () => {
    const plugin1 = createMockPlugin('plugin-1', 'qti22', 'pie');
    const plugin2 = createMockPlugin('plugin-2', 'pie', 'qti22');

    registry.register(plugin1);
    registry.register(plugin2);

    const all = registry.getAll();
    expect(all.length).toBe(2);
  });

  test('should find plugin by source and target format', () => {
    const plugin1 = createMockPlugin('qti22-to-pie', 'qti22', 'pie');
    const plugin2 = createMockPlugin('pie-to-qti22', 'pie', 'qti22');

    registry.register(plugin1);
    registry.register(plugin2);

    const found = registry.findPlugin('qti22', 'pie');
    expect(found).toBeDefined();
    expect(found?.id).toBe('qti22-to-pie');
  });

  test('should get plugins by source format', () => {
    const plugin1 = createMockPlugin('qti22-to-pie', 'qti22', 'pie');
    const plugin2 = createMockPlugin('pie-to-qti22', 'pie', 'qti22');

    registry.register(plugin1);
    registry.register(plugin2);

    const qtiPlugins = registry.getBySourceFormat('qti22');
    expect(qtiPlugins.length).toBe(1);
    expect(qtiPlugins[0].id).toBe('qti22-to-pie');
  });

  test('should get plugins by target format', () => {
    const plugin1 = createMockPlugin('qti22-to-pie', 'qti22', 'pie');
    const plugin2 = createMockPlugin('pie-to-qti22', 'pie', 'qti22');

    registry.register(plugin1);
    registry.register(plugin2);

    const piePlugins = registry.getByTargetFormat('pie');
    expect(piePlugins.length).toBe(1);
  });

  test('should find compatible plugins', async () => {
    const plugin1 = createMockPlugin('plugin-1', 'qti22', 'pie');
    const plugin2 = createMockPlugin('plugin-2', 'pie', 'qti22');

    // Override canHandle for plugin2 to return false
    plugin2.canHandle = async () => false;

    registry.register(plugin1);
    registry.register(plugin2);

    const compatible = await registry.findCompatiblePlugins({
      content: '<assessmentItem></assessmentItem>',
    });

    expect(compatible.length).toBe(1);
    expect(compatible[0].id).toBe('plugin-1');
  });

  test('should clear all plugins', () => {
    const plugin1 = createMockPlugin('plugin-1', 'qti22', 'pie');
    const plugin2 = createMockPlugin('plugin-2', 'pie', 'qti22');

    registry.register(plugin1);
    registry.register(plugin2);
    expect(registry.size).toBe(2);

    registry.clear();
    expect(registry.size).toBe(0);
    expect(registry.getAll().length).toBe(0);
  });
});
