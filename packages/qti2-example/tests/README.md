# E2E Tests

This directory contains end-to-end tests for the QTI 2.2 Player components.

## Test Types

### Accessibility Tests (`e2e/accessibility.spec.ts`)

Automated WCAG 2.2 Level AA compliance testing using Playwright + axe-core.

**What it tests:**
- WCAG 2.2 Level AA compliance for player components
- Keyboard navigation support
- Screen reader compatibility (ARIA, live regions)
- Color contrast ratios
- Target sizes (24×24px minimum)
- Focus management

**Components tested:**
1. SortableList (orderInteraction)
2. MatchDragDrop (matchInteraction)
3. InlineInteractionRenderer (textEntry, inlineChoice)
4. GraphicGapMatch (graphicGapMatchInteraction)

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
      .include('[role="region"]')  // Focus on player area
      .exclude('#demo-controls')    // Ignore demo app
      .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
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

1. Add sample item to `sample-items.ts`
2. Create test in `accessibility.spec.ts`:

```typescript
test.describe('YourComponent', () => {
  test('should not have WCAG violations', async ({ page }) => {
    await selectSampleItem(page, 'your-sample-id');

    const results = await new AxeBuilder({ page })
      .include('[role="your-component-role"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });
});
```

3. Run test: `bun run test:a11y`

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
- [WCAG-2.2-COMPLIANCE.md](../../../qti2-item-player/WCAG-2.2-COMPLIANCE.md) - Player component compliance analysis

## Results

See [ACCESSIBILITY-TEST-RESULTS.md](../ACCESSIBILITY-TEST-RESULTS.md) for latest test results and identified issues.
