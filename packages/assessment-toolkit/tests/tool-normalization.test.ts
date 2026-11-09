import { describe, expect, test } from 'bun:test';
import { filterToolsForRole, type QtiSectionToolConfig } from '@pie-qti/section-player';
import { normalizeQtiToolConfig } from '../src/index.js';

describe('normalizeQtiToolConfig', () => {
  test('keeps enabled tools visible to the current role', () => {
    const tools = normalizeQtiToolConfig({
      role: 'candidate',
      tools: [
        { toolId: 'textToSpeech', label: 'Read aloud', view: ['candidate'] },
        { toolId: 'calculator', label: 'Calculator', view: ['candidate'] },
      ],
    });

    expect(tools.map((tool) => tool.toolId)).toEqual(['textToSpeech', 'calculator']);
  });

  test('filters disabled and role-hidden tools', () => {
    const tools = normalizeQtiToolConfig({
      role: 'candidate',
      tools: [
        { toolId: 'textToSpeech', view: ['candidate'] },
        { toolId: 'scorer-notes', view: ['scorer'] },
        { toolId: 'calculator', enabled: false },
      ],
    });

    expect(tools.map((tool) => tool.toolId)).toEqual(['textToSpeech']);
  });

  test('is the section player tool filter without PNP, as an array', () => {
    const tools: QtiSectionToolConfig[] = [
      { toolId: 'textToSpeech', view: ['candidate'] },
      { toolId: 'scorer-notes', view: ['scorer'] },
      { toolId: 'calculator', enabled: false },
    ];

    for (const role of ['candidate', 'scorer', undefined] as const) {
      expect(normalizeQtiToolConfig({ role, tools })).toEqual(filterToolsForRole(tools, role) ?? []);
    }
    expect(normalizeQtiToolConfig({ role: 'candidate', tools: [{ toolId: 'calculator', enabled: false }] })).toEqual([]);
    expect(normalizeQtiToolConfig({})).toEqual([]);
  });
});
