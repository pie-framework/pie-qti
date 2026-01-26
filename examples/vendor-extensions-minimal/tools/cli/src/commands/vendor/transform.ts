/**
 * Vendor Transform Command
 * Transform QTI with vendor-specific plugin
 */

import { Command, Flags, Args } from '@oclif/core';
import { readFileSync, writeFileSync } from 'node:fs';
import { TransformEngine } from '@pie-qti/transform-core';
import { QtiToPiePlugin } from '@pie-qti/to-pie';
import { ExampleCorpPlugin } from '@pie-qti-examples/vendor-examplecorp-plugin';

export default class VendorTransform extends Command {
	static description = 'Transform QTI file with vendor plugins';

	static examples = [
		'<%= config.bin %> <%= command.id %> input.xml',
		'<%= config.bin %> <%= command.id %> input.xml --output output.json',
		'<%= config.bin %> <%= command.id %> input.xml --vendor examplecorp'
	];

	static flags = {
		output: Flags.string({
			char: 'o',
			description: 'Output file path',
			required: false
		}),
		vendor: Flags.string({
			char: 'v',
			description: 'Force specific vendor (auto-detects if not specified)',
			required: false
		}),
		'show-priority': Flags.boolean({
			description: 'Show which plugin was used based on priority',
			default: false
		})
	};

	static args = {
		file: Args.string({
			description: 'Path to QTI XML file',
			required: true
		})
	};

	async run(): Promise<void> {
		const { args, flags } = await this.parse(VendorTransform);

		try {
			// Read input file
			this.log(`Reading: ${args.file}`);
			const content = readFileSync(args.file, 'utf-8');

			// Initialize transform engine
			const engine = new TransformEngine();

			// Register plugins (core first, then vendor)
			engine.use(new QtiToPiePlugin()); // Priority 100
			engine.use(new ExampleCorpPlugin()); // Priority 550

			// Auto-detect which plugin can handle this
			const plugins = [new ExampleCorpPlugin(), new QtiToPiePlugin()];
			let selectedPlugin = null;

			if (!flags.vendor) {
				this.log('Auto-detecting vendor...');
				// Check plugins by priority order
				const sorted = plugins.sort((a, b) => ((b as any).priority ?? 100) - ((a as any).priority ?? 100));
				for (const plugin of sorted) {
					const canHandle = await plugin.canHandle({ content });
					if (canHandle) {
						selectedPlugin = plugin;
						this.log(`Detected: ${plugin.name} (priority: ${(plugin as any).priority ?? 100})`);
						break;
					}
				}
				if (!selectedPlugin) {
					this.log('No vendor detected, using standard QTI plugin');
					selectedPlugin = new QtiToPiePlugin();
				}
			} else {
				// Use specified vendor
				if (flags.vendor === 'examplecorp') {
					selectedPlugin = new ExampleCorpPlugin();
				} else {
					selectedPlugin = new QtiToPiePlugin();
				}
			}

			// Transform
			this.log('Transforming...');
			const result = await selectedPlugin.transform(
				{ content },
				{ vendor: flags.vendor }
			);

			// Show which plugin was used
			if (flags['show-priority']) {
				this.log(`\nPlugin used: ${selectedPlugin.name} (priority: ${(selectedPlugin as any).priority ?? 100})`);
			}

			// Format output
			const outputJson = JSON.stringify(
				{
					items: result.items,
					format: result.format,
					metadata: {
						...result.metadata,
						timestamp: result.metadata.timestamp.toISOString()
					}
				},
				null,
				2
			);

			// Output result
			if (flags.output) {
				writeFileSync(flags.output, outputJson);
				this.log(`\n✓ Wrote output to: ${flags.output}`);
			} else {
				this.log('\n' + '─'.repeat(60));
				this.log('PIE Model Output:');
				this.log('─'.repeat(60));
				this.log(outputJson);
			}

			// Show warnings/errors if any
			if (result.warnings && result.warnings.length > 0) {
				this.log('\n⚠ Warnings:');
				for (const warning of result.warnings) {
					this.log(`  - ${warning.message}`);
				}
			}

			if (result.errors && result.errors.length > 0) {
				this.log('\n✗ Errors:');
				for (const error of result.errors) {
					this.log(`  - ${error.message}`);
				}
			}

			this.log('\n✓ Transformation complete');
		} catch (error) {
			this.error(error instanceof Error ? error.message : 'Unknown error');
		}
	}
}
