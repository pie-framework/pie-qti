/**
 * Swedish (Sweden) translations
 *
 * Guidelines for translators:
 * - Keep messages concise for UI constraints
 * - Use sentence case for labels, title case for buttons
 * - Maintain consistent terminology across interactions
 * - Variables in {curlyBraces} will be replaced with dynamic values
 */
export default {
	common: {
		loading: 'Laddar...',
		error: 'Fel',
		success: 'Lyckades',
		cancel: 'Avbryt',
		confirm: 'Bekräfta',
		close: 'Stäng',
		save: 'Spara',
		delete: 'Ta bort',
		edit: 'Redigera',
		remove: 'Ta bort',
		add: 'Lägg till',
		search: 'Sök',
		filter: 'Filtrera',
		reset: 'Återställ',
		submit: 'Skicka in',
		next: 'Nästa',
		previous: 'Föregående',
		back: 'Tillbaka',
		continue: 'Fortsätt',
		finish: 'Avsluta',
	},

	units: {
		bytes: '{count} bytes',
		kilobytes: '{count} KB',
		megabytes: '{count} MB',
		seconds: '{count} sekunder',
		minutes: '{count} minuter',
		hours: '{count} timmar',
	},

	validation: {
		required: 'Detta fält är obligatoriskt',
		invalidFormat: 'Ogiltigt format',
		tooShort: 'För kort (minimum {min} tecken)',
		tooLong: 'För långt (maximum {max} tecken)',
		outOfRange: 'Värdet måste vara mellan {min} och {max}',
	},

	interactions: {
		choice: {
			selectOption: 'Välj ett alternativ',
			selectMultiple: 'Välj alla som gäller',
			selected: 'Vald',
			notSelected: 'Inte vald',
		},

		upload: {
			// Shown as label above file input
			label: 'Ladda upp en fil',
			selectFile: 'Välj fil',
			dragDrop: 'eller dra och släpp',

			// Displayed before list of allowed file types
			allowedTypes: 'Tillåtna filtyper:',

			// Displayed when file is selected
			selectedFile: 'Vald:',

			// File size display - {size} will be replaced with numeric value
			fileSize: '{size} bytes',
			fileSizeKb: '{size} KB',
			fileSizeMb: '{size} MB',

			removeFile: 'Ta bort fil',

			// Error shown when file type validation fails
			// {types} will be replaced with comma-separated list of allowed types
			errorInvalidType: 'Filtypen är inte tillåten. Tillåtna: {types}',
			errorReadFailed: 'Misslyckades att läsa filen',

			// {max} will be replaced with maximum size in MB
			errorTooLarge: 'Filen är för stor (maximum {max} MB)',
			unknownType: 'Okänd filtyp',
		},

		drawing: {
			label: 'Rita ditt svar',
			clear: 'Rensa ritning',
			undo: 'Ångra',
			redo: 'Gör om',
			strokeColor: 'Pennfärg',
			strokeWidth: 'Pennbredd',
			tool: 'Verktyg',
		},

		extendedText: {
			placeholder: 'Skriv ditt svar här...',
			characterCount: '{count} tecken',
			characterLimit: '{count} / {max} tecken',
			bold: 'Fetstil',
			italic: 'Kursiv',
			underline: 'Understruken',
			bulletList: 'Punktlista',
			numberedList: 'Numrerad lista',
			insertMath: 'Infoga matematisk formel',
		},

		slider: {
			label: 'Reglage',
			selectedValue: 'Valt värde: {value}',
			min: 'Minimum: {min}',
			max: 'Maximum: {max}',
			step: 'Steg: {step}',
		},

		hottext: {
			selected: 'Vald:',
			selectText: 'Välj text från textstycket',
		},

		hotspot: {
			selected: 'Vald:',
			selectArea: 'Välj områden på bilden',
		},

		selectPoint: {
			instruction: 'Klicka på bilden för att välja punkter',
			maxPointsReached: 'Maximalt antal punkter nått. Ta bort en punkt för att lägga till en ny.',
			point: 'Punkt {index}',
			removePoint: 'Ta bort punkt {index}',
		},

		match: {
			// Keyboard instruction for accessible drag-drop
			dragInstruction: 'Tryck mellanslag eller Enter för att matcha',
			dropTarget: 'Släpp objekt här',
			matchedWith: 'Matchad med {target}',
			available: 'Tillgänglig',
			removeMatch: 'Ta bort matchning',
		},

		gapMatch: {
			instruction: 'Dra ord för att fylla i luckorna',
			available: 'Tillgängliga ord',
			removeWord: 'Ta bort ord',
			// {word} will be replaced with the word being removed
			removeFromBlanks: 'Ta bort {word} från luckorna',
		},

		graphicGapMatch: {
			instruction: 'Placera etiketter på bildens aktiva områden',
			available: 'Tillgängliga etiketter',
			alreadyPlaced: 'Redan placerad på aktivt område',
			selectedForPlacement: 'Vald för placering',
			pressSpaceToSelect: 'Tryck mellanslag för att välja',
			pressSpaceToPlace: 'Tryck mellanslag eller Enter för att placera etikett',
			removeLabel: 'Ta bort etikett',
			removeFromHotspot: 'Ta bort {label} från aktivt område',
			hotspot: 'Aktivt område {number}',
			contains: 'Innehåller: {label}',
		},

		order: {
			instruction: 'Dra objekt för att ordna dem',
			moveUp: 'Flytta upp',
			moveDown: 'Flytta ner',
			position: 'Position {current} av {total}',
		},

		associate: {
			instruction: 'Skapa associationer mellan objekt',
			createPair: 'Skapa par',
			removePair: 'Ta bort par',
		},

		positionObject: {
			instruction: 'Dra objekt till bilden',
			placeObject: 'Placera {object} på bilden',
			removeObject: 'Ta bort {object}',
			objectAt: '{object} vid position ({x}, {y})',
		},

		endAttempt: {
			buttonLabel: 'Avsluta försök',
			ended: 'Försök avslutat',
			requested: 'Begärd',
			warningMessage: 'Ditt försök har avslutats och kan inte längre ändras.',
			confirmMessage: 'Är du säker på att du vill avsluta ditt försök? Du kommer inte att kunna ändra dina svar.',
		},

		media: {
			play: 'Spela',
			pause: 'Pausa',
			volume: 'Volym',
			mute: 'Ljud av',
			unmute: 'Ljud på',
			fullscreen: 'Helskärm',
			exitFullscreen: 'Avsluta helskärm',
			playbackSpeed: 'Uppspelningshastighet',
			currentTime: '{current} / {duration}',
			loading: 'Laddar media...',
		},
	},

	assessment: {
		title: 'Bedömning',
		loading: 'Laddar bedömning...',
		loadingError: 'Tidsgräns överskriden vid laddning av bedömning. Denna bedömning kan vara ogiltig eller spelaren misslyckades att initialisera.',
		question: 'Fråga {current} av {total}',
		section: 'Avsnitt {current} av {total}',

		navigation: {
			previous: 'Föregående',
			next: 'Nästa',
			submit: 'Skicka in',
			jumpTo: 'Hoppa till fråga {number}',
			sectionMenu: 'Avsnittsmeny',
			progress: 'Framsteg: {percent}%',
		},

		sections: {
			title: 'Avsnitt',
			selectSection: 'Välj avsnitt',
		},

		timer: {
			timeRemaining: 'Återstående tid: {time}',
			timeElapsed: 'Förfluten tid: {time}',
			timeUp: 'Tiden är ute!',
		},

		feedback: {
			correct: 'Korrekt',
			incorrect: 'Inkorrekt',
			partiallyCorrect: 'Delvis korrekt',
			unanswered: 'Obesvarad',
			score: 'Poäng: {score} / {maxScore}',
			passed: 'Godkänd',
			failed: 'Underkänd',
		},

		completion: {
			title: 'Bedömning slutförd',
			message: 'Du har slutfört bedömningen.',
			score: 'Ditt resultat: {score} av {maxScore}',
			percentage: 'Procent: {percent}%',
			viewResults: 'Visa resultat',
			exit: 'Avsluta',
		},

		errors: {
			navigationFailed: 'Navigering misslyckades. Försök igen.',
			submitFailed: 'Misslyckades att skicka in bedömning. Försök igen.',
			loadFailed: 'Misslyckades att ladda fråga.',
			saveFailed: 'Misslyckades att spara svar.',
		},
	},

	accessibility: {
		skipToContent: 'Hoppa till innehåll',
		skipToNavigation: 'Hoppa till navigering',
		itemBody: 'Frågeinnehåll',
		navigationRegion: 'Bedömningsnavigering',
		announcement: 'Meddelande',
		newQuestion: 'Ny fråga laddad',
		answerRecorded: 'Svar registrerat',
	},
} as const; // 'as const' for strict type inference
