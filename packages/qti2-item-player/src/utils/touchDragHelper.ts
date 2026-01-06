/**
 * Touch-enabled drag helper for making HTML5 drag-and-drop work with touch devices
 *
 * HTML5 drag-and-drop API doesn't work on touch devices by default.
 * This helper translates touch events to pointer events for unified handling.
 *
 * Usage:
 * ```svelte
 * <div
 *   use:touchDrag
 *   draggable="true"
 *   ondragstart={...}
 * >
 * ```
 */

interface TouchDragState {
	element: HTMLElement;
	touchId: number | null;
	isDragging: boolean;
	startX: number;
	startY: number;
	currentX: number;
	currentY: number;
	dragThreshold: number;
}

/**
 * Svelte action to enable touch drag on draggable elements
 */
export function touchDrag(node: HTMLElement) {
	const state: TouchDragState = {
		element: node,
		touchId: null,
		isDragging: false,
		startX: 0,
		startY: 0,
		currentX: 0,
		currentY: 0,
		dragThreshold: 10 // px movement to initiate drag
	};

	function handleTouchStart(e: TouchEvent) {
		// Only handle single touch
		if (e.touches.length !== 1) return;

		// Check if element is draggable
		const draggable = node.getAttribute('draggable');
		if (draggable !== 'true') return;

		const touch = e.touches[0];
		state.touchId = touch.identifier;
		state.startX = touch.clientX;
		state.startY = touch.clientY;
		state.currentX = touch.clientX;
		state.currentY = touch.clientY;
		state.isDragging = false;

		// Add move and end listeners to document for consistent tracking
		document.addEventListener('touchmove', handleTouchMove, { passive: false });
		document.addEventListener('touchend', handleTouchEnd);
		document.addEventListener('touchcancel', handleTouchCancel);
	}

	function handleTouchMove(e: TouchEvent) {
		if (state.touchId === null) return;

		// Find the touch we're tracking
		const touch = Array.from(e.changedTouches).find(t => t.identifier === state.touchId);
		if (!touch) return;

		state.currentX = touch.clientX;
		state.currentY = touch.clientY;

		// Check if we've moved enough to start dragging
		const deltaX = state.currentX - state.startX;
		const deltaY = state.currentY - state.startY;
		const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

		if (!state.isDragging && distance > state.dragThreshold) {
			// Start drag
			state.isDragging = true;

			// Trigger dragstart event
			const dragStartEvent = new DragEvent('dragstart', {
				bubbles: true,
				cancelable: true,
				clientX: state.startX,
				clientY: state.startY
			});

			node.dispatchEvent(dragStartEvent);

			// Add visual feedback
			node.style.opacity = '0.5';
			e.preventDefault(); // Prevent scrolling
		}

		if (state.isDragging) {
			e.preventDefault(); // Prevent scrolling while dragging

			// Find element under touch point
			const elementUnder = document.elementFromPoint(state.currentX, state.currentY);

			if (elementUnder && elementUnder !== node) {
				// Trigger dragover on the element under touch
				const dragOverEvent = new DragEvent('dragover', {
					bubbles: true,
					cancelable: true,
					clientX: state.currentX,
					clientY: state.currentY
				});

				elementUnder.dispatchEvent(dragOverEvent);
			}
		}
	}

	function handleTouchEnd(e: TouchEvent) {
		if (state.touchId === null) return;

		// Find the touch we're tracking
		const touch = Array.from(e.changedTouches).find(t => t.identifier === state.touchId);
		if (!touch) return;

		if (state.isDragging) {
			// Find element under touch point at drop location
			const elementUnder = document.elementFromPoint(touch.clientX, touch.clientY);

			if (elementUnder) {
				// Trigger drop event
				const dropEvent = new DragEvent('drop', {
					bubbles: true,
					cancelable: true,
					clientX: touch.clientX,
					clientY: touch.clientY
				});

				elementUnder.dispatchEvent(dropEvent);
			}

			// Trigger dragend
			const dragEndEvent = new DragEvent('dragend', {
				bubbles: true,
				cancelable: true
			});

			node.dispatchEvent(dragEndEvent);

			// Reset visual feedback
			node.style.opacity = '';
		}

		cleanup();
	}

	function handleTouchCancel() {
		if (state.isDragging) {
			// Trigger dragend
			const dragEndEvent = new DragEvent('dragend', {
				bubbles: true,
				cancelable: true
			});

			node.dispatchEvent(dragEndEvent);

			// Reset visual feedback
			node.style.opacity = '';
		}

		cleanup();
	}

	function cleanup() {
		state.touchId = null;
		state.isDragging = false;

		document.removeEventListener('touchmove', handleTouchMove);
		document.removeEventListener('touchend', handleTouchEnd);
		document.removeEventListener('touchcancel', handleTouchCancel);
	}

	// Attach initial touch listener
	node.addEventListener('touchstart', handleTouchStart, { passive: true });

	return {
		destroy() {
			node.removeEventListener('touchstart', handleTouchStart);
			cleanup();
		}
	};
}

/**
 * CSS helper for touch-friendly drag interactions
 * Returns CSS that should be applied to draggable elements
 */
export const touchDragStyles = {
	/* Prevent text selection during drag */
	userSelect: 'none',
	webkitUserSelect: 'none',

	/* Allow touch events */
	touchAction: 'none',

	/* Cursor feedback */
	cursor: 'grab',

	/* Smooth transitions */
	transition: 'opacity 0.2s ease'
} as const;
