/**
 * Vendor Detection Command
 * Detects which vendor plugin can handle a QTI file
 */

import { Command, Flags, Args } from '@oclif/core';
import { readFileSync } from 'node:fs';
import { ExampleCorpPlugin } from '@pie-qti-examples/vendor-examplecorp-plugin';
import { Qti22ToPiePlugin } from '@pie-qti/qti2-to-pie';

export default class VendorDetect extends Command {
	static description = 'Detect which vendor plugin can handle a QTI file';

	static examples = [
		'<%= config.bin %> <%= command.id %> input.xml',
		'<%= config.bin %> <%= command.id %> input.xml --json'
	];

	static flags = {
		json: Flags.boolean({
			description: 'Output results as JSON',
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
		const { args, flags } = await this.parse(VendorDetect);

		try {
			// Read file
			const content = readFileSync(args.file, 'utf-8');

			// Initialize plugins
			const plugins = [
				new Qti22ToPiePlugin(),
				new ExampleCorpPlugin()
			];

			// Check which plugins can handle this content
			const results: Array<{
				pluginId: string;
				pluginName: string;
				priority: number;
				canHandle: boolean;
			}> = [];

			for (const plugin of plugins) {
				try {
					const canHandle = await plugin.canHandle({ content });
					results.push({
						pluginId: plugin.id,
						pluginName: plugin.name,
						priority: (plugin as any).priority ?? 100,
						canHandle
					});
				} catch (error) {
					this.warn(`Detection failed for ${plugin.id}: ${error}`);
				}
			}

			// Find best match (highest priority that can handle)
			const matches = results.filter(r => r.canHandle).sort((a, b) => b.priority - a.priority);
			const bestMatch = matches[0];

			if (flags.json) {
				this.log(JSON.stringify({ results, bestMatch }, null, 2));
			} else {
				this.log(`\nDetection Results for: ${args.file}\n`);
				this.log('─'.repeat(60));

				for (const result of results) {
					this.log(`\n${result.pluginName} (Priority: ${result.priority})`);
					if (result.canHandle) {
						this.log(`  ✓ Can handle this content`);
					} else {
						this.log(`  ✗ Cannot handle this content`);
					}
				}

				this.log('\n' + '─'.repeat(60));
				if (bestMatch) {
					this.log(`\n✓ Best Match: ${bestMatch.pluginName}`);
					this.log(`  Priority: ${bestMatch.priority}\n`);
				} else {
					this.log('\n✗ No plugin can handle this content\n');
				}
			}
		} catch (error) {
			this.error(error instanceof Error ? error.message : 'Unknown error');
		}
	}
}
