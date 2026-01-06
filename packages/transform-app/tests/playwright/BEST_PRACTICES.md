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

## References

- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Playwright Locators Guide](https://playwright.dev/docs/locators)
- [Testing Library Queries Priority](https://testing-library.com/docs/queries/about/#priority)

