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

export function touchDrag(node: HTMLElement) {
	const state: TouchDragState = {
		element: node,
		touchId: null,
		isDragging: false,
		startX: 0,
		startY: 0,
		currentX: 0,
		currentY: 0,
		dragThreshold: 10,
	};

	function handleTouchStart(e: TouchEvent) {
		if (e.touches.length !== 1) return;

		const draggable = node.getAttribute('draggable');
		if (draggable !== 'true') return;

		const touch = e.touches[0];
		state.touchId = touch.identifier;
		state.startX = touch.clientX;
		state.startY = touch.clientY;
		state.currentX = touch.clientX;
		state.currentY = touch.clientY;
		state.isDragging = false;

		document.addEventListener('touchmove', handleTouchMove, { passive: false });
		document.addEventListener('touchend', handleTouchEnd);
		document.addEventListener('touchcancel', handleTouchCancel);
	}

	function handleTouchMove(e: TouchEvent) {
		if (state.touchId === null) return;

		const touch = Array.from(e.changedTouches).find(t => t.identifier === state.touchId);
		if (!touch) return;

		state.currentX = touch.clientX;
		state.currentY = touch.clientY;

		const deltaX = state.currentX - state.startX;
		const deltaY = state.currentY - state.startY;
		const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

		if (!state.isDragging && distance > state.dragThreshold) {
			state.isDragging = true;

			const dragStartEvent = new DragEvent('dragstart', {
				bubbles: true,
				cancelable: true,
				clientX: state.startX,
				clientY: state.startY,
			});

			node.dispatchEvent(dragStartEvent);
			node.style.opacity = '0.5';
			e.preventDefault();
		}

		if (state.isDragging) {
			e.preventDefault();

			const elementUnder = document.elementFromPoint(state.currentX, state.currentY);
			if (elementUnder && elementUnder !== node) {
				const dragOverEvent = new DragEvent('dragover', {
					bubbles: true,
					cancelable: true,
					clientX: state.currentX,
					clientY: state.currentY,
				});

				elementUnder.dispatchEvent(dragOverEvent);
			}
		}
	}

	function handleTouchEnd(e: TouchEvent) {
		if (state.touchId === null) return;

		const touch = Array.from(e.changedTouches).find(t => t.identifier === state.touchId);
		if (!touch) return;

		if (state.isDragging) {
			const elementUnder = document.elementFromPoint(touch.clientX, touch.clientY);
			if (elementUnder) {
				const dropEvent = new DragEvent('drop', {
					bubbles: true,
					cancelable: true,
					clientX: touch.clientX,
					clientY: touch.clientY,
				});

				elementUnder.dispatchEvent(dropEvent);
			}

			const dragEndEvent = new DragEvent('dragend', {
				bubbles: true,
				cancelable: true,
			});

			node.dispatchEvent(dragEndEvent);
			node.style.opacity = '';
		}

		cleanup();
	}

	function handleTouchCancel() {
		if (state.isDragging) {
			const dragEndEvent = new DragEvent('dragend', {
				bubbles: true,
				cancelable: true,
			});
			node.dispatchEvent(dragEndEvent);
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

	node.addEventListener('touchstart', handleTouchStart, { passive: true });

	return {
		destroy() {
			node.removeEventListener('touchstart', handleTouchStart);
			cleanup();
		},
	};
}

export const touchDragStyles = {
	userSelect: 'none',
	webkitUserSelect: 'none',
	touchAction: 'none',
	cursor: 'grab',
	transition: 'opacity 0.2s ease',
} as const;
