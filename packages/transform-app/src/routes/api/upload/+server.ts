/**
 * File upload API endpoint
 * Accepts ZIP files and creates a new session
 */

import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { json, error as svelteError } from '@sveltejs/kit';
import { getStorage } from '$lib/server/storage/FileStorage';
import { getSessionManager } from '$lib/server/storage/SessionManager';
import type { PackageInfo } from '$lib/server/storage/types';
import type { RequestHandler } from './$types';

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
const ALLOWED_TYPES = ['application/zip', 'application/x-zip-compressed'];

export const POST: RequestHandler = async ({ request }) => {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files');

    if (files.length === 0) {
      throw svelteError(400, 'No files provided');
    }

    const storage = getStorage();
    const sessionManager = getSessionManager();
    const packages: PackageInfo[] = [];

    // Create session first to get session ID
    const sessionId = storage.generateSessionId();
    const uploadsPath = storage.getUploadsPath(sessionId);

    // Process each uploaded file
    for (const file of files) {
      if (!(file instanceof File)) {
        continue;
      }

      // Validate file type
      if (!ALLOWED_TYPES.includes(file.type) && !file.name.endsWith('.zip')) {
        throw svelteError(400, `Invalid file type: ${file.type}. Only ZIP files are allowed.`);
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        throw svelteError(400, `File too large: ${file.name}. Maximum size is 500MB.`);
      }

      // Generate package ID and save file
      const packageId = `pkg-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      const fileName = file.name;
      const filePath = join(uploadsPath, fileName);

      // Read file as buffer and write to disk
      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(filePath, buffer);

      packages.push({
        id: packageId,
        name: fileName,
        type: 'zip',
        size: file.size,
        path: `uploads/${fileName}`,
        originalName: fileName,
      });
    }

    // Create session with package info
    const session = await sessionManager.createSession(packages);

    return json({
      success: true,
      sessionId: session.id,
      packages: packages.map((p) => ({
        id: p.id,
        name: p.name,
        size: p.size,
      })),
    });
  } catch (err) {
    console.error('Upload error:', err);

    if (err && typeof err === 'object' && 'status' in err) {
      throw err; // Re-throw SvelteKit errors
    }

    throw svelteError(500, err instanceof Error ? err.message : 'Upload failed');
  }
};
