/**
 * Dutch (Netherlands) translations
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
		reset: 'Resetten',
		clear: 'Wissen',
		clearAll: 'Alles wissen',
		submit: 'Verzenden',
		next: 'Volgende',
		previous: 'Vorige',
		back: 'Terug',
		continue: 'Doorgaan',
		finish: 'Voltooien',
		complete: 'Voltooien',
		completed: 'Voltooid',
		status: 'Status',
		required: 'Verplicht',
		review: 'Beoordelen',
		selected: 'Geselecteerd',
		available: 'Beschikbaar',
		showDetails: 'Details tonen',
		hideDetails: 'Details verbergen',
		details: 'Details',
		deselected: '{item} gedeselecteerd',
		selectionCancelled: 'Selectie geannuleerd',
		question: 'Vraag',
		of: 'van',
		answered: 'beantwoord',
		pleaseComplete: 'Voltooi de vereiste interacties',
		submitting: 'Verzenden...',
		submitAnswer: 'Antwoord Verzenden',
		tryAgain: 'Opnieuw Proberen',
		errorNoData: 'Geen interactiegegevens verstrekt',
	},

	units: {
		bytes: '{count} bytes',
		kilobytes: '{count} KB',
		megabytes: '{count} MB',
		seconds: '{count} seconden',
		minutes: '{count} minuten',
		hours: '{count} uren',
	},

	// Meervoudsvoorbeelden
	// Gebruik i18n.plural('plurals.items', { count: n }) om deze te benaderen
	plurals: {
		items: {
			one: '{count} item',
			other: '{count} items',
		},
		files: {
			one: '{count} bestand geselecteerd',
			other: '{count} bestanden geselecteerd',
		},
		questions: {
			one: '{count} vraag',
			other: '{count} vragen',
		},
		answers: {
			one: '{count} antwoord',
			other: '{count} antwoorden',
		},
		choices: {
			one: '{count} keuze',
			other: '{count} keuzes',
		},
		attempts: {
			one: '{count} poging over',
			other: '{count} pogingen over',
		},
		minutesRemaining: {
			one: '{count} minuut over',
			other: '{count} minuten over',
		},
		secondsRemaining: {
			one: '{count} seconde over',
			other: '{count} seconden over',
		},
		submitAnswer: {
			one: 'Antwoord Verzenden',
			other: 'Antwoorden Verzenden',
		},
	},

	validation: {
		required: 'Dit veld is verplicht',
		invalidFormat: 'Ongeldig formaat',
		tooShort: 'Te kort (minimaal {min} tekens)',
		tooLong: 'Te lang (maximaal {max} tekens)',
		outOfRange: 'Waarde moet tussen {min} en {max} liggen',
	},

	interactions: {
		choice: {
			selectOption: 'Selecteer een optie',
			selectMultiple: 'Selecteer alle toepasselijke opties',
			selected: 'Geselecteerd',
			notSelected: 'Niet geselecteerd',
		},

		upload: {
			label: 'Upload een bestand',
			selectFile: 'Kies bestand',
			dragDrop: 'of sleep en zet neer',
			allowedTypes: 'Toegestane bestandstypen:',
			selectedFile: 'Geselecteerd:',
			fileSize: '{size} bytes',
			fileSizeKb: '{size} KB',
			fileSizeMb: '{size} MB',
			removeFile: 'Bestand verwijderen',
			errorInvalidType: 'Bestandstype niet toegestaan. Toegestaan: {types}',
			errorReadFailed: 'Kan bestand niet lezen',
			errorTooLarge: 'Bestand is te groot (maximaal {max} MB)',
			unknownType: 'Onbekend bestandstype',
		},

		drawing: {
			label: 'Teken je antwoord',
			clear: 'Tekening wissen',
			undo: 'Ongedaan maken',
			redo: 'Opnieuw doen',
			strokeColor: 'Lijnkleur',
			strokeWidth: 'Lijndikte',
			tool: 'Gereedschap',
			instructions: 'Teken met je muis of touchscreen. Gebruik de Wissen-knop om te resetten.',
			canvas: 'Tekencanvas',
			updated: 'Tekening bijgewerkt.',
			cleared: 'Tekening gewist.',
			generated: 'Gegenereerd:',
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
			insertMath: 'Wiskundige vergelijking invoegen',
			insertInlineMath: 'Inline wiskunde invoegen',
			insertBlockMath: 'Wiskundeblok invoegen',
		},

		slider: {
			label: 'Schuifregelaar',
			selectedValue: 'Geselecteerde waarde: {value}',
			min: 'Minimum: {min}',
			max: 'Maximum: {max}',
			step: 'Stap: {step}',
			ariaLabel: 'Schuifregelaarwaarde van {lowerBound} tot {upperBound}',
			statTitle: 'Geselecteerde waarde',
		},

		hottext: {
			selected: 'Geselecteerd:',
			selectText: 'Selecteer tekst uit de passage',
			clearSelection: 'Selectie wissen',
			ariaLabel: 'Tekstselectie-interactie',
		},

		hotspot: {
			selected: 'Geselecteerd:',
			selectArea: 'Selecteer gebieden op de afbeelding',
			ariaLabel: 'Hotspot-interactie',
			altText: 'Hotspot-interactie',
		},

		selectPoint: {
			instruction: 'Klik op de afbeelding om punten te selecteren',
			instructionAria: 'Klik om punten op de afbeelding te selecteren',
			maxPointsReached: 'Maximaal aantal punten bereikt. Verwijder een punt om een nieuwe toe te voegen.',
			point: 'Punt {index}',
			removePoint: 'Punt {index} verwijderen',
			removePointTitle: 'Klik om dit punt te verwijderen',
			removePointAt: 'Punt {index} verwijderen op coördinaten {x}, {y}',
			removePointAtTitle: 'Klik om dit punt te verwijderen ({x}, {y})',
			canvas: 'Selectiecanvas',
			noImage: 'Geen afbeelding opgegeven',
			pointsSelected: 'Punten geselecteerd:',
			minimumMet: '✓ Minimum bereikt',
			selectAtLeast: 'Selecteer minimaal {minChoices}',
		},

		match: {
			keyboardInstructions: 'Druk op Spatie of Enter om een bronitem te selecteren. Tab om naar doelen te navigeren. Druk op Spatie of Enter op een doel om een match te maken. Druk op Escape om selectie te annuleren.',
			dragInstruction: 'Druk op Spatie of Enter om te koppelen',
			dropTarget: 'Zet item hier neer',
			matchedWith: 'Gekoppeld met {target}',
			selectedForMatching: 'Geselecteerd voor koppeling',
			available: 'Beschikbaar',
			availableForMatching: 'Beschikbaar voor koppeling',
			removeMatch: 'Koppeling verwijderen',
			clearMatch: 'Koppeling wissen voor {source}',
			sourceItemsLabel: 'Bronitems om te koppelen',
			targetItemsLabel: 'Doelitems voor koppeling',
		},

		gapMatch: {
			instruction: 'Sleep woorden om de lege plaatsen in te vullen',
			available: 'Beschikbare woorden',
			availableLabel: 'Beschikbare woorden om te plaatsen',
			availableHeading: 'Beschikbare woorden:',
			removeWord: 'Woord verwijderen',
			removeFromBlanks: '{word} verwijderen uit de lege plaatsen',
			gapAriaLabel: 'Gat {gapId}',
			blankGapAriaLabel: 'Lege plek {gapId}. Sleep hier een antwoord naartoe.',
			filledGapAriaLabel: 'Blank {gapId}, filled with {word}. Click to clear.',
		},

		graphicGapMatch: {
			instruction: 'Plaats labels op de hotspots van de afbeelding',
			keyboardInstructions: 'Druk op Spatie of Enter om een label te selecteren. Tab om naar hotspots op de afbeelding te navigeren. Druk op Spatie of Enter op een hotspot om het label te plaatsen. Druk op Escape om selectie te annuleren.',
			available: 'Beschikbare labels',
			availableLabel: 'Beschikbare labels om te plaatsen',
			availableHeading: 'Beschikbare labels:',
			alreadyPlaced: 'Al geplaatst op hotspot',
			selectedForPlacement: 'Geselecteerd voor plaatsing',
			pressSpaceToSelect: 'Druk op Spatie om te selecteren',
			pressSpaceToPlace: 'Druk op Spatie of Enter om label te plaatsen',
			removeLabel: 'Label verwijderen',
			removeFromHotspot: '{label} verwijderen van hotspot',
			hotspot: 'Hotspot {number}',
			contains: 'Bevat: {label}',
		},

		order: {
			instruction: 'Sleep items om ze te herschikken',
			keyboardInstructions: 'Druk op Spatie of Enter om een item te pakken. Gebruik pijltjestoetsen om het item te verplaatsen. Druk opnieuw op Spatie of Enter om neer te zetten. Druk op Escape om te annuleren.',
			grabbed: 'Gepakt. Gebruik pijltjestoetsen om te verplaatsen.',
			moveUp: 'Omhoog',
			moveDown: 'Omlaag',
			position: 'Positie {current} van {total}',
			listLabel: 'Herschikbare lijst met keuzes',
			confirmOrder: 'Volgorde bevestigen',
			confirmOrderNoChanges: 'Volgorde bevestigen (Geen wijzigingen)',
			confirmAria: 'Bevestig deze volgorde als je antwoord',
		},

		associate: {
			instruction: 'Maak associaties tussen items',
			createPair: 'Paar maken',
			removePair: 'Paar verwijderen',
			removeAssociation: 'Associatie verwijderen',
			diagramLabel: 'Associatiediagram',
			altText: 'Associatiediagram',
			hotspotConnections: '{label} ({usageCount}/{matchMax} verbindingen)',
			selectAnother: 'Geselecteerd: <strong>{label}</strong>. Klik op een andere',
			minimumRequired: 'Minimaal vereist: {minAssociations}',
		},

		positionObject: {
			instruction: 'Sleep objecten op de afbeelding',
			placeObject: 'Plaats {object} op afbeelding',
			removeObject: 'Verwijder {object}',
			objectAt: '{object} op positie ({x}, {y})',
			canvasLabel: 'Positioneringscanvas',
			backgroundAlt: 'Positioneringsachtergrond',
			positioned: '{label} gepositioneerd op ({x}, {y})',
			minimumRequired: 'Minimaal vereist: {minChoices}',
			maximumAllowed: 'Maximum: {maxChoices}',
			availableObjects: 'Beschikbare objecten',
			objectUsage: '{label} ({usageCount}/{matchMax} gebruikt)',
		},

		endAttempt: {
			buttonLabel: 'Poging beëindigen',
			ended: 'Poging beëindigd',
			requested: 'Aangevraagd',
			warningMessage: 'Je poging is beëindigd en kan niet meer worden gewijzigd.',
			confirmMessage: 'Weet je zeker dat je je poging wilt beëindigen? Je kunt je antwoorden niet meer wijzigen.',
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
			ariaLabel: 'Media-inhoud',
			maxPlayLimitReached: 'Maximale afspeellimiet bereikt',
		},

		graphicOrder: {
			instruction: 'Klik op hotspots om ze te ordenen',
			diagramLabel: 'Ordeningsdiagram',
			altText: 'Ordeningsdiagram',
			itemLabel: 'Item {index}: {label}',
			confirmOrder: 'Volgorde bevestigen',
			confirmOrderNoChanges: 'Volgorde bevestigen (Geen wijzigingen)',
			confirmAria: 'Bevestig deze volgorde als je antwoord',
		},

		custom: {
			fallbackPlaceholder: 'Voer een handmatig antwoord in (fallback)',
		},

		inline: {
			placeholder: '...',
			selectPlaceholder: 'Selecteren...',
		},
	},

	item: {
		loading: 'Item laden...',
		loadingError: 'Kan item niet laden',
		loadError: 'Fout bij laden van item: {error}',
		parsingError: 'Kan QTI XML niet parseren',
		processingError: 'Kan antwoorden niet verwerken',
		submit: 'Verzenden',
		complete: 'Voltooien',
		completed: 'Voltooid',
		attempt: 'Poging {numAttempts}',
	},

	itemSession: {
		attempt: 'Poging {numAttempts}',
		attemptsRemaining: '{attemptsRemaining} pogingen over',
		maxAttempts: 'Max. pogingen: {maxAttempts}',
	},

	feedback: {
		close: 'Feedback sluiten',
		closeFeedback: 'Feedback negeren',
		testFeedback: 'Testfeedback',
	},

	assessment: {
		title: 'Toets',
		loading: 'Toets laden...',
		loadingError: 'Time-out bij laden van toets. Deze toets is mogelijk ongeldig of de speler kon niet worden geïnitialiseerd.',
		question: 'Vraag {current} van {total}',
		questionAnnouncement: 'Vraag {current} van {total}',
		section: 'Sectie {current} van {total}',
		sectionDefault: 'Sectie {number}',
		readingPassage: 'Leestekst',
		expandPassage: 'Tekst uitvouwen',
		collapsePassage: 'Tekst samenvouwen',
		closeMenu: 'Menu sluiten',

		attempts: {
			remaining: '{count} pogingen over',
			oneRemaining: '1 poging over',
			noRemaining: 'Geen pogingen over ({count} gebruikt)',
			used: 'Pogingen: {count}',
			maxReached: 'Max. pogingen bereikt',
			required: 'Moet antwoorden voordat je verder kunt',
			reviewNotAllowed: 'Niet toegestaan na verzending',
		},

		navigation: {
			previous: 'Vorige',
			next: 'Volgende',
			submit: 'Verzenden',
			jumpTo: 'Ga naar vraag {number}',
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
			timeUp: 'Tijd is om!',
		},

		feedback: {
			correct: 'Correct',
			incorrect: 'Incorrect',
			partiallyCorrect: 'Gedeeltelijk correct',
			unanswered: 'Niet beantwoord',
			score: 'Score: {score} / {maxScore}',
			passed: 'Geslaagd',
			failed: 'Niet geslaagd',
		},

		completion: {
			title: 'Toets voltooid',
			message: 'Je hebt de toets voltooid.',
			score: 'Je score: {score} van {maxScore}',
			percentage: 'Percentage: {percent}%',
			viewResults: 'Resultaten bekijken',
			exit: 'Afsluiten',
		},

		errors: {
			navigationFailed: 'Navigatie mislukt. Probeer het opnieuw.',
			submitFailed: 'Kan toets niet verzenden. Probeer het opnieuw.',
			loadFailed: 'Kan vraag niet laden.',
			saveFailed: 'Kan antwoord niet opslaan.',
		},
	},

	i18n: {
		selectLanguage: 'Taal',
		selectLanguageAriaLabel: 'Selecteer weergavetaal',
	},

	accessibility: {
		skipToContent: 'Naar inhoud springen',
		skipToNavigation: 'Naar navigatie springen',
		itemBody: 'Vraaginhoud',
		navigationRegion: 'Toetsnavigatie',
		announcement: 'Aankondiging',
		newQuestion: 'Nieuwe vraag geladen',
		answerRecorded: 'Antwoord opgeslagen',
		resizer: 'Grootte van tekst- en vraagpanelen aanpassen',
	},

	demo: {
		selectSampleItem: 'Selecteer voorbeelditem',
		configurationPanel: 'Configuratiepaneel',
		viewingAs: 'Bekijken als',
		role: 'Rol',
		candidate: 'Kandidaat',
		author: 'Auteur',
		proctor: 'Toezichthouder',
		scorer: 'Beoordelaar',
		tutor: 'Begeleider',
		showCorrectAnswers: 'Juiste antwoorden tonen',
		showFeedback: 'Feedback tonen',
		xmlEditor: 'XML-editor',

		// Navigation
		appName: 'PIE QTI 2.2 Speler',
		home: 'Home',
		itemDemo: 'Item Demo',
		assessmentDemo: 'Toets Demo',
		likertDemo: 'Likert Plugin Demo',
		iframeDemo: 'Iframe Demo',
		theme: 'Thema',

		// Home Page
		homeTitle: 'QTI 2.2 Speler',
		homeSubtitle: 'Een moderne, framework-onafhankelijke speler voor QTI 2.2 beoordelingsitems. Werkt standaard 100% client-side, met optionele server-side hooks voor productiegebruik.',
		homeMetaDescription: 'Moderne QTI 2.2 speler met optionele backend-integratie',
		tryItems: 'Items Proberen',
		tryAssessments: 'Toetsen Proberen',
		pluginDemo: 'Plugin Demo',
		dropQtiFile: 'Sleep QTI XML bestand hier',
		orClickToSelect: 'of klik om een bestand te selecteren',
		selectFile: 'Bestand Selecteren',
		selectedFile: 'Geselecteerd:',
		loadInPlayer: 'Laden in Speler',
		footerTitle: 'QTI 2.2 Speler',
		footerLicense: 'MIT Gelicentieerd • Open Source',

		// Settings Panel
		settings: 'Instellingen',
		candidateStudent: 'Kandidaat (Leerling)',
		testConstructor: 'Toetssamensteller',
		controlsRubricVisibility: 'Beheert zichtbaarheid van rubric en weergave van juiste antwoorden',
		useBackendScoring: 'Gebruik Serverbeoordeling',
		scoreOnServer: 'Beoordeel antwoorden op de server in plaats van client-side',
		sessionManagement: 'Sessiebeheer',
		saving: 'Opslaan...',
		saveSession: 'Sessie Opslaan',
		loadSession: 'Sessie Laden',

		// Export & Template
		exportResponses: 'Antwoorden Exporteren',
		json: 'JSON',
		csv: 'CSV',
		templateProcessing: 'Sjabloonverwerking',
		rerunTemplateProcessing: 'Voer templateProcessing opnieuw uit en reset de itemsessie',
		regenerateVariant: 'Variant Opnieuw Genereren',
		templateVariablesDebug: 'Sjabloonvariabelen (Debug)',
		variable: 'Variabele',
		value: 'Waarde',

		// Keyboard Shortcuts
		keyboardShortcuts: 'Sneltoetsen',
		submitAnswersShortcut: 'Antwoorden verzenden',
		tryAgainShortcut: 'Opnieuw proberen',
		exportJsonShortcut: 'JSON exporteren',
		saveSessionShortcut: 'Sessie opslaan',
		useCmdOnMacOS: 'Gebruik <kbd class="kbd kbd-xs">Cmd</kbd> op macOS',

		// Results Panel
		results: 'Resultaten',
		score: 'Score',
		outcomeVariables: 'Uitkomstvariabelen',

		// Misc
		format: 'Formaat',
		selectItemOrPasteXml: 'Selecteer een voorbeelditem of plak aangepaste XML om te beginnen.',
		pageTitle: 'Speler Demo - PIE QTI 2.2 Speler',

		// Sample Item Descriptions
		sampleItemDescriptions: {
			'simple-choice': 'Basis aftrekopgave met plausibele afleidingsantwoorden',
			'partial-credit': 'Meerkeuzevraag met gedeeltelijk krediet via mapResponse',
			'capital-cities': 'Aardrijkskundevraag met geschudde keuzes',
			'text-entry': 'Invulvraag met hoofdletterongevoelige matching',
			'extended-text': 'Meerregelige tekstantwoordvraag',
			'inline-choice': 'Dropdownmenu ingebed in tekst',
			'order-interaction': 'Items in de juiste volgorde plaatsen',
			'match-interaction': 'Items uit twee kolommen koppelen',
			'associate-interaction': 'Associaties tussen items maken',
			'gap-match': 'Woorden in gaten in de tekst slepen',
			'graphic-gap-match-solar-system': 'Label de vier binnenplaneten van ons zonnestelsel',
			'slider': 'Een waarde op een numerieke schuifregelaar selecteren',
			'hotspot': 'Klik op de Blauwe Planeet in deze astronomievraag',
			'hotspot-partial-credit': 'Identificeer planeet met vloeibaar water (gedeeltelijk krediet voor terrestrische planeten)',
			'template-variable-demo': 'templateProcessing genereert waarden; responseProcessing beoordeelt ze',
			'upload-interaction': 'Een bestand uploaden als antwoord (baseType=file)',
			'drawing-interaction': 'Tekenen op een canvas (baseType=file, PNG dataUrl)',
			'media-audio': 'Audiospeler met afspeeltellertracking en minPlays vereiste',
			'media-video': 'Videospeler met afspeeltellertracking en maxPlays limiet',
			'hottext-single': 'Klik om één enkel woord in tekst te selecteren (grammaticavraag)',
			'hottext-multiple': 'Klik om meerdere tekstsegmenten te selecteren (begrijpend lezen)',
			'select-point': 'Klik op de afbeelding om een puntlocatie te selecteren (aardrijkskundevraag)',
			'graphic-order': 'Slepen om items op een afbeelding te herschikken (geologische lagen)',
			'graphic-associate': 'Klik op paren hotspots om associaties te maken (orgaankoppeling)',
			'position-object': 'Meubelstukobjecten op een kamerindeling slepen en positioneren',
			'end-attempt': 'Knop om de beoordelingspoging te beëindigen',
			'custom-interaction': 'Toont een fallback-UI voor customInteraction en staat een handmatig antwoord toe',
			'choice-with-stimulus': 'Vraag met leespassage inline ingebed',
			'math-inline': 'Meerkeuzevraag met inline MathML wiskundeweergave',
			'math-extended': 'Uitgebreid antwoord met MathML en rich text editor voor het tonen van wiskundig werk',
			'math-fractions': 'Breukenrekenen met MathML blokweergave',
			'adaptive-capitals': 'Adaptieve vraag met meerdere pogingen en progressieve feedback en hints',
		},
	},
} as const; // 'as const' for strict type inference
