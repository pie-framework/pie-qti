import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from './fixtures';
import { load as loadYaml } from 'js-yaml';

// Eval types shared by the YAML-driven runners. Each runner implements the
// `runStep` interpreter for the actions it supports; the types here are the
// union across runners.
export type EvalStep =
	| { action: 'navigate'; path: string }
	| { action: 'observe'; target?: { description?: string; hint?: string } }
	| { action: 'click'; target: { description?: string; hint?: string } }
	| { action: 'clickAt'; target?: { description?: string; hint?: string }; coordinates: { x: number; y: number } }
	| { action: 'select'; target: { description?: string; hint?: string }; value?: string; option?: { value: string } }
	| { action: 'setLocalStorage'; key: string; value: string }
	| { action: 'pressKey'; key: string; target?: { description?: string; hint?: string } }
	| { action: 'dragToGap'; target: { description?: string; hint?: string }; value: string }
	| { action: 'setValue'; target: { description?: string; hint?: string }; value: number }
	| { action: 'type'; target: { description?: string; hint?: string }; value: string }
	| { action: 'typeRichText'; target: { description?: string; hint?: string }; value: string }
	| { action: 'submit'; target?: { description?: string; hint?: string }; note?: string }
	| { action: 'dragReorder'; target: { description?: string; hint?: string } }
	| { action: 'matchPairs'; target: { description?: string; hint?: string } }
	| { action: 'clickPair'; target?: { description?: string; hint?: string }; pair?: string }
	| { action: 'dragPair'; target?: { description?: string; hint?: string }; pair?: string; times?: number }
	| {
			action: 'dragToCanvas';
			target: { description?: string; hint?: string };
			/** Canonical QTI point value(s) to place, e.g. ["105 132"]. */
			value?: string | string[];
	  }
	| { action: 'playUntilEnded'; target?: { description?: string; hint?: string }; times?: number };

export type LocalStorageMatcher = {
	equals?: string;
	isPresent?: boolean;
};

export type EvalExpected = {
	responses?: Record<string, any>;
	outcomes?: Record<string, any>;
	localStorage?: Record<string, LocalStorageMatcher>;
	assessmentResults?: {
		ui?: {
			currentQuestionTitle?: { isPresent?: boolean };
		};
	};
};

export type EvalCase = {
	id: string;
	sampleId: string;
	intent?: string;
	notes?: string[];
	steps: EvalStep[];
	expected?: EvalExpected;
	spiritChecks?: string[];
	spiritualChecks?: string[];
};

export type EvalFile = {
	version: number;
	component: { interactionType: string; tagName: string };
	examplesApp: { app: string; routeTemplate: string };
	evals: EvalCase[];
};

export function listFilesRecursive(dir: string): string[] {
	const out: string[] = [];
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) out.push(...listFilesRecursive(full));
		else out.push(full);
	}
	return out;
}

/** Load every `evals.yaml` under `docs/evals/<evalDir>`. */
export function readEvalFiles(evalDir: string): Array<{ filePath: string; data: EvalFile }> {
	const __filename = fileURLToPath(import.meta.url);
	const __dirname = path.dirname(__filename);
	const repoRoot = path.resolve(__dirname, '../../../../');
	const evalRoot = path.join(repoRoot, 'docs/evals', evalDir);
	const candidates = listFilesRecursive(evalRoot).filter((p) => p.endsWith('evals.yaml'));
	return candidates.map((filePath) => {
		const raw = fs.readFileSync(filePath, 'utf8');
		const data = loadYaml(raw) as EvalFile;
		return { filePath, data };
	});
}

/** Locale display names as they appear in the settings menu, keyed by common spellings. */
export const LOCALE_LABELS: Record<string, string> = {
	español: 'Español',
	spanish: 'Español',
	français: 'Français',
	french: 'Français',
	nederlands: 'Nederlands',
	dutch: 'Nederlands',
	română: 'Română',
	romanian: 'Română',
	ไทย: 'ไทย',
	thai: 'ไทย',
	'中文(简体)': '中文(简体)',
	'中文': '中文(简体)',
	chinese: '中文(简体)',
	العربية: 'العربية',
	arabic: 'العربية',
	'english (us)': 'English (US)',
	english: 'English (US)',
};

/**
 * Read the current `interaction`/`response` props of every `pie-qti-*` custom
 * element on the page, keyed by response identifier. ItemBody passes these
 * props as JSON strings to each custom element; depending on how Svelte sets
 * custom-element props they may be properties (preferred) or attributes.
 */
export async function getResponsesFromWebComponents(page: Page): Promise<Record<string, any>> {
	return await page.evaluate(() => {
		const els = Array.from(
			document.querySelectorAll<HTMLElement>(
				'pie-qti-choice, pie-qti-slider, pie-qti-order, pie-qti-match, pie-qti-associate, pie-qti-gap-match, pie-qti-hotspot, pie-qti-hottext, pie-qti-media, pie-qti-custom, pie-qti-end-attempt, pie-qti-position-object, pie-qti-graphic-gap-match, pie-qti-graphic-order, pie-qti-graphic-associate, pie-qti-select-point, pie-qti-extended-text',
			),
		);
		const out: Record<string, any> = {};
		for (const el of els) {
			const interactionRaw = (el as any).interaction ?? el.getAttribute('interaction');
			const responseRaw = (el as any).response ?? el.getAttribute('response');
			if (!interactionRaw) continue;
			let interaction: any;
			try {
				interaction = typeof interactionRaw === 'string' ? JSON.parse(interactionRaw) : interactionRaw;
			} catch {
				continue;
			}
			const responseId = interaction?.responseId;
			if (!responseId) continue;
			let response: any = null;
			try {
				response = typeof responseRaw === 'string' ? JSON.parse(responseRaw) : responseRaw;
			} catch {
				response = responseRaw;
			}
			out[responseId] = response;
		}
		return out;
	});
}
