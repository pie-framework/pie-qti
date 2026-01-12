/**
 * French (France) translations
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
		loading: 'Chargement...',
		error: 'Erreur',
		success: 'Succès',
		cancel: 'Annuler',
		confirm: 'Confirmer',
		close: 'Fermer',
		save: 'Enregistrer',
		delete: 'Supprimer',
		edit: 'Modifier',
		remove: 'Retirer',
		add: 'Ajouter',
		search: 'Rechercher',
		filter: 'Filtrer',
		reset: 'Réinitialiser',
		clear: 'Effacer',
		clearAll: 'Tout effacer',
		submit: 'Soumettre',
		next: 'Suivant',
		previous: 'Précédent',
		back: 'Retour',
		continue: 'Continuer',
		finish: 'Terminer',
		complete: 'Compléter',
		completed: 'Terminé',
		status: 'Statut',
		required: 'Requis',
		review: 'Réviser',
		selected: 'Sélectionné',
		available: 'Disponible',
		showDetails: 'Afficher les détails',
		hideDetails: 'Masquer les détails',
		details: 'Détails',
		deselected: '{item} désélectionné',
		selectionCancelled: 'Sélection annulée',
		question: 'Question',
		of: 'sur',
		answered: 'répondue',
		pleaseComplete: 'Veuillez compléter les interactions requises',
		submitting: 'Envoi en cours...',
		submitAnswer: 'Soumettre la Réponse',
		tryAgain: 'Réessayer',
		errorNoData: "Aucune donnée d'interaction fournie",
	},

	units: {
		bytes: '{count} octets',
		kilobytes: '{count} Ko',
		megabytes: '{count} Mo',
		seconds: '{count} secondes',
		minutes: '{count} minutes',
		hours: '{count} heures',
	},

	// Exemples de pluralisation
	// Utilisez i18n.plural('plurals.items', { count: n }) pour y accéder
	plurals: {
		items: {
			one: '{count} élément',
			other: '{count} éléments',
		},
		files: {
			one: '{count} fichier sélectionné',
			other: '{count} fichiers sélectionnés',
		},
		questions: {
			one: '{count} question',
			other: '{count} questions',
		},
		answers: {
			one: '{count} réponse',
			other: '{count} réponses',
		},
		choices: {
			one: '{count} choix',
			other: '{count} choix',
		},
		attempts: {
			one: '{count} tentative restante',
			other: '{count} tentatives restantes',
		},
		minutesRemaining: {
			one: '{count} minute restante',
			other: '{count} minutes restantes',
		},
		secondsRemaining: {
			one: '{count} seconde restante',
			other: '{count} secondes restantes',
		},
		submitAnswer: {
			one: 'Soumettre la Réponse',
			other: 'Soumettre les Réponses',
		},
	},

	validation: {
		required: 'Ce champ est requis',
		invalidFormat: 'Format invalide',
		tooShort: 'Trop court (minimum {min} caractères)',
		tooLong: 'Trop long (maximum {max} caractères)',
		outOfRange: 'La valeur doit être entre {min} et {max}',
	},

	interactions: {
		choice: {
			selectOption: 'Sélectionnez une option',
			selectMultiple: 'Sélectionnez toutes les réponses applicables',
			selected: 'Sélectionné',
			notSelected: 'Non sélectionné',
		},

		upload: {
			label: 'Télécharger un fichier',
			selectFile: 'Choisir un fichier',
			dragDrop: 'ou glisser-déposer',
			allowedTypes: 'Types de fichiers autorisés :',
			selectedFile: 'Sélectionné :',
			fileSize: '{size} octets',
			fileSizeKb: '{size} Ko',
			fileSizeMb: '{size} Mo',
			removeFile: 'Supprimer le fichier',
			errorInvalidType: 'Type de fichier non autorisé. Autorisés : {types}',
			errorReadFailed: 'Échec de la lecture du fichier',
			errorTooLarge: 'Le fichier est trop volumineux (maximum {max} Mo)',
			unknownType: 'Type de fichier inconnu',
		},

		drawing: {
			label: 'Dessinez votre réponse',
			clear: 'Effacer le dessin',
			undo: 'Annuler',
			redo: 'Refaire',
			strokeColor: 'Couleur du trait',
			strokeWidth: 'Épaisseur du trait',
			tool: 'Outil',
			instructions: 'Dessinez avec votre souris ou tactile. Utilisez le bouton Effacer pour réinitialiser.',
			canvas: 'Canevas de dessin',
			updated: 'Dessin mis à jour.',
			cleared: 'Dessin effacé.',
			generated: 'Généré :',
		},

		extendedText: {
			placeholder: 'Tapez votre réponse ici...',
			characterCount: '{count} caractères',
			characterLimit: '{count} / {max} caractères',
			bold: 'Gras',
			italic: 'Italique',
			underline: 'Souligné',
			bulletList: 'Liste à puces',
			numberedList: 'Liste numérotée',
			insertMath: 'Insérer une équation mathématique',
			insertInlineMath: 'Insérer une formule en ligne',
			insertBlockMath: 'Insérer un bloc mathématique',
		},

		slider: {
			label: 'Curseur',
			selectedValue: 'Valeur sélectionnée : {value}',
			min: 'Minimum : {min}',
			max: 'Maximum : {max}',
			step: 'Pas : {step}',
			ariaLabel: 'Valeur du curseur de {lowerBound} à {upperBound}',
			statTitle: 'Valeur sélectionnée',
		},

		hottext: {
			selected: 'Sélectionné :',
			selectText: 'Sélectionnez du texte dans le passage',
			clearSelection: 'Effacer la sélection',
			ariaLabel: 'Interaction de sélection de texte',
		},

		hotspot: {
			selected: 'Sélectionné :',
			selectArea: 'Sélectionnez des zones sur l\'image',
			ariaLabel: 'Interaction de zone sensible',
			altText: 'Interaction de zone sensible',
		},

		selectPoint: {
			instruction: 'Cliquez sur l\'image pour sélectionner des points',
			instructionAria: 'Cliquez pour sélectionner des points sur l\'image',
			maxPointsReached: 'Nombre maximum de points atteint. Supprimez un point pour en ajouter un nouveau.',
			point: 'Point {index}',
			removePoint: 'Supprimer le point {index}',
			removePointTitle: 'Cliquez pour supprimer ce point',
			removePointAt: 'Supprimer le point {index} aux coordonnées {x}, {y}',
			removePointAtTitle: 'Cliquez pour supprimer ce point ({x}, {y})',
			canvas: 'Canevas de sélection',
			noImage: 'Aucune image fournie',
			pointsSelected: 'Points sélectionnés :',
			minimumMet: '✓ Minimum atteint',
			selectAtLeast: 'Sélectionnez au moins {minChoices}',
		},

		match: {
			keyboardInstructions: 'Appuyez sur Espace ou Entrée pour sélectionner un élément source. Tab pour naviguer vers les cibles. Appuyez sur Espace ou Entrée sur une cible pour créer une correspondance. Appuyez sur Échap pour annuler la sélection.',
			dragInstruction: 'Appuyez sur Espace ou Entrée pour associer',
			dropTarget: 'Déposez l\'élément ici',
			matchedWith: 'Associé avec {target}',
			selectedForMatching: 'Sélectionné pour l\'association',
			available: 'Disponible',
			availableForMatching: 'Disponible pour l\'association',
			removeMatch: 'Supprimer l\'association',
			clearMatch: 'Effacer l\'association pour {source}',
			sourceItemsLabel: 'Éléments sources à associer',
			targetItemsLabel: 'Éléments cibles pour l\'association',
		},

		gapMatch: {
			instruction: 'Faites glisser les mots pour remplir les blancs',
			available: 'Mots disponibles',
			availableLabel: 'Mots disponibles à placer',
			availableHeading: 'Mots disponibles :',
			removeWord: 'Supprimer le mot',
			removeFromBlanks: 'Supprimer {word} des blancs',
			gapAriaLabel: 'Espace {gapId}',
			blankGapAriaLabel: 'Blanc {gapId}. Déposez une réponse ici.',
			filledGapAriaLabel: 'Blank {gapId}, filled with {word}. Click to clear.',
		},

		graphicGapMatch: {
			instruction: 'Placez les étiquettes sur les zones sensibles de l\'image',
			keyboardInstructions: 'Appuyez sur Espace ou Entrée pour sélectionner une étiquette. Tab pour naviguer vers les zones sensibles sur l\'image. Appuyez sur Espace ou Entrée sur une zone sensible pour placer l\'étiquette. Appuyez sur Échap pour annuler la sélection.',
			available: 'Étiquettes disponibles',
			availableLabel: 'Étiquettes disponibles à placer',
			availableHeading: 'Étiquettes disponibles :',
			alreadyPlaced: 'Déjà placé sur une zone sensible',
			selectedForPlacement: 'Sélectionné pour placement',
			pressSpaceToSelect: 'Appuyez sur Espace pour sélectionner',
			pressSpaceToPlace: 'Appuyez sur Espace ou Entrée pour placer l\'étiquette',
			removeLabel: 'Supprimer l\'étiquette',
			removeFromHotspot: 'Supprimer {label} de la zone sensible',
			hotspot: 'Zone sensible {number}',
			contains: 'Contient : {label}',
		},

		order: {
			instruction: 'Faites glisser les éléments pour les réordonner',
			keyboardInstructions: 'Appuyez sur Espace ou Entrée pour saisir un élément. Utilisez les touches fléchées pour déplacer l\'élément. Appuyez à nouveau sur Espace ou Entrée pour déposer. Appuyez sur Échap pour annuler.',
			grabbed: 'Saisi. Utilisez les touches fléchées pour déplacer.',
			moveUp: 'Déplacer vers le haut',
			moveDown: 'Déplacer vers le bas',
			position: 'Position {current} sur {total}',
			listLabel: 'Liste réordonnable de choix',
			confirmOrder: 'Confirmer l\'ordre',
			confirmOrderNoChanges: 'Confirmer l\'ordre (Aucun changement)',
			confirmAria: 'Confirmer cet ordre comme votre réponse',
		},

		associate: {
			instruction: 'Créez des associations entre les éléments',
			createPair: 'Créer une paire',
			removePair: 'Supprimer la paire',
			removeAssociation: 'Supprimer l\'association',
			diagramLabel: 'Diagramme d\'association',
			altText: 'Diagramme d\'association',
			hotspotConnections: '{label} ({usageCount}/{matchMax} connexions)',
			selectAnother: 'Sélectionné : <strong>{label}</strong>. Cliquez sur un autre',
			minimumRequired: 'Minimum requis : {minAssociations}',
		},

		positionObject: {
			instruction: 'Faites glisser les objets sur l\'image',
			placeObject: 'Placer {object} sur l\'image',
			removeObject: 'Supprimer {object}',
			objectAt: '{object} à la position ({x}, {y})',
			canvasLabel: 'Canevas de positionnement',
			backgroundAlt: 'Arrière-plan de positionnement',
			positioned: '{label} positionné à ({x}, {y})',
			minimumRequired: 'Minimum requis : {minChoices}',
			maximumAllowed: 'Maximum : {maxChoices}',
			availableObjects: 'Objets disponibles',
			objectUsage: '{label} ({usageCount}/{matchMax} utilisé)',
		},

		endAttempt: {
			buttonLabel: 'Terminer la tentative',
			ended: 'Tentative terminée',
			requested: 'Demandé',
			warningMessage: 'Votre tentative a été terminée et ne peut plus être modifiée.',
			confirmMessage: 'Êtes-vous sûr de vouloir terminer votre tentative ? Vous ne pourrez plus modifier vos réponses.',
		},

		media: {
			play: 'Lire',
			pause: 'Pause',
			volume: 'Volume',
			mute: 'Muet',
			unmute: 'Activer le son',
			fullscreen: 'Plein écran',
			exitFullscreen: 'Quitter le plein écran',
			playbackSpeed: 'Vitesse de lecture',
			currentTime: '{current} / {duration}',
			loading: 'Chargement du média...',
			ariaLabel: 'Contenu multimédia',
			maxPlayLimitReached: 'Limite maximale de lecture atteinte',
		},

		graphicOrder: {
			instruction: 'Cliquez sur les zones sensibles pour les ordonner',
			diagramLabel: 'Diagramme d\'ordre',
			altText: 'Diagramme d\'ordre',
			itemLabel: 'Élément {index} : {label}',
			confirmOrder: 'Confirmer l\'ordre',
			confirmOrderNoChanges: 'Confirmer l\'ordre (Aucun changement)',
			confirmAria: 'Confirmer cet ordre comme votre réponse',
		},

		custom: {
			fallbackPlaceholder: 'Entrez une réponse manuelle (solution de secours)',
		},

		inline: {
			placeholder: '...',
			selectPlaceholder: 'Sélectionner...',
		},
	},

	item: {
		loading: 'Chargement de l\'élément...',
		loadingError: 'Échec du chargement de l\'élément',
		loadError: 'Erreur de chargement de l\'élément : {error}',
		parsingError: 'Échec de l\'analyse QTI XML',
		processingError: 'Échec du traitement des réponses',
		submit: 'Soumettre',
		complete: 'Terminer',
		completed: 'Terminé',
		attempt: 'Tentative {numAttempts}',
	},

	itemSession: {
		attempt: 'Tentative {numAttempts}',
		attemptsRemaining: '{attemptsRemaining} tentatives restantes',
		maxAttempts: 'Tentatives maximales : {maxAttempts}',
	},

	feedback: {
		close: 'Fermer les commentaires',
		closeFeedback: 'Ignorer les commentaires',
		testFeedback: 'Commentaires du test',
	},

	assessment: {
		title: 'Évaluation',
		loading: 'Chargement de l\'évaluation...',
		loadingError: 'Délai d\'attente dépassé pour le chargement de l\'évaluation. Cette évaluation peut être invalide ou le lecteur n\'a pas pu s\'initialiser.',
		question: 'Question {current} sur {total}',
		questionAnnouncement: 'Question {current} sur {total}',
		section: 'Section {current} sur {total}',
		sectionDefault: 'Section {number}',
		readingPassage: 'Passage de Lecture',
		expandPassage: 'Développer le passage',
		collapsePassage: 'Réduire le passage',
		closeMenu: 'Fermer le menu',

		attempts: {
			remaining: '{count} tentatives restantes',
			oneRemaining: '1 tentative restante',
			noRemaining: 'Aucune tentative restante ({count} utilisées)',
			used: 'Tentatives : {count}',
			maxReached: 'Nombre maximum de tentatives atteint',
			required: 'Doit répondre avant de continuer',
			reviewNotAllowed: 'Non autorisé une fois soumis',
		},

		navigation: {
			previous: 'Précédent',
			next: 'Suivant',
			submit: 'Soumettre',
			jumpTo: 'Aller à la question {number}',
			sectionMenu: 'Menu de section',
			progress: 'Progression : {percent}%',
		},

		sections: {
			title: 'Sections',
			selectSection: 'Sélectionner une section',
		},

		timer: {
			timeRemaining: 'Temps restant : {time}',
			timeElapsed: 'Temps écoulé : {time}',
			timeUp: 'Temps écoulé !',
		},

		feedback: {
			correct: 'Correct',
			incorrect: 'Incorrect',
			partiallyCorrect: 'Partiellement correct',
			unanswered: 'Sans réponse',
			score: 'Score : {score} / {maxScore}',
			passed: 'Réussi',
			failed: 'Échoué',
		},

		completion: {
			title: 'Évaluation terminée',
			message: 'Vous avez terminé l\'évaluation.',
			score: 'Votre score : {score} sur {maxScore}',
			percentage: 'Pourcentage : {percent}%',
			viewResults: 'Voir les résultats',
			exit: 'Quitter',
		},

		errors: {
			navigationFailed: 'Échec de la navigation. Veuillez réessayer.',
			submitFailed: 'Échec de la soumission de l\'évaluation. Veuillez réessayer.',
			loadFailed: 'Échec du chargement de la question.',
			saveFailed: 'Échec de l\'enregistrement de la réponse.',
		},
	},

	i18n: {
		selectLanguage: 'Langue',
		selectLanguageAriaLabel: 'Sélectionner la langue d\'affichage',
	},

	accessibility: {
		skipToContent: 'Passer au contenu',
		skipToNavigation: 'Passer à la navigation',
		itemBody: 'Contenu de la question',
		navigationRegion: 'Navigation de l\'évaluation',
		announcement: 'Annonce',
		newQuestion: 'Nouvelle question chargée',
		answerRecorded: 'Réponse enregistrée',
		resizer: 'Redimensionner les panneaux de passage et de question',
	},

	demo: {
		selectSampleItem: 'Sélectionner un élément d\'exemple',
		configurationPanel: 'Panneau de configuration',
		viewingAs: 'Affichage en tant que',
		role: 'Rôle',
		candidate: 'Candidat',
		author: 'Auteur',
		proctor: 'Surveillant',
		scorer: 'Correcteur',
		tutor: 'Tuteur',
		showCorrectAnswers: 'Afficher les réponses correctes',
		showFeedback: 'Afficher les commentaires',
		xmlEditor: 'Éditeur XML',

		// Navigation
		appName: 'Lecteur PIE QTI 2.2',
		home: 'Accueil',
		itemDemo: 'Démo d\'Élément',
		assessmentDemo: 'Démo d\'Évaluation',
		likertDemo: 'Démo du Plugin Likert',
		iframeDemo: 'Démo Iframe',
		theme: 'Thème',

		// Home Page
		homeTitle: 'Lecteur QTI 2.2',
		homeSubtitle: 'Un lecteur moderne et indépendant des frameworks pour les éléments d\'évaluation QTI 2.2. Fonctionne 100% côté client par défaut, avec des hooks côté serveur optionnels pour une utilisation en production.',
		homeMetaDescription: 'Lecteur QTI 2.2 moderne avec intégration backend optionnelle',
		tryItems: 'Essayer les Éléments',
		tryAssessments: 'Essayer les Évaluations',
		pluginDemo: 'Démo du Plugin',
		dropQtiFile: 'Déposez le fichier QTI XML ici',
		orClickToSelect: 'ou cliquez pour sélectionner un fichier',
		selectFile: 'Sélectionner un Fichier',
		selectedFile: 'Sélectionné :',
		loadInPlayer: 'Charger dans le Lecteur',
		footerTitle: 'Lecteur QTI 2.2',
		footerLicense: 'Licence MIT • Open Source',

		// Settings Panel
		settings: 'Paramètres',
		candidateStudent: 'Candidat (Étudiant)',
		testConstructor: 'Constructeur de Tests',
		controlsRubricVisibility: 'Contrôle la visibilité de la rubrique et l\'affichage des réponses correctes',
		useBackendScoring: 'Utiliser la Notation Serveur',
		scoreOnServer: 'Évaluer les réponses sur le serveur plutôt que côté client',
		sessionManagement: 'Gestion de Session',
		saving: 'Enregistrement...',
		saveSession: 'Enregistrer la Session',
		loadSession: 'Charger la Session',

		// Export & Template
		exportResponses: 'Exporter les Réponses',
		json: 'JSON',
		csv: 'CSV',
		templateProcessing: 'Traitement du Modèle',
		rerunTemplateProcessing: 'Réexécuter templateProcessing et réinitialiser la session de l\'élément',
		regenerateVariant: 'Régénérer la Variante',
		templateVariablesDebug: 'Variables de Modèle (Débogage)',
		variable: 'Variable',
		value: 'Valeur',

		// Keyboard Shortcuts
		keyboardShortcuts: 'Raccourcis Clavier',
		submitAnswersShortcut: 'Soumettre les réponses',
		tryAgainShortcut: 'Réessayer',
		exportJsonShortcut: 'Exporter JSON',
		saveSessionShortcut: 'Enregistrer la session',
		useCmdOnMacOS: 'Utiliser <kbd class="kbd kbd-xs">Cmd</kbd> sur macOS',

		// Results Panel
		results: 'Résultats',
		score: 'Score',
		outcomeVariables: 'Variables de Résultat',

		// Misc
		format: 'Format',
		selectItemOrPasteXml: 'Sélectionnez un élément d\'exemple ou collez du XML personnalisé pour commencer.',
		pageTitle: 'Démo du Lecteur - Lecteur PIE QTI 2.2',

		// Sample Item Descriptions
		sampleItemDescriptions: {
			'simple-choice': 'Problème de soustraction de base avec des distracteurs plausibles',
			'partial-credit': 'Choix multiple avec crédit partiel utilisant mapResponse',
			'capital-cities': 'Question de géographie avec choix mélangés',
			'text-entry': 'Question à trous avec correspondance insensible à la casse',
			'extended-text': 'Question à réponse textuelle multiligne',
			'inline-choice': 'Menu déroulant intégré dans le texte',
			'order-interaction': 'Organiser les éléments dans la séquence correcte',
			'match-interaction': 'Associer les éléments de deux colonnes',
			'associate-interaction': 'Créer des associations entre les éléments',
			'gap-match': 'Faire glisser des mots dans les espaces du texte',
			'graphic-gap-match-solar-system': 'Étiqueter les quatre planètes intérieures de notre système solaire',
			'slider': 'Sélectionner une valeur sur un curseur numérique',
			'hotspot': 'Cliquer sur la Planète Bleue dans cette question d\'astronomie',
			'hotspot-partial-credit': 'Identifier la planète avec de l\'eau liquide (crédit partiel pour les planètes telluriques)',
			'template-variable-demo': 'templateProcessing génère des valeurs ; responseProcessing les évalue',
			'upload-interaction': 'Télécharger un fichier comme réponse (baseType=file)',
			'drawing-interaction': 'Dessiner sur un canevas (baseType=file, dataUrl PNG)',
			'media-audio': 'Lecteur audio avec suivi du nombre de lectures et exigence minPlays',
			'media-video': 'Lecteur vidéo avec suivi du nombre de lectures et limite maxPlays',
			'hottext-single': 'Cliquer pour sélectionner un seul mot dans le texte (question de grammaire)',
			'hottext-multiple': 'Cliquer pour sélectionner plusieurs segments de texte (compréhension de lecture)',
			'select-point': 'Cliquer sur l\'image pour sélectionner un point (question de géographie)',
			'graphic-order': 'Faire glisser pour réorganiser les éléments sur une image (couches géologiques)',
			'graphic-associate': 'Cliquer sur des paires de zones actives pour créer des associations (correspondance d\'organes)',
			'position-object': 'Faire glisser et positionner des objets de mobilier sur un plan de pièce',
			'end-attempt': 'Bouton pour terminer la tentative d\'évaluation',
			'custom-interaction': 'Affiche une interface de secours pour customInteraction et permet une réponse manuelle',
			'choice-with-stimulus': 'Question avec passage de lecture intégré en ligne',
			'math-inline': 'Choix multiple avec rendu mathématique MathML en ligne',
			'math-extended': 'Réponse étendue avec MathML et éditeur de texte enrichi pour montrer le travail mathématique',
			'math-fractions': 'Arithmétique de fractions avec affichage de blocs MathML',
			'adaptive-capitals': 'Question adaptative à plusieurs tentatives avec rétroaction et indices progressifs',
		},
	},
} as const; // 'as const' for strict type inference
