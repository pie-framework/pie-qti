# @pie-qti/logger

Universal logging utilities for PIE QTI applications that work in both browser and Node.js environments.

## Features

- **Universal Logger Interface**: Environment-agnostic logging interface for shared code
- **Browser Logger**: Optimized for browser environments with dev/prod mode detection
- **Server Logger**: Structured logging with JSON output for production environments
- **Dependency Injection**: Code accepts logger interface, implementation bound at runtime

## Installation

```bash
bun add @pie-qti/logger
```

## Usage

### Browser

```typescript
import { createLogger } from '@pie-qti/logger/browser';

const logger = createLogger('MyComponent');
logger.debug('Detailed debug info'); // Only shown in dev mode
logger.info('General information');
logger.warn('Warning message');
logger.error('Error occurred');
```

### Server

```typescript
import { createLogger } from '@pie-qti/logger/server';

// Console logger (development)
const logger = createLogger('MyService');
logger.info('Processing item', 'item-123', { vendor: 'ExampleCorp' });

// JSON logger (production)
import { JsonLogger, setLogger } from '@pie-qti/logger/server';
setLogger(new JsonLogger('info'));
```

### Environment-Agnostic Code

For code that runs in both browser and Node.js (like QTI processing logic):

```typescript
import type { Logger } from '@pie-qti/logger';
import { consoleLogger } from '@pie-qti/logger';

function processQtiContent(xml: string, logger: Logger = consoleLogger) {
  logger.debug('Parsing QTI XML');
  // ... processing logic
}

// Browser usage:
import { createLogger } from '@pie-qti/logger/browser';
processQtiContent(xml, createLogger('QTI'));

// Server usage:
import { createLogger } from '@pie-qti/logger/server';
processQtiContent(xml, createLogger('QTI'));
```

## API

### Logger Interface

```typescript
interface Logger {
  debug(message: string, ...args: any[]): void;
  info?(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error?(message: string, ...args: any[]): void;
}
```

### Browser Logger

- **Auto dev/prod detection**: Debug logs only in development
- **Configurable log levels**: Control minimum log level
- **Prefix support**: Add namespace to all log messages
- **Child loggers**: Create nested logger instances

### Server Logger

- **Console format**: Human-readable logs for development
- **JSON format**: Structured logs for production (ELK, Datadog, CloudWatch)
- **Structured context**: itemId, sessionId, userId, vendor, correlationId
- **Testing utilities**: MemoryLogger, SilentLogger
- **Environment variables**: PIE_LOG_FORMAT, PIE_LOG_LEVEL

## Environment Variables (Server)

- `PIE_LOG_FORMAT`: `'console'` (default) | `'json'`
- `PIE_LOG_LEVEL`: `'debug'` | `'info'` (default) | `'warn'` | `'error'`

## Migration

### From @pie-qti/browser-utils

```typescript
// Before
import { createLogger } from '@pie-qti/browser-utils';

// After
import { createLogger } from '@pie-qti/logger/browser';
```

### From @pie-qti/server-utils

```typescript
// Before
import { createLogger } from '@pie-qti/server-utils';

// After
import { createLogger } from '@pie-qti/logger/server';
```
