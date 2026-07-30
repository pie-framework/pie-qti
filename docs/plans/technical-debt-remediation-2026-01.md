> **Historical audit — January 2026.** Recovered from a dropped git stash on 2026-07-30
> and kept for the items that are still open. Read it with three caveats:
>
> - **The CRITICAL items in Phase 1 are resolved.** Weak random ID generation and the
>   non-uniform shuffle were fixed in `3c56bd9` and `f4655e6` (CSPRNG identifiers via
>   `crypto.randomUUID`/`getRandomValues`, `fs.mkdtemp` for temp directories, and
>   Fisher-Yates shuffling seeded from the item session GUID). The `eval()` finding was
>   already clean when re-checked.
> - **Package names predate the rename.** References to `qti2-item-player`,
>   `transform-app` and similar map to today's `item-player`, `to-pie`/`pie-to-qti2` and
>   friends; `transform-app` no longer exists.
> - **The remaining Phase 2/3 items have not been re-verified** against the current code.
>   Treat them as leads to confirm, not as a known-accurate backlog.

# Technical Debt & Security Remediation Plan

**Status**: Draft for Review
**Created**: 2026-01-17
**Scope**: Address 18 identified categories of technical debt, security vulnerabilities, and code quality issues

---

## Executive Summary

This plan addresses critical security vulnerabilities, type safety issues, and code quality problems discovered during a comprehensive codebase audit. The remediation is organized into 4 phases based on severity and impact:

- **Phase 1 (Critical)**: Security vulnerabilities and data integrity issues
- **Phase 2 (High)**: Type safety and reliability improvements
- **Phase 3 (Medium)**: Incomplete implementations and maintainability
- **Phase 4 (Low)**: Code quality and technical debt cleanup

**Estimated Impact**:
- Eliminates 5 critical security vulnerabilities
- Reduces type assertions (`as any`) by 60-80%
- Improves error handling consistency across 30+ files
- Completes 2 incomplete backend implementations

---

## Phase 1: Critical Security & Stability Fixes

### 1.1 Replace Weak Random ID Generation 🔴 CRITICAL

**Issue**: Session and package IDs use `Math.random()` which is not cryptographically secure and vulnerable to brute-force attacks.

**Affected Files**:
- `packages/transform-app/src/routes/api/upload/+server.ts` (lines 16, 69)
- `packages/transform-app/src/lib/server/storage/app-session-storage.ts` (line 28)
- `packages/transform-app/src/routes/api/samples/[id]/load/+server.ts` (line 28)

**Solution**:
```typescript
// Before (INSECURE)
const sessionId = Math.random().toString(36).substring(2, 15) + Date.now();

// After (SECURE)
import { randomUUID } from 'crypto';
const sessionId = randomUUID();
```

**Implementation Steps**:
1. Add `crypto` import to all affected files
2. Replace all `Math.random().toString(36)` ID generation with `randomUUID()`
3. Update any ID format validation that expects the old format
4. Add tests verifying UUID v4 format compliance

**Verification**:
- Run existing tests to ensure UUID format is accepted
- Add new test: verify IDs are RFC 4122 compliant
- Manual test: upload → analyze → transform workflow

---

### 1.2 Remove eval() Usage in Scripts 🔴 CRITICAL

**Issue**: Direct `eval()` execution in i18n scripts poses arbitrary code execution risk.

**Affected Files**:
- `packages/qti2-i18n/scripts/check-translations.ts` (line 73)

**Solution**:
```typescript
// Before (DANGEROUS)
const data = eval(`(${objectString})`);

// After (SAFE)
const data = JSON.parse(objectString);
```

**Implementation Steps**:
1. Replace `eval()` with `JSON.parse()`
2. Add try-catch for parse errors with meaningful error messages
3. If object literals are needed, use a proper JS/TS parser or AST library
4. Run translation check script to verify it still works

**Verification**:
- Run: `cd packages/qti2-i18n && bun run check-translations`
- Verify all locale files are parsed correctly
- CI translation check job must pass

---

### 1.3 Fix Silent Sanitization Failures 🔴 CRITICAL

**Issue**: Sanitization errors return empty string silently, causing content loss without warning.

**Affected Files**:
- `packages/qti2-item-player/src/core/sanitizer.ts` (lines 206-212)

**Solution**:
```typescript
// Before (SILENT FAILURE)
catch (error) {
  console.error('Sanitization failed:', error);
  return ''; // Caller has no way to know!
}

// After (EXPLICIT ERROR)
catch (error) {
  throw new SanitizationError('Failed to sanitize content', { cause: error });
}
```

**Implementation Steps**:
1. Create `SanitizationError` class in `packages/qti2-item-player/src/core/errors.ts`
2. Update sanitizer to throw instead of returning empty string
3. Update callers to handle `SanitizationError` appropriately
4. Add logging at call sites for debugging
5. Update tests to expect errors on invalid input

**Verification**:
- Run: `bun test packages/qti2-item-player/tests/security/`
- Add new test: verify `SanitizationError` thrown on malformed HTML
- Manual test: load QTI item with complex HTML markup

---

### 1.4 Add Bounds Checking to Substring Operations 🔴 CRITICAL

**Issue**: Unsafe `substring()` operations with hardcoded offsets can cause runtime errors or incorrect parsing.

**Affected Files**:
- `packages/qti2-to-pie/src/transformers/inline-dropdown.ts` (lines 127-138, 216, 276)
- `packages/qti2-to-pie/src/transformers/drag-in-the-blank.ts` (lines 192-205)
- `packages/qti2-to-pie/src/transformers/select-text.ts` (lines 211-261)
- `packages/qti2-to-pie/src/transformers/explicit-constructed-response.ts` (lines 137-146)
- `packages/qti2-to-pie/src/utils/pie-extension.ts` (line 142)

**Solution**:
```typescript
// Before (UNSAFE)
if (itemBodyHtml.substring(audioEnd, audioEnd + 2) === '<a') { ... }
const extracted = json.substring(9, json.length - 3); // Magic numbers!

// After (SAFE)
if (itemBodyHtml.slice(audioEnd, audioEnd + 2) === '<a') { ... }
const match = json.match(/^<!\[CDATA\[(.*)\]\]>$/s);
if (!match) throw new Error('Invalid CDATA format');
const extracted = match[1];
```

**Implementation Steps**:
1. Replace all `substring()` calls with safer `slice()` (handles out-of-bounds)
2. Replace hardcoded offset patterns with regex where possible
3. Add explicit length checks before index-based operations
4. Add validation for expected string formats
5. Update tests to cover edge cases (empty strings, missing tags)

**Verification**:
- Run: `bun test packages/qti2-to-pie/tests/`
- Add tests for edge cases: empty content, missing tags, malformed HTML
- Test with real QTI fixtures from `packages/qti2-item-player/tests/conformance/`

---

### 1.5 Implement Proper Fisher-Yates Shuffle 🔴 CRITICAL

**Issue**: Biased shuffle algorithm using `sort(() => Math.random() - 0.5)` doesn't produce uniform distribution.

**Affected Files**:
- `packages/qti2-assessment-player/src/integration/ReferenceBackendAdapter.ts` (line 832)

**Solution**:
```typescript
// Before (BIASED)
return [...filteredItems].sort(() => Math.random() - 0.5);

// After (UNBIASED)
function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
return shuffle(filteredItems);
```

**Implementation Steps**:
1. Create utility function `shuffle<T>()` in `packages/qti2-assessment-player/src/utils/`
2. Replace all `.sort(() => Math.random() - 0.5)` patterns
3. Add unit tests verifying distribution (statistical test with large sample)
4. Document the Fisher-Yates algorithm in code comments

**Verification**:
- Run: `bun test packages/qti2-assessment-player/`
- Add statistical test: verify uniform distribution over 10,000 shuffles
- Manual test: load assessment with shuffled items, verify randomization

---

## Phase 2: Type Safety & Reliability Improvements

### 2.1 Reduce Type Assertions (245+ instances) 🟠 HIGH

**Issue**: Pervasive use of `as any` defeats TypeScript's type safety and creates runtime error risks.

**Affected Files** (high-impact examples):
- `packages/qti2-item-player/src/iframe/IFramePlayerHost.ts` (lines 228-254)
- `packages/transform-app/src/routes/api/sessions/[id]/transform/+server.ts` (line 47)
- `packages/transform-app/src/routes/api/sessions/[id]/analyze/+server.ts` (lines 94-95)
- `packages/qti2-to-pie/src/transformers/assessment-test.ts` (lines 152-547)
- `packages/qti2-item-player/src/core/Player.ts` (lines 299, 308, 338, 349)

**Solution Strategy**:
1. **Type Guards**: Replace assertions with runtime checks
2. **Better Types**: Define proper interfaces for message payloads
3. **Discriminated Unions**: Use for message types
4. **Storage Backend Interface**: Define explicit interface with `rootDir`

**Implementation Steps**:

#### 2.1.1 Storage Backend Type Safety
```typescript
// Create: packages/types/src/storage/backend-interfaces.ts
export interface FilesystemBackendInterface extends StorageBackend {
  rootDir: string;
  enforceSecurity: boolean;
}

export function isFilesystemBackend(obj: unknown): obj is FilesystemBackendInterface {
  return obj != null &&
         typeof obj === 'object' &&
         'rootDir' in obj &&
         typeof (obj as any).rootDir === 'string';
}

// Use in transform-app:
if (isFilesystemBackend(storage)) {
  console.log(storage.rootDir); // Type-safe!
}
```

#### 2.1.2 IFrame Message Type Safety
```typescript
// Create: packages/qti2-item-player/src/iframe/message-types.ts
export type IFrameMessage =
  | { type: 'init'; payload: InitPayload }
  | { type: 'setResponses'; payload: ResponsesPayload }
  | { type: 'getState'; payload: null };

export function isValidMessage(data: unknown): data is IFrameMessage {
  // Runtime validation logic
}

// Use:
if (isValidMessage(event.data)) {
  switch (event.data.type) {
    case 'init': // payload is InitPayload
  }
}
```

#### 2.1.3 DOM Element Type Guards
```typescript
// Create: packages/qti2-to-pie/src/utils/dom-guards.ts
export function isHTMLElement(node: unknown): node is HTMLElement {
  return node instanceof HTMLElement;
}

// Use:
const element = querySelector('foo');
if (isHTMLElement(element)) {
  element.getAttribute('name'); // Type-safe
}
```

**Target**: Reduce `as any` instances by 150+ (60% reduction)

**Verification**:
- Run: `bun run typecheck` (must pass with no new errors)
- Run all tests to ensure type guards work correctly
- Use TypeScript strict mode in target packages

---

### 2.2 Add Null Checks to getAttribute() Calls 🟠 HIGH

**Issue**: `getAttribute()` returns `string | null` but often used without null checks, causing `NaN` in `parseInt()` or unexpected behavior.

**Affected Files**:
- `packages/qti2-to-pie/src/transformers/ebsr.ts` (lines 168, 182, 186)
- `packages/qti2-to-pie/src/transformers/select-text.ts` (lines 50-51)
- `packages/qti2-to-pie/src/plugin.ts` (lines 494-495)

**Solution**:
```typescript
// Before (UNSAFE)
const shuffle = choiceInteraction.getAttribute('shuffle');
const maxChoices = parseInt(choiceInteraction.getAttribute('maxChoices'));

// After (SAFE)
const shuffle = choiceInteraction.getAttribute('shuffle') ?? 'false';
const maxChoices = parseInt(choiceInteraction.getAttribute('maxChoices') ?? '1', 10);
```

**Implementation Steps**:
1. Search for all `getAttribute()` calls: `rg "\.getAttribute\(" --type ts`
2. Add nullish coalescing (`??`) with sensible defaults
3. Document defaults based on QTI 2.2 specification
4. Add validation for unexpected attribute values
5. Create utility wrapper: `getAttributeSafe(element, name, defaultValue)`

**Verification**:
- Run: `bun test packages/qti2-to-pie/`
- Add tests for missing attributes
- Test with minimal QTI items (no optional attributes)

---

### 2.3 Fix Race Conditions in Orchestrator 🟠 HIGH

**Issue**: `Promise.race()` with timeout doesn't cancel ongoing operations, causing resource leaks and unpredictable behavior.

**Affected Files**:
- `packages/core/src/orchestration/in-memory-orchestrator.ts` (lines 288-291, 358-361, 426)
- `packages/core/src/orchestration/activities/transform-qti-to-pie-activity.ts` (line 34)

**Solution**:
```typescript
// Before (RACE CONDITION)
const timeoutPromise = new Promise((_, reject) =>
  setTimeout(() => reject(new Error('Timeout')), taskTimeout)
);
return await Promise.race([operationPromise, timeoutPromise]);

// After (PROPER CANCELLATION)
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), taskTimeout);

try {
  const result = await operationWithAbort(controller.signal);
  clearTimeout(timeoutId);
  return result;
} catch (error) {
  clearTimeout(timeoutId);
  if (error.name === 'AbortError') {
    throw new TimeoutError('Operation timed out');
  }
  throw error;
}
```

**Implementation Steps**:
1. Create `TimeoutError` class extending `Error`
2. Add `AbortSignal` parameter to async operations
3. Replace `Promise.race()` with AbortController pattern
4. Ensure `setInterval` heartbeats are cleared on abort
5. Add cleanup handlers for all async operations
6. Document timeout and cancellation behavior

**Verification**:
- Run: `bun test packages/core/tests/orchestration/`
- Add test: verify operation stops when aborted
- Add test: verify resources are cleaned up on timeout
- Manual test: transform large ZIP, cancel mid-operation

---

### 2.4 Create Error Type Hierarchy 🟠 HIGH

**Issue**: No domain-specific error types makes error handling and recovery difficult.

**New Files to Create**:
- `packages/core/src/errors/index.ts`
- `packages/storage/src/errors.ts`
- `packages/qti2-item-player/src/core/errors.ts`

**Solution**:
```typescript
// packages/core/src/errors/index.ts
export class TransformError extends Error {
  constructor(
    message: string,
    public readonly itemId?: string,
    public readonly phase?: 'parse' | 'transform' | 'validate',
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'TransformError';
  }
}

export class ValidationError extends TransformError {
  constructor(message: string, itemId?: string, options?: ErrorOptions) {
    super(message, itemId, 'validate', options);
    this.name = 'ValidationError';
  }
}

// packages/storage/src/errors.ts
export class StorageError extends Error {
  constructor(
    message: string,
    public readonly path?: string,
    public readonly operation?: 'read' | 'write' | 'delete',
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'StorageError';
  }
}

export class PathTraversalError extends StorageError {
  constructor(path: string, options?: ErrorOptions) {
    super(`Path traversal attempt detected: ${path}`, path, undefined, options);
    this.name = 'PathTraversalError';
  }
}

// packages/qti2-item-player/src/core/errors.ts
export class SanitizationError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'SanitizationError';
  }
}

export class ExtractionError extends Error {
  // Already exists - keep it
}
```

**Implementation Steps**:
1. Create error class files in each package
2. Update all `throw new Error()` to use specific error types
3. Update catch blocks to handle specific error types
4. Add error context (path, itemId, phase) where available
5. Update logger to log error context
6. Export from package index files

**Error Handling Pattern**:
```typescript
try {
  await storage.readFile(path);
} catch (error) {
  if (error instanceof PathTraversalError) {
    logger.error('Security violation', { path: error.path });
    throw new ApiError(403, 'Access denied');
  } else if (error instanceof StorageError) {
    logger.error('Storage failed', { path: error.path, operation: error.operation });
    throw new ApiError(500, 'Storage error');
  }
  throw error; // Re-throw unknown errors
}
```

**Verification**:
- Run: `bun run typecheck && bun test`
- Verify error messages include context
- Test error serialization for API responses

---

## Phase 3: Incomplete Implementations & Maintainability

### 3.1 Implement or Remove S3 Backend 🟡 MEDIUM

**Issue**: S3 backend is exported but all methods throw "not implemented", causing runtime failures.

**Affected Files**:
- `packages/storage/src/backends/s3-backend.ts` (entire file)

**Options**:
1. **Option A: Implement S3 Backend** (recommended if S3 support is needed)
2. **Option B: Remove S3 Backend** (recommended if not needed soon)
3. **Option C: Mark as Experimental** (document incomplete state)

**Recommended: Option B (Remove)** - Can be re-added when needed

**Implementation Steps for Option B**:
1. Remove `s3-backend.ts` file
2. Remove from `packages/storage/src/index.ts` exports
3. Remove S3 configuration from types
4. Update documentation to note S3 not yet supported
5. Add comment in architecture docs about future S3 support

**Implementation Steps for Option A** (if needed):
1. Install `@aws-sdk/client-s3` as dependency
2. Implement all methods using S3Client
3. Add integration tests with LocalStack or MinIO
4. Document S3 configuration requirements
5. Add S3 backend selection in transform-app

**Verification**:
- Run: `bun run build` (ensure exports work)
- Update docs: `docs/ARCHITECTURE.md` and `docs/CONFIGURATION.md`
- If implementing: test with real S3 bucket or LocalStack

---

### 3.2 Establish Error Handling Conventions 🟡 MEDIUM

**Issue**: Inconsistent error handling across packages - some throw, some log and continue, some return null.

**Create New Documentation**:
- `docs/ERROR_HANDLING_GUIDE.md`

**Convention Guidelines**:

```markdown
# Error Handling Guidelines

## General Principles

1. **Fail Fast**: Throw errors early for programmer errors (null refs, type errors)
2. **Recover Gracefully**: Handle expected errors (file not found, parse errors)
3. **Preserve Context**: Use error chaining with `{ cause: originalError }`
4. **Log with Context**: Include itemId, path, operation in error messages

## Patterns by Package

### Transform System (`core`, `qti2-to-pie`, `pie-to-qti2`)
- Throw `TransformError` for recoverable issues
- Throw `ValidationError` for invalid QTI/PIE content
- Log warnings for vendor-specific issues
- Always include `itemId` in error context

### Storage System (`storage`)
- Throw `StorageError` for I/O failures
- Throw `PathTraversalError` for security violations
- Return empty array/null for "not found" (not an error)
- Log errors with path and operation

### Player System (`qti2-item-player`, `qti2-assessment-player`)
- Throw `SanitizationError` for untrusted content issues
- Throw `ExtractionError` for malformed QTI
- Return fallback UI for rendering errors
- Log errors but continue rendering other items

## Anti-Patterns to Avoid

❌ Empty catch blocks
❌ Console.error without re-throwing
❌ Returning null without logging
❌ Generic `new Error()` without context
❌ Swallowing errors in Promise callbacks
```

**Implementation Steps**:
1. Create `docs/ERROR_HANDLING_GUIDE.md` with conventions
2. Update 10-15 high-impact files to follow conventions
3. Add ESLint rules to catch common anti-patterns
4. Update contribution guidelines to reference error guide
5. Add code review checklist item for error handling

**Verification**:
- Grep for empty catch blocks: `rg "catch.*\{\s*\}" --type ts`
- Grep for generic Error: `rg "throw new Error\(" --type ts | wc -l`
- Review API endpoints for consistent error responses

---

### 3.3 Replace Test Mocks with jsdom or Browser Testing 🟡 MEDIUM

**Issue**: Extensive mocking of global browser APIs creates mock drift from real behavior.

**Affected Files**:
- `packages/qti2-item-player/tests/iframe/host.test.ts` (lines 28-115)
- `packages/qti2-assessment-player/tests/setup.ts` (lines 10-102)
- `packages/acme-likert-plugin/tests/setup.ts` (lines 7-28)

**Options**:
1. **Option A: jsdom** - Faster, good for unit tests
2. **Option B: Playwright** - Real browser, better for E2E
3. **Option C: Hybrid** - jsdom for unit, Playwright for integration

**Recommended: Option C (Hybrid)**

**Implementation Steps**:

#### 3.3.1 Add jsdom for Unit Tests
```typescript
// packages/qti2-item-player/tests/setup.ts
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost',
  pretendToBeVisual: true,
  resources: 'usable'
});

global.window = dom.window as any;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
global.customElements = dom.window.customElements;
```

#### 3.3.2 Add Playwright for Integration Tests
```typescript
// packages/qti2-item-player/tests/integration/player.spec.ts
import { test, expect } from '@playwright/test';

test('renders choice interaction', async ({ page }) => {
  await page.goto('/test-player.html');
  await page.setContent(`<div id="player"></div>`);

  const player = await page.evaluate(() => {
    return window.createPlayer({ itemXml: '...' });
  });

  await expect(page.locator('pie-qti-choice')).toBeVisible();
});
```

**Implementation Steps**:
1. Install jsdom: `bun add -d jsdom @types/jsdom`
2. Replace mock setup files with jsdom initialization
3. Fix tests that rely on mock-specific behavior
4. Add Playwright tests for critical user flows
5. Update CI to run Playwright tests
6. Document when to use jsdom vs Playwright

**Verification**:
- Run: `bun test` (all unit tests pass with jsdom)
- Run: `bun test:e2e` (Playwright tests)
- Check test coverage hasn't decreased

---

### 3.4 Fix Skipped Tests 🟡 MEDIUM

**Issue**: Tests skipped due to environmental issues indicate setup problems.

**Affected Files**:
- `packages/qti2-item-player/tests/conformance/run-fixtures.test.ts` (line 34)

**Solution**:
```typescript
// Current:
test.skip('fixture load skipped due to filesystem permissions', () => {});

// Fix:
test('loads QTI conformance fixtures', () => {
  const fixtures = loadFixtures('./fixtures');
  expect(fixtures.length).toBeGreaterThan(0);
  // ... test logic
});
```

**Implementation Steps**:
1. Investigate why fixture loading fails (permissions, paths, CI vs local)
2. Fix fixture loading logic to work in all environments
3. Add fixture files to git if not already tracked
4. Update CI to ensure fixtures are available
5. Remove `test.skip()` calls
6. Document fixture setup in README

**Verification**:
- Run: `bun test packages/qti2-item-player/tests/conformance/`
- Verify tests pass in CI (not just locally)
- Check fixture files are in git and deployed

---

## Phase 4: Code Quality & Technical Debt

### 4.1 Systematic Removal of Remaining Type Assertions 🟢 LOW

**Goal**: Eliminate remaining ~95 `as any` casts after Phase 2 work.

**Strategy**:
1. Group by pattern (DOM operations, JSON parsing, storage access)
2. Create type-safe utility functions for common patterns
3. Use generics where appropriate
4. Document unavoidable casts with explanation comments

**Implementation**:
- Target 10-15 files per sprint
- Measure progress: `rg " as any" --type ts | wc -l`
- Track in tech debt backlog

---

### 4.2 Add Runtime Validation for Storage Backend Interfaces 🟢 LOW

**Goal**: Validate storage backend implements required interface at runtime.

**Solution**:
```typescript
// packages/storage/src/validation.ts
export function validateStorageBackend(backend: unknown): asserts backend is StorageBackend {
  if (!backend || typeof backend !== 'object') {
    throw new TypeError('Storage backend must be an object');
  }

  const required = ['readFile', 'writeFile', 'deleteFile', 'listFiles', 'exists'];
  for (const method of required) {
    if (typeof (backend as any)[method] !== 'function') {
      throw new TypeError(`Storage backend missing required method: ${method}`);
    }
  }
}

// Use:
export function createSessionStorage(backend: unknown): SessionStorage {
  validateStorageBackend(backend);
  return new SessionStorageImpl(backend);
}
```

---

### 4.3 Add Code Coverage Metrics 🟢 LOW

**Goal**: Establish baseline coverage and set minimum thresholds.

**Implementation**:
1. Add Bun test coverage flag: `bun test --coverage`
2. Generate coverage reports in CI
3. Set initial thresholds (e.g., 70% line coverage)
4. Add coverage badge to README
5. Fail CI on coverage decrease

**CI Configuration**:
```yaml
# .github/workflows/ci.yml
- name: Run unit tests with coverage
  run: bun test --coverage

- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/coverage-final.json
```

---

### 4.4 Performance Audit 🟢 LOW

**Goal**: Identify and fix performance bottlenecks.

**Areas to Investigate**:
1. Nested array operations in typesetting
2. Repeated DOM queries in extractors
3. Large file handling in storage
4. Memory leaks in orchestrator

**Tools**:
- Chrome DevTools Performance profiler
- Memory snapshots for leak detection
- Benchmark suite for critical paths

---

## Implementation Timeline

### Sprint 1 (Week 1-2): Critical Security
- 1.1 Random ID generation
- 1.2 eval() removal
- 1.3 Sanitization errors
- 1.4 Substring bounds checking (priority files)

### Sprint 2 (Week 3-4): Security & Type Safety
- 1.4 Substring bounds checking (remaining files)
- 1.5 Fisher-Yates shuffle
- 2.1 Type assertions (storage backend, iframe messages)

### Sprint 3 (Week 5-6): Type Safety & Reliability
- 2.1 Type assertions (DOM operations, remaining high-impact)
- 2.2 getAttribute null checks
- 2.4 Error type hierarchy

### Sprint 4 (Week 7-8): Reliability & Maintainability
- 2.3 Race condition fixes
- 3.1 S3 backend decision
- 3.2 Error handling conventions

### Sprint 5 (Week 9-10): Testing & Documentation
- 3.3 jsdom setup
- 3.4 Fix skipped tests
- 4.3 Code coverage

### Sprint 6+ (Ongoing): Technical Debt
- 4.1 Remaining type assertions
- 4.2 Runtime validation
- 4.4 Performance audit

---

## Testing Strategy

### Unit Tests
- All new error classes have tests
- All type guards have positive and negative test cases
- All utility functions have edge case tests

### Integration Tests
- Transform workflows: upload → analyze → transform
- Player workflows: load → render → interact → score
- Storage workflows: write → read → delete

### Security Tests
- Add to `packages/qti2-item-player/tests/security/`:
  - `id-generation.test.ts` - Verify UUID format and uniqueness
  - `sanitization-errors.test.ts` - Verify errors thrown on bad input
  - `path-traversal.test.ts` - Verify storage path validation

### Regression Tests
- Keep existing test suite passing
- Add tests for any bugs discovered during refactoring

---

## Risk Mitigation

### High-Risk Changes
1. **Error handling changes** - Could break existing error recovery
   - Mitigation: Gradual rollout, comprehensive testing

2. **Type system changes** - Could introduce new TypeScript errors
   - Mitigation: Fix in packages order (types → storage → core → players)

3. **Storage interface changes** - Could break existing backends
   - Mitigation: Add validation, keep backwards compatibility layer

### Rollback Plan
- All changes in feature branches
- Merge to `develop` only after full CI pass
- Tag releases for easy rollback
- Keep deprecated code for 1 release cycle

---

## Success Metrics

### Quantitative
- Zero critical security vulnerabilities
- `as any` count reduced from 245 to <50
- All tests passing (no skipped tests)
- Test coverage >75%
- Zero eval() usage
- Zero empty catch blocks

### Qualitative
- Consistent error handling patterns
- Clear documentation
- Maintainable codebase
- Confident refactoring capability

---

## Critical Files Reference

### Security-Critical Files
- `packages/transform-app/src/routes/api/upload/+server.ts`
- `packages/qti2-item-player/src/core/sanitizer.ts`
- `packages/storage/src/backends/filesystem-backend.ts`
- `packages/qti2-i18n/scripts/check-translations.ts`

### Type Safety Priority Files
- `packages/qti2-item-player/src/iframe/IFramePlayerHost.ts`
- `packages/transform-app/src/routes/api/sessions/[id]/transform/+server.ts`
- `packages/qti2-to-pie/src/transformers/assessment-test.ts`
- `packages/core/src/orchestration/in-memory-orchestrator.ts`

### High-Impact Transformation Files
- `packages/qti2-to-pie/src/transformers/inline-dropdown.ts`
- `packages/qti2-to-pie/src/transformers/drag-in-the-blank.ts`
- `packages/qti2-to-pie/src/transformers/select-text.ts`

---

## Documentation Updates Required

### New Documents
- `docs/ERROR_HANDLING_GUIDE.md` - Error handling conventions
- `docs/SECURITY_REMEDIATION.md` - Security fixes and rationale
- `docs/TYPE_SAFETY_GUIDE.md` - Type guard patterns and best practices

### Updated Documents
- `docs/ARCHITECTURE.md` - Document S3 backend status
- `docs/CONFIGURATION.md` - Update storage backend configuration
- `README.md` - Update with coverage badge
- Contributing guide - Add error handling and type safety guidelines

---

## Verification Checklist

### Phase 1 Complete
- [ ] All session/package IDs use crypto.randomUUID()
- [ ] No eval() usage in codebase
- [ ] Sanitizer throws SanitizationError on failure
- [ ] All substring operations have bounds checking
- [ ] Fisher-Yates shuffle implemented and tested
- [ ] Security tests pass
- [ ] Manual security review complete

### Phase 2 Complete
- [ ] Storage backend has proper interface and type guards
- [ ] IFrame messages have discriminated union types
- [ ] getAttribute() calls have null checks
- [ ] Race conditions fixed with AbortController
- [ ] Error type hierarchy implemented
- [ ] TypeScript strict mode passes
- [ ] `as any` count reduced by 60%+

### Phase 3 Complete
- [ ] S3 backend implemented or removed
- [ ] Error handling guide documented
- [ ] jsdom setup complete
- [ ] All skipped tests passing
- [ ] Integration tests in Playwright

### Phase 4 Complete
- [ ] Remaining type assertions justified or removed
- [ ] Storage validation implemented
- [ ] Code coverage >75%
- [ ] Performance audit complete

### Final Verification
- [ ] All CI checks passing
- [ ] Documentation updated
- [ ] No breaking changes to public APIs
- [ ] Release notes prepared
- [ ] Security advisory published (if needed)

---

## Notes

### Out of Scope
- Database backend implementation (separate project)
- QTI 3.0 support (separate project)
- Major API redesigns (too risky)
- Performance optimizations beyond critical paths

### Dependencies
- Bun 1.3.5+ (current requirement)
- Node 20.19.0 (current CI version)
- TypeScript 5.x (current version)

### Coordination
- Communicate breaking changes to team
- Coordinate with frontend team on API changes
- Plan deployment windows for risky changes
