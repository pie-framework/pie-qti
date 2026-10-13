/**
 * Passage links
 *
 * The package transform result lists the package's passages, each with the converted items linked
 * to it and where it stands among each item's passages: the body's references in order, then the
 * passages the manifest alone declares.
 */

import { describe, expect, test } from 'bun:test';
import { PASSAGE_DEPENDENCY_UNREFERENCED, transformQtiPackageToPie } from '../src';

const CHOICE = `<choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
    <prompt>Which river is longer?</prompt>
    <simpleChoice identifier="A">Nile</simpleChoice>
    <simpleChoice identifier="B">Amazon</simpleChoice>
  </choiceInteraction>`;

function choiceItem(identifier: string, body: string): string {
  return `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="${identifier}" title="${identifier}" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse><value>A</value></correctResponse>
  </responseDeclaration>
  <itemBody>${body}${CHOICE}</itemBody>
</assessmentItem>`;
}

interface PackageItem {
  resourceId: string;
  href: string;
  xml: string;
  dependencies: string[];
}

const NILE = { identifier: 'PASSAGE-NILE', href: 'passages/nile.html' };
const AMAZON = { identifier: 'PASSAGE-AMAZON', href: 'passages/amazon.html' };
const STYLES = { identifier: 'STYLES', href: 'styles/item.css' };

async function transform(items: PackageItem[]) {
  const files = new Map<string, string>(items.map((item) => [item.href, item.xml]));
  for (const resource of [NILE, AMAZON]) {
    files.set(resource.href, `<html><body><p>${resource.identifier}</p></body></html>`);
  }
  files.set(STYLES.href, 'p { margin: 0; }');
  const manifestXml = `<manifest xmlns="http://www.imsglobal.org/xsd/imscp_v1p1" identifier="pkg">
  <resources>
    ${items
      .map(
        (
          item
        ) => `<resource identifier="${item.resourceId}" type="imsqti_item_xmlv2p2" href="${item.href}">
      <file href="${item.href}"/>
      ${item.dependencies.map((dependency) => `<dependency identifierref="${dependency}"/>`).join('')}
    </resource>`
      )
      .join('')}
    ${[NILE, AMAZON, STYLES]
      .map(
        (resource) =>
          `<resource identifier="${resource.identifier}" type="webcontent" href="${resource.href}"><file href="${resource.href}"/></resource>`
      )
      .join('')}
  </resources>
</manifest>`;
  return transformQtiPackageToPie({
    packageId: 'pkg',
    manifestXml,
    fileAccess: {
      readText: async (packagePath) => files.get(packagePath) ?? null,
      listFiles: async () => [...files.keys()],
    },
  });
}

function itemReferences(result: Awaited<ReturnType<typeof transform>>) {
  return result.items.map((item) => {
    const content = item.content as {
      passage?: string;
      metadata?: { qtiPassageReferences?: unknown };
    };
    return { passage: content.passage, references: content.metadata?.qtiPassageReferences };
  });
}

function linkedItems(result: Awaited<ReturnType<typeof transform>>) {
  return Object.fromEntries(
    result.passages.map((passage) => [passage.resourceId, passage.linkedItems])
  );
}

describe('passage links', () => {
  test('follow the order the body names its passages, by the converted item id', async () => {
    const result = await transform([
      {
        resourceId: 'RES-PAIRED',
        href: 'items/paired.xml',
        xml: choiceItem(
          'ITEM-PAIRED',
          '<object data="../passages/amazon.html" type="text/html"/><object data="../passages/nile.html" type="text/html"/>'
        ),
        dependencies: [NILE.identifier, AMAZON.identifier],
      },
    ]);

    expect(linkedItems(result)).toEqual({
      'PASSAGE-NILE': [
        { itemId: 'ITEM-PAIRED', itemResourceId: 'RES-PAIRED', position: 1, via: 'object' },
      ],
      'PASSAGE-AMAZON': [
        { itemId: 'ITEM-PAIRED', itemResourceId: 'RES-PAIRED', position: 0, via: 'object' },
      ],
    });
    expect(result.passages.map((passage) => passage.sourcePath)).toEqual([
      'passages/nile.html',
      'passages/amazon.html',
    ]);
  });

  test('include a passage the manifest alone declares, on the item too, unreported', async () => {
    const result = await transform([
      {
        resourceId: 'RES-1',
        href: 'items/one.xml',
        xml: choiceItem('ITEM-1', ''),
        dependencies: [STYLES.identifier, NILE.identifier],
      },
    ]);

    expect(linkedItems(result)['PASSAGE-NILE']).toEqual([
      { itemId: 'ITEM-1', itemResourceId: 'RES-1', position: 0, via: 'manifest-dependency' },
    ]);
    expect(itemReferences(result)).toEqual([
      {
        passage: 'PASSAGE-NILE',
        references: [
          { identifier: 'PASSAGE-NILE', href: 'passages/nile.html', via: 'manifest-dependency' },
        ],
      },
    ]);
    expect(result.passages.map((passage) => passage.resourceId)).not.toContain('STYLES');
    expect(
      result.warnings.filter((warning) => warning.code === PASSAGE_DEPENDENCY_UNREFERENCED)
    ).toEqual([]);
  });

  test('put a declared passage the body does not name after the ones it does, and report it', async () => {
    const result = await transform([
      {
        resourceId: 'RES-1',
        href: 'items/one.xml',
        xml: choiceItem('ITEM-1', '<object data="../passages/nile.html" type="text/html"/>'),
        dependencies: [AMAZON.identifier, NILE.identifier],
      },
    ]);

    expect(linkedItems(result)).toEqual({
      'PASSAGE-NILE': [{ itemId: 'ITEM-1', itemResourceId: 'RES-1', position: 0, via: 'object' }],
      'PASSAGE-AMAZON': [
        { itemId: 'ITEM-1', itemResourceId: 'RES-1', position: 1, via: 'manifest-dependency' },
      ],
    });
    expect(itemReferences(result)).toEqual([
      {
        passage: 'PASSAGE-NILE',
        references: [
          { identifier: 'PASSAGE-NILE', href: '../passages/nile.html', via: 'object' },
          {
            identifier: 'PASSAGE-AMAZON',
            href: 'passages/amazon.html',
            via: 'manifest-dependency',
          },
        ],
      },
    ]);
    expect(
      result.warnings.filter((warning) => warning.code === PASSAGE_DEPENDENCY_UNREFERENCED)
    ).toEqual([
      {
        itemId: 'ITEM-1',
        code: PASSAGE_DEPENDENCY_UNREFERENCED,
        message:
          'Item ITEM-1 declares passage PASSAGE-AMAZON as a manifest dependency, but its body references PASSAGE-NILE: PASSAGE-AMAZON is linked after them.',
      },
    ]);
  });

  test('list every item linked to a shared passage, in package order', async () => {
    const result = await transform([
      {
        resourceId: 'RES-1',
        href: 'items/one.xml',
        xml: choiceItem('ITEM-1', '<object data="../passages/nile.html" type="text/html"/>'),
        dependencies: [NILE.identifier],
      },
      {
        resourceId: 'RES-2',
        href: 'items/two.xml',
        xml: choiceItem('ITEM-2', ''),
        dependencies: [NILE.identifier],
      },
    ]);

    expect(linkedItems(result)['PASSAGE-NILE']?.map((link) => link.itemId)).toEqual([
      'ITEM-1',
      'ITEM-2',
    ]);
    expect(result.passages.map((passage) => passage.resourceId)).toEqual(['PASSAGE-NILE']);
  });
});
