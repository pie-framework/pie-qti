import { describe, expect, test } from 'bun:test';
import { parse } from 'node-html-parser';
import { extractObjectPassages } from '../../src/utils/passage-extraction';

function itemBodyOf(xml: string) {
	const doc = parse(`<assessmentItem><itemBody>${xml}</itemBody></assessmentItem>`, {
		lowerCaseTagName: false,
		comment: false,
	});
	return doc.getElementsByTagName('itemBody')[0]!;
}

describe('extractObjectPassages', () => {
	test('extracts a top-level object reference as a passage', () => {
		const itemBody = itemBodyOf(`
			<object data="passages/passage-1.xml" type="text/html" data-pie-passage-id="p1"/>
			<choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
				<simpleChoice identifier="A">A</simpleChoice>
			</choiceInteraction>
		`);

		const passages = extractObjectPassages(itemBody);

		expect(passages).toHaveLength(1);
		expect(passages[0]?.filePath).toBe('passages/passage-1.xml');
	});

	test('does not treat an object nested inside an interaction as a passage', () => {
		// A text/html object inside an interaction's own prompt is interaction content, not
		// a separate passage to extract and remove from the tree.
		const itemBody = itemBodyOf(`
			<choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
				<prompt>
					<object data="passages/embedded-note.xml" type="text/html" data-pie-passage-id="note"/>
				</prompt>
				<simpleChoice identifier="A">A</simpleChoice>
			</choiceInteraction>
		`);

		const passages = extractObjectPassages(itemBody);

		expect(passages).toHaveLength(0);
		expect(itemBody.getElementsByTagName('object')).toHaveLength(1);
	});
});
