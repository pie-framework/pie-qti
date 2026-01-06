/**
 * Load sample package endpoint
 * Copies a sample package to a new session
 */

import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { json, error as svelteError } from '@sveltejs/kit';
import { getStorage } from '$lib/server/storage/FileStorage';
import { getSessionManager } from '$lib/server/storage/SessionManager';
import type { PackageInfo } from '$lib/server/storage/types';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params }) => {
  const { id } = params;

  try {
    const samplePath = join(process.cwd(), 'static', 'samples', id);

    // Verify sample exists
    try {
      await stat(samplePath);
    } catch {
      throw svelteError(404, `Sample package '${id}' not found`);
    }

    const storage = getStorage();
    const sessionManager = getSessionManager();

    // First, scan files to get total size
    const files = await readdir(samplePath);
    let totalSize = 0;

    for (const file of files) {
      const sourcePath = join(samplePath, file);
      const fileStats = await stat(sourcePath);
      if (fileStats.isFile()) {
        totalSize += fileStats.size;
      }
    }

    // Create package info
    const packageInfo: PackageInfo = {
      id: `sample-${id}`,
      name: id,
      type: 'directory',
      size: totalSize,
      path: id,
      originalName: id,
    };

    // Create session (this creates the directory structure)
    const session = await sessionManager.createSession([packageInfo]);

    // Now copy files to the session's uploads directory
    const uploadsPath = storage.getUploadsPath(session.id);

    for (const file of files) {
      const sourcePath = join(samplePath, file);
      const destPath = join(uploadsPath, file);

      const fileStats = await stat(sourcePath);
      if (fileStats.isFile()) {
        const content = await readFile(sourcePath);
        await writeFile(destPath, content);
        console.log(`Copied ${file} to ${destPath}`);
      }
    }

    // Update status to ready for analysis
    await sessionManager.updateStatus(session.id, 'ready');

    return json({
      success: true,
      sessionId: session.id,
      sampleId: id,
      message: `Sample '${id}' loaded successfully`,
    });
  } catch (err) {
    console.error('Load sample error:', err);

    if (err && typeof err === 'object' && 'status' in err) {
      throw err;
    }

    throw svelteError(500, err instanceof Error ? err.message : 'Failed to load sample');
  }
};
