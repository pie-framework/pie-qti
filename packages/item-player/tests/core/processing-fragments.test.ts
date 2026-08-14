import { describe, expect, it } from 'bun:test';
import { Player } from '../../src/core/Player.js';
import { createAssessmentItemDefinition as createServerDefinition } from '../../src/server.js';

const ITEM_XML = `
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  xmlns:xi="http://www.w3.org/2001/XInclude"
  identifier="fragment-item" title="Fragment item" adaptive="false" timeDependent="false">
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue><value>0</value></defaultValue>
  </outcomeDeclaration>
  <itemBody><p>Fragment scoring</p></itemBody>
  <responseProcessing><xi:include href="rules/score.xml"/></responseProcessing>
</assessmentItem>`;

describe('Player processing fragment resolver', () => {
	it('executes a package-host-resolved responseProcessingFragment', () => {
		const player = new Player({
			itemXml: ITEM_XML,
			resolveProcessingFragment: ({ href, mode }) => {
				expect(href).toBe('rules/score.xml');
				expect(mode).toBe('response');
				return `
          <responseProcessingFragment xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2">
            <setOutcomeValue identifier="SCORE">
              <baseValue baseType="float">1</baseValue>
            </setOutcomeValue>
          </responseProcessingFragment>`;
			},
		});

		expect(player.processResponses().score).toBe(1);
	});

	it('does not turn authored hrefs into implicit network or file reads', () => {
		expect(() => new Player({ itemXml: ITEM_XML })).toThrow(
			'no resolveProcessingFragment host callback was provided',
		);
	});
});

describe('server definition processing fragment resolver', () => {
	it('passes the DOM-free processing request object through the definition interface', () => {
		const requests: unknown[] = [];
		const definition = createServerDefinition({
			itemXml: ITEM_XML,
			resolveProcessingFragment: (request) => {
				requests.push(request);
				return `
          <responseProcessingFragment xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2">
            <setOutcomeValue identifier="SCORE">
              <baseValue baseType="float">2</baseValue>
            </setOutcomeValue>
          </responseProcessingFragment>`;
			},
		});

		expect(requests).toEqual([
			{ href: 'rules/score.xml', mode: 'response', scope: 'item', depth: 0 },
		]);
		const session = definition.openSession();
		expect(session.dispatch({ action: 'scoreAttempt' }).result?.scoring?.score).toBe(2);
		session.dispose();
	});
});
