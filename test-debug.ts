import { parse } from 'node-html-parser';
import { createQtiParser } from '@pie-qti/qti-common';

const xml = `<qti-choice-interaction response-identifier="RESPONSE" shuffle="false" max-choices="1"></qti-choice-interaction>`;

const { attributeMapper } = createQtiParser(xml);
const dom = parse(xml);
const element = dom.querySelector('qti-choice-interaction');

console.log('Element found:', !!element);
console.log('Element type:', element?.constructor.name);
console.log('max-choices:', element?.getAttribute('max-choices'));
console.log('maxChoices:', element?.getAttribute('maxChoices'));
console.log('attrs:', element?.attrs);

// Test mapper
console.log('Mapper toNative(maxChoices):', attributeMapper?.toNative('maxChoices'));
