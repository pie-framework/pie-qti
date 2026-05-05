# E2E Tests

This directory contains end-to-end tests for the QTI 2.2 Player components.

## Test Types

### Accessibility Tests (`playwright/component-fixtures-a11y.pw.ts`)

Automated WCAG 2.2 Level AA compliance testing using Playwright + axe-core.

**What it tests:**
- Axe rules tagged `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, and `wcag22aa`
- Component fixture scans under `/a11y-components/{fixture}`
- Focusability smoke checks for each fixture
- Targeted behavior checks in `playwright/assessment-a11y-behavior.pw.ts`
- Selected keyboard, focus, live-region, and alert semantics
- Color contrast ratios
- Target size rules that axe can detect

**Components tested:**
The fixture list is defined in `src/lib/a11y/fixtures.ts` and includes item-player/default-component interactions plus assessment-player shell, navigation, menu, timer, rubric, modal feedback, media, and upload surfaces.

## Running Tests

```bash
# Run all accessibility tests
bun run test:a11y

# Run with UI mode (interactive debugging)
bun run test:a11y:ui

# Run in headed mode (see browser)
bun run test:e2e:headed

# Run all E2E tests
bun run test:e2e
```

## Test Design Philosophy

These tests are designed to be:

### Fast ⚡
- Minimal page loads (reuse dev server)
- Focused selectors (no unnecessary waits)
- Parallel execution (6 workers)
- **Typical execution time**: 30-40 seconds

### Reliable 🎯
- Proper wait conditions (`waitForLoadState`, `waitForSelector`)
- Stable selectors (roles, labels, IDs)
- No flaky timeouts
- Clear error messages

### Focused 🔍
- Test player components, not demo app UI
- Use `.include()` and `.exclude()` to scope scans
- Separate tests for different interaction types
- Clear test descriptions

## Test Structure

```typescript
test.describe('Component Name', () => {
  test('should not have WCAG violations', async ({ page }) => {
    await selectSampleItem(page, 'sample-id');

    const results = await new AxeBuilder({ page })
      .include('[data-testid="a11y-fixture-root"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('should have keyboard support', async ({ page }) => {
    // Test specific keyboard interactions
  });
});
```

## Understanding Failures

When tests fail, Playwright generates detailed reports in `test-results/`:

```bash
# View HTML report
bunx playwright show-report
```

**Common failure reasons:**

1. **Color contrast**: Text doesn't meet 4.5:1 ratio
   - Fix: Adjust color or increase font size

2. **Missing labels**: Form controls need accessible names
   - Fix: Add `<label>`, `aria-label`, or `aria-labelledby`

3. **Keyboard inaccessible**: Element not in tab order
   - Fix: Add `tabindex="0"` or use native interactive element

4. **Missing ARIA**: Dynamic content not announced
   - Fix: Add `aria-live="polite"` region

## Adding New Tests

To test a new component:

1. Add a fixture component under `src/lib/a11y/fixtures/`.
2. Add the fixture id and title to `src/lib/a11y/fixtures.ts`.
3. Wire the fixture into `src/routes/a11y-components/[fixture]/+page.svelte`.
4. Add targeted behavior assertions to `playwright/assessment-a11y-behavior.pw.ts` when axe cannot cover the risk.

The generic fixture scan will pick it up automatically because it iterates over `A11Y_FIXTURES`.

5. Run test: `bun run test:a11y`

## Limitations

Automated accessibility testing can only catch ~57% of WCAG issues.

**Cannot be automated** (requires manual testing):
- Logical reading order
- Content clarity and comprehension
- Keyboard trap detection
- Screen reader experience
- Focus management edge cases

**For comprehensive testing**, combine automated tests with:
- Manual keyboard navigation testing
- Real screen reader testing (NVDA, JAWS, VoiceOver)
- User testing with people who use assistive technology

## Resources

- [axe-core Rules](https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md)
- [WCAG 2.2 Guidelines](https://www.w3.org/WAI/WCAG22/quickref/)
- [Playwright Documentation](https://playwright.dev/docs/intro)
- [WCAG-2.2-COMPLIANCE.md](../../../packages/item-player/docs/WCAG-2.2-COMPLIANCE.md) - Player component compliance analysis
