import { describe, expect, test } from 'bun:test';
import type { ExtendedTextNumericRecord } from '../../src/interactions/extended-text/response.js';
import type { InteractionValueMap } from '../../src/interactions/shared/types.js';
import type { QTIFileResponse } from '../../src/types/index.js';

/**
 * Compile-time pins for InteractionValueMap. Each entry must accept what the
 * component emits at its `emitInteractionChange` / `onChange` call sites (the raw
 * `qti-change` payload, before the player normalizes it into the response
 * declaration): the values passed to `emit` below carry the component's emitted
 * type. The `@ts-expect-error` lines pin the entry from above against shapes the
 * component never emits, including the shapes the map declared before.
 *
 * Component call sites are in packages/default-components/src/plugins/<name>/ and,
 * for the two inline interactions, packages/item-player/src/interactions/.
 */

/** Mirrors the emit helper's typing: an emitted value must fit its map entry. */
function emit<TKey extends keyof InteractionValueMap>(
	_key: TKey,
	value: InteractionValueMap[TKey],
): InteractionValueMap[TKey] {
	return value;
}

const file: QTIFileResponse = {
	name: 'answer.pdf',
	type: 'application/pdf',
	size: 4,
	lastModified: 0,
	dataUrl: 'data:application/pdf;base64,AAAA',
};

const drawing: QTIFileResponse = {
	name: 'drawing.png',
	type: 'image/png',
	size: 4,
	lastModified: 0,
	dataUrl: 'data:image/png;base64,AAAA',
	imageData: { data: new Uint8ClampedArray(4), width: 1, height: 1 },
};

const numericRecord: ExtendedTextNumericRecord = {
	stringValue: '1.5',
	floatValue: 1.5,
	integerValue: null,
	leftDigits: 1,
	rightDigits: 1,
	ndp: 1,
	nsf: 2,
	exponent: null,
};

describe('InteractionValueMap matches each component emission', () => {
	test('choice: handleRadioChange string, handleCheckboxChange string[], clearAnswer null', () => {
		expect(emit('choiceInteraction', 'A' as string)).toBe('A');
		expect(emit('choiceInteraction', ['A', 'B'] as string[])).toEqual(['A', 'B']);
		expect(emit('choiceInteraction', null)).toBeNull();
		// @ts-expect-error a choice emits identifiers, never a record
		emit('choiceInteraction', { A: true });
	});

	test('textEntry: InlineTextEntry handleInput emits the typed text', () => {
		expect(emit('textEntryInteraction', '3.50' as string)).toBe('3.50');
		// @ts-expect-error the inline entry emits one string
		emit('textEntryInteraction', ['3.50']);
	});

	test('extendedText: emitResponses emits createExtendedTextResponse()', () => {
		expect(emit('extendedTextInteraction', 'essay' as string)).toBe('essay');
		expect(emit('extendedTextInteraction', 42 as number)).toBe(42);
		expect(emit('extendedTextInteraction', ['a', 1] as Array<string | number>)).toEqual(['a', 1]);
		expect(emit('extendedTextInteraction', numericRecord)).toBe(numericRecord);
		expect(emit('extendedTextInteraction', null)).toBeNull();
		// @ts-expect-error the record's numeric fields are numbers or null, never strings
		emit('extendedTextInteraction', { ...numericRecord, floatValue: '1.5' });
	});

	test('inlineChoice: InlineChoice handleChange emits the chosen identifier', () => {
		expect(emit('inlineChoiceInteraction', 'A' as string)).toBe('A');
		// @ts-expect-error the dropdown emits one identifier
		emit('inlineChoiceInteraction', ['A']);
	});

	test('order: confirmation commit and handleReorder emit string[], handleSubsetChange null when empty', () => {
		expect(emit('orderInteraction', ['D', 'A', 'B', 'C'] as string[])).toEqual(['D', 'A', 'B', 'C']);
		expect(emit('orderInteraction', null)).toBeNull();
		// @ts-expect-error the order is an identifier list, not a position record
		emit('orderInteraction', { 1: 'A' });
	});

	test('match: handlePairsChange emits "source target" strings', () => {
		expect(emit('matchInteraction', ['R1 C2', 'R2 C1'] as string[])).toEqual(['R1 C2', 'R2 C1']);
		// @ts-expect-error the earlier Record<string, string> shape is not emitted
		emit('matchInteraction', { R1: 'C2' });
	});

	test('associate: emitChange emits "A B" strings', () => {
		expect(emit('associateInteraction', ['A B', 'B C'] as string[])).toEqual(['A B', 'B C']);
		// @ts-expect-error the earlier Array<[string, string]> shape is not emitted
		emit('associateInteraction', [['A', 'B']]);
	});

	test('gapMatch: handleGapChange and clearWord emit "gapText gap" strings', () => {
		expect(emit('gapMatchInteraction', ['W1 G1'] as string[])).toEqual(['W1 G1']);
		// @ts-expect-error the earlier Record<string, string> shape is not emitted
		emit('gapMatchInteraction', { G1: 'W1' });
	});

	test('slider: handleChange emits the number', () => {
		expect(emit('sliderInteraction', 73 as number)).toBe(73);
		// @ts-expect-error the slider emits a number, never its lexical form
		emit('sliderInteraction', '73');
	});

	test('hotspot: select emits the selected identifier, clearAnswer null', () => {
		expect(emit('hotspotInteraction', 'H1' as string)).toBe('H1');
		expect(emit('hotspotInteraction', null)).toBeNull();
		// @ts-expect-error the earlier string[] shape is not emitted (multi-select is not implemented)
		emit('hotspotInteraction', ['H1']);
	});

	test('graphicGapMatch: handleHotspotDrop, clearMatch and placePickedUpLabelOnHotspot emit "gapText hotspot" strings', () => {
		expect(emit('graphicGapMatchInteraction', ['L1 H2'] as string[])).toEqual(['L1 H2']);
		// @ts-expect-error the earlier Record<string, string> shape is not emitted
		emit('graphicGapMatchInteraction', { H2: 'L1' });
	});

	test('upload: FileUpload reports a file response, or null when cleared', () => {
		expect(emit('uploadInteraction', file)).toBe(file);
		expect(emit('uploadInteraction', null)).toBeNull();
		// @ts-expect-error a file name alone is not a file response
		emit('uploadInteraction', 'answer.pdf');
	});

	test('drawing: DrawingCanvas reports a file response, or null when cleared', () => {
		expect(emit('drawingInteraction', drawing)).toBe(drawing);
		expect(emit('drawingInteraction', null)).toBeNull();
		// @ts-expect-error the earlier string shape is not emitted
		emit('drawingInteraction', 'data:image/png;base64,AAAA');
	});

	test('custom: the fallback field reports its text, or null when emptied', () => {
		expect(emit('customInteraction', 'typed' as string)).toBe('typed');
		expect(emit('customInteraction', null)).toBeNull();
		// @ts-expect-error the fallback field emits text only
		emit('customInteraction', 42);
	});

	test('portableCustom: emitResponse forwards whatever the PCI module publishes', () => {
		const published: unknown = { base: { string: 'x' } };
		expect(emit('portableCustomInteraction', published)).toBe(published);
	});

	test('media: countPlay emits the play count', () => {
		expect(emit('mediaInteraction', 3 as number)).toBe(3);
		// @ts-expect-error the play count is a number
		emit('mediaInteraction', true);
	});

	test('hottext: handleHottextClick emits a string (single) or string[] (multiple); clearAnswer emits null or []', () => {
		expect(emit('hottextInteraction', 'H2' as string)).toBe('H2');
		expect(emit('hottextInteraction', ['H2', 'H4'] as string[])).toEqual(['H2', 'H4']);
		expect(emit('hottextInteraction', null)).toBeNull();
		// @ts-expect-error hottext emits identifiers, never a record
		emit('hottextInteraction', { H2: true });
	});

	test('selectPoint: commit emits "x y" or null when maxChoices=1, else "x y" strings', () => {
		expect(emit('selectPointInteraction', '158 168' as string)).toBe('158 168');
		expect(emit('selectPointInteraction', ['158 168', '250 200'] as string[])).toEqual(['158 168', '250 200']);
		expect(emit('selectPointInteraction', null)).toBeNull();
		// @ts-expect-error the earlier Array<{ x, y }> shape is not emitted
		emit('selectPointInteraction', [{ x: 158, y: 168 }]);
	});

	test('graphicOrder: confirmation commit and handleReorder emit string[], handleSubsetChange null when empty', () => {
		expect(emit('graphicOrderInteraction', ['H2', 'H1'] as string[])).toEqual(['H2', 'H1']);
		expect(emit('graphicOrderInteraction', null)).toBeNull();
		// @ts-expect-error the order is an identifier list, not a position record
		emit('graphicOrderInteraction', { 1: 'H1' });
	});

	test('graphicAssociate: handleHotspotClick and removePair emit "A B" strings', () => {
		expect(emit('graphicAssociateInteraction', ['A B'] as string[])).toEqual(['A B']);
		// @ts-expect-error the earlier Array<[string, string]> shape is not emitted
		emit('graphicAssociateInteraction', [['A', 'B']]);
	});

	test('positionObject: emitPositions emits "x y" strings in natural image pixels', () => {
		expect(emit('positionObjectInteraction', ['158 168', '250 200'] as string[])).toEqual(['158 168', '250 200']);
		// @ts-expect-error the earlier Record<string, { x, y }> shape is not emitted
		emit('positionObjectInteraction', { obj1: { x: 158, y: 168 } });
	});

	test('endAttempt: endAttempt emits true', () => {
		expect(emit('endAttemptInteraction', true)).toBe(true);
		// @ts-expect-error endAttempt emits a boolean
		emit('endAttemptInteraction', 'ended');
	});
});
