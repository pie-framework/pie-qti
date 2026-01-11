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
} as const; // 'as const' for strict type inference
