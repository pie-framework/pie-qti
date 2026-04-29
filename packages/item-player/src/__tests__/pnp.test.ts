import { describe, it, expect } from 'bun:test';
import { parsePnpXml } from '../pnp/parsePnpXml.js';
import { applyPnpToRoot } from '../pnp/applyPnp.js';
import { Player } from '../core/Player.js';
import type { PnpProfile } from '../pnp/types.js';

// ---------------------------------------------------------------------------
// parsePnpXml
// ---------------------------------------------------------------------------

describe('parsePnpXml', () => {
	it('parses default color scheme', () => {
		const profile = parsePnpXml(`
			<personalNeedsProfile>
				<display>
					<colorScheme value="default"/>
				</display>
			</personalNeedsProfile>
		`);
		expect(profile.display?.colorScheme).toBe('default');
	});

	it.each(['blackwhite', 'whitenav', 'blackcream', 'yellowblue', 'medgray'] as const)(
		'parses color scheme "%s"',
		(scheme) => {
			const profile = parsePnpXml(`
				<personalNeedsProfile>
					<display>
						<colorScheme value="${scheme}"/>
					</display>
				</personalNeedsProfile>
			`);
			expect(profile.display?.colorScheme).toBe(scheme);
		}
	);

	it('ignores unknown color scheme values', () => {
		const profile = parsePnpXml(`
			<personalNeedsProfile>
				<display>
					<colorScheme value="neon-pink"/>
				</display>
			</personalNeedsProfile>
		`);
		expect(profile.display?.colorScheme).toBeUndefined();
	});

	it('parses extendedTime', () => {
		const profile = parsePnpXml(`
			<personalNeedsProfile>
				<content>
					<extendedTime active="true" multiplier="1.5"/>
				</content>
			</personalNeedsProfile>
		`);
		expect(profile.content?.extendedTime).toEqual({ active: true, multiplier: 1.5 });
	});

	it('parses extendedTime with Infinity multiplier', () => {
		const profile = parsePnpXml(`
			<personalNeedsProfile>
				<content>
					<extendedTime active="true" multiplier="Infinity"/>
				</content>
			</personalNeedsProfile>
		`);
		expect(profile.content?.extendedTime?.multiplier).toBe(Infinity);
	});

	it('parses glossaryOnScreen', () => {
		const profile = parsePnpXml(`
			<personalNeedsProfile>
				<content>
					<glossaryOnScreen enabled="true"/>
				</content>
			</personalNeedsProfile>
		`);
		expect(profile.content?.glossaryOnScreen).toBe(true);
	});

	it('parses keywordTranslation', () => {
		const profile = parsePnpXml(`
			<personalNeedsProfile>
				<content>
					<keywordTranslation active="true" languageCode="es"/>
				</content>
			</personalNeedsProfile>
		`);
		expect(profile.content?.keywordTranslation).toEqual({ active: true, languageCode: 'es' });
	});

	it('parses eliminationTool', () => {
		const profile = parsePnpXml(`
			<personalNeedsProfile>
				<cognitive>
					<eliminationTool enabled="true"/>
				</cognitive>
			</personalNeedsProfile>
		`);
		expect(profile.cognitive?.eliminationTool).toBe(true);
	});

	it('silently ignores unknown child elements', () => {
		expect(() =>
			parsePnpXml(`
				<personalNeedsProfile>
					<display>
						<unknownFutureThing value="42"/>
					</display>
					<futureSection>
						<anotherThing/>
					</futureSection>
				</personalNeedsProfile>
			`)
		).not.toThrow();
	});

	it('returns empty profile for empty input', () => {
		const profile = parsePnpXml('');
		expect(profile).toEqual({});
	});

	it('returns empty profile when no recognized root element', () => {
		// parsePnpXml with an unrecognised root gracefully returns {}
		const profile = parsePnpXml('<somethingElse><display/></somethingElse>');
		expect(profile).toEqual({});
	});
});

// ---------------------------------------------------------------------------
// applyPnpToRoot — uses a minimal object that satisfies the HTMLElement contract
// ---------------------------------------------------------------------------

function makeEl(): HTMLElement {
	const attrs: Record<string, string> = {};
	return {
		setAttribute(k: string, v: string) { attrs[k] = v; },
		removeAttribute(k: string) { delete attrs[k]; },
		hasAttribute(k: string) { return k in attrs; },
		getAttribute(k: string) { return attrs[k] ?? null; },
	} as unknown as HTMLElement;
}

describe('applyPnpToRoot', () => {
	it('sets data-qti-colorscheme for a non-default scheme', () => {
		const el = makeEl();
		applyPnpToRoot(el, { display: { colorScheme: 'blackwhite' } });
		expect(el.getAttribute('data-qti-colorscheme')).toBe('blackwhite');
	});

	it('removes the attribute for "default" scheme', () => {
		const el = makeEl();
		el.setAttribute('data-qti-colorscheme', 'blackwhite');
		applyPnpToRoot(el, { display: { colorScheme: 'default' } });
		expect(el.hasAttribute('data-qti-colorscheme')).toBe(false);
	});

	it('removes the attribute when pnp is undefined', () => {
		const el = makeEl();
		el.setAttribute('data-qti-colorscheme', 'blackwhite');
		applyPnpToRoot(el, undefined);
		expect(el.hasAttribute('data-qti-colorscheme')).toBe(false);
	});

	it('removes the attribute when colorScheme is undefined', () => {
		const el = makeEl();
		el.setAttribute('data-qti-colorscheme', 'blackwhite');
		applyPnpToRoot(el, { display: {} });
		expect(el.hasAttribute('data-qti-colorscheme')).toBe(false);
	});

	it.each(['blackwhite', 'whitenav', 'blackcream', 'yellowblue', 'medgray'] as const)(
		'sets correct attribute value for scheme "%s"',
		(scheme) => {
			const el = makeEl();
			applyPnpToRoot(el, { display: { colorScheme: scheme } });
			expect(el.getAttribute('data-qti-colorscheme')).toBe(scheme);
		}
	);
});

// ---------------------------------------------------------------------------
// Player.applyPnp / Player.updatePnp
// ---------------------------------------------------------------------------

const MINIMAL_ITEM_XML = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="test" title="Test" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"/>
  <itemBody><choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
    <simpleChoice identifier="A">Alpha</simpleChoice>
    <simpleChoice identifier="B">Beta</simpleChoice>
  </choiceInteraction></itemBody>
</assessmentItem>`;

describe('Player PNP integration', () => {
	it('applyPnp sets the color scheme attribute on the root element', () => {
		const player = new Player({
			itemXml: MINIMAL_ITEM_XML,
			pnp: { display: { colorScheme: 'yellowblue' } },
		});
		const root = makeEl();
		player.applyPnp(root);
		expect(root.getAttribute('data-qti-colorscheme')).toBe('yellowblue');
	});

	it('updatePnp changes the attribute without re-parsing the item', () => {
		const player = new Player({ itemXml: MINIMAL_ITEM_XML });
		const root = makeEl();
		player.applyPnp(root);

		expect(root.hasAttribute('data-qti-colorscheme')).toBe(false);

		player.updatePnp({ display: { colorScheme: 'blackwhite' } });
		expect(root.getAttribute('data-qti-colorscheme')).toBe('blackwhite');
	});

	it('updatePnp deep-merges without losing other fields', () => {
		const player = new Player({
			itemXml: MINIMAL_ITEM_XML,
			pnp: { cognitive: { eliminationTool: true }, display: { colorScheme: 'blackwhite' } },
		});
		const root = makeEl();
		player.applyPnp(root);

		player.updatePnp({ display: { colorScheme: 'medgray' } });

		expect(root.getAttribute('data-qti-colorscheme')).toBe('medgray');
		expect(player.getPnp()?.cognitive?.eliminationTool).toBe(true);
	});

	it('updatePnp to default removes the attribute', () => {
		const player = new Player({
			itemXml: MINIMAL_ITEM_XML,
			pnp: { display: { colorScheme: 'blackwhite' } },
		});
		const root = makeEl();
		player.applyPnp(root);

		player.updatePnp({ display: { colorScheme: 'default' } });
		expect(root.hasAttribute('data-qti-colorscheme')).toBe(false);
	});

	it('getPnp returns the current profile', () => {
		const pnp: PnpProfile = { cognitive: { eliminationTool: true } };
		const player = new Player({ itemXml: MINIMAL_ITEM_XML, pnp });
		expect(player.getPnp()?.cognitive?.eliminationTool).toBe(true);
	});
});
