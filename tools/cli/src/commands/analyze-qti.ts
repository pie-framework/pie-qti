/**
 * QTI Package Analyzer
 *
 * Analyzes real-world QTI packages to identify:
 * - Interaction types used
 * - Passage/stimulus patterns
 * - Manifest structures
 * - Potential transformation issues
 */

import { extractZipToDirSafe, loadResolvedManifest, type ResolvedManifest } from '@pie-qti/qti2-to-pie/ims-cp';
import * as fs from 'fs';
import type { HTMLElement } from 'node-html-parser';
import { parse } from 'node-html-parser';
import * as os from 'os';
import * as path from 'path';

interface AnalysisResult {
  packagePath: string;
  hasManifest: boolean;
  manifest?: ResolvedManifest;
  itemCount: number;
  passageCount: number;
  testCount: number;
  interactionTypes: Map<string, number>;
  passagePatterns: {
    inline: number;
    object: number;
    standalone: number;
    manifestDependency: number;
  };
  issues: string[];
  samples: {
    interactions: Map<string, string[]>;  // type -> sample file paths
    passages: string[];
  };
}

/**
 * Analyze a QTI package directory
 */
export async function analyzeQtiPackage(packagePath: string): Promise<AnalysisResult> {
  const result: AnalysisResult = {
    packagePath,
    hasManifest: false,
    itemCount: 0,
    passageCount: 0,
    testCount: 0,
    interactionTypes: new Map(),
    passagePatterns: {
      inline: 0,
      object: 0,
      standalone: 0,
      manifestDependency: 0,
    },
    issues: [],
    samples: {
      interactions: new Map(),
      passages: [],
    },
  };

  // Prefer manifest when present (supports nested manifests too)
  try {
    result.manifest = await loadResolvedManifest(packagePath);
    result.hasManifest = true;

    result.itemCount = result.manifest.items.length;
    result.passageCount = result.manifest.passages.length;
    result.testCount = result.manifest.tests.length;

    const passageIds = new Set(result.manifest.passages.map((p) => p.identifier));
    for (const item of result.manifest.items) {
      result.passagePatterns.manifestDependency += item.dependencies.filter((d) => passageIds.has(d)).length;
    }
  } catch {
    // no manifest - continue
  }

  // Scan all XML files
  await scanDirectory(packagePath, result);

  return result;
}

import { Args, Command, Flags } from '@oclif/core';

export default class AnalyzeQti extends Command {
  static override description = 'Analyze a QTI package directory or ZIP and summarize interactions, passages, and issues';

  static override examples = [
    '<%= config.bin %> <%= command.id %> ./some-qti-package-dir',
    '<%= config.bin %> <%= command.id %> ./some-package.zip',
    '<%= config.bin %> <%= command.id %> ./some-dir --output report.md',
  ];

  static override flags = {
    output: Flags.string({
      description: 'Write a detailed markdown report to this file path',
      required: false,
    }),
    recursive: Flags.boolean({
      description: 'Recurse to find packages under the provided directory',
      default: true,
      allowNo: true,
    }),
    cleanupTemp: Flags.boolean({
      description: 'Cleanup temporary extracted files when input is a ZIP',
      default: true,
      allowNo: true,
    }),
  };

  static override args = {
    input: Args.string({
      description: 'Directory or ZIP file to analyze',
      required: true,
    }),
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(AnalyzeQti);
    await analyzeQtiDirectory(args.input, {
      recursive: flags.recursive,
      outputFile: flags.output,
      cleanupTemp: flags.cleanupTemp,
    });
  }
}

/**
 * Recursively scan directory for QTI files
 */
async function scanDirectory(dir: string, result: AnalysisResult): Promise<void> {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Skip node_modules, .git, etc.
      if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
        await scanDirectory(fullPath, result);
      }
    } else if (entry.name.endsWith('.xml') && entry.name !== 'imsmanifest.xml') {
      await analyzeXmlFile(fullPath, result);
    }
  }
}

/**
 * Analyze individual XML file
 */
async function analyzeXmlFile(filePath: string, result: AnalysisResult): Promise<void> {
  try {
    const xml = fs.readFileSync(filePath, 'utf-8');
    const doc = parse(xml, { lowerCaseTagName: false });

    // Check for assessment item
    const assessmentItem = doc.querySelector('assessmentItem') ||
                          doc.getElementsByTagName('assessmentItem')[0];

    if (assessmentItem) {
      await analyzeAssessmentItem(assessmentItem, filePath, result);
      return;
    }

    // Check for assessment stimulus/passage
    const assessmentStimulus = doc.querySelector('assessmentStimulus') ||
                              doc.getElementsByTagName('assessmentStimulus')[0];

    const assessmentPassage = doc.querySelector('assessmentPassage') ||
                             doc.getElementsByTagName('assessmentPassage')[0];

    if (assessmentStimulus || assessmentPassage) {
      result.passagePatterns.standalone++;
      if (result.samples.passages.length < 5) {
        result.samples.passages.push(filePath);
      }
    }
  } catch (error) {
    result.issues.push(`Failed to parse ${filePath}: ${(error as Error).message}`);
  }
}

/**
 * Analyze assessment item
 */
async function analyzeAssessmentItem(
  item: HTMLElement,
  filePath: string,
  result: AnalysisResult
): Promise<void> {
  const itemBody = item.querySelector('itemBody') ||
                   item.getElementsByTagName('itemBody')[0];

  if (!itemBody) return;

  // Detect interaction types
  const interactions = [
    'choiceInteraction',
    'extendedTextInteraction',
    'textEntryInteraction',
    'orderInteraction',
    'matchInteraction',
    'associateInteraction',
    'gapMatchInteraction',
    'inlineChoiceInteraction',
    'hotspotInteraction',
    'graphicGapMatchInteraction',
    'selectPointInteraction',
    'graphicOrderInteraction',
    'graphicAssociateInteraction',
    'sliderInteraction',
    'positionObjectInteraction',
    'drawingInteraction',
    'uploadInteraction',
    'customInteraction',
  ];

  for (const interactionType of interactions) {
    const elements = itemBody.getElementsByTagName(interactionType);
    if (elements.length > 0) {
      const count = result.interactionTypes.get(interactionType) || 0;
      result.interactionTypes.set(interactionType, count + elements.length);

      // Store sample
      if (!result.samples.interactions.has(interactionType)) {
        result.samples.interactions.set(interactionType, []);
      }
      const samples = result.samples.interactions.get(interactionType)!;
      if (samples.length < 3) {
        samples.push(filePath);
      }
    }
  }

  // Detect passage patterns
  const stimulus = itemBody.querySelector('stimulus') ||
                   itemBody.getElementsByTagName('stimulus')[0];
  if (stimulus) {
    result.passagePatterns.inline++;
  }

  const objects = itemBody.getElementsByTagName('object');
  for (const obj of Array.from(objects) as HTMLElement[]) {
    const dataAttr = obj.getAttribute('data');
    const typeAttr = obj.getAttribute('type');
    if (dataAttr && (!typeAttr || typeAttr.startsWith('text/'))) {
      result.passagePatterns.object++;
    }
  }

  // Detect rubrics
  const rubricBlocks = item.getElementsByTagName('rubricBlock');
  if (rubricBlocks.length > 0) {
    // Track rubric usage if needed
  }
}

/**
 * Extract ZIP file to temporary directory
 */
async function extractZip(zipPath: string, targetDir: string): Promise<string> {
  console.log(`  Extracting ${path.basename(zipPath)}...`);

  const extractedDir = path.join(targetDir, path.basename(zipPath, '.zip'));

  await fs.promises.mkdir(extractedDir, { recursive: true });

  await extractZipToDirSafe(zipPath, extractedDir);

  // Recursively extract nested ZIPs
  await extractNestedZips(extractedDir);

  return extractedDir;
}

/**
 * Recursively extract nested ZIP files
 */
async function extractNestedZips(dir: string): Promise<void> {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      await extractNestedZips(fullPath);
    } else if (entry.name.endsWith('.zip')) {
      const extractedDir = path.join(dir, path.basename(entry.name, '.zip'));
      await fs.promises.mkdir(extractedDir, { recursive: true });

      await extractZipToDirSafe(fullPath, extractedDir);

      // Recursively extract any ZIPs inside this one
      await extractNestedZips(extractedDir);

      // Optionally remove the ZIP file after extraction
      // fs.unlinkSync(fullPath);
    }
  }
}

/**
 * Analyze multiple packages and generate report
 */
export async function analyzeQtiDirectory(
  rootDir: string,
  options: {
    recursive?: boolean;
    outputFile?: string;
    cleanupTemp?: boolean;
  } = {}
): Promise<void> {
  let workingDir = rootDir;
  let shouldCleanup = false;

  // Check if input is a ZIP file
  if (rootDir.endsWith('.zip') && fs.existsSync(rootDir)) {
    console.log('ZIP file detected. Extracting...\n');

    const tempDir = path.join(os.tmpdir(), `qti-analyze-${Date.now()}`);
    await fs.promises.mkdir(tempDir, { recursive: true });

    workingDir = await extractZip(rootDir, tempDir);
    shouldCleanup = options.cleanupTemp ?? true;

    console.log(`\nAnalyzing QTI packages in extracted directory\n`);
  } else {
    console.log(`Analyzing QTI packages in: ${workingDir}\n`);
  }

  const packages: AnalysisResult[] = [];

  try {
    // Find all packages
    await findPackages(workingDir, packages, options.recursive ?? true);

    console.log(`Found ${packages.length} QTI packages\n`);

    // Generate summary
    const summary = generateSummary(packages);
    console.log(summary);

    // Write to file if requested
    if (options.outputFile) {
      const report = generateDetailedReport(packages);
      fs.writeFileSync(options.outputFile, report, 'utf-8');
      console.log(`\nDetailed report written to: ${options.outputFile}`);
    }
  } finally {
    // Cleanup temporary directory
    if (shouldCleanup && workingDir !== rootDir) {
      console.log('\nCleaning up temporary files...');
      fs.rmSync(path.dirname(workingDir), { recursive: true, force: true });
    }
  }
}

/**
 * Find all QTI packages recursively
 */
async function findPackages(
  dir: string,
  packages: AnalysisResult[],
  recursive: boolean
): Promise<void> {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  // Check if this directory is a QTI package
  const hasManifest = entries.some(e => e.name === 'imsmanifest.xml');
  if (hasManifest) {
    console.log(`Analyzing package: ${dir}`);
    const result = await analyzeQtiPackage(dir);
    packages.push(result);
    return; // Don't recurse into subdirectories of a package
  }

  // Recurse into subdirectories
  if (recursive) {
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        const fullPath = path.join(dir, entry.name);
        await findPackages(fullPath, packages, recursive);
      }
    }
  }
}

/**
 * Generate summary report
 */
function generateSummary(packages: AnalysisResult[]): string {
  const lines: string[] = [];

  lines.push('='.repeat(80));
  lines.push('QTI PACKAGE ANALYSIS SUMMARY');
  lines.push('='.repeat(80));
  lines.push('');

  // Aggregate stats
  const totalItems = packages.reduce((sum, p) => sum + p.itemCount, 0);
  const totalPassages = packages.reduce((sum, p) => sum + p.passageCount, 0);
  const allInteractions = new Map<string, number>();
  const allIssues: string[] = [];

  for (const pkg of packages) {
    for (const [type, count] of pkg.interactionTypes) {
      allInteractions.set(type, (allInteractions.get(type) || 0) + count);
    }
    allIssues.push(...pkg.issues);
  }

  lines.push(`Total Packages: ${packages.length}`);
  lines.push(`Total Items: ${totalItems}`);
  lines.push(`Total Passages: ${totalPassages}`);
  lines.push('');

  // Interaction types
  lines.push('Interaction Types Found:');
  lines.push('-'.repeat(40));
  const sortedInteractions = Array.from(allInteractions.entries())
    .sort((a, b) => b[1] - a[1]);

  for (const [type, count] of sortedInteractions) {
    const status = isSupported(type) ? '✅' : '❌';
    lines.push(`${status} ${type.padEnd(30)} ${count}`);
  }
  lines.push('');

  // Passage patterns
  lines.push('Passage/Stimulus Patterns:');
  lines.push('-'.repeat(40));
  let totalInline = 0;
  let totalObject = 0;
  let totalStandalone = 0;
  let totalManifestDep = 0;

  for (const pkg of packages) {
    totalInline += pkg.passagePatterns.inline;
    totalObject += pkg.passagePatterns.object;
    totalStandalone += pkg.passagePatterns.standalone;
    totalManifestDep += pkg.passagePatterns.manifestDependency;
  }

  lines.push(`✅ Inline <stimulus>:          ${totalInline}`);
  lines.push(`✅ <object> references:        ${totalObject}`);
  lines.push(`✅ Standalone passages:        ${totalStandalone}`);
  lines.push(`🚧 Manifest dependencies:      ${totalManifestDep}`);
  lines.push('');

  // Issues
  if (allIssues.length > 0) {
    lines.push(`Issues Found: ${allIssues.length}`);
    lines.push('-'.repeat(40));
    const uniqueIssues = Array.from(new Set(allIssues));
    for (const issue of uniqueIssues.slice(0, 10)) {
      lines.push(`⚠️  ${issue}`);
    }
    if (uniqueIssues.length > 10) {
      lines.push(`   ... and ${uniqueIssues.length - 10} more issues`);
    }
    lines.push('');
  }

  lines.push('='.repeat(80));

  return lines.join('\n');
}

/**
 * Generate detailed report
 */
function generateDetailedReport(packages: AnalysisResult[]): string {
  const lines: string[] = [];

  lines.push('# QTI Package Analysis - Detailed Report');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');

  for (const pkg of packages) {
    lines.push('## ' + pkg.packagePath);
    lines.push('');
    lines.push(`- Has Manifest: ${pkg.hasManifest}`);
    lines.push(`- Items: ${pkg.itemCount}`);
    lines.push(`- Passages: ${pkg.passageCount}`);
    lines.push(`- Tests: ${pkg.testCount}`);
    lines.push('');

    if (pkg.interactionTypes.size > 0) {
      lines.push('### Interaction Types');
      lines.push('');
      for (const [type, count] of Array.from(pkg.interactionTypes.entries()).sort()) {
        const status = isSupported(type) ? '✅ Supported' : '❌ Not Supported';
        lines.push(`- **${type}**: ${count} (${status})`);

        const samples = pkg.samples.interactions.get(type) || [];
        if (samples.length > 0) {
          lines.push(`  - Samples: ${samples.map(s => path.basename(s)).join(', ')}`);
        }
      }
      lines.push('');
    }

    if (Object.values(pkg.passagePatterns).some(v => v > 0)) {
      lines.push('### Passage Patterns');
      lines.push('');
      if (pkg.passagePatterns.inline > 0) {
        lines.push(`- Inline <stimulus>: ${pkg.passagePatterns.inline}`);
      }
      if (pkg.passagePatterns.object > 0) {
        lines.push(`- <object> references: ${pkg.passagePatterns.object}`);
      }
      if (pkg.passagePatterns.standalone > 0) {
        lines.push(`- Standalone passages: ${pkg.passagePatterns.standalone}`);
      }
      if (pkg.passagePatterns.manifestDependency > 0) {
        lines.push(`- Manifest dependencies: ${pkg.passagePatterns.manifestDependency}`);
      }
      lines.push('');
    }

    if (pkg.issues.length > 0) {
      lines.push('### Issues');
      lines.push('');
      for (const issue of pkg.issues) {
        lines.push(`- ⚠️ ${issue}`);
      }
      lines.push('');
    }

    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Check if interaction type is supported
 */
function isSupported(type: string): boolean {
  const supported = [
    'choiceInteraction',
    'extendedTextInteraction',
    'textEntryInteraction',
    'orderInteraction',
    'matchInteraction',
    'gapMatchInteraction',
    'inlineChoiceInteraction',
    'hotspotInteraction',
    'graphicGapMatchInteraction',
    'selectPointInteraction',
  ];

  const experimental = [
    'associateInteraction',  // Maps to categorize
  ];

  return supported.includes(type) || experimental.includes(type);
}

// Note: This file is an Oclif command module. Keep it free of top-level side effects so
// the CLI can discover commands by scanning `dist/commands` generically.
