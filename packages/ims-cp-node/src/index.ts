/**
 * Node.js-specific IMS Content Package (IMS CP) utilities.
 *
 * Scope:
 * - Open a package from a directory OR extract a zip into a temp directory
 * - Locate imsmanifest.xml (root or nested)
 * - Parse manifest (using @pie-qti/ims-cp-core) and resolve hrefs/files to paths within the package
 *
 * This is meant as a shared layer for server-side tools (CLI).
 */

import { createWriteStream, existsSync } from 'node:fs';
import { lstat, mkdir, readdir, readFile, realpath, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import * as unzipper from 'unzipper';
import { type ManifestResource, type ParsedManifest, parseManifest } from '@pie-qti/ims-cp-core/manifest-parser';
import { type LocalizedManifest, buildLocalizedManifest } from '@pie-qti/ims-cp-core/localized-resources';

export type ArchiveExtractionLimits = {
  /** Maximum compressed ZIP input size in bytes (default: 100MB). */
  maxCompressedSize?: number;
  /** Maximum cumulative uncompressed size in bytes (default: 250MB). */
  maxTotalUncompressedSize?: number;
  /** Maximum number of ZIP entries, including directories (default: 1000). */
  maxEntries?: number;
  /** Maximum advertised uncompressed/compressed ratio per file (default: 200). */
  maxCompressionRatio?: number;
};

export type OpenContentPackageOptions = ArchiveExtractionLimits & {
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

type ResolvedArchiveLimits = Required<ArchiveExtractionLimits>;

const DEFAULT_ARCHIVE_LIMITS: ResolvedArchiveLimits = {
  maxCompressedSize: 100 * 1024 * 1024,
  maxTotalUncompressedSize: 250 * 1024 * 1024,
  maxEntries: 1000,
  maxCompressionRatio: 200,
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

async function assertNoSymlinkEscape(rootDir: string, candidatePath: string): Promise<void> {
  let existingPath = path.resolve(candidatePath);

  while (true) {
    try {
      await lstat(existingPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;

      const parentPath = path.dirname(existingPath);
      if (parentPath === existingPath) throw error;
      existingPath = parentPath;
      continue;
    }

    let realExistingPath: string;
    try {
      realExistingPath = await realpath(existingPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      throw new Error(`Zip entry path contains an unresolved symbolic link: ${candidatePath}`);
    }

    assertPathWithinDir(rootDir, realExistingPath);
    return;
  }
}

function resolveArchiveLimits(options: ArchiveExtractionLimits): ResolvedArchiveLimits {
  return {
    maxCompressedSize: resolveLimit(
      options.maxCompressedSize,
      DEFAULT_ARCHIVE_LIMITS.maxCompressedSize,
      'maxCompressedSize',
    ),
    maxTotalUncompressedSize: resolveLimit(
      options.maxTotalUncompressedSize,
      DEFAULT_ARCHIVE_LIMITS.maxTotalUncompressedSize,
      'maxTotalUncompressedSize',
    ),
    maxEntries: resolveLimit(
      options.maxEntries,
      DEFAULT_ARCHIVE_LIMITS.maxEntries,
      'maxEntries',
      true,
    ),
    maxCompressionRatio: resolveLimit(
      options.maxCompressionRatio,
      DEFAULT_ARCHIVE_LIMITS.maxCompressionRatio,
      'maxCompressionRatio',
    ),
  };
}

function resolveLimit(
  value: number | undefined,
  fallback: number,
  name: string,
  requireInteger = false,
): number {
  const resolved = value ?? fallback;
  if (
    resolved !== Number.POSITIVE_INFINITY &&
    (!Number.isFinite(resolved) || resolved < 0 || (requireInteger && !Number.isInteger(resolved)))
  ) {
    throw new Error(`${name} must be a non-negative ${requireInteger ? 'integer' : 'number'}`);
  }
  return resolved;
}

function exceedsCompressionRatio(uncompressed: number, compressed: number, maximum: number): boolean {
  if (uncompressed === 0 || maximum === Number.POSITIVE_INFINITY) return false;
  if (compressed <= 0) return true;
  return uncompressed / compressed > maximum;
}

function assertArchiveMetadata(
  files: unzipper.File[],
  limits: ResolvedArchiveLimits,
): void {
  if (files.length > limits.maxEntries) {
    throw new Error(`Package exceeds maximum entry count (${limits.maxEntries})`);
  }

  let advertisedTotalSize = 0;
  for (const file of files) {
    if (file.type === 'Directory') continue;

    const uncompressedSize = file.uncompressedSize;
    const compressedSize = file.compressedSize;
    if (!Number.isSafeInteger(uncompressedSize) || uncompressedSize < 0) {
      throw new Error(`Zip entry has an invalid uncompressed size: ${file.path}`);
    }
    if (!Number.isSafeInteger(compressedSize) || compressedSize < 0) {
      throw new Error(`Zip entry has an invalid compressed size: ${file.path}`);
    }

    advertisedTotalSize += uncompressedSize;
    if (advertisedTotalSize > limits.maxTotalUncompressedSize) {
      throw new Error(
        `Package exceeds maximum total uncompressed size (${limits.maxTotalUncompressedSize} bytes)`,
      );
    }
    if (exceedsCompressionRatio(uncompressedSize, compressedSize, limits.maxCompressionRatio)) {
      throw new Error(`File ${file.path} exceeds maximum compression ratio (${limits.maxCompressionRatio})`);
    }
  }
}

/**
 * Safe zip extractor with path traversal protection.
 * Returns simple stats (file count + total uncompressed size).
 */
export async function extractZipToDirSafe(
  zipPath: string,
  targetDir: string,
  options: ArchiveExtractionLimits = {},
): Promise<ExtractZipResult> {
  const limits = resolveArchiveLimits(options);
  const archiveStat = await stat(zipPath);
  if (archiveStat.size > limits.maxCompressedSize) {
    throw new Error(`Package exceeds maximum compressed size (${limits.maxCompressedSize} bytes)`);
  }

  const directory = await unzipper.Open.file(zipPath);
  assertArchiveMetadata(directory.files, limits);
  await ensureDir(targetDir);

  const targetStat = await lstat(targetDir);
  if (targetStat.isSymbolicLink()) {
    throw new Error(`Zip extraction target must not be a symbolic link: ${targetDir}`);
  }
  const realTargetDir = await realpath(targetDir);

  let fileCount = 0;
  let totalSize = 0;

  for (const file of directory.files) {
    const entryPath = file.path;
    if (isUnsafeZipEntryPath(entryPath)) continue;

    const outPath = path.join(targetDir, entryPath);
    assertPathWithinDir(targetDir, outPath);
    await assertNoSymlinkEscape(realTargetDir, outPath);

    if (file.type === 'Directory') {
      await ensureDir(outPath);
      await assertNoSymlinkEscape(realTargetDir, outPath);
      continue;
    }

    await ensureDir(path.dirname(outPath));
    await assertNoSymlinkEscape(realTargetDir, path.dirname(outPath));
    await assertNoSymlinkEscape(realTargetDir, outPath);
    let entrySize = 0;
    const byteLimiter = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        entrySize += chunk.byteLength;
        if (totalSize + entrySize > limits.maxTotalUncompressedSize) {
          callback(
            new Error(
              `Package exceeds maximum total uncompressed size (${limits.maxTotalUncompressedSize} bytes)`,
            ),
          );
          return;
        }
        callback(null, chunk);
      },
    });

    try {
      await pipeline(file.stream(), byteLimiter, createWriteStream(outPath));
    } catch (error) {
      await rm(outPath, { force: true });
      throw error;
    }

    fileCount += 1;
    totalSize += entrySize;
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
    await extractZipToDirSafe(abs, targetDir, options);
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

  try {
    await extractZipToDirSafe(abs, targetDir, options);
  } catch (error) {
    await rm(targetDir, { recursive: true, force: true });
    throw error;
  }

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
    const filesResolved = (r.files ?? []).map((f: string) => joinPosix(baseResource, f));
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
export async function extractZipToDir(
	zipPath: string,
	targetDir: string,
	options: ArchiveExtractionLimits = {},
): Promise<void> {
	await extractZipToDirSafe(zipPath, targetDir, options);
}

/**
 * Stream-safe extractor variant retained for API compatibility.
 */
export async function extractZipToDirStream(
	zipPath: string,
	targetDir: string,
	options: ArchiveExtractionLimits = {},
): Promise<void> {
	await extractZipToDirSafe(zipPath, targetDir, options);
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
