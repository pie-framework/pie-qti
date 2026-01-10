/**
 * Norwegian Bokmål (Norway) translations
 *
 * Guidelines for translators:
 * - Keep messages concise for UI constraints
 * - Use sentence case for labels, title case for buttons
 * - Maintain consistent terminology across interactions
 * - Variables in {curlyBraces} will be replaced with dynamic values
 */
export default {
	common: {
		loading: 'Laster...',
		error: 'Feil',
		success: 'Vellykket',
		cancel: 'Avbryt',
		confirm: 'Bekreft',
		close: 'Lukk',
		save: 'Lagre',
		delete: 'Slett',
		edit: 'Rediger',
		remove: 'Fjern',
		add: 'Legg til',
		search: 'Søk',
		filter: 'Filtrer',
		reset: 'Tilbakestill',
		submit: 'Send inn',
		next: 'Neste',
		previous: 'Forrige',
		back: 'Tilbake',
		continue: 'Fortsett',
		finish: 'Fullfør',
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
		required: 'Dette feltet er påkrevd',
		invalidFormat: 'Ugyldig format',
		tooShort: 'For kort (minimum {min} tegn)',
		tooLong: 'For langt (maksimum {max} tegn)',
		outOfRange: 'Verdien må være mellom {min} og {max}',
	},

	interactions: {
		choice: {
			selectOption: 'Velg et alternativ',
			selectMultiple: 'Velg alle som passer',
			selected: 'Valgt',
			notSelected: 'Ikke valgt',
		},

		upload: {
			// Shown as label above file input
			label: 'Last opp en fil',
			selectFile: 'Velg fil',
			dragDrop: 'eller dra og slipp',

			// Displayed before list of allowed file types
			allowedTypes: 'Tillatte filtyper:',

			// Displayed when file is selected
			selectedFile: 'Valgt:',

			// File size display - {size} will be replaced with numeric value
			fileSize: '{size} bytes',
			fileSizeKb: '{size} KB',
			fileSizeMb: '{size} MB',

			removeFile: 'Fjern fil',

			// Error shown when file type validation fails
			// {types} will be replaced with comma-separated list of allowed types
			errorInvalidType: 'Filtypen er ikke tillatt. Tillatt: {types}',
			errorReadFailed: 'Kunne ikke lese filen',

			// {max} will be replaced with maximum size in MB
			errorTooLarge: 'Filen er for stor (maksimum {max} MB)',
			unknownType: 'Ukjent filtype',
		},

		drawing: {
			label: 'Tegn ditt svar',
			clear: 'Tøm tegning',
			undo: 'Angre',
			redo: 'Gjør om',
			strokeColor: 'Strøkfarge',
			strokeWidth: 'Strøktykkelse',
			tool: 'Verktøy',
		},

		extendedText: {
			placeholder: 'Skriv ditt svar her...',
			characterCount: '{count} tegn',
			characterLimit: '{count} / {max} tegn',
			bold: 'Fet',
			italic: 'Kursiv',
			underline: 'Understreket',
			bulletList: 'Punktliste',
			numberedList: 'Nummerert liste',
			insertMath: 'Sett inn matematisk likning',
		},

		slider: {
			label: 'Glidebryter',
			selectedValue: 'Valgt verdi: {value}',
			min: 'Minimum: {min}',
			max: 'Maksimum: {max}',
			step: 'Trinn: {step}',
		},

		hottext: {
			selected: 'Valgt:',
			selectText: 'Velg tekst fra avsnittet',
		},

		hotspot: {
			selected: 'Valgt:',
			selectArea: 'Velg områder på bildet',
		},

		selectPoint: {
			instruction: 'Klikk på bildet for å velge punkter',
			maxPointsReached: 'Maksimalt antall punkter nådd. Fjern et punkt for å legge til et nytt.',
			point: 'Punkt {index}',
			removePoint: 'Fjern punkt {index}',
		},

		match: {
			// Keyboard instruction for accessible drag-drop
			dragInstruction: 'Trykk mellomrom eller Enter for å matche',
			dropTarget: 'Slipp element her',
			matchedWith: 'Matchet med {target}',
			available: 'Tilgjengelig',
			removeMatch: 'Fjern match',
		},

		gapMatch: {
			instruction: 'Dra ord for å fylle ut luker',
			available: 'Tilgjengelige ord',
			removeWord: 'Fjern ord',
			// {word} will be replaced with the word being removed
			removeFromBlanks: 'Fjern {word} fra lukene',
		},

		graphicGapMatch: {
			instruction: 'Plasser etiketter på bildets hotspots',
			available: 'Tilgjengelige etiketter',
			alreadyPlaced: 'Allerede plassert på hotspot',
			selectedForPlacement: 'Valgt for plassering',
			pressSpaceToSelect: 'Trykk mellomrom for å velge',
			pressSpaceToPlace: 'Trykk mellomrom eller Enter for å plassere etikett',
			removeLabel: 'Fjern etikett',
			removeFromHotspot: 'Fjern {label} fra hotspot',
			hotspot: 'Hotspot {number}',
			contains: 'Inneholder: {label}',
		},

		order: {
			instruction: 'Dra elementer for å endre rekkefølge',
			moveUp: 'Flytt opp',
			moveDown: 'Flytt ned',
			position: 'Posisjon {current} av {total}',
		},

		associate: {
			instruction: 'Lag assosiasjoner mellom elementer',
			createPair: 'Lag par',
			removePair: 'Fjern par',
		},

		positionObject: {
			instruction: 'Dra objekter til bildet',
			placeObject: 'Plasser {object} på bildet',
			removeObject: 'Fjern {object}',
			objectAt: '{object} ved posisjon ({x}, {y})',
		},

		endAttempt: {
			buttonLabel: 'Avslutt forsøk',
			ended: 'Forsøk avsluttet',
			requested: 'Forespurt',
			warningMessage: 'Ditt forsøk har blitt avsluttet og kan ikke lenger endres.',
			confirmMessage: 'Er du sikker på at du vil avslutte ditt forsøk? Du vil ikke kunne endre dine svar.',
		},

		media: {
			play: 'Spill av',
			pause: 'Pause',
			volume: 'Volum',
			mute: 'Demp',
			unmute: 'Opphev demping',
			fullscreen: 'Fullskjerm',
			exitFullscreen: 'Avslutt fullskjerm',
			playbackSpeed: 'Avspillingshastighet',
			currentTime: '{current} / {duration}',
			loading: 'Laster media...',
		},
	},

	assessment: {
		title: 'Vurdering',
		loading: 'Laster vurdering...',
		loadingError: 'Tidsavbrudd ved lasting av vurdering. Denne vurderingen kan være ugyldig eller spilleren klarte ikke å initialisere.',
		question: 'Spørsmål {current} av {total}',
		section: 'Seksjon {current} av {total}',

		navigation: {
			previous: 'Forrige',
			next: 'Neste',
			submit: 'Send inn',
			jumpTo: 'Hopp til spørsmål {number}',
			sectionMenu: 'Seksjonsmeny',
			progress: 'Fremdrift: {percent}%',
		},

		sections: {
			title: 'Seksjoner',
			selectSection: 'Velg seksjon',
		},

		timer: {
			timeRemaining: 'Tid gjenstående: {time}',
			timeElapsed: 'Tid brukt: {time}',
			timeUp: 'Tiden er ute!',
		},

		feedback: {
			correct: 'Riktig',
			incorrect: 'Feil',
			partiallyCorrect: 'Delvis riktig',
			unanswered: 'Ubesvart',
			score: 'Poengsum: {score} / {maxScore}',
			passed: 'Bestått',
			failed: 'Ikke bestått',
		},

		completion: {
			title: 'Vurdering fullført',
			message: 'Du har fullført vurderingen.',
			score: 'Din poengsum: {score} av {maxScore}',
			percentage: 'Prosent: {percent}%',
			viewResults: 'Vis resultater',
			exit: 'Avslutt',
		},

		errors: {
			navigationFailed: 'Navigasjon mislyktes. Vennligst prøv igjen.',
			submitFailed: 'Kunne ikke sende inn vurdering. Vennligst prøv igjen.',
			loadFailed: 'Kunne ikke laste spørsmål.',
			saveFailed: 'Kunne ikke lagre svar.',
		},
	},

	accessibility: {
		skipToContent: 'Hopp til innhold',
		skipToNavigation: 'Hopp til navigasjon',
		itemBody: 'Spørsmålsinnhold',
		navigationRegion: 'Vurderingsnavigasjon',
		announcement: 'Kunngjøring',
		newQuestion: 'Nytt spørsmål lastet',
		answerRecorded: 'Svar registrert',
	},
} as const; // 'as const' for strict type inference
