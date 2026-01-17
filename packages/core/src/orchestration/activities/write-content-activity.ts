/**
 * Write Content Activity
 *
 * Writes content to storage backend using framework abstraction
 */

import type { Activity } from '@pie-qti/transform-types';
import type { StorageBackend, WriteOptions } from '@pie-qti/transform-types';

export interface WriteContentInput {
  uri: string;
  content: string | Buffer;
  storage: StorageBackend;
  options?: WriteOptions;
}

export interface WriteContentOutput {
  uri: string;
  size: number;
}

/**
 * Activity that writes content to storage
 */
export const WriteContentActivity: Activity<WriteContentInput, WriteContentOutput> = {
  type: 'write-content',
  name: 'Write Content',

  async execute(context, input) {
    context.log('debug', `Writing content to: ${input.uri}`);

    try {
      await input.storage.write(input.uri, input.content, input.options);

      const size = typeof input.content === 'string'
        ? Buffer.byteLength(input.content, 'utf-8')
        : input.content.length;

      context.log('info', `Content written successfully: ${size} bytes`);

      return { uri: input.uri, size };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      context.log('error', `Failed to write content: ${errorMsg}`);
      throw new Error(`Failed to write ${input.uri}: ${errorMsg}`);
    }
  },

  timeout: 60000, // 1 minute
  retryPolicy: {
    maxAttempts: 3,
    initialInterval: 1000,
    maxInterval: 10000,
    backoffCoefficient: 2,
  },
};
