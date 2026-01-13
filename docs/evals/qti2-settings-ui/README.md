# Settings UI Evaluation Suite

This evaluation suite tests the SettingsMenu component functionality, including locale selection, theme switching, keyboard navigation, and accessibility.

## Overview

The SettingsMenu component provides:
- **Locale selection**: Switch between 8 supported languages
- **Theme selection**: Choose from 33 DaisyUI themes + 1 custom high-contrast theme
- **Persistence**: Selections saved to localStorage
- **Accessibility**: Full keyboard navigation and ARIA labels

## Test Coverage

### 1. Settings Menu (`settings-menu/`)
**4 eval cases**

Tests the dropdown menu functionality:
- **Open/close behavior**: Menu visibility, backdrop dismissal
- **Locale selection**: Clicking language options, checkmark feedback
- **Keyboard navigation**: Tab and Enter key navigation
- **ARIA labels**: Screen reader accessibility, role attributes

Key features tested:
- Settings gear icon visibility
- Language and Theme sections
- Visual feedback (checkmarks for active selection)
- Menu auto-close on selection
- Focus management

### 2. Theme Switching (`theme-switching/`)
**3 eval cases**

Tests theme change functionality:
- **Light to dark**: Immediate visual change, localStorage persistence
- **High contrast**: WCAG AAA compliance, visual distinction
- **Persistence**: Theme applied on page load from localStorage

Available themes:
- **Standard DaisyUI**: light, dark, cupcake, bumblebee, emerald, corporate, synthwave, retro, cyberpunk, valentine, halloween, garden, forest, aqua, lofi, pastel, fantasy, wireframe, black, luxury, dracula, cmyk, autumn, business, acid, lemonade, night, coffee, winter, dim, nord, sunset
- **Custom**: high-contrast (WCAG AAA compliant)

## Running the Tests

### Run all settings UI evals
```bash
cd packages/qti2-example
bun run test:e2e -- docs/evals/qti2-settings-ui
```

### Run specific category
```bash
# Settings menu tests
bun run test:e2e -- docs/evals/qti2-settings-ui/settings-menu

# Theme switching tests
bun run test:e2e -- docs/evals/qti2-settings-ui/theme-switching
```

### Run with UI mode (for debugging)
```bash
bun run test:e2e:ui -- docs/evals/qti2-settings-ui
```

## Implementation Details

### Component Location
- **File**: `packages/qti2-example/src/lib/components/SettingsMenu.svelte`
- **Location**: Top-right corner of navbar (gear icon)

### localStorage Keys
- **`pie-qti-locale`**: Selected language code (e.g., "es-ES")
- **`theme`**: Selected theme name (e.g., "dark")

### Theme Application
- Theme set via `data-theme` attribute on `<html>` element
- DaisyUI applies CSS variables based on theme
- Theme change is immediate (no page reload)

### Locale Application
- Locale change triggers full page reload
- i18n provider reinitialized with new locale
- Ensures all components use new translations

## Accessibility Testing

### Keyboard Navigation
1. **Tab** to settings gear icon
2. **Enter** to open menu
3. **Tab** through language/theme options
4. **Enter** to select option
5. **Escape** to close menu (optional)

### ARIA Attributes Validated
- `aria-label` on settings button
- `role="menu"` on dropdown
- `role="menuitem"` on options
- `aria-current="true"` on active selection
- `aria-haspopup="true"` on trigger button

### Visual Focus Indicators
- Clear focus outline on all interactive elements
- Hover states for all menu items
- Active state styling for selected items

## Spirit Checks

All evals include spirit checks to validate:
- **Usability**: Menu is intuitive and easy to operate
- **Visual feedback**: Active selections are clearly indicated
- **Accessibility**: Full keyboard access and screen reader support
- **Performance**: Theme changes are immediate and smooth
- **Persistence**: Selections survive page reloads

## Related Documentation

- **SettingsMenu component**: `packages/qti2-example/src/lib/components/SettingsMenu.svelte`
- **i18n system**: `docs/evals/qti2-i18n/README.md`
- **Root layout**: `packages/qti2-example/src/routes/+layout.svelte`

## Notes for Test Runners

### YAML Features Used
- **`pressKey`**: Keyboard navigation simulation (proposed extension)
- **`observe`**: ARIA attribute validation
- **`localStorage` assertions**: Validate persistence

### Potential Flakiness
- **Dropdown timing**: Menu may need delay after click to fully render
- **Theme flashing**: Visual validation may vary by browser rendering speed
- **Focus indicators**: CSS pseudo-classes may differ across browsers

## Success Criteria

- ✅ Settings menu is fully accessible via keyboard
- ✅ All ARIA attributes are present and correct
- ✅ Theme changes are immediate and persistent
- ✅ Locale changes trigger reload and persist
- ✅ Visual feedback (checkmarks) is clear and consistent
- ✅ Menu opens/closes reliably
- ✅ No layout issues with long theme/locale names
