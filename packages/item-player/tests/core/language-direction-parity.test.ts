/**
 * `@pie-qti/qti-common` keeps its own `languageDirection` so it needs no i18n
 * dependency; this holds it to `@pie-qti/i18n`'s, which the players stamp with.
 */

import { describe, expect, test } from 'bun:test';
import { languageDirection as i18nDirection } from '@pie-qti/i18n';
import { languageDirection as commonDirection } from '@pie-qti/qti-common';

const TAGS = [
	'ar', 'ar-SA', 'ar_EG', 'arc', 'ckb', 'dv', 'fa-IR', 'he', 'iw', 'ks', 'ku', 'nqo', 'ps', 'sd', 'syr',
	'ug', 'ur-PK', 'yi', 'en', 'en-US', 'nl-NL', 'zh-Hans-CN', 'th', 'ro', 'es_MX.UTF-8', 'Spanish', '', 'not-a-tag-at-all',
];

describe('languageDirection parity', () => {
	test.each(TAGS)('%p', (tag) => {
		expect(commonDirection(tag)).toBe(i18nDirection(tag));
	});
});
