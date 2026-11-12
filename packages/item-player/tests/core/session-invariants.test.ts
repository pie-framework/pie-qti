/**
 * Per-session invariants of a compiled item definition and the sessions it opens.
 *
 * A definition holds only immutable, source-derived data, and every session starts from it:
 *
 * - declarations are deep-cloned per session, because template rules (setCorrectResponse,
 *   setDefaultValue; QTI ASI §10.3) change them in place for one instance of the item;
 * - templateDefaults (an assessmentItemRef's `templateDefault`) apply before template processing
 *   and are reused by newTemplate and by templateConstraint restarts;
 * - correct responses are read live from the session;
 * - the random stream, the shuffle seed (`sessionGuid`) and the start time are created per
 *   session;
 * - restoring a session skips template processing (§10.3 fixes its effects for the session);
 * - `prepareContentMarkup` runs exactly once, on the raw XML, when the definition compiles: it
 *   generates the `ssml-N` catalog idrefs, which the section player derives from the same XML.
 *
 * Everything here goes through the public façade (`createAssessmentItemDefinition`,
 * `openSession`, `dispatch`, `state()`, `serialize()` and a scorer-role `present()`), so these
 * tests keep holding while the session engine behind it is reorganized.
 */

import { afterEach, describe, expect, spyOn, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { convertQti2ToQti3 } from '@pie-qti/qti-common';
import * as accessibility from '@pie-qti/qti-common/accessibility';
import {
	type AssessmentItemDefinitionConfig,
	createAssessmentItemDefinition,
} from '../../src/core/AssessmentItemDefinition.js';
import type { ItemSession } from '../../src/core/ItemSession.js';
import { createSeededRng } from '../../src/core/random.js';
import type { ChoiceInteractionData } from '../../src/interactions/shared/types.js';

const NS = 'xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"';

function versions(itemXml: string): Array<[string, string]> {
	return [
		['QTI 2.2', itemXml],
		['QTI 3.0', convertQti2ToQti3(itemXml)],
	];
}

const openSessions: ItemSession[] = [];

/** Opened sessions are disposed after each test, whatever it asserted. */
function track(session: ItemSession): ItemSession {
	openSessions.push(session);
	return session;
}

afterEach(() => {
	for (const session of openSessions.splice(0)) session.dispose();
});

/** One scripted random stream per opened session, handed out in order. */
function scriptedStreams(...streams: number[][]): {
	rngFactory: NonNullable<AssessmentItemDefinitionConfig['rngFactory']>;
	drawsTaken: number[];
} {
	const drawsTaken: number[] = [];
	return {
		drawsTaken,
		rngFactory: () => {
			const index = drawsTaken.length;
			const draws = streams[index] ?? [];
			drawsTaken.push(0);
			return () => {
				const draw = draws[drawsTaken[index]! % Math.max(draws.length, 1)] ?? 0;
				drawsTaken[index]! += 1;
				return draw;
			};
		},
	};
}

/** The draw randomInteger min=1 max=1000 reads as `T`: it reads a draw d as 1 + floor(1000 d). */
function drawFor(T: number): number {
	return (T - 0.5) / 1000;
}

/**
 * Template rules that apply only to a draw above 500: every session's correct responses and
 * defaults are a function of its own draw, so a rule effect leaking out of one session (into
 * another, or into the definition) shows wherever a later draw is low and the declared values
 * must hold.
 */
const ISOLATION_ITEM = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem ${NS} identifier="session-isolation" title="Session isolation" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="integer">
    <correctResponse><value>0</value></correctResponse>
  </responseDeclaration>
  <responseDeclaration identifier="SET" cardinality="multiple" baseType="integer">
    <correctResponse><value>1</value><value>2</value></correctResponse>
  </responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"/>
  <outcomeDeclaration identifier="BONUS" cardinality="single" baseType="integer">
    <defaultValue><value>0</value></defaultValue>
  </outcomeDeclaration>
  <templateDeclaration identifier="T" cardinality="single" baseType="integer"/>
  <templateProcessing>
    <setTemplateValue identifier="T"><randomInteger min="1" max="1000"/></setTemplateValue>
    <templateCondition>
      <templateIf>
        <gt><variable identifier="T"/><baseValue baseType="integer">500</baseValue></gt>
        <setCorrectResponse identifier="RESPONSE"><variable identifier="T"/></setCorrectResponse>
        <setDefaultValue identifier="RESPONSE"><variable identifier="T"/></setDefaultValue>
        <setCorrectResponse identifier="SET">
          <multiple><variable identifier="T"/><baseValue baseType="integer">0</baseValue></multiple>
        </setCorrectResponse>
        <setDefaultValue identifier="BONUS"><variable identifier="T"/></setDefaultValue>
      </templateIf>
    </templateCondition>
  </templateProcessing>
  <itemBody>
    <p>Enter <printedVariable identifier="T"/>: <textEntryInteraction responseIdentifier="RESPONSE"/></p>
  </itemBody>
  <responseProcessing>
    <responseCondition>
      <responseIf>
        <and>
          <match><variable identifier="RESPONSE"/><correct identifier="RESPONSE"/></match>
          <match><variable identifier="SET"/><correct identifier="SET"/></match>
        </and>
        <setOutcomeValue identifier="SCORE"><baseValue baseType="float">1</baseValue></setOutcomeValue>
      </responseIf>
      <responseElse>
        <setOutcomeValue identifier="SCORE"><baseValue baseType="float">0</baseValue></setOutcomeValue>
      </responseElse>
    </responseCondition>
  </responseProcessing>
</assessmentItem>`;

interface IsolationView {
	readonly T: number;
	readonly correct: Readonly<Record<string, unknown>>;
	readonly responseDefault: unknown;
	readonly bonusDefault: unknown;
}

/** What a session of ISOLATION_ITEM must hold for its own draw, and nothing else. */
function expectedFor(T: number): IsolationView {
	return T > 500
		? { T, correct: { RESPONSE: T, SET: [T, 0] }, responseDefault: T, bonusDefault: T }
		: { T, correct: { RESPONSE: 0, SET: [1, 2] }, responseDefault: null, bonusDefault: 0 };
}

/** Correct responses through a scorer-role presentation; defaults through the snapshot. */
function observe(session: ItemSession): IsolationView {
	const saved = session.serialize();
	return {
		T: session.state().templates.T as number,
		correct: session.present().correctResponses,
		responseDefault: saved.responseVariables.RESPONSE?.defaultValue,
		bonusDefault: saved.outcomeVariables.BONUS?.defaultValue,
	};
}

function expectOwnDraw(session: ItemSession): void {
	const seen = observe(session);
	expect(seen).toEqual(expectedFor(seen.T));
}

/** Answer with the session's own correct response, reopening a closed attempt first. */
function answerCorrectly(session: ItemSession): number | undefined {
	if (session.state().lifecycleStatus === 'closed') session.dispatch({ action: 'newTemplate' });
	const correct = session.present().correctResponses;
	session.dispatch({ action: 'setResponses', responses: { RESPONSE: correct.RESPONSE, SET: correct.SET } });
	return session.dispatch({ action: 'endAttempt' }).result?.scoring?.score;
}

/** The serialized state, without the fields that are per session by design. */
function comparableState(session: ItemSession): Record<string, unknown> {
	const { sessionGuid, savedAt, duration, contextVariables, ...rest } = session.serialize();
	void sessionGuid;
	void savedAt;
	void duration;
	const { duration: durationVariable, ...context } = contextVariables;
	void durationVariable;
	return { ...rest, contextVariables: context };
}

describe.each(versions(ISOLATION_ITEM))('declarations are deep-cloned per session (%s)', (_version, itemXml) => {
	test('two sessions of one definition keep their own template-rule effects', () => {
		const { rngFactory } = scriptedStreams([drawFor(600)], [drawFor(1)]);
		const definition = createAssessmentItemDefinition({ itemXml, role: 'scorer', rngFactory });

		const ruled = track(definition.openSession());
		expect(observe(ruled)).toEqual(expectedFor(600));
		const declared = track(definition.openSession());
		expect(observe(declared)).toEqual(expectedFor(1));
		// Opening the second session left the first one's instance alone.
		expect(observe(ruled)).toEqual(expectedFor(600));

		// Each attempt scores against its own instance's correct response.
		expect(answerCorrectly(ruled)).toBe(1);
		expect(answerCorrectly(declared)).toBe(1);
		declared.dispatch({ action: 'newTemplate' });
		declared.dispatch({ action: 'setResponses', responses: { RESPONSE: 600, SET: [600, 0] } });
		expect(declared.dispatch({ action: 'endAttempt' }).result?.scoring?.score).toBe(0);
	});

	test('a session opened after others mutated theirs starts as a freshly compiled one', () => {
		const { rngFactory, drawsTaken } = scriptedStreams(
			// Three sessions draw rule-applying instances, at open and at newTemplate ...
			[drawFor(501), drawFor(1000)],
			[], // ... and their restored copies draw nothing.
			[drawFor(1000), drawFor(700)],
			[],
			[drawFor(800), drawFor(501)],
			[],
			// The later session draws an instance the rules do not apply to.
			[drawFor(1)],
		);
		const definition = createAssessmentItemDefinition({ itemXml, role: 'scorer', rngFactory });
		for (let index = 0; index < 3; index += 1) {
			const session = track(definition.openSession());
			expect(answerCorrectly(session)).toBe(1);
			session.dispatch({ action: 'newTemplate' });
			expectOwnDraw(session);
			track(definition.openSession({ restore: session.serialize() }));
		}
		expect(drawsTaken).toEqual([2, 0, 2, 0, 2, 0]);

		// None of the earlier instances' rule effects: the declared values hold.
		const later = track(definition.openSession());
		expect(observe(later)).toEqual(expectedFor(1));

		const fresh = track(
			createAssessmentItemDefinition({
				itemXml,
				role: 'scorer',
				rngFactory: scriptedStreams([drawFor(1)]).rngFactory,
			}).openSession(),
		);
		expect(comparableState(later)).toEqual(comparableState(fresh));
		expect(later.present().correctResponses).toEqual(fresh.present().correctResponses);
	});

	test('random setCorrectResponse/setDefaultValue effects stay inside their own session', () => {
		// The test's own choices are seeded, so a failure reproduces.
		const choose = createSeededRng(20261110);
		const definition = createAssessmentItemDefinition({
			itemXml,
			role: 'scorer',
			rngFactory: () => createSeededRng(Math.floor(choose() * 2 ** 32)),
		});
		const live: ItemSession[] = [track(definition.openSession()), track(definition.openSession())];
		const branches = new Set<boolean>();

		for (let step = 0; step < 80; step += 1) {
			const pick = (): ItemSession => live[Math.floor(choose() * live.length)]!;
			const operation = Math.floor(choose() * 5);
			if (operation === 0) {
				live.push(track(definition.openSession()));
			} else if (operation === 1) {
				pick().dispatch({ action: 'newTemplate' });
			} else if (operation === 2) {
				expect(answerCorrectly(pick())).toBe(1);
			} else if (operation === 3) {
				const source = pick();
				const restored = track(definition.openSession({ restore: source.serialize() }));
				expect(observe(restored)).toEqual(observe(source));
				live.push(restored);
			} else if (live.length > 1) {
				live.splice(live.indexOf(pick()), 1)[0]!.dispose();
			}

			for (const session of live) {
				expectOwnDraw(session);
				branches.add(observe(session).T > 500);
			}
		}

		// Both branches ran, so a leaked rule effect would have met an instance it must not show in.
		expect([...branches].sort()).toEqual([false, true]);
	});
});

describe.each(versions(ISOLATION_ITEM))('correct responses are read live from the session (%s)', (_version, itemXml) => {
	test('a scorer presentation follows newTemplate, and earlier presentations keep what they showed', () => {
		const { rngFactory } = scriptedStreams([drawFor(501), drawFor(1), drawFor(1000)]);
		const session = track(createAssessmentItemDefinition({ itemXml, role: 'scorer', rngFactory }).openSession());

		const first = session.present();
		expect(first.correctResponses).toEqual({ RESPONSE: 501, SET: [501, 0] });

		session.dispatch({ action: 'newTemplate' });
		expect(session.present().correctResponses).toEqual({ RESPONSE: 0, SET: [1, 2] });

		session.dispatch({ action: 'newTemplate' });
		expect(session.present().correctResponses).toEqual({ RESPONSE: 1000, SET: [1000, 0] });
		expect(first.correctResponses).toEqual({ RESPONSE: 501, SET: [501, 0] });

		session.dispatch({ action: 'setResponses', responses: { RESPONSE: 1000, SET: [0, 1000] } });
		expect(session.dispatch({ action: 'endAttempt' }).result?.scoring?.score).toBe(1);
	});

	test('a restored session presents the saved instance’s correct responses', () => {
		const { rngFactory } = scriptedStreams([drawFor(900)], [drawFor(1)]);
		const definition = createAssessmentItemDefinition({ itemXml, role: 'scorer', rngFactory });
		const saved = track(definition.openSession()).serialize();
		const restored = track(definition.openSession({ restore: saved }));
		expect(restored.present().correctResponses).toEqual({ RESPONSE: 900, SET: [900, 0] });
	});
});

describe.each(versions(ISOLATION_ITEM))('the random stream is created per session (%s)', (_version, itemXml) => {
	test('a seeded definition starts every session at the beginning of the seeded stream', () => {
		const stream = createSeededRng(42);
		const firstDraw = 1 + Math.floor(stream() * 1000);
		const secondDraw = 1 + Math.floor(stream() * 1000);
		expect(secondDraw).not.toBe(firstDraw);

		const definition = createAssessmentItemDefinition({ itemXml, seed: 42 });
		const first = track(definition.openSession());
		const second = track(definition.openSession());
		expect(first.state().templates.T).toBe(firstDraw);
		expect(second.state().templates.T).toBe(firstDraw);

		// A new instance continues its own session's stream ...
		first.dispatch({ action: 'newTemplate' });
		expect(first.state().templates.T).toBe(secondDraw);
		// ... which no other session shares.
		expect(track(definition.openSession()).state().templates.T).toBe(firstDraw);
		second.dispatch({ action: 'newTemplate' });
		expect(second.state().templates.T).toBe(secondDraw);
	});

	test('rngFactory gives every opened session, restored ones included, a stream of its own', () => {
		const { rngFactory, drawsTaken } = scriptedStreams([drawFor(2), drawFor(501)], [drawFor(500)], []);
		const definition = createAssessmentItemDefinition({ itemXml, rngFactory });
		expect(drawsTaken).toEqual([]);

		const first = track(definition.openSession());
		const second = track(definition.openSession());
		expect(drawsTaken).toEqual([1, 1]);
		expect([first.state().templates.T, second.state().templates.T]).toEqual([2, 500]);

		first.dispatch({ action: 'newTemplate' });
		expect(drawsTaken).toEqual([2, 1]);
		expect(first.state().templates.T).toBe(501);
		expect(second.state().templates.T).toBe(500);

		track(definition.openSession({ restore: second.serialize() }));
		expect(drawsTaken).toEqual([2, 1, 0]);
	});
});

describe.each(versions(ISOLATION_ITEM))('restore skips template processing (%s)', (_version, itemXml) => {
	test('a restored session keeps the saved instance and draws nothing until newTemplate', () => {
		const { rngFactory, drawsTaken } = scriptedStreams([drawFor(600)], [drawFor(1)]);
		const definition = createAssessmentItemDefinition({ itemXml, role: 'scorer', rngFactory });
		const first = track(definition.openSession());
		first.dispatch({ action: 'setResponse', responseIdentifier: 'RESPONSE', value: 7 });
		const saved = first.serialize();

		// Template processing would draw T=1 from the restored session's own stream, and the
		// templateDefaults would seed it; the saved instance holds instead.
		const restored = track(definition.openSession({ restore: saved, templateDefaults: { T: 9 } }));
		expect(drawsTaken).toEqual([1, 0]);
		expect(observe(restored)).toEqual(expectedFor(600));
		expect(restored.state().responses.RESPONSE).toBe(7);

		restored.dispatch({ action: 'newTemplate' });
		expect(drawsTaken).toEqual([1, 1]);
		expect(observe(restored)).toEqual(expectedFor(1));
	});
});

/**
 * SEEN records N as template processing finds it; the pass then overwrites N. A first draw of
 * X=1 fails the templateConstraint, which restarts template processing (§10.3).
 */
const TEMPLATE_DEFAULTS_ITEM = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem ${NS} identifier="template-defaults-restart" title="Template defaults" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="integer"/>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"/>
  <templateDeclaration identifier="N" cardinality="single" baseType="integer">
    <defaultValue><value>1</value></defaultValue>
  </templateDeclaration>
  <templateDeclaration identifier="SEEN" cardinality="single" baseType="integer"/>
  <templateDeclaration identifier="X" cardinality="single" baseType="integer"/>
  <templateProcessing>
    <setTemplateValue identifier="SEEN"><variable identifier="N"/></setTemplateValue>
    <setTemplateValue identifier="X"><randomInteger min="1" max="2"/></setTemplateValue>
    <setTemplateValue identifier="N"><baseValue baseType="integer">99</baseValue></setTemplateValue>
    <templateConstraint>
      <match><variable identifier="X"/><baseValue baseType="integer">2</baseValue></match>
    </templateConstraint>
  </templateProcessing>
  <itemBody>
    <p>Seen: <printedVariable identifier="SEEN"/></p>
    <p><textEntryInteraction responseIdentifier="RESPONSE"/></p>
  </itemBody>
</assessmentItem>`;

/** randomInteger min=1 max=2: 0 draws X=1 (rejected), 0.75 draws X=2 (accepted). */
const REJECT_THEN_ACCEPT = [0, 0.75];

function bodyHtml(session: ItemSession): string {
	const node = session.present().flow.find((entry) => entry.kind === 'html');
	return node?.kind === 'html' ? String(node.html) : '';
}

describe.each(versions(TEMPLATE_DEFAULTS_ITEM))('templateDefaults (%s)', (_version, itemXml) => {
	test('apply before template processing and survive a templateConstraint restart', () => {
		const { rngFactory, drawsTaken } = scriptedStreams(REJECT_THEN_ACCEPT, REJECT_THEN_ACCEPT);
		const definition = createAssessmentItemDefinition({ itemXml, rngFactory });

		const withDefaults = track(definition.openSession({ templateDefaults: { N: 5 } }));
		// Two draws: the rejected pass and the accepted one. SEEN=5 on the accepted pass: the
		// restart reset N to the templateDefault, not to the declared 1 or the rejected pass's 99.
		expect(drawsTaken).toEqual([2]);
		expect(withDefaults.state().templates).toEqual({ N: 99, SEEN: 5, X: 2 });
		expect(bodyHtml(withDefaults)).toContain('Seen: 5');
		expect(withDefaults.serialize().templateVariables.N?.defaultValue).toBe(5);

		// Without them the declared default applies, under the same restart.
		const declared = track(definition.openSession());
		expect(drawsTaken).toEqual([2, 2]);
		expect(declared.state().templates).toEqual({ N: 99, SEEN: 1, X: 2 });
	});

	test('are reused by newTemplate, its own constraint restart, and a restored session', () => {
		const { rngFactory, drawsTaken } = scriptedStreams([...REJECT_THEN_ACCEPT, ...REJECT_THEN_ACCEPT], REJECT_THEN_ACCEPT);
		const definition = createAssessmentItemDefinition({ itemXml, rngFactory });
		const session = track(definition.openSession({ templateDefaults: { N: 5 } }));

		session.dispatch({ action: 'newTemplate' });
		expect(drawsTaken).toEqual([4]);
		expect(session.state().templates).toEqual({ N: 99, SEEN: 5, X: 2 });

		// Delivery restores a session without its templateDefaults: the snapshot carries them.
		const restored = track(definition.openSession({ restore: session.serialize() }));
		expect(restored.state().templates).toEqual({ N: 99, SEEN: 5, X: 2 });
		restored.dispatch({ action: 'newTemplate' });
		expect(drawsTaken).toEqual([4, 2]);
		expect(restored.state().templates).toEqual({ N: 99, SEEN: 5, X: 2 });
		expect(bodyHtml(restored)).toContain('Seen: 5');
	});
});

const SHUFFLE_ITEM = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem ${NS} identifier="session-shuffle" title="Session shuffle" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
  <itemBody>
    <choiceInteraction responseIdentifier="RESPONSE" shuffle="true" maxChoices="1">
      <simpleChoice identifier="A">A</simpleChoice>
      <simpleChoice identifier="B">B</simpleChoice>
      <simpleChoice identifier="C">C</simpleChoice>
      <simpleChoice identifier="D">D</simpleChoice>
      <simpleChoice identifier="E">E</simpleChoice>
      <simpleChoice identifier="F">F</simpleChoice>
      <simpleChoice identifier="G">G</simpleChoice>
      <simpleChoice identifier="H">H</simpleChoice>
    </choiceInteraction>
  </itemBody>
</assessmentItem>`;

function choiceOrder(session: ItemSession): string[] {
	const node = session.present().flow.find((entry) => entry.kind === 'interaction');
	if (node?.kind !== 'interaction') throw new Error('Expected an interaction');
	return (node.mount.interaction as ChoiceInteractionData).choices.map((choice) => choice.identifier);
}

describe.each(versions(SHUFFLE_ITEM))('the shuffle seed is created per session (%s)', (_version, itemXml) => {
	test('sessions of one definition mint their own sessionGuid and shuffle differently', () => {
		const definition = createAssessmentItemDefinition({ itemXml });
		const sessions = Array.from({ length: 12 }, () => track(definition.openSession()));

		expect(new Set(sessions.map((session) => session.serialize().sessionGuid)).size).toBe(12);
		const orders = sessions.map(choiceOrder);
		for (const order of orders) expect([...order].sort()).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
		// 8! orders: a shared seed gives one order, per-session seeds give (nearly) twelve.
		expect(new Set(orders.map((order) => order.join(''))).size).toBeGreaterThan(6);
	});

	test('the order is stable within a session and across restore', () => {
		const definition = createAssessmentItemDefinition({ itemXml });
		const session = track(definition.openSession());
		const order = choiceOrder(session);
		session.dispatch({ action: 'setResponse', responseIdentifier: 'RESPONSE', value: order[0] });
		expect(choiceOrder(session)).toEqual(order);

		const saved = session.serialize();
		const restored = track(definition.openSession({ restore: saved }));
		expect(restored.serialize().sessionGuid).toBe(saved.sessionGuid);
		expect(choiceOrder(restored)).toEqual(order);

		// A reload compiles the item again before restoring: same order.
		const reloaded = track(createAssessmentItemDefinition({ itemXml }).openSession({ restore: saved }));
		expect(choiceOrder(reloaded)).toEqual(order);
	});
});

describe('the start time is taken per session', () => {
	test('duration runs from when each session opens, not from compilation or another session', () => {
		let now = 1_000_000;
		const clock = spyOn(Date, 'now').mockImplementation(() => now);
		try {
			const definition = createAssessmentItemDefinition({ itemXml: SHUFFLE_ITEM });
			now += 60_000;
			const first = track(definition.openSession());
			expect(first.state().duration).toBe(0);
			now += 10_000;
			const second = track(definition.openSession());
			expect(second.state().duration).toBe(0);
			now += 5_000;
			expect(first.serialize().duration).toBe(15_000);
			const saved = second.serialize();
			expect(saved.duration).toBe(5_000);

			// A restored session continues the saved time from its own start.
			now += 20_000;
			const restored = track(definition.openSession({ restore: saved }));
			expect(restored.state().duration).toBe(5_000);
			now += 1_000;
			expect(restored.serialize().duration).toBe(6_000);
			expect(first.serialize().duration).toBe(36_000);
		} finally {
			clock.mockRestore();
		}
	});
});

const READ_ALOUD_ITEM = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem ${NS} xmlns:ssml="http://www.w3.org/2010/10/synthesis"
  identifier="session-read-aloud" title="Read aloud" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
  <templateDeclaration identifier="T" cardinality="single" baseType="integer"/>
  <templateProcessing>
    <setTemplateValue identifier="T"><randomInteger min="1" max="9"/></setTemplateValue>
  </templateProcessing>
  <itemBody>
    <p class="formula">Water is <ssml:sub alias="water">H2O</ssml:sub>.</p>
    <p class="slow" data-ssml="&lt;speak&gt;&lt;prosody rate=&quot;slow&quot;&gt;Read slowly&lt;/prosody&gt;&lt;/speak&gt;">Read slowly</p>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <simpleChoice identifier="A" data-ssml="&lt;speak&gt;Option A&lt;/speak&gt;">A</simpleChoice>
      <simpleChoice identifier="B">B</simpleChoice>
    </choiceInteraction>
  </itemBody>
</assessmentItem>`;

function catalogIdrefs(html: string): string[] {
	return [...html.matchAll(/data-catalog-idref="([^"]*)"/g)].map((match) => match[1]!).sort();
}

describe.each(versions(READ_ALOUD_ITEM))('prepareContentMarkup (%s)', (_version, itemXml) => {
	test('runs exactly once, on the raw XML, when the definition compiles', () => {
		// The idrefs the section player derives from the same raw XML.
		const spoken = accessibility
			.prepareContentMarkup(itemXml, [], { hidingStyles: false })
			.spoken.map((card) => card.identifier)
			.sort();
		expect(spoken.length).toBeGreaterThan(1);
		expect(spoken.every((idref) => /^ssml-\d+$/.test(idref))).toBe(true);

		const prepare = spyOn(accessibility, 'prepareContentMarkup');
		try {
			const definition = createAssessmentItemDefinition({ itemXml });
			expect(prepare).toHaveBeenCalledTimes(1);
			expect(prepare.mock.calls[0]?.[0]).toBe(itemXml);

			const first = track(definition.openSession());
			const second = track(definition.openSession());
			const bodies = [bodyHtml(first), bodyHtml(second)];
			first.dispatch({ action: 'newTemplate' });
			bodies.push(bodyHtml(first));
			const restored = track(definition.openSession({ restore: first.serialize() }));
			bodies.push(bodyHtml(restored));
			expect(prepare).toHaveBeenCalledTimes(1);

			// Every presentation carries each generated idref once: docked a single time.
			const interactionIdrefs = (session: ItemSession): string[] => {
				const node = session.present().flow.find((entry) => entry.kind === 'interaction');
				if (node?.kind !== 'interaction') return [];
				return catalogIdrefs(
					(node.mount.interaction as ChoiceInteractionData).choices.map((choice) => String(choice.text)).join(''),
				);
			};
			for (const [index, body] of bodies.entries()) {
				const session = [first, second, first, restored][index]!;
				expect([...catalogIdrefs(body), ...interactionIdrefs(session)].sort()).toEqual(spoken);
			}
		} finally {
			prepare.mockRestore();
		}
	});
});

/**
 * The conformance fixtures with template processing run with the harness seed (the case file's
 * `seed`, else 42). Their expectations depend on these draws, so the values are pinned here.
 */
const SEEDED_TEMPLATE_FIXTURES: Record<string, Record<string, unknown>> = {
	templateProcessing_exitTemplate: { T: 1 },
	templateProcessing_setCorrectResponse: { T1: 1, T2: 0, KEY: 'C' },
	templateProcessing_setDefaultValue: { KEY: 'C' },
	templateProcessing_templateCondition_branching: { X: 3, A: 10, B: 20, C: 30 },
	templateProcessing_templateCondition_toBoolean: { X: 2, S: 'hi', A: 0, B: 1, C: 0, D: 1 },
	templateProcessing_templateConstraint: { A: 1, B: 2 },
	template_paramVariable_objectParam: { LEVEL: 4, PLAIN: 7 },
	template_randomFloat_roundTo_mathConstant: { X: 0.7872516233474016, XR: 0.79, PI2: 3.14 },
	template_randomInteger_printedVariable: { A: 5, B: 3 },
};

describe('the seeded template fixtures are unchanged', () => {
	const fixturesRoot = join(import.meta.dir, '../conformance/fixtures');
	const templated = readdirSync(fixturesRoot, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.filter((name) => readFileSync(join(fixturesRoot, name, 'item.xml'), 'utf8').includes('<templateProcessing'))
		.sort();

	test('every templated fixture is pinned', () => {
		expect(templated).toEqual(Object.keys(SEEDED_TEMPLATE_FIXTURES).sort());
	});

	test.each(templated)('%s draws the pinned template values in every session', (name) => {
		const itemXml = readFileSync(join(fixturesRoot, name, 'item.xml'), 'utf8');
		const { seed } = JSON.parse(readFileSync(join(fixturesRoot, name, 'cases.json'), 'utf8')) as { seed?: number };
		const definition = createAssessmentItemDefinition({ itemXml, seed: seed ?? 42 });
		for (let index = 0; index < 2; index += 1) {
			expect(track(definition.openSession()).state().templates).toEqual(SEEDED_TEMPLATE_FIXTURES[name]!);
		}
	});
});
