# i18n (Internationalization) Evaluation Suite

This evaluation suite tests the internationalization (i18n) system across all 8 supported locales in the PIE QTI 2.2 Player.

## Overview

The i18n system provides complete multilingual support for:
- **UI text**: Buttons, labels, feedback messages, error messages
- **QTI item content**: Translated question prompts, choices, and feedback
- **RTL languages**: Right-to-left text direction for Arabic
- **Fallback behavior**: Graceful handling of missing translations or unsupported locales

## Supported Locales

- **en-US**: English (United States) — Default
- **es-ES**: Spanish (Spain)
- **fr-FR**: French (France)
- **nl-NL**: Dutch (Netherlands)
- **ro-RO**: Romanian (Romania)
- **th-TH**: Thai (Thailand)
- **zh-CN**: Chinese (Simplified, China)
- **ar-SA**: Arabic (Saudi Arabia) — RTL language

## Test Coverage

### 1. Locale Switching (`locale-switching/`)
**3 eval cases**

Tests the locale selection UI in the SettingsMenu component:
- Switching between locales via dropdown menu
- Persistence of locale selection via localStorage
- Cycling through all 8 locales
- Visual feedback (checkmarks) for active locale

### 2. Multilingual Items (`multilingual-items/`)
**4 eval cases**

Tests QTI item content rendering in different languages:
- English baseline (default locale)
- Spanish translated content
- Arabic content with RTL text
- Chinese character rendering
- Scoring consistency across locales

**Multilingual Sample Items** (15 total):
- capital-cities
- drawing-interaction
- extended-text
- graphic-gap-match-solar-system
- graphic-order
- hotspot-interaction
- hottext-multiple
- hottext-single
- inline-choice
- match-interaction
- order-interaction
- partial-credit
- simple-choice
- slider-interaction
- text-entry

### 3. UI Translations (`ui-translations/`)
**3 eval cases**

Tests that UI elements are translated:
- Submit buttons and navigation controls
- Rich text editor labels (extended-text)
- Slider labels and value formatting
- Feedback messages
- Validation error messages

Translation keys from `@pie-qti/qti2-i18n`:
- `common.*`: General UI strings
- `interactions.*`: Interaction-specific labels
- `item.*`: Item-level UI text
- `feedback.*`: Feedback messages

### 4. RTL Support (`rtl-support/`)
**2 eval cases**

Tests right-to-left language rendering (Arabic):
- Text direction and alignment
- Choice option layout in RTL
- Hottext selection in RTL
- Visual feedback and highlighting

### 5. Locale Fallback (`locale-fallback/`)
**2 eval cases**

Tests graceful degradation:
- Unsupported locale codes (e.g., de-DE German)
- Invalid localStorage values
- Fallback to English (en-US)
- No crashes or broken UI

## Running the Tests

### Run all i18n evals
```bash
cd packages/qti2-example
bun run test:e2e -- docs/evals/qti2-i18n
```

### Run specific category
```bash
# Locale switching tests
bun run test:e2e -- docs/evals/qti2-i18n/locale-switching

# Multilingual items tests
bun run test:e2e -- docs/evals/qti2-i18n/multilingual-items

# UI translations tests
bun run test:e2e -- docs/evals/qti2-i18n/ui-translations

# RTL support tests
bun run test:e2e -- docs/evals/qti2-i18n/rtl-support

# Fallback tests
bun run test:e2e -- docs/evals/qti2-i18n/locale-fallback
```

### Run with UI mode (for debugging)
```bash
bun run test:e2e:ui -- docs/evals/qti2-i18n
```

## Implementation Details

### localStorage Keys
- **`pie-qti-locale`**: Stores selected locale code (e.g., "es-ES")

### i18n Provider
- Created in root layout (`+layout.svelte`)
- Provided via Svelte context to all components
- Lazy-loads translation files for optimal bundle size

### Locale Switching Flow
1. User clicks settings gear icon → dropdown opens
2. User selects language → `i18n.setLocale(newLocale)` called
3. localStorage updated, page reloads
4. New locale applied on mount

### Multilingual Item Loading
- Items are lazy-loaded per locale via dynamic imports
- Located in `packages/qti2-example/src/lib/sample-items-i18n/`
- Fallback chain: exact locale → language variant → en-US

## Spirit Checks

All evals include spirit checks to validate:
- **Pedagogical appropriateness**: Translations are grade-appropriate
- **Clarity**: Instructions and choices are clear in all languages
- **Visual quality**: Special scripts (Arabic, Thai, Chinese) render correctly
- **Consistency**: UI is consistently translated (no mixed languages)
- **Accessibility**: RTL layout is natural and readable

## Related Documentation

- **i18n package**: `packages/qti2-i18n/README.md`
- **Translation keys**: `packages/qti2-i18n/src/locales/en-US.ts`
- **Sample items**: `packages/qti2-example/src/lib/sample-items-i18n/`
- **Settings menu**: `packages/qti2-example/src/lib/components/SettingsMenu.svelte`

## Notes for Test Runners

### New YAML Features Used
These evals use proposed YAML schema extensions:
- **`setLocalStorage`**: Set localStorage before navigation
- **`localStorage` assertions**: Validate localStorage values in `expected` block
- **`pressKey`**: Simulate keyboard navigation

The Playwright runner may need updates to support these features.

### Potential Flakiness
- **Page reloads**: Locale switching triggers full reload; use `waitForLoadState()`
- **Font loading**: Special scripts may have delayed rendering
- **RTL detection**: Visual layout checks may vary by browser

## Success Criteria

- ✅ All 8 locales accessible and functional
- ✅ Scoring works identically across all locales
- ✅ RTL (Arabic) renders correctly with proper text direction
- ✅ Special characters (Thai, Chinese, Arabic) display correctly
- ✅ Fallback to English when locale is unsupported
- ✅ No broken UI or missing translations
- ✅ localStorage persistence works reliably
