import type { ResolvedItemDeliveryContext } from '@pie-qti/ims-cp-core';

export type StimulusSanitizer = (html: string) => string;

/**
 * Build the effective stimulus content map for an item render.
 *
 * Resolved delivery-context content is the package/assessment source of truth.
 * Explicit content remains as a compatibility override for older host wiring.
 */
export function buildEffectiveStimulusContent(
	deliveryContext: ResolvedItemDeliveryContext | undefined,
	explicitStimulusContent: Record<string, string>,
	sanitize: StimulusSanitizer
): Record<string, string> {
	const resolved = Object.fromEntries(
		Object.entries(deliveryContext?.stimuli ?? {}).map(([identifier, stimulus]) => [
			identifier,
			sanitize(stimulus.bodyHtml),
		])
	);
	const explicit = Object.fromEntries(
		Object.entries(explicitStimulusContent).map(([identifier, content]) => [identifier, sanitize(content)])
	);
	return { ...resolved, ...explicit };
}

/**
 * Inject shared stimulus bodies at QTI refs or host-authored docking points.
 *
 * Any resolved stimulus that has no matching docking point is prepended in
 * delivery-context order so undocked package content is still visible.
 */
export function injectStimulusContent(itemBodyHtml: string, stimulusContent: Record<string, string>): string {
	if (Object.keys(stimulusContent).length === 0) return itemBodyHtml;

	const docked = new Set<string>();
	let html = itemBodyHtml.replace(
		/<qti-assessment-stimulus-ref\b([^>]*)\/?>\s*(?:<\/qti-assessment-stimulus-ref>)?/gi,
		(match, attrs) => {
			const identifier = extractAttribute(attrs, 'identifier');
			if (!identifier) return match;
			const content = stimulusContent[identifier];
			if (!content) return match;
			docked.add(identifier);
			return `<div data-stimulus-idref="${escapeHtmlAttribute(identifier)}" class="qti-stimulus-dock">${content}</div>`;
		}
	);

	html = html.replace(
		/<([a-z][\w:-]*)([^>]*\bdata-stimulus-idref=(["'])([^"']+)\3[^>]*)>\s*<\/\1>/gi,
		(match, tagName, attrs, _quote, identifier) => {
			const content = stimulusContent[identifier];
			if (!content) return match;
			docked.add(identifier);
			return `<${tagName}${mergeClassAttribute(attrs, 'qti-stimulus-dock')}>${content}</${tagName}>`;
		}
	);

	const undocked = Object.entries(stimulusContent)
		.filter(([identifier]) => !docked.has(identifier))
		.map(
			([identifier, content]) =>
				`<div data-stimulus-idref="${escapeHtmlAttribute(identifier)}" class="qti-stimulus-block">${content}</div>`
		)
		.join('');

	return undocked ? undocked + html : html;
}

function extractAttribute(attrs: string, name: string): string | null {
	const match = attrs.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, 'i'));
	return match?.[1] ?? null;
}

function mergeClassAttribute(attrs: string, className: string): string {
	const classMatch = attrs.match(/\bclass\s*=\s*(["'])([^"']*)\1/i);
	if (!classMatch) return `${attrs} class="${className}"`;
	const quote = classMatch[1]!;
	const existing = classMatch[2] ?? '';
	const classes = new Set(existing.split(/\s+/).filter(Boolean));
	classes.add(className);
	return attrs.replace(classMatch[0], `class=${quote}${Array.from(classes).join(' ')}${quote}`);
}

function escapeHtmlAttribute(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}
