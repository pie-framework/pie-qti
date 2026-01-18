/**
 * Read Content Activity
 *
 * Reads content from storage backend using framework abstraction
 */

import type { Activity } from '@pie-qti/transform-types';
import type { StorageBackend } from '@pie-qti/transform-types';

export interface ReadContentInput {
  uri: string;
  storage: StorageBackend;
}

export interface ReadContentOutput {
  content: string;
  metadata?: {
    size: number;
    mimeType?: string;
    lastModified?: Date;
  };
}

/**
 * Activity that reads content from storage
 */
export const ReadContentActivity: Activity<ReadContentInput, ReadContentOutput> = {
  type: 'read-content',
  name: 'Read Content',

  async execute(context, input) {
    context.log('debug', `Reading content from: ${input.uri}`);

    try {
      const content = await input.storage.readText(input.uri);

      // Get metadata if supported
      let metadata;
      if (input.storage.getMetadata) {
        try {
          const meta = await input.storage.getMetadata(input.uri);
          metadata = {
            size: meta.size,
            mimeType: meta.mimeType,
            lastModified: meta.lastModified,
          };
        } catch {
          // Metadata not available
        }
      }

      context.log('info', `Content read successfully: ${content.length} bytes`);

      return { content, metadata };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      context.log('error', `Failed to read content: ${errorMsg}`);
      throw new Error(`Failed to read ${input.uri}: ${errorMsg}`);
    }
  },

  timeout: 60000, // 1 minute
  retryPolicy: {
    maxAttempts: 3,
    initialInterval: 1000,
    maxInterval: 10000,
    backoffCoefficient: 2,
    nonRetryableErrors: ['NotFoundError'],
  },
};
