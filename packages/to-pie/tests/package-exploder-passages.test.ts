import { describe, expect, test } from 'bun:test';
import { explodeAnalyzedQtiPackageItems } from '../src/package-exploder.js';

const itemXml = `
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="ITEM-1" title="Item 1">
  <itemBody>
    <object data="../passages/reading.html" type="text/html"/>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <simpleChoice identifier="A">A</simpleChoice>
    </choiceInteraction>
  </itemBody>
</assessmentItem>`;

const manifestXml = `
<manifest xmlns="http://www.imsglobal.org/xsd/imscp_v1p1" identifier="pkg">
  <resources>
    <resource identifier="ITEM-1" type="imsqti_item_xmlv2p2" href="items/item.xml">
      <file href="items/item.xml"/>
      <dependency identifierref="PASSAGE-1"/>
      <dependency identifierref="STYLES"/>
      <dependency identifierref="CHART"/>
    </resource>
    <resource identifier="PASSAGE-1" type="webcontent" href="passages/reading.html">
      <file href="passages/reading.html"/>
    </resource>
    <resource identifier="STIMULUS-1" type="imsqti_stimulus_xmlv2p2" href="passages/stimulus.xml">
      <file href="passages/stimulus.xml"/>
    </resource>
    <resource identifier="STYLES" type="webcontent" href="styles/bundled.css">
      <file href="styles/bundled.css"/>
    </resource>
    <resource identifier="CHART" type="webcontent" href="assets/chart.png">
      <file href="assets/chart.png"/>
    </resource>
    <resource identifier="ORPHAN" type="webcontent" href="extras/notes.html">
      <file href="extras/notes.html"/>
    </resource>
  </resources>
</manifest>`;

const files = new Map([
  ['items/item.xml', itemXml],
  ['passages/reading.html', '<html><body><p>Reading.</p></body></html>'],
  [
    'passages/stimulus.xml',
    '<assessmentStimulus title="Stimulus"><stimulusBody><p>Stimulus.</p></stimulusBody></assessmentStimulus>',
  ],
  ['styles/bundled.css', '.table td { padding: 2px; }'],
  ['assets/chart.png', 'binary-ish'],
  ['extras/notes.html', '<html><body><p>Not referenced by any item.</p></body></html>'],
]);

describe('explodeAnalyzedQtiPackageItems passages', () => {
  test('takes declared stimulus resources and item-referenced web-content documents only', async () => {
    // `manifest.passages` counts every `type="webcontent"` resource as a passage, so a package
    // that declares its stylesheets and images as resources would otherwise have them read as
    // text and converted into passages.
    const exploded = await explodeAnalyzedQtiPackageItems({
      packageId: 'pkg',
      manifestXml,
      fileAccess: {
        readText: (packagePath) => files.get(packagePath) ?? null,
        listFiles: () => [...files.keys()],
      },
    });

    expect(exploded.passages.map((passage) => passage.resourceId).sort()).toEqual([
      'PASSAGE-1',
      'STIMULUS-1',
    ]);
    expect(exploded.items.map((item) => item.resourceId)).toEqual(['ITEM-1']);
  });
});
