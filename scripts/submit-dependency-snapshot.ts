#!/usr/bin/env bun
/**
 * Submit this workspace's resolved dependencies to GitHub's dependency graph.
 *
 * GitHub's own dependency graph cannot read `bun.lock`, so this repository has no inventory
 * there: `GET /repos/:owner/:repo/dependency-graph/sbom` returns 404, the Dependabot alerts
 * that exist name manifest paths deleted in the January 2026 package rename, and nothing
 * re-evaluates them. That leaves alerting inert while `bun audit` reports real advisories, so
 * the graph is fed explicitly through the dependency submission API instead.
 *
 * The snapshot is built from `node_modules` rather than from `bun.lock`: it is the tree a real
 * `bun install --frozen-lockfile` produced, and the lockfile is JSONC — trailing commas and
 * all — so parsing it would need either a dependency or a regex over someone's source of
 * truth. Walking the install also gives each package's own declared dependencies, which is
 * what `relationship` and `scope` are derived from.
 *
 * Docs: https://docs.github.com/en/rest/dependency-graph/dependency-submission
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const DETECTOR = {
  name: 'pie-qti-bun-dependency-submission',
  version: '1.0.0',
  url: 'https://github.com/pie-framework/pie-qti/blob/master/scripts/submit-dependency-snapshot.ts',
};

interface InstalledPackage {
  name: string;
  version: string;
  dependencies: string[];
  optionalDependencies: string[];
}

/** `pkg:npm/%40scope%2Fname@version` — the scope separator is encoded, per the PURL spec. */
function packageUrl(name: string, version: string): string {
  const encoded = name.startsWith('@')
    ? `${encodeURIComponent(name.slice(0, name.indexOf('/')))}/${name.slice(name.indexOf('/') + 1)}`
    : name;
  return `pkg:npm/${encoded}@${version}`;
}

/**
 * Every installed package, found by walking `node_modules` trees rather than by resolving the
 * lockfile.
 *
 * `node_modules/.bun` has to be walked, not skipped. Bun keeps one directory per resolved
 * version there — `node_modules/.bun/js-yaml@3.14.2/node_modules/js-yaml` — and the visible
 * top-level entries are symlinks into that store, so a walk of the hoisted names alone sees
 * exactly one version of each package. That is the difference between reporting `js-yaml@5.2.3`
 * and reporting the `js-yaml@3.14.2` a transitive dependency actually resolved, which is the
 * copy an advisory applies to.
 *
 * The same name@version reached twice is deduplicated: it is the identity the graph keys on.
 */
async function readInstalledPackages(root: string): Promise<Map<string, InstalledPackage>> {
  const installed = new Map<string, InstalledPackage>();
  const queue = [path.join(root, 'node_modules')];
  const walked = new Set<string>();

  while (queue.length > 0) {
    const nodeModules = queue.pop();
    if (!nodeModules || walked.has(nodeModules)) {
      continue;
    }
    walked.add(nodeModules);
    let entries: string[];
    try {
      entries = await readdir(nodeModules);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry === '.bin' || entry === '.cache') {
        continue;
      }
      // The version store: each entry holds its own `node_modules` with the package inside.
      if (entry === '.bun') {
        const storeDir = path.join(nodeModules, entry);
        for (const stored of await readdir(storeDir).catch(() => [])) {
          queue.push(path.join(storeDir, stored, 'node_modules'));
        }
        continue;
      }
      // A scope directory holds packages, not a package.
      if (entry.startsWith('@')) {
        const scopeDir = path.join(nodeModules, entry);
        const scoped = await readdir(scopeDir).catch(() => []);
        for (const name of scoped) {
          await collect(path.join(scopeDir, name));
        }
        continue;
      }
      await collect(path.join(nodeModules, entry));
    }
  }

  async function collect(packageDir: string): Promise<void> {
    const manifest = await readManifest(path.join(packageDir, 'package.json'));
    if (manifest?.name && manifest.version) {
      const key = `${manifest.name}@${manifest.version}`;
      if (!installed.has(key)) {
        installed.set(key, {
          name: manifest.name,
          version: manifest.version,
          dependencies: Object.keys(manifest.dependencies ?? {}),
          optionalDependencies: Object.keys(manifest.optionalDependencies ?? {}),
        });
      }
    }
    // `bun install` nests a package's own `node_modules` when a version cannot be hoisted.
    queue.push(path.join(packageDir, 'node_modules'));
  }

  return installed;
}

interface Manifest {
  name?: string;
  version?: string;
  workspaces?: string[];
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

async function readManifest(manifestPath: string): Promise<Manifest | null> {
  try {
    return JSON.parse(await readFile(manifestPath, 'utf-8')) as Manifest;
  } catch {
    return null;
  }
}

/** Every workspace member's manifest, plus the root's. */
async function readWorkspaceManifests(root: string): Promise<Manifest[]> {
  const rootManifest = await readManifest(path.join(root, 'package.json'));
  if (!rootManifest) {
    throw new Error(`No package.json at ${root}`);
  }
  const manifests = [rootManifest];
  // Only the `dir/*` form this repo uses; a full glob would need a matcher and buys nothing.
  for (const pattern of rootManifest.workspaces ?? []) {
    const base = pattern.endsWith('/*') ? pattern.slice(0, -2) : null;
    if (!base) {
      continue;
    }
    for (const entry of await readdir(path.join(root, base)).catch(() => [])) {
      const manifest = await readManifest(path.join(root, base, entry, 'package.json'));
      if (manifest) {
        manifests.push(manifest);
      }
    }
  }
  return manifests;
}

/**
 * Which installed packages are reachable from the workspace's *runtime* dependencies.
 *
 * Everything else is `development` scope. The distinction matters because it is what makes an
 * advisory in a build tool read differently from the same advisory in shipped code, and it
 * cannot be taken from the install layout — bun installs both kinds the same way.
 */
function runtimeReachable(
  workspaceManifests: readonly Manifest[],
  installed: Map<string, InstalledPackage>
): Set<string> {
  const byName = new Map<string, InstalledPackage[]>();
  for (const pkg of installed.values()) {
    byName.set(pkg.name, [...(byName.get(pkg.name) ?? []), pkg]);
  }

  const reachable = new Set<string>();
  const queue: string[] = [];
  for (const manifest of workspaceManifests) {
    for (const name of Object.keys(manifest.dependencies ?? {})) {
      queue.push(name);
    }
  }

  while (queue.length > 0) {
    const name = queue.pop();
    if (!name) {
      continue;
    }
    // Every installed version of the name: which one a given importer resolved to is not
    // recoverable from the layout, and marking all of them runtime is the safe direction —
    // it never downgrades an advisory to development scope.
    for (const pkg of byName.get(name) ?? []) {
      const key = `${pkg.name}@${pkg.version}`;
      if (reachable.has(key)) {
        continue;
      }
      reachable.add(key);
      queue.push(...pkg.dependencies, ...pkg.optionalDependencies);
    }
  }
  return reachable;
}

function directlyDeclared(workspaceManifests: readonly Manifest[]): Set<string> {
  const declared = new Set<string>();
  for (const manifest of workspaceManifests) {
    for (const field of [
      'dependencies',
      'devDependencies',
      'optionalDependencies',
      'peerDependencies',
    ] as const) {
      for (const name of Object.keys(manifest[field] ?? {})) {
        declared.add(name);
      }
    }
  }
  return declared;
}

async function main(): Promise<void> {
  const root = process.cwd();
  const [workspaceManifests, installed] = await Promise.all([
    readWorkspaceManifests(root),
    readInstalledPackages(root),
  ]);

  const workspaceNames = new Set(
    workspaceManifests.map((manifest) => manifest.name).filter((name): name is string => !!name)
  );
  const runtime = runtimeReachable(workspaceManifests, installed);
  const declared = directlyDeclared(workspaceManifests);

  const resolved: Record<string, unknown> = {};
  for (const [key, pkg] of installed) {
    // The workspace's own packages are the thing being described, not dependencies of it.
    if (workspaceNames.has(pkg.name)) {
      continue;
    }
    resolved[key] = {
      package_url: packageUrl(pkg.name, pkg.version),
      relationship: declared.has(pkg.name) ? 'direct' : 'indirect',
      scope: runtime.has(key) ? 'runtime' : 'development',
    };
  }

  const sha = requireEnv('GITHUB_SHA');
  const ref = requireEnv('GITHUB_REF');
  const runId = process.env.GITHUB_RUN_ID ?? 'local';
  const snapshot = {
    version: 0,
    sha,
    ref,
    job: {
      id: runId,
      // Stable across runs of this job, so each snapshot supersedes the last rather than
      // accumulating alongside it.
      correlator: `${process.env.GITHUB_WORKFLOW ?? 'dependency-submission'}_${process.env.GITHUB_JOB ?? 'submit'}`,
      ...(process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY
        ? {
            html_url: `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${runId}`,
          }
        : {}),
    },
    detector: DETECTOR,
    scanned: new Date().toISOString(),
    manifests: {
      'bun.lock': {
        name: 'bun.lock',
        file: { source_location: 'bun.lock' },
        resolved,
      },
    },
  };

  const count = Object.keys(resolved).length;
  if (process.env.DRY_RUN === '1') {
    await Bun.write('dependency-snapshot.json', JSON.stringify(snapshot, null, 2));
    console.log(`Wrote dependency-snapshot.json with ${count} resolved packages (dry run).`);
    return;
  }

  const repository = requireEnv('GITHUB_REPOSITORY');
  const response = await fetch(
    `${process.env.GITHUB_API_URL ?? 'https://api.github.com'}/repos/${repository}/dependency-graph/snapshots`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${requireEnv('GITHUB_TOKEN')}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(snapshot),
    }
  );

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Snapshot submission failed (${response.status}): ${body}`);
  }
  console.log(`Submitted ${count} resolved packages. ${body}`);
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

await main();
