/**
 * QTI Item File Serving Endpoint
 * Serves individual QTI XML files and related resources from a session
 */

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { error as svelteError } from '@sveltejs/kit';
import { getStorage } from '$lib/server/storage/FileStorage';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
  const { id, itemPath } = params;

  try {
    const storage = getStorage();

    // Get the uploads + extracted paths for this session
    const uploadsPath = storage.getUploadsPath(id);
    const extractedPath = storage.getExtractedPath(id);
    const uploadsRoot = resolve(uploadsPath);
    const extractedRoot = resolve(extractedPath);

    // Construct the full path to the requested file
    // itemPath might be "choice_simple.xml" or "subfolder/item.xml"
    const uploadsCandidate = resolve(join(uploadsPath, itemPath));
    const extractedCandidate = resolve(join(extractedPath, itemPath));

    // Security: Ensure the resolved path is still within session directories
    const inUploads = uploadsCandidate.startsWith(uploadsRoot);
    const inExtracted = extractedCandidate.startsWith(extractedRoot);
    if (!inUploads && !inExtracted) throw svelteError(403, 'Access denied');

    const filePath = existsSync(uploadsCandidate)
      ? uploadsCandidate
      : existsSync(extractedCandidate)
        ? extractedCandidate
        : null;

    // Check if file exists
    if (!filePath) {
      throw svelteError(404, 'File not found');
    }

    // Read the file
    const content = await readFile(filePath, 'utf-8');

    // Determine content type based on file extension
    const ext = filePath.split('.').pop()?.toLowerCase();
    let contentType = 'application/octet-stream';

    switch (ext) {
      case 'xml':
        contentType = 'application/xml';
        break;
      case 'html':
      case 'htm':
        contentType = 'text/html';
        break;
      case 'css':
        contentType = 'text/css';
        break;
      case 'js':
        contentType = 'application/javascript';
        break;
      case 'json':
        contentType = 'application/json';
        break;
      case 'png':
        contentType = 'image/png';
        break;
      case 'jpg':
      case 'jpeg':
        contentType = 'image/jpeg';
        break;
      case 'gif':
        contentType = 'image/gif';
        break;
      case 'svg':
        contentType = 'image/svg+xml';
        break;
    }

    return new Response(content, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (err) {
    console.error('Item file serving error:', err);

    if (err && typeof err === 'object' && 'status' in err) {
      throw err;
    }

    throw svelteError(500, err instanceof Error ? err.message : 'Failed to serve item file');
  }
};
