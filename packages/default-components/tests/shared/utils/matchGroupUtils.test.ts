import { describe, expect, it } from 'bun:test';
import { isMatchGroupCompatible } from '@pie-qti/item-player';
import { type MatchGroupBearer, isCompatibleMatchGroup } from '../../../src/shared/utils/matchGroupUtils';

const choice = (identifier: string, ...matchGroup: string[]): MatchGroupBearer =>
	matchGroup.length > 0 ? { identifier, matchGroup } : { identifier };

describe('isCompatibleMatchGroup (the UI pairing rule)', () => {
	it('allows the pairs the QTI partner-identifier reading allows', () => {
		// QTI 2.2/3.0: matchGroup lists the identifiers each side may be matched with. The
		// former label-only UI rule blocked this spec-legal pair ([G1] and [W1] share no token).
		expect(isCompatibleMatchGroup(choice('W1', 'G1'), choice('G1', 'W1'))).toBe(true);
		expect(isCompatibleMatchGroup(choice('A', 'C', 'D'), choice('C', 'A'))).toBe(true);
	});

	it('refuses a pair neither reading allows', () => {
		expect(isCompatibleMatchGroup(choice('W2', 'G2'), choice('G1', 'W1'))).toBe(false);
		expect(isCompatibleMatchGroup(choice('A', 'set-a'), choice('C', 'set-b'))).toBe(false);
	});

	it('also accepts tokens shared as group labels, like response validation', () => {
		expect(isCompatibleMatchGroup(choice('A', 'set-a'), choice('B', 'set-a', 'set-b'))).toBe(true);
	});

	it('treats an absent or empty matchGroup, or an unknown side, as unrestricted', () => {
		expect(isCompatibleMatchGroup(choice('A'), choice('B', 'X'))).toBe(true);
		expect(isCompatibleMatchGroup({ identifier: 'A', matchGroup: [] }, choice('B', 'X'))).toBe(true);
		expect(isCompatibleMatchGroup(undefined, choice('B', 'X'))).toBe(true);
	});

	it('agrees with response validation on every case (no UI-only rule)', () => {
		const sides = [
			choice('A'),
			choice('B', 'A'),
			choice('C', 'set-a'),
			choice('D', 'set-a', 'B'),
			choice('E', 'Z'),
		];
		for (const a of sides) {
			for (const b of sides) {
				expect(isCompatibleMatchGroup(a, b)).toBe(
					isMatchGroupCompatible(
						{ identifier: a.identifier, matchGroup: a.matchGroup ?? [] },
						{ identifier: b.identifier, matchGroup: b.matchGroup ?? [] },
					),
				);
			}
		}
	});
});
