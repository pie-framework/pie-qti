/**
 * @pie-qti/logger
 *
 * Universal logging package for PIE QTI applications.
 *
 * This package provides a unified logging interface that works across
 * browser and Node.js environments, with environment-specific implementations.
 *
 * ## Usage
 *
 * ### Browser
 * ```typescript
 * import { createLogger } from '@pie-qti/logger/browser';
 *
 * const logger = createLogger('MyComponent');
 * logger.debug('Debug info');
 * logger.info('General info');
 * logger.warn('Warning');
 * logger.error('Error');
 * ```
 *
 * ### Server
 * ```typescript
 * import { createLogger } from '@pie-qti/logger/server';
 *
 * const logger = createLogger('MyService');
 * logger.info('Processing item', 'item-123', { vendor: 'ExampleCorp' });
 * ```
 *
 * ### Environment-Agnostic Code
 * ```typescript
 * import type { Logger } from '@pie-qti/logger';
 *
 * function processData(data: any, logger: Logger) {
 *   logger.debug('Processing data');
 * }
 * ```
 */

export type { Logger } from './types.js';
export { noopLogger, consoleLogger } from './types.js';
