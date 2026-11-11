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

Configuration files should be in JSON format. The file (loaded via `loadFromFile()` in `packages/core/src/config/config-loader.ts`) matches the `TransformConfig` type defined in `packages/types/src/config/plugin-config.ts`:

```json
{
  "storage": {
    "backend": "filesystem",
    "options": {
      "rootDir": "./uploads"
    }
  },
  "plugins": {
    "qti22": {
      "pie": {
        "module": "@pie-qti/to-pie",
        "export": "QtiToPiePlugin"
      }
    }
  },
  "formatDetectors": [
    { "module": "@my-org/qti-custom-detector", "export": "CustomDetector" }
  ],
  "vendorExtensions": {
    "detectors": [
      { "module": "@my-org/qti-vendor-detector", "export": "MyOrgDetector" }
    ],
    "transformers": [
      { "module": "./extensions/custom-interaction.ts", "options": { "pieType": "custom-interaction" } }
    ]
  },
  "logger": {
    "level": "info"
  }
}
```

Notes:

- Plugin, detector, and vendor-extension entries are **objects** (`module`, optional `export`, optional `options`), not plain module-path strings. The loader dynamically imports `module` and instantiates the default export unless `export` names one; `options` is passed to the constructor.
- There is **no `orchestration` or `defaultOptions` section in the file config**. Orchestrator and storage settings come from constructor injection (`new TransformEngine(orchestrator?, storage?)`). See [Orchestration Configuration](#orchestration-configuration).

## Orchestration Configuration

Transformation workflows run through a `WorkflowOrchestrator` (`packages/types/src/orchestration/orchestrator.ts`), which provides retry handling, progress tracking, and workflow execution.

**Orchestrator settings are constructor-only. There is no orchestration section in the config file and no orchestration environment variables.**

### In-Memory Orchestrator (Default)

The `TransformEngine` constructor takes an optional orchestrator and storage backend and defaults to the in-memory orchestrator (`packages/core/src/engine/transform-engine.ts`):

```typescript
import { TransformEngine } from '@pie-qti/transform-core';

const engine = new TransformEngine(); // in-memory orchestrator, no storage backend
const engineWithDeps = new TransformEngine(myOrchestrator, myStorage);
```

Retry behavior is a property of the orchestrator/workflow, not of configuration files or environment variables. The shipped `InMemoryOrchestrator` (`packages/core/src/orchestration/in-memory-orchestrator.ts`) resolves the retry policy per activity from `activityOptions.retryPolicy`, falling back to the activity's own `retryPolicy`, then the workflow's `options.retryPolicy`, then its built-in default (3 attempts, 1000 ms initial interval, 30 s max interval, backoff coefficient 2). Pass a `RetryPolicy` in the workflow options or on the activity definition to override it.

### Custom Orchestrators

The orchestration layer is fully extensible. You can implement custom orchestrators by implementing the `WorkflowOrchestrator` interface and injecting them via the constructor. For production deployments requiring durable execution and advanced workflow capabilities, consider implementing a custom orchestrator using a workflow engine like [Temporal](https://temporal.io/).

## Storage Configuration

Configure where uploaded files, sessions, and outputs are stored. The `storage.backend` key selects the backend; `options` are passed to the backend implementation.

### In-Memory Backend (Default)

The in-memory backend stores files in memory and is suitable for development and testing:

```json
{
  "storage": {
    "backend": "memory"
  }
}
```

### Filesystem Backend

Store files on the local filesystem. The filesystem backend uses `rootDir` (not `basePath`):

```json
{
  "storage": {
    "backend": "filesystem",
    "options": {
      "rootDir": "./uploads"
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
    "backend": "s3",
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
    "backend": "database",
    "options": {
      "connectionString": "postgresql://user:pass@localhost:5432/pie_qti"
    }
  }
}
```

## Plugin Configuration

Configure transformation plugins for different format pairs. Plugin entries are `PluginConfig` objects: `module` (NPM package or file path), optional `export` (named export — the loader instantiates the module's default export when omitted), and optional `options` passed to the plugin constructor.

### Built-in Plugins

```json
{
  "plugins": {
    "qti22": {
      "pie": {
        "module": "@pie-qti/to-pie",
        "export": "QtiToPiePlugin"
      }
    }
  }
}
```

### Custom Plugins

```json
{
  "plugins": {
    "qti30": {
      "pie": {
        "module": "./plugins/qti30-to-pie.ts"
      }
    },
    "pie": {
      "qti22": {
        "module": "./plugins/pie-to-qti22.ts",
        "export": "PieToQti22Plugin"
      }
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
        "module": "@pie-qti/to-pie",
        "export": "QtiToPiePlugin",
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

Configure vendor-specific QTI extensions under the `vendorExtensions` key. Each list holds module references (`module`, optional `export`, optional `options`):

```json
{
  "vendorExtensions": {
    "detectors": [
      { "module": "@acme/qti-extensions", "export": "AcmeVendorDetector" }
    ],
    "transformers": [
      { "module": "@acme/qti-extensions", "export": "AcmeAudioRecordingTransformer", "options": { "pieType": "audio-response" } }
    ],
    "assetResolvers": [],
    "cssClassExtractors": [],
    "metadataExtractors": []
  }
}
```

Available lists: `detectors`, `transformers`, `assetResolvers`, `cssClassExtractors`, `metadataExtractors` (see `VendorExtensionConfig` in `packages/types/src/config/vendor-config.ts`).

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

This section covers **custom detectors only**. The `TransformEngine` constructor auto-registers the built-in `qti-detector` and `pie-detector`, so standard QTI/PIE detection needs no configuration.

Custom detectors are `PluginConfig` objects (module/export/options), not bare file paths:

```json
{
  "formatDetectors": [
    { "module": "./detectors/qti30-detector.ts" },
    { "module": "@my-org/custom-detector", "export": "CustomFormatDetector" }
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

Four environment variables are read, all by `loadFromEnv()` in `packages/core/src/config/config-loader.ts` (the CLI calls it from `BaseCommand.loadConfig()` in `tools/cli/src/base-command.ts`):

```bash
export PIE_QTI_CONFIG=/path/to/config.json   # Config file path
export PIE_QTI_STORAGE_BACKEND=filesystem    # memory, filesystem, s3, database, or a custom backend name
export PIE_QTI_STORAGE_ROOT_DIR=./uploads    # Only read when PIE_QTI_STORAGE_BACKEND=filesystem
export PIE_QTI_LOG_LEVEL=debug               # debug, info, warn, error
```

Behavior, matching the loader source exactly:

- **`PIE_QTI_CONFIG`** names a JSON config file. When it is set, `loadFromEnv()` returns an empty config — the other three variables are **not** read in that call — and the caller is expected to load the file with `loadFromFile()`. The CLI does this in `loadConfig()`, where a `--config` flag takes priority over `PIE_QTI_CONFIG` (the env var is only consulted when no flag was passed).
- **`PIE_QTI_STORAGE_BACKEND`** sets `config.storage.backend`. The value is not validated by the loader; it is matched against a backend by whatever constructs the backend. **`PIE_QTI_STORAGE_ROOT_DIR`** becomes `config.storage.options.rootDir`, but only when the backend is exactly `filesystem`.
- **`PIE_QTI_LOG_LEVEL`** becomes `config.logger.level`. The value is cast, not validated — anything other than `debug`/`info`/`warn`/`error` passes through unchanged.
- The CLI applies only the `plugins` and `formatDetectors` sections of the merged config to the engine (`BaseCommand.createEngine()`). The `storage` and `logger` sections come back to the embedding application to act on — for example, constructing the storage backend passed to `new TransformEngine(orchestrator, storage)`.

## Usage Examples

### CLI Tool

Pass config file via `--config` flag:

```bash
# Transform with config file
bun run pie-qti -- transform input.xml -o output.json --config ./config.json

# Config file loads plugins automatically
bun run pie-qti -- transform input.xml --config ./my-plugins.json

# Without config, uses defaults
bun run pie-qti -- transform input.xml -o output.json
```

### Programmatic Usage

```typescript
import { TransformEngine } from '@pie-qti/transform-core';
import { loadFromFile } from '@pie-qti/transform-core/config/config-loader.js';
import { loadAndRegisterPlugins } from '@pie-qti/transform-core/config/plugin-loader.js';

// Load configuration
const config = await loadFromFile('./config.json');

// Create engine (defaults to the in-memory orchestrator; pass an
// orchestrator and storage backend to override)
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
import { QtiToPiePlugin } from '@pie-qti/to-pie';

const engine = new TransformEngine();
engine.use(new QtiToPiePlugin());

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

> `engine.transformBatch()` requires a storage backend. Without one it throws
> `Storage backend required for batch transformation` — pass a backend via
> `new TransformEngine(orchestrator, storage)` before batching.

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

The CLI (`BaseCommand.loadConfig()`) builds the effective config in this order — **the config file overrides the environment, not the other way around**:

1. `loadFromEnv()`: `PIE_QTI_STORAGE_BACKEND` / `PIE_QTI_STORAGE_ROOT_DIR` / `PIE_QTI_LOG_LEVEL`. When `PIE_QTI_CONFIG` is set, this step yields an empty config (see [Environment Variables](#environment-variables)).
2. The config file — `--config <path>` if given, otherwise `PIE_QTI_CONFIG` — merged over step 1 with `merge()`.

`merge()` semantics (`packages/core/src/config/config-loader.ts`): a storage section with a *different* backend replaces the whole storage section including its options; the *same* backend merges options key by key. `plugins` merge per source format, `formatDetectors` and `vendorExtensions` lists are concatenated, `logger` fields are overwritten.

Example:

```bash
# Config file sets: storage.backend = "filesystem", storage.options.rootDir = "./uploads"
export PIE_QTI_CONFIG=./config.json

# The file wins over any environment value — PIE_QTI_CONFIG being set means
# loadFromEnv() contributed nothing, and the file was merged over it.
export PIE_QTI_STORAGE_BACKEND=s3  # Ignored

# Result: filesystem backend from the file is used
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
      "pie": {
        "module": "./packages/my-plugin/src/index.ts"
      }
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
- [Orchestration implementation](../packages/core/src/orchestration/index.ts) — in-memory orchestrator and workflow definitions
