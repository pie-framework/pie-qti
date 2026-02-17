/**
 * Acme CSS Class Extractor
 *
 * Extracts and categorizes Acme-specific CSS classes
 * Demonstrates the CssClassExtractor extension point
 *
 * Categorizes CSS classes into:
 * - Behavioral: Classes that affect component behavior
 * - Styling: Classes for presentation/theming
 * - Semantic: Classes with semantic meaning
 * - Unknown: Unrecognized classes
 */

import type { CssClassExtractor, VendorClasses } from '@pie-qti/to-pie';
import type { HTMLElement } from 'node-html-parser';

/**
 * Extracts and categorizes Acme-specific CSS classes
 *
 * Recognizes patterns like:
 * - Behavioral: acme-input-*, acme-labels-*, acme-shuffle-*, acme-validation-*
 * - Styling: acme-theme-*, acme-border-*, acme-spacing-*, acme-font-*
 * - Semantic: acme-question, acme-answer, acme-hint, acme-feedback
 */
export class AcmeCssClassExtractor implements CssClassExtractor {
  readonly vendor = 'acme';

  private readonly behavioralPrefixes = [
    'acme-input-',
    'acme-labels-',
    'acme-shuffle-',
    'acme-validation-',
    'acme-interaction-',
    'acme-response-',
  ];

  private readonly stylingPrefixes = [
    'acme-theme-',
    'acme-border-',
    'acme-spacing-',
    'acme-font-',
    'acme-color-',
    'acme-layout-',
  ];

  private readonly semanticClasses = [
    'acme-question',
    'acme-answer',
    'acme-hint',
    'acme-feedback',
    'acme-prompt',
    'acme-stimulus',
    'acme-passage',
  ];

  extract(element: HTMLElement): VendorClasses {
    const classAttr = element.getAttribute('class');
    if (!classAttr) {
      return { behavioral: [], styling: [], semantic: [], unknown: [] };
    }

    const classes = classAttr.split(/\s+/).filter((c) => c.startsWith('acme-'));

    if (classes.length === 0) {
      return { behavioral: [], styling: [], semantic: [], unknown: [] };
    }

    console.log('[AcmeCssClassExtractor] ========================================');
    console.log('[AcmeCssClassExtractor] Extracting Acme CSS classes');
    console.log('[AcmeCssClassExtractor] ========================================');
    console.log(`[AcmeCssClassExtractor] Element: <${element.rawTagName}>`);
    console.log(`[AcmeCssClassExtractor] Found ${classes.length} Acme classes: ${classes.join(', ')}`);

    const result: VendorClasses = {
      behavioral: [],
      styling: [],
      semantic: [],
      unknown: [],
    };

    for (const className of classes) {
      // Check if it's a semantic class
      if (this.semanticClasses.includes(className)) {
        result.semantic.push(className);
        console.log(`[AcmeCssClassExtractor]   ✓ ${className} → semantic`);
        continue;
      }

      // Check if it's a behavioral class
      let categorized = false;
      for (const prefix of this.behavioralPrefixes) {
        if (className.startsWith(prefix)) {
          result.behavioral.push(className);
          console.log(`[AcmeCssClassExtractor]   ✓ ${className} → behavioral`);
          categorized = true;
          break;
        }
      }
      if (categorized) continue;

      // Check if it's a styling class
      for (const prefix of this.stylingPrefixes) {
        if (className.startsWith(prefix)) {
          result.styling.push(className);
          console.log(`[AcmeCssClassExtractor]   ✓ ${className} → styling`);
          categorized = true;
          break;
        }
      }
      if (categorized) continue;

      // If we got here, it's an unknown Acme class
      result.unknown.push(className);
      console.log(`[AcmeCssClassExtractor]   ? ${className} → unknown`);
    }

    console.log('[AcmeCssClassExtractor] Summary:');
    console.log(`[AcmeCssClassExtractor]   - Behavioral: ${result.behavioral.length}`);
    console.log(`[AcmeCssClassExtractor]   - Styling: ${result.styling.length}`);
    console.log(`[AcmeCssClassExtractor]   - Semantic: ${result.semantic.length}`);
    console.log(`[AcmeCssClassExtractor]   - Unknown: ${result.unknown.length}`);
    console.log('[AcmeCssClassExtractor] ========================================');

    return result;
  }
}
