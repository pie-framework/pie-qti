/**
 * Spanish (Spain) translations
 *
 * Guidelines for translators:
 * - Keep messages concise for UI constraints
 * - Use sentence case for labels, title case for buttons
 * - Maintain consistent terminology across interactions
 * - Variables in {curlyBraces} will be replaced with dynamic values
 *
 * NOTE: Many strings below are currently in English as placeholders.
 * They should be translated by a native Spanish speaker.
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
		clear: 'Limpiar',
		clearAll: 'Limpiar todo',
		submit: 'Enviar',
		next: 'Siguiente',
		previous: 'Anterior',
		back: 'Atrás',
		continue: 'Continuar',
		finish: 'Finalizar',
		complete: 'Completar',
		completed: 'Completado',
		status: 'Estado',
		required: 'Requerido',
		review: 'Revisar',
		selected: 'Seleccionado',
		available: 'Disponible',
		showDetails: 'Mostrar detalles',
		hideDetails: 'Ocultar detalles',
		details: 'Detalles',
		deselected: '{item} deseleccionado',
		selectionCancelled: 'Selección cancelada',
		question: 'Pregunta',
		of: 'de',
		answered: 'respondida',
		pleaseComplete: 'Por favor complete las interacciones requeridas',
		submitting: 'Enviando...',
		submitAnswer: 'Enviar Respuesta',
		tryAgain: 'Intentar de Nuevo',
	},

	units: {
		bytes: '{count} bytes',
		kilobytes: '{count} KB',
		megabytes: '{count} MB',
		seconds: '{count} segundos',
		minutes: '{count} minutos',
		hours: '{count} horas',
	},

	// Ejemplos de pluralización
	// Use i18n.plural('plurals.items', { count: n }) para acceder a estos
	plurals: {
		items: {
			one: '{count} elemento',
			other: '{count} elementos',
		},
		files: {
			one: '{count} archivo seleccionado',
			other: '{count} archivos seleccionados',
		},
		questions: {
			one: '{count} pregunta',
			other: '{count} preguntas',
		},
		answers: {
			one: '{count} respuesta',
			other: '{count} respuestas',
		},
		choices: {
			one: '{count} opción',
			other: '{count} opciones',
		},
		attempts: {
			one: '{count} intento restante',
			other: '{count} intentos restantes',
		},
		minutesRemaining: {
			one: '{count} minuto restante',
			other: '{count} minutos restantes',
		},
		secondsRemaining: {
			one: '{count} segundo restante',
			other: '{count} segundos restantes',
		},
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
			selectMultiple: 'Selecciona todas las que apliquen',
			selected: 'Seleccionado',
			notSelected: 'No seleccionado',
		},

		upload: {
			label: 'Subir un archivo',
			selectFile: 'Elegir archivo',
			dragDrop: 'o arrastra y suelta',
			allowedTypes: 'Tipos de archivo permitidos:',
			selectedFile: 'Seleccionado:',
			fileSize: '{size} bytes',
			fileSizeKb: '{size} KB',
			fileSizeMb: '{size} MB',
			removeFile: 'Eliminar archivo',
			errorInvalidType: 'Tipo de archivo no permitido. Permitidos: {types}',
			errorReadFailed: 'Error al leer el archivo',
			errorTooLarge: 'El archivo es demasiado grande (máximo {max} MB)',
			unknownType: 'Tipo de archivo desconocido',
		},

		drawing: {
			label: 'Dibuja tu respuesta',
			clear: 'Limpiar dibujo',
			undo: 'Deshacer',
			redo: 'Rehacer',
			strokeColor: 'Color del trazo',
			strokeWidth: 'Grosor del trazo',
			tool: 'Herramienta',
			instructions: 'Dibuja con tu ratón o táctil. Usa el botón Limpiar para reiniciar.',
			canvas: 'Lienzo de dibujo',
			updated: 'Dibujo actualizado.',
			cleared: 'Dibujo limpiado.',
			generated: 'Generado:',
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
			insertInlineMath: 'Insertar matemática en línea',
			insertBlockMath: 'Insertar bloque matemático',
		},

		slider: {
			label: 'Deslizador',
			selectedValue: 'Valor seleccionado: {value}',
			min: 'Mínimo: {min}',
			max: 'Máximo: {max}',
			step: 'Paso: {step}',
			ariaLabel: 'Valor del deslizador de {lowerBound} a {upperBound}',
			statTitle: 'Valor seleccionado',
		},

		hottext: {
			selected: 'Seleccionado:',
			selectText: 'Selecciona texto del pasaje',
			clearSelection: 'Limpiar selección',
			ariaLabel: 'Interacción de selección de texto',
		},

		hotspot: {
			selected: 'Seleccionado:',
			selectArea: 'Selecciona áreas en la imagen',
			ariaLabel: 'Interacción de zona activa',
			altText: 'Interacción de zona activa',
		},

		selectPoint: {
			instruction: 'Haz clic en la imagen para seleccionar puntos',
			instructionAria: 'Haz clic para seleccionar puntos en la imagen',
			maxPointsReached: 'Número máximo de puntos alcanzado. Elimina un punto para agregar uno nuevo.',
			point: 'Punto {index}',
			removePoint: 'Eliminar punto {index}',
			removePointTitle: 'Haz clic para eliminar este punto',
			removePointAt: 'Eliminar punto {index} en coordenadas {x}, {y}',
			removePointAtTitle: 'Haz clic para eliminar este punto ({x}, {y})',
			canvas: 'Lienzo de selección',
			noImage: 'No se proporcionó imagen',
			pointsSelected: 'Puntos seleccionados:',
			minimumMet: '✓ Mínimo cumplido',
			selectAtLeast: 'Selecciona al menos {minChoices}',
		},

		match: {
			keyboardInstructions: 'Presiona Espacio o Enter para seleccionar un elemento fuente. Tab para navegar a los objetivos. Presiona Espacio o Enter en un objetivo para crear una coincidencia. Presiona Escape para cancelar la selección.',
			dragInstruction: 'Presiona Espacio o Enter para emparejar',
			dropTarget: 'Suelta el elemento aquí',
			matchedWith: 'Emparejado con {target}',
			selectedForMatching: 'Seleccionado para emparejar',
			available: 'Disponible',
			availableForMatching: 'Disponible para emparejar',
			removeMatch: 'Eliminar emparejamiento',
			clearMatch: 'Limpiar emparejamiento de {source}',
			sourceItemsLabel: 'Elementos fuente para emparejar',
			targetItemsLabel: 'Elementos objetivo para emparejar',
		},

		gapMatch: {
			instruction: 'Arrastra palabras para llenar los espacios en blanco',
			available: 'Palabras disponibles',
			availableLabel: 'Palabras disponibles para colocar',
			availableHeading: 'Palabras disponibles:',
			removeWord: 'Eliminar palabra',
			removeFromBlanks: 'Eliminar {word} de los espacios',
		},

		graphicGapMatch: {
			instruction: 'Coloca etiquetas en los puntos activos de la imagen',
			keyboardInstructions: 'Presiona Espacio o Enter para seleccionar una etiqueta. Tab para navegar a los puntos activos en la imagen. Presiona Espacio o Enter en un punto activo para colocar la etiqueta. Presiona Escape para cancelar la selección.',
			available: 'Etiquetas disponibles',
			availableLabel: 'Etiquetas disponibles para colocar',
			availableHeading: 'Etiquetas disponibles:',
			alreadyPlaced: 'Ya colocado en punto activo',
			selectedForPlacement: 'Seleccionado para colocación',
			pressSpaceToSelect: 'Presiona Espacio para seleccionar',
			pressSpaceToPlace: 'Presiona Espacio o Enter para colocar etiqueta',
			removeLabel: 'Eliminar etiqueta',
			removeFromHotspot: 'Eliminar {label} del punto activo',
			hotspot: 'Punto activo {number}',
			contains: 'Contiene: {label}',
		},

		order: {
			instruction: 'Arrastra elementos para reordenarlos',
			keyboardInstructions: 'Presiona Espacio o Enter para agarrar un elemento. Usa las flechas para mover el elemento. Presiona Espacio o Enter nuevamente para soltar. Presiona Escape para cancelar.',
			grabbed: 'Agarrado. Usa las flechas para mover.',
			moveUp: 'Mover arriba',
			moveDown: 'Mover abajo',
			position: 'Posición {current} de {total}',
			listLabel: 'Lista reordenable de opciones',
			confirmOrder: 'Confirmar orden',
			confirmOrderNoChanges: 'Confirmar orden (Sin cambios)',
			confirmAria: 'Confirmar este orden como tu respuesta',
		},

		associate: {
			instruction: 'Crear asociaciones entre elementos',
			createPair: 'Crear par',
			removePair: 'Eliminar par',
			removeAssociation: 'Eliminar asociación',
			diagramLabel: 'Diagrama de asociación',
			altText: 'Diagrama de asociación',
			hotspotConnections: '{label} ({usageCount}/{matchMax} conexiones)',
			selectAnother: 'Seleccionado: <strong>{label}</strong>. Haz clic en otro',
			minimumRequired: 'Mínimo requerido: {minAssociations}',
		},

		positionObject: {
			instruction: 'Arrastra objetos sobre la imagen',
			placeObject: 'Colocar {object} en la imagen',
			removeObject: 'Eliminar {object}',
			objectAt: '{object} en posición ({x}, {y})',
			canvasLabel: 'Lienzo de posicionamiento',
			backgroundAlt: 'Fondo de posicionamiento',
			positioned: '{label} posicionado en ({x}, {y})',
			minimumRequired: 'Mínimo requerido: {minChoices}',
			maximumAllowed: 'Máximo: {maxChoices}',
			availableObjects: 'Objetos disponibles',
			objectUsage: '{label} ({usageCount}/{matchMax} usado)',
		},

		endAttempt: {
			buttonLabel: 'Finalizar intento',
			ended: 'Intento finalizado',
			requested: 'Solicitado',
			warningMessage: 'Tu intento ha finalizado y ya no se puede modificar.',
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
			ariaLabel: 'Contenido multimedia',
			maxPlayLimitReached: 'Límite máximo de reproducción alcanzado',
		},

		graphicOrder: {
			instruction: 'Haz clic en puntos activos para ordenarlos',
			diagramLabel: 'Diagrama de ordenamiento',
			altText: 'Diagrama de ordenamiento',
			itemLabel: 'Elemento {index}: {label}',
			confirmOrder: 'Confirmar orden',
			confirmOrderNoChanges: 'Confirmar orden (Sin cambios)',
			confirmAria: 'Confirmar este orden como tu respuesta',
		},

		custom: {
			fallbackPlaceholder: 'Ingresa una respuesta manual (alternativa)',
		},

		inline: {
			placeholder: '...',
		},
	},

	item: {
		loading: 'Cargando elemento...',
		loadingError: 'Error al cargar elemento',
		loadError: 'Error al cargar elemento: {error}',
		parsingError: 'Error al analizar QTI XML',
		processingError: 'Error al procesar respuestas',
		submit: 'Enviar',
		complete: 'Completar',
		completed: 'Completado',
		attempt: 'Intento {numAttempts}',
	},

	itemSession: {
		attempt: 'Intento {numAttempts}',
		attemptsRemaining: '{attemptsRemaining} intentos restantes',
		maxAttempts: 'Intentos máximos: {maxAttempts}',
	},

	feedback: {
		close: 'Cerrar retroalimentación',
		closeFeedback: 'Descartar retroalimentación',
		testFeedback: 'Retroalimentación de prueba',
	},

	assessment: {
		title: 'Evaluación',
		loading: 'Cargando evaluación...',
		loadingError: 'Tiempo de espera agotado al cargar evaluación. Esta evaluación puede ser inválida o el reproductor no pudo inicializarse.',
		question: 'Pregunta {current} de {total}',
		questionAnnouncement: 'Pregunta {current} de {total}',
		section: 'Sección {current} de {total}',
		closeMenu: 'Cerrar menú',

		attempts: {
			remaining: '{count} intentos restantes',
			oneRemaining: '1 intento restante',
			noRemaining: 'Sin intentos restantes ({count} usados)',
			used: 'Intentos: {count}',
			maxReached: 'Intentos máximos alcanzados',
			required: 'Debe responder antes de continuar',
			reviewNotAllowed: 'No permitido una vez enviado',
		},

		navigation: {
			previous: 'Anterior',
			next: 'Siguiente',
			submit: 'Enviar',
			jumpTo: 'Ir a pregunta {number}',
			sectionMenu: 'Menú de sección',
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
			unanswered: 'Sin responder',
			score: 'Puntuación: {score} / {maxScore}',
			passed: 'Aprobado',
			failed: 'Reprobado',
		},

		completion: {
			title: 'Evaluación completada',
			message: 'Has completado la evaluación.',
			score: 'Tu puntuación: {score} de {maxScore}',
			percentage: 'Porcentaje: {percent}%',
			viewResults: 'Ver resultados',
			exit: 'Salir',
		},

		errors: {
			navigationFailed: 'Navegación fallida. Por favor intenta de nuevo.',
			submitFailed: 'Error al enviar evaluación. Por favor intenta de nuevo.',
			loadFailed: 'Error al cargar pregunta.',
			saveFailed: 'Error al guardar respuesta.',
		},
	},

	i18n: {
		selectLanguage: 'Idioma',
		selectLanguageAriaLabel: 'Seleccionar idioma de visualización',
	},

	accessibility: {
		skipToContent: 'Saltar al contenido',
		skipToNavigation: 'Saltar a navegación',
		itemBody: 'Contenido de pregunta',
		navigationRegion: 'Navegación de evaluación',
		announcement: 'Anuncio',
		newQuestion: 'Nueva pregunta cargada',
		answerRecorded: 'Respuesta registrada',
		resizer: 'Redimensionar paneles de pasaje y pregunta',
	},
} as const;
