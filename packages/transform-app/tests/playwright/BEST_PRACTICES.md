# Playwright E2E Testing Best Practices

## Query Priority (Playwright's Recommended Hierarchy)

### 1. **Semantic Queries (Preferred)**
Use these when elements have clear semantic meaning:

```typescript
// Buttons and links
page.getByRole('button', { name: 'Analyze Packages' })
page.getByRole('link', { name: 'Browse Items' })

// Headings
page.getByRole('heading', { name: /Item Browser/i })

// Form fields
page.getByLabelText('Show Correct')
page.getByPlaceholderText('Enter email')

// Text content
page.getByText('Analysis complete')
```

**Why:** Tests what users actually interact with, better for accessibility, less brittle to styling changes.

### 2. **data-testid (Fallback)**
Use when semantic queries are insufficient:

```typescript
// Dynamic lists where order matters
page.getByTestId('item-select-0')

// Complex components without clear semantic roles
page.getByTestId('upload-dropzone')

// Elements that are hard to target semantically
page.getByTestId('selected-item-title')
```

**When to use:**
- Dynamic lists (order matters for testing)
- Complex custom components
- Elements that change frequently but need stable tests
- Internal state indicators

### 3. **CSS Selectors (Last Resort)**
Avoid unless absolutely necessary:

```typescript
// ❌ Avoid
page.locator('.btn-primary')
page.locator('#my-button')

// ✅ Prefer
page.getByRole('button', { name: 'Submit' })
```

## Examples from Our Tests

### ✅ Good: Semantic Queries
```typescript
// Button with accessible name
await page.getByRole('button', { name: /Analyze Package/i }).click();

// Heading
await expect(page.getByRole('heading', { name: /Item Browser/i })).toBeVisible();

// Link
await page.getByRole('link', { name: /Browse & Preview Items/i }).click();
```

### ✅ Good: data-testid for Dynamic Content
```typescript
// Dynamic list where index matters
await expect(page.getByTestId('item-select-0')).toBeVisible();

// Complex component
await expect(page.getByTestId('upload-dropzone')).toBeVisible();
```

### ❌ Avoid: Overusing data-testid
```typescript
// ❌ Unnecessary - button has accessible name
page.getByTestId('analyze-packages')

// ✅ Better
page.getByRole('button', { name: /Analyze Package/i })
```

## Accessibility Benefits

Using semantic queries ensures:
- Tests verify accessible names (important for screen readers)
- Tests catch accessibility regressions
- Tests align with how users actually interact

## Migration Strategy

1. **Start with semantic queries** - Try `getByRole`, `getByLabelText`, `getByText` first
2. **Fall back to data-testid** - When semantic queries are too fragile or unavailable
3. **Keep data-testid for complex cases** - Dynamic lists, complex components, internal state

## Using Test Helpers

The `test-helpers.ts` file provides shared utilities to reduce duplication and improve test reliability.

### Available Helpers

```typescript
import {
  createSessionFromSample,
  waitForAnalysis,
  waitForPlayerReady,
  navigateToItemsPage,
  selectItem,
  getPlayerElement,
  clickShowCorrect,
  uploadQtiFile,
  playerHasContent,
  playerIsInitialized
} from './test-helpers.js';
```

### Common Patterns

#### Creating a Test Session
```typescript
// Create session from sample (no file upload needed)
const sessionId = await createSessionFromSample(request, 'basic-interactions');
```

#### Waiting for Analysis

```typescript
// Wait for analysis to complete (uses multiple detection strategies)
await waitForAnalysis(page);

// With custom timeout
await waitForAnalysis(page, { timeout: 120_000 });
```

#### Working with QTI Player
```typescript
// Navigate to items page and wait for player
await navigateToItemsPage(page, sessionId);
await waitForPlayerReady(page);

// Select an item
await selectItem(page, 0);

// Get player element for assertions
const playerElement = getPlayerElement(page);
await expect(playerElement).toBeVisible();

// Check player state
const hasContent = await playerHasContent(page);
const isInitialized = await playerIsInitialized(page);
```

### Why Use Helpers?

1. **Reliability**: Helpers use defensive waits and multiple detection strategies
2. **Consistency**: Same patterns across all tests
3. **Maintenance**: Fix once, benefit everywhere
4. **Readability**: Tests focus on what they're testing, not how to wait

## Debugging Timeout Issues

### Common Timeout Causes

1. **Analysis completion not detected**
   - Backend completes but UI doesn't update
   - Text patterns don't match actual output
   - Multiple detection strategies help (see `waitForAnalysis`)

2. **Player component not loading**
   - Web component registration fails
   - Shadow DOM prevents element access
   - Use `waitForPlayerReady()` which polls for registration

3. **Button visibility issues**
   - Button exists but is hidden/disabled
   - Always check visibility before clicking:

   ```typescript
   const button = page.getByRole('button', { name: /Analyze/i });
   await expect(button).toBeVisible({ timeout: 10_000 });
   await button.click();
   ```

4. **API response delays**
   - Server takes time to process
   - Increased timeout in config to 90s for analysis operations

### Debugging Tips

1. **Run in headed mode** to see what's happening:

   ```bash
   bun run test:e2e:headed
   ```

2. **Use trace viewer** for failed tests:

   ```bash
   npx playwright show-trace trace.zip
   ```

3. **Add console logging** to helpers:

   ```typescript
   console.log('Waiting for analysis...');
   await waitForAnalysis(page);
   console.log('Analysis complete!');
   ```

4. **Check network tab** for API failures:

   ```typescript
   page.on('response', response => {
     if (!response.ok()) {
       console.log(`Failed: ${response.url()} ${response.status()}`);
     }
   });
   ```

## Understanding the Analysis Flow

### User Journey

1. **Upload** → Package uploaded to `/api/upload`
2. **Session Created** → Navigate to `/session/{id}`
3. **Analyze** → Click "Analyze Package" button
4. **Processing** → Backend analyzes QTI package (can take 30-60s)
5. **Results** → Analysis results appear with preview links
6. **Browse** → Click "Browse & Preview Items" link
7. **Preview** → Select item, view in QTI player

### Detection Strategy in `waitForAnalysis()`

Uses `Promise.race()` with multiple strategies:
```typescript
const strategies = [
  page.getByRole('link', { name: /Browse & Preview Items/i }).waitFor(),
  page.getByRole('heading', { name: /Analysis Results/i }).waitFor(),
  page.getByText(/Analysis complete/i).waitFor()
];
await Promise.race(strategies);
```

**Why:** Backend may emit different signals, so we check for any of them.

### Common Analysis States

- **Not Started**: "Analyze Package" button visible
- **Processing**: Button disabled, spinner shown
- **Complete**: Results section visible with links
- **Error**: Error message shown, no results

## Working with QTI Player Component

### Web Component Lifecycle

The QTI player is a custom web component (`<pie-qti2-item-player>`):

1. **Registration**: Component class registered with `customElements.define()`
2. **Properties Set**: `itemXml`, `identifier`, `role` properties assigned
3. **Rendering**: Component renders content (uses light DOM, not shadow DOM)
4. **Interactive**: User can interact with rendered QTI item

### Checking Player Readiness

```typescript
// Wait for component to be registered
await waitForPlayerReady(page);

// Verify properties are set
const isInitialized = await playerIsInitialized(page);
expect(isInitialized).toBeTruthy();

// Verify content rendered
const hasContent = await playerHasContent(page);
expect(hasContent).toBeTruthy();
```

### Accessing Player Properties

```typescript
const playerElement = getPlayerElement(page);

// Read properties
const identifier = await playerElement.evaluate((el: any) => el.identifier);
const role = await playerElement.evaluate((el: any) => el.role);
const itemXml = await playerElement.evaluate((el: any) => el.itemXml);
```

### Show Correct Toggle

```typescript
// Toggle "Show Correct" mode
await clickShowCorrect(page);

// Verify role changed
const role = await playerElement.evaluate((el: any) => el.role);
expect(role).toBe('scorer'); // 'candidate' when unchecked
```

## Common Failure Patterns and Fixes

### Pattern 1: "Timed out waiting for..."

**Problem**: Element never becomes visible

**Fixes**:

1. Check if button is hidden/disabled before clicking
2. Use `waitForAnalysis()` instead of waiting for specific text
3. Increase timeout for slow operations
4. Use multiple detection strategies (Promise.race)

### Pattern 2: "Multiple matches found"

**Problem**: Selector matches more than one element

**Fixes**:

1. Use `.first()` or `.nth(0)` if any match is acceptable
2. Add more specific selectors (combine role + name)
3. Use unique data-testid for specific elements

### Pattern 3: "Player not found"

**Problem**: Web component not registered or not rendered

**Fixes**:

1. Always use `waitForPlayerReady()` before accessing player
2. Check if player properties are set (`playerIsInitialized`)
3. Verify item was selected before expecting player content

### Pattern 4: "Shadow DOM elements not found"

**Problem**: Elements inside shadow DOM aren't accessible

**Fixes**:

1. Use `.evaluate()` to run JavaScript inside shadow DOM
2. Dispatch events programmatically instead of clicking
3. Test public API (properties, events) instead of internals

### Pattern 5: "Test passes locally, fails in CI"

**Problem**: Timing differences between local and CI environments

**Fixes**:

1. Use proper waits instead of `page.waitForTimeout()`
2. Enable retries in CI (configured in playwright.config.ts)
3. Increase timeouts for slow operations
4. Use `trace: 'on-first-retry'` to debug CI failures

## References

- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Playwright Locators Guide](https://playwright.dev/docs/locators)
- [Testing Library Queries Priority](https://testing-library.com/docs/queries/about/#priority)

