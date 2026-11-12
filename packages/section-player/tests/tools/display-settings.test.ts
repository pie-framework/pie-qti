import { describe, expect, test } from 'bun:test';
import type { PnpProfile } from '@pie-qti/item-player';
import {
	DEFAULT_DISPLAY_SETTINGS,
	displaySettingsOf,
	readSessionDisplaySettings,
	TEXT_SIZE_STEPS,
	withDisplaySettings,
	writeSessionDisplaySettings,
} from '../../src/index.js';

const HOST: PnpProfile = {
	display: {
		colorScheme: 'yellowblue',
		textAppearance: { fontFamily: '"Atkinson Hyperlegible", sans-serif', letterSpacing: 0.2 },
		structuredLabelSupport: true,
	},
	cognitive: { eliminationTool: true },
	tools: { supports: ['calculator'] },
};

describe('withDisplaySettings', () => {
	test('default settings render the host profile as delivered', () => {
		expect(withDisplaySettings(HOST, DEFAULT_DISPLAY_SETTINGS)).toEqual(HOST);
		expect(withDisplaySettings(HOST, undefined)).toEqual(HOST);
	});

	test('a text size step sets the point size and keeps the rest of the appearance', () => {
		for (const step of [1, 2, 3] as const) {
			const effective = withDisplaySettings(HOST, { textSize: step });
			expect(effective.display?.textAppearance).toEqual({
				fontFamily: '"Atkinson Hyperlegible", sans-serif',
				letterSpacing: 0.2,
				fontSize: TEXT_SIZE_STEPS[step],
			});
		}
		expect(TEXT_SIZE_STEPS[1]).toBeLessThan(TEXT_SIZE_STEPS[2]);
		expect(TEXT_SIZE_STEPS[2]).toBeLessThan(TEXT_SIZE_STEPS[3]);
	});

	test('higher-contrast text replaces the scheme while on, and off restores it', () => {
		expect(withDisplaySettings(HOST, { highContrast: true }).display?.colorScheme).toBe('blackwhite');
		expect(withDisplaySettings(HOST, { highContrast: false }).display?.colorScheme).toBe('yellowblue');
		expect(withDisplaySettings(undefined, { highContrast: true }).display?.colorScheme).toBe('blackwhite');
	});

	test('extra text spacing applies the WCAG 1.4.12 reference spacing', () => {
		const effective = withDisplaySettings(HOST, { textSpacing: true });
		// The host's own 0.2 letter spacing is larger than the reference, so it stays.
		expect(effective.display?.textAppearance).toMatchObject({ lineHeight: 1.5, letterSpacing: 0.2, wordSpacing: 0.16 });
		// Off, the host's own letter spacing is back.
		expect(withDisplaySettings(HOST, { textSpacing: false }).display?.textAppearance?.letterSpacing).toBe(0.2);
	});

	test('a text size step never shrinks the profile below its own size', () => {
		const larger: PnpProfile = { display: { textAppearance: { fontSize: 24 } } };
		expect(withDisplaySettings(larger, { textSize: 1 }).display?.textAppearance?.fontSize).toBe(24);
		expect(withDisplaySettings(larger, { textSize: 3 }).display?.textAppearance?.fontSize).toBe(24);
		const smaller: PnpProfile = { display: { textAppearance: { fontSize: 12 } } };
		expect(withDisplaySettings(smaller, { textSize: 1 }).display?.textAppearance?.fontSize).toBe(TEXT_SIZE_STEPS[1]);
	});

	test('extra text spacing raises the profile spacing instead of replacing it', () => {
		const spaced: PnpProfile = { display: { textAppearance: { lineHeight: 2.0 } } };
		expect(withDisplaySettings(spaced, { textSpacing: true }).display?.textAppearance).toEqual({
			lineHeight: 2.0,
			letterSpacing: 0.12,
			wordSpacing: 0.16,
		});
	});

	test('the non-display needs pass through untouched, and the host profile is not mutated', () => {
		const snapshot = JSON.parse(JSON.stringify(HOST));
		const effective = withDisplaySettings(HOST, { textSize: 3, highContrast: true, textSpacing: true });
		expect(effective.cognitive).toEqual({ eliminationTool: true });
		expect(effective.tools).toEqual({ supports: ['calculator'] });
		expect(effective.display?.structuredLabelSupport).toBe(true);
		expect(HOST).toEqual(snapshot);
	});

	test('a persisted effective profile reads back as the settings that made it', () => {
		const settings = { textSize: 2, highContrast: true, textSpacing: true } as const;
		expect(displaySettingsOf(withDisplaySettings(undefined, settings))).toEqual(settings);
		expect(displaySettingsOf(HOST)).toEqual({ textSize: 0, highContrast: false, textSpacing: false });
	});

	test('a persisted effective profile applies like the host profile again (resume contract)', () => {
		const persisted = withDisplaySettings(undefined, { textSize: 2, highContrast: true, textSpacing: true });
		// Turning everything off restores the profile without the settings, instead of
		// re-baking the previous choices in.
		const off = withDisplaySettings(persisted, DEFAULT_DISPLAY_SETTINGS);
		expect(off.display?.colorScheme).toBeUndefined();
		expect(off.display?.textAppearance?.fontSize).toBeUndefined();
		expect(off.display?.textAppearance?.lineHeight).toBeUndefined();
		expect(off.display?.textAppearance?.letterSpacing).toBeUndefined();
		expect(off.display?.textAppearance?.wordSpacing).toBeUndefined();
		// And re-applying the settings the profile reads back as reproduces it exactly.
		expect(withDisplaySettings(persisted, displaySettingsOf(persisted))).toEqual(persisted);
	});

	test('turning one toggle off leaves the other persisted choices in place', () => {
		const persisted = withDisplaySettings(HOST, { textSize: 2, highContrast: true, textSpacing: true });
		const off = withDisplaySettings(persisted, { highContrast: false, textSize: 2, textSpacing: true });
		// The persisted profile carries only the black-on-white fingerprint, so off has
		// no scheme underneath it — but the scheme does turn off, which is the point.
		expect(off.display?.colorScheme).toBeUndefined();
		expect(off.display?.textAppearance).toEqual({
			fontFamily: '"Atkinson Hyperlegible", sans-serif',
			fontSize: 16,
			lineHeight: 1.5,
			// The host's own larger letter spacing is not a fingerprint; it keeps.
			letterSpacing: 0.2,
			wordSpacing: 0.16,
		});
	});

	test('a profile value only the settings could have written is read as a leftover, host values keep', () => {
		// 24 pt is no size step, so it passes through untouched…
		const own: PnpProfile = { display: { textAppearance: { fontSize: 24 } } };
		expect(withDisplaySettings(own, DEFAULT_DISPLAY_SETTINGS)).toEqual(own);
		// …a lone reference letter spacing is not the spacing triple, so it keeps too.
		const partial: PnpProfile = { display: { textAppearance: { letterSpacing: 0.12 } } };
		expect(withDisplaySettings(partial, DEFAULT_DISPLAY_SETTINGS)).toEqual(partial);
	});
});

describe('session display settings', () => {
	test('are kept per assessment, as copies', () => {
		const settings = { textSize: 1 as const, highContrast: true };
		writeSessionDisplaySettings('assessment-a', settings);
		settings.highContrast = false;

		expect(readSessionDisplaySettings('assessment-a')).toEqual({ textSize: 1, highContrast: true });
		expect(readSessionDisplaySettings('assessment-b')).toBeUndefined();
	});
});
