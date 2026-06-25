import { describe, expect, test } from 'bun:test';
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
});
