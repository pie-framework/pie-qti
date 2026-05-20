/**
 * Batch QTI package transformation command.
 *
 * Package analysis, source-profile detection, sidecars, diagnostics, and item
 * transforms are delegated to @pie-qti/to-pie's package transformer.
 */

import { Args, Command, Flags } from '@oclif/core';
import { extractZipToDirSafe } from '@pie-qti/ims-cp-node';
import {
  transformQtiPackagePathToPie,
  type NodeQtiPackageTransformResult,
} from '@pie-qti/to-pie/node';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface BatchTransformOptions {
  /** Output directory for transformed PIE package artifacts */
  outputDir: string;

  /** Whether to extract nested ZIP files */
  extractNestedZips?: boolean;

  /** Deprecated: package transforms preserve passage evidence as sidecars */
  loadPassageContent?: boolean;

  /** Whether to copy sidecar source assets to output */
  copyMediaAssets?: boolean;

  /** Whether to generate a summary report */
  generateReport?: boolean;

  /** Temporary directory for ZIP extraction */
  tempDir?: string;

  /** Whether to clean up temp directory after completion */
  cleanupTemp?: boolean;

  /** Maximum parallel package transformations */
  maxParallel?: number;
}

export interface BatchTransformResult {
  totalPackages: number;
  totalItems: number;
  totalAssessments: number;
  totalPassages: number;
  successfulTransforms: number;
  failedTransforms: number;
  errors: TransformError[];
  outputDir: string;
  duration: number;
  packages: PackageResult[];
}

export interface PackageResult {
  packagePath: string;
  packageName: string;
  packageId?: string;
  hasManifest: boolean;
  itemsTransformed: number;
  assessmentsTransformed: number;
  passagesTransformed: number;
  sidecarsEmitted: number;
  diagnostics: number;
  errors: string[];
  mediaAssets: {
    images: number;
    audio: number;
    video: number;
  };
}

export interface TransformError {
  file: string;
  error: string;
  packagePath: string;
}

type PackageSidecar = NodeQtiPackageTransformResult['sidecars'][number];

export class BatchTransformer {
  private options: Required<BatchTransformOptions>;
  private workingDir: string;
  private extractedPaths: string[] = [];

  constructor(options: BatchTransformOptions) {
    const defaults: Omit<Required<BatchTransformOptions>, 'outputDir'> = {
      extractNestedZips: true,
      loadPassageContent: false,
      copyMediaAssets: false,
      generateReport: true,
      tempDir: path.join('/tmp', `pie-batch-${Date.now()}`),
      cleanupTemp: true,
      maxParallel: 10,
    };
    const overrides = Object.fromEntries(
      Object.entries(options).filter(([, value]) => value !== undefined)
    ) as Partial<Required<BatchTransformOptions>>;
    this.options = {
      ...defaults,
      ...overrides,
      outputDir: options.outputDir,
    };
    this.workingDir = this.options.tempDir;
  }

  /**
   * Transform multiple paths (directories and/or ZIPs) as a single job.
   */
  async transform(paths: string[]): Promise<BatchTransformResult> {
    const startTime = Date.now();

    console.log('Starting batch package transformation...');
    console.log(`   Inputs: ${paths.length}`);
    console.log(`   Output: ${this.options.outputDir}`);
    console.log('');

    this.ensureDir(this.options.outputDir);
    this.ensureDir(this.workingDir);

    const result: BatchTransformResult = {
      totalPackages: 0,
      totalItems: 0,
      totalAssessments: 0,
      totalPassages: 0,
      successfulTransforms: 0,
      failedTransforms: 0,
      errors: [],
      outputDir: this.options.outputDir,
      duration: 0,
      packages: [],
    };

    try {
      console.log('Phase 1: Package discovery');
      const packages = await this.discoverPackages(paths);
      console.log(`   Found ${packages.length} QTI package(s)`);
      console.log('');

      result.totalPackages = packages.length;

      console.log('Phase 2: Package transformation');
      const packageResults = await this.transformPackages(packages);
      for (const pkgResult of packageResults) {
        result.packages.push(pkgResult);
        result.totalItems += pkgResult.itemsTransformed + pkgResult.errors.length;
        result.totalAssessments += pkgResult.assessmentsTransformed;
        result.totalPassages += pkgResult.passagesTransformed;
        result.successfulTransforms += pkgResult.itemsTransformed;
        result.failedTransforms += pkgResult.errors.length;
        result.errors.push(
          ...pkgResult.errors.map((err) => ({
            file: pkgResult.packageName,
            error: err,
            packagePath: pkgResult.packagePath,
          }))
        );
      }

      result.duration = Date.now() - startTime;

      if (this.options.generateReport) {
        console.log('');
        console.log('Phase 3: Report generation');
        await this.generateReport(result);
      }

      this.printSummary(result);
    } finally {
      if (this.options.cleanupTemp && fs.existsSync(this.workingDir)) {
        console.log('');
        console.log('Cleaning up temporary files...');
        fs.rmSync(this.workingDir, { recursive: true, force: true });
      }
    }

    return result;
  }

  private async transformPackages(packages: string[]): Promise<PackageResult[]> {
    const results: PackageResult[] = [];
    const maxParallel = Math.max(1, this.options.maxParallel);

    for (let index = 0; index < packages.length; index += maxParallel) {
      const chunk = packages.slice(index, index + maxParallel);
      const chunkResults = await Promise.all(
        chunk.map(async (pkg, offset) => {
          const packageNumber = index + offset + 1;
          console.log(`   [${packageNumber}/${packages.length}] ${path.basename(pkg)}...`);
          return this.transformPackage(pkg);
        })
      );
      results.push(...chunkResults);
    }

    return results;
  }

  /**
   * Discover all QTI packages from given paths.
   */
  private async discoverPackages(paths: string[]): Promise<string[]> {
    const packages: string[] = [];

    for (const inputPath of paths) {
      const lower = inputPath.toLowerCase();
      if (lower.endsWith('.zip') || lower.endsWith('.imscc')) {
        await this.extractZip(inputPath);
        packages.push(...(await this.findPackagesInDirectory(this.workingDir)));
      } else if (fs.existsSync(inputPath) && fs.statSync(inputPath).isDirectory()) {
        packages.push(...(await this.findPackagesInDirectory(inputPath)));
      }
    }

    return [...new Set(packages.map((pkg) => path.resolve(pkg)))];
  }

  /**
   * Extract a ZIP file.
   */
  private async extractZip(zipPath: string): Promise<string> {
    const targetDir = path.join(this.workingDir, path.basename(zipPath, path.extname(zipPath)));

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    await extractZipToDirSafe(zipPath, targetDir);
    this.extractedPaths.push(targetDir);

    if (this.options.extractNestedZips) {
      await this.extractNestedZips(targetDir);
    }

    return targetDir;
  }

  /**
   * Extract nested ZIP files recursively.
   */
  private async extractNestedZips(dir: string): Promise<void> {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        await this.extractNestedZips(fullPath);
      } else if (entry.name.toLowerCase().endsWith('.zip')) {
        await this.extractZip(fullPath);
      }
    }
  }

  /**
   * Find all manifest-backed QTI packages in a directory.
   */
  private async findPackagesInDirectory(dir: string): Promise<string[]> {
    const packages: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    if (entries.some((entry) => entry.name === 'imsmanifest.xml')) {
      packages.push(dir);
      return packages;
    }

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
      packages.push(...(await this.findPackagesInDirectory(path.join(dir, entry.name))));
    }

    return packages;
  }

  /**
   * Transform a single package using the package-level transformer.
   */
  private async transformPackage(packagePath: string): Promise<PackageResult> {
    const packageName = path.basename(packagePath);
    const result: PackageResult = {
      packagePath,
      packageName,
      hasManifest: false,
      itemsTransformed: 0,
      assessmentsTransformed: 0,
      passagesTransformed: 0,
      sidecarsEmitted: 0,
      diagnostics: 0,
      errors: [],
      mediaAssets: {
        images: 0,
        audio: 0,
        video: 0,
      },
    };

    try {
      const transformed = await transformQtiPackagePathToPie({
        packagePath,
      });
      const outputRoot = path.join(this.options.outputDir, safeSegment(packageName));

      result.packageId = transformed.packageId;
      result.hasManifest = true;
      result.itemsTransformed = transformed.itemResults
        .filter((item) => item.status === 'transformed')
        .reduce((sum, item) => sum + item.itemCount, 0);
      result.assessmentsTransformed = transformed.packageEvidence.entrypoints.filter(
        (entrypoint) => entrypoint.kind === 'test'
      ).length;
      result.passagesTransformed = transformed.packageEvidence.entrypoints.filter(
        (entrypoint) => entrypoint.kind === 'passage'
      ).length;
      result.sidecarsEmitted = transformed.sidecars.length;
      result.diagnostics =
        transformed.packageEvidence.diagnostics.length + transformed.sourceDiagnostics.length;
      result.errors.push(
        ...transformed.itemResults
          .filter((item) => item.status === 'failed')
          .map((item) => item.message ?? `Failed to transform ${item.resourceId}`)
      );
      result.mediaAssets = countMediaSidecars(transformed.sidecars);

      await this.writePackageOutput(outputRoot, transformed);
      return result;
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : String(error));
      return result;
    }
  }

  private async writePackageOutput(
    outputRoot: string,
    transformed: NodeQtiPackageTransformResult
  ): Promise<void> {
    this.ensureDir(outputRoot);

    fs.writeFileSync(
      path.join(outputRoot, 'package-transform.json'),
      JSON.stringify(toPackageTransformJson(transformed), null, 2)
    );
    fs.writeFileSync(
      path.join(outputRoot, 'package-evidence.json'),
      JSON.stringify(transformed.packageEvidence, null, 2)
    );
    fs.writeFileSync(
      path.join(outputRoot, 'conversion-trace.json'),
      JSON.stringify(transformed.conversionTrace, null, 2)
    );

    this.writeItems(outputRoot, transformed);
    await this.writeSidecars(outputRoot, transformed);
  }

  private writeItems(outputRoot: string, transformed: NodeQtiPackageTransformResult): void {
    const itemsDir = path.join(outputRoot, 'items');
    this.ensureDir(itemsDir);

    transformed.itemOutputs.forEach((output, index) => {
      const itemResult = transformed.itemResults[index];
      const resourceId = safeSegment(itemResult?.resourceId ?? `item-${index + 1}`);
      output.items.forEach((item, itemIndex) => {
        const suffix = output.items.length > 1 ? `-${itemIndex + 1}` : '';
        const outputPath = path.join(itemsDir, `${resourceId}${suffix}.json`);
        fs.writeFileSync(outputPath, JSON.stringify(item.content, null, 2));
      });
    });
  }

  private async writeSidecars(
    outputRoot: string,
    transformed: NodeQtiPackageTransformResult
  ): Promise<void> {
    const sidecarsDir = path.join(outputRoot, 'sidecars');
    this.ensureDir(sidecarsDir);

    fs.writeFileSync(
      path.join(sidecarsDir, 'index.json'),
      JSON.stringify(transformed.sidecars.map(toSidecarIndexJson), null, 2)
    );

    for (const sidecar of transformed.sidecars) {
      const sidecarRoot = path.join(sidecarsDir, safeSegment(sidecar.kind));
      this.ensureDir(sidecarRoot);

      if (typeof sidecar.content === 'string') {
        fs.writeFileSync(path.join(sidecarRoot, `${safeSegment(sidecar.id)}.txt`), sidecar.content);
        continue;
      }

      if (sidecar.content instanceof Uint8Array) {
        fs.writeFileSync(path.join(sidecarRoot, `${safeSegment(sidecar.id)}.bin`), sidecar.content);
        continue;
      }

      if (this.options.copyMediaAssets && sidecar.sourcePath) {
        const sourcePath = path.resolve(transformed.packageRoot, sidecar.sourcePath);
        if (fs.existsSync(sourcePath) && fs.statSync(sourcePath).isFile()) {
          const targetPath = path.join(sidecarRoot, sidecar.sourcePath.split('/').map(safeSegment).join(path.sep));
          this.ensureDir(path.dirname(targetPath));
          fs.copyFileSync(sourcePath, targetPath);
        }
      }
    }
  }

  /**
   * Generate transformation report.
   */
  private async generateReport(result: BatchTransformResult): Promise<void> {
    const reportPath = path.join(this.options.outputDir, 'transformation-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(result, null, 2));
    console.log(`   Report saved: ${reportPath}`);
  }

  private printSummary(result: BatchTransformResult): void {
    console.log('');
    console.log('='.repeat(60));
    console.log('BATCH PACKAGE TRANSFORMATION COMPLETE');
    console.log('='.repeat(60));
    console.log(`Total Packages:     ${result.totalPackages}`);
    console.log(`Total Items:        ${result.totalItems}`);
    console.log(`Total Assessments:  ${result.totalAssessments}`);
    console.log(`Total Passages:     ${result.totalPassages}`);
    console.log(`Successful Items:   ${result.successfulTransforms}`);
    console.log(`Failed Items:       ${result.failedTransforms}`);
    console.log(`Duration:           ${(result.duration / 1000).toFixed(1)}s`);
    console.log(`Output Directory:   ${result.outputDir}`);
    console.log('='.repeat(60));
  }

  /**
   * Ensure directory exists.
   */
  private ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

function toPackageTransformJson(transformed: NodeQtiPackageTransformResult) {
  return {
    packageId: transformed.packageId,
    packageRoot: transformed.packageRoot,
    manifestPath: transformed.manifestPath,
    qtiVersion: transformed.qtiVersion,
    itemResults: transformed.itemResults,
    sidecars: transformed.sidecars.map(toSidecarIndexJson),
    sourceProfiles: transformed.sourceProfiles,
    sourceDiagnostics: transformed.sourceDiagnostics,
    standardCandidates: transformed.standardCandidates,
    rubricCandidates: transformed.rubricCandidates,
    warnings: transformed.warnings,
  };
}

function toSidecarIndexJson(sidecar: PackageSidecar) {
  return {
    ...sidecar,
    content:
      typeof sidecar.content === 'string'
        ? { type: 'text', length: sidecar.content.length }
        : sidecar.content instanceof Uint8Array
          ? { type: 'binary', length: sidecar.content.byteLength }
          : undefined,
  };
}

function countMediaSidecars(sidecars: PackageSidecar[]): PackageResult['mediaAssets'] {
  const counts = { images: 0, audio: 0, video: 0 };
  for (const sidecar of sidecars) {
    if (sidecar.kind === 'asset' && sidecar.mimeType?.startsWith('image/')) counts.images += 1;
    if (sidecar.kind === 'asset' && sidecar.mimeType?.startsWith('audio/')) counts.audio += 1;
    if (sidecar.kind === 'asset' && sidecar.mimeType?.startsWith('video/')) counts.video += 1;
  }
  return counts;
}

function safeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '') || 'unnamed';
}

export default class BatchTransform extends Command {
  static override description =
    'Batch transform QTI packages (directories/ZIPs) to package-native PIE artifacts.';

  static override examples = [
    '<%= config.bin %> <%= command.id %> ./some-package.zip -o ./out',
    '<%= config.bin %> <%= command.id %> ./dir-a ./dir-b -o ./out --no-cleanupTemp',
  ];

  static override flags = {
    outputDir: Flags.string({
      char: 'o',
      description: 'Output directory for transformed PIE package artifacts',
      required: true,
    }),
    maxParallel: Flags.integer({
      description: 'Max parallel package transformations',
      default: 10,
    }),
    extractNestedZips: Flags.boolean({
      description: 'Extract nested ZIP files',
      default: true,
      allowNo: true,
    }),
    loadPassageContent: Flags.boolean({
      description: 'Deprecated; package transforms preserve passage evidence as sidecars',
      default: false,
    }),
    copyMediaAssets: Flags.boolean({
      description: 'Copy sidecar source assets into output directory',
      default: false,
    }),
    generateReport: Flags.boolean({
      description: 'Generate a summary report',
      default: true,
      allowNo: true,
    }),
    cleanupTemp: Flags.boolean({
      description: 'Cleanup temporary extraction directory',
      default: true,
      allowNo: true,
    }),
    tempDir: Flags.string({
      description: 'Temporary directory for ZIP extraction',
      required: false,
    }),
  };

  static override args = {
    inputs: Args.string({
      description: 'One or more package paths (directories or ZIPs)',
      required: true,
      multiple: true,
    }),
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(BatchTransform);
    const transformer = new BatchTransformer({
      outputDir: flags.outputDir,
      maxParallel: flags.maxParallel,
      extractNestedZips: flags.extractNestedZips,
      loadPassageContent: flags.loadPassageContent,
      copyMediaAssets: flags.copyMediaAssets,
      generateReport: flags.generateReport,
      cleanupTemp: flags.cleanupTemp,
      tempDir: flags.tempDir,
    });
    const inputs = Array.isArray(args.inputs) ? args.inputs : [args.inputs];
    const result = await transformer.transform(inputs);
    if (result.totalPackages === 0 || result.successfulTransforms === 0) {
      this.exit(1);
    }
  }
}

// Note: This file is an Oclif command module. Keep it free of top-level side effects so
// the CLI can discover commands by scanning `dist/commands` generically.
