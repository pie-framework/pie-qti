/**
 * Batch QTI Transformation Orchestrator
 *
 * Handles multiple directories, ZIPs, and nested ZIPs as a single unified job.
 * Features:
 * - Auto-extraction of ZIP files (including nested)
 * - Manifest parsing and dependency resolution
 * - Passage content loading
 * - Media asset cataloging
 * - Progress reporting
 * - Error recovery
 */

import { Qti22ToPiePlugin } from '@pie-qti/qti2-to-pie';
import { extractZipToDirSafe, loadResolvedManifest } from '@pie-qti/qti2-to-pie/ims-cp';
import * as fs from 'fs';
import { parse as parseHtml } from 'node-html-parser';
import * as path from 'path';

export interface BatchTransformOptions {
  /** Output directory for transformed PIE items */
  outputDir: string;

  /** Whether to extract nested ZIP files */
  extractNestedZips?: boolean;

  /** Whether to load passage content from external files */
  loadPassageContent?: boolean;

  /** Whether to copy media assets to output */
  copyMediaAssets?: boolean;

  /** Whether to generate a summary report */
  generateReport?: boolean;

  /** Temporary directory for ZIP extraction */
  tempDir?: string;

  /** Whether to clean up temp directory after completion */
  cleanupTemp?: boolean;

  /** Maximum parallel transformations */
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
  duration: number; // milliseconds
  packages: PackageResult[];
}

export interface PackageResult {
  packagePath: string;
  packageName: string;
  hasManifest: boolean;
  itemsTransformed: number;
  assessmentsTransformed: number;
  passagesTransformed: number;
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

export class BatchTransformer {
  private plugin: Qti22ToPiePlugin;
  private options: Required<BatchTransformOptions>;
  private workingDir: string;
  private extractedPaths: string[] = [];

  constructor(options: BatchTransformOptions) {
    this.plugin = new Qti22ToPiePlugin();
    this.options = {
      extractNestedZips: true,
      loadPassageContent: false,
      copyMediaAssets: false,
      generateReport: true,
      tempDir: path.join('/tmp', `pie-batch-${Date.now()}`),
      cleanupTemp: true,
      maxParallel: 10,
      ...options,
    };
    this.workingDir = this.options.tempDir;
  }

  /**
   * Transform multiple paths (directories and/or ZIPs) as a single job
   */
  async transform(paths: string[]): Promise<BatchTransformResult> {
    const startTime = Date.now();

    console.log('🚀 Starting batch transformation...');
    console.log(`   Paths: ${paths.length}`);
    console.log(`   Output: ${this.options.outputDir}`);
    console.log('');

    // Ensure output directory exists
    if (!fs.existsSync(this.options.outputDir)) {
      fs.mkdirSync(this.options.outputDir, { recursive: true });
    }

    // Ensure temp directory exists
    if (!fs.existsSync(this.workingDir)) {
      fs.mkdirSync(this.workingDir, { recursive: true });
    }

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
      // Phase 1: Discovery - Find and extract all packages
      console.log('📦 Phase 1: Package Discovery');
      const packages = await this.discoverPackages(paths);
      console.log(`   Found ${packages.length} QTI packages`);
      console.log('');

      result.totalPackages = packages.length;

      // Phase 2: Transformation - Transform all items
      console.log('⚙️  Phase 2: Transformation');
      for (let i = 0; i < packages.length; i++) {
        const pkg = packages[i];
        console.log(`   [${i + 1}/${packages.length}] ${path.basename(pkg)}...`);

        const pkgResult = await this.transformPackage(pkg);
        result.packages.push(pkgResult);

        result.totalItems += pkgResult.itemsTransformed;
        result.totalAssessments += pkgResult.assessmentsTransformed;
        result.totalPassages += pkgResult.passagesTransformed;
        result.successfulTransforms += pkgResult.itemsTransformed + pkgResult.assessmentsTransformed;
        result.failedTransforms += pkgResult.errors.length;
        result.errors.push(...pkgResult.errors.map(err => ({
          file: err,
          error: 'Transformation failed',
          packagePath: pkg,
        })));
      }

      console.log('');
      console.log('✅ Phase 2 Complete');
      console.log('');

      // Phase 3: Media Assets (if enabled)
      if (this.options.copyMediaAssets) {
        console.log('🎨 Phase 3: Media Assets');
        await this.copyMediaAssets(packages, result);
        console.log('✅ Phase 3 Complete');
        console.log('');
      }

      // Phase 4: Report Generation (if enabled)
      if (this.options.generateReport) {
        console.log('📊 Phase 4: Report Generation');
        await this.generateReport(result);
        console.log('✅ Phase 4 Complete');
        console.log('');
      }

      result.duration = Date.now() - startTime;

      // Summary
      console.log('='.repeat(60));
      console.log('BATCH TRANSFORMATION COMPLETE');
      console.log('='.repeat(60));
      console.log(`Total Packages:     ${result.totalPackages}`);
      console.log(`Total Items:        ${result.totalItems}`);
      console.log(`Total Assessments:  ${result.totalAssessments}`);
      console.log(`Total Passages:     ${result.totalPassages}`);
      console.log(`Successful:         ${result.successfulTransforms}`);
      console.log(`Failed:             ${result.failedTransforms}`);
      console.log(`Duration:           ${(result.duration / 1000).toFixed(1)}s`);
      console.log(`Output Directory:   ${result.outputDir}`);
      console.log('='.repeat(60));

    } finally {
      // Cleanup temp directory
      if (this.options.cleanupTemp && fs.existsSync(this.workingDir)) {
        console.log('');
        console.log('🧹 Cleaning up temporary files...');
        fs.rmSync(this.workingDir, { recursive: true, force: true });
      }
    }

    return result;
  }

  /**
   * Discover all QTI packages from given paths
   */
  private async discoverPackages(paths: string[]): Promise<string[]> {
    const packages: string[] = [];

    for (const inputPath of paths) {
      const lower = inputPath.toLowerCase();
      if (lower.endsWith('.zip') || lower.endsWith('.imscc')) {
        // Extract ZIP and discover packages within
        await this.extractZip(inputPath);
        // After extraction (including nested ZIPs), scan entire working directory
        const found = await this.findPackagesInDirectory(this.workingDir);
        packages.push(...found);
      } else if (fs.existsSync(inputPath) && fs.statSync(inputPath).isDirectory()) {
        // Scan directory for packages
        const found = await this.findPackagesInDirectory(inputPath);
        packages.push(...found);
      }
    }

    return packages;
  }

  /**
   * Extract a ZIP file
   */
  private async extractZip(zipPath: string): Promise<string> {
    const targetDir = path.join(this.workingDir, path.basename(zipPath, '.zip'));

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    await extractZipToDirSafe(zipPath, targetDir);

    this.extractedPaths.push(targetDir);

    // If extractNestedZips is enabled, look for nested ZIPs
    if (this.options.extractNestedZips) {
      await this.extractNestedZips(targetDir);
    }

    return targetDir;
  }

  /**
   * Extract nested ZIP files recursively
   */
  private async extractNestedZips(dir: string): Promise<void> {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        await this.extractNestedZips(fullPath);
      } else if (entry.name.endsWith('.zip')) {
        await this.extractZip(fullPath);
      }
    }
  }

  /**
   * Find all QTI packages in a directory
   */
  private async findPackagesInDirectory(dir: string): Promise<string[]> {
    const packages: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    // Check if this directory has a manifest (is a package)
    const hasManifest = entries.some(e => e.name === 'imsmanifest.xml');
    if (hasManifest) {
      packages.push(dir);
      return packages; // Don't recurse into package subdirectories
    }

    // Recurse into subdirectories
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const fullPath = path.join(dir, entry.name);
        const found = await this.findPackagesInDirectory(fullPath);
        packages.push(...found);
      }
    }

    return packages;
  }

  /**
   * Transform a single package
   */
  private async transformPackage(packagePath: string): Promise<PackageResult> {
    const result: PackageResult = {
      packagePath,
      packageName: path.basename(packagePath),
      hasManifest: false,
      itemsTransformed: 0,
      assessmentsTransformed: 0,
      passagesTransformed: 0,
      errors: [],
      mediaAssets: {
        images: 0,
        audio: 0,
        video: 0,
      },
    };

    // Check for manifest
    const manifestPath = path.join(packagePath, 'imsmanifest.xml');

    if (fs.existsSync(manifestPath)) {
      result.hasManifest = true;
      // Note: Manifest could be used for dependency resolution in future
      try {
        await loadResolvedManifest(packagePath);
      } catch {
        // ignore manifest parse errors in batch mode
      }
    }

    // Find all XML files
    const xmlFiles = this.findXmlFiles(packagePath);

    // Transform each file
    for (const xmlFile of xmlFiles) {
      try {
        let xml = fs.readFileSync(xmlFile, 'utf-8');
        const itemId = path.basename(xmlFile, '.xml');

        // Load external passage content if enabled
        if (this.options.loadPassageContent && xml.includes('<object')) {
          xml = await this.loadPassageContent(xml, packagePath);
        }

        // Determine if it's an item, assessment, or passage
        if (xml.includes('<assessmentTest')) {
          // Transform assessment
          const output = await this.plugin.transform(
            { content: xml, metadata: { itemId } },
            {}
          );

          // Save assessment
          const outputPath = path.join(
            this.options.outputDir,
            result.packageName,
            'assessments',
            `${itemId}.json`
          );
          this.ensureDir(path.dirname(outputPath));
          fs.writeFileSync(outputPath, JSON.stringify(output.items[0], null, 2));

          result.assessmentsTransformed++;
        } else if (xml.includes('<assessmentItem')) {
          // Transform item
          const output = await this.plugin.transform(
            { content: xml, metadata: { itemId } },
            {}
          );

          // Save item
          const outputPath = path.join(
            this.options.outputDir,
            result.packageName,
            'items',
            `${itemId}.json`
          );
          this.ensureDir(path.dirname(outputPath));
          fs.writeFileSync(outputPath, JSON.stringify(output.items[0], null, 2));

          result.itemsTransformed++;
        } else if (xml.includes('<assessmentPassage') || xml.includes('<assessmentStimulus')) {
          // Transform passage
          const output = await this.plugin.transform(
            { content: xml, metadata: { itemId } },
            {}
          );

          // Save passage
          const outputPath = path.join(
            this.options.outputDir,
            result.packageName,
            'passages',
            `${itemId}.json`
          );
          this.ensureDir(path.dirname(outputPath));
          fs.writeFileSync(outputPath, JSON.stringify(output.items[0], null, 2));

          result.passagesTransformed++;
        }
      } catch (_error) {
        result.errors.push(xmlFile);
      }
    }

    // Count media assets
    result.mediaAssets = this.countMediaAssets(packagePath);

    return result;
  }

  /**
   * Find all XML files in a package
   */
  private findXmlFiles(dir: string): string[] {
    const files: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        files.push(...this.findXmlFiles(fullPath));
      } else if (entry.name.endsWith('.xml') && entry.name !== 'imsmanifest.xml') {
        files.push(fullPath);
      }
    }

    return files;
  }

  /**
   * Count media assets in a package
   */
  private countMediaAssets(dir: string): { images: number; audio: number; video: number } {
    const counts = { images: 0, audio: 0, video: 0 };
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        const subCounts = this.countMediaAssets(fullPath);
        counts.images += subCounts.images;
        counts.audio += subCounts.audio;
        counts.video += subCounts.video;
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        if (['.jpg', '.jpeg', '.png', '.gif', '.svg'].includes(ext)) {
          counts.images++;
        } else if (['.mp3', '.wav', '.ogg', '.m4a'].includes(ext)) {
          counts.audio++;
        } else if (['.mp4', '.webm', '.mov'].includes(ext)) {
          counts.video++;
        }
      }
    }

    return counts;
  }

  /**
   * Copy media assets to output directory
   */
  private async copyMediaAssets(packages: string[], _result: BatchTransformResult): Promise<void> {
    const mediaTypes = [
      { extensions: ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp'], dir: 'images' },
      { extensions: ['.mp3', '.wav', '.ogg', '.m4a', '.aac'], dir: 'audio' },
      { extensions: ['.mp4', '.webm', '.mov', '.avi'], dir: 'video' }
    ];

    let totalCopied = 0;

    for (const mediaType of mediaTypes) {
      const targetDir = path.join(this.options.outputDir, mediaType.dir);
      this.ensureDir(targetDir);

      const copiedFiles = new Set<string>(); // Avoid duplicates

      for (const packagePath of packages) {
        const mediaFiles = this.findMediaFiles(packagePath, mediaType.extensions);

        for (const sourceFile of mediaFiles) {
          const fileName = path.basename(sourceFile);

          // Skip if already copied
          if (copiedFiles.has(fileName)) {
            continue;
          }

          const targetFile = path.join(targetDir, fileName);

          try {
            fs.copyFileSync(sourceFile, targetFile);
            copiedFiles.add(fileName);
            totalCopied++;
          } catch (_error) {
            console.warn(`   Warning: Could not copy ${fileName}`);
          }
        }
      }

      if (copiedFiles.size > 0) {
        console.log(`   Copied ${copiedFiles.size} ${mediaType.dir} files`);
      }
    }

    if (totalCopied === 0) {
      console.log('   No media assets found to copy');
    }
  }

  /**
   * Find all media files in a directory
   */
  private findMediaFiles(dir: string, extensions: string[]): string[] {
    const files: string[] = [];

    if (!fs.existsSync(dir)) {
      return files;
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Recurse into subdirectories
        files.push(...this.findMediaFiles(fullPath, extensions));
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        if (extensions.includes(ext)) {
          files.push(fullPath);
        }
      }
    }

    return files;
  }

  /**
   * Generate transformation report
   */
  private async generateReport(result: BatchTransformResult): Promise<void> {
    const reportPath = path.join(this.options.outputDir, 'transformation-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(result, null, 2));
    console.log(`   Report saved: ${reportPath}`);
  }

  /**
   * Load external passage content from object tags
   */
  private async loadPassageContent(xml: string, packagePath: string): Promise<string> {
    const root = parseHtml(xml);
    const objects = root.querySelectorAll('object[type="text/html"]');

    for (const obj of objects) {
      const dataAttr = obj.getAttribute('data');
      if (!dataAttr) continue;

      // Resolve passage file path
      const passagePath = path.join(packagePath, dataAttr);

      if (fs.existsSync(passagePath)) {
        try {
          const passageHtml = fs.readFileSync(passagePath, 'utf-8');

          // Replace object tag with passage content
          obj.replaceWith(passageHtml);
        } catch (_error) {
          console.warn(`   Warning: Could not load passage from ${dataAttr}`);
        }
      }
    }

    return root.toString();
  }

  /**
   * Ensure directory exists
   */
  private ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

// CLI entry point
const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('Usage: batch-transform <output-dir> <path1> [path2] [path3] ...');
    console.error('');
    console.error('Examples:');
    console.error('  batch-transform ./output package.zip');
    console.error('  batch-transform ./output /path/to/qti/dir package.zip');
    console.error('  batch-transform ./output /path/to/qti/**/*.zip');
    process.exit(1);
  }

  const outputDir = args[0];
  const paths = args.slice(1);

  const transformer = new BatchTransformer({
    outputDir,
    extractNestedZips: true,
    loadPassageContent: false,
    copyMediaAssets: false,
    generateReport: true,
  });

  transformer.transform(paths)
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Error:', error.message);
      process.exit(1);
    });
}
