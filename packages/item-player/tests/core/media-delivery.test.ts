import { describe, expect, test } from 'bun:test';
import { Player } from '../../src/core/Player.js';
import type { MediaInteractionData } from '../../src/interactions/shared/types.js';

function qti22MediaItem(media: string): string {
	return `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="media-delivery" title="Media delivery" adaptive="false" timeDependent="false">
	<responseDeclaration identifier="MEDIA" cardinality="single" baseType="integer"/>
	<itemBody>
		<mediaInteraction responseIdentifier="MEDIA" autostart="false" maxPlays="2">
			${media}
		</mediaInteraction>
	</itemBody>
</assessmentItem>`;
}

function qti3MediaItem(media: string): string {
	return `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="media-delivery" title="Media delivery" adaptive="false" time-dependent="false">
	<qti-response-declaration identifier="MEDIA" cardinality="single" base-type="integer"/>
	<qti-item-body>
		<qti-media-interaction response-identifier="MEDIA" autostart="false" max-plays="2">
			${media}
		</qti-media-interaction>
	</qti-item-body>
</qti-assessment-item>`;
}

function mediaInteraction(player: Player): MediaInteractionData {
	const [interaction] = player.getInteractionData() as unknown as MediaInteractionData[];
	if (!interaction) throw new Error('expected a media interaction');
	return interaction;
}

describe('mediaInteraction delivery', () => {
	test('delivers every source and caption track of a QTI 2.2 video', () => {
		const player = new Player({
			itemXml: qti22MediaItem(`
				<video width="640" height="360">
					<source src="https://cdn.example.com/clip.webm" type="video/webm"/>
					<source src="https://cdn.example.com/clip.mp4" type="video/mp4"/>
					<track kind="captions" srclang="en" label="English" src="https://cdn.example.com/captions.vtt" default="true"/>
				</video>
			`),
		});

		const { mediaElement } = mediaInteraction(player);
		expect(mediaElement.sources).toEqual([
			{ src: 'https://cdn.example.com/clip.webm', mimeType: 'video/webm' },
			{ src: 'https://cdn.example.com/clip.mp4', mimeType: 'video/mp4' },
		]);
		expect(mediaElement.tracks).toEqual([
			{ kind: 'captions', srclang: 'en', label: 'English', src: 'https://cdn.example.com/captions.vtt', default: true },
		]);
	});

	test('delivers every source and caption track of a QTI 3.0 audio element', () => {
		const player = new Player({
			itemXml: qti3MediaItem(`
				<audio>
					<source src="listen.mp3" type="audio/mpeg"/>
					<source src="listen.ogg" type="audio/ogg"/>
					<track kind="captions" srclang="en" src="listen.vtt"/>
				</audio>
			`),
		});

		const interaction = mediaInteraction(player);
		expect(interaction.maxPlays).toBe(2);
		expect(interaction.mediaElement.sources?.map((source) => source.src)).toEqual(['listen.mp3', 'listen.ogg']);
		expect(interaction.mediaElement.tracks?.map((track) => track.src)).toEqual(['listen.vtt']);
	});

	test('applies the URL policy to every source and track, not only the first source', () => {
		const player = new Player({
			itemXml: qti22MediaItem(`
				<video>
					<source src="https://cdn.example.com/clip.mp4" type="video/mp4"/>
					<source src="javascript:alert(1)" type="video/webm"/>
					<track kind="captions" srclang="en" src="javascript:alert(2)"/>
					<track kind="subtitles" srclang="es" src="http://insecure.example.com/es.vtt"/>
				</video>
			`),
			security: { urlPolicy: { allowHttps: true, allowHttp: false } },
		});

		const { mediaElement } = mediaInteraction(player);
		expect(mediaElement.src).toBe('https://cdn.example.com/clip.mp4');
		expect(mediaElement.sources?.map((source) => source.src)).toEqual(['https://cdn.example.com/clip.mp4', '']);
		expect(mediaElement.tracks?.map((track) => track.src)).toEqual(['', '']);
	});
});
