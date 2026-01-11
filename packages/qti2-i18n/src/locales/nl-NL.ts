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
} as const; // 'as const' for strict type inference
