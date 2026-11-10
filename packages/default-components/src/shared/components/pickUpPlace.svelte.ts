/**
 * The pick-up/place flow of the drag-and-drop surfaces — gap match, graphic gap match, match
 * (MatchDragDrop) and the sortable list. One item at a time is held: picked up with the
 * keyboard or a pointer activation (the single-pointer alternative to dragging, WCAG 2.5.7),
 * then placed on a target or put down. A pointer drag is tracked beside it, so what a drop
 * would place — the dragged item during a drag, else the held one — is the one value each
 * interaction marks its refusing targets from.
 *
 * The rules every surface shares live here: activating the held item again puts it down and
 * activating another one switches to it; a refused placement keeps the item held, so the
 * candidate can try another target or cancel, and an accepted one puts it down; Escape puts it
 * down.
 *
 * What each interaction keeps for itself: which items may be picked up and which targets take
 * them (capacity, matchGroup), how a placement changes the response, the announcements (each
 * has its own i18n keys), whether Escape prevents the default, and where focus goes.
 */

export interface PickUpPlace {
	/** The held item's identifier, or null. */
	readonly held: string | null;
	/** The item a pointer drag is carrying, or null. */
	readonly dragged: string | null;
	/** What a drop would place: the dragged item during a drag, else the held one. */
	readonly active: string | null;
	/** Whether `id` is the held item. */
	isHeld(id: string): boolean;
	/** Pick `id` up, or put it down when it is the held item. Returns whether `id` is held now. */
	toggle(id: string): boolean;
	/**
	 * Place the held item on `target` through `attempt`, which applies the placement and
	 * returns whether it was accepted. An accepted placement puts the item down and returns
	 * it; a refused one keeps it held and returns null, as does holding nothing.
	 */
	place<T>(target: T, attempt: (item: string, target: T) => boolean): string | null;
	/** Put the held item down without placing it (Escape, or a move made another way). Returns it, or null. */
	release(): string | null;
	/** A pointer drag of `id` starts. */
	startDrag(id: string): void;
	/** The pointer drag dropped or ended. */
	endDrag(): void;
}

export function createPickUpPlace(): PickUpPlace {
	let held = $state<string | null>(null);
	let dragged = $state<string | null>(null);

	return {
		get held() {
			return held;
		},
		get dragged() {
			return dragged;
		},
		get active() {
			return dragged ?? held;
		},
		isHeld(id: string): boolean {
			return held === id;
		},
		toggle(id: string): boolean {
			held = held === id ? null : id;
			return held === id;
		},
		place<T>(target: T, attempt: (item: string, target: T) => boolean): string | null {
			const item = held;
			if (item === null || !attempt(item, target)) return null;
			held = null;
			return item;
		},
		release(): string | null {
			const item = held;
			held = null;
			return item;
		},
		startDrag(id: string): void {
			dragged = id;
		},
		endDrag(): void {
			dragged = null;
		},
	};
}
