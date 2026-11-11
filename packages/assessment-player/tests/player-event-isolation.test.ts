/**
 * Listener exceptions are isolated. The player's TypedEventEmitter logs a throwing
 * listener and keeps dispatching (the ItemSession subscriber pattern), so a throwing
 * host callback can neither abort the player's own transition nor take down unrelated
 * listeners. Two places this previously broke delivery:
 *
 * - `runExclusive` set `transitionInFlight` before its try — a throwing `busyChange`
 *   listener at the set could leave the flag stuck true forever (every later transition
 *   rejected as `navigationInFlight`).
 * - `leaveExpiredScope`'s completion handler swallowed rejections — a throwing
 *   `scopeTimeExpired` listener mid-hop died before the hop's navigation, leaving the
 *   expired scope locked and the expiry move lost.
 */

import './setup';
import { afterEach, describe, expect, it } from 'bun:test';
import { TypedEventEmitter } from '../src/core/playerEvents.js';
import { AssessmentPlayer } from '../src/core/AssessmentPlayer.js';
import { ReferenceBackendAdapter } from '../src/integration/ReferenceBackendAdapter.js';
import type { SecureAssessment, SecureItemRef, SecureSection, SecureTestPart } from '../src/integration/api-contract.js';

const NS = 'xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"';

const choiceItem = (identifier: string) =>
	`<assessmentItem ${NS} identifier="${identifier}" title="${identifier}" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"><correctResponse><value>A</value></correctResponse></responseDeclaration>
  <itemBody><p>Question ${identifier}</p></itemBody>
</assessmentItem>`;

const ref = (identifier: string, extra: Partial<SecureItemRef> = {}): SecureItemRef => ({
	identifier,
	role: 'candidate',
	itemXml: choiceItem(identifier),
	...extra,
});

const section = (identifier: string, items: SecureItemRef[], extra: Partial<SecureSection> = {}): SecureSection => ({
	identifier,
	visible: true,
	assessmentItemRefs: items,
	...extra,
});

const part = (identifier: string, sections: SecureSection[], extra: Partial<SecureTestPart> = {}): SecureTestPart => ({
	identifier,
	navigationMode: 'nonlinear',
	submissionMode: 'individual',
	sections,
	...extra,
});

const players: AssessmentPlayer[] = [];
afterEach(() => {
	for (const player of players.splice(0)) player.destroy();
	localStorage.clear();
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 60));
/** One real tick of the time manager's one-second interval. */
const timerTick = () => new Promise((resolve) => setTimeout(resolve, 1_100));

describe('TypedEventEmitter dispatch isolation', () => {
	it('a throwing listener does not stop later listeners and emit returns normally', () => {
		const emitter = new TypedEventEmitter<{ ping: [value: string] }>();
		const calls: string[] = [];
		const errors: unknown[][] = [];
		const original = console.error;
		console.error = (...args: unknown[]) => errors.push(args);
		try {
			emitter.on('ping', () => {
				throw new Error('listener one exploded');
			});
			emitter.on('ping', (value) => calls.push(`second:${value}`));
			expect(() => emitter.emit('ping', 'x')).not.toThrow();
		} finally {
			console.error = original;
		}
		expect(calls).toEqual(['second:x']);
		expect(errors).toHaveLength(1);
	});

	it('unsubscribing a not-yet-visited listener during dispatch still takes effect', () => {
		const emitter = new TypedEventEmitter<{ ping: [] }>();
		const calls: string[] = [];
		const original = console.error;
		console.error = () => {};
		try {
			const off = emitter.on('ping', () => {
				calls.push('first');
				off();
			});
			emitter.on('ping', () => calls.push('second'));
			emitter.emit('ping');
			emitter.emit('ping');
		} finally {
			console.error = original;
		}
		expect(calls).toEqual(['first', 'second', 'second']);
	});
});

describe('a throwing busyChange listener cannot strand the transition flag', () => {
	it('next() completes, busy clears, and a later transition is not rejected as in flight', async () => {
		const parsed = await ReferenceBackendAdapter.parseAssessmentTestXml(
			`<assessmentTest ${NS} identifier="busy-throw" title="Busy throw">
  <testPart identifier="part" navigationMode="nonlinear" submissionMode="individual">
    <assessmentSection identifier="s1" title="Section A" visible="true">
      <assessmentItemRef identifier="q1" href="q1.xml"/>
      <assessmentItemRef identifier="q2" href="q2.xml"/>
    </assessmentSection>
  </testPart>
</assessmentTest>`,
			{ itemXmlMap: { 'q1.xml': choiceItem('q1'), 'q2.xml': choiceItem('q2') } },
		);
		const backend = new ReferenceBackendAdapter();
		backend.registerAssessment(parsed.identifier, parsed);
		const player = await AssessmentPlayer.create({
			backend,
			initSession: { assessmentId: parsed.identifier, candidateId: 'candidate' },
		});
		players.push(player);

		const original = console.error;
		console.error = () => {};
		try {
			player.onBusyChange((busy) => {
				if (busy) throw new Error('host busy listener exploded');
			});
			await player.next();
		} finally {
			console.error = original;
		}

		expect(player.isBusy()).toBe(false);
		expect(player.getCurrentItem()?.identifier).toBe('q2');
		// The flag was not left stuck: another transition runs instead of being
		// rejected with `navigationInFlight`.
		await expect(player.previous()).resolves.toBeUndefined();
		expect(player.getCurrentItem()?.identifier).toBe('q1');
	});
});

describe('a throwing scopeTimeExpired listener cannot lose the expiry hop', () => {
	it('delivery still moves off the expired scope', async () => {
		let now = 1_000;
		const assessment: SecureAssessment = {
			identifier: 'expiry-listener-throw',
			title: 'Expiry listener throw',
			navigationMode: 'nonlinear',
			submissionMode: 'individual',
			testParts: [part('part-1', [section('s1', [ref('q1', { timeLimits: { maxTime: 3 } }), ref('q2')])])],
		};
		const backend = new ReferenceBackendAdapter();
		backend.registerAssessment(assessment.identifier, assessment);
		const player = await AssessmentPlayer.create({
			backend,
			initSession: { assessmentId: assessment.identifier, candidateId: 'candidate' },
			now: () => now,
		});
		players.push(player);

		const expired: string[] = [];
		const original = console.error;
		console.error = () => {};
		try {
			player.onScopeTimeExpired((event) => {
				expired.push(`${event.scope}:${event.identifier}`);
				throw new Error('host expiry listener exploded');
			});
			now += 4_000;
			await timerTick();
			await settle();
			await settle();
		} finally {
			console.error = original;
		}

		// The hop survived the throwing listener: delivery moved to the open item.
		expect(expired).toEqual(['item:q1']);
		expect(player.getCurrentItem()?.identifier).toBe('q2');
		expect(player.isBusy()).toBe(false);
	});
});
