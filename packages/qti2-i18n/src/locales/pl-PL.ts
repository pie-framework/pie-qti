/**
 * Polish (Poland) translations
 *
 * Guidelines for translators:
 * - Keep messages concise for UI constraints
 * - Use sentence case for labels, title case for buttons
 * - Maintain consistent terminology across interactions
 * - Variables in {curlyBraces} will be replaced with dynamic values
 */
export default {
	common: {
		loading: 'Ładowanie...',
		error: 'Błąd',
		success: 'Sukces',
		cancel: 'Anuluj',
		confirm: 'Potwierdź',
		close: 'Zamknij',
		save: 'Zapisz',
		delete: 'Usuń',
		edit: 'Edytuj',
		remove: 'Usuń',
		add: 'Dodaj',
		search: 'Szukaj',
		filter: 'Filtruj',
		reset: 'Resetuj',
		submit: 'Wyślij',
		next: 'Dalej',
		previous: 'Wstecz',
		back: 'Cofnij',
		continue: 'Kontynuuj',
		finish: 'Zakończ',
	},

	units: {
		bytes: '{count} bajtów',
		kilobytes: '{count} KB',
		megabytes: '{count} MB',
		seconds: '{count} sekund',
		minutes: '{count} minut',
		hours: '{count} godzin',
	},

	validation: {
		required: 'To pole jest wymagane',
		invalidFormat: 'Nieprawidłowy format',
		tooShort: 'Za krótkie (minimum {min} znaków)',
		tooLong: 'Za długie (maksimum {max} znaków)',
		outOfRange: 'Wartość musi być między {min} a {max}',
	},

	interactions: {
		choice: {
			selectOption: 'Wybierz opcję',
			selectMultiple: 'Wybierz wszystkie pasujące',
			selected: 'Wybrano',
			notSelected: 'Nie wybrano',
		},

		upload: {
			// Shown as label above file input
			label: 'Prześlij plik',
			selectFile: 'Wybierz plik',
			dragDrop: 'lub przeciągnij i upuść',

			// Displayed before list of allowed file types
			allowedTypes: 'Dozwolone typy plików:',

			// Displayed when file is selected
			selectedFile: 'Wybrano:',

			// File size display - {size} will be replaced with numeric value
			fileSize: '{size} bajtów',
			fileSizeKb: '{size} KB',
			fileSizeMb: '{size} MB',

			removeFile: 'Usuń plik',

			// Error shown when file type validation fails
			// {types} will be replaced with comma-separated list of allowed types
			errorInvalidType: 'Typ pliku niedozwolony. Dozwolone: {types}',
			errorReadFailed: 'Nie udało się odczytać pliku',

			// {max} will be replaced with maximum size in MB
			errorTooLarge: 'Plik jest za duży (maksimum {max} MB)',
			unknownType: 'Nieznany typ pliku',
		},

		drawing: {
			label: 'Narysuj swoją odpowiedź',
			clear: 'Wyczyść rysunek',
			undo: 'Cofnij',
			redo: 'Ponów',
			strokeColor: 'Kolor linii',
			strokeWidth: 'Grubość linii',
			tool: 'Narzędzie',
		},

		extendedText: {
			placeholder: 'Wpisz tutaj swoją odpowiedź...',
			characterCount: '{count} znaków',
			characterLimit: '{count} / {max} znaków',
			bold: 'Pogrubienie',
			italic: 'Kursywa',
			underline: 'Podkreślenie',
			bulletList: 'Lista wypunktowana',
			numberedList: 'Lista numerowana',
			insertMath: 'Wstaw równanie matematyczne',
		},

		slider: {
			label: 'Suwak',
			selectedValue: 'Wybrana wartość: {value}',
			min: 'Minimum: {min}',
			max: 'Maksimum: {max}',
			step: 'Krok: {step}',
		},

		hottext: {
			selected: 'Wybrano:',
			selectText: 'Wybierz tekst z fragmentu',
		},

		hotspot: {
			selected: 'Wybrano:',
			selectArea: 'Wybierz obszary na obrazie',
		},

		selectPoint: {
			instruction: 'Kliknij na obraz, aby wybrać punkty',
			maxPointsReached: 'Osiągnięto maksymalną liczbę punktów. Usuń punkt, aby dodać nowy.',
			point: 'Punkt {index}',
			removePoint: 'Usuń punkt {index}',
		},

		match: {
			// Keyboard instruction for accessible drag-drop
			dragInstruction: 'Naciśnij Spację lub Enter, aby dopasować',
			dropTarget: 'Upuść element tutaj',
			matchedWith: 'Dopasowano z {target}',
			available: 'Dostępne',
			removeMatch: 'Usuń dopasowanie',
		},

		gapMatch: {
			instruction: 'Przeciągnij słowa, aby wypełnić luki',
			available: 'Dostępne słowa',
			removeWord: 'Usuń słowo',
			// {word} will be replaced with the word being removed
			removeFromBlanks: 'Usuń {word} z luk',
		},

		graphicGapMatch: {
			instruction: 'Umieść etykiety na punktach aktywnych obrazu',
			available: 'Dostępne etykiety',
			alreadyPlaced: 'Już umieszczona na punkcie aktywnym',
			selectedForPlacement: 'Wybrana do umieszczenia',
			pressSpaceToSelect: 'Naciśnij Spację, aby wybrać',
			pressSpaceToPlace: 'Naciśnij Spację lub Enter, aby umieścić etykietę',
			removeLabel: 'Usuń etykietę',
			removeFromHotspot: 'Usuń {label} z punktu aktywnego',
			hotspot: 'Punkt aktywny {number}',
			contains: 'Zawiera: {label}',
		},

		order: {
			instruction: 'Przeciągnij elementy, aby zmienić ich kolejność',
			moveUp: 'Przesuń w górę',
			moveDown: 'Przesuń w dół',
			position: 'Pozycja {current} z {total}',
		},

		associate: {
			instruction: 'Utwórz powiązania między elementami',
			createPair: 'Utwórz parę',
			removePair: 'Usuń parę',
		},

		positionObject: {
			instruction: 'Przeciągnij obiekty na obraz',
			placeObject: 'Umieść {object} na obrazie',
			removeObject: 'Usuń {object}',
			objectAt: '{object} na pozycji ({x}, {y})',
		},

		endAttempt: {
			buttonLabel: 'Zakończ próbę',
			ended: 'Próba zakończona',
			requested: 'Zażądano',
			warningMessage: 'Twoja próba została zakończona i nie można jej już modyfikować.',
			confirmMessage: 'Czy na pewno chcesz zakończyć swoją próbę? Nie będziesz mógł zmienić swoich odpowiedzi.',
		},

		media: {
			play: 'Odtwórz',
			pause: 'Wstrzymaj',
			volume: 'Głośność',
			mute: 'Wycisz',
			unmute: 'Włącz dźwięk',
			fullscreen: 'Pełny ekran',
			exitFullscreen: 'Wyjdź z pełnego ekranu',
			playbackSpeed: 'Prędkość odtwarzania',
			currentTime: '{current} / {duration}',
			loading: 'Ładowanie multimediów...',
		},
	},

	assessment: {
		title: 'Test',
		loading: 'Ładowanie testu...',
		loadingError: 'Przekroczono czas ładowania testu. Ten test może być nieprawidłowy lub odtwarzacz nie zdołał się zainicjalizować.',
		question: 'Pytanie {current} z {total}',
		section: 'Sekcja {current} z {total}',

		navigation: {
			previous: 'Wstecz',
			next: 'Dalej',
			submit: 'Wyślij',
			jumpTo: 'Przejdź do pytania {number}',
			sectionMenu: 'Menu sekcji',
			progress: 'Postęp: {percent}%',
		},

		sections: {
			title: 'Sekcje',
			selectSection: 'Wybierz sekcję',
		},

		timer: {
			timeRemaining: 'Pozostały czas: {time}',
			timeElapsed: 'Upłynął czas: {time}',
			timeUp: 'Czas minął!',
		},

		feedback: {
			correct: 'Poprawnie',
			incorrect: 'Niepoprawnie',
			partiallyCorrect: 'Częściowo poprawnie',
			unanswered: 'Bez odpowiedzi',
			score: 'Wynik: {score} / {maxScore}',
			passed: 'Zaliczone',
			failed: 'Niezaliczone',
		},

		completion: {
			title: 'Test ukończony',
			message: 'Ukończyłeś test.',
			score: 'Twój wynik: {score} z {maxScore}',
			percentage: 'Procent: {percent}%',
			viewResults: 'Zobacz wyniki',
			exit: 'Wyjdź',
		},

		errors: {
			navigationFailed: 'Nawigacja nie powiodła się. Spróbuj ponownie.',
			submitFailed: 'Nie udało się wysłać testu. Spróbuj ponownie.',
			loadFailed: 'Nie udało się załadować pytania.',
			saveFailed: 'Nie udało się zapisać odpowiedzi.',
		},
	},

	accessibility: {
		skipToContent: 'Przejdź do treści',
		skipToNavigation: 'Przejdź do nawigacji',
		itemBody: 'Treść pytania',
		navigationRegion: 'Nawigacja testu',
		announcement: 'Ogłoszenie',
		newQuestion: 'Załadowano nowe pytanie',
		answerRecorded: 'Zarejestrowano odpowiedź',
	},
} as const; // 'as const' for strict type inference
