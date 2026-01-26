/**
 * Plugin Manager
 *
 * Manages plugin registration, dependency resolution, and lifecycle.
 */

import type {
	PluginContext,
	QTIPlugin,
	RenderContext
} from './Plugin.js';

export class PluginManager {
	private plugins = new Map<string, QTIPlugin>();
	private initialized = new Set<string>();

	/**
	 * Register a plugin
	 * @throws Error if plugin is invalid or dependencies are missing
	 */
	async register(plugin: QTIPlugin, context: PluginContext): Promise<void> {
		// Validate plugin
		this.validatePlugin(plugin);

		// Check if already registered
		if (this.plugins.has(plugin.name)) {
			throw new Error(`Plugin '${plugin.name}' is already registered`);
		}

		// Check dependencies
		await this.checkDependencies(plugin);

		// Store plugin
		this.plugins.set(plugin.name, plugin);

		// Call lifecycle hook
		try {
			await plugin.lifecycle?.onRegister?.(context);
			this.initialized.add(plugin.name);
		} catch (error) {
			// Rollback on error
			this.plugins.delete(plugin.name);
			throw new Error(
				`Failed to initialize plugin '${plugin.name}': ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}

	/**
	 * Unregister a plugin
	 */
	async unregister(pluginName: string): Promise<void> {
		const plugin = this.plugins.get(pluginName);
		if (!plugin) return;

		try {
			// Call lifecycle hook
			await plugin.lifecycle?.onUnregister?.();
		} finally {
			// Remove plugin even if hook fails
			this.plugins.delete(pluginName);
			this.initialized.delete(pluginName);
		}
	}

	/**
	 * Get all registered plugins
	 */
	getAll(): QTIPlugin[] {
		return Array.from(this.plugins.values());
	}

	/**
	 * Get plugin by name
	 */
	get(name: string): QTIPlugin | undefined {
		return this.plugins.get(name);
	}

	/**
	 * Check if plugin is registered
	 */
	has(name: string): boolean {
		return this.plugins.has(name);
	}

	/**
	 * Check if plugin is initialized
	 */
	isInitialized(name: string): boolean {
		return this.initialized.has(name);
	}

	// Legacy getRendererRegistrations() method removed
	// Plugins now register components via ComponentRegistry instead

	/**
	 * Call onBeforeRender hooks for all plugins
	 */
	async callBeforeRenderHooks(context: RenderContext): Promise<void> {
		for (const plugin of this.plugins.values()) {
			try {
				await plugin.lifecycle?.onBeforeRender?.(context);
			} catch (error) {
				console.error(
					`Plugin '${plugin.name}' onBeforeRender hook failed:`,
					error
				);
			}
		}
	}

	/**
	 * Call onAfterRender hooks for all plugins
	 */
	async callAfterRenderHooks(context: RenderContext): Promise<void> {
		for (const plugin of this.plugins.values()) {
			try {
				await plugin.lifecycle?.onAfterRender?.(context);
			} catch (error) {
				console.error(
					`Plugin '${plugin.name}' onAfterRender hook failed:`,
					error
				);
			}
		}
	}

	/**
	 * Validate plugin structure
	 */
	private validatePlugin(plugin: QTIPlugin): void {
		if (!plugin.name || typeof plugin.name !== 'string') {
			throw new Error('Plugin must have a valid name');
		}

		if (!plugin.version || typeof plugin.version !== 'string') {
			throw new Error(`Plugin '${plugin.name}' must have a valid version`);
		}

		// Validate semantic version format (basic check)
		if (!/^\d+\.\d+\.\d+/.test(plugin.version)) {
			throw new Error(
				`Plugin '${plugin.name}' has invalid version format: ${plugin.version}`
			);
		}
	}

	/**
	 * Check if plugin dependencies are satisfied
	 */
	private async checkDependencies(plugin: QTIPlugin): Promise<void> {
		if (!plugin.dependencies || plugin.dependencies.length === 0) {
			return;
		}

		const missing: string[] = [];

		for (const dep of plugin.dependencies) {
			if (!this.plugins.has(dep)) {
				missing.push(dep);
			}
		}

		if (missing.length > 0) {
			throw new Error(
				`Plugin '${plugin.name}' has missing dependencies: ${missing.join(', ')}`
			);
		}
	}

	/**
	 * Clear all plugins
	 */
	async clear(): Promise<void> {
		const plugins = Array.from(this.plugins.keys());

		for (const pluginName of plugins) {
			await this.unregister(pluginName);
		}
	}
}
