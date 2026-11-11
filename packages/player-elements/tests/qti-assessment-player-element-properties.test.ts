import './setup';
import { describe, expect, test } from 'bun:test';
import type { BackendAdapter } from '@pie-qti/assessment-player';
import type { AssessmentItemDefinitionPlugin, PnpProfile, QTIRole } from '@pie-qti/item-player';
import { QtiAssessmentPlayerElement } from '../src/elements/QtiAssessmentPlayerElement.js';

const backend: BackendAdapter = {
	async initSession(request) {
		return {
			sessionId: 'session-1',
			assessment: {
				identifier: request.assessmentId,
				title: 'Properties assessment',
				navigationMode: 'nonlinear',
				submissionMode: 'simultaneous',
				testParts: [],
			},
		};
	},
	async submitResponses() {
		return { success: true };
	},
	async saveState() {
		return { success: true, savedAt: Date.now() };
	},
	async finalizeAssessment() {
		return { success: true, totalScore: 0, maxScore: 0, itemScores: {}, finalizedAt: Date.now() };
	},
};

class TestPropertiesElement extends QtiAssessmentPlayerElement {
	protected override _mountOrUpdate() {}

	exposeConfig(): Record<string, unknown> {
		return (this.getProps() as { config: Record<string, unknown> }).config;
	}
}

const TEST_TAG = 'test-qti-assessment-player-properties';
if (!customElements.get(TEST_TAG)) {
	customElements.define(TEST_TAG, TestPropertiesElement);
}

function createElement(): TestPropertiesElement {
	return document.createElement(TEST_TAG) as TestPropertiesElement;
}

const i18n = { t: (key: string) => key };
const pnp: PnpProfile = { display: { colorScheme: 'dark' } };
const plugins: readonly AssessmentItemDefinitionPlugin[] = [
	{ kind: 'assessment-item-definition-plugin', name: 'test-plugin', version: '1.0.0' },
];
const stringComparison = { foldScriptInput: true } as const;

describe('per-item injection properties forward into the built config', () => {
	test('each property lands on the config field the shell receives', () => {
		const element = createElement();
		element.backend = backend;
		element.initSession = { assessmentId: 'assessment-1', candidateId: 'candidate-1' };
		element.role = 'proctor';
		element.i18n = i18n;
		element.pnp = pnp;
		element.plugins = plugins;
		element.stringComparison = stringComparison;

		const config = element.exposeConfig();
		expect(config.role).toBe('proctor');
		expect(config.i18nProvider).toBe(i18n);
		expect(config.pnp).toBe(pnp);
		expect(config.plugins).toBe(plugins);
		expect(config.stringComparison).toBe(stringComparison);
	});

	test('a property wins over the same-named config field; config is the fallback when unset', () => {
		const element = createElement();
		element.backend = backend;
		element.initSession = { assessmentId: 'assessment-1', candidateId: 'candidate-1' };
		element.config = {
			role: 'scorer',
			i18nProvider: i18n,
			pnp,
			plugins,
			stringComparison,
		};

		// No properties set: the config fields flow through.
		const fromConfig = element.exposeConfig();
		expect(fromConfig.role).toBe('scorer');
		expect(fromConfig.i18nProvider).toBe(i18n);
		expect(fromConfig.pnp).toBe(pnp);
		expect(fromConfig.plugins).toBe(plugins);
		expect(fromConfig.stringComparison).toBe(stringComparison);

		// The property overrides its config field.
		const elementI18n = { t: (key: string) => `element:${key}` };
		element.role = 'tutor';
		element.i18n = elementI18n;
		const overridden = element.exposeConfig();
		expect(overridden.role).toBe('tutor');
		expect(overridden.i18nProvider).toBe(elementI18n);
		expect(overridden.pnp).toBe(pnp);
	});

	test('unset properties leave the config fields absent and role reads null', () => {
		const element = createElement();
		element.backend = backend;
		element.initSession = { assessmentId: 'assessment-1', candidateId: 'candidate-1' };

		expect(element.role).toBeNull();
		expect(element.i18n).toBeUndefined();
		expect(element.pnp).toBeUndefined();
		expect(element.plugins).toBeUndefined();
		expect(element.stringComparison).toBeUndefined();
		const config = element.exposeConfig();
		expect('role' in config && config.role !== undefined).toBe(false);
		expect('i18nProvider' in config && config.i18nProvider !== undefined).toBe(false);
		expect('pnp' in config && config.pnp !== undefined).toBe(false);
		expect('plugins' in config && config.plugins !== undefined).toBe(false);
		expect('stringComparison' in config && config.stringComparison !== undefined).toBe(false);
	});
});

describe('the qti-role attribute', () => {
	test('parses into the role property and the built config', () => {
		const element = createElement();
		element.backend = backend;
		element.initSession = { assessmentId: 'assessment-1', candidateId: 'candidate-1' };

		element.attributeChangedCallback('qti-role', null, 'proctor');
		expect(element.role).toBe<QTIRole | null>('proctor');
		expect(element.exposeConfig().role).toBe('proctor');

		element.attributeChangedCallback('qti-role', 'proctor', null);
		expect(element.role).toBeNull();
	});

	test('an unknown value warns and renders the candidate view, not the unknown role', () => {
		const element = createElement();
		element.backend = backend;
		element.initSession = { assessmentId: 'assessment-1', candidateId: 'candidate-1' };
		const warnings: string[] = [];
		const originalWarn = console.warn;
		console.warn = (message: unknown) => warnings.push(String(message));
		try {
			element.attributeChangedCallback('qti-role', null, 'administrator');
		} finally {
			console.warn = originalWarn;
		}

		expect(element.role).toBeNull();
		expect(element.exposeConfig().role).toBeUndefined();
		expect(warnings).toHaveLength(1);
		expect(warnings[0]).toContain('qti-role');
		expect(warnings[0]).toContain('administrator');
	});

	test('the role property reflects the qti-role attribute', () => {
		const element = createElement();

		element.role = 'scorer';
		expect(element.getAttribute('qti-role')).toBe('scorer');
		expect(element.role).toBe<QTIRole | null>('scorer');

		element.role = null;
		expect(element.getAttribute('qti-role')).toBeNull();
		expect(element.role).toBeNull();
	});
});
