/**
 * Dutch (Netherlands) translations
 *
 * Guidelines for translators:
 * - Keep messages concise for UI constraints
 * - Use sentence case for labels, title case for buttons
 * - Maintain consistent terminology across interactions
 * - Variables in {curlyBraces} will be replaced with dynamic values
 */
export default {
	common: {
		loading: 'Laden...',
		error: 'Fout',
		success: 'Succes',
		cancel: 'Annuleren',
		confirm: 'Bevestigen',
		close: 'Sluiten',
		save: 'Opslaan',
		delete: 'Verwijderen',
		edit: 'Bewerken',
		remove: 'Verwijderen',
		add: 'Toevoegen',
		search: 'Zoeken',
		filter: 'Filteren',
		reset: 'Herstellen',
		submit: 'Verzenden',
		next: 'Volgende',
		previous: 'Vorige',
		back: 'Terug',
		continue: 'Doorgaan',
		finish: 'Voltooien',
	},

	units: {
		bytes: '{count} bytes',
		kilobytes: '{count} KB',
		megabytes: '{count} MB',
		seconds: '{count} seconden',
		minutes: '{count} minuten',
		hours: '{count} uren',
	},

	validation: {
		required: 'Dit veld is verplicht',
		invalidFormat: 'Ongeldige indeling',
		tooShort: 'Te kort (minimaal {min} tekens)',
		tooLong: 'Te lang (maximaal {max} tekens)',
		outOfRange: 'Waarde moet tussen {min} en {max} liggen',
	},

	interactions: {
		choice: {
			selectOption: 'Selecteer een optie',
			selectMultiple: 'Selecteer alle van toepassing zijnde',
			selected: 'Geselecteerd',
			notSelected: 'Niet geselecteerd',
		},

		upload: {
			// Shown as label above file input
			label: 'Upload een bestand',
			selectFile: 'Kies bestand',
			dragDrop: 'of sleep en zet neer',

			// Displayed before list of allowed file types
			allowedTypes: 'Toegestane bestandstypen:',

			// Displayed when file is selected
			selectedFile: 'Geselecteerd:',

			// File size display - {size} will be replaced with numeric value
			fileSize: '{size} bytes',
			fileSizeKb: '{size} KB',
			fileSizeMb: '{size} MB',

			removeFile: 'Bestand verwijderen',

			// Error shown when file type validation fails
			// {types} will be replaced with comma-separated list of allowed types
			errorInvalidType: 'Bestandstype niet toegestaan. Toegestaan: {types}',
			errorReadFailed: 'Kan bestand niet lezen',

			// {max} will be replaced with maximum size in MB
			errorTooLarge: 'Bestand is te groot (maximaal {max} MB)',
			unknownType: 'Onbekend bestandstype',
		},

		drawing: {
			label: 'Teken je antwoord',
			clear: 'Tekening wissen',
			undo: 'Ongedaan maken',
			redo: 'Opnieuw',
			strokeColor: 'Lijnkleur',
			strokeWidth: 'Lijndikte',
			tool: 'Gereedschap',
		},

		extendedText: {
			placeholder: 'Typ hier je antwoord...',
			characterCount: '{count} tekens',
			characterLimit: '{count} / {max} tekens',
			bold: 'Vetgedrukt',
			italic: 'Cursief',
			underline: 'Onderstreept',
			bulletList: 'Opsommingslijst',
			numberedList: 'Genummerde lijst',
			insertMath: 'Wiskundige formule invoegen',
		},

		slider: {
			label: 'Schuifregelaar',
			selectedValue: 'Geselecteerde waarde: {value}',
			min: 'Minimum: {min}',
			max: 'Maximum: {max}',
			step: 'Stap: {step}',
		},

		hottext: {
			selected: 'Geselecteerd:',
			selectText: 'Selecteer tekst uit de passage',
		},

		hotspot: {
			selected: 'Geselecteerd:',
			selectArea: 'Selecteer gebieden op de afbeelding',
		},

		selectPoint: {
			instruction: 'Klik op de afbeelding om punten te selecteren',
			maxPointsReached: 'Maximum aantal punten bereikt. Verwijder een punt om een nieuw punt toe te voegen.',
			point: 'Punt {index}',
			removePoint: 'Punt {index} verwijderen',
		},

		match: {
			// Keyboard instruction for accessible drag-drop
			dragInstruction: 'Druk op spatie of Enter om te koppelen',
			dropTarget: 'Plaats item hier',
			matchedWith: 'Gekoppeld met {target}',
			available: 'Beschikbaar',
			removeMatch: 'Koppeling verwijderen',
		},

		gapMatch: {
			instruction: 'Sleep woorden om de lege plekken in te vullen',
			available: 'Beschikbare woorden',
			removeWord: 'Woord verwijderen',
			// {word} will be replaced with the word being removed
			removeFromBlanks: '{word} uit de lege plekken verwijderen',
		},

		graphicGapMatch: {
			instruction: 'Plaats labels op de hotspots van de afbeelding',
			available: 'Beschikbare labels',
			alreadyPlaced: 'Reeds geplaatst op hotspot',
			selectedForPlacement: 'Geselecteerd voor plaatsing',
			pressSpaceToSelect: 'Druk op spatie om te selecteren',
			pressSpaceToPlace: 'Druk op spatie of Enter om label te plaatsen',
			removeLabel: 'Label verwijderen',
			removeFromHotspot: '{label} van hotspot verwijderen',
			hotspot: 'Hotspot {number}',
			contains: 'Bevat: {label}',
		},

		order: {
			instruction: 'Sleep items om ze te sorteren',
			moveUp: 'Omhoog verplaatsen',
			moveDown: 'Omlaag verplaatsen',
			position: 'Positie {current} van {total}',
		},

		associate: {
			instruction: 'Maak associaties tussen items',
			createPair: 'Paar maken',
			removePair: 'Paar verwijderen',
		},

		positionObject: {
			instruction: 'Sleep objecten op de afbeelding',
			placeObject: 'Plaats {object} op afbeelding',
			removeObject: '{object} verwijderen',
			objectAt: '{object} op positie ({x}, {y})',
		},

		endAttempt: {
			buttonLabel: 'Poging Beëindigen',
			ended: 'Poging Beëindigd',
			requested: 'Aangevraagd',
			warningMessage: 'Je poging is beëindigd en kan niet meer worden gewijzigd.',
			confirmMessage: 'Weet je zeker dat je jouw poging wilt beëindigen? Je kunt je antwoorden niet meer wijzigen.',
		},

		media: {
			play: 'Afspelen',
			pause: 'Pauzeren',
			volume: 'Volume',
			mute: 'Dempen',
			unmute: 'Dempen opheffen',
			fullscreen: 'Volledig scherm',
			exitFullscreen: 'Volledig scherm verlaten',
			playbackSpeed: 'Afspeelsnelheid',
			currentTime: '{current} / {duration}',
			loading: 'Media laden...',
		},
	},

	assessment: {
		title: 'Toets',
		loading: 'Toets laden...',
		loadingError: 'Time-out bij het laden van de toets. Deze toets kan ongeldig zijn of de speler is niet geïnitialiseerd.',
		question: 'Vraag {current} van {total}',
		section: 'Sectie {current} van {total}',

		navigation: {
			previous: 'Vorige',
			next: 'Volgende',
			submit: 'Verzenden',
			jumpTo: 'Spring naar vraag {number}',
			sectionMenu: 'Sectiemenu',
			progress: 'Voortgang: {percent}%',
		},

		sections: {
			title: 'Secties',
			selectSection: 'Selecteer sectie',
		},

		timer: {
			timeRemaining: 'Resterende tijd: {time}',
			timeElapsed: 'Verstreken tijd: {time}',
			timeUp: 'Tijd is op!',
		},

		feedback: {
			correct: 'Correct',
			incorrect: 'Incorrect',
			partiallyCorrect: 'Gedeeltelijk correct',
			unanswered: 'Onbeantwoord',
			score: 'Score: {score} / {maxScore}',
			passed: 'Geslaagd',
			failed: 'Niet geslaagd',
		},

		completion: {
			title: 'Toets Voltooid',
			message: 'Je hebt de toets voltooid.',
			score: 'Jouw score: {score} van {maxScore}',
			percentage: 'Percentage: {percent}%',
			viewResults: 'Resultaten bekijken',
			exit: 'Afsluiten',
		},

		errors: {
			navigationFailed: 'Navigatie mislukt. Probeer het opnieuw.',
			submitFailed: 'Verzenden van toets mislukt. Probeer het opnieuw.',
			loadFailed: 'Laden van vraag mislukt.',
			saveFailed: 'Opslaan van antwoord mislukt.',
		},
	},

	accessibility: {
		skipToContent: 'Spring naar inhoud',
		skipToNavigation: 'Spring naar navigatie',
		itemBody: 'Vraag inhoud',
		navigationRegion: 'Toetsnavigatie',
		announcement: 'Aankondiging',
		newQuestion: 'Nieuwe vraag geladen',
		answerRecorded: 'Antwoord opgeslagen',
	},
} as const; // 'as const' for strict type inference
