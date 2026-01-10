/**
 * Ukrainian (Ukraine) translations
 *
 * Guidelines for translators:
 * - Keep messages concise for UI constraints
 * - Use sentence case for labels, title case for buttons
 * - Maintain consistent terminology across interactions
 * - Variables in {curlyBraces} will be replaced with dynamic values
 */
export default {
	common: {
		loading: 'Завантаження...',
		error: 'Помилка',
		success: 'Успіх',
		cancel: 'Скасувати',
		confirm: 'Підтвердити',
		close: 'Закрити',
		save: 'Зберегти',
		delete: 'Видалити',
		edit: 'Редагувати',
		remove: 'Вилучити',
		add: 'Додати',
		search: 'Пошук',
		filter: 'Фільтр',
		reset: 'Скинути',
		submit: 'Надіслати',
		next: 'Далі',
		previous: 'Назад',
		back: 'Повернутися',
		continue: 'Продовжити',
		finish: 'Завершити',
	},

	units: {
		bytes: '{count} байт',
		kilobytes: '{count} КБ',
		megabytes: '{count} МБ',
		seconds: '{count} секунд',
		minutes: '{count} хвилин',
		hours: '{count} годин',
	},

	validation: {
		required: 'Це поле є обов\'язковим',
		invalidFormat: 'Неправильний формат',
		tooShort: 'Занадто коротко (мінімум {min} символів)',
		tooLong: 'Занадто довго (максимум {max} символів)',
		outOfRange: 'Значення має бути між {min} та {max}',
	},

	interactions: {
		choice: {
			selectOption: 'Виберіть варіант',
			selectMultiple: 'Виберіть усі підходящі варіанти',
			selected: 'Вибрано',
			notSelected: 'Не вибрано',
		},

		upload: {
			// Shown as label above file input
			label: 'Завантажити файл',
			selectFile: 'Обрати файл',
			dragDrop: 'або перетягніть сюди',

			// Displayed before list of allowed file types
			allowedTypes: 'Дозволені типи файлів:',

			// Displayed when file is selected
			selectedFile: 'Вибрано:',

			// File size display - {size} will be replaced with numeric value
			fileSize: '{size} байт',
			fileSizeKb: '{size} КБ',
			fileSizeMb: '{size} МБ',

			removeFile: 'Видалити файл',

			// Error shown when file type validation fails
			// {types} will be replaced with comma-separated list of allowed types
			errorInvalidType: 'Тип файлу не дозволено. Дозволені: {types}',
			errorReadFailed: 'Не вдалося прочитати файл',

			// {max} will be replaced with maximum size in MB
			errorTooLarge: 'Файл занадто великий (максимум {max} МБ)',
			unknownType: 'Невідомий тип файлу',
		},

		drawing: {
			label: 'Намалюйте вашу відповідь',
			clear: 'Очистити малюнок',
			undo: 'Скасувати',
			redo: 'Повторити',
			strokeColor: 'Колір лінії',
			strokeWidth: 'Товщина лінії',
			tool: 'Інструмент',
		},

		extendedText: {
			placeholder: 'Введіть вашу відповідь тут...',
			characterCount: '{count} символів',
			characterLimit: '{count} / {max} символів',
			bold: 'Жирний',
			italic: 'Курсив',
			underline: 'Підкреслений',
			bulletList: 'Маркований список',
			numberedList: 'Нумерований список',
			insertMath: 'Вставити математичне рівняння',
		},

		slider: {
			label: 'Повзунок',
			selectedValue: 'Вибране значення: {value}',
			min: 'Мінімум: {min}',
			max: 'Максимум: {max}',
			step: 'Крок: {step}',
		},

		hottext: {
			selected: 'Вибрано:',
			selectText: 'Виберіть текст з уривка',
		},

		hotspot: {
			selected: 'Вибрано:',
			selectArea: 'Виберіть області на зображенні',
		},

		selectPoint: {
			instruction: 'Клацніть на зображенні, щоб вибрати точки',
			maxPointsReached: 'Досягнуто максимальну кількість точок. Видаліть точку, щоб додати нову.',
			point: 'Точка {index}',
			removePoint: 'Видалити точку {index}',
		},

		match: {
			// Keyboard instruction for accessible drag-drop
			dragInstruction: 'Натисніть пробіл або Enter, щоб зіставити',
			dropTarget: 'Перетягніть елемент сюди',
			matchedWith: 'Зіставлено з {target}',
			available: 'Доступно',
			removeMatch: 'Видалити збіг',
		},

		gapMatch: {
			instruction: 'Перетягніть слова, щоб заповнити пропуски',
			available: 'Доступні слова',
			removeWord: 'Видалити слово',
			// {word} will be replaced with the word being removed
			removeFromBlanks: 'Видалити {word} з пропусків',
		},

		graphicGapMatch: {
			instruction: 'Розмістіть підписи на активних областях зображення',
			available: 'Доступні підписи',
			alreadyPlaced: 'Вже розміщено на активній області',
			selectedForPlacement: 'Вибрано для розміщення',
			pressSpaceToSelect: 'Натисніть пробіл, щоб вибрати',
			pressSpaceToPlace: 'Натисніть пробіл або Enter, щоб розмістити підпис',
			removeLabel: 'Видалити підпис',
			removeFromHotspot: 'Видалити {label} з активної області',
			hotspot: 'Активна область {number}',
			contains: 'Містить: {label}',
		},

		order: {
			instruction: 'Перетягніть елементи, щоб змінити їх порядок',
			moveUp: 'Перемістити вгору',
			moveDown: 'Перемістити вниз',
			position: 'Позиція {current} з {total}',
		},

		associate: {
			instruction: 'Створіть асоціації між елементами',
			createPair: 'Створити пару',
			removePair: 'Видалити пару',
		},

		positionObject: {
			instruction: 'Перетягніть об\'єкти на зображення',
			placeObject: 'Розмістити {object} на зображенні',
			removeObject: 'Видалити {object}',
			objectAt: '{object} у позиції ({x}, {y})',
		},

		endAttempt: {
			buttonLabel: 'Завершити спробу',
			ended: 'Спробу завершено',
			requested: 'Запитано',
			warningMessage: 'Вашу спробу було завершено і більше не можна змінити.',
			confirmMessage: 'Ви впевнені, що хочете завершити спробу? Ви не зможете змінити свої відповіді.',
		},

		media: {
			play: 'Відтворити',
			pause: 'Пауза',
			volume: 'Гучність',
			mute: 'Вимкнути звук',
			unmute: 'Увімкнути звук',
			fullscreen: 'На весь екран',
			exitFullscreen: 'Вийти з повноекранного режиму',
			playbackSpeed: 'Швидкість відтворення',
			currentTime: '{current} / {duration}',
			loading: 'Завантаження медіа...',
		},
	},

	assessment: {
		title: 'Оцінювання',
		loading: 'Завантаження оцінювання...',
		loadingError: 'Час очікування завантаження оцінювання вичерпано. Це оцінювання може бути недійсним або програвач не вдалося ініціалізувати.',
		question: 'Запитання {current} з {total}',
		section: 'Розділ {current} з {total}',

		navigation: {
			previous: 'Попереднє',
			next: 'Наступне',
			submit: 'Надіслати',
			jumpTo: 'Перейти до запитання {number}',
			sectionMenu: 'Меню розділів',
			progress: 'Прогрес: {percent}%',
		},

		sections: {
			title: 'Розділи',
			selectSection: 'Виберіть розділ',
		},

		timer: {
			timeRemaining: 'Залишилось часу: {time}',
			timeElapsed: 'Минуло часу: {time}',
			timeUp: 'Час вичерпано!',
		},

		feedback: {
			correct: 'Правильно',
			incorrect: 'Неправильно',
			partiallyCorrect: 'Частково правильно',
			unanswered: 'Без відповіді',
			score: 'Оцінка: {score} / {maxScore}',
			passed: 'Пройдено',
			failed: 'Не пройдено',
		},

		completion: {
			title: 'Оцінювання завершено',
			message: 'Ви завершили оцінювання.',
			score: 'Ваша оцінка: {score} з {maxScore}',
			percentage: 'Відсоток: {percent}%',
			viewResults: 'Переглянути результати',
			exit: 'Вийти',
		},

		errors: {
			navigationFailed: 'Не вдалося виконати навігацію. Будь ласка, спробуйте ще раз.',
			submitFailed: 'Не вдалося надіслати оцінювання. Будь ласка, спробуйте ще раз.',
			loadFailed: 'Не вдалося завантажити запитання.',
			saveFailed: 'Не вдалося зберегти відповідь.',
		},
	},

	accessibility: {
		skipToContent: 'Перейти до вмісту',
		skipToNavigation: 'Перейти до навігації',
		itemBody: 'Зміст запитання',
		navigationRegion: 'Навігація по оцінюванню',
		announcement: 'Оголошення',
		newQuestion: 'Завантажено нове запитання',
		answerRecorded: 'Відповідь записано',
	},
} as const; // 'as const' for strict type inference
