import { describe, expect, it } from 'bun:test';
import { Player } from '../../src/core/Player.js';

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
