import { describe, expect, test } from 'bun:test';
import { makePieItemPlayerReady } from '../../src/utils/player-config';

describe('makePieItemPlayerReady', () => {
  test('normalizes package-style model elements and creates markup with model ids', () => {
    const item = makePieItemPlayerReady({
      id: 'source-item',
      uuid: 'model-1',
      config: {
        id: 'model-1',
        elements: {
          'multiple-choice': '@pie-element/multiple-choice@latest',
        },
        models: [
          {
            id: 'model-1',
            element: '@pie-element/multiple-choice',
          },
        ],
      },
    });

    expect(item.config.models[0]?.element).toBe('multiple-choice');
    expect(item.config.markup).toBe('<multiple-choice id="model-1"></multiple-choice>');
  });

  test('preserves explicit markup', () => {
    const item = makePieItemPlayerReady({
      id: 'source-item',
      uuid: 'model-1',
      config: {
        id: 'model-1',
        markup: '<multiple-choice id="custom"></multiple-choice>',
        elements: {
          'multiple-choice': '@pie-element/multiple-choice@latest',
        },
        models: [
          {
            id: 'model-1',
            element: 'multiple-choice',
          },
        ],
      },
    });

    expect(item.config.markup).toBe('<multiple-choice id="custom"></multiple-choice>');
  });
});
