/**
 * One props type for the shared interaction props: every plugin's `Props`
 * derives from `InteractionProps` (or `ResponseOnlyInteractionProps`, for the
 * plugins with no correct response and no scorer view), so no plugin
 * re-declares `interaction`, `response`, `correctResponse`, `disabled`,
 * `role`, `i18n` or `onChange` for itself. The type checker validates each
 * plugin's actual usage (svelte-check compiles the component scripts); this
 * pins the structural rule.
 */

import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const PLUGINS = join(__dirname, '..', '..', '..', 'src', 'plugins');

/** plugin directory -> the interaction key its Props type is derived from. */
const KEY_BY_PLUGIN: Record<string, string> = {
	associate: 'associateInteraction',
	choice: 'choiceInteraction',
	custom: 'customInteraction',
	drawing: 'drawingInteraction',
	'end-attempt': 'endAttemptInteraction',
	'extended-text': 'extendedTextInteraction',
	'gap-match': 'gapMatchInteraction',
	'graphic-associate': 'graphicAssociateInteraction',
	'graphic-gap-match': 'graphicGapMatchInteraction',
	'graphic-order': 'graphicOrderInteraction',
	hotspot: 'hotspotInteraction',
	hottext: 'hottextInteraction',
	media: 'mediaInteraction',
	match: 'matchInteraction',
	order: 'orderInteraction',
	'portable-custom': 'portableCustomInteraction',
	'position-object': 'positionObjectInteraction',
	'select-point': 'selectPointInteraction',
	slider: 'sliderInteraction',
	upload: 'uploadInteraction',
};

/** The shared prop declarations no plugin may carry for itself. */
const SHARED_PROP_LINES = [
	/\binteraction\?: [A-Za-z]+InteractionData \| string;/,
	/\bresponse\?: number \| null;/,
	/\bcorrectResponse\?: number \| null;/,
	/\bcorrectResponse\?: string\[\] \| null;/,
	/\bcorrectResponse\?: string \| string\[\] \| null;/,
	/\bcorrectResponse\?: any;/,
	/\bcorrectResponse\?: unknown;/,
	/\bcorrectResponse\?: QTIFileResponse \| null;/,
	/^\s*disabled\?: boolean;$/m,
	/^\s*role\?: string;$/m,
	/^\s*i18n\?: I18nProvider;$/m,
	/^\s*onChange\?: \(value: number\) => void;$/m,
	/^\s*onChange\?: \(value: string\[\]\) => void;$/m,
	/^\s*onChange\?: \(value: string \| string\[\]\) => void;$/m,
	/^\s*onChange\?: \(value: string \| string\[\] \| null\) => void;$/m,
	/^\s*onChange\?: \(value: string \| null\) => void;$/m,
	/^\s*onChange\?: \(value: boolean\) => void;$/m,
	/^\s*onChange\?: \(value: unknown\) => void;$/m,
	/^\s*onChange\?: \(value: QTIFileResponse \| null\) => void;$/m,
];

describe('every plugin derives its Props from the shared interaction props', () => {
	for (const [plugin, key] of Object.entries(KEY_BY_PLUGIN)) {
		test(`${plugin} derives from InteractionProps<'${key}'>`, () => {
			const files = readdirSync(join(PLUGINS, plugin)).filter((name) => name.endsWith('.svelte'));
			expect(files).toHaveLength(1);
			const source = readFileSync(join(PLUGINS, plugin, files[0]!), 'utf8');
			// `InteractionProps<'key'>`, or with its own response types after the key.
			expect(
				new RegExp(`InteractionProps<'${key}'[,>]`).test(source),
				`${plugin} must derive its Props from InteractionProps<'${key}'>`,
			).toBe(true);
			for (const pattern of SHARED_PROP_LINES) {
				expect(pattern.test(source), `${plugin} re-declares ${pattern}`).toBe(false);
			}
		});
	}

	test('the interaction keys cover every delivered interaction type', () => {
		// The 20 bundled plugins minus the catalog popup: one Props type per
		// interaction type the default bundle delivers.
		expect(Object.keys(KEY_BY_PLUGIN)).toHaveLength(20);
	});
});
