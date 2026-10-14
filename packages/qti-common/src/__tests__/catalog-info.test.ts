/**
 * QTI 3 catalog info
 *
 * Catalog cards written as QTI 3.0 `qti-catalog-info`: one `qti-card` per card, HTML and SSML as
 * `qti-html-content`, media as `qti-file-href` with a MIME type and the time range as a fragment.
 */

import { describe, expect, test } from 'bun:test';
import { writeQtiCatalogInfo } from '../accessibility/index.js';

describe('writeQtiCatalogInfo', () => {
	test('writes a card per support and language', () => {
		expect(
			writeQtiCatalogInfo([
				{
					identifier: 'cat-stem',
					cards: [
						{ catalog: 'glossary-on-screen', content: '<p>A &amp; B</p>' },
						{ catalog: 'keyword-translation', language: 'es', content: 'la cuenta' },
					],
				},
			]),
		).toBe(
			'<qti-catalog-info><qti-catalog id="cat-stem">' +
				'<qti-card support="glossary-on-screen"><qti-html-content><p>A &amp; B</p></qti-html-content></qti-card>' +
				'<qti-card support="keyword-translation" xml:lang="es"><qti-html-content>la cuenta</qti-html-content></qti-card>' +
				'</qti-catalog></qti-catalog-info>',
		);
	});

	test('puts a speak script in the SSML namespace and passes other HTML through the serializer', () => {
		const xml = writeQtiCatalogInfo(
			[
				{
					identifier: 'c',
					cards: [
						{ catalog: 'spoken', content: '<speak>Say <emphasis>this</emphasis></speak>' },
						{ catalog: 'long-description', content: '<p>x<br></p>' },
					],
				},
			],
			{ html: (content) => content.replace('<br>', '<br/>') },
		);
		expect(xml).toContain(
			'<qti-html-content><speak xmlns="http://www.w3.org/2001/10/synthesis">Say <emphasis>this</emphasis></speak></qti-html-content>',
		);
		expect(xml).toContain('<qti-html-content><p>x<br/></p></qti-html-content>');
	});

	test('writes each media source with its MIME type and the time range', () => {
		const xml = writeQtiCatalogInfo([
			{
				identifier: 'c',
				cards: [
					{
						catalog: 'spoken',
						payload: {
							media: {
								version: 1,
								id: 'a',
								kind: 'audio',
								sources: [{ src: 'audio/stem.mp3' }, { src: 'audio/stem.ogg', type: 'audio/ogg' }, { src: 'x.bin' }],
							},
							fragment: { startSeconds: 1.5, endSeconds: 3.75 },
						},
					},
					{
						catalog: 'sign-language',
						language: 'ase',
						payload: { media: { version: 1, id: 'v', kind: 'video', sources: [{ src: 'asl.mp4' }] } },
					},
				],
			},
		]);
		expect(xml).toContain(
			'<qti-card support="spoken">' +
				'<qti-file-href mime-type="audio/mpeg">audio/stem.mp3#t=1.5,3.75</qti-file-href>' +
				'<qti-file-href mime-type="audio/ogg">audio/stem.ogg#t=1.5,3.75</qti-file-href>' +
				'<qti-file-href mime-type="application/octet-stream">x.bin#t=1.5,3.75</qti-file-href></qti-card>',
		);
		expect(xml).toContain(
			'<qti-card support="sign-language" xml:lang="ase"><qti-file-href mime-type="video/mp4">asl.mp4</qti-file-href></qti-card>',
		);
	});

	test('skips cards without a body and catalogs without a card', () => {
		expect(writeQtiCatalogInfo([])).toBe('');
		expect(writeQtiCatalogInfo([{ identifier: 'c', cards: [{ catalog: 'spoken', content: ' ' }] }])).toBe('');
	});
});
