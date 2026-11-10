/**
 * The polite live-region announcer every interaction shares.
 *
 * A live region announces a change of its text; announcing the same sentence
 * twice therefore needs the text to change again, invisibly. The helper holds
 * the region's text and appends a trailing zero-width space (silent to screen
 * readers) when the same message is announced again. Components keep their
 * own region markup — classes, parts, `aria-*` — and bind `message` to it.
 *
 * The rule and the toggle live here once; what each interaction announces
 * stays its own.
 */

export interface Announcer {
	/** The text the live region currently holds (bind this to it). */
	readonly message: string;
	/** Announce `message` through the region; a repeat still changes the DOM. */
	announce(message: string): void;
	/**
	 * State the region's text without the re-announce toggle, for messages the
	 * interaction writes directly (a repeat leaves the DOM unchanged, as before).
	 */
	set(message: string): void;
	/** Empty the region, so the next announcement is a fresh change. */
	clear(): void;
}

export function createAnnouncer(): Announcer {
	let message = $state('');

	return {
		get message() {
			return message;
		},
		announce(next: string) {
			message = message === next ? `${next}\u200b` : next;
		},
		set(next: string) {
			message = next;
		},
		clear() {
			message = '';
		},
	};
}
