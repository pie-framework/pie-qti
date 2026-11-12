<script lang="ts">
	import { AssessmentTimer } from '@pie-qti/assessment-player/components';

	type WarningListener = (remainingSeconds: number) => void;
	type ExpiredListener = (event: { autoFinalized: boolean }) => void;
	type TickListener = (remainingSeconds: number, elapsedSeconds: number) => void;
	type PauseListener = (paused: boolean) => void;

	let remainingSeconds = $state(300);
	let elapsedSeconds = $state(0);
	let isExpired = $state(false);
	let isPaused = $state(false);
	let timerHidden = $state(false);
	const warningListeners = new Set<WarningListener>();
	const expiredListeners = new Set<ExpiredListener>();
	const tickListeners = new Set<TickListener>();
	const pauseListeners = new Set<PauseListener>();

	const player = {
		getRemainingTime: () => remainingSeconds,
		getElapsedTime: () => elapsedSeconds,
		getTimeState: () => ({
			limited: true,
			remainingSeconds,
			elapsedSeconds,
			expired: isExpired,
			scope: 'assessment' as const,
			allowLateSubmission: false,
			paused: isPaused,
			started: true,
		}),
		isTimeExpired: () => isExpired,
		isPaused: () => isPaused,
		onTimeWarning(listener: WarningListener) {
			warningListeners.add(listener);
			return () => warningListeners.delete(listener);
		},
		onTimeExpired(listener: ExpiredListener) {
			expiredListeners.add(listener);
			return () => expiredListeners.delete(listener);
		},
		onTimeTick(listener: TickListener) {
			tickListeners.add(listener);
			return () => tickListeners.delete(listener);
		},
		onPauseChange(listener: PauseListener) {
			pauseListeners.add(listener);
			return () => pauseListeners.delete(listener);
		},
	};

	function sendTick() {
		remainingSeconds = Math.max(0, remainingSeconds - 30);
		elapsedSeconds += 30;
		for (const listener of tickListeners) listener(remainingSeconds, elapsedSeconds);
	}

	function sendWarning() {
		remainingSeconds = 60;
		for (const listener of warningListeners) listener(remainingSeconds);
	}

	function sendExpiry() {
		isExpired = true;
		remainingSeconds = 0;
		for (const listener of expiredListeners) listener({ autoFinalized: false });
	}

	function sendPause(next: boolean) {
		isPaused = next;
		for (const listener of pauseListeners) listener(next);
	}
</script>

<div class="space-y-3">
	<p class="text-sm text-base-content/70">
		Fixture for the candidate countdown: the ticking readout never announces (its live
		region is off), threshold warnings and expiry use their own separate regions, and the
		candidate can hide it.
	</p>

	<div class="flex flex-wrap gap-2">
		<button type="button" class="btn btn-sm" onclick={sendTick}>Simulate tick</button>
		<button type="button" class="btn btn-sm btn-warning" onclick={sendWarning}>Simulate warning</button>
		<button type="button" class="btn btn-sm btn-error" onclick={sendExpiry}>Simulate expiry</button>
		<button type="button" class="btn btn-sm" onclick={() => sendPause(!isPaused)}>Simulate pause</button>
	</div>

	<div class="border border-base-300 rounded-box p-4">
		<AssessmentTimer
			player={player as any}
			hidden={timerHidden}
			onToggleHidden={(hidden) => (timerHidden = hidden)}
		/>
	</div>
</div>
