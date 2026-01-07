/**
 * Transform command - converts QTI to PIE
 */

import { readFile, writeFile } from 'node:fs/promises';
import { Args, Command, Flags } from '@oclif/core';
import { Qti22ToPiePlugin } from '@pie-qti/qti2-to-pie';
import { ConsoleLogger, TransformEngine } from '@pie-qti/transform-core';

export default class Transform extends Command {
  static override description = 'Transform QTI assessment items to PIE format';

  static override examples = [
    '<%= config.bin %> <%= command.id %> input.xml -o output.json',
    '<%= config.bin %> <%= command.id %> input.xml --format qti22:pie',
    '<%= config.bin %> <%= command.id %> input.xml -o output.json --pretty',
  ];

  static override flags = {
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

    // Setup engine
    const engine = new TransformEngine();
    const logger = flags.silent ? undefined : new ConsoleLogger();

    // Register plugins based on format
    if (sourceFormat === 'qti22' && targetFormat === 'pie') {
      engine.use(new Qti22ToPiePlugin());
    } else {
      this.error(`Unsupported transformation: ${sourceFormat} to ${targetFormat}`);
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
