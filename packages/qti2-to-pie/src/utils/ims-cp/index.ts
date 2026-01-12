/**
 * Minimal IMS Content Package (IMS CP) utilities.
 *
 * Scope (intentional):
 * - Open a package from a directory OR extract a zip into a temp directory
 * - Locate imsmanifest.xml (root or nested)
 * - Parse manifest (reusing parseManifest) and resolve hrefs/files to paths within the package
 *
 * This is meant as a small shared layer for server-side tools (CLI, transform-app).
 */

import { createReadStream, createWriteStream, existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import * as unzipper from 'unzipper';
import { type ManifestResource, type ParsedManifest, parseManifest } from '../manifest-parser.js';
import { type LocalizedManifest, buildLocalizedManifest } from '../localized-resources.js';

export type OpenContentPackageOptions = {
  /**
   * Optional directory where temporary extractions should be created.
   * Defaults to OS temp dir.
   */
  tmpRootDir?: string;
  /**
   * Extract into an explicit directory (instead of a random temp folder).
   * When set, `close()` is a no-op and `isTemporary` is false.
   */
  extractToDir?: string;
};

export type OpenContentPackage = {
  /** Absolute filesystem root directory for the opened package */
  packageRoot: string;
  /** True if we extracted a zip into a temp directory */
  isTemporary: boolean;
  /** Clean up extracted temp dir (no-op for folder packages) */
  close: () => Promise<void>;
};

export type ExtractZipResult = {
  fileCount: number;
  totalSize: number;
};

export type ResolvedManifestResource = ManifestResource & {
  /**
   * Resource main href resolved to a normalized package-relative POSIX path.
   * (Use `toAbsolutePath` to read from disk.)
   */
  hrefResolved?: string;
  /** All resource files resolved to normalized package-relative POSIX paths */
  filesResolved: string[];
};

export type ResolvedManifest = Omit<ParsedManifest, 'resources' | 'items' | 'passages' | 'tests'> & {
  /** Manifest file location, package-relative POSIX path */
  manifestPath: string;
  resources: Map<string, ResolvedManifestResource>;
  items: ResolvedManifestResource[];
  passages: ResolvedManifestResource[];
  tests: ResolvedManifestResource[];
};

function isZipPath(p: string) {
  const lower = p.toLowerCase();
  return lower.endsWith('.zip') || lower.endsWith('.imscc');
}

async function ensureDir(p: string) {
  await mkdir(p, { recursive: true });
}

function isUnsafeZipEntryPath(entryPath: string) {
  // Basic traversal checks.
  if (!entryPath) return true;
  if (entryPath.includes('..')) return true;
  if (entryPath.startsWith('/') || entryPath.startsWith('\\')) return true;
  return false;
}

function assertPathWithinDir(rootDir: string, candidatePath: string) {
  const root = path.resolve(rootDir);
  const candidate = path.resolve(candidatePath);
  const prefix = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
  if (candidate !== root && !candidate.startsWith(prefix)) {
    throw new Error(`Zip entry path escapes target directory: ${candidatePath}`);
  }
}

/**
 * Safe zip extractor with path traversal protection.
 * Returns simple stats (file count + total uncompressed size).
 */
export async function extractZipToDirSafe(zipPath: string, targetDir: string): Promise<ExtractZipResult> {
  await ensureDir(targetDir);

  const directory = await unzipper.Open.file(zipPath);
  let fileCount = 0;
  let totalSize = 0;

  for (const file of directory.files) {
    const entryPath = file.path;
    if (isUnsafeZipEntryPath(entryPath)) continue;

    const outPath = path.join(targetDir, entryPath);
    assertPathWithinDir(targetDir, outPath);

    if (file.type === 'Directory') {
      await ensureDir(outPath);
      continue;
    }

    await ensureDir(path.dirname(outPath));
    await new Promise<void>((resolve, reject) => {
      file
        .stream()
        .pipe(createWriteStream(outPath))
        .on('finish', resolve)
        .on('error', reject);
    });

    fileCount += 1;
    totalSize += file.uncompressedSize ?? 0;
  }

  return { fileCount, totalSize };
}

/**
 * Open a content package from either:
 * - a directory path
 * - a zip/imscc path (extracted to temp)
 */
export async function openContentPackage(
  inputPath: string,
  options: OpenContentPackageOptions = {}
): Promise<OpenContentPackage> {
  const abs = path.resolve(inputPath);

  if (!isZipPath(abs)) {
    return {
      packageRoot: abs,
      isTemporary: false,
      close: async () => {},
    };
  }

  if (options.extractToDir) {
    const targetDir = path.resolve(options.extractToDir);
    await extractZipToDirSafe(abs, targetDir);
    return {
      packageRoot: targetDir,
      isTemporary: false,
      close: async () => {},
    };
  }

  const tmpRoot = options.tmpRootDir ? path.resolve(options.tmpRootDir) : tmpdir();
  await ensureDir(tmpRoot);

  const targetDir = path.join(tmpRoot, `qti-cp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  await ensureDir(targetDir);

  await extractZipToDirSafe(abs, targetDir);

  return {
    packageRoot: targetDir,
    isTemporary: true,
    close: async () => {
      await rm(targetDir, { recursive: true, force: true });
    },
  };
}

/**
 * Locate `imsmanifest.xml` in a package directory.
 * - checks root first
 * - otherwise scans subdirectories (bounded, skips node_modules and dot folders)
 */
export async function findManifestPath(packageRoot: string): Promise<string | null> {
  const root = path.resolve(packageRoot);
  const rootCandidate = path.join(root, 'imsmanifest.xml');
  if (existsSync(rootCandidate)) return rootCandidate;

  const queue: string[] = [root];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const dir = queue.shift()!;
    if (visited.has(dir)) continue;
    visited.add(dir);

    let entries: Array<{ name: string; isDirectory: () => boolean }> = [];
    try {
      entries = (await readdir(dir, { withFileTypes: true })) as any;
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules') continue;
        if (entry.name.startsWith('.')) continue;
        queue.push(path.join(dir, entry.name));
        continue;
      }

      if (entry.name === 'imsmanifest.xml') {
        return path.join(dir, entry.name);
      }
    }
  }

  return null;
}

function toPosixPath(p: string) {
  return p.split(path.sep).join('/');
}

function normalizePosix(p: string) {
  // Normalize and prevent absolute/escape paths.
  const normalized = path.posix.normalize(p);
  const trimmed = normalized.replace(/^\/+/, '');
  if (trimmed.startsWith('..')) {
    throw new Error(`Resolved path escapes package root: ${p}`);
  }
  return trimmed;
}

function joinPosix(...parts: Array<string | undefined>) {
  const filtered = parts.filter((p): p is string => !!p && p.length > 0);
  return normalizePosix(path.posix.join(...filtered));
}

function applyXmlBase(parentBase: string, xmlBase?: string) {
  if (!xmlBase) return parentBase;
  // xml:base can be absolute URI; we treat it as a path-like base and normalize to a package-relative path
  // for our file-resolution use-case.
  return joinPosix(parentBase, xmlBase);
}

/**
 * Resolve a package-relative POSIX path to an absolute filesystem path under packageRoot.
 */
export function toAbsolutePath(packageRoot: string, packageRelativePosixPath: string): string {
  const rel = packageRelativePosixPath.split('/').join(path.sep);
  return path.resolve(path.join(packageRoot, rel));
}

/**
 * Parse and resolve a manifest from disk.
 */
export async function loadResolvedManifest(packageRoot: string): Promise<ResolvedManifest> {
  const manifestFsPath = await findManifestPath(packageRoot);
  if (!manifestFsPath) {
    throw new Error('No imsmanifest.xml found in package');
  }

  const manifestXml = await readFile(manifestFsPath, 'utf-8');
  const parsed = parseManifest(manifestXml, packageRoot);

  // manifestPath relative to packageRoot (POSIX)
  const manifestRel = normalizePosix(toPosixPath(path.relative(path.resolve(packageRoot), manifestFsPath)));
  const manifestRelDir = path.posix.dirname(manifestRel === 'imsmanifest.xml' ? '' : manifestRel);

  const baseManifest = applyXmlBase(manifestRelDir === '.' ? '' : manifestRelDir, parsed.xmlBase);

  const resolveResource = (r: ManifestResource): ResolvedManifestResource => {
    const baseResource = applyXmlBase(baseManifest, r.xmlBase);
    const hrefResolved = r.href ? joinPosix(baseResource, r.href) : undefined;
    const filesResolved = (r.files ?? []).map((f) => joinPosix(baseResource, f));
    return { ...r, hrefResolved, filesResolved };
  };

  const resources = new Map<string, ResolvedManifestResource>();
  for (const [id, r] of parsed.resources.entries()) {
    resources.set(id, resolveResource(r));
  }

  const items = parsed.items.map(resolveResource);
  const passages = parsed.passages.map(resolveResource);
  const tests = parsed.tests.map(resolveResource);

  return {
    identifier: parsed.identifier,
    xmlBase: parsed.xmlBase,
    basePath: parsed.basePath,
    manifestPath: manifestRel,
    resources,
    items,
    passages,
    tests,
  };
}

/**
 * Utility: quickly extract a zip to a directory (stream-based) when you need progress reporting.
 * Most callers can just use `openContentPackage` which uses unzipper's Open.file().extract().
 */
export async function extractZipToDir(zipPath: string, targetDir: string): Promise<void> {
  await ensureDir(targetDir);
  await extractZipToDirSafe(zipPath, targetDir);
}

/**
 * Stream-safe extractor variant (kept for very large packages).
 */
export async function extractZipToDirStream(zipPath: string, targetDir: string): Promise<void> {
  await ensureDir(targetDir);

  await createReadStream(zipPath)
    .pipe(unzipper.Extract({ path: targetDir }))
    .promise();
}

/**
 * Resolved manifest with localized resource grouping.
 */
export type LocalizedResolvedManifest = ResolvedManifest & {
  /** Localized view of manifest resources grouped by base ID and locale */
  localized: LocalizedManifest;
};

/**
 * Load and resolve a manifest with localized resource grouping.
 *
 * Combines standard manifest resolution with locale-aware resource grouping,
 * enabling easy lookup of content variants by locale.
 *
 * @param packageRoot Absolute path to package root directory
 * @param defaultLocale Default locale for resources without locale info (default: "en-US")
 * @returns Resolved manifest with localized resource groups
 *
 * @example
 * ```typescript
 * const manifest = await loadLocalizedResolvedManifest('/path/to/package');
 *
 * // Access standard resolved resources
 * console.log(manifest.items.length);
 *
 * // Access localized grouping
 * const item = getLocalizedItem(manifest.localized, 'simple-choice', 'es-ES');
 * console.log(manifest.localized.availableLocales); // Set { "en-US", "es-ES", "fr-FR" }
 * ```
 */
export async function loadLocalizedResolvedManifest(
  packageRoot: string,
  defaultLocale: string = 'en-US'
): Promise<LocalizedResolvedManifest> {
  const resolved = await loadResolvedManifest(packageRoot);

  // Build localized view from the parsed manifest
  const localized = buildLocalizedManifest(resolved, defaultLocale);

  return {
    ...resolved,
    localized,
  };
}


