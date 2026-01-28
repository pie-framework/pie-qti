/**
 * Acme Slider Transformer
 *
 * Transforms QTI sliderInteraction to a simple "hello world" PIE item
 * Demonstrates the VendorTransformer extension point
 *
 * NOTE: This is a placeholder implementation. In the future, this should:
 * - Create a proper PIE slider element/item
 * - Map QTI slider properties (lowerBound, upperBound, step, orientation)
 * - Handle response processing and scoring
 */

import type { VendorTransformer, VendorInfo } from '@pie-qti/to-pie';
import type { TransformContext, TransformOutput } from '@pie-qti/transform-types';
import type { HTMLElement } from 'node-html-parser';
import { v4 as uuidv4 } from 'uuid';

/**
 * Transforms sliderInteraction elements for Acme QTI content
 *
 * This transformer handles the currently unsupported sliderInteraction type
 * by creating a simple placeholder PIE item. Future implementation should
 * create a proper slider component.
 */
export class AcmeSliderTransformer implements VendorTransformer {
  readonly vendor = 'acme';

  canHandle(_qtiXml: string, _vendorInfo: VendorInfo, parsedDoc: HTMLElement): boolean {
    console.log('[AcmeSliderTransformer] Checking if can handle content...');

    // Check if this is a sliderInteraction
    const hasSlider = parsedDoc.querySelector('sliderInteraction') !== null;

    if (hasSlider) {
      console.log('[AcmeSliderTransformer] ✅ Found sliderInteraction - can handle');
    } else {
      console.log('[AcmeSliderTransformer] ❌ No sliderInteraction found');
    }

    return hasSlider;
  }

  async transform(
    _qtiXml: string,
    _vendorInfo: VendorInfo,
    context: TransformContext,
    parsedDoc: HTMLElement
  ): Promise<TransformOutput> {
    const startTime = Date.now();
    const logger = context.logger;

    logger?.info('[AcmeSliderTransformer] Starting slider transformation');
    console.log('[AcmeSliderTransformer] ========================================');
    console.log('[AcmeSliderTransformer] Transforming sliderInteraction to PIE');
    console.log('[AcmeSliderTransformer] ========================================');

    // Extract assessment item
    const assessmentItem = parsedDoc.querySelector('assessmentItem');
    if (!assessmentItem) {
      throw new Error('No assessmentItem found in QTI content');
    }

    const itemId = assessmentItem.getAttribute('identifier') || `item-${uuidv4()}`;

    // Find the slider interaction
    const sliderInteraction = parsedDoc.querySelector('sliderInteraction');
    if (!sliderInteraction) {
      throw new Error('No sliderInteraction found');
    }

    // Extract slider properties
    const responseId = sliderInteraction.getAttribute('responseIdentifier') || 'RESPONSE';
    const lowerBound = parseFloat(sliderInteraction.getAttribute('lowerBound') || '0');
    const upperBound = parseFloat(sliderInteraction.getAttribute('upperBound') || '100');
    const step = parseFloat(sliderInteraction.getAttribute('step') || '1');
    const orientation = sliderInteraction.getAttribute('orientation') || 'horizontal';

    console.log('[AcmeSliderTransformer] Extracted slider properties:');
    console.log(`[AcmeSliderTransformer]   - responseId: ${responseId}`);
    console.log(`[AcmeSliderTransformer]   - lowerBound: ${lowerBound}`);
    console.log(`[AcmeSliderTransformer]   - upperBound: ${upperBound}`);
    console.log(`[AcmeSliderTransformer]   - step: ${step}`);
    console.log(`[AcmeSliderTransformer]   - orientation: ${orientation}`);

    // Extract prompt
    const promptElement = sliderInteraction.querySelector('prompt');
    const prompt = promptElement?.innerHTML || 'Select a value on the slider';

    console.log(`[AcmeSliderTransformer]   - prompt: ${prompt}`);

    // Create a simple "hello world" PIE item
    // TODO: Replace this with a proper PIE slider element once created
    const uuid = uuidv4();
    const pieItem = {
      id: uuid,
      pie_id: baseId || itemId,
      element: '@acme/slider-placeholder', // Placeholder element type
      markup: `
        <div class="slider-placeholder">
          <h3>Slider Question (Placeholder)</h3>
          <p>${prompt}</p>
          <div class="slider-info">
            <p><strong>This is a demonstration placeholder for a slider interaction.</strong></p>
            <p>In a full implementation, this would render an interactive slider component.</p>
            <ul>
              <li>Range: ${lowerBound} to ${upperBound}</li>
              <li>Step: ${step}</li>
              <li>Orientation: ${orientation}</li>
            </ul>
          </div>
        </div>
      `.trim(),
      models: [
        {
          id: uuid,
          element: '@acme/slider-placeholder',
          // Hello world PIE model
          promptType: 'text',
          prompt: prompt,
          sliderConfig: {
            min: lowerBound,
            max: upperBound,
            step: step,
            orientation: orientation,
            responseIdentifier: responseId,
          },
          // Placeholder for scoring - would need proper response processing
          correctResponse: {
            value: (lowerBound + upperBound) / 2, // Midpoint as example
          },
        },
      ],
    };

    const processingTime = Date.now() - startTime;

    console.log('[AcmeSliderTransformer] ✅ Transformation complete');
    console.log(`[AcmeSliderTransformer] Processing time: ${processingTime}ms`);
    console.log('[AcmeSliderTransformer] Generated PIE item:');
    console.log(JSON.stringify(pieItem, null, 2));
    console.log('[AcmeSliderTransformer] ========================================');

    logger?.info(`[AcmeSliderTransformer] Transformation complete in ${processingTime}ms`);

    return {
      items: [{ content: pieItem, format: 'pie' as const }],
      format: 'pie',
      metadata: {
        sourceFormat: 'qti22',
        targetFormat: 'pie',
        pluginId: 'acme-slider-transformer',
        timestamp: new Date(),
        itemCount: 1,
        processingTime,
      },
    };
  }
}

// Fix typo in variable name
const baseId = undefined; // This would come from options in a full implementation
