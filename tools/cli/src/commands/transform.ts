/**
 * Transform command - converts QTI to PIE
 */

import { readFile, writeFile } from 'node:fs/promises';
import { Args, Flags } from '@oclif/core';
import { Qti22ToPiePlugin } from '@pie-qti/qti2-to-pie';
import { ConsoleLogger } from '@pie-qti/transform-core';
import { BaseCommand } from '../base-command.js';

export default class Transform extends BaseCommand {
  static override description = 'Transform QTI assessment items to PIE format';

  static override examples = [
    '<%= config.bin %> <%= command.id %> input.xml -o output.json',
    '<%= config.bin %> <%= command.id %> input.xml --format qti22:pie',
    '<%= config.bin %> <%= command.id %> input.xml -o output.json --pretty',
  ];

  static override flags = {
    ...BaseCommand.baseFlags,
    output: Flags.string({
      char: 'o',
      description: 'Output file path (defaults to stdout)',
      required: false,
    }),
    format: Flags.string({
      char: 'f',
      description: 'Transformation format (source:target)',
      default: 'qti22:pie',
    }),
    pretty: Flags.boolean({
      char: 'p',
      description: 'Pretty-print JSON output',
      default: false,
    }),
    silent: Flags.boolean({
      char: 's',
      description: 'Suppress logs',
      default: false,
    }),
  };

  static override args = {
    input: Args.string({
      description: 'Input file path (QTI XML)',
      required: true,
    }),
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(Transform);

    // Parse format
    const [sourceFormat, targetFormat] = flags.format.split(':');
    if (!sourceFormat || !targetFormat) {
      this.error('Invalid format. Use format like "qti22:pie"');
    }

    const logger = flags.silent ? undefined : new ConsoleLogger();

    // Setup engine with config support
    let engine;
    try {
      engine = await this.createEngine(flags.config);
    } catch (error) {
      // Fallback to manual plugin registration if config loading fails
      this.warn(`Config loading failed, using built-in plugins: ${(error as Error).message}`);
      engine = (await import('@pie-qti/transform-core')).TransformEngine;
      const engineInstance = new engine();

      // Register plugins based on format
      if (sourceFormat === 'qti22' && targetFormat === 'pie') {
        engineInstance.use(new Qti22ToPiePlugin());
      } else {
        this.error(`Unsupported transformation: ${sourceFormat} to ${targetFormat}`);
      }

      engine = engineInstance;
    }

    // If engine has no plugins for this transformation, register default
    if (sourceFormat === 'qti22' && targetFormat === 'pie') {
      const plugins = engine.getPlugins();
      if (plugins.length === 0) {
        engine.use(new Qti22ToPiePlugin());
        this.log('Using built-in QTI 2.2 to PIE plugin');
      }
    }

    try {
      // Read input
      this.log(`Reading input from ${args.input}...`);
      const inputContent = await readFile(args.input, 'utf-8');

      // Transform
      this.log(`Transforming from ${sourceFormat} to ${targetFormat}...`);
      const result = await engine.transform(inputContent, {
        sourceFormat: sourceFormat as any,
        targetFormat: targetFormat as any,
        logger,
      });

      // Format output
      const outputJson = flags.pretty
        ? JSON.stringify(result, null, 2)
        : JSON.stringify(result);

      // Write output
      if (flags.output) {
        await writeFile(flags.output, outputJson, 'utf-8');
        this.log(`✓ Transformed ${result.items.length} item(s) to ${flags.output}`);
      } else {
        this.log(outputJson);
      }

      // Show summary
      if (!flags.silent) {
        this.log('\nSummary:');
        this.log(`  Items transformed: ${result.items.length}`);
        this.log(`  Processing time: ${result.metadata.processingTime}ms`);
        this.log(`  Plugin: ${result.metadata.pluginId}`);
      }
    } catch (error) {
      this.error(`Transformation failed: ${(error as Error).message}`);
    }
  }
}
