import type { ElementExtractor } from '../../extraction/types.js';
import type { ExtractedPci } from '../../pci/types.js';

/**
 * Extractor for <qti-portable-custom-interaction> (QTI 3.0) and the
 * namespaced <pci:portableCustomInteraction> payload inside a QTI 2.x
 * <customInteraction> wrapper.
 *
 * Extracts the module paths, markup, and config properties needed by PciHost
 * to load and initialize the PCI JavaScript module.
 *
 * Priority 20 > standardCustomExtractor priority 10, so this runs first when
 * both would match the same element.
 */
export const portableCustomExtractor: ElementExtractor<ExtractedPci> = {
	id: 'qti:portable-custom-interaction',
	name: 'QTI Portable Custom Interaction',
	priority: 20,
	elementTypes: [
		'customInteraction',
		'portableCustomInteraction',
		'qti-portable-custom-interaction',
	],
	description: 'Extracts QTI 2.x/3.0 portable custom interaction module paths, markup, and config',

	canHandle(element, _context) {
		const tag = localTagName(element);
		return (
			tag === 'portablecustominteraction' ||
			tag === 'qti-portable-custom-interaction' ||
			(tag === 'custominteraction' && findDescendant(element, ['portablecustominteraction']) !== null)
		);
	},

	extract(element, context) {
		const { utils } = context;
		const outerTag = localTagName(element);
		const pciElement =
			outerTag === 'custominteraction'
				? findDescendant(element, ['portablecustominteraction'])
				: element;

		if (!pciElement) {
			throw new Error('customInteraction does not contain a portableCustomInteraction payload');
		}

		const responseIdentifier =
			utils.getAttribute(element, 'responseIdentifier') ||
			utils.getAttribute(element, 'response-identifier') ||
			context.responseId ||
			'';

		const customInteractionTypeIdentifier =
			utils.getAttribute(pciElement, 'customInteractionTypeIdentifier') ||
			utils.getAttribute(pciElement, 'custom-interaction-type-identifier') ||
			utils.getAttribute(pciElement, 'customInteractionIdentifierType') ||
			utils.getAttribute(pciElement, 'custom-interaction-identifier-type') ||
			'';

		// --- Module paths from <qti-interaction-modules>/<qti-interaction-module> ---
		// These element names ARE in the standard QTI 3.0 element mapper so utils.querySelector works.
		let primaryPath = '';
		let fallbackPath: string | undefined;

		const modulesEl = findDescendant(pciElement, ['interactionmodules', 'qti-interaction-modules']);

		if (modulesEl) {
			const moduleEl = findDescendant(modulesEl, ['interactionmodule', 'qti-interaction-module']);

			if (moduleEl) {
				primaryPath =
					utils.getAttribute(moduleEl, 'primaryPath') ||
					utils.getAttribute(moduleEl, 'primary-path') || '';
				const fb =
					utils.getAttribute(moduleEl, 'fallbackPath') ||
					utils.getAttribute(moduleEl, 'fallback-path') || '';
				if (fb) fallbackPath = fb;
			}
		}

		// QTI 2.x PCI v1.0 embeds one or more script hooks in <pci:instance>.
		// The first external script identifies the resource a host resolver must map.
		const instanceEl = findDescendant(pciElement, ['instance']);
		if (!primaryPath && instanceEl) {
			const externalScript = findDescendants(instanceEl, ['script']).find((script) =>
				Boolean(utils.getAttribute(script, 'src'))
			);
			primaryPath = externalScript ? utils.getAttribute(externalScript, 'src') : '';
		}

		// --- Markup from <qti-interaction-markup> ---
		const markupEl = findDescendant(pciElement, ['interactionmarkup', 'qti-interaction-markup']);

		// sanitizeHtml removes script hooks from the QTI 2.x instance while preserving
		// the authored DOM scaffold that the resolved module initializes.
		const markupSource = markupEl ?? instanceEl;
		const markup = markupSource ? utils.getHtmlContent(markupSource) : '';

		// --- Config from <qti-pci-properties>/<qti-pci-property> ---
		// qti-pci-properties is NOT in the standard QTI 3.0 element mapper, so we use the
		// native node-html-parser querySelector (available as element.querySelector on the raw element).
		const config: Record<string, string> = {};

		const propsEl = findDescendant(pciElement, ['pciproperties', 'qti-pci-properties']);

		if (propsEl) {
			const propEls = findDescendants(propsEl, ['pciproperty', 'qti-pci-property']);
			for (const propEl of propEls) {
				const key = utils.getAttribute(propEl, 'key') || utils.getAttribute(propEl, 'name') || '';
				const value = utils.getAttribute(propEl, 'value') || (propEl.textContent ?? '').trim() || '';
				if (key) config[key] = value;
			}
		}

		return {
			type: 'portableCustomInteraction',
			responseIdentifier,
			customInteractionTypeIdentifier,
			primaryPath,
			fallbackPath,
			markup,
			config,
		};
	},

	validate(data) {
		const errors: string[] = [];
		const warnings: string[] = [];

		if (!data.responseIdentifier) {
			errors.push('portableCustomInteraction is missing responseIdentifier');
		}
		if (!data.customInteractionTypeIdentifier) {
			warnings.push('portableCustomInteraction is missing customInteractionTypeIdentifier');
		}
		if (!data.primaryPath) {
			errors.push('portableCustomInteraction has no primaryPath in qti-interaction-modules');
		}

		return { valid: errors.length === 0, errors: errors.length ? errors : undefined, warnings: warnings.length ? warnings : undefined };
	},
};

type ExtractableElement = Parameters<typeof portableCustomExtractor.canHandle>[0];

function localTagName(element: ExtractableElement): string {
	const raw = element.rawTagName?.toLowerCase() ?? '';
	return raw.includes(':') ? raw.slice(raw.lastIndexOf(':') + 1) : raw;
}

function findDescendant(
	element: ExtractableElement,
	localNames: readonly string[]
): ExtractableElement | null {
	return findDescendants(element, localNames)[0] ?? null;
}

function findDescendants(
	element: ExtractableElement,
	localNames: readonly string[]
): ExtractableElement[] {
	const expected = new Set(localNames.map((name) => name.toLowerCase()));
	const matches: ExtractableElement[] = [];
	const visit = (parent: ExtractableElement) => {
		for (const child of parent.childNodes ?? []) {
			const candidate = child as ExtractableElement;
			if (!candidate.rawTagName) continue;
			if (expected.has(localTagName(candidate))) matches.push(candidate);
			visit(candidate);
		}
	};
	visit(element);
	return matches;
}
