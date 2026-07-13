import { expect, test } from 'bun:test';

const component = await Bun.file(
	new URL('../src/plugins/graphic-associate/GraphicAssociateInteraction.svelte', import.meta.url),
).text();

test('graphic associate renders the label-bearing localized announcement as text', () => {
	expect(component).toContain('<span>{getSelectedHotspotAnnouncement(selectedHotspot)}</span>');
	expect(component).not.toMatch(/\{@html[^}]*selectAnotherHotspot/);
});
