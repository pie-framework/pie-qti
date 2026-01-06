/**
 * Plugin Registry
 *
 * Central registry for managing transformation plugins
 */

import type {
  TransformFormat,
  TransformInput,
  TransformPlugin,
} from '@pie-framework/transform-types';

export class PluginRegistry {
  private plugins = new Map<string, TransformPlugin>();

  /**
   * Register a plugin
   */
  register(plugin: TransformPlugin): void {
    if (this.plugins.has(plugin.id)) {
      throw new Error(`Plugin with id '${plugin.id}' is already registered`);
    }

    this.plugins.set(plugin.id, plugin);
  }

  /**
   * Unregister a plugin
   */
  unregister(pluginId: string): boolean {
    return this.plugins.delete(pluginId);
  }

  /**
   * Get a plugin by ID
   */
  get(pluginId: string): TransformPlugin | undefined {
    return this.plugins.get(pluginId);
  }

  /**
   * Check if a plugin is registered
   */
  has(pluginId: string): boolean {
    return this.plugins.has(pluginId);
  }

  /**
   * Get all registered plugins
   */
  getAll(): TransformPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Find plugin that can handle transformation from source to target format
   */
  findPlugin(
    sourceFormat: TransformFormat,
    targetFormat: TransformFormat
  ): TransformPlugin | undefined {
    return Array.from(this.plugins.values()).find(
      (plugin) =>
        plugin.sourceFormat === sourceFormat &&
        plugin.targetFormat === targetFormat
    );
  }

  /**
   * Find plugins that can handle the given input
   */
  async findCompatiblePlugins(input: TransformInput): Promise<TransformPlugin[]> {
    const compatible: TransformPlugin[] = [];

    for (const plugin of this.plugins.values()) {
      const canHandle = await plugin.canHandle(input);
      if (canHandle) {
        compatible.push(plugin);
      }
    }

    return compatible;
  }

  /**
   * Get plugins by source format
   */
  getBySourceFormat(format: TransformFormat): TransformPlugin[] {
    return Array.from(this.plugins.values()).filter(
      (plugin) => plugin.sourceFormat === format
    );
  }

  /**
   * Get plugins by target format
   */
  getByTargetFormat(format: TransformFormat): TransformPlugin[] {
    return Array.from(this.plugins.values()).filter(
      (plugin) => plugin.targetFormat === format
    );
  }

  /**
   * Clear all registered plugins
   */
  clear(): void {
    this.plugins.clear();
  }

  /**
   * Get count of registered plugins
   */
  get size(): number {
    return this.plugins.size;
  }
}
