/**
 * Traduzioni Italiano (Italia)
 *
 * Linee guida per i traduttori:
 * - Mantenere i messaggi concisi per i vincoli dell'interfaccia
 * - Usare maiuscole iniziali per le etichette, maiuscole per i pulsanti
 * - Mantenere terminologia coerente tra le interazioni
 * - Le variabili tra {parentesiGraffe} saranno sostituite con valori dinamici
 */
export default {
	common: {
		loading: 'Caricamento...',
		error: 'Errore',
		success: 'Successo',
		cancel: 'Annulla',
		confirm: 'Conferma',
		close: 'Chiudi',
		save: 'Salva',
		delete: 'Elimina',
		edit: 'Modifica',
		remove: 'Rimuovi',
		add: 'Aggiungi',
		search: 'Cerca',
		filter: 'Filtra',
		reset: 'Ripristina',
		submit: 'Invia',
		next: 'Avanti',
		previous: 'Indietro',
		back: 'Torna',
		continue: 'Continua',
		finish: 'Termina',
	},

	units: {
		bytes: '{count} byte',
		kilobytes: '{count} KB',
		megabytes: '{count} MB',
		seconds: '{count} secondi',
		minutes: '{count} minuti',
		hours: '{count} ore',
	},

	validation: {
		required: 'Questo campo è obbligatorio',
		invalidFormat: 'Formato non valido',
		tooShort: 'Troppo corto (minimo {min} caratteri)',
		tooLong: 'Troppo lungo (massimo {max} caratteri)',
		outOfRange: 'Il valore deve essere compreso tra {min} e {max}',
	},

	interactions: {
		choice: {
			selectOption: 'Selezionare un\'opzione',
			selectMultiple: 'Selezionare tutte le opzioni applicabili',
			selected: 'Selezionato',
			notSelected: 'Non selezionato',
		},

		upload: {
			// Shown as label above file input
			label: 'Caricare un file',
			selectFile: 'Scegliere file',
			dragDrop: 'o trascinare e rilasciare',

			// Displayed before list of allowed file types
			allowedTypes: 'Tipi di file consentiti:',

			// Displayed when file is selected
			selectedFile: 'Selezionato:',

			// File size display - {size} will be replaced with numeric value
			fileSize: '{size} byte',
			fileSizeKb: '{size} KB',
			fileSizeMb: '{size} MB',

			removeFile: 'Rimuovere file',

			// Error shown when file type validation fails
			// {types} will be replaced with comma-separated list of allowed types
			errorInvalidType: 'Tipo di file non consentito. Consentiti: {types}',
			errorReadFailed: 'Impossibile leggere il file',

			// {max} will be replaced with maximum size in MB
			errorTooLarge: 'Il file è troppo grande (massimo {max} MB)',
			unknownType: 'Tipo di file sconosciuto',
		},

		drawing: {
			label: 'Disegnare la risposta',
			clear: 'Cancellare disegno',
			undo: 'Annulla',
			redo: 'Ripeti',
			strokeColor: 'Colore tratto',
			strokeWidth: 'Spessore tratto',
			tool: 'Strumento',
		},

		extendedText: {
			placeholder: 'Digitare la risposta qui...',
			characterCount: '{count} caratteri',
			characterLimit: '{count} / {max} caratteri',
			bold: 'Grassetto',
			italic: 'Corsivo',
			underline: 'Sottolineato',
			bulletList: 'Elenco puntato',
			numberedList: 'Elenco numerato',
			insertMath: 'Inserire equazione matematica',
		},

		slider: {
			label: 'Cursore',
			selectedValue: 'Valore selezionato: {value}',
			min: 'Minimo: {min}',
			max: 'Massimo: {max}',
			step: 'Passo: {step}',
		},

		hottext: {
			selected: 'Selezionato:',
			selectText: 'Selezionare il testo dal brano',
		},

		hotspot: {
			selected: 'Selezionato:',
			selectArea: 'Selezionare aree sull\'immagine',
		},

		selectPoint: {
			instruction: 'Fare clic sull\'immagine per selezionare punti',
			maxPointsReached: 'Numero massimo di punti raggiunto. Rimuovere un punto per aggiungerne uno nuovo.',
			point: 'Punto {index}',
			removePoint: 'Rimuovere punto {index}',
		},

		match: {
			// Keyboard instruction for accessible drag-drop
			dragInstruction: 'Premere Spazio o Invio per abbinare',
			dropTarget: 'Rilasciare elemento qui',
			matchedWith: 'Abbinato con {target}',
			available: 'Disponibile',
			removeMatch: 'Rimuovere abbinamento',
		},

		gapMatch: {
			instruction: 'Trascinare le parole per riempire gli spazi vuoti',
			available: 'Parole disponibili',
			removeWord: 'Rimuovere parola',
			// {word} will be replaced with the word being removed
			removeFromBlanks: 'Rimuovere {word} dagli spazi vuoti',
		},

		graphicGapMatch: {
			instruction: 'Posizionare le etichette sui punti attivi dell\'immagine',
			available: 'Etichette disponibili',
			alreadyPlaced: 'Già posizionata sul punto attivo',
			selectedForPlacement: 'Selezionata per posizionamento',
			pressSpaceToSelect: 'Premere Spazio per selezionare',
			pressSpaceToPlace: 'Premere Spazio o Invio per posizionare etichetta',
			removeLabel: 'Rimuovere etichetta',
			removeFromHotspot: 'Rimuovere {label} dal punto attivo',
			hotspot: 'Punto attivo {number}',
			contains: 'Contiene: {label}',
		},

		order: {
			instruction: 'Trascinare gli elementi per riordinarli',
			moveUp: 'Sposta su',
			moveDown: 'Sposta giù',
			position: 'Posizione {current} di {total}',
		},

		associate: {
			instruction: 'Creare associazioni tra gli elementi',
			createPair: 'Creare coppia',
			removePair: 'Rimuovere coppia',
		},

		positionObject: {
			instruction: 'Trascinare oggetti sull\'immagine',
			placeObject: 'Posizionare {object} sull\'immagine',
			removeObject: 'Rimuovere {object}',
			objectAt: '{object} in posizione ({x}, {y})',
		},

		endAttempt: {
			buttonLabel: 'Terminare tentativo',
			ended: 'Tentativo terminato',
			requested: 'Richiesto',
			warningMessage: 'Il tentativo è stato terminato e non può più essere modificato.',
			confirmMessage: 'Confermare la terminazione del tentativo? Non sarà più possibile modificare le risposte.',
		},

		media: {
			play: 'Riproduci',
			pause: 'Pausa',
			volume: 'Volume',
			mute: 'Silenzia',
			unmute: 'Attiva audio',
			fullscreen: 'Schermo intero',
			exitFullscreen: 'Esci da schermo intero',
			playbackSpeed: 'Velocità di riproduzione',
			currentTime: '{current} / {duration}',
			loading: 'Caricamento media...',
		},
	},

	assessment: {
		title: 'Valutazione',
		loading: 'Caricamento valutazione...',
		loadingError: 'Timeout durante il caricamento della valutazione. La valutazione potrebbe non essere valida o il player non si è inizializzato.',
		question: 'Domanda {current} di {total}',
		section: 'Sezione {current} di {total}',

		navigation: {
			previous: 'Precedente',
			next: 'Successivo',
			submit: 'Invia',
			jumpTo: 'Vai alla domanda {number}',
			sectionMenu: 'Menu sezioni',
			progress: 'Progresso: {percent}%',
		},

		sections: {
			title: 'Sezioni',
			selectSection: 'Selezionare sezione',
		},

		timer: {
			timeRemaining: 'Tempo rimanente: {time}',
			timeElapsed: 'Tempo trascorso: {time}',
			timeUp: 'Tempo scaduto!',
		},

		feedback: {
			correct: 'Corretto',
			incorrect: 'Errato',
			partiallyCorrect: 'Parzialmente corretto',
			unanswered: 'Senza risposta',
			score: 'Punteggio: {score} / {maxScore}',
			passed: 'Superato',
			failed: 'Non superato',
		},

		completion: {
			title: 'Valutazione completata',
			message: 'La valutazione è stata completata.',
			score: 'Il punteggio ottenuto: {score} su {maxScore}',
			percentage: 'Percentuale: {percent}%',
			viewResults: 'Visualizzare risultati',
			exit: 'Esci',
		},

		errors: {
			navigationFailed: 'Navigazione non riuscita. Riprovare.',
			submitFailed: 'Impossibile inviare la valutazione. Riprovare.',
			loadFailed: 'Impossibile caricare la domanda.',
			saveFailed: 'Impossibile salvare la risposta.',
		},
	},

	accessibility: {
		skipToContent: 'Salta al contenuto',
		skipToNavigation: 'Salta alla navigazione',
		itemBody: 'Contenuto della domanda',
		navigationRegion: 'Navigazione valutazione',
		announcement: 'Annuncio',
		newQuestion: 'Nuova domanda caricata',
		answerRecorded: 'Risposta registrata',
	},
} as const; // 'as const' for strict type inference
