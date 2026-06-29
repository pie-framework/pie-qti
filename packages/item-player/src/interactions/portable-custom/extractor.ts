import type { ElementExtractor } from '../../extraction/types.js';
import type { ExtractedPci } from '../../pci/types.js';

/**
 * Extractor for <qti-portable-custom-interaction> (QTI 3.0) and
 * <portableCustomInteraction> (QTI 2.x vendor extension).
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
		'portableCustomInteraction',
		'qti-portable-custom-interaction',
	],
	description: 'Extracts QTI 3.0 portable custom interaction module paths, markup, and config',

	canHandle(element, _context) {
		const tag = element.rawTagName?.toLowerCase() ?? '';
		return (
			tag === 'qti-portable-custom-interaction' ||
			tag === 'portablecustominteraction'
		);
	},

	extract(element, context) {
		const { utils } = context;

		const responseIdentifier = utils.getAttribute(element, 'responseIdentifier') ||
			utils.getAttribute(element, 'response-identifier') || '';

		const customInteractionTypeIdentifier =
			utils.getAttribute(element, 'customInteractionTypeIdentifier') ||
			utils.getAttribute(element, 'custom-interaction-type-identifier') || '';

		// --- Module paths from <qti-interaction-modules>/<qti-interaction-module> ---
		// These element names ARE in the standard QTI 3.0 element mapper so utils.querySelector works.
		let primaryPath = '';
		let fallbackPath: string | undefined;

		const modulesEl =
			utils.querySelector(element, 'qti-interaction-modules') ??
			utils.querySelector(element, 'interactionmodules');

		if (modulesEl) {
			const moduleEl =
				utils.querySelector(modulesEl, 'qti-interaction-module') ??
				utils.querySelector(modulesEl, 'interactionmodule');

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

		// --- Markup from <qti-interaction-markup> ---
		const markupEl =
			utils.querySelector(element, 'qti-interaction-markup') ??
			utils.querySelector(element, 'interactionmarkup');

		const markup = markupEl ? utils.getHtmlContent(markupEl) : '';

		// --- Config from <qti-pci-properties>/<qti-pci-property> ---
		// qti-pci-properties is NOT in the standard QTI 3.0 element mapper, so we use the
		// native node-html-parser querySelector (available as element.querySelector on the raw element).
		const config: Record<string, string> = {};

		const rawEl = element as any;
		const propsEl =
			rawEl.querySelector?.('qti-pci-properties') ??
			rawEl.querySelector?.('pciproperties');

		if (propsEl) {
			const propEls: any[] = [
				...(propsEl.querySelectorAll?.('qti-pci-property') ?? []),
				...(propsEl.querySelectorAll?.('pciproperty') ?? []),
			];
			for (const propEl of propEls) {
				const key = propEl.getAttribute?.('key') || propEl.getAttribute?.('name') || '';
				const value = propEl.getAttribute?.('value') || (propEl.textContent ?? '').trim() || '';
				if (key) config[key] = value;
			}
		}

		return {
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
