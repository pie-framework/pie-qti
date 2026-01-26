const { parse } = require('node-html-parser');

const xml = '<qti-choice-interaction max-choices="1" shuffle="false"></qti-choice-interaction>';
const dom = parse(xml);
const el = dom.querySelector('qti-choice-interaction');

console.log('Element found:', !!el);
console.log('max-choices attr:', el?.getAttribute('max-choices'));
console.log('maxChoices attr:', el?.getAttribute('maxChoices'));
console.log('All attrs:', el?.attrs);
console.log('getAttribute type:', typeof el?.getAttribute);
