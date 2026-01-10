/**
 * Portuguese (Brazil) translations
 *
 * Guidelines for translators:
 * - Keep messages concise for UI constraints
 * - Use sentence case for labels, title case for buttons
 * - Maintain consistent terminology across interactions
 * - Variables in {curlyBraces} will be replaced with dynamic values
 */
export default {
	common: {
		loading: 'Carregando...',
		error: 'Erro',
		success: 'Sucesso',
		cancel: 'Cancelar',
		confirm: 'Confirmar',
		close: 'Fechar',
		save: 'Salvar',
		delete: 'Excluir',
		edit: 'Editar',
		remove: 'Remover',
		add: 'Adicionar',
		search: 'Pesquisar',
		filter: 'Filtrar',
		reset: 'Redefinir',
		submit: 'Enviar',
		next: 'Próximo',
		previous: 'Anterior',
		back: 'Voltar',
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
		required: 'Este campo é obrigatório',
		invalidFormat: 'Formato inválido',
		tooShort: 'Muito curto (mínimo {min} caracteres)',
		tooLong: 'Muito longo (máximo {max} caracteres)',
		outOfRange: 'O valor deve estar entre {min} e {max}',
	},

	interactions: {
		choice: {
			selectOption: 'Selecione uma opção',
			selectMultiple: 'Selecione todas as opções aplicáveis',
			selected: 'Selecionado',
			notSelected: 'Não selecionado',
		},

		upload: {
			// Shown as label above file input
			label: 'Carregar um arquivo',
			selectFile: 'Escolher arquivo',
			dragDrop: 'ou arrastar e soltar',

			// Displayed before list of allowed file types
			allowedTypes: 'Tipos de arquivo permitidos:',

			// Displayed when file is selected
			selectedFile: 'Selecionado:',

			// File size display - {size} will be replaced with numeric value
			fileSize: '{size} bytes',
			fileSizeKb: '{size} KB',
			fileSizeMb: '{size} MB',

			removeFile: 'Remover arquivo',

			// Error shown when file type validation fails
			// {types} will be replaced with comma-separated list of allowed types
			errorInvalidType: 'Tipo de arquivo não permitido. Permitidos: {types}',
			errorReadFailed: 'Falha ao ler o arquivo',

			// {max} will be replaced with maximum size in MB
			errorTooLarge: 'O arquivo é muito grande (máximo {max} MB)',
			unknownType: 'Tipo de arquivo desconhecido',
		},

		drawing: {
			label: 'Desenhe sua resposta',
			clear: 'Limpar desenho',
			undo: 'Desfazer',
			redo: 'Refazer',
			strokeColor: 'Cor do traço',
			strokeWidth: 'Espessura do traço',
			tool: 'Ferramenta',
		},

		extendedText: {
			placeholder: 'Digite sua resposta aqui...',
			characterCount: '{count} caracteres',
			characterLimit: '{count} / {max} caracteres',
			bold: 'Negrito',
			italic: 'Itálico',
			underline: 'Sublinhado',
			bulletList: 'Lista com marcadores',
			numberedList: 'Lista numerada',
			insertMath: 'Inserir equação matemática',
		},

		slider: {
			label: 'Controle deslizante',
			selectedValue: 'Valor selecionado: {value}',
			min: 'Mínimo: {min}',
			max: 'Máximo: {max}',
			step: 'Passo: {step}',
		},

		hottext: {
			selected: 'Selecionado:',
			selectText: 'Selecione o texto da passagem',
		},

		hotspot: {
			selected: 'Selecionado:',
			selectArea: 'Selecione áreas na imagem',
		},

		selectPoint: {
			instruction: 'Clique na imagem para selecionar pontos',
			maxPointsReached: 'Número máximo de pontos atingido. Remova um ponto para adicionar um novo.',
			point: 'Ponto {index}',
			removePoint: 'Remover ponto {index}',
		},

		match: {
			// Keyboard instruction for accessible drag-drop
			dragInstruction: 'Pressione Espaço ou Enter para combinar',
			dropTarget: 'Soltar item aqui',
			matchedWith: 'Combinado com {target}',
			available: 'Disponível',
			removeMatch: 'Remover combinação',
		},

		gapMatch: {
			instruction: 'Arraste palavras para preencher os espaços em branco',
			available: 'Palavras disponíveis',
			removeWord: 'Remover palavra',
			// {word} will be replaced with the word being removed
			removeFromBlanks: 'Remover {word} dos espaços em branco',
		},

		graphicGapMatch: {
			instruction: 'Coloque rótulos nos pontos de acesso da imagem',
			available: 'Rótulos disponíveis',
			alreadyPlaced: 'Já colocado no ponto de acesso',
			selectedForPlacement: 'Selecionado para colocação',
			pressSpaceToSelect: 'Pressione Espaço para selecionar',
			pressSpaceToPlace: 'Pressione Espaço ou Enter para colocar o rótulo',
			removeLabel: 'Remover rótulo',
			removeFromHotspot: 'Remover {label} do ponto de acesso',
			hotspot: 'Ponto de acesso {number}',
			contains: 'Contém: {label}',
		},

		order: {
			instruction: 'Arraste itens para reordená-los',
			moveUp: 'Mover para cima',
			moveDown: 'Mover para baixo',
			position: 'Posição {current} de {total}',
		},

		associate: {
			instruction: 'Crie associações entre itens',
			createPair: 'Criar par',
			removePair: 'Remover par',
		},

		positionObject: {
			instruction: 'Arraste objetos para a imagem',
			placeObject: 'Colocar {object} na imagem',
			removeObject: 'Remover {object}',
			objectAt: '{object} na posição ({x}, {y})',
		},

		endAttempt: {
			buttonLabel: 'Finalizar Tentativa',
			ended: 'Tentativa Finalizada',
			requested: 'Solicitado',
			warningMessage: 'Sua tentativa foi finalizada e não pode mais ser modificada.',
			confirmMessage: 'Tem certeza de que deseja finalizar sua tentativa? Você não poderá alterar suas respostas.',
		},

		media: {
			play: 'Reproduzir',
			pause: 'Pausar',
			volume: 'Volume',
			mute: 'Silenciar',
			unmute: 'Ativar som',
			fullscreen: 'Tela cheia',
			exitFullscreen: 'Sair da tela cheia',
			playbackSpeed: 'Velocidade de reprodução',
			currentTime: '{current} / {duration}',
			loading: 'Carregando mídia...',
		},
	},

	assessment: {
		title: 'Avaliação',
		loading: 'Carregando avaliação...',
		loadingError: 'Tempo limite excedido ao carregar a avaliação. Esta avaliação pode ser inválida ou o player falhou ao inicializar.',
		question: 'Questão {current} de {total}',
		section: 'Seção {current} de {total}',

		navigation: {
			previous: 'Anterior',
			next: 'Próximo',
			submit: 'Enviar',
			jumpTo: 'Ir para a questão {number}',
			sectionMenu: 'Menu de seções',
			progress: 'Progresso: {percent}%',
		},

		sections: {
			title: 'Seções',
			selectSection: 'Selecionar seção',
		},

		timer: {
			timeRemaining: 'Tempo restante: {time}',
			timeElapsed: 'Tempo decorrido: {time}',
			timeUp: 'O tempo acabou!',
		},

		feedback: {
			correct: 'Correto',
			incorrect: 'Incorreto',
			partiallyCorrect: 'Parcialmente correto',
			unanswered: 'Não respondida',
			score: 'Pontuação: {score} / {maxScore}',
			passed: 'Aprovado',
			failed: 'Reprovado',
		},

		completion: {
			title: 'Avaliação Concluída',
			message: 'Você concluiu a avaliação.',
			score: 'Sua pontuação: {score} de {maxScore}',
			percentage: 'Porcentagem: {percent}%',
			viewResults: 'Ver resultados',
			exit: 'Sair',
		},

		errors: {
			navigationFailed: 'Falha na navegação. Por favor, tente novamente.',
			submitFailed: 'Falha ao enviar a avaliação. Por favor, tente novamente.',
			loadFailed: 'Falha ao carregar a questão.',
			saveFailed: 'Falha ao salvar a resposta.',
		},
	},

	accessibility: {
		skipToContent: 'Pular para o conteúdo',
		skipToNavigation: 'Pular para a navegação',
		itemBody: 'Conteúdo da questão',
		navigationRegion: 'Navegação da avaliação',
		announcement: 'Anúncio',
		newQuestion: 'Nova questão carregada',
		answerRecorded: 'Resposta registrada',
	},
} as const; // 'as const' for strict type inference
