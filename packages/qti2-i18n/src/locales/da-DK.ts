/**
 * Dansk (Danmark) oversættelser
 *
 * Retningslinjer for oversættere:
 * - Hold beskeder kortfattede for UI-begrænsninger
 * - Brug sætningstilfælde for etiketter, titeltilfælde for knapper
 * - Oprethold konsekvent terminologi på tværs af interaktioner
 * - Variabler i {krølleparenteser} vil blive erstattet med dynamiske værdier
 */
export default {
	common: {
		loading: 'Indlæser...',
		error: 'Fejl',
		success: 'Succes',
		cancel: 'Annuller',
		confirm: 'Bekræft',
		close: 'Luk',
		save: 'Gem',
		delete: 'Slet',
		edit: 'Rediger',
		remove: 'Fjern',
		add: 'Tilføj',
		search: 'Søg',
		filter: 'Filtrer',
		reset: 'Nulstil',
		submit: 'Indsend',
		next: 'Næste',
		previous: 'Forrige',
		back: 'Tilbage',
		continue: 'Fortsæt',
		finish: 'Afslut',
	},

	units: {
		bytes: '{count} bytes',
		kilobytes: '{count} KB',
		megabytes: '{count} MB',
		seconds: '{count} sekunder',
		minutes: '{count} minutter',
		hours: '{count} timer',
	},

	validation: {
		required: 'Dette felt er påkrævet',
		invalidFormat: 'Ugyldigt format',
		tooShort: 'For kort (minimum {min} tegn)',
		tooLong: 'For lang (maksimum {max} tegn)',
		outOfRange: 'Værdien skal være mellem {min} og {max}',
	},

	interactions: {
		choice: {
			selectOption: 'Vælg en mulighed',
			selectMultiple: 'Vælg alle der passer',
			selected: 'Valgt',
			notSelected: 'Ikke valgt',
		},

		upload: {
			// Shown as label above file input
			label: 'Upload en fil',
			selectFile: 'Vælg fil',
			dragDrop: 'eller træk og slip',

			// Displayed before list of allowed file types
			allowedTypes: 'Tilladte filtyper:',

			// Displayed when file is selected
			selectedFile: 'Valgt:',

			// File size display - {size} will be replaced with numeric value
			fileSize: '{size} bytes',
			fileSizeKb: '{size} KB',
			fileSizeMb: '{size} MB',

			removeFile: 'Fjern fil',

			// Error shown when file type validation fails
			// {types} will be replaced with comma-separated list of allowed types
			errorInvalidType: 'Filtypen er ikke tilladt. Tilladte: {types}',
			errorReadFailed: 'Kunne ikke læse filen',

			// {max} will be replaced with maximum size in MB
			errorTooLarge: 'Filen er for stor (maksimum {max} MB)',
			unknownType: 'Ukendt filtype',
		},

		drawing: {
			label: 'Tegn dit svar',
			clear: 'Ryd tegning',
			undo: 'Fortryd',
			redo: 'Gendan',
			strokeColor: 'Streg farve',
			strokeWidth: 'Streg tykkelse',
			tool: 'Værktøj',
		},

		extendedText: {
			placeholder: 'Skriv dit svar her...',
			characterCount: '{count} tegn',
			characterLimit: '{count} / {max} tegn',
			bold: 'Fed',
			italic: 'Kursiv',
			underline: 'Understreget',
			bulletList: 'Punktliste',
			numberedList: 'Nummereret liste',
			insertMath: 'Indsæt matematisk ligning',
		},

		slider: {
			label: 'Skyder',
			selectedValue: 'Valgt værdi: {value}',
			min: 'Minimum: {min}',
			max: 'Maksimum: {max}',
			step: 'Trin: {step}',
		},

		hottext: {
			selected: 'Valgt:',
			selectText: 'Vælg tekst fra afsnittet',
		},

		hotspot: {
			selected: 'Valgt:',
			selectArea: 'Vælg områder på billedet',
		},

		selectPoint: {
			instruction: 'Klik på billedet for at vælge punkter',
			maxPointsReached: 'Maksimalt antal punkter nået. Fjern et punkt for at tilføje et nyt.',
			point: 'Punkt {index}',
			removePoint: 'Fjern punkt {index}',
		},

		match: {
			// Keyboard instruction for accessible drag-drop
			dragInstruction: 'Tryk på Mellemrum eller Enter for at matche',
			dropTarget: 'Slip element her',
			matchedWith: 'Matchet med {target}',
			available: 'Tilgængelig',
			removeMatch: 'Fjern match',
		},

		gapMatch: {
			instruction: 'Træk ord for at udfylde de tomme felter',
			available: 'Tilgængelige ord',
			removeWord: 'Fjern ord',
			// {word} will be replaced with the word being removed
			removeFromBlanks: 'Fjern {word} fra de tomme felter',
		},

		graphicGapMatch: {
			instruction: 'Placer etiketter på billedets hotspots',
			available: 'Tilgængelige etiketter',
			alreadyPlaced: 'Allerede placeret på hotspot',
			selectedForPlacement: 'Valgt til placering',
			pressSpaceToSelect: 'Tryk på Mellemrum for at vælge',
			pressSpaceToPlace: 'Tryk på Mellemrum eller Enter for at placere etiket',
			removeLabel: 'Fjern etiket',
			removeFromHotspot: 'Fjern {label} fra hotspot',
			hotspot: 'Hotspot {number}',
			contains: 'Indeholder: {label}',
		},

		order: {
			instruction: 'Træk elementer for at omarrangere dem',
			moveUp: 'Flyt op',
			moveDown: 'Flyt ned',
			position: 'Position {current} af {total}',
		},

		associate: {
			instruction: 'Opret associationer mellem elementer',
			createPair: 'Opret par',
			removePair: 'Fjern par',
		},

		positionObject: {
			instruction: 'Træk objekter over på billedet',
			placeObject: 'Placer {object} på billede',
			removeObject: 'Fjern {object}',
			objectAt: '{object} på position ({x}, {y})',
		},

		endAttempt: {
			buttonLabel: 'Afslut forsøg',
			ended: 'Forsøg afsluttet',
			requested: 'Anmodet',
			warningMessage: 'Dit forsøg er blevet afsluttet og kan ikke længere ændres.',
			confirmMessage: 'Er du sikker på, at du vil afslutte dit forsøg? Du vil ikke være i stand til at ændre dine svar.',
		},

		media: {
			play: 'Afspil',
			pause: 'Pause',
			volume: 'Lydstyrke',
			mute: 'Slå lyd fra',
			unmute: 'Slå lyd til',
			fullscreen: 'Fuldskærm',
			exitFullscreen: 'Forlad fuldskærm',
			playbackSpeed: 'Afspilningshastighed',
			currentTime: '{current} / {duration}',
			loading: 'Indlæser medie...',
		},
	},

	assessment: {
		title: 'Vurdering',
		loading: 'Indlæser vurdering...',
		loadingError: 'Timeout ved indlæsning af vurdering. Denne vurdering kan være ugyldig, eller afspilleren kunne ikke initialiseres.',
		question: 'Spørgsmål {current} af {total}',
		section: 'Sektion {current} af {total}',

		navigation: {
			previous: 'Forrige',
			next: 'Næste',
			submit: 'Indsend',
			jumpTo: 'Gå til spørgsmål {number}',
			sectionMenu: 'Sektionsmenu',
			progress: 'Fremskridt: {percent}%',
		},

		sections: {
			title: 'Sektioner',
			selectSection: 'Vælg sektion',
		},

		timer: {
			timeRemaining: 'Resterende tid: {time}',
			timeElapsed: 'Forløbet tid: {time}',
			timeUp: 'Tiden er udløbet!',
		},

		feedback: {
			correct: 'Korrekt',
			incorrect: 'Forkert',
			partiallyCorrect: 'Delvist korrekt',
			unanswered: 'Ubesvaret',
			score: 'Score: {score} / {maxScore}',
			passed: 'Bestået',
			failed: 'Ikke bestået',
		},

		completion: {
			title: 'Vurdering fuldført',
			message: 'Du har fuldført vurderingen.',
			score: 'Din score: {score} ud af {maxScore}',
			percentage: 'Procent: {percent}%',
			viewResults: 'Se resultater',
			exit: 'Afslut',
		},

		errors: {
			navigationFailed: 'Navigation fejlede. Prøv venligst igen.',
			submitFailed: 'Kunne ikke indsende vurdering. Prøv venligst igen.',
			loadFailed: 'Kunne ikke indlæse spørgsmål.',
			saveFailed: 'Kunne ikke gemme svar.',
		},
	},

	accessibility: {
		skipToContent: 'Spring til indhold',
		skipToNavigation: 'Spring til navigation',
		itemBody: 'Spørgsmålsindhold',
		navigationRegion: 'Vurderingsnavigation',
		announcement: 'Meddelelse',
		newQuestion: 'Nyt spørgsmål indlæst',
		answerRecorded: 'Svar registreret',
	},
} as const; // 'as const' for strict type inference
