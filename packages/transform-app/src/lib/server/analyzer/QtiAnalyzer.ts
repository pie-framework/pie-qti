/**
 * QTI Package Analyzer integration for web application
 * Wraps the CLI analyzer with web-specific functionality
 */

import { existsSync } from 'node:fs';
import { readdir, readFile, } from 'node:fs/promises';
import { join } from 'node:path';
import { loadResolvedManifest, type ResolvedManifest, toAbsolutePath } from '@pie-qti/qti2-to-pie/ims-cp';
import { parse } from 'node-html-parser';

export interface AnalysisProgress {
  stage: 'extracting' | 'scanning' | 'analyzing' | 'complete' | 'error';
  message: string;
  packagePath?: string;
  progress?: number; // 0-100
}

export interface WebAnalysisResult {
  sessionId: string;
  timestamp: Date;
  packages: PackageAnalysis[];
  totalItems: number;
  totalPassages: number;
  totalTests: number;
  allInteractionTypes: Map<string, number>;
  issues: string[];
}

export interface PackageAnalysis {
  packagePath: string;
  packageName: string;
  hasManifest: boolean;
  itemCount: number;
  passageCount: number;
  testCount: number;
  interactionTypes: Record<string, number>;
  passagePatterns: {
    inline: number;
    object: number;
    standalone: number;
    manifestDependency: number;
  };
  issues: string[];
  samples: {
    interactions: Record<string, string[]>;
    passages: string[];
    tests: string[];
  };
}

export class QtiAnalyzer {
  /**
   * Analyze all QTI packages in a session
   */
  async analyzeSession(
    sessionId: string,
    extractedPath: string,
    onProgress?: (progress: AnalysisProgress) => void
  ): Promise<WebAnalysisResult> {
    const packages: PackageAnalysis[] = [];
    const allInteractionTypes = new Map<string, number>();
    const allIssues: string[] = [];
    let totalItems = 0;
    let totalPassages = 0;
    let totalTests = 0;

    try {
      // Find all package directories
      onProgress?.({
        stage: 'scanning',
        message: 'Scanning for QTI packages...',
        progress: 10,
      });

      const packageDirs = await this.findPackageDirectories(extractedPath);

      if (packageDirs.length === 0) {
        // No extracted packages, analyze uploads directory directly
        packageDirs.push(extractedPath.replace('/extracted', '/uploads'));
      }

      // Analyze each package
      for (let i = 0; i < packageDirs.length; i++) {
        const pkgPath = packageDirs[i];
        const pkgName = pkgPath.split('/').pop() || 'unknown';

        onProgress?.({
          stage: 'analyzing',
          message: `Analyzing package: ${pkgName}`,
          packagePath: pkgPath,
          progress: 20 + Math.floor((i / packageDirs.length) * 70),
        });

        try {
          const result = await this.analyzePackage(pkgPath);

          packages.push(result);

          totalItems += result.itemCount;
          totalPassages += result.passageCount;
          totalTests += result.testCount;
          allIssues.push(...result.issues);

          // Aggregate interaction types
          Object.entries(result.interactionTypes).forEach(([type, count]) => {
            allInteractionTypes.set(type, (allInteractionTypes.get(type) || 0) + count);
          });
        } catch (error) {
          const errorMsg = `Failed to analyze ${pkgName}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          allIssues.push(errorMsg);
          console.error(errorMsg, error);
        }
      }

      onProgress?.({
        stage: 'complete',
        message: 'Analysis complete',
        progress: 100,
      });

      // Check for unsupported interaction types
      const unsupportedInteractionTypes = [
        'graphicOrderInteraction',
        'graphicAssociateInteraction',
        'positionObjectInteraction',
        'sliderInteraction',
        'mediaInteraction',
        'drawingInteraction',
        'uploadInteraction',
        'customInteraction',
        'endAttemptInteraction',
      ];

      const experimentalInteractionTypes = ['associateInteraction'];

      const unsupportedFound: string[] = [];
      const experimentalFound: string[] = [];

      for (const [type, count] of allInteractionTypes.entries()) {
        if (unsupportedInteractionTypes.includes(type)) {
          unsupportedFound.push(`${count} item${count > 1 ? 's' : ''} use unsupported ${type} (cannot convert to PIE)`);
        } else if (experimentalInteractionTypes.includes(type)) {
          experimentalFound.push(`${count} item${count > 1 ? 's' : ''} use ${type} (converts to PIE categorize with fidelity loss)`);
        }
      }

      if (unsupportedFound.length > 0) {
        allIssues.push('⚠️ UNSUPPORTED INTERACTIONS - These items CANNOT be converted to PIE:');
        allIssues.push(...unsupportedFound.map(msg => `  • ${msg}`));
      }

      if (experimentalFound.length > 0) {
        allIssues.push('⚠️ EXPERIMENTAL CONVERSIONS - These items will convert with warnings:');
        allIssues.push(...experimentalFound.map(msg => `  • ${msg}`));
      }

      return {
        sessionId,
        timestamp: new Date(),
        packages,
        totalItems,
        totalPassages,
        totalTests,
        allInteractionTypes,
        issues: allIssues,
      };
    } catch (error) {
      onProgress?.({
        stage: 'error',
        message: error instanceof Error ? error.message : 'Analysis failed',
        progress: 0,
      });

      throw error;
    }
  }

  /**
   * Analyze a single QTI package directory
   */
  private async analyzePackage(packagePath: string): Promise<PackageAnalysis> {
    const packageName = packagePath.split('/').pop() || 'unknown';
    const result: PackageAnalysis = {
      packagePath,
      packageName,
      hasManifest: false,
      itemCount: 0,
      passageCount: 0,
      testCount: 0,
      interactionTypes: {},
      passagePatterns: {
        inline: 0,
        object: 0,
        standalone: 0,
        manifestDependency: 0,
      },
      issues: [],
      samples: {
        interactions: {},
        passages: [],
        tests: [],
      },
    };

    // Prefer manifest when available (more reliable for tests/passages + dependencies)
    let resolvedManifest: ResolvedManifest | null = null;
    try {
      resolvedManifest = await loadResolvedManifest(packagePath);
      result.hasManifest = true;

      // Use manifest counts as authoritative when present
      result.itemCount = resolvedManifest.items.length;
      result.passageCount = resolvedManifest.passages.length;
      result.testCount = resolvedManifest.tests.length;

      // Sample tests/passages from manifest (absolute file paths)
      for (const test of resolvedManifest.tests.slice(0, 3)) {
        const rel = test.hrefResolved || test.href;
        if (!rel) continue;
        const abs = toAbsolutePath(packagePath, rel);
        if (existsSync(abs)) result.samples.tests.push(abs);
      }

      for (const passage of resolvedManifest.passages.slice(0, 5)) {
        const rel = passage.hrefResolved || passage.href;
        if (!rel) continue;
        const abs = toAbsolutePath(packagePath, rel);
        if (existsSync(abs)) result.samples.passages.push(abs);
      }

      // Manifest dependency pattern: items -> passage-like resources
      const passageIds = new Set(resolvedManifest.passages.map((p) => p.identifier));
      for (const item of resolvedManifest.items) {
        const deps = item.dependencies.filter((d) => passageIds.has(d));
        result.passagePatterns.manifestDependency += deps.length;
      }
    } catch {
      // No manifest (or failed to parse) - fall back to scan-based detection
      resolvedManifest = null;
    }

    // Scan all XML files in the package
    await this.scanDirectoryForQti(packagePath, result, !!resolvedManifest);

    return result;
  }

  /**
   * Scan directory for QTI content
   */
  private async scanDirectoryForQti(
    dirPath: string,
    result: PackageAnalysis,
    useManifestCounts: boolean
  ): Promise<void> {
    if (!existsSync(dirPath)) {
      return;
    }

    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);

      if (entry.isDirectory()) {
        // Recursively scan subdirectories
        await this.scanDirectoryForQti(fullPath, result, useManifestCounts);
      } else if (entry.name.toLowerCase().endsWith('.xml')) {
        await this.analyzeXmlFile(fullPath, result, useManifestCounts);
      }
    }
  }

  /**
   * Analyze a single XML file
   */
  private async analyzeXmlFile(filePath: string, result: PackageAnalysis, useManifestCounts: boolean): Promise<void> {
    try {
      const content = await readFile(filePath, 'utf-8');
      const _doc = parse(content, {
        lowerCaseTagName: false,
        comment: false,
        blockTextElements: {
          script: false,
          noscript: false,
          style: false,
          pre: false
        }
      });

      // Check for assessment item (simple text search since namespace handling is tricky)
      const rawContent = content.toLowerCase();
      const hasAssessmentItem = rawContent.includes('<assessmentitem');

      if (hasAssessmentItem) {
        if (!useManifestCounts) result.itemCount++;

        // Use the doc for finding interactions

        // Find interactions using text search (more reliable with namespaced XML)
        const interactionTypes = [
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
          'mediaInteraction',
          'positionObjectInteraction',
          'drawingInteraction',
          'uploadInteraction',
          'customInteraction',
        ];

        for (const interactionType of interactionTypes) {
          const searchTerm = `<${interactionType.toLowerCase()}`;
          const regex = new RegExp(searchTerm, 'gi');
          const matches = rawContent.match(regex);
          const count = matches ? matches.length : 0;

          if (count > 0) {
            result.interactionTypes[interactionType] =
              (result.interactionTypes[interactionType] || 0) + count;

            // Store sample
            if (!result.samples.interactions[interactionType]) {
              result.samples.interactions[interactionType] = [];
            }
            if (result.samples.interactions[interactionType].length < 3) {
              result.samples.interactions[interactionType].push(filePath);
            }
          }
        }

        // Check for inline stimulus
        if (rawContent.includes('<stimulus')) {
          result.passagePatterns.inline++;
        }

        // Check for object references
        const objectMatches = rawContent.match(/<object\s/gi);
        if (objectMatches) {
          result.passagePatterns.object += objectMatches.length;
        }
      }

      // Check for assessment test
      if (rawContent.includes('<assessmenttest')) {
        if (!useManifestCounts) result.testCount++;
        if (result.samples.tests.length < 3) {
          result.samples.tests.push(filePath);
        }
      }

      // Check for standalone passage/stimulus
      if (rawContent.includes('<assessmentstimulus')) {
        if (!useManifestCounts) result.passageCount++;
        result.passagePatterns.standalone++;
        if (result.samples.passages.length < 5) {
          result.samples.passages.push(filePath);
        }
      }
    } catch (error) {
      result.issues.push(`Failed to parse ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Find QTI package directories (directories containing imsmanifest.xml or QTI items)
   */
  private async findPackageDirectories(rootDir: string): Promise<string[]> {
    const packages: string[] = [];

    if (!existsSync(rootDir)) {
      return packages;
    }

    // Check if root itself is a package
    if (existsSync(join(rootDir, 'imsmanifest.xml'))) {
      packages.push(rootDir);
      return packages;
    }

    // Check subdirectories
    const entries = await readdir(rootDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const subDir = join(rootDir, entry.name);
        const hasManifest = existsSync(join(subDir, 'imsmanifest.xml'));

        if (hasManifest) {
          packages.push(subDir);
        } else {
          // Recursively check subdirectories (one level deep)
          const subPackages = await this.findPackageDirectories(subDir);
          packages.push(...subPackages);
        }
      }
    }

    return packages;
  }
}

// Singleton instance
let analyzerInstance: QtiAnalyzer | null = null;

export function getQtiAnalyzer(): QtiAnalyzer {
  if (!analyzerInstance) {
    analyzerInstance = new QtiAnalyzer();
  }
  return analyzerInstance;
}
