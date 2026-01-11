/**
 * Romanian (Romania) translations
 *
 * Guidelines for translators:
 * - Keep messages concise for UI constraints
 * - Use sentence case for labels, title case for buttons
 * - Maintain consistent terminology across interactions
 * - Variables in {curlyBraces} will be replaced with dynamic values
 *
 * NOTE: Machine translated. Professional review recommended.
 */
export default {
	common: {
		loading: 'Se încarcă...',
		error: 'Eroare',
		success: 'Succes',
		cancel: 'Anulare',
		confirm: 'Confirmare',
		close: 'Închide',
		save: 'Salvare',
		delete: 'Ștergere',
		edit: 'Editare',
		remove: 'Eliminare',
		add: 'Adăugare',
		search: 'Căutare',
		filter: 'Filtrare',
		reset: 'Resetare',
		clear: 'Ștergere',
		clearAll: 'Șterge tot',
		submit: 'Trimitere',
		next: 'Următorul',
		previous: 'Anteriorul',
		back: 'Înapoi',
		continue: 'Continuare',
		finish: 'Finalizare',
		complete: 'Completare',
		completed: 'Completat',
		status: 'Status',
		required: 'Obligatoriu',
		review: 'Revizuire',
		selected: 'Selectat',
		available: 'Disponibil',
		showDetails: 'Afișare detalii',
		hideDetails: 'Ascundere detalii',
		details: 'Detalii',
		deselected: '{item} deselectat',
		selectionCancelled: 'Selecție anulată',
		question: 'Întrebare',
		of: 'din',
		answered: 'răspuns',
		pleaseComplete: 'Vă rugăm completați interacțiunile obligatorii',
		submitting: 'Se trimite...',
		submitAnswer: 'Trimite Răspuns',
		tryAgain: 'Încearcă Din Nou',
		errorNoData: 'Nu au fost furnizate date de interacțiune',
	},

	units: {
		bytes: '{count} octeți',
		kilobytes: '{count} KB',
		megabytes: '{count} MB',
		seconds: '{count} secunde',
		minutes: '{count} minute',
		hours: '{count} ore',
	},

	// Exemple de pluralizare
	// Utilizați i18n.plural('plurals.items', { count: n }) pentru a accesa acestea
	plurals: {
		items: {
			one: '{count} element',
			other: '{count} elemente',
		},
		files: {
			one: '{count} fișier selectat',
			other: '{count} fișiere selectate',
		},
		questions: {
			one: '{count} întrebare',
			other: '{count} întrebări',
		},
		answers: {
			one: '{count} răspuns',
			other: '{count} răspunsuri',
		},
		choices: {
			one: '{count} opțiune',
			other: '{count} opțiuni',
		},
		attempts: {
			one: '{count} încercare rămasă',
			other: '{count} încercări rămase',
		},
		minutesRemaining: {
			one: '{count} minut rămas',
			other: '{count} minute rămase',
		},
		secondsRemaining: {
			one: '{count} secundă rămasă',
			other: '{count} secunde rămase',
		},
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
			selectOption: 'Selectează o opțiune',
			selectMultiple: 'Selectează toate variantele aplicabile',
			selected: 'Selectat',
			notSelected: 'Neselectat',
		},

		upload: {
			label: 'Încarcă un fișier',
			selectFile: 'Alege fișier',
			dragDrop: 'sau trage și plasează',
			allowedTypes: 'Tipuri de fișiere permise:',
			selectedFile: 'Selectat:',
			fileSize: '{size} octeți',
			fileSizeKb: '{size} KB',
			fileSizeMb: '{size} MB',
			removeFile: 'Elimină fișier',
			errorInvalidType: 'Tip de fișier nepermis. Permis: {types}',
			errorReadFailed: 'Nu s-a putut citi fișierul',
			errorTooLarge: 'Fișierul este prea mare (maxim {max} MB)',
			unknownType: 'Tip de fișier necunoscut',
		},

		drawing: {
			label: 'Desenează răspunsul tău',
			clear: 'Șterge desenul',
			undo: 'Anulare',
			redo: 'Refacere',
			strokeColor: 'Culoarea liniei',
			strokeWidth: 'Grosimea liniei',
			tool: 'Instrument',
			instructions: 'Desenează cu mouse-ul sau prin atingere. Folosește butonul Șterge pentru a reseta.',
			canvas: 'Canvas de desenat',
			updated: 'Desen actualizat.',
			cleared: 'Desen șters.',
			generated: 'Generat:',
		},

		extendedText: {
			placeholder: 'Scrie răspunsul tău aici...',
			characterCount: '{count} caractere',
			characterLimit: '{count} / {max} caractere',
			bold: 'Îngroșat',
			italic: 'Cursiv',
			underline: 'Subliniat',
			bulletList: 'Listă cu marcatori',
			numberedList: 'Listă numerotată',
			insertMath: 'Inserează ecuație matematică',
			insertInlineMath: 'Inserează matematică inline',
			insertBlockMath: 'Inserează bloc matematic',
		},

		slider: {
			label: 'Cursor',
			selectedValue: 'Valoare selectată: {value}',
			min: 'Minim: {min}',
			max: 'Maxim: {max}',
			step: 'Pas: {step}',
			ariaLabel: 'Valoare cursor de la {lowerBound} la {upperBound}',
			statTitle: 'Valoare selectată',
		},

		hottext: {
			selected: 'Selectat:',
			selectText: 'Selectează text din pasaj',
			clearSelection: 'Șterge selecția',
			ariaLabel: 'Interacțiune de selecție text',
		},

		hotspot: {
			selected: 'Selectat:',
			selectArea: 'Selectează zone pe imagine',
			ariaLabel: 'Interacțiune hotspot',
			altText: 'Interacțiune hotspot',
		},

		selectPoint: {
			instruction: 'Clic pe imagine pentru a selecta puncte',
			instructionAria: 'Clic pentru a selecta puncte pe imagine',
			maxPointsReached: 'Număr maxim de puncte atins. Elimină un punct pentru a adăuga unul nou.',
			point: 'Punct {index}',
			removePoint: 'Elimină punctul {index}',
			removePointTitle: 'Clic pentru a elimina acest punct',
			removePointAt: 'Elimină punctul {index} la coordonatele {x}, {y}',
			removePointAtTitle: 'Clic pentru a elimina acest punct ({x}, {y})',
			canvas: 'Canvas de selecție',
			noImage: 'Nicio imagine furnizată',
			pointsSelected: 'Puncte selectate:',
			minimumMet: '✓ Minim atins',
			selectAtLeast: 'Selectează cel puțin {minChoices}',
		},

		match: {
			keyboardInstructions: 'Apasă Spațiu sau Enter pentru a selecta un element sursă. Tab pentru a naviga la ținte. Apasă Spațiu sau Enter pe o țintă pentru a crea o potrivire. Apasă Escape pentru a anula selecția.',
			dragInstruction: 'Apasă Spațiu sau Enter pentru a potrivi',
			dropTarget: 'Plasează elementul aici',
			matchedWith: 'Potrivit cu {target}',
			selectedForMatching: 'Selectat pentru potrivire',
			available: 'Disponibil',
			availableForMatching: 'Disponibil pentru potrivire',
			removeMatch: 'Elimină potrivirea',
			clearMatch: 'Șterge potrivirea pentru {source}',
			sourceItemsLabel: 'Elemente sursă de potrivit',
			targetItemsLabel: 'Elemente țintă pentru potrivire',
		},

		gapMatch: {
			instruction: 'Trage cuvinte pentru a completa spațiile libere',
			available: 'Cuvinte disponibile',
			availableLabel: 'Cuvinte disponibile de plasat',
			availableHeading: 'Cuvinte disponibile:',
			removeWord: 'Elimină cuvânt',
			removeFromBlanks: 'Elimină {word} din spațiile libere',
		},

		graphicGapMatch: {
			instruction: 'Plasează etichete pe hotspot-urile imaginii',
			keyboardInstructions: 'Apasă Spațiu sau Enter pentru a selecta o etichetă. Tab pentru a naviga la hotspot-uri pe imagine. Apasă Spațiu sau Enter pe un hotspot pentru a plasa eticheta. Apasă Escape pentru a anula selecția.',
			available: 'Etichete disponibile',
			availableLabel: 'Etichete disponibile de plasat',
			availableHeading: 'Etichete disponibile:',
			alreadyPlaced: 'Deja plasat pe hotspot',
			selectedForPlacement: 'Selectat pentru plasare',
			pressSpaceToSelect: 'Apasă Spațiu pentru a selecta',
			pressSpaceToPlace: 'Apasă Spațiu sau Enter pentru a plasa eticheta',
			removeLabel: 'Elimină eticheta',
			removeFromHotspot: 'Elimină {label} de pe hotspot',
			hotspot: 'Hotspot {number}',
			contains: 'Conține: {label}',
		},

		order: {
			instruction: 'Trage elemente pentru a le reordona',
			keyboardInstructions: 'Apasă Spațiu sau Enter pentru a apuca un element. Folosește săgețile pentru a muta elementul. Apasă din nou Spațiu sau Enter pentru a plasa. Apasă Escape pentru a anula.',
			grabbed: 'Apucat. Folosește săgețile pentru a muta.',
			moveUp: 'Mută în sus',
			moveDown: 'Mută în jos',
			position: 'Poziția {current} din {total}',
			listLabel: 'Listă reordonabilă de opțiuni',
			confirmOrder: 'Confirmă ordinea',
			confirmOrderNoChanges: 'Confirmă ordinea (Fără modificări)',
			confirmAria: 'Confirmă această ordine ca răspuns',
		},

		associate: {
			instruction: 'Creează asocieri între elemente',
			createPair: 'Creează pereche',
			removePair: 'Elimină pereche',
			removeAssociation: 'Elimină asociere',
			diagramLabel: 'Diagramă de asociere',
			altText: 'Diagramă de asociere',
			hotspotConnections: '{label} ({usageCount}/{matchMax} conexiuni)',
			selectAnother: 'Selectat: <strong>{label}</strong>. Clic pe altul',
			minimumRequired: 'Minim necesar: {minAssociations}',
		},

		positionObject: {
			instruction: 'Trage obiecte pe imagine',
			placeObject: 'Plasează {object} pe imagine',
			removeObject: 'Elimină {object}',
			objectAt: '{object} la poziția ({x}, {y})',
			canvasLabel: 'Canvas de poziționare',
			backgroundAlt: 'Fundal de poziționare',
			positioned: '{label} poziționat la ({x}, {y})',
			minimumRequired: 'Minim necesar: {minChoices}',
			maximumAllowed: 'Maxim: {maxChoices}',
			availableObjects: 'Obiecte disponibile',
			objectUsage: '{label} ({usageCount}/{matchMax} folosit)',
		},

		endAttempt: {
			buttonLabel: 'Încheie încercarea',
			ended: 'Încercare încheiată',
			requested: 'Solicitat',
			warningMessage: 'Încercarea ta a fost încheiată și nu mai poate fi modificată.',
			confirmMessage: 'Ești sigur că vrei să închei încercarea? Nu vei putea modifica răspunsurile.',
		},

		media: {
			play: 'Redare',
			pause: 'Pauză',
			volume: 'Volum',
			mute: 'Mut',
			unmute: 'Anulare mut',
			fullscreen: 'Ecran complet',
			exitFullscreen: 'Ieșire din ecran complet',
			playbackSpeed: 'Viteză de redare',
			currentTime: '{current} / {duration}',
			loading: 'Se încarcă media...',
			ariaLabel: 'Conținut media',
			maxPlayLimitReached: 'Limită maximă de redare atinsă',
		},

		graphicOrder: {
			instruction: 'Clic pe hotspot-uri pentru a le ordona',
			diagramLabel: 'Diagramă de ordonare',
			altText: 'Diagramă de ordonare',
			itemLabel: 'Element {index}: {label}',
			confirmOrder: 'Confirmă ordinea',
			confirmOrderNoChanges: 'Confirmă ordinea (Fără modificări)',
			confirmAria: 'Confirmă această ordine ca răspuns',
		},

		custom: {
			fallbackPlaceholder: 'Introdu un răspuns manual (alternativ)',
		},

		inline: {
			placeholder: '...',
			selectPlaceholder: 'Selectare...',
		},
	},

	item: {
		loading: 'Se încarcă elementul...',
		loadingError: 'Nu s-a putut încărca elementul',
		loadError: 'Eroare la încărcarea elementului: {error}',
		parsingError: 'Nu s-a putut analiza QTI XML',
		processingError: 'Nu s-au putut procesa răspunsurile',
		submit: 'Trimitere',
		complete: 'Completare',
		completed: 'Completat',
		attempt: 'Încercarea {numAttempts}',
	},

	itemSession: {
		attempt: 'Încercarea {numAttempts}',
		attemptsRemaining: '{attemptsRemaining} încercări rămase',
		maxAttempts: 'Încercări maxime: {maxAttempts}',
	},

	feedback: {
		close: 'Închide feedback-ul',
		closeFeedback: 'Respinge feedback-ul',
		testFeedback: 'Feedback test',
	},

	assessment: {
		title: 'Evaluare',
		loading: 'Se încarcă evaluarea...',
		loadingError: 'Timeout la încărcarea evaluării. Această evaluare poate fi invalidă sau playerul nu a reușit să se inițializeze.',
		question: 'Întrebarea {current} din {total}',
		questionAnnouncement: 'Întrebarea {current} din {total}',
		section: 'Secțiunea {current} din {total}',
		sectionDefault: 'Secțiunea {number}',
		readingPassage: 'Pasaj de Lectură',
		expandPassage: 'Extinde pasajul',
		collapsePassage: 'Restrânge pasajul',
		closeMenu: 'Închide meniul',

		attempts: {
			remaining: '{count} încercări rămase',
			oneRemaining: '1 încercare rămasă',
			noRemaining: 'Nicio încercare rămasă ({count} folosite)',
			used: 'Încercări: {count}',
			maxReached: 'Încercări maxime atinse',
			required: 'Trebuie să răspunzi înainte de a continua',
			reviewNotAllowed: 'Nepermis odată trimis',
		},

		navigation: {
			previous: 'Anteriorul',
			next: 'Următorul',
			submit: 'Trimitere',
			jumpTo: 'Salt la întrebarea {number}',
			sectionMenu: 'Meniu secțiune',
			progress: 'Progres: {percent}%',
		},

		sections: {
			title: 'Secțiuni',
			selectSection: 'Selectează secțiune',
		},

		timer: {
			timeRemaining: 'Timp rămas: {time}',
			timeElapsed: 'Timp scurs: {time}',
			timeUp: 'Timpul s-a terminat!',
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
			title: 'Evaluare completată',
			message: 'Ai completat evaluarea.',
			score: 'Scorul tău: {score} din {maxScore}',
			percentage: 'Procent: {percent}%',
			viewResults: 'Vezi rezultatele',
			exit: 'Ieșire',
		},

		errors: {
			navigationFailed: 'Navigare eșuată. Te rugăm să încerci din nou.',
			submitFailed: 'Trimiterea evaluării a eșuat. Te rugăm să încerci din nou.',
			loadFailed: 'Încărcarea întrebării a eșuat.',
			saveFailed: 'Salvarea răspunsului a eșuat.',
		},
	},

	i18n: {
		selectLanguage: 'Limbă',
		selectLanguageAriaLabel: 'Selectează limba de afișare',
	},

	accessibility: {
		skipToContent: 'Salt la conținut',
		skipToNavigation: 'Salt la navigare',
		itemBody: 'Conținut întrebare',
		navigationRegion: 'Navigare evaluare',
		announcement: 'Anunț',
		newQuestion: 'Întrebare nouă încărcată',
		answerRecorded: 'Răspuns înregistrat',
		resizer: 'Redimensionează panourile de pasaj și întrebare',
	},
} as const; // 'as const' for strict type inference
