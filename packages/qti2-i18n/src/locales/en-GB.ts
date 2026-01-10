/**
 * English (United Kingdom) translations
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
		submit: 'Submit',
		next: 'Next',
		previous: 'Previous',
		back: 'Back',
		continue: 'Continue',
		finish: 'Finish',
	},

	units: {
		bytes: '{count} bytes',
		kilobytes: '{count} KB',
		megabytes: '{count} MB',
		seconds: '{count} seconds',
		minutes: '{count} minutes',
		hours: '{count} hours',
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
			strokeColor: 'Stroke colour',
			strokeWidth: 'Stroke width',
			tool: 'Tool',
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
			insertMath: 'Insert maths equation',
		},

		slider: {
			label: 'Slider',
			selectedValue: 'Selected value: {value}',
			min: 'Minimum: {min}',
			max: 'Maximum: {max}',
			step: 'Step: {step}',
		},

		hottext: {
			selected: 'Selected:',
			selectText: 'Select text from the passage',
		},

		hotspot: {
			selected: 'Selected:',
			selectArea: 'Select areas on the image',
		},

		selectPoint: {
			instruction: 'Click on the image to select points',
			maxPointsReached: 'Maximum points reached. Remove a point to add a new one.',
			point: 'Point {index}',
			removePoint: 'Remove point {index}',
		},

		match: {
			// Keyboard instruction for accessible drag-drop
			dragInstruction: 'Press Space or Enter to match',
			dropTarget: 'Drop item here',
			matchedWith: 'Matched with {target}',
			available: 'Available',
			removeMatch: 'Remove match',
		},

		gapMatch: {
			instruction: 'Drag words to fill in the blanks',
			available: 'Available words',
			removeWord: 'Remove word',
			// {word} will be replaced with the word being removed
			removeFromBlanks: 'Remove {word} from the blanks',
		},

		graphicGapMatch: {
			instruction: 'Place labels on the image hotspots',
			available: 'Available labels',
			alreadyPlaced: 'Already placed on hotspot',
			selectedForPlacement: 'Selected for placement',
			pressSpaceToSelect: 'Press Space to select',
			pressSpaceToPlace: 'Press Space or Enter to place label',
			removeLabel: 'Remove label',
			removeFromHotspot: 'Remove {label} from hotspot',
			hotspot: 'Hotspot {number}',
			contains: 'Contains: {label}',
		},

		order: {
			instruction: 'Drag items to reorder them',
			moveUp: 'Move up',
			moveDown: 'Move down',
			position: 'Position {current} of {total}',
		},

		associate: {
			instruction: 'Create associations between items',
			createPair: 'Create pair',
			removePair: 'Remove pair',
		},

		positionObject: {
			instruction: 'Drag objects onto the image',
			placeObject: 'Place {object} on image',
			removeObject: 'Remove {object}',
			objectAt: '{object} at position ({x}, {y})',
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
		},
	},

	assessment: {
		title: 'Assessment',
		loading: 'Loading assessment...',
		loadingError: 'Timeout loading assessment. This assessment may be invalid or the player failed to initialise.',
		question: 'Question {current} of {total}',
		section: 'Section {current} of {total}',

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

	accessibility: {
		skipToContent: 'Skip to content',
		skipToNavigation: 'Skip to navigation',
		itemBody: 'Question content',
		navigationRegion: 'Assessment navigation',
		announcement: 'Announcement',
		newQuestion: 'New question loaded',
		answerRecorded: 'Answer recorded',
	},
} as const; // 'as const' for strict type inference
