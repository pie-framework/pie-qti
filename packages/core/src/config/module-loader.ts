/**
 * Configured Module Loader
 * Shared machinery behind loadPlugin() and the vendor extension loader.
 */

/**
 * The shape every config-driven module entry shares (PluginConfig and
 * VendorExtensionModuleConfig are structurally this).
 */
export interface ConfiguredModuleConfig {
	/** NPM package or file path to the module */
	module: string;

	/** Named export from the module (if not default export) */
	export?: string;

	/** Constructor options to pass to the instantiated class */
	options?: Record<string, unknown>;
}

/**
 * Dynamically import a configured module, pick its export, and instantiate it.
 * `kind` names the consumer in the error message ("plugin", "vendor extension").
 */
export async function loadConfiguredModule<T = unknown>(
	config: ConfiguredModuleConfig,
	kind: string,
): Promise<T> {
	try {
		// Dynamic import of the module (Vite cannot statically analyze this)
		const module = await import(/* @vite-ignore */ config.module);

		// Get the export (default or named)
		const exportName = config.export || 'default';
		const ModuleClass = module[exportName];

		if (!ModuleClass) {
			throw new Error(
				`Export "${exportName}" not found in module ${config.module}`,
			);
		}

		// Instantiate with options
		const instance = new ModuleClass(config.options || {});
		return instance as T;
	} catch (error) {
		throw new Error(
			`Failed to load ${kind} from ${config.module}: ${(error as Error).message}`,
		);
	}
}
