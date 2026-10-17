import { describe, expect, it } from 'bun:test';
import { Player } from '../../src/core/Player.js';
import { applyPnpToRoot } from '../../src/pnp/applyPnp.js';
import { parseAfaPnpXml, parsePnpXml } from '../../src/pnp/parsePnpXml.js';
import type { PnpProfile } from '../../src/pnp/types.js';

const AFA = 'http://www.imsglobal.org/xsd/qtiv3p0/imsafa3p0pnp_v1p0';
const pnp = (body: string) => `<?xml version="1.0" encoding="UTF-8"?>
	<access-for-all-pnp xmlns="${AFA}" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">${body}</access-for-all-pnp>`;

describe('parseAfaPnpXml', () => {
	it('keys the record by AfA terms', () => {
		const record = parseAfaPnpXml(
			pnp(`
				<spoken>
					<reading-type>computer-read-aloud</reading-type>
					<speech-rate>270</speech-rate>
					<restriction-type>skip-math-equations</restriction-type>
					<restriction-type>skip-images</restriction-type>
				</spoken>
				<calculator-on-screen calculator-type="scientific"/>
				<sign-language xml:lang="ase"/>
				<line-reader highlight-color="#336699"/>
				<answer-masking/>
				<activate-at-initialization-set><spoken/></activate-at-initialization-set>
				<prohibit-set><dictionary-on-screen/></prohibit-set>
			`)
		);
		expect(record).toEqual({
			spoken: {
				'reading-type': 'computer-read-aloud',
				'speech-rate': 270,
				'restriction-type': ['skip-math-equations', 'skip-images'],
			},
			'calculator-on-screen': { 'calculator-type': 'scientific' },
			'sign-language': { language: 'ase' },
			'line-reader': { 'highlight-color': '#336699' },
			'answer-masking': {},
			'activate-at-initialization-set': ['spoken'],
			'prohibit-set': ['dictionary-on-screen'],
		});
	});

	it('reads the profile inside a bulk record', () => {
		const record = parseAfaPnpXml(`
			<access-for-all-pnp-records xmlns="${AFA}">
				<access-for-all-pnp-record>
					<person-sourced-id source-system="example">111</person-sourced-id>
					<access-for-all-pnp><keyword-translation xml:lang="es"/></access-for-all-pnp>
				</access-for-all-pnp-record>
			</access-for-all-pnp-records>
		`);
		expect(record).toEqual({ 'keyword-translation': { language: 'es' } });
	});

	it('reads a prefixed AfA namespace as AfA and other namespaces as extensions', () => {
		const record = parseAfaPnpXml(`
			<afa:access-for-all-pnp xmlns:afa="${AFA}" xmlns:kxz="http://www.kxztesting.com/2019/pnp-extensions">
				<afa:glossary-on-screen/>
				<kxz:kxztesting-illustrated-glossary-on-screen/>
			</afa:access-for-all-pnp>
		`);
		expect(record).toEqual({
			'glossary-on-screen': {},
			extensions: { 'kxztesting-illustrated-glossary-on-screen': {} },
		});
	});

	it('returns null when the input holds no AfA profile', () => {
		expect(parseAfaPnpXml('')).toBeNull();
		expect(parseAfaPnpXml('<personalNeedsProfile><display/></personalNeedsProfile>')).toBeNull();
	});
});

describe('parsePnpXml', () => {
	it.each([
		['default', 'default'],
		['default-reverse', 'defaultreverse'],
		['high-contrast', 'blackwhite'],
		['high-contrast-reverse', 'whiteblack'],
		['black-rose', 'blackrose'],
		['rose-black', 'roseblack'],
		['yellow-blue', 'yellowblue'],
		['blue-yellow', 'blueyellow'],
		['medgray-darkgray', 'mgraydgray'],
		['darkgray-medgray', 'dgraymgray'],
		['black-cyan', 'blackcyan'],
		['cyan-black', 'cyanblack'],
		['black-cream', 'blackcream'],
		['cream-black', 'creamblack'],
	] as const)('maps color-theme "%s" to scheme "%s"', (theme, scheme) => {
		const profile = parsePnpXml(pnp(`<text-appearance><color-theme>${theme}</color-theme></text-appearance>`));
		expect(profile.display?.colorScheme).toBe(scheme);
	});

	it('leaves an extension color theme and a bare color-theme request to the host', () => {
		expect(parsePnpXml(pnp('<text-appearance><color-theme>ext:program-sepia</color-theme></text-appearance>'))).toEqual({});
		expect(parsePnpXml(pnp('<text-appearance><color-theme/></text-appearance>'))).toEqual({});
	});

	it('reads magnification from all-content, else from text', () => {
		expect(parsePnpXml(pnp('<magnification><all-content zoom-amount="2"/></magnification>')).display?.magnification).toBe(2);
		expect(
			parsePnpXml(pnp('<magnification><text zoom-amount="1.5"/><non-text zoom-amount="2.0"/></magnification>')).display
				?.magnification
		).toBe(1.5);
	});

	it('maps additional-testing-time to extended time', () => {
		expect(
			parsePnpXml(pnp('<additional-testing-time><time-multiplier>1.5</time-multiplier></additional-testing-time>')).content
				?.extendedTime
		).toEqual({ active: true, multiplier: 1.5 });
		expect(
			parsePnpXml(pnp('<additional-testing-time><unlimited/></additional-testing-time>')).content?.extendedTime
		).toEqual({ active: true, multiplier: Infinity });
	});

	it('maps fixed-minutes testing time to minutes added to each limit', () => {
		const xml = pnp('<additional-testing-time><fixed-minutes>30</fixed-minutes></additional-testing-time>');
		expect(parsePnpXml(xml).content?.extendedTime).toEqual({ active: true, multiplier: 1, fixedMinutes: 30 });
	});

	it('maps language-of-interface, invert-display-polarity and layout-single-column', () => {
		const profile = parsePnpXml(
			pnp(`
				<language-of-interface xml:lang="es"/>
				<invert-display-polarity foreground="FFFF00" background="000000"/>
				<layout-single-column/>
			`)
		);
		expect(profile.display).toEqual({
			interfaceLanguage: 'es',
			invertPolarity: { foreground: '#ffff00', background: '#000000' },
			singleColumn: true,
		});
		expect(parsePnpXml(pnp('<invert-display-polarity/>')).display?.invertPolarity).toEqual({});
	});

	it('maps text-appearance to the text the player sets', () => {
		const profile = parsePnpXml(
			pnp(`
				<text-appearance>
					<background-color>#FFFFCC</background-color>
					<font-color>333333</font-color>
					<font-size>18</font-size>
					<font-face><font-name>Atkinson Hyperlegible</font-name><generic-font-face>sans serif</generic-font-face></font-face>
					<line-spacing>1.5</line-spacing>
					<letter-spacing>0.12</letter-spacing>
					<word-spacing>0.16</word-spacing>
				</text-appearance>
			`)
		);
		expect(profile.display?.textAppearance).toEqual({
			backgroundColor: '#ffffcc',
			fontColor: '#333333',
			fontSize: 18,
			fontFamily: '"Atkinson Hyperlegible", sans-serif',
			lineHeight: 1.5,
			letterSpacing: 0.12,
			wordSpacing: 0.16,
		});
	});

	it('maps tool supports to pie-players support ids', () => {
		const profile = parsePnpXml(
			pnp(`
				<calculator-on-screen calculator-type="graphing"/>
				<spoken><reading-type>computer-read-aloud</reading-type><speech-rate>270</speech-rate><pitch>0.5</pitch></spoken>
				<line-reader highlight-color="#336699"/>
				<activate-at-initialization-set><line-reader/></activate-at-initialization-set>
				<prohibit-set><dictionary-on-screen/></prohibit-set>
			`)
		);
		expect(profile.tools).toEqual({
			supports: ['calculator', 'lineReader', 'textToSpeech'],
			prohibitedSupports: ['dictionary'],
			activateAtInit: ['lineReader'],
			toolParameters: { calculator: { type: 'graphing' }, textToSpeech: { rate: 1.5, pitch: 1 } },
		});
	});

	it('maps a screen-reader spoken request to screenReader and a prohibited one to no read-aloud', () => {
		expect(parsePnpXml(pnp('<spoken/>')).tools).toEqual({ supports: ['screenReader'] });
		expect(parsePnpXml(pnp('<prohibit-set><spoken/></prohibit-set>')).tools).toEqual({
			prohibitedSupports: ['textToSpeech'],
		});
	});

	it('leaves a standard or extension calculator type to the tool default', () => {
		expect(parsePnpXml(pnp('<calculator-on-screen calculator-type="standard"/>')).tools).toEqual({
			supports: ['calculator'],
		});
	});

	it('maps glossary-on-screen and keyword-translation to their popups', () => {
		const profile = parsePnpXml(pnp('<glossary-on-screen/><keyword-translation xml:lang="es"/>'));
		expect(profile.content?.glossaryOnScreen).toBe(true);
		expect(profile.content?.keywordTranslation).toEqual({ active: true, languageCode: 'es' });
	});

	it('maps the SBAC illustrated glossary extension', () => {
		const profile = parsePnpXml(`
			<access-for-all-pnp xmlns="${AFA}" xmlns:sbac="urn:example:sbac">
				<sbac:sbac-glossary-illustration/>
			</access-for-all-pnp>
		`);
		expect(profile.content?.illustratedGlossary).toBe(true);
	});

	it('enables the catalog support of each predefined card support it grants', () => {
		const profile = parsePnpXml(pnp('<sign-language xml:lang="ase"/><braille/><spoken/><calculator-on-screen/>'));
		expect(profile.content?.catalogSupports).toEqual({
			// The supports the player routes itself arrive under their platform preference
			// keys; the rest keep the AfA feature name for host-defined routing.
			brailleText: true,
			signingDefinition: { active: true, languageCode: 'ase' },
			spoken: true,
		});
	});

	it('maps answer-masking to masked choices', () => {
		expect(parsePnpXml(pnp('<answer-masking/>')).cognitive).toEqual({ answerMasking: true });
	});

	it('grants features listed in an activation set and withdraws prohibited ones', () => {
		const profile = parsePnpXml(
			pnp(`
				<glossary-on-screen/>
				<activate-as-option-set><answer-masking/></activate-as-option-set>
				<prohibit-set><glossary-on-screen/></prohibit-set>
			`)
		);
		expect(profile).toEqual({ cognitive: { answerMasking: true } });
	});

	it('returns an empty profile for empty input and for the pre-AfA shape', () => {
		expect(parsePnpXml('')).toEqual({});
		expect(parsePnpXml('<personalNeedsProfile><content><glossaryOnScreen/></content></personalNeedsProfile>')).toEqual({});
	});
});

function makeEl(): HTMLElement & { props: Record<string, string> } {
	const attrs: Record<string, string> = {};
	const props: Record<string, string> = {};
	return {
		props,
		style: {
			setProperty(k: string, v: string) {
				props[k] = v;
			},
			removeProperty(k: string) {
				delete props[k];
			},
		},
		setAttribute(k: string, v: string) {
			attrs[k] = v;
		},
		removeAttribute(k: string) {
			delete attrs[k];
		},
		hasAttribute(k: string) {
			return k in attrs;
		},
		getAttribute(k: string) {
			return attrs[k] ?? null;
		},
	} as unknown as HTMLElement & { props: Record<string, string> };
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

	it('sets magnification metadata for host stylesheets', () => {
		const el = makeEl();
		applyPnpToRoot(el, { display: { magnification: 1.5 } });
		expect(el.getAttribute('data-qti-magnification')).toBe('1.5');
	});

	it('sets inverted polarity, with the profile colours when given', () => {
		const el = makeEl();
		applyPnpToRoot(el, { display: { invertPolarity: {} } });
		expect(el.getAttribute('data-qti-invert-polarity')).toBe('invert');
		applyPnpToRoot(el, { display: { invertPolarity: { foreground: '#ffff00', background: '#000000' } } });
		expect(el.getAttribute('data-qti-invert-polarity')).toBe('colors');
		expect(el.props).toMatchObject({ '--qti-invert-foreground': '#ffff00', '--qti-invert-background': '#000000' });
		applyPnpToRoot(el, {});
		expect(el.hasAttribute('data-qti-invert-polarity')).toBe(false);
		expect(el.props['--qti-invert-foreground']).toBeUndefined();
	});

	it('sets the single-column layout', () => {
		const el = makeEl();
		applyPnpToRoot(el, { display: { singleColumn: true } });
		expect(el.getAttribute('data-qti-layout')).toBe('single-column');
		applyPnpToRoot(el, { display: {} });
		expect(el.hasAttribute('data-qti-layout')).toBe(false);
	});

	it('sets text appearance as custom properties with their units', () => {
		const el = makeEl();
		applyPnpToRoot(el, {
			display: { textAppearance: { fontSize: 18, fontFamily: 'serif', lineHeight: 1.5, letterSpacing: 0.12, wordSpacing: 0.16 } },
		});
		expect(el.getAttribute('data-qti-text-appearance')).toBe('font-size font-family line-height letter-spacing word-spacing');
		expect(el.props).toEqual({
			'--qti-font-size': '18pt',
			'--qti-font-family': 'serif',
			'--qti-line-height': '1.5',
			'--qti-letter-spacing': '0.12em',
			'--qti-word-spacing': '0.16em',
		});
		applyPnpToRoot(el, undefined);
		expect(el.hasAttribute('data-qti-text-appearance')).toBe(false);
		expect(el.props).toEqual({});
	});

	it.each(['blackwhite', 'whiteblack', 'blackrose', 'yellowblue', 'blueyellow', 'blackcream', 'creamblack', 'medgray'] as const)(
		'sets correct attribute value for scheme "%s"',
		(scheme) => {
			const el = makeEl();
			applyPnpToRoot(el, { display: { colorScheme: scheme } });
			expect(el.getAttribute('data-qti-colorscheme')).toBe(scheme);
		}
	);
});

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
