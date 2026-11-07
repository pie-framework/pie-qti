/**
 * Invisible sections and legal navigation targets (issue: visible="false" leakage).
 *
 * A QTI section with visible="false" is not presented as a section: its content appears
 * as part of the parent. It must not appear in the candidate-facing section list and its
 * title must never surface (question counter, current-section view). Items inside still
 * deliver in order, attributed to the outermost visible ancestor.
 *
 * The core also exposes which sections are legal navigation targets (linear: none beyond
 * staying; nonlinear: only within the current test part; nothing after finalization), and
 * illegal jumps reject with typed errors instead of uncaught throws.
 */

import './setup';
import { afterEach, describe, expect, test } from 'bun:test';
import { AssessmentPlayer } from '../src/core/AssessmentPlayer.js';
import { AssessmentPlayerError, isAssessmentPlayerError } from '../src/core/errors.js';
import { ReferenceBackendAdapter } from '../src/integration/ReferenceBackendAdapter.js';

const NS = 'xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"';

const choiceItem = (identifier: string) =>
	`<assessmentItem ${NS} identifier="${identifier}" title="${identifier}" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"><correctResponse><value>A</value></correctResponse></responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"><defaultValue><value>0</value></defaultValue></outcomeDeclaration>
  <itemBody>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1"><simpleChoice identifier="A">A</simpleChoice><simpleChoice identifier="B">B</simpleChoice></choiceInteraction>
  </itemBody>
</assessmentItem>`;

const items = (...ids: string[]) => Object.fromEntries(ids.map((id) => [id, choiceItem(id)]));

const NONLINEAR_XML = `<assessmentTest ${NS} identifier="visible-test" title="Visible sections">
  <testPart identifier="part-1" navigationMode="nonlinear" submissionMode="individual">
    <assessmentSection identifier="s-outer" title="Outer" visible="true">
      <assessmentSection identifier="s-hidden" title="Hidden" visible="false">
        <assessmentItemRef identifier="i1" href="i1.xml"/>
      </assessmentSection>
      <assessmentItemRef identifier="i2" href="i2.xml"/>
    </assessmentSection>
  </testPart>
  <testPart identifier="part-2" navigationMode="nonlinear" submissionMode="individual">
    <assessmentSection identifier="s-2" title="Part two" visible="true">
      <assessmentItemRef identifier="i3" href="i3.xml"/>
    </assessmentSection>
  </testPart>
</assessmentTest>`;

const LINEAR_XML = `<assessmentTest ${NS} identifier="linear-sections" title="Linear sections">
  <testPart identifier="part-1" navigationMode="linear" submissionMode="individual">
    <assessmentSection identifier="s1" title="First" visible="true">
      <assessmentItemRef identifier="i1" href="i1.xml"/>
    </assessmentSection>
    <assessmentSection identifier="s2" title="Second" visible="true">
      <assessmentItemRef identifier="i2" href="i2.xml"/>
    </assessmentSection>
  </testPart>
</assessmentTest>`;

async function makePlayer(testXml: string, itemsMap: Record<string, string>) {
	const parsed = await ReferenceBackendAdapter.parseAssessmentTestXml(testXml, {
		itemXmlMap: Object.fromEntries(Object.entries(itemsMap).map(([id, xml]) => [`${id}.xml`, xml])),
	});
	const backend = new ReferenceBackendAdapter();
	backend.registerAssessment(parsed.identifier, parsed);
	localStorage.clear();
	const player = await AssessmentPlayer.create({
		backend,
		initSession: { assessmentId: parsed.identifier, candidateId: 'candidate' },
	});
	await player.navigateTo(0);
	return player;
}

function errorCode(error: unknown): string {
	expect(isAssessmentPlayerError(error)).toBe(true);
	return (error as AssessmentPlayerError).code;
}

afterEach(() => localStorage.clear());

describe('invisible sections', () => {
	test('are filtered from candidate-facing sections and never surface titles', async () => {
		const player = await makePlayer(NONLINEAR_XML, items('i1', 'i2', 'i3'));

		const sections = player.getAllSections();
		expect(sections.map((s) => s.id)).toEqual(['s-outer', 's-2']);
		expect(JSON.stringify(sections)).not.toContain('Hidden');

		// The candidate starts inside the hidden section: items deliver under the visible ancestor.
		expect(player.getCurrentItem()?.identifier).toBe('i1');
		expect(player.getCurrentItem()?.title).toBe('Outer');
		expect(player.getNavigationState().currentSection).toEqual({
			id: 's-outer',
			title: 'Outer',
			index: 0,
		});
		expect(player.getNavigationState().totalSections).toBe(2);
	});

	test('hidden sections are not navigation targets', async () => {
		const player = await makePlayer(NONLINEAR_XML, items('i1', 'i2', 'i3'));

		try {
			await player.navigateToSection('s-hidden');
			expect.unreachable();
		} catch (error) {
			expect(errorCode(error)).toBe('navigationNotAllowed');
		}
		try {
			await player.navigateToSection('nope');
			expect.unreachable();
		} catch (error) {
			expect(errorCode(error)).toBe('invalidNavigationTarget');
		}
		// The jump was rejected; the candidate stays put.
		expect(player.getCurrentItem()?.identifier).toBe('i1');
	});
});

describe('legal navigation targets', () => {
	test('nonlinear: only sections of the current test part are legal', async () => {
		const player = await makePlayer(NONLINEAR_XML, items('i1', 'i2', 'i3'));

		let navigable = player.getAllSections().filter((s) => s.navigable).map((s) => s.id);
		expect(navigable).toEqual(['s-outer']);

		// Sequential entry into the next part is still allowed; there its section is legal
		// and the finished part's section is not.
		await player.next();
		await player.next();
		expect(player.getCurrentItem()?.identifier).toBe('i3');
		navigable = player.getAllSections().filter((s) => s.navigable).map((s) => s.id);
		expect(navigable).toEqual(['s-2']);

		try {
			await player.navigateToSection('s-outer');
			expect.unreachable();
		} catch (error) {
			expect(errorCode(error)).toBe('navigationNotAllowed');
		}
	});

	test('linear: no jumping at all', async () => {
		const player = await makePlayer(LINEAR_XML, items('i1', 'i2'));

		const navigable = player.getAllSections().filter((s) => s.navigable).map((s) => s.id);
		expect(navigable).toEqual(['s1']);

		try {
			await player.navigateToSection('s2');
			expect.unreachable();
		} catch (error) {
			expect(errorCode(error)).toBe('navigationNotAllowed');
		}
	});

	test('after the test ends no section is a legal target', async () => {
		const player = await makePlayer(LINEAR_XML, items('i1', 'i2'));

		player.updateResponse('RESPONSE', 'A');
		await player.submit();

		expect(player.getAllSections().every((s) => !s.navigable)).toBe(true);
		try {
			await player.navigateToSection('s1');
			expect.unreachable();
		} catch (error) {
			expect(errorCode(error)).toBe('testFinalized');
		}
	});
});
