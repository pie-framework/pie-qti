import { describe, expect, test } from 'bun:test';
import { parse } from 'node-html-parser';
import { partitionItemBody } from '../../src/utils/item-body-partition';

function itemOf(xml: string) {
	const doc = parse(`<assessmentItem><itemBody>${xml}</itemBody></assessmentItem>`, {
		lowerCaseTagName: false,
		comment: false,
	});
	return doc.getElementsByTagName('assessmentItem')[0]!;
}

const passageResources = {
	resolve: (href: string) => (href.startsWith('passages/') ? `resource-${href.slice(9, -4)}` : undefined),
};

describe('object passage references', () => {
	test('a top-level object naming a passage resource leaves the body as a reference', () => {
		const item = itemOf(`
			<object data="passages/passage-1.xml" type="text/html"/>
			<choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
				<simpleChoice identifier="A">A</simpleChoice>
			</choiceInteraction>
		`);

		const partition = partitionItemBody(item, { passageResources });

		expect(partition.passageReferences).toEqual([
			{ identifier: 'resource-passage-1', href: 'passages/passage-1.xml', via: 'object' },
		]);
		expect(item.getElementsByTagName('object')).toHaveLength(0);
	});

	test('an object inside an interaction stays interaction content', () => {
		const item = itemOf(`
			<choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
				<prompt>
					<object data="passages/embedded-note.xml" type="text/html"/>
				</prompt>
				<simpleChoice identifier="A">A</simpleChoice>
			</choiceInteraction>
		`);

		const partition = partitionItemBody(item, { passageResources });

		expect(partition.passageReferences).toHaveLength(0);
		expect(item.getElementsByTagName('object')).toHaveLength(1);
	});
});
