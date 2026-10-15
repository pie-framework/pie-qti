/**
 * Test structure and item session control: the backend draws selection and ordering at session
 * start, resolves the itemSessionControl cascade, enforces attempts and comments, and navigates by
 * branch rules and preconditions; the player applies feedback, solution, template defaults and
 * expired time limits. Every case runs on a QTI 2.2 assessmentTest and its QTI 3.0 twin.
 */

import './setup';
import { afterEach, describe, expect, test } from 'bun:test';
import { convertQti2ToQti3 } from '@pie-qti/qti-common';
import { AssessmentPlayer } from '../src/core/AssessmentPlayer.js';
import {
	DEFAULT_ITEM_SESSION_CONTROL,
	deliveredItems,
	drawAssessment,
	resolveItemSessionControl,
} from '../src/core/testStructure.js';
import { TimeManager } from '../src/core/TimeManager.js';
import { ReferenceBackendAdapter } from '../src/integration/ReferenceBackendAdapter.js';

const NS = 'xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"';

/** A choice item keyed A that sets SCORE 1 and FEEDBACK `correct` on a correct response. */
const choiceItem = (identifier: string, { adaptive = false } = {}) =>
	`<assessmentItem ${NS} identifier="${identifier}" title="${identifier}" adaptive="${adaptive}" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"><correctResponse><value>A</value></correctResponse></responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"><defaultValue><value>0</value></defaultValue></outcomeDeclaration>
  <outcomeDeclaration identifier="FEEDBACK" cardinality="single" baseType="identifier"/>
  <itemBody>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1"><simpleChoice identifier="A">A</simpleChoice><simpleChoice identifier="B">B</simpleChoice></choiceInteraction>
    <p><feedbackInline outcomeIdentifier="FEEDBACK" identifier="correct" showHide="show">Well done</feedbackInline></p>
  </itemBody>
  <responseProcessing>
    <responseCondition><responseIf>
      <match><variable identifier="RESPONSE"/><correct identifier="RESPONSE"/></match>
      <setOutcomeValue identifier="SCORE"><baseValue baseType="float">1</baseValue></setOutcomeValue>
      <setOutcomeValue identifier="FEEDBACK"><baseValue baseType="identifier">correct</baseValue></setOutcomeValue>
    </responseIf></responseCondition>
  </responseProcessing>
</assessmentItem>`;

const templatedItem = (identifier: string) =>
	`<assessmentItem ${NS} identifier="${identifier}" title="${identifier}" adaptive="false" timeDependent="false">
  <templateDeclaration identifier="N" cardinality="single" baseType="integer"><defaultValue><value>1</value></defaultValue></templateDeclaration>
  <templateDeclaration identifier="DOUBLE" cardinality="single" baseType="integer"/>
  <templateProcessing>
    <setTemplateValue identifier="DOUBLE"><product><variable identifier="N"/><baseValue baseType="integer">2</baseValue></product></setTemplateValue>
  </templateProcessing>
  <itemBody><p>Value <printedVariable identifier="DOUBLE"/></p></itemBody>
</assessmentItem>`;

const ref = (identifier: string, inner = '', attrs = '') =>
	`<assessmentItemRef identifier="${identifier}" href="${identifier}.xml" ${attrs}>${inner}</assessmentItemRef>`;
const section = (identifier: string, inner: string, attrs = '') =>
	`<assessmentSection identifier="${identifier}" title="${identifier}" visible="true" ${attrs}>${inner}</assessmentSection>`;
const part = (identifier: string, inner: string, navigationMode = 'linear') =>
	`<testPart identifier="${identifier}" navigationMode="${navigationMode}" submissionMode="individual">${inner}</testPart>`;
const assessmentTest = (inner: string) =>
	`<assessmentTest ${NS} identifier="structure-test" title="Structure test">${inner}</assessmentTest>`;
const scoreAtLeastOne = (variable: string) =>
	`<gte><variable identifier="${variable}"/><baseValue baseType="float">1</baseValue></gte>`;

const VERSIONS = {
	'QTI 2.2': (xml: string) => xml,
	'QTI 3.0': (xml: string) => convertQti2ToQti3(xml),
};
type Version = keyof typeof VERSIONS;

afterEach(() => localStorage.clear());

async function deliver(
	version: Version,
	testXml: string,
	items: Record<string, string>,
	{ rng }: { rng?: () => number } = {},
) {
	const convert = VERSIONS[version];
	const parsed = await ReferenceBackendAdapter.parseAssessmentTestXml(convert(testXml), {
		itemXmlMap: Object.fromEntries(Object.entries(items).map(([id, xml]) => [`${id}.xml`, convert(xml)])),
	});
	const backend = new ReferenceBackendAdapter({ rng });
	backend.registerAssessment(parsed.identifier, parsed);
	const init = await backend.initSession({ assessmentId: parsed.identifier, candidateId: 'candidate' });
	const submit = (itemIdentifier: string, RESPONSE = 'A', comment?: string) =>
		backend.submitResponses({
			sessionId: init.sessionId,
			itemIdentifier,
			responses: { RESPONSE },
			submittedAt: Date.now(),
			comment,
		});
	return { parsed, backend, init, submit };
}

async function player(version: Version, testXml: string, items: Record<string, string>) {
	const { backend, parsed } = await deliver(version, testXml, items);
	localStorage.clear();
	return AssessmentPlayer.create({
		backend,
		initSession: { assessmentId: parsed.identifier, candidateId: 'player' },
	});
}

/** Walks the backend's navigation, answering each item from `answers` (default A). */
async function walk(delivery: Awaited<ReturnType<typeof deliver>>, answers: Record<string, string> = {}) {
	const visited: string[] = [];
	let next: string | undefined = delivery.init.currentItemIdentifier;
	let last: string | undefined;
	while (next && !next.startsWith('EXIT_')) {
		visited.push(next);
		const res = await delivery.submit(next, answers[next] ?? 'A');
		expect(res.success).toBe(true);
		next = res.nextItemIdentifier;
		last = next;
	}
	return { visited, end: last };
}

const items = (...ids: string[]) => Object.fromEntries(ids.map((id) => [id, choiceItem(id)]));

describe.each(Object.keys(VERSIONS) as Version[])('%s item session control', (version) => {
	test('cascades from the test part through each section to the item ref, over QTI defaults', async () => {
		const xml = assessmentTest(
			part(
				'part-1',
				`<itemSessionControl maxAttempts="3" showFeedback="true"/>
				${section(
					'outer',
					`<itemSessionControl maxAttempts="2"/>
					${section(
						'inner',
						`<itemSessionControl allowComment="true"/>
						${ref('i1', '<itemSessionControl maxAttempts="4"/>')}
						${ref('i2')}`,
					)}`,
				)}`,
			) + part('part-2', section('plain', ref('i3'))),
		);
		const { parsed } = await deliver(version, xml, items('i1', 'i2', 'i3'));
		const control = Object.fromEntries(
			deliveredItems(parsed).map((d) => [d.item.identifier, resolveItemSessionControl(d.testPart, d.sections, d.item)]),
		);

		expect(control.i1).toMatchObject({ maxAttempts: 4, showFeedback: true, allowComment: true });
		expect(control.i2).toMatchObject({ maxAttempts: 2, showFeedback: true, allowComment: true });
		expect(control.i3).toEqual({ ...DEFAULT_ITEM_SESSION_CONTROL });
	});

	test('rejects a submission past maxAttempts; an adaptive item allows unlimited attempts', async () => {
		const xml = assessmentTest(part('part-1', section('s1', ref('i1') + ref('adaptive')), 'nonlinear'));
		const delivery = await deliver(version, xml, { i1: choiceItem('i1'), adaptive: choiceItem('adaptive', { adaptive: true }) });

		expect((await delivery.submit('i1')).success).toBe(true);
		expect(await delivery.submit('i1')).toMatchObject({ success: false, error: 'Maximum attempts reached' });
		for (let attempt = 0; attempt < 3; attempt++) {
			expect((await delivery.submit('adaptive', 'B')).success).toBe(true);
		}
	});

	test('stores comments where allowComment is set and rejects them elsewhere', async () => {
		const xml = assessmentTest(
			part('part-1', section('s1', ref('i1', '<itemSessionControl allowComment="true"/>') + ref('i2')), 'nonlinear'),
		);
		const delivery = await deliver(version, xml, items('i1', 'i2'));

		const accepted = await delivery.submit('i1', 'A', 'The wording is unclear');
		expect(accepted.success).toBe(true);
		expect(accepted.updatedState?.itemComments).toEqual({ i1: 'The wording is unclear' });
		expect(await delivery.submit('i2', 'A', 'No')).toMatchObject({
			success: false,
			error: 'Comments are not allowed for this item',
		});
	});

	test('the player sends a comment with the submission and refuses one the item does not allow', async () => {
		const xml = assessmentTest(
			part('part-1', section('s1', ref('i1', '<itemSessionControl allowComment="true"/>') + ref('i2')), 'nonlinear'),
		);
		const p = await player(version, xml, items('i1', 'i2'));
		expect(p.getItemSessionInfo()?.canComment).toBe(true);
		p.setItemComment('Please check option B');
		await p.submitCurrentItem();
		expect(p.getItemComment('i1')).toBe('Please check option B');
		expect(() => p.setItemComment('No', 'i2')).toThrow('Comments are not allowed for item "i2".');
		p.destroy();
	});

	test('next() moves past an item whose attempts are used up without submitting it again', async () => {
		const xml = assessmentTest(part('part-1', section('s1', ref('i1') + ref('i2') + ref('i3')), 'nonlinear'));
		const p = await player(version, xml, items('i1', 'i2', 'i3'));
		await p.submitCurrentItem();
		await p.navigateTo(0);
		expect(p.getItemSessionInfo()?.canSubmit).toBe(false);
		await p.next();
		expect(p.getCurrentItem()?.identifier).toBe('i2');
		p.destroy();
	});
});

describe.each(Object.keys(VERSIONS) as Version[])('%s selection and ordering', (version) => {
	test('draws once at session start: required children kept, repeats cloned, resume returns the same draw', async () => {
		const xml = assessmentTest(
			part(
				'part-1',
				section(
					's1',
					`<selection select="4" withReplacement="true"/>${ref('i1', '', 'required="true"')}${ref('i2')}`,
				),
			),
		);
		const delivery = await deliver(version, xml, items('i1', 'i2'), { rng: () => 0.99 });
		const ids = deliveredItems(delivery.init.assessment).map((d) => d.item.identifier);

		expect(ids).toHaveLength(4);
		expect(ids).toContain('i1');
		expect(new Set(ids).size).toBe(4);
		for (const id of ids) expect(id).toMatch(/^i[12](\.\d+)?$/);
		expect(delivery.init.assessment.testParts[0].sections[0].selection).toBeUndefined();
		expect(drawAssessment(delivery.init.assessment, Math.random)).toEqual(delivery.init.assessment);

		const clone = ids.find((id) => id.includes('.'))!;
		expect((await delivery.submit(clone)).success).toBe(true);
		const resumed = await delivery.backend.resumeSession?.(delivery.init.sessionId);
		expect(deliveredItems(resumed!.assessment).map((d) => d.item.identifier)).toEqual(ids);
	});

	test('mixes an invisible keepTogether="false" section into its parent shuffle', async () => {
		const shuffledIds = async (keepTogether: string, seed: number) => {
			let state = seed;
			const rng = () => {
				state = (state * 16807) % 2147483647;
				return (state - 1) / 2147483646;
			};
			const xml = assessmentTest(
				part(
					'part-1',
					section(
						'parent',
						`<ordering shuffle="true"/>${ref('i1')}<assessmentSection identifier="sub" title="sub" visible="false" ${keepTogether}>${ref('i2')}${ref('i3')}</assessmentSection>${ref('i4')}`,
					),
				),
			);
			const delivery = await deliver(version, xml, items('i1', 'i2', 'i3', 'i4'), { rng });
			localStorage.clear();
			return deliveredItems(delivery.init.assessment).map((d) => d.item.identifier);
		};
		const apart = (ids: string[]) => Math.abs(ids.indexOf('i2') - ids.indexOf('i3')) > 1;
		const seeds = Array.from({ length: 12 }, (_, i) => i + 1);

		const together = await Promise.all(seeds.map((seed) => shuffledIds('', seed)));
		const mixed = await Promise.all(seeds.map((seed) => shuffledIds('keepTogether="false"', seed)));
		expect(together.some(apart)).toBe(false);
		expect(mixed.some(apart)).toBe(true);
		for (const ids of mixed) expect([...ids].sort()).toEqual(['i1', 'i2', 'i3', 'i4']);
	});
});

describe.each(Object.keys(VERSIONS) as Version[])('%s branch rules and preconditions', (version) => {
	const branching = (navigationMode: string) =>
		assessmentTest(
			part(
				'part-1',
				`<branchRule target="EXIT_TEST">${scoreAtLeastOne('i6.SCORE')}</branchRule>
				${section('s1', `<branchRule target="s3">${scoreAtLeastOne('i2.SCORE')}</branchRule>${ref('i1')}${ref('i2')}`)}
				${section('s2', ref('i3'))}
				${section(
					's3',
					section('s3a', ref('i4', '<branchRule target="EXIT_SECTION"><baseValue baseType="boolean">true</baseValue></branchRule>') + ref('i5')) +
						ref('i6'),
				)}`,
				navigationMode,
			) + part('part-2', section('s4', ref('i7'))),
		);
	const ITEMS = items('i1', 'i2', 'i3', 'i4', 'i5', 'i6', 'i7');

	test('applies section and test part rules and EXIT_SECTION in a linear part', async () => {
		const taken = await walk(await deliver(version, branching('linear'), ITEMS));
		expect(taken).toEqual({ visited: ['i1', 'i2', 'i4', 'i6'], end: 'EXIT_TEST' });
	});

	test('falls through to the next item when no rule matches', async () => {
		localStorage.clear();
		const taken = await walk(await deliver(version, branching('linear'), ITEMS), { i2: 'B', i6: 'B' });
		expect(taken).toEqual({ visited: ['i1', 'i2', 'i3', 'i4', 'i6', 'i7'], end: undefined });
	});

	test('ignores item and section rules in a nonlinear part but applies the test part rule', async () => {
		const taken = await walk(await deliver(version, branching('nonlinear'), ITEMS));
		expect(taken).toEqual({ visited: ['i1', 'i2', 'i3', 'i4', 'i5', 'i6'], end: 'EXIT_TEST' });
	});

	const preconditions = assessmentTest(
		part(
			'part-1',
			section(
				's1',
				`${ref('i1')}${section('s2', `<preCondition>${scoreAtLeastOne('i1.SCORE')}</preCondition>${ref('i2')}`)}
				${ref('i3', `<preCondition>${scoreAtLeastOne('i1.SCORE')}</preCondition>`)}${ref('i4')}`,
			),
		) + part('part-2', `<preCondition>${scoreAtLeastOne('i1.SCORE')}</preCondition>${section('s3', ref('i5'))}`),
	);
	const PRE_ITEMS = items('i1', 'i2', 'i3', 'i4', 'i5');

	test('delivers every item whose preconditions hold', async () => {
		const taken = await walk(await deliver(version, preconditions, PRE_ITEMS));
		expect(taken).toEqual({ visited: ['i1', 'i2', 'i3', 'i4', 'i5'], end: undefined });
	});

	test('skips a section, an item and a test part whose preconditions fail, ending the test early', async () => {
		const taken = await walk(await deliver(version, preconditions, PRE_ITEMS), { i1: 'B' });
		expect(taken).toEqual({ visited: ['i1', 'i4'], end: 'EXIT_TEST' });
	});

	test('a new session starts at the first item whose preconditions hold', async () => {
		const xml = assessmentTest(
			part(
				'part-1',
				section('s1', ref('i1', '<preCondition><baseValue baseType="boolean">false</baseValue></preCondition>') + ref('i2')),
			),
		);
		const p = await player(version, xml, items('i1', 'i2'));
		expect(p.getCurrentItem()?.identifier).toBe('i2');
		p.destroy();
	});

	test('a variable mapping renames an item variable for test-level expressions', async () => {
		const xml = assessmentTest(
			part(
				'part-1',
				section(
					's1',
					ref(
						'i1',
						`<branchRule target="i3">${scoreAtLeastOne('i1.POINTS')}</branchRule><variableMapping sourceIdentifier="SCORE" targetIdentifier="POINTS"/>`,
					) +
						ref('i2') +
						ref('i3'),
				),
			),
		);
		const taken = await walk(await deliver(version, xml, items('i1', 'i2', 'i3')));
		expect(taken.visited).toEqual(['i1', 'i3']);
	});
});

describe.each(Object.keys(VERSIONS) as Version[])('%s delivery in the player', (version) => {
	const flowHtml = (p: AssessmentPlayer) =>
		p
			.getCurrentItemSession()!
			.present()
			.flow.filter((node) => node.kind === 'html')
			.map((node) => (node.kind === 'html' ? String(node.html) : ''))
			.join('');

	test('a template default set from a test outcome reaches template processing', async () => {
		const xml = assessmentTest(
			`<outcomeDeclaration identifier="LEVEL" cardinality="single" baseType="integer"><defaultValue><value>5</value></defaultValue></outcomeDeclaration>
			${part('part-1', section('s1', ref('t1', '<templateDefault templateIdentifier="N"><variable identifier="LEVEL"/></templateDefault>')))}`,
		);
		const p = await player(version, xml, { t1: templatedItem('t1') });
		expect(flowHtml(p)).toContain('10');
		p.destroy();
	});

	test('showFeedback false hides integrated feedback after the attempt; true shows it with the solution', async () => {
		const single = (control: string) =>
			assessmentTest(part('part-1', `${control}${section('s1', ref('i1'))}`, 'nonlinear'));

		const hidden = await player(version, single(''), items('i1'));
		hidden.updateResponse('RESPONSE', 'A');
		await hidden.submitCurrentItem();
		expect(flowHtml(hidden)).not.toContain('Well done');
		expect(hidden.getCurrentItemSession()!.present().correctResponses).toEqual({});
		hidden.destroy();

		const shown = await player(version, single('<itemSessionControl showFeedback="true" showSolution="true"/>'), items('i1'));
		shown.updateResponse('RESPONSE', 'A');
		await shown.submitCurrentItem();
		expect(flowHtml(shown)).toContain('Well done');
		expect(shown.getCurrentItemSession()!.present().correctResponses).toEqual({ RESPONSE: 'A' });
		shown.destroy();
	});

	test('an expired section limit closes its items and moves delivery past them', async () => {
		const xml = assessmentTest(
			part('part-1', section('s1', ref('i1') + ref('i2')) + section('s2', ref('i3')), 'nonlinear'),
		);
		const p = await player(version, xml, items('i1', 'i2', 'i3'));
		let expired = 0;
		p.onTimeExpired(() => expired++);
		const expire = (scope: 'testPart' | 'section' | 'item', identifier: string) =>
			(p as unknown as { handleScopeExpired(scope: string, id: string): void }).handleScopeExpired(scope, identifier);

		expire('section', 's1');
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(p.getCurrentItem()?.identifier).toBe('i3');
		expect(p.getNavigationState().canPrevious).toBe(false);
		await expect(p.navigateTo(0)).rejects.toThrow('The time limit for this question has expired.');
		expect(expired).toBe(0);

		expire('testPart', 'part-1');
		expect(expired).toBe(1);
		p.destroy();
	});
});

describe('TimeManager scope expiry', () => {
	test('reports an expired scope without late submission and keeps the assessment clock running', async () => {
		let now = 1_000;
		const scopes: string[] = [];
		let assessmentExpired = false;
		const manager = new TimeManager({
			now: () => now,
			onScopeExpired: (scope, identifier) => scopes.push(`${scope}:${identifier}`),
			onExpired: () => {
				assessmentExpired = true;
			},
		});
		manager.activateScopes({
			testPart: { identifier: 'part-1' },
			section: { identifier: 's1', timeLimits: { maxTime: 1 } },
			item: { identifier: 'i1' },
		});
		now = 3_000;
		await new Promise((resolve) => setTimeout(resolve, 1_100));
		expect(scopes).toEqual(['section:s1']);
		expect(assessmentExpired).toBe(false);
		manager.destroy();
	});
});
