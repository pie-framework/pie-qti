import { describe, expect, test } from 'bun:test';
import type { ResolvedItemDeliveryContext } from '@pie-qti/ims-cp-core';
import type { QtiSectionItemRef } from '../../src/index.js';

describe('QtiSectionItemRef', () => {
  test('accepts per-item ResolvedItemDeliveryContext without reshaping', () => {
    const deliveryContext: ResolvedItemDeliveryContext = {
      itemHref: 'items/item-1.xml',
      stimuli: {
        stim1: {
          identifier: 'stim1',
          href: 'stimuli/stim1.xml',
          resolvedHref: 'stimuli/stim1.xml',
          bodyHtml: '<p>Stimulus</p>',
          stylesheets: [
            {
              href: 'stimuli/stim1.css',
              resolvedHref: 'stimuli/stim1.css',
              source: 'stimulus',
              xml: '<qti-stylesheet href="stimuli/stim1.css" />',
            },
          ],
          validationMessages: [],
        },
      },
      stylesheets: [],
      catalogSources: [],
      validationMessages: [],
    };

    const itemRef: QtiSectionItemRef = {
      identifier: 'item-1',
      href: 'items/item-1.xml',
      itemXml: '<assessmentItem identifier="item-1" />',
      deliveryContext,
    };

    expect(itemRef.deliveryContext).toBe(deliveryContext);
    expect(itemRef.deliveryContext?.stimuli.stim1.stylesheets[0]?.href).toBe('stimuli/stim1.css');
  });
});
