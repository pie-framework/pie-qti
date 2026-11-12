/**
 * Validation golden for acme-likert: what response validation reports for an interaction this
 * vendor plugin delivers as a standard `choiceInteraction` carrying its own data, pinned so that
 * reorganizing the item-player session engine can prove it changes nothing for vendor overrides.
 * It is the downstream counterpart of item-player's `tests/core/validation-golden.test.ts`, which
 * covers the conformance fixtures and a vendor `outputType`.
 *
 * Validation is read through the public session API only, for each probe's responses:
 * `canSubmit`; the validation a suspended attempt reports (entries and issues); and the end-attempt
 * gate (`endAttempt` with `validateResponses`), which reports an incomplete required response only
 * when the responses count as attempted. The second item pairs the Likert scale with a required
 * standard interaction, so whether a Likert answer counts as attempted shows in the gate.
 *
 * Entries read `interactionType, required|optional, complete|incomplete, valid|invalid`, followed
 * by their errors. After an intended change, regenerate the golden and review the diff:
 *
 *     UPDATE_VALIDATION_GOLDEN=1 bun test tests/validation-golden.test.ts
 */

import './setup.js';
import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
	createAssessmentItemDefinition,
	type ItemSession,
	type ResponseValidationResult,
} from '@pie-qti/item-player';
import { likertScalePlugin } from '../src/index.js';

const GOLDEN_PATH = join(import.meta.dir, 'validation-golden.json');
const UPDATE = process.env.UPDATE_VALIDATION_GOLDEN === '1';

const LIKERT = `<choiceInteraction responseIdentifier="RESPONSE">
      <prompt>The instructions were clear.</prompt>
      <likertChoice identifier="strongly_disagree">Strongly Disagree</likertChoice>
      <likertChoice identifier="disagree">Disagree</likertChoice>
      <likertChoice identifier="neutral">Neutral</likertChoice>
      <likertChoice identifier="agree">Agree</likertChoice>
      <likertChoice identifier="strongly_agree">Strongly Agree</likertChoice>
    </choiceInteraction>`;

function item(identifier: string, declarations: string, body: string): string {
	return `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="${identifier}" title="${identifier}" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
  ${declarations}
  <itemBody>
    ${body}
  </itemBody>
</assessmentItem>`;
}

const ITEMS: Record<string, { itemXml: string; probes: Record<string, Record<string, unknown>> }> = {
	likert: {
		itemXml: item('golden-likert', '', LIKERT),
		probes: {
			'(no responses)': {},
			'a level chosen': { RESPONSE: 'agree' },
			'an identifier that is not a level': { RESPONSE: 'not_a_level' },
		},
	},
	likertWithRequiredFollowUp: {
		itemXml: item(
			'golden-likert-follow-up',
			'<responseDeclaration identifier="FOLLOW_UP" cardinality="single" baseType="identifier"/>',
			`${LIKERT}
    <choiceInteraction responseIdentifier="FOLLOW_UP" minChoices="1" maxChoices="1">
      <prompt>Would you take this course again?</prompt>
      <simpleChoice identifier="yes">Yes</simpleChoice>
      <simpleChoice identifier="no">No</simpleChoice>
    </choiceInteraction>`,
		),
		probes: {
			'(no responses)': {},
			'only the Likert scale answered': { RESPONSE: 'agree' },
			'only the follow-up answered': { FOLLOW_UP: 'yes' },
			'both answered': { RESPONSE: 'agree', FOLLOW_UP: 'yes' },
		},
	},
};

function entriesOf(validation: ResponseValidationResult | undefined): Record<string, string | string[]> {
	const entries = validation?.entries ?? {};
	return Object.fromEntries(
		Object.keys(entries)
			.sort()
			.map((id) => {
				const entry = entries[id]!;
				const summary = [
					entry.interactionType,
					entry.required ? 'required' : 'optional',
					entry.complete ? 'complete' : 'incomplete',
					entry.valid ? 'valid' : 'invalid',
				].join(', ');
				const details = [
					...[...entry.errors].sort().map((error) => `error: ${error}`),
					...[...entry.warnings].sort().map((warning) => `warning: ${warning}`),
				];
				return [id, details.length > 0 ? [summary, ...details] : summary];
			}),
	);
}

function issueCodes(validation: ResponseValidationResult | undefined): string[] {
	return (validation?.issues ?? []).map((issue) => `${issue.responseId} ${issue.code}`).sort();
}

function withSession<T>(itemXml: string, responses: Record<string, unknown>, run: (session: ItemSession) => T): T {
	const session = createAssessmentItemDefinition({ itemXml, plugins: [likertScalePlugin] }).openSession({ responses });
	try {
		return run(session);
	} finally {
		session.dispose();
	}
}

function recordProbe(itemXml: string, responses: Record<string, unknown>): Record<string, unknown> {
	const suspended = withSession(itemXml, responses, (session) => ({
		canSubmit: session.state().canSubmit,
		validation: session.dispatch({ action: 'suspendAttempt' }).result?.validation,
	}));
	const gate = withSession(
		itemXml,
		responses,
		(session) => session.dispatch({ action: 'endAttempt', validateResponses: true }).result?.validation,
	);
	return {
		canSubmit: suspended.canSubmit,
		entries: entriesOf(suspended.validation),
		issues: issueCodes(suspended.validation),
		gate: { entries: entriesOf(gate), issues: issueCodes(gate) },
	};
}

/** One `path › to › leaf: value` line per leaf, so a failing comparison shows where it changed. */
function flatten(value: unknown, path: string[] = [], out: string[] = []): string[] {
	if (value && typeof value === 'object' && !Array.isArray(value)) {
		for (const key of Object.keys(value as Record<string, unknown>).sort()) {
			flatten((value as Record<string, unknown>)[key], [...path, key], out);
		}
	} else {
		out.push(`${path.join(' › ')}: ${JSON.stringify(value)}`);
	}
	return out;
}

function sortDeep(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(sortDeep);
	if (value && typeof value === 'object') {
		return Object.fromEntries(
			Object.keys(value as Record<string, unknown>)
				.sort()
				.map((key) => [key, sortDeep((value as Record<string, unknown>)[key])]),
		);
	}
	return value;
}

describe('acme-likert validation golden', () => {
	test('validation of Likert-delivered choice interactions is unchanged', () => {
		const actual = Object.fromEntries(
			Object.entries(ITEMS).map(([name, { itemXml, probes }]) => [
				name,
				Object.fromEntries(
					Object.entries(probes).map(([probe, responses]) => [probe, recordProbe(itemXml, responses)]),
				),
			]),
		);
		if (UPDATE) {
			writeFileSync(GOLDEN_PATH, `${JSON.stringify(sortDeep(actual), null, 2)}\n`);
			return;
		}
		if (!existsSync(GOLDEN_PATH)) {
			throw new Error('No golden: generate it with UPDATE_VALIDATION_GOLDEN=1 bun test tests/validation-golden.test.ts');
		}
		const golden = JSON.parse(readFileSync(GOLDEN_PATH, 'utf8')) as unknown;
		expect(flatten(sortDeep(actual))).toEqual(flatten(golden));
	});
});
