# Web Components Configuration Evaluation Suite

This evaluation suite tests configuration passing to QTI player web components via JSON attributes and properties, including security config, i18n provider, and response initialization.

## Overview

Web component configuration includes:
- **Security config**: `assetBaseUrl` for asset resolution
- **i18n provider**: Translation provider for UI text
- **Response initialization**: Pre-filled responses via JSON attribute
- **Configuration inheritance**: Assessment → item player propagation

## Test Coverage

### Configuration Passing (`configuration-passing/`)
**4 eval cases**

Tests various configuration scenarios:
- **Security config**: `assetBaseUrl` applied to item player
- **i18n provider**: Translation provider passed via Svelte context
- **Assessment inheritance**: Config propagates from assessment to items
- **Security inheritance**: All items in assessment use same security config

Configuration methods tested:
- JSON attributes (`security-json`, `responses-json`)
- Svelte context (i18n provider)
- Property setters (programmatic config)

## Running the Tests

### Run all web component evals
```bash
cd packages/qti2-example
bun run test:e2e -- docs/evals/qti2-web-components
```

### Run with UI mode (for debugging)
```bash
bun run test:e2e:ui -- docs/evals/qti2-web-components
```

## Implementation Details

### Web Component Elements
**Files**:
- `packages/qti2-player-elements/src/elements/Qti22ItemPlayerElement.ts`
- `packages/qti2-player-elements/src/elements/Qti22AssessmentPlayerElement.ts`

### Observed Attributes
```typescript
static observedAttributes = [
  'item-xml',
  'assessment-test-xml',
  'security-json',      // Security configuration
  'responses-json',     // Pre-filled responses
  // ...
];
```

### Security Config Structure
```typescript
{
  urlPolicy: {
    assetBaseUrl: string;
  }
}
```

### i18n Provider Passing
**Via Svelte Context**:
```typescript
// Root layout
setContext('i18n', { get value() { return i18n; } });

// Item demo page
const i18nContext = getContext<{ value: SvelteI18nProvider | null }>('i18n');
```

### Assessment to Item Propagation
**File**: `packages/qti2-assessment-player/src/core/AssessmentPlayer.ts`

Config options passed to all item players:
- `i18nProvider`: Translation provider
- `security`: Security configuration including `assetBaseUrl`

## Spirit Checks

All evals include spirit checks to validate:
- **Config reach**: Configuration reaches all components that need it
- **Consistency**: Same config applied uniformly across items
- **No leakage**: Config doesn't bleed between independent sessions
- **Reliability**: Config passing works across navigation

## Related Documentation

- **Web components**: `packages/qti2-player-elements/README.md`
- **Assessment player**: `packages/qti2-assessment-player/README.md`
- **Item player**: `packages/qti2-item-player/README.md`
- **Security config**: `packages/qti2-example/src/lib/player-config.ts`

## Notes for Test Runners

### YAML Features
These evals primarily use:
- **`navigate`**: Standard navigation
- **`observe`**: Validate config effects (translated text, loaded assets)
- **`localStorage` assertions**: Verify locale persistence

### Validation Strategies
Config validation is indirect:
- **Security**: Verify assets load (no 404s)
- **i18n**: Verify UI text is translated
- **Responses**: Verify pre-filled selections are visible

### Potential Flakiness
- **Timing**: Config may apply asynchronously
- **Shadow DOM**: Config effects may be in shadow roots
- **Context timing**: Svelte context may not be immediately available

## Success Criteria

- ✅ Security config applied to all players
- ✅ i18n provider reaches all components
- ✅ Config propagates from assessment to items
- ✅ Asset URLs resolve correctly with security config
- ✅ UI text is consistently translated
- ✅ No config-related errors or warnings
- ✅ Config persistence works across navigation
