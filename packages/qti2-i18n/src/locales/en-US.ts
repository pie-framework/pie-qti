/**
 * English (United States) translations
 *
 * Guidelines for translators:
 * - Keep messages concise for UI constraints
 * - Use sentence case for labels, title case for buttons
 * - Maintain consistent terminology across interactions
 * - Variables in {curlyBraces} will be replaced with dynamic values
 */
export default {
	common: {
		loading: 'Loading...',
		error: 'Error',
		success: 'Success',
		cancel: 'Cancel',
		confirm: 'Confirm',
		close: 'Close',
		save: 'Save',
		delete: 'Delete',
		edit: 'Edit',
		remove: 'Remove',
		add: 'Add',
		search: 'Search',
		filter: 'Filter',
		reset: 'Reset',
		clear: 'Clear',
		clearAll: 'Clear All',
		submit: 'Submit',
		next: 'Next',
		previous: 'Previous',
		back: 'Back',
		continue: 'Continue',
		finish: 'Finish',
		complete: 'Complete',
		completed: 'Completed',
		status: 'Status',
		required: 'Required',
		review: 'Review',
		selected: 'Selected',
		available: 'Available',
		showDetails: 'Show details',
		hideDetails: 'Hide details',
		details: 'Details',
		deselected: '{item} deselected',
		selectionCancelled: 'Selection cancelled',
		question: 'Question',
		of: 'of',
		answered: 'answered',
		pleaseComplete: 'Please complete the required interactions',
		submitting: 'Submitting...',
		submitAnswer: 'Submit Answer',
		tryAgain: 'Try Again',
	},

	units: {
		bytes: '{count} bytes',
		kilobytes: '{count} KB',
		megabytes: '{count} MB',
		seconds: '{count} seconds',
		minutes: '{count} minutes',
		hours: '{count} hours',
	},

	// Pluralization examples
	// Use i18n.plural('plurals.items', { count: n }) to access these
	plurals: {
		items: {
			one: '{count} item',
			other: '{count} items',
		},
		files: {
			one: '{count} file selected',
			other: '{count} files selected',
		},
		questions: {
			one: '{count} question',
			other: '{count} questions',
		},
		answers: {
			one: '{count} answer',
			other: '{count} answers',
		},
		choices: {
			one: '{count} choice',
			other: '{count} choices',
		},
		attempts: {
			one: '{count} attempt remaining',
			other: '{count} attempts remaining',
		},
		minutesRemaining: {
			one: '{count} minute remaining',
			other: '{count} minutes remaining',
		},
		secondsRemaining: {
			one: '{count} second remaining',
			other: '{count} seconds remaining',
		},
	},

	validation: {
		required: 'This field is required',
		invalidFormat: 'Invalid format',
		tooShort: 'Too short (minimum {min} characters)',
		tooLong: 'Too long (maximum {max} characters)',
		outOfRange: 'Value must be between {min} and {max}',
	},

	interactions: {
		choice: {
			selectOption: 'Select an option',
			selectMultiple: 'Select all that apply',
			selected: 'Selected',
			notSelected: 'Not selected',
		},

		upload: {
			// Shown as label above file input
			label: 'Upload a file',
			selectFile: 'Choose file',
			dragDrop: 'or drag and drop',

			// Displayed before list of allowed file types
			allowedTypes: 'Allowed file types:',

			// Displayed when file is selected
			selectedFile: 'Selected:',

			// File size display - {size} will be replaced with numeric value
			fileSize: '{size} bytes',
			fileSizeKb: '{size} KB',
			fileSizeMb: '{size} MB',

			removeFile: 'Remove file',

			// Error shown when file type validation fails
			// {types} will be replaced with comma-separated list of allowed types
			errorInvalidType: 'File type not allowed. Allowed: {types}',
			errorReadFailed: 'Failed to read file',

			// {max} will be replaced with maximum size in MB
			errorTooLarge: 'File is too large (maximum {max} MB)',
			unknownType: 'Unknown file type',
		},

		drawing: {
			label: 'Draw your response',
			clear: 'Clear drawing',
			undo: 'Undo',
			redo: 'Redo',
			strokeColor: 'Stroke color',
			strokeWidth: 'Stroke width',
			tool: 'Tool',
			instructions: 'Draw with your mouse or touch. Use the Clear button to reset.',
			canvas: 'Drawing canvas',
			updated: 'Drawing updated.',
			cleared: 'Drawing cleared.',
			generated: 'Generated:',
		},

		extendedText: {
			placeholder: 'Type your response here...',
			characterCount: '{count} characters',
			characterLimit: '{count} / {max} characters',
			bold: 'Bold',
			italic: 'Italic',
			underline: 'Underline',
			bulletList: 'Bullet list',
			numberedList: 'Numbered list',
			insertMath: 'Insert math equation',
			insertInlineMath: 'Insert inline math',
			insertBlockMath: 'Insert block math',
		},

		slider: {
			label: 'Slider',
			selectedValue: 'Selected value: {value}',
			min: 'Minimum: {min}',
			max: 'Maximum: {max}',
			step: 'Step: {step}',
			ariaLabel: 'Slider value from {lowerBound} to {upperBound}',
			statTitle: 'Selected Value',
		},

		hottext: {
			selected: 'Selected:',
			selectText: 'Select text from the passage',
			clearSelection: 'Clear Selection',
			ariaLabel: 'Text selection interaction',
		},

		hotspot: {
			selected: 'Selected:',
			selectArea: 'Select areas on the image',
			ariaLabel: 'Hotspot interaction',
			altText: 'Hotspot interaction',
		},

		selectPoint: {
			instruction: 'Click on the image to select points',
			instructionAria: 'Click to select points on the image',
			maxPointsReached: 'Maximum points reached. Remove a point to add a new one.',
			point: 'Point {index}',
			removePoint: 'Remove point {index}',
			removePointTitle: 'Click to remove this point',
			removePointAt: 'Remove point {index} at coordinates {x}, {y}',
			removePointAtTitle: 'Click to remove this point ({x}, {y})',
			canvas: 'Selection canvas',
			noImage: 'No image provided',
			pointsSelected: 'Points selected:',
			minimumMet: '✓ Minimum met',
			selectAtLeast: 'Select at least {minChoices}',
		},

		match: {
			// Keyboard instruction for accessible drag-drop
			keyboardInstructions: 'Press Space or Enter to select a source item. Tab to navigate to targets. Press Space or Enter on a target to create a match. Press Escape to cancel selection.',
			dragInstruction: 'Press Space or Enter to match',
			dropTarget: 'Drop item here',
			matchedWith: 'Matched with {target}',
			selectedForMatching: 'Selected for matching',
			available: 'Available',
			availableForMatching: 'Available for matching',
			removeMatch: 'Remove match',
			clearMatch: 'Clear match for {source}',
			sourceItemsLabel: 'Source items to match',
			targetItemsLabel: 'Target items for matching',
			dragFromHere: 'Drag from here:',
			dropHere: 'Drop here:',
			deselected: '{item} deselected',
			selected: '{item} selected',
			navigateToTarget: 'Navigate to a target and press Space or Enter to match',
			selectionCancelled: 'Selection cancelled',
			matchCleared: 'Match cleared for {item}',
		},

		gapMatch: {
			instruction: 'Drag words to fill in the blanks',
			available: 'Available words',
			availableLabel: 'Available words to place',
			availableHeading: 'Available words:',
			removeWord: 'Remove word',
			// {word} will be replaced with the word being removed
			removeFromBlanks: 'Remove {word} from the blanks',
			selectPlaceholder: 'Select...',
			gapAriaLabel: 'Gap {gapId}',
		},

		graphicGapMatch: {
			instruction: 'Place labels on the image hotspots',
			keyboardInstructions: 'Press Space or Enter to select a label. Tab to navigate to hotspots on the image. Press Space or Enter on a hotspot to place the label. Press Escape to cancel selection.',
			available: 'Available labels',
			availableLabel: 'Available labels to place',
			availableHeading: 'Available Labels:',
			alreadyPlaced: 'Already placed on hotspot',
			selectedForPlacement: 'Selected for placement',
			pressSpaceToSelect: 'Press Space to select',
			pressSpaceToPlace: 'Press Space or Enter to place label',
			removeLabel: 'Remove label',
			removeFromHotspot: 'Remove {label} from hotspot',
			labelPlaced: '{label} placed on hotspot {hotspot}',
			hotspot: 'Hotspot {number}',
			contains: 'Contains: {label}',
		},

		order: {
			instruction: 'Drag items to reorder them',
			keyboardInstructions: 'Press Space or Enter to grab an item. Use arrow keys to move the item. Press Space or Enter again to drop. Press Escape to cancel.',
			grabbed: 'Grabbed. Use arrow keys to move.',
			moveUp: 'Move up',
			moveDown: 'Move down',
			position: 'Position {current} of {total}',
			listLabel: 'Reorderable list of choices',
			confirmOrder: 'Confirm Order',
			confirmOrderNoChanges: 'Confirm Order (No Changes)',
			confirmAria: 'Confirm this order as your answer',
			itemGrabbed: '{item} grabbed. Current position {position} of {total}. Use arrow keys to move, Space or Enter to drop.',
			itemDropped: '{item} dropped at position {position} of {total}',
			itemMoved: '{item} moved to position {position} of {total}',
			selectionCancelled: '{item} selection cancelled',
		},

		associate: {
			instruction: 'Create associations between items',
			createPair: 'Create pair',
			removePair: 'Remove pair',
			removeAssociation: 'Remove association',
			diagramLabel: 'Association diagram',
			altText: 'Association diagram',
			hotspotConnections: '{label} ({usageCount}/{matchMax} connections)',
			selectAnother: 'Selected: <strong>{label}</strong>. Click another',
			minimumRequired: 'Minimum required: {minAssociations}',
			currentAssociations: 'Current Associations',
			clickToAssociate: 'Click two items to create an association between them',
			clickAnotherOrDeselect: 'Click another item to create an association (or click again to deselect)',
			associations: 'Associations',
			associationsCount: 'Associations ({count}/{max})',
			clickHotspotsToAssociate: 'Click two hotspots on the image to create an association.',
			clickAnotherHotspot: 'Selected: <strong>{label}</strong>. Click another hotspot to create an association.',
		},

		positionObject: {
			instruction: 'Drag objects onto the image',
			placeObject: 'Place {object} on image',
			removeObject: 'Remove {object}',
			objectAt: '{object} at position ({x}, {y})',
			canvasLabel: 'Positioning canvas',
			backgroundAlt: 'Positioning background',
			positioned: 'Positioned {label} at ({x}, {y})',
			minimumRequired: 'Minimum required: {minChoices}',
			maximumAllowed: 'Maximum: {maxChoices}',
			availableObjects: 'Available Objects',
			objectUsage: '{label} ({usageCount}/{matchMax} used)',
			availableObjectsCount: 'Available Objects ({count}/{max})',
			dragObjectsInstruction: 'Drag objects onto the canvas to position them.',
			used: '{usageCount}/{matchMax} used',
		},

		endAttempt: {
			buttonLabel: 'End Attempt',
			ended: 'Attempt Ended',
			requested: 'Requested',
			warningMessage: 'Your attempt has been ended and can no longer be modified.',
			confirmMessage: 'Are you sure you want to end your attempt? You will not be able to change your responses.',
		},

		media: {
			play: 'Play',
			pause: 'Pause',
			volume: 'Volume',
			mute: 'Mute',
			unmute: 'Unmute',
			fullscreen: 'Fullscreen',
			exitFullscreen: 'Exit fullscreen',
			playbackSpeed: 'Playback speed',
			currentTime: '{current} / {duration}',
			loading: 'Loading media...',
			ariaLabel: 'Media content',
			maxPlayLimitReached: 'Maximum play limit reached',
			playCount: 'Play count:',
			remaining: 'Remaining:',
			requirementMet: '✓ Requirement met',
			playAtLeast: 'Play at least {minPlays} time',
			playAtLeastPlural: 'Play at least {minPlays} times',
			browserNoSupport: 'Your browser does not support this media type.',
			audioNoSupport: 'Your browser does not support the audio element.',
			videoNoSupport: 'Your browser does not support the video element.',
			objectDisabled: 'This item uses an embedded object type that is disabled by default for security.',
		},

		graphicOrder: {
			instruction: 'Click hotspots to order them',
			diagramLabel: 'Ordering diagram',
			altText: 'Ordering diagram',
			orderHeading: 'Order (drag to reorder)',
			itemLabel: 'Item {index}: {label}',
			confirmOrder: 'Confirm Order',
			confirmOrderNoChanges: 'Confirm Order (No Changes)',
			confirmAria: 'Confirm this order as your answer',
		},

		custom: {
			unsupported: 'Unsupported customInteraction',
			description: 'This item contains a vendor-specific interaction. This player does not execute custom interactions.',
			promptLabel: 'Prompt',
			manualResponse: 'Manual response (optional)',
			placeholder: 'Enter a manual response (fallback)',
			attributes: 'Attributes',
			xml: 'XML',
		},

		inline: {
			placeholder: '...',
		},
	},

	item: {
		loading: 'Loading item...',
		loadingError: 'Failed to load item',
		loadError: 'Error loading item: {error}',
		parsingError: 'Failed to parse QTI XML',
		processingError: 'Failed to process responses',
		submit: 'Submit',
		complete: 'Complete',
		completed: 'Completed',
		attempt: 'Attempt {numAttempts}',
	},

	itemSession: {
		attempt: 'Attempt {numAttempts}',
		attemptsRemaining: '{attemptsRemaining} attempts remaining',
		maxAttempts: 'Max attempts: {maxAttempts}',
	},

	feedback: {
		close: 'Close feedback',
		closeFeedback: 'Dismiss feedback',
		testFeedback: 'Test feedback',
	},

	assessment: {
		title: 'Assessment',
		loading: 'Loading assessment...',
		loadingError: 'Timeout loading assessment. This assessment may be invalid or the player failed to initialize.',
		question: 'Question {current} of {total}',
		questionAnnouncement: 'Question {current} of {total}',
		section: 'Section {current} of {total}',
		closeMenu: 'Close menu',

		attempts: {
			remaining: '{count} attempts remaining',
			oneRemaining: '1 attempt remaining',
			noRemaining: 'No attempts remaining ({count} used)',
			used: 'Attempts: {count}',
			maxReached: 'Max attempts reached',
			required: 'Must answer before continuing',
			reviewNotAllowed: 'Not allowed once submitted',
		},

		navigation: {
			previous: 'Previous',
			next: 'Next',
			submit: 'Submit',
			jumpTo: 'Jump to question {number}',
			sectionMenu: 'Section menu',
			progress: 'Progress: {percent}%',
		},

		sections: {
			title: 'Sections',
			selectSection: 'Select section',
		},

		timer: {
			remaining: 'Time Remaining',
			elapsed: 'Time Elapsed',
			expired: 'Time Expired',
			timeRemaining: 'Time remaining: {time}',
			timeElapsed: 'Time elapsed: {time}',
			timeUp: "Time's up!",
		},

		feedback: {
			correct: 'Correct',
			incorrect: 'Incorrect',
			partiallyCorrect: 'Partially correct',
			unanswered: 'Unanswered',
			score: 'Score: {score} / {maxScore}',
			passed: 'Passed',
			failed: 'Failed',
		},

		completion: {
			title: 'Assessment Complete',
			message: 'You have completed the assessment.',
			score: 'Your score: {score} out of {maxScore}',
			percentage: 'Percentage: {percent}%',
			viewResults: 'View results',
			exit: 'Exit',
		},

		errors: {
			navigationFailed: 'Navigation failed. Please try again.',
			submitFailed: 'Failed to submit assessment. Please try again.',
			loadFailed: 'Failed to load question.',
			saveFailed: 'Failed to save response.',
		},
	},

	i18n: {
		selectLanguage: 'Language',
		selectLanguageAriaLabel: 'Select display language',
	},

	accessibility: {
		skipToContent: 'Skip to content',
		skipToNavigation: 'Skip to navigation',
		itemBody: 'Question content',
		navigationRegion: 'Assessment navigation',
		announcement: 'Announcement',
		newQuestion: 'New question loaded',
		answerRecorded: 'Answer recorded',
		resizer: 'Resize passage and question panels',
	},
} as const; // 'as const' for strict type inference
