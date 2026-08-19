import { describe, expect, test } from 'bun:test';
import { parse } from 'node-html-parser';
import { planQtiItemBody } from '../../src/utils/qti-item-planner';

describe('planQtiItemBody', () => {
  test('collects QTI interaction units in document order rather than registry order', () => {
    const document = parse(`
      <assessmentItem identifier="ordered">
        <itemBody>
          <p>First blank: <textEntryInteraction responseIdentifier="TEXT"/></p>
          <choiceInteraction responseIdentifier="CHOICE">
            <simpleChoice identifier="A">A</simpleChoice>
          </choiceInteraction>
          <orderInteraction responseIdentifier="ORDER">
            <simpleChoice identifier="ONE">One</simpleChoice>
          </orderInteraction>
        </itemBody>
      </assessmentItem>
    `);

    const itemBody = document.getElementsByTagName('itemBody')[0]!;
    const plan = planQtiItemBody(itemBody);

    expect(
      plan.units.map((unit) => ({
        kind: unit.kind,
        interactionType: unit.interactionType,
        responseIdentifiers: unit.interactions.map((interaction) =>
          interaction.getAttribute('responseIdentifier')
        ),
      }))
    ).toEqual([
      {
        kind: 'inline',
        interactionType: 'textEntryInteraction',
        responseIdentifiers: ['TEXT'],
      },
      {
        kind: 'block',
        interactionType: 'choiceInteraction',
        responseIdentifiers: ['CHOICE'],
      },
      {
        kind: 'block',
        interactionType: 'orderInteraction',
        responseIdentifiers: ['ORDER'],
      },
    ]);
  });

  test('groups multiple inline text-entry interactions into one conversion unit', () => {
    const document = parse(`
      <assessmentItem identifier="inline-group">
        <itemBody>
          <p>
            The <textEntryInteraction responseIdentifier="A"/> fox
            jumps <textEntryInteraction responseIdentifier="B"/>.
          </p>
        </itemBody>
      </assessmentItem>
    `);

    const itemBody = document.getElementsByTagName('itemBody')[0]!;
    const plan = planQtiItemBody(itemBody);

    expect(plan.units).toHaveLength(1);
    expect(plan.units[0]).toMatchObject({
      kind: 'inline',
      interactionType: 'textEntryInteraction',
    });
    expect(
      plan.units[0]?.interactions.map((interaction) =>
        interaction.getAttribute('responseIdentifier')
      )
    ).toEqual(['A', 'B']);
  });
});
