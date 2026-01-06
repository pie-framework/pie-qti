/**
 * QTI Package Discovery Tool
 *
 * Explores and displays the structure of a QTI package:
 * - ZIP file contents
 * - Manifest file details
 * - Item and passage inventory
 * - Dependencies and relationships
 * - Media assets
 */

import { loadResolvedManifest, openContentPackage, type ResolvedManifest, toAbsolutePath } from '@pie-qti/qti2-to-pie/ims-cp';
import * as fs from 'fs';
import type { HTMLElement } from 'node-html-parser';
import { parse } from 'node-html-parser';
import * as path from 'path';

interface DiscoveryResult {
  packagePath: string;
  isZip: boolean;
  files: {
    path: string;
    size: number;
    type: 'xml' | 'html' | 'image' | 'audio' | 'video' | 'other';
  }[];
  manifest?: {
    identifier?: string;
    itemCount: number;
    passageCount: number;
    testCount: number;
    resources: Array<{
      identifier: string;
      type: string;
      href?: string;
      dependencies: string[];
    }>;
  };
  items: Array<{
    file: string;
    identifier: string;
    title: string;
    interactionTypes: string[];
    hasStimulus: boolean;
    objectReferences: string[];
    dependencies: string[];
  }>;
  passages: Array<{
    file: string;
    identifier: string;
    title: string;
  }>;
  tests: Array<{
    file: string;
    identifier: string;
    title: string;
    itemCount: number;
  }>;
  mediaAssets: {
    images: string[];
    audio: string[];
    video: string[];
    other: string[];
  };
}

/**
 * Discover and explore a QTI package (ZIP or directory)
 */
export async function discoverQtiPackage(
  packagePath: string,
  options?: {
    extractDir?: string;
    verbose?: boolean;
  }
): Promise<DiscoveryResult> {
  const lower = packagePath.toLowerCase();
  const isZip = lower.endsWith('.zip') || lower.endsWith('.imscc');

  const pkg = await openContentPackage(packagePath, options?.extractDir ? { extractToDir: options.extractDir } : {});
  const workingDir = pkg.packageRoot;

  try {
    const result = await explorePackage(workingDir, packagePath, isZip);
    await pkg.close();

    return result;
  } catch (error) {
    await pkg.close();
    throw error;
  }
}

/**
 * Explore package directory structure
 */
async function explorePackage(
  workingDir: string,
  originalPath: string,
  isZip: boolean
): Promise<DiscoveryResult> {
  const result: DiscoveryResult = {
    packagePath: originalPath,
    isZip,
    files: [],
    items: [],
    passages: [],
    tests: [],
    mediaAssets: {
      images: [],
      audio: [],
      video: [],
      other: [],
    },
  };

  // Scan all files
  await scanDirectory(workingDir, workingDir, result);

  // Look for manifest (supports nested manifests)
  let parsedManifest: ResolvedManifest | null = null;
  try {
    parsedManifest = await loadResolvedManifest(workingDir);
  } catch {
    parsedManifest = null;
  }

  if (parsedManifest) {

    result.manifest = {
      identifier: parsedManifest.identifier,
      itemCount: parsedManifest.items.length,
      passageCount: parsedManifest.passages.length,
      testCount: parsedManifest.tests.length,
      resources: Array.from(parsedManifest.resources.values()).map(r => ({
        identifier: r.identifier,
        type: r.type,
        href: r.hrefResolved || r.href,
        dependencies: r.dependencies,
      })),
    };

    // Process items
    for (const itemResource of parsedManifest.items) {
      const rel = itemResource.hrefResolved || itemResource.href;
      if (rel) {
        const itemPath = toAbsolutePath(workingDir, rel);
        if (fs.existsSync(itemPath)) {
          const itemInfo = await analyzeItem(itemPath, itemResource.identifier, parsedManifest);
          result.items.push(itemInfo);
        }
      }
    }

    // Process passages
    for (const passageResource of parsedManifest.passages) {
      const rel = passageResource.hrefResolved || passageResource.href;
      if (rel) {
        const passagePath = toAbsolutePath(workingDir, rel);
        if (fs.existsSync(passagePath)) {
          const passageInfo = await analyzePassage(passagePath, passageResource.identifier);
          result.passages.push(passageInfo);
        }
      }
    }

    // Process tests
    for (const testResource of parsedManifest.tests) {
      const rel = testResource.hrefResolved || testResource.href;
      if (rel) {
        const testPath = toAbsolutePath(workingDir, rel);
        if (fs.existsSync(testPath)) {
          const testInfo = await analyzeTest(testPath, testResource.identifier);
          result.tests.push(testInfo);
        }
      }
    }
  } else {
    // No manifest - scan for items directly
    const xmlFiles = result.files.filter(f => f.type === 'xml');
    for (const file of xmlFiles) {
      const filePath = path.join(workingDir, file.path);
      try {
        const xml = fs.readFileSync(filePath, 'utf-8');
        const doc = parse(xml, { lowerCaseTagName: false });

        const assessmentItem = doc.querySelector('assessmentItem') ||
                              doc.getElementsByTagName('assessmentItem')[0];

        if (assessmentItem) {
          const itemInfo = await analyzeItem(filePath,
            assessmentItem.getAttribute('identifier') || path.basename(file.path),
            undefined
          );
          result.items.push(itemInfo);
        }

        const assessmentStimulus = doc.querySelector('assessmentStimulus') ||
                                  doc.getElementsByTagName('assessmentStimulus')[0];

        if (assessmentStimulus) {
          const passageInfo = await analyzePassage(filePath,
            assessmentStimulus.getAttribute('identifier') || path.basename(file.path)
          );
          result.passages.push(passageInfo);
        }
      } catch (_error) {
        // Skip files that can't be parsed
      }
    }
  }

  return result;
}

/**
 * Recursively scan directory
 */
async function scanDirectory(
  dir: string,
  baseDir: string,
  result: DiscoveryResult
): Promise<void> {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;

    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(baseDir, fullPath);

    if (entry.isDirectory()) {
      await scanDirectory(fullPath, baseDir, result);
    } else {
      const stats = fs.statSync(fullPath);
      const fileType = getFileType(entry.name);

      result.files.push({
        path: relativePath,
        size: stats.size,
        type: fileType,
      });

      // Categorize media assets
      const ext = path.extname(entry.name).toLowerCase();
      if (['.jpg', '.jpeg', '.png', '.gif', '.svg', '.bmp'].includes(ext)) {
        result.mediaAssets.images.push(relativePath);
      } else if (['.mp3', '.wav', '.ogg', '.m4a'].includes(ext)) {
        result.mediaAssets.audio.push(relativePath);
      } else if (['.mp4', '.webm', '.mov', '.avi'].includes(ext)) {
        result.mediaAssets.video.push(relativePath);
      } else if (!['xml', 'html'].includes(fileType)) {
        result.mediaAssets.other.push(relativePath);
      }
    }
  }
}

/**
 * Get file type from extension
 */
function getFileType(filename: string): 'xml' | 'html' | 'image' | 'audio' | 'video' | 'other' {
  const ext = path.extname(filename).toLowerCase();

  if (ext === '.xml') return 'xml';
  if (['.html', '.htm'].includes(ext)) return 'html';
  if (['.jpg', '.jpeg', '.png', '.gif', '.svg', '.bmp'].includes(ext)) return 'image';
  if (['.mp3', '.wav', '.ogg', '.m4a'].includes(ext)) return 'audio';
  if (['.mp4', '.webm', '.mov', '.avi'].includes(ext)) return 'video';

  return 'other';
}

/**
 * Analyze an assessment item
 */
async function analyzeItem(
  itemPath: string,
  identifier: string,
  manifest?: ResolvedManifest
): Promise<DiscoveryResult['items'][0]> {
  const xml = fs.readFileSync(itemPath, 'utf-8');
  const doc = parse(xml, { lowerCaseTagName: false });

  const assessmentItem = doc.querySelector('assessmentItem') ||
                        doc.getElementsByTagName('assessmentItem')[0];

  if (!assessmentItem) {
    throw new Error(`No assessmentItem found in ${itemPath}`);
  }

  const itemBody = assessmentItem.querySelector('itemBody') ||
                   assessmentItem.getElementsByTagName('itemBody')[0];

  // Detect interaction types
  const interactionTypes: Set<string> = new Set();
  const allInteractions = [
    'choiceInteraction', 'extendedTextInteraction', 'textEntryInteraction',
    'orderInteraction', 'matchInteraction', 'associateInteraction',
    'gapMatchInteraction', 'inlineChoiceInteraction', 'hottextInteraction',
    'hotspotInteraction', 'graphicGapMatchInteraction', 'selectPointInteraction',
    'graphicOrderInteraction', 'graphicAssociateInteraction',
    'sliderInteraction', 'positionObjectInteraction', 'drawingInteraction',
    'uploadInteraction', 'customInteraction',
  ];

  if (itemBody) {
    for (const interactionType of allInteractions) {
      const elements = itemBody.getElementsByTagName(interactionType);
      if (elements.length > 0) {
        interactionTypes.add(interactionType);
      }
    }
  }

  // Check for stimulus
  const hasStimulus = itemBody ?
    (itemBody.getElementsByTagName('stimulus').length > 0) : false;

  // Find object references
  const objectReferences: string[] = [];
  if (itemBody) {
    const objects = itemBody.getElementsByTagName('object');
    for (const obj of Array.from(objects) as HTMLElement[]) {
      const data = obj.getAttribute('data');
      if (data) {
        objectReferences.push(data);
      }
    }
  }

  // Get dependencies from manifest
  let dependencies: string[] = [];
  if (manifest) {
    const resource = manifest.resources.get(identifier);
    if (resource) {
      dependencies = resource.dependencies;
    }
  }

  return {
    file: path.basename(itemPath),
    identifier,
    title: assessmentItem.getAttribute('title') || identifier,
    interactionTypes: Array.from(interactionTypes),
    hasStimulus,
    objectReferences,
    dependencies,
  };
}

/**
 * Analyze a passage/stimulus
 */
async function analyzePassage(
  passagePath: string,
  identifier: string
): Promise<DiscoveryResult['passages'][0]> {
  const xml = fs.readFileSync(passagePath, 'utf-8');
  const doc = parse(xml, { lowerCaseTagName: false });

  const assessmentStimulus = doc.querySelector('assessmentStimulus') ||
                            doc.getElementsByTagName('assessmentStimulus')[0] ||
                            doc.querySelector('assessmentPassage') ||
                            doc.getElementsByTagName('assessmentPassage')[0];

  return {
    file: path.basename(passagePath),
    identifier,
    title: assessmentStimulus?.getAttribute('title') || identifier,
  };
}

/**
 * Analyze a test
 */
async function analyzeTest(
  testPath: string,
  identifier: string
): Promise<DiscoveryResult['tests'][0]> {
  const xml = fs.readFileSync(testPath, 'utf-8');
  const doc = parse(xml, { lowerCaseTagName: false });

  const assessmentTest = doc.querySelector('assessmentTest') ||
                        doc.getElementsByTagName('assessmentTest')[0];

  // Count item refs
  const itemRefs = assessmentTest?.getElementsByTagName('assessmentItemRef') || [];

  return {
    file: path.basename(testPath),
    identifier,
    title: assessmentTest?.getAttribute('title') || identifier,
    itemCount: itemRefs.length,
  };
}

/**
 * Display discovery results in a human-readable format
 */
export function displayDiscoveryResults(result: DiscoveryResult): void {
  console.log('='.repeat(80));
  console.log('QTI PACKAGE DISCOVERY');
  console.log('='.repeat(80));
  console.log();

  console.log(`Package: ${result.packagePath}`);
  console.log(`Type: ${result.isZip ? 'ZIP Archive' : 'Directory'}`);
  console.log();

  // File summary
  console.log('File Summary:');
  console.log('-'.repeat(40));
  const xmlCount = result.files.filter(f => f.type === 'xml').length;
  const htmlCount = result.files.filter(f => f.type === 'html').length;
  const imageCount = result.mediaAssets.images.length;
  const audioCount = result.mediaAssets.audio.length;
  const videoCount = result.mediaAssets.video.length;

  console.log(`  XML files:     ${xmlCount}`);
  console.log(`  HTML files:    ${htmlCount}`);
  console.log(`  Images:        ${imageCount}`);
  console.log(`  Audio:         ${audioCount}`);
  console.log(`  Video:         ${videoCount}`);
  console.log(`  Total files:   ${result.files.length}`);
  console.log();

  // Manifest
  if (result.manifest) {
    console.log('Manifest (imsmanifest.xml):');
    console.log('-'.repeat(40));
    console.log(`  Identifier:    ${result.manifest.identifier || 'N/A'}`);
    console.log(`  Items:         ${result.manifest.itemCount}`);
    console.log(`  Passages:      ${result.manifest.passageCount}`);
    console.log(`  Tests:         ${result.manifest.testCount}`);
    console.log(`  Resources:     ${result.manifest.resources.length}`);
    console.log();
  } else {
    console.log('⚠️  No manifest file found');
    console.log();
  }

  // Items
  if (result.items.length > 0) {
    console.log(`Items (${result.items.length}):`);
    console.log('-'.repeat(40));

    for (const item of result.items) {
      console.log(`  📄 ${item.file}`);
      console.log(`     ID: ${item.identifier}`);
      console.log(`     Title: ${item.title}`);
      console.log(`     Interactions: ${item.interactionTypes.join(', ') || 'None'}`);
      if (item.hasStimulus) {
        console.log(`     ⚠️  Has inline stimulus`);
      }
      if (item.objectReferences.length > 0) {
        console.log(`     Objects: ${item.objectReferences.length} reference(s)`);
      }
      if (item.dependencies.length > 0) {
        console.log(`     Dependencies: ${item.dependencies.join(', ')}`);
      }
      console.log();
    }
  }

  // Passages
  if (result.passages.length > 0) {
    console.log(`Passages (${result.passages.length}):`);
    console.log('-'.repeat(40));

    for (const passage of result.passages) {
      console.log(`  📖 ${passage.file}`);
      console.log(`     ID: ${passage.identifier}`);
      console.log(`     Title: ${passage.title}`);
      console.log();
    }
  }

  // Tests
  if (result.tests.length > 0) {
    console.log(`Tests (${result.tests.length}):`);
    console.log('-'.repeat(40));

    for (const test of result.tests) {
      console.log(`  📝 ${test.file}`);
      console.log(`     ID: ${test.identifier}`);
      console.log(`     Title: ${test.title}`);
      console.log(`     Items: ${test.itemCount}`);
      console.log();
    }
  }

  // Media assets
  if (result.mediaAssets.images.length > 0 ||
      result.mediaAssets.audio.length > 0 ||
      result.mediaAssets.video.length > 0) {
    console.log('Media Assets:');
    console.log('-'.repeat(40));

    if (result.mediaAssets.images.length > 0) {
      console.log(`  Images (${result.mediaAssets.images.length}):`);
      result.mediaAssets.images.slice(0, 5).forEach(img => {
        console.log(`    - ${img}`);
      });
      if (result.mediaAssets.images.length > 5) {
        console.log(`    ... and ${result.mediaAssets.images.length - 5} more`);
      }
    }

    if (result.mediaAssets.audio.length > 0) {
      console.log(`  Audio (${result.mediaAssets.audio.length}):`);
      result.mediaAssets.audio.slice(0, 5).forEach(audio => {
        console.log(`    - ${audio}`);
      });
      if (result.mediaAssets.audio.length > 5) {
        console.log(`    ... and ${result.mediaAssets.audio.length - 5} more`);
      }
    }

    if (result.mediaAssets.video.length > 0) {
      console.log(`  Video (${result.mediaAssets.video.length}):`);
      result.mediaAssets.video.slice(0, 5).forEach(video => {
        console.log(`    - ${video}`);
      });
      if (result.mediaAssets.video.length > 5) {
        console.log(`    ... and ${result.mediaAssets.video.length - 5} more`);
      }
    }
    console.log();
  }

  console.log('='.repeat(80));
}

// CLI entry point (ES module compatible)
const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: discover-qti <package-path>');
    console.error('  package-path: Path to QTI ZIP file or directory');
    process.exit(1);
  }

  const packagePath = args[0];

  discoverQtiPackage(packagePath)
    .then(result => {
      displayDiscoveryResults(result);
      process.exit(0);
    })
    .catch(error => {
      console.error('Error:', error.message);
      process.exit(1);
    });
}
