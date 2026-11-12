import { INTERACTION_SLOT_ATTRIBUTE } from '../../presentation/interactionSlots.js';
import type { HtmlContent } from '../../types/index.js';
import { deepActiveElement } from './focus.js';

/** The part of an interaction mount the renderer needs: its identity and where it goes. */
export interface SlottedMount {
	readonly key: string;
	/** The slot in the body HTML; null renders the interaction after the body. */
	readonly slot: string | null;
}

/** One live interaction: the element placed at its slot, kept while its key is stable. */
export interface MountedInteraction<M extends SlottedMount> {
	readonly element: HTMLElement;
	/** Apply a newer presentation of the same interaction. */
	update(mount: M): void;
	/** After every render, the slot the element sits in, or null when it renders after the body. */
	placed?(slot: Element | null): void;
	destroy(): void;
}

export interface ItemBodyRendererOptions<M extends SlottedMount> {
	create(mount: M): MountedInteraction<M>;
	onError?(mount: M, error: unknown): void;
}

export interface ItemBodyRenderer<M extends SlottedMount> {
	/** Render the finalized body HTML and place every mount at its slot. */
	render(html: HtmlContent, mounts: readonly M[]): void;
	destroy(): void;
}

/** Class of the area after the body where an interaction with no slot renders. */
export const UNSLOTTED_CLASS = 'qti-item-body-unslotted';

/**
 * Renders an item presentation into `container`: the body HTML once, with every interaction
 * mounted into the slot element that marks its authored position.
 *
 * Interactions are keyed. A response change re-renders nothing but the changed props, and the
 * body HTML is only replaced when its markup changes (feedback, template or printed-variable
 * content after response processing). Then the new body is inserted before the old one is
 * removed and each live interaction is moved into its new slot — with `moveBefore` where the
 * browser has it, which keeps focus, iframes and media state — so interactions never remount
 * and focus is restored if the move dropped it.
 */
export function createItemBodyRenderer<M extends SlottedMount>(
	container: HTMLElement,
	options: ItemBodyRendererOptions<M>
): ItemBodyRenderer<M> {
	const entries = new Map<string, MountedInteraction<M>>();
	let renderedMarkup: string | null = null;
	let unslotted: HTMLElement | null = null;
	let destroyed = false;

	const ensureUnslotted = (): HTMLElement => {
		if (!unslotted) {
			unslotted = container.ownerDocument.createElement('div');
			unslotted.className = UNSLOTTED_CLASS;
			container.append(unslotted);
		}
		return unslotted;
	};

	const retire = (key: string, entry: MountedInteraction<M>) => {
		entries.delete(key);
		try {
			entry.destroy();
		} finally {
			entry.element.remove();
		}
	};

	const replaceBody = (html: HtmlContent, nextSlots: ReadonlyMap<string, string | null>) => {
		const focus = captureFocus(container);
		const template = container.ownerDocument.createElement('template');
		// A TrustedHTML value is assigned as-is, so an enforcing Trusted Types policy governs it.
		template.innerHTML = html as unknown as string;
		const freshSlots = collectSlots(template.content);
		const previous = Array.from(container.childNodes).filter((node) => node !== unslotted);
		container.insertBefore(template.content, unslotted);
		for (const [key, entry] of entries) {
			const slot = nextSlots.get(key);
			const target = slot == null ? undefined : freshSlots.get(slot);
			if (target) moveInto(target, entry.element, null);
			else if (previous.some((node) => node.contains(entry.element))) {
				moveInto(ensureUnslotted(), entry.element, null);
			}
		}
		for (const node of previous) node.remove();
		focus.restore();
	};

	const placeUnslotted = (order: readonly HTMLElement[]) => {
		if (order.length === 0) {
			if (unslotted && !unslotted.hasChildNodes()) {
				unslotted.remove();
				unslotted = null;
			}
			return;
		}
		const area = ensureUnslotted();
		let cursor = area.firstChild;
		for (const element of order) {
			if (element === cursor) {
				cursor = cursor.nextSibling;
				continue;
			}
			moveInto(area, element, cursor);
		}
	};

	return {
		render(html, mounts) {
			if (destroyed) return;
			const nextSlots = new Map(mounts.map((mount) => [mount.key, mount.slot]));
			// Retire interactions that went away first, so what they render never coexists with
			// a replacement that renders the same ids.
			for (const [key, entry] of [...entries]) {
				if (!nextSlots.has(key)) retire(key, entry);
			}

			const markup = typeof html === 'string' ? html : String(html);
			if (markup !== renderedMarkup) {
				replaceBody(html, nextSlots);
				renderedMarkup = markup;
			}

			const slots = collectSlots(container);
			const unslottedOrder: HTMLElement[] = [];
			const placements: Array<[MountedInteraction<M>, Element | null]> = [];
			for (const mount of mounts) {
				let entry = entries.get(mount.key);
				try {
					if (entry) entry.update(mount);
					else {
						entry = options.create(mount);
						entries.set(mount.key, entry);
					}
				} catch (error) {
					options.onError?.(mount, error);
				}
				if (!entry) continue;
				const slot = mount.slot === null ? null : (slots.get(mount.slot) ?? null);
				if (slot) {
					if (entry.element.parentNode !== slot) moveInto(slot, entry.element, null);
				} else {
					unslottedOrder.push(entry.element);
				}
				placements.push([entry, slot]);
			}
			placeUnslotted(unslottedOrder);
			for (const [entry, slot] of placements) entry.placed?.(slot);
		},
		destroy() {
			destroyed = true;
			for (const [key, entry] of [...entries]) retire(key, entry);
		},
	};
}

/** The slot elements under `root`, keyed by slot id; the first wins should an id repeat. */
function collectSlots(root: ParentNode): Map<string, Element> {
	const slots = new Map<string, Element>();
	for (const element of Array.from(root.querySelectorAll(`[${INTERACTION_SLOT_ATTRIBUTE}]`))) {
		const slot = element.getAttribute(INTERACTION_SLOT_ATTRIBUTE);
		if (slot !== null && !slots.has(slot)) slots.set(slot, element);
	}
	return slots;
}

type MoveCapableParent = ParentNode & { moveBefore?: (node: Node, child: Node | null) => void };

/**
 * Move `node` under `parent`. `moveBefore` moves a connected node without disconnecting it, so an
 * iframe does not reload, media keeps playing and focus stays; elsewhere it is a plain insert.
 */
export function moveInto(parent: Node & ParentNode, node: Node, before: Node | null): void {
	const movable = parent as MoveCapableParent;
	if (typeof movable.moveBefore === 'function' && node.isConnected && parent.isConnected) {
		try {
			movable.moveBefore(node, before);
			return;
		} catch {
			// Different trees, or a node the browser cannot move atomically.
		}
	}
	parent.insertBefore(node, before);
}

/**
 * Remember the focused element inside `container`, to give focus back to it should replacing
 * the body take it away (a plain DOM move blurs the moved subtree).
 */
function captureFocus(container: HTMLElement): { restore(): void } {
	const root = container.getRootNode() as Document | ShadowRoot;
	const outer = root.activeElement;
	if (!outer || !container.contains(outer)) return { restore() {} };
	const focused = deepActiveElement(root) as HTMLElement | null;
	return {
		restore() {
			if (!focused?.isConnected || deepActiveElement(root) === focused) return;
			focused.focus?.({ preventScroll: true });
		},
	};
}
