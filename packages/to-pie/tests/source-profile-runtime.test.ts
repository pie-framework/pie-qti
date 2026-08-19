/**
 * detectItemProfiles / detectPackageProfiles only run the extraction of profiles that
 * actually matched. `extractFromProfiles`/`extractFromPackageProfiles` trust their caller to
 * have already filtered to matches -- they call `extractItem`/`extractPackage` on every
 * profile handed to them, unconditionally. Passing the full, unfiltered profile list ran
 * every registered profile's extraction on every item, regardless of whether `detectItem`/
 * `detectPackage` matched it.
 */

import { describe, expect, test } from 'bun:test';
import type { QtiSourceProfile } from '@pie-qti/transform-types';
import { detectItemProfiles, detectPackageProfiles } from '../src/source-profile-runtime';

describe('detectItemProfiles', () => {
	test('does not run extraction for a registered profile that did not match', () => {
		let matchingExtractCalls = 0;
		let nonMatchingExtractCalls = 0;

		const matchingProfile: QtiSourceProfile = {
			id: 'matching-profile',
			detectItem() {
				return {
					profileId: 'matching-profile',
					scope: 'item',
					confidence: 1,
					capabilities: ['metadata'],
					evidence: [],
				};
			},
			extractItem() {
				matchingExtractCalls++;
				return { standardCandidates: [] };
			},
		};

		const nonMatchingProfile: QtiSourceProfile = {
			id: 'non-matching-profile',
			detectItem() {
				return null;
			},
			extractItem() {
				nonMatchingExtractCalls++;
				return { standardCandidates: [] };
			},
		};

		const result = detectItemProfiles(
			[matchingProfile, nonMatchingProfile],
			{ itemId: 'item-1' }
		);

		expect(result.matches).toHaveLength(1);
		expect(result.matches[0]?.profileId).toBe('matching-profile');
		expect(matchingExtractCalls).toBe(1);
		expect(nonMatchingExtractCalls).toBe(0);
	});
});

describe('detectPackageProfiles', () => {
	test('does not run extraction for a registered profile that did not match', () => {
		let nonMatchingExtractCalls = 0;

		const matchingProfile: QtiSourceProfile = {
			id: 'matching-profile',
			detectPackage() {
				return {
					profileId: 'matching-profile',
					scope: 'package',
					confidence: 1,
					capabilities: ['metadata'],
					evidence: [],
				};
			},
			extractPackage() {
				return { standardCandidates: [] };
			},
		};

		const nonMatchingProfile: QtiSourceProfile = {
			id: 'non-matching-profile',
			detectPackage() {
				return null;
			},
			extractPackage() {
				nonMatchingExtractCalls++;
				return { standardCandidates: [] };
			},
		};

		const result = detectPackageProfiles([matchingProfile, nonMatchingProfile], {
			packageId: 'pkg-1',
		});

		expect(result.matches).toHaveLength(1);
		expect(nonMatchingExtractCalls).toBe(0);
	});
});
