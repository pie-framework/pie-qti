import type { PnpProfile } from '@pie-qti/item-player';
import type { QtiSectionToolConfig } from '../contracts/index.js';

export type QtiCalculatorType = 'basic' | 'scientific' | 'graphing';

/** The materials an item's `companionMaterialsInfo` lists, as section tools. */
export interface QtiCompanionMaterials {
	calculator?: { type?: QtiCalculatorType };
	ruler?: boolean;
	protractor?: boolean;
}

const COMPANION_BLOCK =
	/<(qti-companion-materials-info|companionMaterialsInfo)\b[^>]*>([\s\S]*?)<\/\1\s*>/;

/** QTI's calculator types onto the calculator tool's; `standard` is a four-function calculator. */
const CALCULATOR_TYPES: Readonly<Record<string, QtiCalculatorType>> = {
	basic: 'basic',
	standard: 'basic',
	scientific: 'scientific',
	graphing: 'graphing',
};

function hasElement(markup: string, qti2: string, qti3: string): boolean {
	return new RegExp(`<(?:${qti2}|${qti3})[\\s/>]`).test(markup);
}

/**
 * The companion materials of a QTI 2.2 or 3.0 item: `calculator`, `rule` and `protractor`.
 * Returns `undefined` when the item lists none of them.
 */
export function companionMaterialsOf(itemXml: string): QtiCompanionMaterials | undefined {
	const block = COMPANION_BLOCK.exec(itemXml)?.[2];
	if (!block) return undefined;

	const materials: QtiCompanionMaterials = {};
	if (hasElement(block, 'calculator', 'qti-calculator')) {
		const type = /<(?:calculatorType|qti-calculator-type)\b[^>]*>([^<]*)</.exec(block)?.[1];
		const calculatorType = type ? CALCULATOR_TYPES[type.trim().toLowerCase()] : undefined;
		materials.calculator = calculatorType ? { type: calculatorType } : {};
	}
	if (hasElement(block, 'rule', 'qti-rule')) materials.ruler = true;
	if (hasElement(block, 'protractor', 'qti-protractor')) materials.protractor = true;
	return Object.keys(materials).length > 0 ? materials : undefined;
}

function companionGrants(materials: QtiCompanionMaterials | undefined, toolId: string): boolean {
	if (!materials) return false;
	if (toolId === 'calculator') return materials.calculator !== undefined;
	if (toolId === 'ruler') return materials.ruler === true;
	if (toolId === 'protractor') return materials.protractor === true;
	return false;
}

function calculatorTypeOf(value: unknown): QtiCalculatorType | undefined {
	return typeof value === 'string' ? CALCULATOR_TYPES[value] : undefined;
}

function finiteNumber(value: unknown): number | undefined {
	return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/**
 * Apply the candidate's PNP tool supports and the item's companion materials to the
 * host's tools. A tool the host offers with `enabled: false` turns on when the PNP
 * supports it or the companion materials list it. A prohibited support is removed, and
 * a `screenReader` support without `textToSpeech` withholds read-aloud. Parameters fill
 * what the host leaves unset: the calculator type from the companion materials, then
 * the PNP; the read-aloud rate and pitch from the PNP.
 */
export function applyToolSupports(
	tools: QtiSectionToolConfig[] | undefined,
	pnp: PnpProfile | undefined,
	materials?: QtiCompanionMaterials,
): QtiSectionToolConfig[] | undefined {
	if (!tools || (!pnp?.tools && !materials)) return tools;
	const supports = new Set(pnp?.tools?.supports ?? []);
	const prohibited = new Set(pnp?.tools?.prohibitedSupports ?? []);
	const parameters = pnp?.tools?.toolParameters ?? {};
	const withholdsReadAloud = supports.has('screenReader') && !supports.has('textToSpeech');

	const resolved: QtiSectionToolConfig[] = [];
	for (const tool of tools) {
		const toolId = String(tool.toolId);
		if (prohibited.has(toolId)) continue;
		if (toolId === 'textToSpeech' && withholdsReadAloud) continue;

		let next = tool;
		if (tool.enabled === false && (supports.has(toolId) || companionGrants(materials, toolId))) {
			next = { ...next, enabled: true };
		}
		if (toolId === 'calculator' && next.renderParams?.calculatorType === undefined) {
			const type = materials?.calculator?.type ?? calculatorTypeOf(parameters.calculator?.type);
			if (type) next = { ...next, renderParams: { ...(next.renderParams ?? {}), calculatorType: type } };
		}
		if (toolId === 'textToSpeech') {
			const rate = finiteNumber(parameters.textToSpeech?.rate);
			const pitch = finiteNumber(parameters.textToSpeech?.pitch);
			const provider = next.provider ?? {};
			const fill = {
				...(rate !== undefined && provider.rate === undefined ? { rate } : {}),
				...(pitch !== undefined && provider.pitch === undefined ? { pitch } : {}),
			};
			if (Object.keys(fill).length > 0) next = { ...next, provider: { ...provider, ...fill } };
		}
		resolved.push(next);
	}
	return resolved;
}
