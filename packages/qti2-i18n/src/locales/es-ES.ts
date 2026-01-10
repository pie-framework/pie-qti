/**
 * Spanish (Spain) translations
 *
 * Guidelines for translators:
 * - Keep messages concise for UI constraints
 * - Use sentence case for labels, title case for buttons
 * - Maintain consistent terminology across interactions
 * - Variables in {curlyBraces} will be replaced with dynamic values
 */
export default {
	common: {
		loading: 'Cargando...',
		error: 'Error',
		success: 'Éxito',
		cancel: 'Cancelar',
		confirm: 'Confirmar',
		close: 'Cerrar',
		save: 'Guardar',
		delete: 'Eliminar',
		edit: 'Editar',
		remove: 'Quitar',
		add: 'Añadir',
		search: 'Buscar',
		filter: 'Filtrar',
		reset: 'Restablecer',
		submit: 'Enviar',
		next: 'Siguiente',
		previous: 'Anterior',
		back: 'Atrás',
		continue: 'Continuar',
		finish: 'Finalizar',
	},

	units: {
		bytes: '{count} bytes',
		kilobytes: '{count} KB',
		megabytes: '{count} MB',
		seconds: '{count} segundos',
		minutes: '{count} minutos',
		hours: '{count} horas',
	},

	validation: {
		required: 'Este campo es obligatorio',
		invalidFormat: 'Formato no válido',
		tooShort: 'Demasiado corto (mínimo {min} caracteres)',
		tooLong: 'Demasiado largo (máximo {max} caracteres)',
		outOfRange: 'El valor debe estar entre {min} y {max}',
	},

	interactions: {
		choice: {
			selectOption: 'Selecciona una opción',
			selectMultiple: 'Selecciona todas las que correspondan',
			selected: 'Seleccionado',
			notSelected: 'No seleccionado',
		},

		upload: {
			// Shown as label above file input
			label: 'Subir un archivo',
			selectFile: 'Elegir archivo',
			dragDrop: 'o arrastra y suelta',

			// Displayed before list of allowed file types
			allowedTypes: 'Tipos de archivo permitidos:',

			// Displayed when file is selected
			selectedFile: 'Seleccionado:',

			// File size display - {size} will be replaced with numeric value
			fileSize: '{size} bytes',
			fileSizeKb: '{size} KB',
			fileSizeMb: '{size} MB',

			removeFile: 'Quitar archivo',

			// Error shown when file type validation fails
			// {types} will be replaced with comma-separated list of allowed types
			errorInvalidType: 'Tipo de archivo no permitido. Permitidos: {types}',
			errorReadFailed: 'Error al leer el archivo',

			// {max} will be replaced with maximum size in MB
			errorTooLarge: 'El archivo es demasiado grande (máximo {max} MB)',
			unknownType: 'Tipo de archivo desconocido',
		},

		drawing: {
			label: 'Dibuja tu respuesta',
			clear: 'Borrar dibujo',
			undo: 'Deshacer',
			redo: 'Rehacer',
			strokeColor: 'Color del trazo',
			strokeWidth: 'Grosor del trazo',
			tool: 'Herramienta',
		},

		extendedText: {
			placeholder: 'Escribe tu respuesta aquí...',
			characterCount: '{count} caracteres',
			characterLimit: '{count} / {max} caracteres',
			bold: 'Negrita',
			italic: 'Cursiva',
			underline: 'Subrayado',
			bulletList: 'Lista con viñetas',
			numberedList: 'Lista numerada',
			insertMath: 'Insertar ecuación matemática',
		},

		slider: {
			label: 'Control deslizante',
			selectedValue: 'Valor seleccionado: {value}',
			min: 'Mínimo: {min}',
			max: 'Máximo: {max}',
			step: 'Paso: {step}',
		},

		hottext: {
			selected: 'Seleccionado:',
			selectText: 'Selecciona el texto del pasaje',
		},

		hotspot: {
			selected: 'Seleccionado:',
			selectArea: 'Selecciona áreas en la imagen',
		},

		selectPoint: {
			instruction: 'Haz clic en la imagen para seleccionar puntos',
			maxPointsReached: 'Máximo de puntos alcanzado. Quita un punto para añadir uno nuevo.',
			point: 'Punto {index}',
			removePoint: 'Quitar punto {index}',
		},

		match: {
			// Keyboard instruction for accessible drag-drop
			dragInstruction: 'Pulsa Espacio o Intro para emparejar',
			dropTarget: 'Soltar elemento aquí',
			matchedWith: 'Emparejado con {target}',
			available: 'Disponible',
			removeMatch: 'Quitar emparejamiento',
		},

		gapMatch: {
			instruction: 'Arrastra palabras para completar los espacios en blanco',
			available: 'Palabras disponibles',
			removeWord: 'Quitar palabra',
			// {word} will be replaced with the word being removed
			removeFromBlanks: 'Quitar {word} de los espacios en blanco',
		},

		graphicGapMatch: {
			instruction: 'Coloca etiquetas en los puntos sensibles de la imagen',
			available: 'Etiquetas disponibles',
			alreadyPlaced: 'Ya colocado en punto sensible',
			selectedForPlacement: 'Seleccionado para colocar',
			pressSpaceToSelect: 'Pulsa Espacio para seleccionar',
			pressSpaceToPlace: 'Pulsa Espacio o Intro para colocar etiqueta',
			removeLabel: 'Quitar etiqueta',
			removeFromHotspot: 'Quitar {label} del punto sensible',
			hotspot: 'Punto sensible {number}',
			contains: 'Contiene: {label}',
		},

		order: {
			instruction: 'Arrastra elementos para reordenarlos',
			moveUp: 'Subir',
			moveDown: 'Bajar',
			position: 'Posición {current} de {total}',
		},

		associate: {
			instruction: 'Crea asociaciones entre elementos',
			createPair: 'Crear par',
			removePair: 'Quitar par',
		},

		positionObject: {
			instruction: 'Arrastra objetos sobre la imagen',
			placeObject: 'Colocar {object} en la imagen',
			removeObject: 'Quitar {object}',
			objectAt: '{object} en posición ({x}, {y})',
		},

		endAttempt: {
			buttonLabel: 'Finalizar Intento',
			ended: 'Intento Finalizado',
			requested: 'Solicitado',
			warningMessage: 'Tu intento ha finalizado y ya no puede modificarse.',
			confirmMessage: '¿Estás seguro de que quieres finalizar tu intento? No podrás cambiar tus respuestas.',
		},

		media: {
			play: 'Reproducir',
			pause: 'Pausar',
			volume: 'Volumen',
			mute: 'Silenciar',
			unmute: 'Activar sonido',
			fullscreen: 'Pantalla completa',
			exitFullscreen: 'Salir de pantalla completa',
			playbackSpeed: 'Velocidad de reproducción',
			currentTime: '{current} / {duration}',
			loading: 'Cargando medios...',
		},
	},

	assessment: {
		title: 'Evaluación',
		loading: 'Cargando evaluación...',
		loadingError: 'Tiempo de espera agotado al cargar la evaluación. Esta evaluación puede ser inválida o el reproductor no se pudo inicializar.',
		question: 'Pregunta {current} de {total}',
		section: 'Sección {current} de {total}',

		navigation: {
			previous: 'Anterior',
			next: 'Siguiente',
			submit: 'Enviar',
			jumpTo: 'Ir a la pregunta {number}',
			sectionMenu: 'Menú de secciones',
			progress: 'Progreso: {percent}%',
		},

		sections: {
			title: 'Secciones',
			selectSection: 'Seleccionar sección',
		},

		timer: {
			timeRemaining: 'Tiempo restante: {time}',
			timeElapsed: 'Tiempo transcurrido: {time}',
			timeUp: '¡Se acabó el tiempo!',
		},

		feedback: {
			correct: 'Correcto',
			incorrect: 'Incorrecto',
			partiallyCorrect: 'Parcialmente correcto',
			unanswered: 'Sin respuesta',
			score: 'Puntuación: {score} / {maxScore}',
			passed: 'Aprobado',
			failed: 'Suspenso',
		},

		completion: {
			title: 'Evaluación Completada',
			message: 'Has completado la evaluación.',
			score: 'Tu puntuación: {score} de {maxScore}',
			percentage: 'Porcentaje: {percent}%',
			viewResults: 'Ver resultados',
			exit: 'Salir',
		},

		errors: {
			navigationFailed: 'Error de navegación. Por favor, inténtalo de nuevo.',
			submitFailed: 'Error al enviar la evaluación. Por favor, inténtalo de nuevo.',
			loadFailed: 'Error al cargar la pregunta.',
			saveFailed: 'Error al guardar la respuesta.',
		},
	},

	accessibility: {
		skipToContent: 'Saltar al contenido',
		skipToNavigation: 'Saltar a la navegación',
		itemBody: 'Contenido de la pregunta',
		navigationRegion: 'Navegación de la evaluación',
		announcement: 'Anuncio',
		newQuestion: 'Nueva pregunta cargada',
		answerRecorded: 'Respuesta registrada',
	},
} as const; // 'as const' for strict type inference
