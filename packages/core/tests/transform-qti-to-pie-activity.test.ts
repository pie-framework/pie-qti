import { describe, expect, test } from 'bun:test';
import type {
  ActivityContext,
  TransformContext,
  TransformInput,
  TransformOutput,
  TransformPlugin,
} from '@pie-qti/transform-types';
import { TransformQtiToPieActivity } from '../src/orchestration/activities/transform-qti-to-pie-activity';

const activityContext: ActivityContext = {
  activityId: 'activity-1',
  workflowId: 'workflow-1',
  attempt: 1,
  log() {},
  heartbeat() {},
  isCancelled: () => false,
};

class FormatCapturingPlugin implements TransformPlugin {
  readonly id = 'format-capturing-qti30-to-pie';
  readonly version = '1.0.0';
  readonly name = 'Format Capturing QTI 3.0 to PIE Plugin';
  readonly sourceFormat = 'qti30';
  readonly targetFormat = 'pie';
  receivedInput: TransformInput | null = null;

  async canHandle(): Promise<boolean> {
    return true;
  }

  async transform(input: TransformInput, _context: TransformContext): Promise<TransformOutput> {
    this.receivedInput = input;
    return {
      items: [
        {
          content: {
            id: 'item-1',
          },
          format: 'pie',
        },
      ],
      format: 'pie',
      metadata: {
        sourceFormat: input.format ?? 'unknown',
        targetFormat: 'pie',
        pluginId: this.id,
        timestamp: new Date(),
        itemCount: 1,
        processingTime: 0,
      },
    };
  }
}

describe('TransformQtiToPieActivity', () => {
  test('forwards the workflow sourceFormat to plugin TransformInput', async () => {
    const plugin = new FormatCapturingPlugin();

    const result = await TransformQtiToPieActivity.execute(activityContext, {
      xml: '<qti-assessment-item identifier="item-1"/>',
      itemId: 'item-1',
      sourceFormat: 'qti30',
      vendorInfo: null,
      plugin,
      context: {},
    });

    expect(plugin.receivedInput?.format).toBe('qti30');
    expect(plugin.receivedInput?.content).toBe('<qti-assessment-item identifier="item-1"/>');
    expect(result.pieConfig).toEqual({
      content: {
        id: 'item-1',
      },
      format: 'pie',
    });
  });
});
