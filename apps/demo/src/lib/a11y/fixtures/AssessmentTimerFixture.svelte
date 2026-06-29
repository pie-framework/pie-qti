<script lang="ts">
	import { AssessmentTimer } from '@pie-qti/assessment-player/components';

	type WarningListener = (remainingSeconds: number) => void;
	type ExpiredListener = () => void;
	type TickListener = (remainingSeconds: number, elapsedSeconds: number) => void;

	let remainingSeconds = $state(300);
	let elapsedSeconds = $state(0);
	let isExpired = $state(false);
	const warningListeners = new Set<WarningListener>();
	const expiredListeners = new Set<ExpiredListener>();
	const tickListeners = new Set<TickListener>();

	const player = {
		getRemainingTime: () => remainingSeconds,
		getElapsedTime: () => elapsedSeconds,
		isTimeExpired: () => isExpired,
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
	};

	function sendWarning() {
		remainingSeconds = 60;
		for (const listener of warningListeners) listener(remainingSeconds);
	}

	function sendExpired() {
		isExpired = true;
		remainingSeconds = 0;
		for (const listener of expiredListeners) listener();
	}

	function sendTick() {
		remainingSeconds = Math.max(0, remainingSeconds - 30);
		elapsedSeconds += 30;
		for (const listener of tickListeners) listener(remainingSeconds, elapsedSeconds);
	}
</script>

<div class="space-y-3">
	<p class="text-sm text-base-content/70">
		Fixture for timer semantics, visible status, and screen reader warning announcements.
	</p>

	<div class="flex flex-wrap gap-2">
		<button type="button" class="btn btn-sm" onclick={sendTick}>Simulate tick</button>
		<button type="button" class="btn btn-sm btn-warning" onclick={sendWarning}>Simulate warning</button>
		<button type="button" class="btn btn-sm btn-error" onclick={sendExpired}>Simulate expiry</button>
	</div>

	<div class="relative min-h-32 border border-base-300 rounded-box p-4">
		<AssessmentTimer player={player as any} showElapsed={true} position="top-left" />
	</div>
</div>
