/**
 * Logger Utilities
 */

import type { TransformLogger } from '@pie-framework/transform-types';

/**
 * Simple console logger
 */
export class ConsoleLogger implements TransformLogger {
  debug(message: string, itemId?: string): void {
    const prefix = itemId ? `[${itemId}]` : '';
    console.debug(`[DEBUG] ${prefix} ${message}`);
  }

  info(message: string, itemId?: string): void {
    const prefix = itemId ? `[${itemId}]` : '';
    console.info(`[INFO] ${prefix} ${message}`);
  }

  warn(message: string, itemId?: string): void {
    const prefix = itemId ? `[${itemId}]` : '';
    console.warn(`[WARN] ${prefix} ${message}`);
  }

  error(message: string, itemId?: string): void {
    const prefix = itemId ? `[${itemId}]` : '';
    console.error(`[ERROR] ${prefix} ${message}`);
  }
}

/**
 * Silent logger (no output)
 */
export class SilentLogger implements TransformLogger {
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
}

/**
 * Memory logger (stores messages in memory)
 */
export class MemoryLogger implements TransformLogger {
  public messages: Array<{
    level: 'debug' | 'info' | 'warn' | 'error';
    message: string;
    itemId?: string;
    timestamp: Date;
  }> = [];

  debug(message: string, itemId?: string): void {
    this.messages.push({ level: 'debug', message, itemId, timestamp: new Date() });
  }

  info(message: string, itemId?: string): void {
    this.messages.push({ level: 'info', message, itemId, timestamp: new Date() });
  }

  warn(message: string, itemId?: string): void {
    this.messages.push({ level: 'warn', message, itemId, timestamp: new Date() });
  }

  error(message: string, itemId?: string): void {
    this.messages.push({ level: 'error', message, itemId, timestamp: new Date() });
  }

  clear(): void {
    this.messages = [];
  }

  getMessages(level?: 'debug' | 'info' | 'warn' | 'error'): typeof this.messages {
    if (level) {
      return this.messages.filter((msg) => msg.level === level);
    }
    return this.messages;
  }
}
