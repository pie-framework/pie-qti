import { describe, expect, test } from 'bun:test';
import { Player } from '../../src/core/Player.js';

describe('Player.processResponses()', () => {
	test('resets outcome variables to their defaults before each run', () => {
		const itemXml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="reset-outcomes" title="Reset Outcomes" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="integer">
    <defaultValue><value>0</value></defaultValue>
  </outcomeDeclaration>
  <itemBody><p>Dummy</p></itemBody>
  <responseProcessing>
    <responseCondition>
      <responseIf>
        <match>
          <variable identifier="RESPONSE"/>
          <baseValue baseType="identifier">A</baseValue>
        </match>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="integer">1</baseValue>
        </setOutcomeValue>
      </responseIf>
      <responseElse>
        <!-- intentionally does not set SCORE -->
      </responseElse>
    </responseCondition>
  </responseProcessing>
</assessmentItem>`;

		const p = new Player({ itemXml, seed: 1, role: 'candidate' });

		p.setResponses({ RESPONSE: 'A' });
		expect(p.processResponses().outcomeValues.SCORE).toBe(1);

		p.setResponses({ RESPONSE: 'B' });
		const r2 = p.processResponses();
		expect(r2.outcomeValues.SCORE).toBe(0);
		expect(r2.score).toBe(0);
	});
});


