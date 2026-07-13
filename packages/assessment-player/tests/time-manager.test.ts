import { describe, expect, test } from 'bun:test';
import { TimeManager } from '../src/core/TimeManager.js';

describe('TimeManager scoped clocks', () => {
	test('tracks item, section, testPart, and assessment time independently', () => {
		let now = 1_000;
		const manager = new TimeManager({ now: () => now });
		manager.activateScopes({
			testPart: { identifier: 'part-1' },
			section: { identifier: 'section-1' },
			item: { identifier: 'item-1' },
		});

		now += 1_000;
		expect(manager.getScopeElapsedMs('assessment')).toBe(1_000);
		expect(manager.getScopeElapsedMs('testPart', 'part-1')).toBe(1_000);
		expect(manager.getScopeElapsedMs('section', 'section-1')).toBe(1_000);
		expect(manager.getScopeElapsedMs('item', 'item-1')).toBe(1_000);

		manager.activateScopes({
			testPart: { identifier: 'part-1' },
			section: { identifier: 'section-1' },
			item: { identifier: 'item-2' },
		});
		now += 2_000;
		expect(manager.getScopeElapsedMs('item', 'item-1')).toBe(1_000);
		expect(manager.getScopeElapsedMs('item', 'item-2')).toBe(2_000);
		expect(manager.getScopeElapsedMs('section', 'section-1')).toBe(3_000);
		expect(manager.getScopeElapsedMs('testPart', 'part-1')).toBe(3_000);

		manager.activateScopes({
			testPart: { identifier: 'part-1' },
			section: { identifier: 'section-2' },
			item: { identifier: 'item-3' },
		});
		now += 500;
		expect(manager.getScopeElapsedMs('section', 'section-1')).toBe(3_000);
		expect(manager.getScopeElapsedMs('section', 'section-2')).toBe(500);
		expect(manager.getScopeElapsedMs('testPart', 'part-1')).toBe(3_500);
		manager.destroy();
	});

	test('freezes all active scope clocks while paused', () => {
		let now = 10_000;
		const manager = new TimeManager({ now: () => now });
		manager.activateScopes({
			testPart: { identifier: 'part' },
			section: { identifier: 'section' },
			item: { identifier: 'item' },
		});
		now += 750;
		manager.pause();
		now += 10_000;
		expect(manager.getScopeElapsedMs('assessment')).toBe(750);
		expect(manager.getScopeElapsedMs('item', 'item')).toBe(750);
		manager.resume();
		now += 250;
		expect(manager.getScopeElapsedMs('assessment')).toBe(1_000);
		expect(manager.getScopeElapsedMs('section', 'section')).toBe(1_000);
		manager.destroy();
	});

	test('uses the nearest active scope limit for remaining time', () => {
		let now = 5_000;
		const manager = new TimeManager({ assessmentTimeLimits: { maxTime: 60 }, now: () => now });
		manager.activateScopes({
			testPart: { identifier: 'part', timeLimits: { maxTime: 30 } },
			section: { identifier: 'section', timeLimits: { maxTime: 20 } },
			item: { identifier: 'item', timeLimits: { maxTime: 5 } },
		});
		now += 2_000;
		expect(manager.getRemainingSeconds()).toBe(3);
		expect(manager.isExpired()).toBe(false);
		now += 3_000;
		expect(manager.getRemainingSeconds()).toBe(0);
		expect(manager.isExpired()).toBe(true);
		manager.destroy();
	});

	test('does not let an allow-late child scope mask an expired hard parent limit', () => {
		let now = 1_000;
		const manager = new TimeManager({
			assessmentTimeLimits: { maxTime: 10, allowLateSubmission: false },
			now: () => now,
		});
		manager.activateScopes({
			item: { identifier: 'item', timeLimits: { maxTime: 5, allowLateSubmission: true } },
		});

		now += 6_000;
		expect(manager.isExpired()).toBe(true);
		expect(manager.allowsLateSubmission()).toBe(true);

		now += 5_000;
		expect(manager.isExpired()).toBe(true);
		expect(manager.allowsLateSubmission()).toBe(false);
		manager.destroy();
	});

	test('round-trips independent scope clocks for save and resume', () => {
		let now = 2_000;
		const first = new TimeManager({ now: () => now });
		first.activateScopes({
			testPart: { identifier: 'part' },
			section: { identifier: 'section' },
			item: { identifier: 'item' },
		});
		now += 1_500;
		const saved = first.getState();
		first.destroy();

		const resumed = new TimeManager({ now: () => now });
		resumed.restoreState(saved);
		now += 500;

		expect(resumed.getScopeElapsedMs('assessment')).toBe(2_000);
		expect(resumed.getScopeElapsedMs('testPart', 'part')).toBe(2_000);
		expect(resumed.getScopeElapsedMs('section', 'section')).toBe(2_000);
		expect(resumed.getScopeElapsedMs('item', 'item')).toBe(2_000);
		resumed.destroy();
	});
});
