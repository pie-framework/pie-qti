/**
 * Czech (Czech Republic) translations
 *
 * Guidelines for translators:
 * - Keep messages concise for UI constraints
 * - Use sentence case for labels, title case for buttons
 * - Maintain consistent terminology across interactions
 * - Variables in {curlyBraces} will be replaced with dynamic values
 */
export default {
	common: {
		loading: 'Načítání...',
		error: 'Chyba',
		success: 'Úspěch',
		cancel: 'Zrušit',
		confirm: 'Potvrdit',
		close: 'Zavřít',
		save: 'Uložit',
		delete: 'Smazat',
		edit: 'Upravit',
		remove: 'Odebrat',
		add: 'Přidat',
		search: 'Hledat',
		filter: 'Filtrovat',
		reset: 'Resetovat',
		submit: 'Odeslat',
		next: 'Další',
		previous: 'Předchozí',
		back: 'Zpět',
		continue: 'Pokračovat',
		finish: 'Dokončit',
	},

	units: {
		bytes: '{count} bajtů',
		kilobytes: '{count} KB',
		megabytes: '{count} MB',
		seconds: '{count} sekund',
		minutes: '{count} minut',
		hours: '{count} hodin',
	},

	validation: {
		required: 'Toto pole je povinné',
		invalidFormat: 'Neplatný formát',
		tooShort: 'Příliš krátké (minimálně {min} znaků)',
		tooLong: 'Příliš dlouhé (maximálně {max} znaků)',
		outOfRange: 'Hodnota musí být mezi {min} a {max}',
	},

	interactions: {
		choice: {
			selectOption: 'Vyberte možnost',
			selectMultiple: 'Vyberte všechny platné možnosti',
			selected: 'Vybráno',
			notSelected: 'Nevybráno',
		},

		upload: {
			// Shown as label above file input
			label: 'Nahrajte soubor',
			selectFile: 'Vybrat soubor',
			dragDrop: 'nebo přetáhněte soubor',

			// Displayed before list of allowed file types
			allowedTypes: 'Povolené typy souborů:',

			// Displayed when file is selected
			selectedFile: 'Vybrán:',

			// File size display - {size} will be replaced with numeric value
			fileSize: '{size} bajtů',
			fileSizeKb: '{size} KB',
			fileSizeMb: '{size} MB',

			removeFile: 'Odebrat soubor',

			// Error shown when file type validation fails
			// {types} will be replaced with comma-separated list of allowed types
			errorInvalidType: 'Typ souboru není povolen. Povolené: {types}',
			errorReadFailed: 'Načtení souboru se nezdařilo',

			// {max} will be replaced with maximum size in MB
			errorTooLarge: 'Soubor je příliš velký (maximálně {max} MB)',
			unknownType: 'Neznámý typ souboru',
		},

		drawing: {
			label: 'Nakreslete svou odpověď',
			clear: 'Vymazat kresbu',
			undo: 'Zpět',
			redo: 'Znovu',
			strokeColor: 'Barva čáry',
			strokeWidth: 'Šířka čáry',
			tool: 'Nástroj',
		},

		extendedText: {
			placeholder: 'Zde napište svou odpověď...',
			characterCount: '{count} znaků',
			characterLimit: '{count} / {max} znaků',
			bold: 'Tučné',
			italic: 'Kurzíva',
			underline: 'Podtržení',
			bulletList: 'Odrážkový seznam',
			numberedList: 'Číslovaný seznam',
			insertMath: 'Vložit matematickou rovnici',
		},

		slider: {
			label: 'Posuvník',
			selectedValue: 'Vybraná hodnota: {value}',
			min: 'Minimální hodnota: {min}',
			max: 'Maximální hodnota: {max}',
			step: 'Krok: {step}',
		},

		hottext: {
			selected: 'Vybráno:',
			selectText: 'Vyberte text z úryvku',
		},

		hotspot: {
			selected: 'Vybráno:',
			selectArea: 'Vyberte oblasti na obrázku',
		},

		selectPoint: {
			instruction: 'Klikněte na obrázek pro výběr bodů',
			maxPointsReached: 'Dosažen maximální počet bodů. Odeberte bod pro přidání nového.',
			point: 'Bod {index}',
			removePoint: 'Odebrat bod {index}',
		},

		match: {
			// Keyboard instruction for accessible drag-drop
			dragInstruction: 'Stiskněte mezerník nebo Enter pro spárování',
			dropTarget: 'Přetáhněte položku sem',
			matchedWith: 'Spárováno s {target}',
			available: 'Dostupné',
			removeMatch: 'Odebrat párování',
		},

		gapMatch: {
			instruction: 'Přetáhněte slova k vyplnění mezer',
			available: 'Dostupná slova',
			removeWord: 'Odebrat slovo',
			// {word} will be replaced with the word being removed
			removeFromBlanks: 'Odebrat {word} z mezer',
		},

		graphicGapMatch: {
			instruction: 'Umístěte popisky na aktivní oblasti obrázku',
			available: 'Dostupné popisky',
			alreadyPlaced: 'Již umístěno na aktivní oblasti',
			selectedForPlacement: 'Vybráno pro umístění',
			pressSpaceToSelect: 'Stiskněte mezerník pro výběr',
			pressSpaceToPlace: 'Stiskněte mezerník nebo Enter pro umístění popisku',
			removeLabel: 'Odebrat popisek',
			removeFromHotspot: 'Odebrat {label} z aktivní oblasti',
			hotspot: 'Aktivní oblast {number}',
			contains: 'Obsahuje: {label}',
		},

		order: {
			instruction: 'Přetáhněte položky pro jejich přeřazení',
			moveUp: 'Přesunout nahoru',
			moveDown: 'Přesunout dolů',
			position: 'Pozice {current} z {total}',
		},

		associate: {
			instruction: 'Vytvořte asociace mezi položkami',
			createPair: 'Vytvořit pár',
			removePair: 'Odebrat pár',
		},

		positionObject: {
			instruction: 'Přetáhněte objekty na obrázek',
			placeObject: 'Umístit {object} na obrázek',
			removeObject: 'Odebrat {object}',
			objectAt: '{object} na pozici ({x}, {y})',
		},

		endAttempt: {
			buttonLabel: 'Ukončit pokus',
			ended: 'Pokus ukončen',
			requested: 'Požadováno',
			warningMessage: 'Váš pokus byl ukončen a nelze jej dále upravovat.',
			confirmMessage: 'Opravdu chcete ukončit pokus? Nebudete moci změnit své odpovědi.',
		},

		media: {
			play: 'Přehrát',
			pause: 'Pozastavit',
			volume: 'Hlasitost',
			mute: 'Ztlumit',
			unmute: 'Zrušit ztlumení',
			fullscreen: 'Celá obrazovka',
			exitFullscreen: 'Ukončit celou obrazovku',
			playbackSpeed: 'Rychlost přehrávání',
			currentTime: '{current} / {duration}',
			loading: 'Načítání média...',
		},
	},

	assessment: {
		title: 'Hodnocení',
		loading: 'Načítání hodnocení...',
		loadingError: 'Vypršel čas pro načtení hodnocení. Toto hodnocení může být neplatné nebo se přehrávač nepodařilo inicializovat.',
		question: 'Otázka {current} z {total}',
		section: 'Část {current} z {total}',

		navigation: {
			previous: 'Předchozí',
			next: 'Další',
			submit: 'Odeslat',
			jumpTo: 'Přejít na otázku {number}',
			sectionMenu: 'Menu částí',
			progress: 'Postup: {percent}%',
		},

		sections: {
			title: 'Části',
			selectSection: 'Vybrat část',
		},

		timer: {
			timeRemaining: 'Zbývající čas: {time}',
			timeElapsed: 'Uplynulý čas: {time}',
			timeUp: 'Čas vypršel!',
		},

		feedback: {
			correct: 'Správně',
			incorrect: 'Nesprávně',
			partiallyCorrect: 'Částečně správně',
			unanswered: 'Nezodpovězeno',
			score: 'Skóre: {score} / {maxScore}',
			passed: 'Uspěl',
			failed: 'Neuspěl',
		},

		completion: {
			title: 'Hodnocení dokončeno',
			message: 'Dokončili jste hodnocení.',
			score: 'Vaše skóre: {score} z {maxScore}',
			percentage: 'Procentní podíl: {percent}%',
			viewResults: 'Zobrazit výsledky',
			exit: 'Ukončit',
		},

		errors: {
			navigationFailed: 'Navigace se nezdařila. Zkuste to prosím znovu.',
			submitFailed: 'Odeslání hodnocení se nezdařilo. Zkuste to prosím znovu.',
			loadFailed: 'Načtení otázky se nezdařilo.',
			saveFailed: 'Uložení odpovědi se nezdařilo.',
		},
	},

	accessibility: {
		skipToContent: 'Přeskočit na obsah',
		skipToNavigation: 'Přeskočit na navigaci',
		itemBody: 'Obsah otázky',
		navigationRegion: 'Navigace hodnocení',
		announcement: 'Oznámení',
		newQuestion: 'Načtena nová otázka',
		answerRecorded: 'Odpověď zaznamenána',
	},
} as const; // 'as const' for strict type inference
