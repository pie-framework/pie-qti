/**
 * Session Items List Endpoint
 * Returns a list of all QTI items in a session
 */

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { json, error as svelteError } from '@sveltejs/kit';
import { getStorage } from '$lib/server/storage/FileStorage';
import { getSessionManager } from '$lib/server/storage/SessionManager';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
  const { id } = params;

  try {
    const sessionManager = getSessionManager();
    const storage = getStorage();
    const extractedPath = storage.getExtractedPath(id);
    const uploadsPath = storage.getUploadsPath(id);
    const extractedRoot = resolve(extractedPath);
    const uploadsRoot = resolve(uploadsPath);

    function normalizePossiblyAbsolutePath(p: string): string {
      // Some analysis data may have lost the leading '/' (e.g. "Users/…") when serialized.
      if (!isAbsolute(p) && (p.startsWith('Users/') || p.startsWith('home/'))) {
        return `/${p}`;
      }
      return p;
    }

    async function readSessionXml(samplePath: string): Promise<string> {
      const normalized = normalizePossiblyAbsolutePath(samplePath);
      const candidates: string[] = [];

      if (isAbsolute(normalized)) {
        candidates.push(normalized);
      } else {
        candidates.push(join(extractedPath, normalized));
        candidates.push(join(uploadsPath, normalized));
        const baseName = normalized.split('/').pop();
        if (baseName && baseName !== normalized) {
          candidates.push(join(uploadsPath, baseName));
          candidates.push(join(extractedPath, baseName));
        }
      }

      for (const candidate of candidates) {
        const resolved = resolve(candidate);
        const inSession =
          resolved.startsWith(extractedRoot) || resolved.startsWith(uploadsRoot);
        if (!inSession) continue;
        if (!existsSync(resolved)) continue;
        return await readFile(resolved, 'utf-8');
      }

      throw new Error(`ENOENT: no such file or directory, open '${candidates[0] || samplePath}'`);
    }

    // Get session
    const session = await sessionManager.getSession(id);
    if (!session) {
      throw svelteError(404, 'Session not found');
    }

    // Check if analysis is available
    if (!session.analysis) {
      throw svelteError(400, 'Session has not been analyzed yet');
    }

    // Build list of items from analysis results
    const items: Array<{
      id: string;
      title: string;
      filePath: string;
      sourcePath: string;
      interactions: string[];
      url: string;
      xml?: string;
    }> = [];

    // Iterate through packages and their samples
    for (const pkg of session.analysis.packages) {
      // Get items from interaction samples
      const interactionSamples = pkg.samples.interactions;

      // Create a Set to track unique file paths
      const seenFiles = new Set<string>();

      for (const [interactionType, filePaths] of Object.entries(interactionSamples)) {
        for (const filePath of filePaths) {
          if (seenFiles.has(filePath)) {
            // If we've already processed this file, just add the interaction type
            const existingItem = items.find((item) => item.sourcePath === filePath);
            if (existingItem && !existingItem.interactions.includes(interactionType)) {
              existingItem.interactions.push(interactionType);
            }
            continue;
          }

          seenFiles.add(filePath);

          // Extract filename from path
          const fileName = filePath.split('/').pop() || 'unknown';
          const fileId = fileName.replace(/\.xml$/i, '');

          // Construct URL to serve this item
          const url = `/api/sessions/${id}/items/${fileName}`;

          // Read the XML content
          const xmlContent = await readSessionXml(filePath);

          items.push({
            id: fileId,
            title: fileId.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
            filePath: fileName,
            sourcePath: filePath,
            interactions: [interactionType],
            url,
            xml: xmlContent
          });
        }
      }

      // Add passage samples if any
      for (const passagePath of pkg.samples.passages) {
        const fileName = passagePath.split('/').pop() || 'unknown';
        const fileId = fileName.replace(/\.xml$/i, '');
        const url = `/api/sessions/${id}/items/${fileName}`;

        if (!seenFiles.has(passagePath)) {
          // Read the XML content
          const xmlContent = await readSessionXml(passagePath);

          items.push({
            id: fileId,
            title: `Passage: ${fileId.replace(/_/g, ' ')}`,
            filePath: fileName,
            sourcePath: passagePath,
            interactions: ['passage'],
            url,
            xml: xmlContent
          });
        }
      }
    }

    return json({
      success: true,
      sessionId: id,
      items,
      totalItems: items.length
    });
  } catch (err) {
    console.error('List items error:', err);

    if (err && typeof err === 'object' && 'status' in err) {
      throw err;
    }

    throw svelteError(500, err instanceof Error ? err.message : 'Failed to list items');
  }
};
