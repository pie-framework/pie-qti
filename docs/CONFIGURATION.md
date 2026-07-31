# PIE-QTI Transform Configuration Guide

This guide explains how to configure the PIE-QTI transform system using configuration files and environment variables.

## Table of Contents

- [Configuration File Format](#configuration-file-format)
- [Orchestration Configuration](#orchestration-configuration)
- [Storage Configuration](#storage-configuration)
- [Plugin Configuration](#plugin-configuration)
- [Vendor Extensions](#vendor-extensions)
- [Format Detectors](#format-detectors)
- [Environment Variables](#environment-variables)
- [Usage Examples](#usage-examples)

## Configuration File Format

Configuration files should be in JSON format:

```json
{
  "orchestration": {
    "name": "in-memory",
    "defaultRetryPolicy": {
      "maxAttempts": 3,
      "initialInterval": 1000,
      "maxInterval": 30000,
      "backoffCoefficient": 2
    },
    "defaultTimeout": {
      "workflowTimeout": 600000,
      "activityTimeout": 120000
    }
  },
  "storage": {
    "type": "filesystem",
    "options": {
      "basePath": "./uploads"
    }
  },
  "plugins": {
    "qti22": {
      "pie": "@pie-qti/qti2-to-pie"
    }
  },
  "formatDetectors": [
    "packages/core/src/detectors/qti22-detector.ts",
    "packages/core/src/detectors/pie-detector.ts"
  ],
  "vendors": {
    "myorg": {
      "namespace": "http://www.myorg.com/qti/v1",
      "prefix": "myorg",
      "extensions": {
        "customInteraction": {
          "handler": "./path/to/handler.ts"
        }
      }
    }
  },
  "defaultOptions": {
    "skipValidation": false,
    "maxConcurrent": 5,
    "timeout": 300000
  },
  "logger": {
    "level": "info",
    "format": "json"
  }
}
```

## Orchestration Configuration

Configure workflow orchestration for transformation pipelines. The orchestration layer provides retry mechanisms, progress tracking, and workflow execution.

### In-Memory Orchestrator (Default)

The in-memory orchestrator is the default implementation suitable for most use cases:

```json
{
  "orchestration": {
    "name": "in-memory",
    "defaultRetryPolicy": {
      "maxAttempts": 3,
      "initialInterval": 1000,
      "maxInterval": 30000,
      "backoffCoefficient": 2,
      "nonRetryableErrors": ["ValidationError"]
    },
    "defaultTimeout": {
      "workflowTimeout": 600000,
      "activityTimeout": 120000
    },
    "maxConcurrentActivities": 5
  }
}
```

### Custom Orchestrators

The orchestration layer is fully extensible. You can implement custom orchestrators by implementing the `WorkflowOrchestrator` interface. For production deployments requiring durable execution and advanced workflow capabilities, consider implementing a custom orchestrator using a workflow engine like [Temporal](https://temporal.io/).

## Storage Configuration

Configure where uploaded files, sessions, and outputs are stored.

### In-Memory Backend (Default)

The in-memory backend stores files in memory and is suitable for development and testing:

```json
{
  "storage": {
    "type": "memory"
  }
}
```

### Filesystem Backend

Store files on the local filesystem:

```json
{
  "storage": {
    "type": "filesystem",
    "options": {
      "basePath": "./uploads"
    }
  }
}
```

### Custom Storage Backends

The storage layer is fully extensible. You can implement custom storage backends by implementing the `StorageBackend` interface. The `options` field accepts any configuration your custom backend needs.

Example configurations for custom backends:

```json
{
  "storage": {
    "type": "s3",
    "options": {
      "bucket": "my-qti-bucket",
      "region": "us-east-1",
      "endpoint": "https://s3.amazonaws.com"
    }
  }
}
```

```json
{
  "storage": {
    "type": "database",
    "options": {
      "connectionString": "postgresql://user:pass@localhost:5432/pie_qti"
    }
  }
}
```

## Plugin Configuration

Configure transformation plugins for different format pairs.

### Built-in Plugins

```json
{
  "plugins": {
    "qti22": {
      "pie": "@pie-qti/qti2-to-pie"
    }
  }
}
```

### Custom Plugins

```json
{
  "plugins": {
    "qti30": {
      "pie": "./plugins/qti30-to-pie.ts"
    },
    "pie": {
      "qti22": "./plugins/pie-to-qti22.ts"
    }
  }
}
```

### Plugin Options

Pass options to plugins:

```json
{
  "plugins": {
    "qti22": {
      "pie": {
        "module": "@pie-qti/qti2-to-pie",
        "options": {
          "strictMode": true,
          "preserveIds": true
        }
      }
    }
  }
}
```

## Vendor Extensions

Configure vendor-specific QTI extensions.

```json
{
  "vendors": {
    "renaissance": {
      "namespace": "http://www.renaissance.com/qti/v1",
      "prefix": "ren",
      "extensions": {
        "audioRecording": {
          "handler": "@pie-qti/renaissance-extensions/audio-recording",
          "pieType": "audio-response"
        },
        "mathKeyboard": {
          "handler": "@pie-qti/renaissance-extensions/math-keyboard",
          "pieType": "math-input"
        }
      }
    }
  }
}
```

### Extension Handler API

Handlers should implement:

```typescript
export class CustomExtensionHandler implements VendorExtensionHandler {
  namespace = 'http://www.myorg.com/qti/v1';

  canHandle(element: Element): boolean {
    return element.tagName === 'myorg:customInteraction';
  }

  async transform(element: Element, context: TransformContext): Promise<PieElement> {
    // Transform vendor extension to PIE format
    return {
      type: 'custom-interaction',
      id: element.getAttribute('identifier'),
      // ... PIE configuration
    };
  }
}
```

## Format Detectors

Configure automatic format detection.

```json
{
  "formatDetectors": [
    "./detectors/qti22-detector.ts",
    "./detectors/qti30-detector.ts",
    "@my-org/custom-detector"
  ]
}
```

### Detector Priority

Detectors are tried in order. The first matching detector determines the format.

### Custom Detector API

```typescript
export class CustomFormatDetector implements FormatDetector {
  name = 'custom-format';
  priority = 100; // Higher = checked first

  async detect(content: string): Promise<FormatDetectionResult> {
    if (content.includes('<customFormat')) {
      return {
        format: 'custom',
        confidence: 0.95,
        version: '1.0'
      };
    }
    return { format: null, confidence: 0 };
  }
}
```

## Environment Variables

All configuration can be overridden with environment variables:

### Orchestration

```bash
# Retry policy
export ORCHESTRATOR_MAX_ATTEMPTS=3
export ORCHESTRATOR_RETRY_INITIAL_INTERVAL=1000
export ORCHESTRATOR_RETRY_MAX_INTERVAL=30000
export ORCHESTRATOR_RETRY_BACKOFF=2
```

### Storage

```bash
# In-memory backend (default)
export STORAGE_TYPE=memory

# Filesystem backend
export STORAGE_TYPE=filesystem
export STORAGE_BASE_PATH=./uploads

# Custom backends can use their own environment variables
# Example for S3:
# export STORAGE_TYPE=s3
# export S3_BUCKET=my-bucket
# export S3_REGION=us-east-1
# export AWS_ACCESS_KEY_ID=xxx
# export AWS_SECRET_ACCESS_KEY=xxx
```

### Default Options

```bash
export SKIP_VALIDATION=false
export MAX_CONCURRENT=5
export DEFAULT_TIMEOUT=300000
```

### Logging

```bash
export PIE_QTI_LOG_LEVEL=debug  # error, warn, info, debug
export PIE_QTI_LOG_FORMAT=json  # json, text
```

### Config File Path

```bash
export PIE_QTI_CONFIG=/path/to/config.json
```

## Usage Examples

### Transform App

The transform app automatically loads configuration from:
1. `PIE_QTI_CONFIG` environment variable
2. Environment variables (prefixed with `PIE_QTI_`)

```bash
# Using config file
export PIE_QTI_CONFIG=./config.json
bun run dev

# Using environment variables
export STORAGE_TYPE=filesystem
export STORAGE_BASE_PATH=./uploads
bun run dev
```

### CLI Tool

Pass config file via `--config` flag:

```bash
# Transform with config file
pie-transform transform input.xml -o output.json --config ./config.json

# Config file loads plugins automatically
pie-transform transform input.xml --config ./my-plugins.json

# Without config, uses defaults
pie-transform transform input.xml -o output.json
```

### Programmatic Usage

```typescript
import { TransformEngine } from '@pie-qti/transform-core';
import { loadFromFile } from '@pie-qti/transform-core/config/config-loader.js';
import { loadAndRegisterPlugins } from '@pie-qti/transform-core/config/plugin-loader.js';
import { loadOrchestrationConfig } from '@pie-qti/transform-types';

// Load configuration
const config = await loadFromFile('./config.json');
const orchestrationConfig = loadOrchestrationConfig();

// Create engine with orchestration
const engine = new TransformEngine();

// Register plugins from config
await loadAndRegisterPlugins(engine, config.plugins);

// Transform - returns a WorkflowHandle for monitoring
const handle = await engine.transform(qtiXml, {
  sourceFormat: 'qti22',
  targetFormat: 'pie'
});

// Monitor progress (optional)
const progress = await handle.progress();
console.log(`Progress: ${progress?.percentage}%`);

// Get result
const result = await handle.result();
console.log('PIE config:', result.pieConfig);
```

### With Progress Monitoring

```typescript
import { TransformEngine } from '@pie-qti/transform-core';
import { Qti22ToPiePlugin } from '@pie-qti/qti2-to-pie';

const engine = new TransformEngine();
engine.use(new Qti22ToPiePlugin());

// Start transformation
const handle = await engine.transform(qtiXml, {
  sourceFormat: 'qti22',
  targetFormat: 'pie'
});

// Poll for progress
const interval = setInterval(async () => {
  const progress = await handle.progress();
  if (progress) {
    console.log(`${progress.currentStep}: ${progress.percentage}%`);
  }
}, 1000);

// Wait for result
const result = await handle.result();
clearInterval(interval);

console.log('Transformation complete!');
console.log('Warnings:', result.warnings);
```

### Batch Transformation

```typescript
const handle = await engine.transformBatch([xml1, xml2, xml3], {
  sourceFormat: 'qti22',
  targetFormat: 'pie',
  parallel: 5  // Process 5 items concurrently
});

const result = await handle.result();
console.log(`✓ ${result.successful.length} successful`);
console.log(`✗ ${result.failed.length} failed`);

// Process successful items
result.successful.forEach(item => {
  console.log(`Item ${item.itemId}:`, item.result.pieConfig);
});

// Handle failures
result.failed.forEach(item => {
  console.error(`Item ${item.itemId} failed:`, item.error);
});
```

## Configuration Precedence

Configuration is merged in this order (later overrides earlier):

1. Default values (hardcoded)
2. Config file (from `PIE_QTI_CONFIG` or `--config`)
3. Environment variables (prefixed with `PIE_QTI_`)

Example:

```bash
# Config file sets: storage.type = "filesystem"
# Environment overrides: storage.type = "s3"
export PIE_QTI_CONFIG=./config.json
export STORAGE_TYPE=s3  # This wins

# Result: S3 backend is used
```

## API Changes (Orchestration Update)

The orchestration refactoring introduced the WorkflowHandle pattern for better progress monitoring and control:

### Old API (No Longer Supported)

```typescript
// Direct result - no progress monitoring
const result = await engine.transform(xml, options);
console.log(result.items);
```

### New API (Current)

```typescript
// Returns WorkflowHandle for monitoring
const handle = await engine.transform(xml, options);

// Optional: monitor progress
const progress = await handle.progress();
console.log(`${progress?.percentage}% complete`);

// Get result
const result = await handle.result();
console.log(result.pieConfig);
```

**Benefits:**

- Real-time progress tracking
- Better error handling in batch operations
- Workflow cancellation support
- Event monitoring for observability
- Extensible for custom orchestrator implementations

## Best Practices

1. **Use config files for shared settings** - Check config files into version control
2. **Use environment variables for secrets** - Never commit AWS keys, database passwords
3. **Use `env:` prefix in config** - Reference environment variables in config files:
   ```json
   {
     "storage": {
       "options": {
         "apiKey": "env:AWS_SECRET_ACCESS_KEY"
       }
     }
   }
   ```
4. **Start simple** - Begin with defaults (in-memory orchestrator), add config as needed
5. **Document custom plugins** - Add README for custom plugin implementations
6. **Version config files** - Include schema version for future compatibility
7. **Monitor workflows** - Use progress tracking and events for long-running transformations

## Troubleshooting

### Config not loading

```bash
# Check config file path
echo $PIE_QTI_CONFIG

# Validate JSON syntax
cat config.json | jq .

# Enable debug logging
export PIE_QTI_LOG_LEVEL=debug
```

### Plugin not found

```bash
# For workspace packages
bun install

# For local files, use absolute paths or relative from project root
{
  "plugins": {
    "qti22": {
      "pie": "./packages/my-plugin/src/index.ts"
    }
  }
}
```

### Storage backend errors

```bash
# Filesystem: check permissions
ls -la ./uploads

# S3: verify credentials
aws s3 ls s3://my-bucket

# Database: test connection
psql $DATABASE_URL -c "SELECT 1"
```

## See Also

- [Architecture Documentation](./ARCHITECTURE.md) - System architecture and design decisions
- [PIE-QTI Transformation Guide](./PIE-QTI-TRANSFORMATION-GUIDE.md) - Complete transformation guide
- [Orchestration Implementation](https://github.com/anthropics/claude-code/blob/main/packages/core/src/orchestration/README.md) - Workflow orchestration details
