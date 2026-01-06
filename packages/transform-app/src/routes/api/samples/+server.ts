/**
 * Samples API endpoint
 * List and load sample QTI packages
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  try {
    const metadataPath = join(process.cwd(), 'static', 'samples', 'samples-metadata.json');
    const content = await readFile(metadataPath, 'utf-8');
    const metadata = JSON.parse(content);

    return json({
      success: true,
      samples: metadata.samples,
    });
  } catch (error) {
    console.error('Failed to load samples metadata:', error);
    return json({
      success: false,
      error: 'Failed to load samples',
      samples: [],
    });
  }
};
