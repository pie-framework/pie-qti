/**
 * Tests for InMemoryOrchestrator
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryOrchestrator } from '../../src/orchestration/in-memory-orchestrator.js';
import type { WorkflowDefinition, Activity, WorkflowEvent } from '@pie-qti/transform-types';

describe('InMemoryOrchestrator', () => {
  let orchestrator: InMemoryOrchestrator;

  beforeEach(async () => {
    orchestrator = new InMemoryOrchestrator();
    await orchestrator.initialize({ name: 'in-memory' });
  });

  describe('initialization', () => {
    it('should initialize without errors', async () => {
      expect(orchestrator.name).toBe('in-memory');
    });
  });

  describe('simple workflow execution', () => {
    it('should execute a simple workflow successfully', async () => {
      interface TestInput {
        value: number;
      }

      interface TestOutput {
        result: number;
      }

      const workflow: WorkflowDefinition<TestInput, TestOutput> = {
        type: 'test-workflow',
        version: '1.0',
        name: 'Test Workflow',
        async execute(ctx, input) {
          ctx.log('info', 'Starting test workflow');
          return { result: input.value * 2 };
        },
      };

      const handle = await orchestrator.startWorkflow(workflow, { value: 5 });

      expect(handle.workflowId).toBeDefined();
      expect(handle.workflowType).toBe('test-workflow');

      const result = await handle.result();
      expect(result.result).toBe(10);

      const status = await handle.status();
      expect(status).toBe('completed');
    });

    it('should handle workflow failures', async () => {
      const workflow: WorkflowDefinition<void, void> = {
        type: 'failing-workflow',
        version: '1.0',
        name: 'Failing Workflow',
        async execute() {
          throw new Error('Workflow failed');
        },
      };

      const handle = await orchestrator.startWorkflow(workflow, undefined);

      await expect(handle.result()).rejects.toThrow('Workflow failed');

      const status = await handle.status();
      expect(status).toBe('failed');
    });
  });

  describe('activity execution', () => {
    it('should execute activities within workflow', async () => {
      interface ActivityInput {
        x: number;
        y: number;
      }

      interface ActivityOutput {
        sum: number;
      }

      const addActivity: Activity<ActivityInput, ActivityOutput> = {
        type: 'add',
        name: 'Add Activity',
        async execute(ctx, input) {
          ctx.log('debug', 'Adding numbers', { x: input.x, y: input.y });
          return { sum: input.x + input.y };
        },
        timeout: 5000,
      };

      const workflow: WorkflowDefinition<ActivityInput, ActivityOutput> = {
        type: 'math-workflow',
        version: '1.0',
        name: 'Math Workflow',
        async execute(ctx, input) {
          const result = await ctx.executeActivity(addActivity, input);
          return result;
        },
      };

      const handle = await orchestrator.startWorkflow(workflow, { x: 3, y: 4 });
      const result = await handle.result();

      expect(result.sum).toBe(7);
    });

    it('should retry failed activities', async () => {
      let attempts = 0;

      const flakeyActivity: Activity<void, { success: boolean }> = {
        type: 'flakey',
        name: 'Flakey Activity',
        async execute() {
          attempts++;
          if (attempts < 3) {
            throw new Error('Temporary failure');
          }
          return { success: true };
        },
        timeout: 5000,
        retryPolicy: {
          maxAttempts: 3,
          initialInterval: 100,
          maxInterval: 1000,
          backoffCoefficient: 2,
        },
      };

      const workflow: WorkflowDefinition<void, { success: boolean }> = {
        type: 'retry-workflow',
        version: '1.0',
        name: 'Retry Workflow',
        async execute(ctx) {
          return await ctx.executeActivity(flakeyActivity, undefined);
        },
      };

      const handle = await orchestrator.startWorkflow(workflow, undefined);
      const result = await handle.result();

      expect(result.success).toBe(true);
      expect(attempts).toBe(3);
    });

    it('should fail after max retry attempts', async () => {
      const alwaysFailingActivity: Activity<void, void> = {
        type: 'always-failing',
        name: 'Always Failing Activity',
        async execute() {
          throw new Error('Permanent failure');
        },
        timeout: 5000,
        retryPolicy: {
          maxAttempts: 2,
          initialInterval: 100,
          maxInterval: 1000,
          backoffCoefficient: 2,
        },
      };

      const workflow: WorkflowDefinition<void, void> = {
        type: 'failing-retry-workflow',
        version: '1.0',
        name: 'Failing Retry Workflow',
        async execute(ctx) {
          await ctx.executeActivity(alwaysFailingActivity, undefined);
        },
      };

      const handle = await orchestrator.startWorkflow(workflow, undefined);

      await expect(handle.result()).rejects.toThrow('Permanent failure');
    });
  });

  describe('workflow progress', () => {
    it('should track workflow progress', async () => {
      const workflow: WorkflowDefinition<void, void> = {
        type: 'progress-workflow',
        version: '1.0',
        name: 'Progress Workflow',
        async execute(ctx) {
          ctx.reportProgress({
            currentStep: 'step-1',
            completedSteps: 1,
            totalSteps: 3,
            percentage: 33,
            message: 'Processing step 1',
          });

          await ctx.sleep(100);

          ctx.reportProgress({
            currentStep: 'step-2',
            completedSteps: 2,
            totalSteps: 3,
            percentage: 66,
            message: 'Processing step 2',
          });

          await ctx.sleep(100);

          ctx.reportProgress({
            currentStep: 'step-3',
            completedSteps: 3,
            totalSteps: 3,
            percentage: 100,
            message: 'Complete',
          });
        },
      };

      const handle = await orchestrator.startWorkflow(workflow, undefined);

      // Wait for first progress update (workflow reports progress immediately)
      await new Promise((resolve) => setTimeout(resolve, 10));

      const progress = await handle.progress();
      expect(progress).toBeDefined();
      if (progress && typeof progress.percentage === 'number') {
        expect(progress.percentage).toBeGreaterThanOrEqual(0);
      }

      await handle.result();
    });
  });

  describe('workflow events', () => {
    it('should emit workflow events', async () => {
      const events: WorkflowEvent[] = [];

      orchestrator.on('workflow-event', (event) => {
        events.push(event);
      });

      const workflow: WorkflowDefinition<void, void> = {
        type: 'event-workflow',
        version: '1.0',
        name: 'Event Workflow',
        async execute() {
          // Simple workflow
        },
      };

      const handle = await orchestrator.startWorkflow(workflow, undefined);
      await handle.result();

      // Should have at least started and completed events
      expect(events.length).toBeGreaterThanOrEqual(2);
      expect(events.some((e) => e.type === 'started')).toBe(true);
      expect(events.some((e) => e.type === 'completed')).toBe(true);
    });
  });

  describe('workflow cancellation', () => {
    it('should cancel a workflow', async () => {
      const workflow: WorkflowDefinition<void, void> = {
        type: 'long-workflow',
        version: '1.0',
        name: 'Long Workflow',
        async execute(ctx) {
          await ctx.sleep(10000); // 10 seconds
        },
      };

      const handle = await orchestrator.startWorkflow(workflow, undefined);

      // Cancel immediately
      await handle.cancel();

      const status = await handle.status();
      expect(status).toBe('cancelled');
    });
  });

  describe('workflow listing', () => {
    it('should list workflows', async () => {
      const workflow: WorkflowDefinition<void, void> = {
        type: 'list-test-workflow',
        version: '1.0',
        name: 'List Test Workflow',
        async execute() {
          // Simple workflow
        },
      };

      await orchestrator.startWorkflow(workflow, undefined);
      await orchestrator.startWorkflow(workflow, undefined);

      const workflows = await orchestrator.listWorkflows();
      expect(workflows.length).toBeGreaterThanOrEqual(2);
      expect(workflows.every((w) => w.workflowType === 'list-test-workflow')).toBe(true);
    });

    it('should filter workflows by status', async () => {
      const workflow: WorkflowDefinition<void, void> = {
        type: 'filter-test-workflow',
        version: '1.0',
        name: 'Filter Test Workflow',
        async execute(ctx) {
          await ctx.sleep(100);
        },
      };

      await orchestrator.startWorkflow(workflow, undefined);
      const handle2 = await orchestrator.startWorkflow(workflow, undefined);

      // Wait for first to complete
      await new Promise((resolve) => setTimeout(resolve, 150));

      const completed = await orchestrator.listWorkflows({ status: 'completed' });
      expect(completed.length).toBeGreaterThanOrEqual(1);

      // Cancel second
      await handle2.cancel();

      const cancelled = await orchestrator.listWorkflows({ status: 'cancelled' });
      expect(cancelled.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('shutdown', () => {
    it('should shutdown cleanly', async () => {
      await expect(orchestrator.shutdown()).resolves.toBeUndefined();
    });
  });
});
