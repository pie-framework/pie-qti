/**
 * APIP accessibility
 *
 * QTI 2.x carries accessibility content as APIP 1.0: an `apip:apipAccessibility` element whose
 * `accessElement`s each link content elements, by `id`, to the supports that describe them. A
 * catalog is the same thing in QTI 3's terms, so an access element maps to one catalog by its
 * `identifier`, its supports to cards under the support names QTI 3 uses, as 1EdTech's
 * APIP-to-QTI 3 migration guide maps them:
 *
 * - `spoken`: one script card, the first of `textToSpeechPronunciationSSML` (as `<speak>`),
 *   `textToSpeechPronunciation` and `spokenText`, the others kept as `ext:custom-` cards, and a
 *   card per `audioFileInfo` recording, its `startTime` and `duration` the time range;
 * - `brailleText` as `braille`, `tactileFile` as `tactile`;
 * - `signing` as `sign-language` video, `ase` for ASL and `eng-US` for Signed English, with the
 *   cues as the time range;
 * - `keyWordTranslation` as `keyword-translation`, one card per language;
 * - `guidance`'s `languageLearnerSupport` as `linguistic-guidance`.
 *
 * QTI 3 has no counterpart for the other supports, which the reader reports as unmapped;
 * `voiceType`, `voiceSpeed` and `supportOrder` are dropped, the last because document order is the
 * order.
 *
 * The writer maps the other way. A card APIP has no element for, a card past the one an element
 * holds, and a card missing what its element requires (a `tactile` recording without its text, an
 * audio file whose MIME type is unknown) are unwritten, and the result names their supports.
 * SSML elements APIP does not admit are unwrapped to their content. Plain-text APIP elements take
 * the card's text, its markup dropped.
 */

import { type HTMLElement, NodeType, parse, TextNode } from 'node-html-parser';
import {
	type CatalogCard,
	type CatalogCardPayload,
	clockSeconds,
	type MediaFragmentRange,
	type MediaKind,
	mediaKind,
	mediaMimeType,
	type TextRange,
} from './catalog.js';

export const APIP_NAMESPACE = 'http://www.imsglobal.org/xsd/apip/apipv1p0/imsapip_qtiv1p0';
export const SSML_NAMESPACE = 'http://www.w3.org/2001/10/synthesis';

/** An APIP link from an access element to the content it describes. */
export interface ApipContentLink {
	/** The `id` of the content element, from `qtiLinkIdentifierRef`; empty when it names none. */
	target: string;
	/** The word or character range of the element's text, when the link has one. */
	range?: TextRange;
	/** The link names the element as an object (`objectLink`): an image, a media player. */
	object?: boolean;
}

export interface ApipAccessElement {
	identifier: string;
	links: ApipContentLink[];
	cards: CatalogCard[];
	/** The supports QTI 3 has no counterpart for, by element name. */
	unmapped: string[];
}

export type ApipAccessElementSource = Pick<ApipAccessElement, 'identifier' | 'links' | 'cards'>;

export interface ApipAccessibilityXml {
	/** The `apip:apipAccessibility` element, its namespaces declared on it; absent when nothing is written. */
	xml?: string;
	/** The supports of the cards not written, by access element identifier. */
	unwritten: Map<string, string[]>;
}

export interface ApipWriteOptions {
	/** The `id`s the document uses already, which the access elements and labels must not take. */
	reservedIds?: Iterable<string>;
}

const SPOKEN = 'spoken';
const SIGN_LANGUAGE = 'sign-language';
const TTS_PRONUNCIATION = 'ext:custom-text-to-speech-pronunciation';
const SPOKEN_TEXT = 'ext:custom-spoken-text';
const TACTILE_BRAILLE_TEXT = 'ext:custom-tactile-braille-text';
/** The sign language a `signing` file is in: ASL, and Signed English as the guide codes it. */
const SIGN_FILE_LANGUAGES: Record<string, string> = {
	signFileASL: 'ase',
	signFileSignedEnglish: 'eng-US',
};
/** The SSML elements `textToSpeechPronunciationSSML` admits. */
const APIP_SSML_ELEMENTS = new Set([
	'p',
	's',
	'say-as',
	'phoneme',
	'sub',
	'voice',
	'emphasis',
	'break',
	'prosody',
	'mark',
	'audio',
]);
const APIP_SUPPORTS: Record<string, (support: HTMLElement) => ApipSupport> = {
	spoken: spokenSupport,
	brailleText: (support) => ({ cards: textCards('braille', textOf(support, 'brailleTextString')) }),
	tactileFile: (support) => {
		const audio = firstChild(support, 'tactileAudioFile');
		const payload = audio && audioPayload(audio);
		return {
			cards: [
				...textCards('tactile', textOf(support, 'tactileAudioText')),
				...(payload ? [{ catalog: 'tactile', payload }] : []),
				...textCards(TACTILE_BRAILLE_TEXT, textOf(support, 'tactileBrailleText')),
			],
		};
	},
	signing: (support) => {
		const cards: CatalogCard[] = [];
		const unmapped: string[] = [];
		for (const signFile of allChildElements(support)) {
			const language = SIGN_FILE_LANGUAGES[localName(signFile)];
			const video = firstChild(signFile, 'videoFileInfo');
			const payload = language && video ? videoPayload(video) : undefined;
			if (payload) cards.push({ catalog: SIGN_LANGUAGE, language, payload });
			if (!language) unmapped.push(localName(signFile));
			else if (firstChild(signFile, 'boneAnimationVideoFile')) unmapped.push('boneAnimationVideoFile');
		}
		return { cards, unmapped };
	},
	keyWordTranslation: (support) => ({
		cards: childElements(support, 'definitionId').flatMap((definition) => {
			const language = definition.getAttribute('xml:lang')?.trim();
			return textCards('keyword-translation', textOf(definition, 'textString')).map((card) =>
				language ? { ...card, language } : card
			);
		}),
	}),
	guidance: (support) => {
		const learner = firstChild(support, 'languageLearnerSupport');
		return {
			cards: learner ? textCards('linguistic-guidance', textOf(learner, 'textString')) : [],
			unmapped: firstChild(support, 'cognitiveGuidanceSupport') ? ['cognitiveGuidanceSupport'] : [],
		};
	},
};

interface ApipSupport {
	cards: CatalogCard[];
	unmapped?: string[];
}

/**
 * The APIP access elements a QTI 2.x document declares, in document order. A string is parsed
 * with its CDATA sections unwrapped; a parsed root must keep tag names as authored.
 */
export function readApipAccessElements(source: string | HTMLElement): ApipAccessElement[] {
	const root =
		typeof source === 'string'
			? parse(source.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1'), {
					lowerCaseTagName: false,
					comment: false,
				})
			: source;
	return root
		.querySelectorAll('*')
		.filter((element) => localName(element) === 'accessElement')
		.map((element) => {
			const cards: CatalogCard[] = [];
			const unmapped: string[] = [];
			for (const info of childElements(element, 'relatedElementInfo')) {
				for (const support of allChildElements(info)) {
					const read = APIP_SUPPORTS[localName(support)];
					if (!read) {
						unmapped.push(localName(support));
						continue;
					}
					const mapped = read(support);
					cards.push(...mapped.cards);
					unmapped.push(...(mapped.unmapped ?? []));
				}
			}
			return {
				identifier: element.getAttribute('identifier')?.trim() ?? '',
				links: childElements(element, 'contentLinkInfo').map(contentLink),
				cards,
				unmapped,
			};
		});
}

/** Write access elements as `apip:apipAccessibility`, for the end of an item or stimulus. */
export function writeApipAccessibility(
	elements: ApipAccessElementSource[],
	options: ApipWriteOptions = {}
): ApipAccessibilityXml {
	const ids = new IdAllocator(options.reservedIds);
	const unwritten = new Map<string, string[]>();
	const written: string[] = [];
	let ssml = false;
	for (const element of elements) {
		const links = element.links.flatMap((link) => {
			const xml = contentLinkXml(link);
			return xml ? [xml] : [];
		});
		const identifier = ids.take(ncName(element.identifier));
		const label = () => ids.take(`${identifier}-${ids.next(identifier)}`);
		const supports = links.length > 0 ? supportsXml(element.cards, label) : undefined;
		const skipped = supports ? supports.unwritten : element.cards.map((card) => card.catalog);
		if (skipped.length > 0) unwritten.set(element.identifier, [...new Set(skipped)]);
		if (!supports || supports.xml.length === 0) continue;
		ssml ||= supports.ssml;
		written.push(
			`<apip:accessElement identifier="${escapeAttribute(identifier)}">${links.join('')}` +
				`<apip:relatedElementInfo>${supports.xml.join('')}</apip:relatedElementInfo></apip:accessElement>`
		);
	}
	if (written.length === 0) return { unwritten };
	const namespaces = `xmlns:apip="${APIP_NAMESPACE}"${ssml ? ` xmlns:ssml="${SSML_NAMESPACE}"` : ''}`;
	return {
		xml: `<apip:apipAccessibility ${namespaces}><apip:accessibilityInfo>${written.join('')}</apip:accessibilityInfo></apip:apipAccessibility>`,
		unwritten,
	};
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

function spokenSupport(spoken: HTMLElement): ApipSupport {
	const ssml = firstChild(spoken, 'textToSpeechPronunciationSSML');
	// The first script present is the spoken card; the ones it outranks keep their own names.
	const scripts = [
		[SPOKEN, ssml && speakMarkup(ssml)],
		[TTS_PRONUNCIATION, textOf(spoken, 'textToSpeechPronunciation')],
		[SPOKEN_TEXT, textOf(spoken, 'spokenText')],
	].filter((script): script is [string, string] => Boolean(script[1]));
	const recordings = childElements(spoken, 'audioFileInfo').flatMap((audio) => {
		const payload = audioPayload(audio);
		return payload ? [{ catalog: SPOKEN, payload }] : [];
	});
	return {
		cards: [
			...scripts.map(([catalog, content], index) => ({
				catalog: index === 0 ? SPOKEN : catalog,
				content,
			})),
			...recordings,
		],
	};
}

/** `textToSpeechPronunciationSSML` as a `<speak>` document, its elements without prefixes. */
function speakMarkup(ssml: HTMLElement): string | undefined {
	const markup = ssml.innerHTML
		.replace(/<(\/?)[\w.-]+:/g, '<$1')
		.replace(/\s+xmlns(?::[\w.-]+)?\s*=\s*(?:"[^"]*"|'[^']*')/g, '')
		.replace(/\s+/g, ' ')
		.trim();
	if (!markup) return undefined;
	return /^<speak[\s>]/.test(markup) ? markup : `<speak>${markup}</speak>`;
}

function audioPayload(info: HTMLElement): CatalogCardPayload | undefined {
	const start = timeOf(info, 'startTime');
	const duration = timeOf(info, 'duration');
	const startSeconds = start ?? 0;
	return filePayload(
		info,
		'audio',
		start === undefined && duration === undefined
			? undefined
			: {
					startSeconds,
					...(duration === undefined ? {} : { endSeconds: milliseconds(startSeconds + duration) }),
				}
	);
}

function videoPayload(info: HTMLElement): CatalogCardPayload | undefined {
	const start = timeOf(info, 'startCue');
	const end = timeOf(info, 'endCue');
	return filePayload(
		info,
		'video',
		start === undefined && end === undefined
			? undefined
			: { startSeconds: start ?? 0, ...(end === undefined ? {} : { endSeconds: end }) }
	);
}

function filePayload(
	info: HTMLElement,
	fallback: MediaKind,
	fragment: MediaFragmentRange | undefined
): CatalogCardPayload | undefined {
	const src = firstChild(info, 'fileHref')?.textContent.trim();
	if (!src) return undefined;
	const type = info.getAttribute('mimeType')?.trim();
	return {
		media: {
			version: 1,
			id: src,
			kind: mediaKind(type, src, fallback),
			sources: [{ src, ...(type ? { type } : {}) }],
		},
		...(fragment ? { fragment } : {}),
	};
}

/** An `xs:time` child as seconds; its time zone, which a media offset has no use for, ignored. */
function timeOf(parent: HTMLElement, name: string): number | undefined {
	const value = firstChild(parent, name)
		?.textContent.trim()
		.replace(/(?:Z|[+-]\d{2}:\d{2})$/, '');
	return value ? clockSeconds(value) : undefined;
}

function milliseconds(value: number): number {
	return Math.round(value * 1000) / 1000;
}

function contentLink(link: HTMLElement): ApipContentLink {
	const target = link.getAttribute('qtiLinkIdentifierRef')?.trim() ?? '';
	const textLink = firstChild(link, 'textLink');
	const word = textLink && firstChild(textLink, 'wordLink');
	const character = textLink && firstChild(textLink, 'characterLink');
	const characters = textLink && firstChild(textLink, 'characterStringLink');
	let range: TextRange | undefined;
	if (word) {
		range = { unit: 'word', start: count(word), stop: count(word) };
	} else if (character) {
		range = { unit: 'character', start: count(character), stop: count(character) };
	} else if (characters) {
		range = {
			unit: 'character',
			start: count(firstChild(characters, 'startCharacter')),
			stop: count(firstChild(characters, 'stopCharacter')),
		};
	}
	return {
		target,
		...(range ? { range } : {}),
		...(firstChild(link, 'objectLink') ? { object: true } : {}),
	};
}

/** A link's word or character number; not a number when absent, so it locates nothing. */
function count(element: HTMLElement | undefined): number {
	return Number(element?.textContent.trim() || Number.NaN);
}

/** A text child as card content: its text, escaped as HTML. */
function textOf(parent: HTMLElement, name: string): string | undefined {
	const text = firstChild(parent, name)?.textContent.trim();
	return text ? escapeText(text) : undefined;
}

function textCards(catalog: string, content: string | undefined): CatalogCard[] {
	return content ? [{ catalog, content }] : [];
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

interface SupportsXml {
	/** The `relatedElementInfo` children, in the order the reader lists their cards. */
	xml: string[];
	unwritten: string[];
	ssml: boolean;
}

/** Hands out unique NCName `id`s. */
class IdAllocator {
	private readonly used: Set<string>;
	private readonly counters = new Map<string, number>();

	constructor(reserved: Iterable<string> = []) {
		this.used = new Set(reserved);
	}

	take(base: string): string {
		let id = base;
		for (let suffix = 2; this.used.has(id); suffix += 1) id = `${base}-${suffix}`;
		this.used.add(id);
		return id;
	}

	/** The next number in `base`'s sequence, from 1. */
	next(base: string): number {
		const value = (this.counters.get(base) ?? 0) + 1;
		this.counters.set(base, value);
		return value;
	}
}

function supportsXml(cards: CatalogCard[], label: () => string): SupportsXml {
	const unwritten: string[] = [];
	const byCatalog = (...catalogs: string[]) => cards.filter((card) => catalogs.includes(card.catalog));
	const handled = new Set([
		SPOKEN,
		TTS_PRONUNCIATION,
		SPOKEN_TEXT,
		'braille',
		'tactile',
		TACTILE_BRAILLE_TEXT,
		SIGN_LANGUAGE,
		'keyword-translation',
		'linguistic-guidance',
	]);
	unwritten.push(...cards.filter((card) => !handled.has(card.catalog)).map((card) => card.catalog));

	const xml: string[] = [];
	const spoken = spokenXml(byCatalog(SPOKEN, TTS_PRONUNCIATION, SPOKEN_TEXT), label);
	unwritten.push(...spoken.unwritten);
	if (spoken.xml) xml.push(spoken.xml);

	for (const card of byCatalog('braille')) {
		const text = card.content === undefined ? undefined : plainText(card.content);
		if (text) xml.push(`<apip:brailleText>${labelled('brailleTextString', label(), text)}</apip:brailleText>`);
		else unwritten.push(card.catalog);
	}

	const tactile = tactileXml(byCatalog('tactile', TACTILE_BRAILLE_TEXT), label);
	unwritten.push(...tactile.unwritten);
	if (tactile.xml) xml.push(tactile.xml);

	const signFiles: Record<string, string[]> = { signFileASL: [], signFileSignedEnglish: [] };
	for (const card of byCatalog(SIGN_LANGUAGE)) {
		const element = Object.keys(SIGN_FILE_LANGUAGES).find(
			(name) => SIGN_FILE_LANGUAGES[name]?.toLowerCase() === card.language?.toLowerCase()
		);
		const video = element && card.payload ? fileInfoXml('videoFileInfo', card.payload, label) : undefined;
		if (element && video) signFiles[element]?.push(`<apip:${element}>${video}</apip:${element}>`);
		else unwritten.push(card.catalog);
	}
	const signing = Object.values(signFiles).flat();
	if (signing.length > 0) xml.push(`<apip:signing>${signing.join('')}</apip:signing>`);

	const definitions = byCatalog('keyword-translation').flatMap((card) => {
		const text = card.content === undefined ? undefined : plainText(card.content);
		if (!text || !card.language) {
			unwritten.push(card.catalog);
			return [];
		}
		return [
			`<apip:definitionId xml:lang="${escapeAttribute(card.language)}">${labelled('textString', label(), text)}</apip:definitionId>`,
		];
	});
	if (definitions.length > 0) xml.push(`<apip:keyWordTranslation>${definitions.join('')}</apip:keyWordTranslation>`);

	const [guidance, ...extraGuidance] = byCatalog('linguistic-guidance');
	const guidanceText = guidance?.content === undefined ? undefined : plainText(guidance.content);
	if (guidance && guidanceText) {
		xml.push(
			`<apip:guidance><apip:languageLearnerSupport><apip:supportOrder>1</apip:supportOrder>${labelled('textString', label(), guidanceText)}</apip:languageLearnerSupport></apip:guidance>`
		);
	} else if (guidance) {
		unwritten.push(guidance.catalog);
	}
	unwritten.push(...extraGuidance.map((card) => card.catalog));

	return { xml, unwritten, ssml: spoken.ssml };
}

/**
 * One `spoken`: its recordings, then its scripts. A `<speak>` card is the SSML script; the
 * `ext:custom-` cards take their own elements, and a plain-text `spoken` card the first of
 * `textToSpeechPronunciation` and `spokenText` they leave free.
 */
function spokenXml(
	cards: CatalogCard[],
	label: () => string
): { xml?: string; unwritten: string[]; ssml: boolean } {
	const unwritten: string[] = [];
	const audio: string[] = [];
	const slots: { ssml?: string; tts?: string; text?: string } = {};
	const plain: CatalogCard[] = [];
	for (const card of cards) {
		if (card.payload) {
			const info = card.catalog === SPOKEN ? fileInfoXml('audioFileInfo', card.payload, label) : undefined;
			if (info) audio.push(info);
			else unwritten.push(card.catalog);
			continue;
		}
		const content = card.content ?? '';
		const ssml = card.catalog === SPOKEN && !slots.ssml ? ssmlScript(content) : undefined;
		const text = plainText(content);
		if (ssml) slots.ssml = ssml;
		else if (card.catalog === TTS_PRONUNCIATION && !slots.tts && text) slots.tts = text;
		else if (card.catalog === SPOKEN_TEXT && !slots.text && text) slots.text = text;
		else if (card.catalog === SPOKEN && text) plain.push(card);
		else unwritten.push(card.catalog);
	}
	for (const card of plain) {
		const text = plainText(card.content ?? '');
		if (!slots.tts) slots.tts = text;
		else if (!slots.text) slots.text = text;
		else unwritten.push(card.catalog);
	}
	const scripts = [
		slots.text && labelled('spokenText', label(), slots.text),
		slots.tts && labelled('textToSpeechPronunciation', label(), slots.tts),
		slots.ssml &&
			`<apip:textToSpeechPronunciationSSML>${slots.ssml}</apip:textToSpeechPronunciationSSML>`,
	].filter(Boolean);
	if (audio.length === 0 && scripts.length === 0) return { unwritten, ssml: false };
	return {
		xml: `<apip:spoken>${audio.join('')}${scripts.join('')}</apip:spoken>`,
		unwritten,
		ssml: Boolean(slots.ssml),
	};
}

/** One `tactileFile`: it needs the `tactile` text, so the cards beside it go unwritten without one. */
function tactileXml(cards: CatalogCard[], label: () => string): { xml?: string; unwritten: string[] } {
	const unwritten: string[] = [];
	let text: string | undefined;
	let audio: string | undefined;
	let braille: string | undefined;
	for (const card of cards) {
		const value = card.content === undefined ? undefined : plainText(card.content);
		if (card.catalog === TACTILE_BRAILLE_TEXT && value && !braille) braille = value;
		else if (card.catalog === 'tactile' && card.payload && !audio) {
			audio = fileInfoXml('tactileAudioFile', card.payload, label);
			if (!audio) unwritten.push(card.catalog);
		} else if (card.catalog === 'tactile' && value && !text) text = value;
		else unwritten.push(card.catalog);
	}
	if (!text) return { unwritten: cards.map((card) => card.catalog) };
	return {
		xml:
			`<apip:tactileFile>${audio ?? ''}${labelled('tactileAudioText', label(), text)}` +
			`${braille ? labelled('tactileBrailleText', label(), braille) : ''}</apip:tactileFile>`,
		unwritten,
	};
}

/** An `audioFileInfo` or `videoFileInfo` for a payload's first source whose MIME type is known. */
function fileInfoXml(name: string, payload: CatalogCardPayload, label: () => string): string | undefined {
	const video = name === 'videoFileInfo';
	const source = payload.media.sources
		.map((candidate) => ({ ...candidate, mimeType: mediaMimeType(candidate) }))
		.find((candidate) => candidate.src && candidate.mimeType);
	if (!source) return undefined;
	const { fragment } = payload;
	let times = '';
	if (fragment && video) {
		times =
			`<apip:startCue>${xsTime(fragment.startSeconds)}</apip:startCue>` +
			(fragment.endSeconds === undefined ? '' : `<apip:endCue>${xsTime(fragment.endSeconds)}</apip:endCue>`);
	} else if (fragment) {
		times =
			`<apip:startTime>${xsTime(fragment.startSeconds)}</apip:startTime>` +
			(fragment.endSeconds === undefined
				? ''
				: `<apip:duration>${xsTime(fragment.endSeconds - fragment.startSeconds)}</apip:duration>`);
	}
	return (
		`<apip:${name} contentLinkIdentifier="${escapeAttribute(label())}" mimeType="${escapeAttribute(source.mimeType as string)}">` +
		`<apip:fileHref>${escapeText(source.src)}</apip:fileHref>${times}</apip:${name}>`
	);
}


/** Seconds as an `xs:time`, to the millisecond. */
function xsTime(seconds: number): string {
	const total = Math.max(0, Math.round(seconds * 1000));
	const pad = (value: number) => String(value).padStart(2, '0');
	const fraction = total % 1000;
	const clock = `${pad(Math.floor(total / 3_600_000))}:${pad(Math.floor(total / 60_000) % 60)}:${pad(Math.floor(total / 1000) % 60)}`;
	return fraction === 0 ? clock : `${clock}.${String(fraction).padStart(3, '0').replace(/0+$/, '')}`;
}

function contentLinkXml(link: ApipContentLink): string | undefined {
	if (!link.target) return undefined;
	const { range } = link;
	let body: string;
	if (link.object) {
		body = '<apip:objectLink/>';
	} else if (!range) {
		body = '<apip:textLink><apip:fullString/></apip:textLink>';
	} else if (!Number.isInteger(range.start) || !Number.isInteger(range.stop)) {
		return undefined;
	} else if (range.unit === 'character' && range.start !== range.stop) {
		body = `<apip:textLink><apip:characterStringLink><apip:startCharacter>${range.start}</apip:startCharacter><apip:stopCharacter>${range.stop}</apip:stopCharacter></apip:characterStringLink></apip:textLink>`;
	} else if (range.start === range.stop) {
		const element = range.unit === 'word' ? 'wordLink' : 'characterLink';
		body = `<apip:textLink><apip:${element}>${range.start}</apip:${element}></apip:textLink>`;
	} else {
		// APIP links one word, never a run of them.
		return undefined;
	}
	return `<apip:contentLinkInfo qtiLinkIdentifierRef="${escapeAttribute(link.target)}">${body}</apip:contentLinkInfo>`;
}

/** A `<speak>` card's content as APIP SSML, prefixed, or `undefined` when it is not SSML. */
function ssmlScript(content: string): string | undefined {
	if (!/^\s*<(?:[\w.-]+:)?speak[\s>/]/.test(content)) return undefined;
	const root = parse(content, { lowerCaseTagName: false, comment: false });
	const speak = allChildElements(root).find((element) => localName(element) === 'speak');
	const script = speak ? speak.childNodes.map(ssmlNode).join('').trim() : '';
	return script || undefined;
}

function ssmlNode(node: HTMLElement['childNodes'][number]): string {
	if (node instanceof TextNode) return escapeText(node.text);
	if (node.nodeType !== NodeType.ELEMENT_NODE) return '';
	const element = node as HTMLElement;
	const children = element.childNodes.map(ssmlNode).join('');
	const name = localName(element);
	if (!APIP_SSML_ELEMENTS.has(name)) return children;
	const attributes = Object.entries(element.attributes)
		.filter(([attribute]) => attribute !== 'xmlns' && !attribute.startsWith('xmlns:'))
		.map(([attribute, value]) => ` ${attribute}="${escapeAttribute(value)}"`)
		.join('');
	return children ? `<ssml:${name}${attributes}>${children}</ssml:${name}>` : `<ssml:${name}${attributes}/>`;
}

/** Card content as the text a plain-text APIP element holds. */
function plainText(content: string): string {
	return parse(content).textContent.trim();
}

function labelled(name: string, identifier: string, text: string): string {
	return `<apip:${name} contentLinkIdentifier="${escapeAttribute(identifier)}">${escapeText(text)}</apip:${name}>`;
}

/** `value` as an `xs:ID`: characters an NCName cannot hold become `-`, and a leading non-letter gains `_`. */
function ncName(value: string): string {
	const name = value.trim().replace(/[^\w.-]/g, '-');
	return /^[A-Za-z_]/.test(name) ? name : `_${name}`;
}

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

function escapeText(text: string): string {
	return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttribute(value: string): string {
	return escapeText(value).replace(/"/g, '&quot;');
}

function childElements(parent: HTMLElement, name: string): HTMLElement[] {
	return allChildElements(parent).filter((child) => localName(child) === name);
}

function allChildElements(parent: HTMLElement): HTMLElement[] {
	return parent.childNodes.filter((child): child is HTMLElement => child.nodeType === NodeType.ELEMENT_NODE);
}

function firstChild(parent: HTMLElement, name: string): HTMLElement | undefined {
	return childElements(parent, name)[0];
}

function localName(element: HTMLElement): string {
	const raw = element.rawTagName ?? '';
	return raw.slice(raw.indexOf(':') + 1);
}
