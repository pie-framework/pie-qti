export interface PanelResizeState {
	leftPanelWidth: number;
	isDragging: boolean;
}

export function handleDividerMouseDown(
	event: MouseEvent,
	setState: (isDragging: boolean) => void
): void {
	setState(true);
	document.body.classList.add('resizing');
	event.preventDefault();
}

export function handleMouseMove(
	event: MouseEvent,
	isDragging: boolean,
	setWidth: (width: number) => void
): void {
	if (!isDragging) return;

	const container = event.currentTarget as HTMLElement;
	const containerRect = container.getBoundingClientRect();
	const newWidth = ((event.clientX - containerRect.left) / containerRect.width) * 100;

	// Constrain between 20% and 80%
	setWidth(Math.min(Math.max(newWidth, 20), 80));
}

export function handleMouseUp(setState: (isDragging: boolean) => void): void {
	setState(false);
	document.body.classList.remove('resizing');
}

export function handleDividerKeyDown(
	event: KeyboardEvent,
	currentWidth: number,
	setWidth: (width: number) => void
): void {
	if (event.key === 'ArrowLeft') {
		event.preventDefault();
		setWidth(Math.max(20, currentWidth - 5));
	} else if (event.key === 'ArrowRight') {
		event.preventDefault();
		setWidth(Math.min(80, currentWidth + 5));
	} else if (event.key === 'Home') {
		event.preventDefault();
		setWidth(20);
	} else if (event.key === 'End') {
		event.preventDefault();
		setWidth(80);
	}
}
