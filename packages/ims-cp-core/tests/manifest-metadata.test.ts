import { describe, expect, test } from 'bun:test';
import { parseManifest } from '../src/manifest-parser';

function manifestWith(metadata: string, namespaces = ''): string {
	return `<?xml version="1.0" encoding="UTF-8"?>
<manifest xmlns="http://www.imsglobal.org/xsd/imscp_v1p1" ${namespaces} identifier="m-1">
  <resources>
    <resource identifier="item-1" type="imsqti_item_xmlv2p2" href="items/item-1.xml">
      <metadata>${metadata}</metadata>
      <file href="items/item-1.xml"/>
    </resource>
  </resources>
</manifest>`;
}

function metadataOf(manifestXml: string) {
	return parseManifest(manifestXml).resources.get('item-1')?.metadata;
}

describe('resource metadata', () => {
	test('reads prefixed IEEE LOM general and ignores classification descriptions', () => {
		const xml = manifestWith(
			`<imsmd:lom>
        <imsmd:general>
          <imsmd:identifier><imsmd:catalog>pie:baseId</imsmd:catalog><imsmd:entry>base-1</imsmd:entry></imsmd:identifier>
          <imsmd:title><imsmd:string language="es-ES">Ciclo del agua</imsmd:string></imsmd:title>
          <imsmd:language>es-ES</imsmd:language>
          <imsmd:description><imsmd:string language="es-ES">Ítem &lt;de&gt; prueba</imsmd:string></imsmd:description>
        </imsmd:general>
        <imsmd:classification>
          <imsmd:description><imsmd:string language="x-none">2</imsmd:string></imsmd:description>
        </imsmd:classification>
      </imsmd:lom>`,
			'xmlns:imsmd="http://ltsc.ieee.org/xsd/LOM"',
		);

		expect(metadataOf(xml)).toEqual({
			title: 'Ciclo del agua',
			description: 'Ítem <de> prueba',
			language: 'es-ES',
		});
	});

	test('reads LOM 1.2 langstring', () => {
		const xml = manifestWith(
			`<imsmd:lom>
        <imsmd:general>
          <imsmd:title><imsmd:langstring xml:lang="fr">Le cycle</imsmd:langstring></imsmd:title>
          <imsmd:language>fr</imsmd:language>
        </imsmd:general>
      </imsmd:lom>`,
			'xmlns:imsmd="http://www.imsglobal.org/xsd/imsmd_v1p2"',
		);

		expect(metadataOf(xml)).toEqual({ title: 'Le cycle', description: undefined, language: 'fr' });
	});

	test('reads no description from LOM that has only a classification', () => {
		const xml = manifestWith(
			`<imsmd:lom>
        <imsmd:classification>
          <imsmd:description><imsmd:string language="x-none">["3","4"]</imsmd:string></imsmd:description>
        </imsmd:classification>
      </imsmd:lom>`,
			'xmlns:imsmd="http://ltsc.ieee.org/xsd/LOM"',
		);

		expect(metadataOf(xml)).toBeUndefined();
	});

	test('reads unprefixed metadata outside LOM', () => {
		const xml = manifestWith('<title>Water</title><description>Cycle</description><language>en-US</language>');

		expect(metadataOf(xml)).toEqual({ title: 'Water', description: 'Cycle', language: 'en-US' });
	});
});
