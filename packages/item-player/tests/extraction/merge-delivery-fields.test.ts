import { describe, expect, test } from 'bun:test';
import { htmlField, urlField } from '../../src/extraction/deliveryTypes.js';
import { mergeDeliveryFields } from '../../src/extraction/mergeDeliveryFields.js';

// Both former copies of this merge were last-wins by output path with the
// standard (framework-authored) policy applied last. This pins that policy so
// a plugin can add paths but never relabel a standard one.
describe('mergeDeliveryFields', () => {
	test('the standard field wins when a plugin relabels the same path', () => {
		const extensions = [htmlField('stableMarkup'), urlField('img', 'mediaElement', 'src')];
		const standard = [htmlField('stableMarkup'), urlField('media', 'mediaElement', 'src')];
		const merged = mergeDeliveryFields(extensions, standard);
		expect(merged).toEqual([
			htmlField('stableMarkup'),
			// The same path keeps the standard sink kind, not the plugin's relabeling.
			urlField('media', 'mediaElement', 'src'),
		]);
	});

	test('plugin-owned paths are added, in extension order ahead of the standard fields', () => {
		const extensions = [htmlField('vendorMarkup'), htmlField('prompt')];
		const standard = [htmlField('prompt')];
		expect(mergeDeliveryFields(extensions, standard)).toEqual([
			htmlField('vendorMarkup'),
			htmlField('prompt'),
		]);
	});

	test('later extensions win among themselves, the standard policy still over them', () => {
		const extensions = [urlField('media', 'mediaElement', 'src'), htmlField('fallbackMarkup')];
		const standard = [urlField('media', 'mediaElement', 'src')];
		// The overridden path keeps its first position; the value is the standard one.
		expect(mergeDeliveryFields(extensions, standard)).toEqual([
			urlField('media', 'mediaElement', 'src'),
			htmlField('fallbackMarkup'),
		]);
	});

	test('either list may be empty', () => {
		expect(mergeDeliveryFields([], [htmlField('prompt')])).toEqual([htmlField('prompt')]);
		expect(mergeDeliveryFields([htmlField('prompt')], [])).toEqual([htmlField('prompt')]);
		expect(mergeDeliveryFields([], [])).toEqual([]);
	});
});
