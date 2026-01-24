/**
 * Re-export Logger interface from @pie-qti/logger for convenience
 * This provides a stable location for the interface in shared code
 */
export type { Logger } from '@pie-qti/logger';
export { noopLogger, consoleLogger } from '@pie-qti/logger';
