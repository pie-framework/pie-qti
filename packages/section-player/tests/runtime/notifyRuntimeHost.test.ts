import { describe, expect, test } from 'bun:test';
import type {
  QtiSectionActiveItemChangeEvent,
  QtiSectionFrameworkError,
  QtiSectionResponseDeltaEvent,
  QtiSectionSnapshot,
  ResolvedQtiSectionComposition,
} from '../../src/index.js';
import {
  notifyActiveItemChange,
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
});
