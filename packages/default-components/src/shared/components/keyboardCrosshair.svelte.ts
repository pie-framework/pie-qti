/**
 * The shared keyboard crosshair of the point-placement stages (select point,
 * position object): a normalized position on the stage ([0, 1] × [0, 1],
 * clamped) with the arrow-key movement both interactions share — 5% per press,
 * 1% with Shift for fine steps — and the active flag that shows the overlay.
 *
 * What each interaction keeps for itself: rounding (select point rounds the
 * point at placement, position object at emission) and every gate and refusal
 * (select point's maxChoices, position object's stage capacity, `canAddMore`
 * and its Escape-cancel), plus the announcements, which need the interaction's
 * i18n provider.
 */

export const CROSSHAIR_LARGE_STEP = 0.05;
export const CROSSHAIR_SMALL_STEP = 0.01;

export interface KeyboardCrosshair {
	/** Whether the crosshair overlay is visible (keyboard placement in progress). */
	readonly active: boolean;
	/** Normalized x on the stage, 0–1, clamped. */
	readonly x: number;
	/** Normalized y on the stage, 0–1, clamped. */
	readonly y: number;
	/** Move to the stage centre (the default starting position). */
	centre(): void;
	activate(): void;
	deactivate(): void;
	/** Jump to a normalized position, clamped to the stage. */
	jumpTo(x: number, y: number): void;
	/**
	 * One arrow-key step, fine when Shift is held. Moves nothing and returns
	 * false for any other key.
	 */
	move(key: string, fine: boolean): boolean;
}

export function createKeyboardCrosshair(
	options: { largeStep?: number; smallStep?: number } = {},
): KeyboardCrosshair {
	let active = $state(false);
	let x = $state(0.5);
	let y = $state(0.5);
	const large = options.largeStep ?? CROSSHAIR_LARGE_STEP;
	const small = options.smallStep ?? CROSSHAIR_SMALL_STEP;

	return {
		get active() {
			return active;
		},
		get x() {
			return x;
		},
		get y() {
			return y;
		},
		centre() {
			x = 0.5;
			y = 0.5;
		},
		activate() {
			active = true;
		},
		deactivate() {
			active = false;
		},
		jumpTo(nextX: number, nextY: number) {
			x = Math.max(0, Math.min(1, nextX));
			y = Math.max(0, Math.min(1, nextY));
		},
		move(key: string, fine: boolean): boolean {
			const step = fine ? small : large;
			switch (key) {
				case 'ArrowLeft':
					x = Math.max(0, x - step);
					break;
				case 'ArrowRight':
					x = Math.min(1, x + step);
					break;
				case 'ArrowUp':
					y = Math.max(0, y - step);
					break;
				case 'ArrowDown':
					y = Math.min(1, y + step);
					break;
				default:
					return false;
			}
			return true;
		},
	};
}
