import { describe, expect, test } from 'bun:test';
import type { ActivityContext } from '@pie-qti/transform-types';
import { DetectFormatActivity } from '../../src/orchestration/activities/detect-format-activity';

const activityContext: ActivityContext = {
  activityId: 'activity-1',
  workflowId: 'workflow-1',
  attempt: 1,
  log() {},
  heartbeat() {},
  isCancelled: () => false,
};

const qti30Item = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="item-1">
  <qti-assessment-stem>
    <p>What is 2 + 2?</p>
  </qti-assessment-stem>
</qti-assessment-item>`;

const qti22Item = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="item-1">
  <prompt>What is 2 + 2?</prompt>
</assessmentItem>`;

const qti22ItemNoNamespace = `<assessmentItem identifier="item-1">
  <prompt>What is 2 + 2?</prompt>
</assessmentItem>`;

const pieItem = JSON.stringify({
  id: 'item-1',
  element: 'multiple-choice',
});

describe('DetectFormatActivity', () => {
  test('detects a QTI 3.0 item by its namespace, not as QTI 2.2', async () => {
    const result = await DetectFormatActivity.execute(activityContext, { content: qti30Item });
    expect(result.format).toBe('qti30');
  });

  test('detects a QTI 2.2 item by its namespace', async () => {
    const result = await DetectFormatActivity.execute(activityContext, { content: qti22Item });
    expect(result.format).toBe('qti22');
  });

  test('detects an unnamespaced camelCase assessmentItem as QTI 2.2', async () => {
    const result = await DetectFormatActivity.execute(activityContext, { content: qti22ItemNoNamespace });
    expect(result.format).toBe('qti22');
  });

  test('detects a PIE item object as pie', async () => {
    const result = await DetectFormatActivity.execute(activityContext, {
      content: { id: 'item-1', element: 'multiple-choice' },
    });
    expect(result.format).toBe('pie');
  });

  test('detects a PIE JSON string as pie', async () => {
    const result = await DetectFormatActivity.execute(activityContext, { content: pieItem });
    expect(result.format).toBe('pie');
  });

  test('throws for content that is neither PIE nor QTI', async () => {
    expect(DetectFormatActivity.execute(activityContext, { content: 'not qti at all' })).rejects.toThrow(
      'Unable to detect content format',
    );
  });
});
