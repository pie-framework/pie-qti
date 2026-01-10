/**
 * Hungarian (Hungary) translations
 *
 * Guidelines for translators:
 * - Keep messages concise for UI constraints
 * - Use sentence case for labels, title case for buttons
 * - Maintain consistent terminology across interactions
 * - Variables in {curlyBraces} will be replaced with dynamic values
 */
export default {
	common: {
		loading: 'Betöltés...',
		error: 'Hiba',
		success: 'Sikeres',
		cancel: 'Mégse',
		confirm: 'Megerősítés',
		close: 'Bezárás',
		save: 'Mentés',
		delete: 'Törlés',
		edit: 'Szerkesztés',
		remove: 'Eltávolítás',
		add: 'Hozzáadás',
		search: 'Keresés',
		filter: 'Szűrés',
		reset: 'Visszaállítás',
		submit: 'Beküldés',
		next: 'Következő',
		previous: 'Előző',
		back: 'Vissza',
		continue: 'Folytatás',
		finish: 'Befejezés',
	},

	units: {
		bytes: '{count} bájt',
		kilobytes: '{count} KB',
		megabytes: '{count} MB',
		seconds: '{count} másodperc',
		minutes: '{count} perc',
		hours: '{count} óra',
	},

	validation: {
		required: 'Ez a mező kötelező',
		invalidFormat: 'Érvénytelen formátum',
		tooShort: 'Túl rövid (minimum {min} karakter)',
		tooLong: 'Túl hosszú (maximum {max} karakter)',
		outOfRange: 'Az értéknek {min} és {max} között kell lennie',
	},

	interactions: {
		choice: {
			selectOption: 'Válasszon egy lehetőséget',
			selectMultiple: 'Válassza ki az összes megfelelőt',
			selected: 'Kiválasztva',
			notSelected: 'Nincs kiválasztva',
		},

		upload: {
			// Shown as label above file input
			label: 'Fájl feltöltése',
			selectFile: 'Fájl kiválasztása',
			dragDrop: 'vagy húzza ide',

			// Displayed before list of allowed file types
			allowedTypes: 'Engedélyezett fájltípusok:',

			// Displayed when file is selected
			selectedFile: 'Kiválasztva:',

			// File size display - {size} will be replaced with numeric value
			fileSize: '{size} bájt',
			fileSizeKb: '{size} KB',
			fileSizeMb: '{size} MB',

			removeFile: 'Fájl eltávolítása',

			// Error shown when file type validation fails
			// {types} will be replaced with comma-separated list of allowed types
			errorInvalidType: 'A fájltípus nem engedélyezett. Engedélyezett: {types}',
			errorReadFailed: 'A fájl olvasása sikertelen',

			// {max} will be replaced with maximum size in MB
			errorTooLarge: 'A fájl túl nagy (maximum {max} MB)',
			unknownType: 'Ismeretlen fájltípus',
		},

		drawing: {
			label: 'Rajzolja meg a válaszát',
			clear: 'Rajz törlése',
			undo: 'Visszavonás',
			redo: 'Újra',
			strokeColor: 'Vonalszín',
			strokeWidth: 'Vonalvastagság',
			tool: 'Eszköz',
		},

		extendedText: {
			placeholder: 'Írja be a válaszát ide...',
			characterCount: '{count} karakter',
			characterLimit: '{count} / {max} karakter',
			bold: 'Félkövér',
			italic: 'Dőlt',
			underline: 'Aláhúzott',
			bulletList: 'Felsorolás',
			numberedList: 'Számozott lista',
			insertMath: 'Matematikai képlet beszúrása',
		},

		slider: {
			label: 'Csúszka',
			selectedValue: 'Kiválasztott érték: {value}',
			min: 'Minimum: {min}',
			max: 'Maximum: {max}',
			step: 'Lépésköz: {step}',
		},

		hottext: {
			selected: 'Kiválasztva:',
			selectText: 'Válasszon szöveget a szövegből',
		},

		hotspot: {
			selected: 'Kiválasztva:',
			selectArea: 'Válasszon területeket a képen',
		},

		selectPoint: {
			instruction: 'Kattintson a képre pontok kiválasztásához',
			maxPointsReached: 'Elérte a maximális pontszámot. Távolítson el egy pontot új hozzáadásához.',
			point: '{index}. pont',
			removePoint: '{index}. pont eltávolítása',
		},

		match: {
			// Keyboard instruction for accessible drag-drop
			dragInstruction: 'Nyomja meg a szóközt vagy az Enter billentyűt a párosításhoz',
			dropTarget: 'Helyezze ide az elemet',
			matchedWith: 'Párosítva ezzel: {target}',
			available: 'Elérhető',
			removeMatch: 'Párosítás eltávolítása',
		},

		gapMatch: {
			instruction: 'Húzza a szavakat az üres helyekre',
			available: 'Elérhető szavak',
			removeWord: 'Szó eltávolítása',
			// {word} will be replaced with the word being removed
			removeFromBlanks: '{word} eltávolítása az üres helyekről',
		},

		graphicGapMatch: {
			instruction: 'Helyezze el a címkéket a kép pontjain',
			available: 'Elérhető címkék',
			alreadyPlaced: 'Már elhelyezve egy ponton',
			selectedForPlacement: 'Kiválasztva elhelyezésre',
			pressSpaceToSelect: 'Nyomja meg a szóközt a kiválasztáshoz',
			pressSpaceToPlace: 'Nyomja meg a szóközt vagy az Enter billentyűt a címke elhelyezéséhez',
			removeLabel: 'Címke eltávolítása',
			removeFromHotspot: '{label} eltávolítása a pontról',
			hotspot: '{number}. pont',
			contains: 'Tartalmazza: {label}',
		},

		order: {
			instruction: 'Húzza az elemeket az átrendezéshez',
			moveUp: 'Felfelé',
			moveDown: 'Lefelé',
			position: '{current}. pozíció {total}-ból/ből',
		},

		associate: {
			instruction: 'Hozzon létre kapcsolatokat az elemek között',
			createPair: 'Pár létrehozása',
			removePair: 'Pár eltávolítása',
		},

		positionObject: {
			instruction: 'Húzza az objektumokat a képre',
			placeObject: '{object} elhelyezése a képre',
			removeObject: '{object} eltávolítása',
			objectAt: '{object} a pozícióban: ({x}, {y})',
		},

		endAttempt: {
			buttonLabel: 'Megoldás befejezése',
			ended: 'Megoldás befejezve',
			requested: 'Kérelmezve',
			warningMessage: 'A megoldást befejezte, és már nem módosítható.',
			confirmMessage: 'Biztosan be szeretné fejezni a megoldást? Nem tudja majd megváltoztatni a válaszait.',
		},

		media: {
			play: 'Lejátszás',
			pause: 'Szünet',
			volume: 'Hangerő',
			mute: 'Némítás',
			unmute: 'Némítás feloldása',
			fullscreen: 'Teljes képernyő',
			exitFullscreen: 'Kilépés a teljes képernyőből',
			playbackSpeed: 'Lejátszási sebesség',
			currentTime: '{current} / {duration}',
			loading: 'Média betöltése...',
		},
	},

	assessment: {
		title: 'Felmérés',
		loading: 'Felmérés betöltése...',
		loadingError: 'Időtúllépés a felmérés betöltése közben. Ez a felmérés érvénytelen lehet, vagy a lejátszó nem tudott inicializálódni.',
		question: '{current}. kérdés {total}-ból/ből',
		section: '{current}. szakasz {total}-ból/ből',

		navigation: {
			previous: 'Előző',
			next: 'Következő',
			submit: 'Beküldés',
			jumpTo: 'Ugrás a(z) {number}. kérdéshez',
			sectionMenu: 'Szakasz menü',
			progress: 'Folyamat: {percent}%',
		},

		sections: {
			title: 'Szakaszok',
			selectSection: 'Szakasz kiválasztása',
		},

		timer: {
			timeRemaining: 'Hátralévő idő: {time}',
			timeElapsed: 'Eltelt idő: {time}',
			timeUp: 'Lejárt az idő!',
		},

		feedback: {
			correct: 'Helyes',
			incorrect: 'Helytelen',
			partiallyCorrect: 'Részben helyes',
			unanswered: 'Megválaszolatlan',
			score: 'Pontszám: {score} / {maxScore}',
			passed: 'Átment',
			failed: 'Nem ment át',
		},

		completion: {
			title: 'Felmérés befejezve',
			message: 'Befejezte a felmérést.',
			score: 'Az Ön pontszáma: {score} / {maxScore}',
			percentage: 'Százalék: {percent}%',
			viewResults: 'Eredmények megtekintése',
			exit: 'Kilépés',
		},

		errors: {
			navigationFailed: 'A navigáció sikertelen. Kérjük, próbálja újra.',
			submitFailed: 'A felmérés beküldése sikertelen. Kérjük, próbálja újra.',
			loadFailed: 'A kérdés betöltése sikertelen.',
			saveFailed: 'A válasz mentése sikertelen.',
		},
	},

	accessibility: {
		skipToContent: 'Ugrás a tartalomhoz',
		skipToNavigation: 'Ugrás a navigációhoz',
		itemBody: 'Kérdés tartalma',
		navigationRegion: 'Felmérés navigáció',
		announcement: 'Bejelentés',
		newQuestion: 'Új kérdés betöltve',
		answerRecorded: 'Válasz rögzítve',
	},
} as const; // 'as const' for strict type inference
