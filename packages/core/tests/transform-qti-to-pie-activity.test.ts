import { describe, expect, test } from 'bun:test';
import type { ActivityContext, TransformInput } from '@pie-qti/transform-types';
import { MockTransformPlugin } from '@pie-qti/test-utils';
import { TransformQtiToPieActivity } from '../src/orchestration/activities/transform-qti-to-pie-activity';

const activityContext: ActivityContext = {
  activityId: 'activity-1',
  workflowId: 'workflow-1',
  attempt: 1,
  log() {},
  heartbeat() {},
  isCancelled: () => false,
};

function createFormatCapturingPlugin(): MockTransformPlugin {
  return new MockTransformPlugin('format-capturing-qti30-to-pie', 'qti30', 'pie', {
    name: 'Format Capturing QTI 3.0 to PIE Plugin',
    mockItems: [
      {
        content: {
          id: 'item-1',
        },
        format: 'pie',
      },
    ],
    mockMetadata: {
      qtiVersion: '3.0',
    },
  });
}

describe('TransformQtiToPieActivity', () => {
  test('forwards the workflow sourceFormat to plugin TransformInput', async () => {
    const plugin = createFormatCapturingPlugin();

    const result = await TransformQtiToPieActivity.execute(activityContext, {
      xml: '<qti-assessment-item identifier="item-1"/>',
      itemId: 'item-1',
      sourceFormat: 'qti30',
      vendorInfo: null,
      plugin,
      context: {},
    });

    expect(plugin.getLastInput()?.format).toBe('qti30');
    expect(plugin.getLastInput()?.content).toBe('<qti-assessment-item identifier="item-1"/>');
    expect(result.pieConfig).toEqual({
      content: {
        id: 'item-1',
      },
      format: 'pie',
    });
    expect(result.metadata.qtiVersion).toBe('3.0');
  });
});
