/**
 * Accessibility catalog cards
 *
 * The card shape pie-players resolves: a catalog per identifier, a card per support and language,
 * its body either HTML `content` or a media `payload`. Support names are QTI 3's.
 */

export type MediaKind = 'image' | 'audio' | 'video' | 'other';

/** One playable encoding of a media asset. */
export interface MediaSource {
	src: string;
	/** MIME type, omitted when the source does not declare one. */
	type?: string;
}

export interface MediaAssetRef {
	version: 1;
	id: string;
	kind: MediaKind;
	sources: MediaSource[];
}

/** A time slice of a media asset, from a QTI 3 media fragment (`#t=2,5`). */
export interface MediaFragmentRange {
	startSeconds: number;
	endSeconds?: number;
}

/** The structured form of a card: a recording for `spoken`, a video for `sign-language`. */
export interface CatalogCardPayload {
	media: MediaAssetRef;
	fragment?: MediaFragmentRange;
}

/** One alternate representation of a content node. Exactly one of `content` and `payload`. */
export interface CatalogCard {
	/** The QTI `support`, e.g. `spoken`, `sign-language`, `glossary-on-screen`. */
	catalog: string;
	language?: string;
	content?: string;
	payload?: CatalogCardPayload;
}

export interface AccessibilityCatalog {
	identifier: string;
	cards: CatalogCard[];
}

/** A word or character range of an element's text, counted from 1, both ends included. */
export interface TextRange {
	unit: 'word' | 'character';
	start: number;
	stop: number;
}

const EXTENSION_KINDS: Record<string, MediaKind> = {
	aac: 'audio',
	m4a: 'audio',
	mp3: 'audio',
	oga: 'audio',
	ogg: 'audio',
	wav: 'audio',
	m4v: 'video',
	mov: 'video',
	mp4: 'video',
	ogv: 'video',
	webm: 'video',
	gif: 'image',
	jpeg: 'image',
	jpg: 'image',
	png: 'image',
	svg: 'image',
	webp: 'image',
};

/** A media asset's kind, from its MIME type, else its extension, else `fallback`. */
export function mediaKind(type: string | undefined, src: string, fallback: MediaKind): MediaKind {
	const prefix = type?.split('/')[0]?.toLowerCase();
	if (prefix === 'image' || prefix === 'audio' || prefix === 'video') return prefix;
	const extension = /\.([a-z0-9]+)$/i.exec(src)?.[1]?.toLowerCase();
	return (extension ? EXTENSION_KINDS[extension] : undefined) ?? fallback;
}

/** A clock value (`90`, `1:30`, `00:01:30.5`) as seconds; `undefined` when it is not one. */
export function clockSeconds(value: string): number | undefined {
	const parts = value.split(':').map(Number);
	if (parts.length > 3 || parts.some((part) => !Number.isFinite(part))) return undefined;
	return parts.reduce((total, part) => total * 60 + part, 0);
}
