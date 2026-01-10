/**
 * German (Germany) translations
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
		error: 'Fehler',
		success: 'Erfolg',
		cancel: 'Abbrechen',
		confirm: 'Bestätigen',
		close: 'Schließen',
		save: 'Speichern',
		delete: 'Löschen',
		edit: 'Bearbeiten',
		remove: 'Entfernen',
		add: 'Hinzufügen',
		search: 'Suchen',
		filter: 'Filtern',
		reset: 'Zurücksetzen',
		submit: 'Senden',
		next: 'Weiter',
		previous: 'Zurück',
		back: 'Zurück',
		continue: 'Fortsetzen',
		finish: 'Beenden',
	},

	units: {
		bytes: '{count} Bytes',
		kilobytes: '{count} KB',
		megabytes: '{count} MB',
		seconds: '{count} Sekunden',
		minutes: '{count} Minuten',
		hours: '{count} Stunden',
	},

	validation: {
		required: 'Dieses Feld ist erforderlich',
		invalidFormat: 'Ungültiges Format',
		tooShort: 'Zu kurz (mindestens {min} Zeichen)',
		tooLong: 'Zu lang (maximal {max} Zeichen)',
		outOfRange: 'Der Wert muss zwischen {min} und {max} liegen',
	},

	interactions: {
		choice: {
			selectOption: 'Wählen Sie eine Option',
			selectMultiple: 'Wählen Sie alle zutreffenden aus',
			selected: 'Ausgewählt',
			notSelected: 'Nicht ausgewählt',
		},

		upload: {
			// Shown as label above file input
			label: 'Datei hochladen',
			selectFile: 'Datei wählen',
			dragDrop: 'oder per Drag & Drop',

			// Displayed before list of allowed file types
			allowedTypes: 'Erlaubte Dateitypen:',

			// Displayed when file is selected
			selectedFile: 'Ausgewählt:',

			// File size display - {size} will be replaced with numeric value
			fileSize: '{size} Bytes',
			fileSizeKb: '{size} KB',
			fileSizeMb: '{size} MB',

			removeFile: 'Datei entfernen',

			// Error shown when file type validation fails
			// {types} will be replaced with comma-separated list of allowed types
			errorInvalidType: 'Dateityp nicht erlaubt. Erlaubt: {types}',
			errorReadFailed: 'Fehler beim Lesen der Datei',

			// {max} will be replaced with maximum size in MB
			errorTooLarge: 'Datei ist zu groß (maximal {max} MB)',
			unknownType: 'Unbekannter Dateityp',
		},

		drawing: {
			label: 'Zeichnen Sie Ihre Antwort',
			clear: 'Zeichnung löschen',
			undo: 'Rückgängig',
			redo: 'Wiederholen',
			strokeColor: 'Strichfarbe',
			strokeWidth: 'Strichstärke',
			tool: 'Werkzeug',
		},

		extendedText: {
			placeholder: 'Geben Sie hier Ihre Antwort ein...',
			characterCount: '{count} Zeichen',
			characterLimit: '{count} / {max} Zeichen',
			bold: 'Fett',
			italic: 'Kursiv',
			underline: 'Unterstrichen',
			bulletList: 'Aufzählungsliste',
			numberedList: 'Nummerierte Liste',
			insertMath: 'Mathematische Gleichung einfügen',
		},

		slider: {
			label: 'Schieberegler',
			selectedValue: 'Ausgewählter Wert: {value}',
			min: 'Minimum: {min}',
			max: 'Maximum: {max}',
			step: 'Schritt: {step}',
		},

		hottext: {
			selected: 'Ausgewählt:',
			selectText: 'Wählen Sie Text aus dem Absatz',
		},

		hotspot: {
			selected: 'Ausgewählt:',
			selectArea: 'Wählen Sie Bereiche auf dem Bild',
		},

		selectPoint: {
			instruction: 'Klicken Sie auf das Bild, um Punkte auszuwählen',
			maxPointsReached: 'Maximale Punktzahl erreicht. Entfernen Sie einen Punkt, um einen neuen hinzuzufügen.',
			point: 'Punkt {index}',
			removePoint: 'Punkt {index} entfernen',
		},

		match: {
			// Keyboard instruction for accessible drag-drop
			dragInstruction: 'Drücken Sie die Leertaste oder Eingabetaste zum Zuordnen',
			dropTarget: 'Element hier ablegen',
			matchedWith: 'Zugeordnet zu {target}',
			available: 'Verfügbar',
			removeMatch: 'Zuordnung entfernen',
		},

		gapMatch: {
			instruction: 'Ziehen Sie Wörter, um die Lücken zu füllen',
			available: 'Verfügbare Wörter',
			removeWord: 'Wort entfernen',
			// {word} will be replaced with the word being removed
			removeFromBlanks: '{word} aus den Lücken entfernen',
		},

		graphicGapMatch: {
			instruction: 'Platzieren Sie Beschriftungen auf den Hotspots des Bildes',
			available: 'Verfügbare Beschriftungen',
			alreadyPlaced: 'Bereits auf Hotspot platziert',
			selectedForPlacement: 'Zur Platzierung ausgewählt',
			pressSpaceToSelect: 'Drücken Sie die Leertaste zum Auswählen',
			pressSpaceToPlace: 'Drücken Sie die Leertaste oder Eingabetaste zum Platzieren der Beschriftung',
			removeLabel: 'Beschriftung entfernen',
			removeFromHotspot: '{label} vom Hotspot entfernen',
			hotspot: 'Hotspot {number}',
			contains: 'Enthält: {label}',
		},

		order: {
			instruction: 'Ziehen Sie Elemente, um sie neu anzuordnen',
			moveUp: 'Nach oben',
			moveDown: 'Nach unten',
			position: 'Position {current} von {total}',
		},

		associate: {
			instruction: 'Erstellen Sie Zuordnungen zwischen Elementen',
			createPair: 'Paar erstellen',
			removePair: 'Paar entfernen',
		},

		positionObject: {
			instruction: 'Ziehen Sie Objekte auf das Bild',
			placeObject: '{object} auf dem Bild platzieren',
			removeObject: '{object} entfernen',
			objectAt: '{object} an Position ({x}, {y})',
		},

		endAttempt: {
			buttonLabel: 'Versuch Beenden',
			ended: 'Versuch Beendet',
			requested: 'Angefordert',
			warningMessage: 'Ihr Versuch wurde beendet und kann nicht mehr geändert werden.',
			confirmMessage: 'Sind Sie sicher, dass Sie Ihren Versuch beenden möchten? Sie können Ihre Antworten nicht mehr ändern.',
		},

		media: {
			play: 'Abspielen',
			pause: 'Pause',
			volume: 'Lautstärke',
			mute: 'Stummschalten',
			unmute: 'Stummschaltung aufheben',
			fullscreen: 'Vollbild',
			exitFullscreen: 'Vollbild verlassen',
			playbackSpeed: 'Wiedergabegeschwindigkeit',
			currentTime: '{current} / {duration}',
			loading: 'Medien werden geladen...',
		},
	},

	assessment: {
		title: 'Bewertung',
		loading: 'Bewertung wird geladen...',
		loadingError: 'Zeitüberschreitung beim Laden der Bewertung. Diese Bewertung ist möglicherweise ungültig oder der Player konnte nicht initialisiert werden.',
		question: 'Frage {current} von {total}',
		section: 'Abschnitt {current} von {total}',

		navigation: {
			previous: 'Zurück',
			next: 'Weiter',
			submit: 'Senden',
			jumpTo: 'Zu Frage {number} springen',
			sectionMenu: 'Abschnittsmenü',
			progress: 'Fortschritt: {percent} %',
		},

		sections: {
			title: 'Abschnitte',
			selectSection: 'Abschnitt auswählen',
		},

		timer: {
			timeRemaining: 'Verbleibende Zeit: {time}',
			timeElapsed: 'Verstrichene Zeit: {time}',
			timeUp: 'Zeit abgelaufen!',
		},

		feedback: {
			correct: 'Richtig',
			incorrect: 'Falsch',
			partiallyCorrect: 'Teilweise richtig',
			unanswered: 'Nicht beantwortet',
			score: 'Punktzahl: {score} / {maxScore}',
			passed: 'Bestanden',
			failed: 'Nicht bestanden',
		},

		completion: {
			title: 'Bewertung Abgeschlossen',
			message: 'Sie haben die Bewertung abgeschlossen.',
			score: 'Ihre Punktzahl: {score} von {maxScore}',
			percentage: 'Prozentsatz: {percent} %',
			viewResults: 'Ergebnisse anzeigen',
			exit: 'Beenden',
		},

		errors: {
			navigationFailed: 'Navigation fehlgeschlagen. Bitte versuchen Sie es erneut.',
			submitFailed: 'Fehler beim Senden der Bewertung. Bitte versuchen Sie es erneut.',
			loadFailed: 'Fehler beim Laden der Frage.',
			saveFailed: 'Fehler beim Speichern der Antwort.',
		},
	},

	accessibility: {
		skipToContent: 'Zum Inhalt springen',
		skipToNavigation: 'Zur Navigation springen',
		itemBody: 'Frageninhalt',
		navigationRegion: 'Bewertungsnavigation',
		announcement: 'Ankündigung',
		newQuestion: 'Neue Frage geladen',
		answerRecorded: 'Antwort gespeichert',
	},
} as const; // 'as const' for strict type inference
