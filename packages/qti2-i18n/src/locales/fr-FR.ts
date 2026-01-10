/**
 * French (France) translations
 *
 * Guidelines for translators:
 * - Keep messages concise for UI constraints
 * - Use sentence case for labels, title case for buttons
 * - Maintain consistent terminology across interactions
 * - Variables in {curlyBraces} will be replaced with dynamic values
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
		submit: 'Soumettre',
		next: 'Suivant',
		previous: 'Précédent',
		back: 'Retour',
		continue: 'Continuer',
		finish: 'Terminer',
	},

	units: {
		bytes: '{count} octets',
		kilobytes: '{count} Ko',
		megabytes: '{count} Mo',
		seconds: '{count} secondes',
		minutes: '{count} minutes',
		hours: '{count} heures',
	},

	validation: {
		required: 'Ce champ est obligatoire',
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
			// Shown as label above file input
			label: 'Télécharger un fichier',
			selectFile: 'Choisir un fichier',
			dragDrop: 'ou glisser-déposer',

			// Displayed before list of allowed file types
			allowedTypes: 'Types de fichiers autorisés :',

			// Displayed when file is selected
			selectedFile: 'Sélectionné :',

			// File size display - {size} will be replaced with numeric value
			fileSize: '{size} octets',
			fileSizeKb: '{size} Ko',
			fileSizeMb: '{size} Mo',

			removeFile: 'Retirer le fichier',

			// Error shown when file type validation fails
			// {types} will be replaced with comma-separated list of allowed types
			errorInvalidType: 'Type de fichier non autorisé. Autorisés : {types}',
			errorReadFailed: 'Échec de la lecture du fichier',

			// {max} will be replaced with maximum size in MB
			errorTooLarge: 'Le fichier est trop volumineux (maximum {max} Mo)',
			unknownType: 'Type de fichier inconnu',
		},

		drawing: {
			label: 'Dessinez votre réponse',
			clear: 'Effacer le dessin',
			undo: 'Annuler',
			redo: 'Rétablir',
			strokeColor: 'Couleur du trait',
			strokeWidth: 'Épaisseur du trait',
			tool: 'Outil',
		},

		extendedText: {
			placeholder: 'Saisissez votre réponse ici...',
			characterCount: '{count} caractères',
			characterLimit: '{count} / {max} caractères',
			bold: 'Gras',
			italic: 'Italique',
			underline: 'Souligné',
			bulletList: 'Liste à puces',
			numberedList: 'Liste numérotée',
			insertMath: 'Insérer une équation mathématique',
		},

		slider: {
			label: 'Curseur',
			selectedValue: 'Valeur sélectionnée : {value}',
			min: 'Minimum : {min}',
			max: 'Maximum : {max}',
			step: 'Pas : {step}',
		},

		hottext: {
			selected: 'Sélectionné :',
			selectText: 'Sélectionnez le texte dans le passage',
		},

		hotspot: {
			selected: 'Sélectionné :',
			selectArea: 'Sélectionnez des zones sur l\'image',
		},

		selectPoint: {
			instruction: 'Cliquez sur l\'image pour sélectionner des points',
			maxPointsReached: 'Nombre maximum de points atteint. Retirez un point pour en ajouter un nouveau.',
			point: 'Point {index}',
			removePoint: 'Retirer le point {index}',
		},

		match: {
			// Keyboard instruction for accessible drag-drop
			dragInstruction: 'Appuyez sur Espace ou Entrée pour associer',
			dropTarget: 'Déposer l\'élément ici',
			matchedWith: 'Associé avec {target}',
			available: 'Disponible',
			removeMatch: 'Retirer l\'association',
		},

		gapMatch: {
			instruction: 'Glissez les mots pour remplir les blancs',
			available: 'Mots disponibles',
			removeWord: 'Retirer le mot',
			// {word} will be replaced with the word being removed
			removeFromBlanks: 'Retirer {word} des blancs',
		},

		graphicGapMatch: {
			instruction: 'Placez les étiquettes sur les zones sensibles de l\'image',
			available: 'Étiquettes disponibles',
			alreadyPlaced: 'Déjà placé sur une zone sensible',
			selectedForPlacement: 'Sélectionné pour le placement',
			pressSpaceToSelect: 'Appuyez sur Espace pour sélectionner',
			pressSpaceToPlace: 'Appuyez sur Espace ou Entrée pour placer l\'étiquette',
			removeLabel: 'Retirer l\'étiquette',
			removeFromHotspot: 'Retirer {label} de la zone sensible',
			hotspot: 'Zone sensible {number}',
			contains: 'Contient : {label}',
		},

		order: {
			instruction: 'Glissez les éléments pour les réorganiser',
			moveUp: 'Monter',
			moveDown: 'Descendre',
			position: 'Position {current} sur {total}',
		},

		associate: {
			instruction: 'Créez des associations entre les éléments',
			createPair: 'Créer une paire',
			removePair: 'Retirer la paire',
		},

		positionObject: {
			instruction: 'Glissez les objets sur l\'image',
			placeObject: 'Placer {object} sur l\'image',
			removeObject: 'Retirer {object}',
			objectAt: '{object} à la position ({x}, {y})',
		},

		endAttempt: {
			buttonLabel: 'Terminer la Tentative',
			ended: 'Tentative Terminée',
			requested: 'Demandé',
			warningMessage: 'Votre tentative a été terminée et ne peut plus être modifiée.',
			confirmMessage: 'Êtes-vous sûr de vouloir terminer votre tentative ? Vous ne pourrez pas modifier vos réponses.',
		},

		media: {
			play: 'Lecture',
			pause: 'Pause',
			volume: 'Volume',
			mute: 'Muet',
			unmute: 'Réactiver le son',
			fullscreen: 'Plein écran',
			exitFullscreen: 'Quitter le plein écran',
			playbackSpeed: 'Vitesse de lecture',
			currentTime: '{current} / {duration}',
			loading: 'Chargement du média...',
		},
	},

	assessment: {
		title: 'Évaluation',
		loading: 'Chargement de l\'évaluation...',
		loadingError: 'Délai d\'attente dépassé lors du chargement de l\'évaluation. Cette évaluation peut être invalide ou le lecteur n\'a pas pu s\'initialiser.',
		question: 'Question {current} sur {total}',
		section: 'Section {current} sur {total}',

		navigation: {
			previous: 'Précédent',
			next: 'Suivant',
			submit: 'Soumettre',
			jumpTo: 'Aller à la question {number}',
			sectionMenu: 'Menu des sections',
			progress: 'Progression : {percent} %',
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
			title: 'Évaluation Terminée',
			message: 'Vous avez terminé l\'évaluation.',
			score: 'Votre score : {score} sur {maxScore}',
			percentage: 'Pourcentage : {percent} %',
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

	accessibility: {
		skipToContent: 'Passer au contenu',
		skipToNavigation: 'Passer à la navigation',
		itemBody: 'Contenu de la question',
		navigationRegion: 'Navigation de l\'évaluation',
		announcement: 'Annonce',
		newQuestion: 'Nouvelle question chargée',
		answerRecorded: 'Réponse enregistrée',
	},
} as const; // 'as const' for strict type inference
