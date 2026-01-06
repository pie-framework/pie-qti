export interface ConformanceCaseFile {
	/** Fixture id (should match the fixture folder name) */
	id: string;
	/** Optional deterministic seed for randomness/template processing */
	seed?: number;
	cases: ConformanceCase[];
}

export interface ConformanceCase {
	name: string;
	/** Response map keyed by response identifier */
	responses: Record<string, unknown>;
	expect: ConformanceExpectations;
	/**
	 * If true, this case is expected to fail (known gap).
	 * The test will PASS if an assertion fails or an error is thrown,
	 * and FAIL if it unexpectedly passes.
	 */
	xfail?: boolean;
	xfailReason?: string;
	/** If true, run `submitAttempt()` (adaptive) instead of `processResponses()` */
	useSubmitAttempt?: boolean;
	/** Passed to `submitAttempt(countAttempt)` when `useSubmitAttempt` is true */
	countAttempt?: boolean;
}

export interface ConformanceExpectations {
	score?: number;
	maxScore?: number;
	outcomes?: Record<string, unknown>;
	/** Substrings expected to be present in `player.getItemBodyHtml()` */
	itemBodyContains?: string[];
	/** Modal feedback identifiers (order-insensitive) */
	modalFeedbackIdentifiers?: string[];
	/** Known unsupported feature codes (future-proofing) */
	unsupported?: string[];
	/** Warning codes/messages (future-proofing) */
	warnings?: string[];
}

export interface ConformanceFixtureManifest {
	source?: string;
	upstreamUrl?: string;
	license?: string;
	notes?: string;
	/**
	 * Optional list of coverage tags (operators/statements/features) for reporting.
	 * Example: ["responseCondition", "match", "setOutcomeValue"]
	 */
	covers?: string[];
}


