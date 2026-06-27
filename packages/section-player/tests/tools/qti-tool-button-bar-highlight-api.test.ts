import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(import.meta.dir, '../../src/components/QtiToolButtonBar.svelte'), 'utf8');

describe('QtiToolButtonBar TTS highlight API integration', () => {
	test('uses the public pie-players highlight resolver instead of private coordinator patching', () => {
		expect(source).toContain('ttsHighlightTargetResolver');
		expect(source).not.toContain('(coordinator as any).highlightCoordinator');
		expect(source).not.toContain('highlightCoordinator.highlightTTSWord =');
		expect(source).not.toContain('highlightCoordinator.highlightTTSSentence =');
		expect(source).not.toContain('highlightCoordinator.clearTTSWord =');
		expect(source).not.toContain('highlightCoordinator.clearTTS =');
		expect(source).not.toContain('ttsSentenceElementHighlights');
		expect(source).not.toContain('__qtiSection');
		expect(source).not.toContain('data-pie-qti-tts-word-range-fallback');
	});
});
