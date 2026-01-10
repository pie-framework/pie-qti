/**
 * Romanian (Romania) translations
 *
 * Guidelines for translators:
 * - Keep messages concise for UI constraints
 * - Use sentence case for labels, title case for buttons
 * - Maintain consistent terminology across interactions
 * - Variables in {curlyBraces} will be replaced with dynamic values
 */
export default {
	common: {
		loading: 'Se încarcă...',
		error: 'Eroare',
		success: 'Succes',
		cancel: 'Anulează',
		confirm: 'Confirmă',
		close: 'Închide',
		save: 'Salvează',
		delete: 'Șterge',
		edit: 'Editează',
		remove: 'Elimină',
		add: 'Adaugă',
		search: 'Căutare',
		filter: 'Filtrează',
		reset: 'Resetează',
		submit: 'Trimite',
		next: 'Următorul',
		previous: 'Anteriorul',
		back: 'Înapoi',
		continue: 'Continuă',
		finish: 'Finalizează',
	},

	units: {
		bytes: '{count} bytes',
		kilobytes: '{count} KB',
		megabytes: '{count} MB',
		seconds: '{count} secunde',
		minutes: '{count} minute',
		hours: '{count} ore',
	},

	validation: {
		required: 'Acest câmp este obligatoriu',
		invalidFormat: 'Format invalid',
		tooShort: 'Prea scurt (minim {min} caractere)',
		tooLong: 'Prea lung (maxim {max} caractere)',
		outOfRange: 'Valoarea trebuie să fie între {min} și {max}',
	},

	interactions: {
		choice: {
			selectOption: 'Selectați o opțiune',
			selectMultiple: 'Selectați toate variantele aplicabile',
			selected: 'Selectat',
			notSelected: 'Neselectat',
		},

		upload: {
			// Shown as label above file input
			label: 'Încărcați un fișier',
			selectFile: 'Alegeți fișier',
			dragDrop: 'sau trageți și plasați',

			// Displayed before list of allowed file types
			allowedTypes: 'Tipuri de fișiere permise:',

			// Displayed when file is selected
			selectedFile: 'Selectat:',

			// File size display - {size} will be replaced with numeric value
			fileSize: '{size} bytes',
			fileSizeKb: '{size} KB',
			fileSizeMb: '{size} MB',

			removeFile: 'Elimină fișierul',

			// Error shown when file type validation fails
			// {types} will be replaced with comma-separated list of allowed types
			errorInvalidType: 'Tip de fișier nepermis. Permise: {types}',
			errorReadFailed: 'Eșec la citirea fișierului',

			// {max} will be replaced with maximum size in MB
			errorTooLarge: 'Fișierul este prea mare (maxim {max} MB)',
			unknownType: 'Tip de fișier necunoscut',
		},

		drawing: {
			label: 'Desenați răspunsul dumneavoastră',
			clear: 'Șterge desenul',
			undo: 'Anulează',
			redo: 'Refă',
			strokeColor: 'Culoare linie',
			strokeWidth: 'Grosime linie',
			tool: 'Instrument',
		},

		extendedText: {
			placeholder: 'Tastați răspunsul dumneavoastră aici...',
			characterCount: '{count} caractere',
			characterLimit: '{count} / {max} caractere',
			bold: 'Aldin',
			italic: 'Cursiv',
			underline: 'Subliniat',
			bulletList: 'Listă cu puncte',
			numberedList: 'listă numerotată',
			insertMath: 'Inserează ecuație matematică',
		},

		slider: {
			label: 'Cursor',
			selectedValue: 'Valoare selectată: {value}',
			min: 'Minim: {min}',
			max: 'Maxim: {max}',
			step: 'Pas: {step}',
		},

		hottext: {
			selected: 'Selectat:',
			selectText: 'Selectați text din pasaj',
		},

		hotspot: {
			selected: 'Selectat:',
			selectArea: 'Selectați zone pe imagine',
		},

		selectPoint: {
			instruction: 'Faceți clic pe imagine pentru a selecta puncte',
			maxPointsReached: 'Număr maxim de puncte atins. Eliminați un punct pentru a adăuga unul nou.',
			point: 'Punct {index}',
			removePoint: 'Elimină punctul {index}',
		},

		match: {
			// Keyboard instruction for accessible drag-drop
			dragInstruction: 'Apăsați Space sau Enter pentru a potrivi',
			dropTarget: 'Plasați elementul aici',
			matchedWith: 'Potrivit cu {target}',
			available: 'Disponibil',
			removeMatch: 'Elimină potrivirea',
		},

		gapMatch: {
			instruction: 'Trageți cuvintele pentru a completa spațiile libere',
			available: 'Cuvinte disponibile',
			removeWord: 'Elimină cuvântul',
			// {word} will be replaced with the word being removed
			removeFromBlanks: 'Elimină {word} din spațiile libere',
		},

		graphicGapMatch: {
			instruction: 'Plasați etichetele pe zonele active ale imaginii',
			available: 'Etichete disponibile',
			alreadyPlaced: 'Deja plasat pe zona activă',
			selectedForPlacement: 'Selectat pentru plasare',
			pressSpaceToSelect: 'Apăsați Space pentru a selecta',
			pressSpaceToPlace: 'Apăsați Space sau Enter pentru a plasa eticheta',
			removeLabel: 'Elimină eticheta',
			removeFromHotspot: 'Elimină {label} de pe zona activă',
			hotspot: 'Zonă activă {number}',
			contains: 'Conține: {label}',
		},

		order: {
			instruction: 'Trageți elementele pentru a le reordona',
			moveUp: 'Mută în sus',
			moveDown: 'Mută în jos',
			position: 'Poziția {current} din {total}',
		},

		associate: {
			instruction: 'Creați asocieri între elemente',
			createPair: 'Creează pereche',
			removePair: 'Elimină perechea',
		},

		positionObject: {
			instruction: 'Trageți obiecte pe imagine',
			placeObject: 'Plasați {object} pe imagine',
			removeObject: 'Elimină {object}',
			objectAt: '{object} la poziția ({x}, {y})',
		},

		endAttempt: {
			buttonLabel: 'Finalizează Încercarea',
			ended: 'Încercare Finalizată',
			requested: 'Solicitat',
			warningMessage: 'Încercarea dumneavoastră a fost finalizată și nu mai poate fi modificată.',
			confirmMessage: 'Sunteți sigur că doriți să finalizați încercarea? Nu veți mai putea modifica răspunsurile.',
		},

		media: {
			play: 'Redare',
			pause: 'Pauză',
			volume: 'Volum',
			mute: 'Dezactivează sunetul',
			unmute: 'Activează sunetul',
			fullscreen: 'Ecran complet',
			exitFullscreen: 'Ieșire din ecran complet',
			playbackSpeed: 'Viteză de redare',
			currentTime: '{current} / {duration}',
			loading: 'Se încarcă conținutul media...',
		},
	},

	assessment: {
		title: 'Evaluare',
		loading: 'Se încarcă evaluarea...',
		loadingError: 'Timeout la încărcarea evaluării. Această evaluare poate fi invalidă sau playerul nu a reușit să se inițializeze.',
		question: 'Întrebarea {current} din {total}',
		section: 'Secțiunea {current} din {total}',

		navigation: {
			previous: 'Anterior',
			next: 'Următorul',
			submit: 'Trimite',
			jumpTo: 'Salt la întrebarea {number}',
			sectionMenu: 'Meniu secțiuni',
			progress: 'Progres: {percent}%',
		},

		sections: {
			title: 'Secțiuni',
			selectSection: 'Selectați secțiunea',
		},

		timer: {
			timeRemaining: 'Timp rămas: {time}',
			timeElapsed: 'Timp scurs: {time}',
			timeUp: 'Timpul a expirat!',
		},

		feedback: {
			correct: 'Corect',
			incorrect: 'Incorect',
			partiallyCorrect: 'Parțial corect',
			unanswered: 'Fără răspuns',
			score: 'Scor: {score} / {maxScore}',
			passed: 'Promovat',
			failed: 'Nepromovat',
		},

		completion: {
			title: 'Evaluare Finalizată',
			message: 'Ați finalizat evaluarea.',
			score: 'Scorul dumneavoastră: {score} din {maxScore}',
			percentage: 'Procent: {percent}%',
			viewResults: 'Vizualizați rezultatele',
			exit: 'Ieșire',
		},

		errors: {
			navigationFailed: 'Navigarea a eșuat. Vă rugăm încercați din nou.',
			submitFailed: 'Eșec la trimiterea evaluării. Vă rugăm încercați din nou.',
			loadFailed: 'Eșec la încărcarea întrebării.',
			saveFailed: 'Eșec la salvarea răspunsului.',
		},
	},

	accessibility: {
		skipToContent: 'Salt la conținut',
		skipToNavigation: 'Salt la navigare',
		itemBody: 'Conținutul întrebării',
		navigationRegion: 'Navigare evaluare',
		announcement: 'Anunț',
		newQuestion: 'Întrebare nouă încărcată',
		answerRecorded: 'Răspuns înregistrat',
	},
} as const; // 'as const' for strict type inference
