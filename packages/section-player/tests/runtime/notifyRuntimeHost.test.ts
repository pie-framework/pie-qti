import { describe, expect, test } from 'bun:test';
import type {
  QtiSectionActiveItemChangeEvent,
  QtiSectionDisplaySettingsEvent,
  QtiSectionFrameworkError,
  QtiSectionResponseDeltaEvent,
  QtiSectionSnapshot,
  ResolvedQtiSectionComposition,
} from '../../src/index.js';
import {
  notifyActiveItemChange,
  notifyDisplaySettingsChange,
  notifyFrameworkError,
  notifyResponseDelta,
  notifySnapshotChange,
} from '../../src/runtime/notifyRuntimeHost.js';

function createComposition(
  events: {
    responses: QtiSectionResponseDeltaEvent[];
    activeItems: QtiSectionActiveItemChangeEvent[];
    snapshots: QtiSectionSnapshot[];
    errors: QtiSectionFrameworkError[];
  }
): ResolvedQtiSectionComposition {
  const snapshot: QtiSectionSnapshot = {
    sectionIdentifier: 'section-1',
    activeItemIdentifier: 'item-2',
    activeItemIndex: 1,
    itemCount: 2,
    responses: { 'item-2': {} },
  };

  return {
    section: {
      identifier: 'section-1',
      itemRefs: [
        { identifier: 'item-1', itemXml: '<assessmentItem identifier="item-1" />' },
        { identifier: 'item-2', itemXml: '<assessmentItem identifier="item-2" />' },
      ],
    },
    activeItem: { identifier: 'item-2', itemXml: '<assessmentItem identifier="item-2" />' },
    activeItemIndex: 1,
    sharedContext: {
      passages: [],
      stimuli: [],
      rubricBlocks: [],
      testFeedback: [],
      stylesheets: [],
      catalogSources: [],
      assetDiagnostics: [],
    },
    layout: 'split-pane',
    canPrevious: true,
    canNext: false,
    snapshot,
    diagnostics: [],
    host: {
      onResponseDelta: (event) => events.responses.push(event),
      onActiveItemChange: (event) => events.activeItems.push(event),
      onSnapshotChange: (nextSnapshot) => events.snapshots.push(nextSnapshot),
      onFrameworkError: (error) => events.errors.push(error),
    },
  };
}

describe('runtime host notifications', () => {
  test('forwards section runtime events to host callbacks', () => {
    const events = {
      responses: [] as QtiSectionResponseDeltaEvent[],
      activeItems: [] as QtiSectionActiveItemChangeEvent[],
      snapshots: [] as QtiSectionSnapshot[],
      errors: [] as QtiSectionFrameworkError[],
    };
    const composition = createComposition(events);

    const response = notifyResponseDelta(composition, 'item-2', 'RESPONSE', ['A']);
    notifyActiveItemChange(composition);
    notifySnapshotChange(composition);
    const frameworkError = notifyFrameworkError(composition, {
      code: 'item-player-load-failed',
      message: 'Unable to load the QTI item player.',
    });

    expect(response).toEqual({
      sectionIdentifier: 'section-1',
      itemIdentifier: 'item-2',
      responseIdentifier: 'RESPONSE',
      value: ['A'],
    });
    expect(events.responses).toEqual([response]);
    expect(events.activeItems).toEqual([
      {
        sectionIdentifier: 'section-1',
        itemIdentifier: 'item-2',
        itemIndex: 1,
        itemCount: 2,
      },
    ]);
    expect(events.snapshots).toEqual([composition.snapshot]);
    expect(frameworkError).toEqual({
      sectionIdentifier: 'section-1',
      itemIdentifier: 'item-2',
      code: 'item-player-load-failed',
      message: 'Unable to load the QTI item player.',
    });
    expect(events.errors).toEqual([frameworkError]);
  });

  test('reports the candidate\'s display settings with the profile the section renders with', () => {
    const composition = createComposition({ responses: [], activeItems: [], snapshots: [], errors: [] });
    const received: QtiSectionDisplaySettingsEvent[] = [];
    composition.host = { ...composition.host, onDisplaySettingsChange: (event) => received.push(event) };
    const settings = { textSize: 2 as const, highContrast: true, textSpacing: false };
    const pnp = { display: { colorScheme: 'blackwhite' as const, textAppearance: { fontSize: 16 } } };

    const event = notifyDisplaySettingsChange(composition, settings, pnp);

    expect(event).toEqual({ sectionIdentifier: 'section-1', settings, pnp });
    expect(received).toEqual([event]);
    // The event carries a copy: later changes to the caller's settings do not rewrite it.
    settings.highContrast = false;
    expect(event.settings.highContrast).toBe(true);
  });
});
