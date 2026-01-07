import type { PieItem } from '@pie-qti/transform-types';
import { PieToQti2Plugin } from '../src/plugin.js';

const pieToQti = new PieToQti2Plugin();

const logger = {
  debug: console.log,
  info: console.log,
  warn: console.warn,
  error: console.error,
};

const originalPie: PieItem = {
  id: 'mc-item-1',
  uuid: '123e4567-e89b-12d3-a456-426614174000',
  config: {
    id: '123e4567-e89b-12d3-a456-426614174000',
    models: [
      {
        id: '1',
        element: '@pie-element/multiple-choice',
        prompt: 'What is 2 + 2?',
        choiceMode: 'radio',
        lockChoiceOrder: false,
        choices: [
          { label: '3', value: 'a', correct: false },
          { label: '4', value: 'b', correct: true },
          { label: '5', value: 'c', correct: false },
        ],
      },
    ],
    elements: {
      '@pie-element/multiple-choice': '1.0.0',
    },
  },
};

const result = await pieToQti.transform({ content: originalPie }, { logger });
const qtiXml = result.items[0].content as string;

console.log('\n=== Generated QTI ===');
console.log(qtiXml);
console.log('\n=== Checking for PIE extension ===');
console.log('Contains pie:sourceModel:', qtiXml.includes('<pie:sourceModel>'));
console.log('Contains xmlns:pie:', qtiXml.includes('xmlns:pie'));
