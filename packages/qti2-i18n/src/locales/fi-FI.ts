/**
 * Finnish (Finland) translations
 *
 * Guidelines for translators:
 * - Keep messages concise for UI constraints
 * - Use sentence case for labels, title case for buttons
 * - Maintain consistent terminology across interactions
 * - Variables in {curlyBraces} will be replaced with dynamic values
 */
export default {
	common: {
		loading: 'Ladataan...',
		error: 'Virhe',
		success: 'Onnistui',
		cancel: 'Peruuta',
		confirm: 'Vahvista',
		close: 'Sulje',
		save: 'Tallenna',
		delete: 'Poista',
		edit: 'Muokkaa',
		remove: 'Poista',
		add: 'Lisää',
		search: 'Hae',
		filter: 'Suodata',
		reset: 'Nollaa',
		submit: 'Lähetä',
		next: 'Seuraava',
		previous: 'Edellinen',
		back: 'Takaisin',
		continue: 'Jatka',
		finish: 'Valmis',
	},

	units: {
		bytes: '{count} tavua',
		kilobytes: '{count} KB',
		megabytes: '{count} MB',
		seconds: '{count} sekuntia',
		minutes: '{count} minuuttia',
		hours: '{count} tuntia',
	},

	validation: {
		required: 'Tämä kenttä on pakollinen',
		invalidFormat: 'Virheellinen muoto',
		tooShort: 'Liian lyhyt (vähintään {min} merkkiä)',
		tooLong: 'Liian pitkä (enintään {max} merkkiä)',
		outOfRange: 'Arvon täytyy olla välillä {min} ja {max}',
	},

	interactions: {
		choice: {
			selectOption: 'Valitse vaihtoehto',
			selectMultiple: 'Valitse kaikki sopivat',
			selected: 'Valittu',
			notSelected: 'Ei valittu',
		},

		upload: {
			// Shown as label above file input
			label: 'Lähetä tiedosto',
			selectFile: 'Valitse tiedosto',
			dragDrop: 'tai vedä ja pudota',

			// Displayed before list of allowed file types
			allowedTypes: 'Sallitut tiedostotyypit:',

			// Displayed when file is selected
			selectedFile: 'Valittu:',

			// File size display - {size} will be replaced with numeric value
			fileSize: '{size} tavua',
			fileSizeKb: '{size} KB',
			fileSizeMb: '{size} MB',

			removeFile: 'Poista tiedosto',

			// Error shown when file type validation fails
			// {types} will be replaced with comma-separated list of allowed types
			errorInvalidType: 'Tiedostotyyppi ei ole sallittu. Sallitut: {types}',
			errorReadFailed: 'Tiedoston lukeminen epäonnistui',

			// {max} will be replaced with maximum size in MB
			errorTooLarge: 'Tiedosto on liian suuri (enintään {max} MB)',
			unknownType: 'Tuntematon tiedostotyyppi',
		},

		drawing: {
			label: 'Piirrä vastauksesi',
			clear: 'Tyhjennä piirros',
			undo: 'Kumoa',
			redo: 'Tee uudelleen',
			strokeColor: 'Viivan väri',
			strokeWidth: 'Viivan paksuus',
			tool: 'Työkalu',
		},

		extendedText: {
			placeholder: 'Kirjoita vastauksesi tähän...',
			characterCount: '{count} merkkiä',
			characterLimit: '{count} / {max} merkkiä',
			bold: 'Lihavoitu',
			italic: 'Kursivoitu',
			underline: 'Alleviivattu',
			bulletList: 'Luettelomerkit',
			numberedList: 'Numeroitu luettelo',
			insertMath: 'Lisää matemaattinen kaava',
		},

		slider: {
			label: 'Liukusäädin',
			selectedValue: 'Valittu arvo: {value}',
			min: 'Vähimmäisarvo: {min}',
			max: 'Enimmäisarvo: {max}',
			step: 'Askel: {step}',
		},

		hottext: {
			selected: 'Valittu:',
			selectText: 'Valitse tekstiä kappaleesta',
		},

		hotspot: {
			selected: 'Valittu:',
			selectArea: 'Valitse alueita kuvasta',
		},

		selectPoint: {
			instruction: 'Napsauta kuvaa valitaksesi pisteitä',
			maxPointsReached: 'Enimmäismäärä pisteitä saavutettu. Poista piste lisätäksesi uuden.',
			point: 'Piste {index}',
			removePoint: 'Poista piste {index}',
		},

		match: {
			// Keyboard instruction for accessible drag-drop
			dragInstruction: 'Paina välilyöntiä tai Enteriä muodostaaksesi parin',
			dropTarget: 'Pudota kohde tähän',
			matchedWith: 'Yhdistetty kohteeseen {target}',
			available: 'Käytettävissä',
			removeMatch: 'Poista yhdistelmä',
		},

		gapMatch: {
			instruction: 'Vedä sanat täyttämään tyhjät kohdat',
			available: 'Käytettävissä olevat sanat',
			removeWord: 'Poista sana',
			// {word} will be replaced with the word being removed
			removeFromBlanks: 'Poista {word} tyhjistä kohdista',
		},

		graphicGapMatch: {
			instruction: 'Aseta tunnisteet kuvan kohtiin',
			available: 'Käytettävissä olevat tunnisteet',
			alreadyPlaced: 'Jo asetettu kohtaan',
			selectedForPlacement: 'Valittu asettamista varten',
			pressSpaceToSelect: 'Paina välilyöntiä valitaksesi',
			pressSpaceToPlace: 'Paina välilyöntiä tai Enteriä asettaaksesi tunniste',
			removeLabel: 'Poista tunniste',
			removeFromHotspot: 'Poista {label} kohdasta',
			hotspot: 'Kohta {number}',
			contains: 'Sisältää: {label}',
		},

		order: {
			instruction: 'Vedä kohteet järjestääksesi ne uudelleen',
			moveUp: 'Siirrä ylös',
			moveDown: 'Siirrä alas',
			position: 'Kohta {current} / {total}',
		},

		associate: {
			instruction: 'Luo yhdistelmiä kohteiden välille',
			createPair: 'Luo pari',
			removePair: 'Poista pari',
		},

		positionObject: {
			instruction: 'Vedä kohteet kuvan päälle',
			placeObject: 'Aseta {object} kuvaan',
			removeObject: 'Poista {object}',
			objectAt: '{object} sijainnissa ({x}, {y})',
		},

		endAttempt: {
			buttonLabel: 'Lopeta yritys',
			ended: 'Yritys lopetettu',
			requested: 'Pyydetty',
			warningMessage: 'Yrityksesi on lopetettu, eikä sitä voi enää muokata.',
			confirmMessage: 'Oletko varma, että haluat lopettaa yrityksesi? Et voi enää muuttaa vastauksiasi.',
		},

		media: {
			play: 'Toista',
			pause: 'Keskeytä',
			volume: 'Äänenvoimakkuus',
			mute: 'Mykistä',
			unmute: 'Poista mykistys',
			fullscreen: 'Koko näyttö',
			exitFullscreen: 'Poistu koko näytöstä',
			playbackSpeed: 'Toistonopeus',
			currentTime: '{current} / {duration}',
			loading: 'Ladataan mediaa...',
		},
	},

	assessment: {
		title: 'Arviointi',
		loading: 'Ladataan arviointia...',
		loadingError: 'Aikakatkaisu ladattaessa arviointia. Tämä arviointi saattaa olla virheellinen tai soitin ei käynnistynyt.',
		question: 'Kysymys {current} / {total}',
		section: 'Osio {current} / {total}',

		navigation: {
			previous: 'Edellinen',
			next: 'Seuraava',
			submit: 'Lähetä',
			jumpTo: 'Siirry kysymykseen {number}',
			sectionMenu: 'Osiovalikko',
			progress: 'Edistyminen: {percent}%',
		},

		sections: {
			title: 'Osiot',
			selectSection: 'Valitse osio',
		},

		timer: {
			timeRemaining: 'Aikaa jäljellä: {time}',
			timeElapsed: 'Aikaa kulunut: {time}',
			timeUp: 'Aika loppui!',
		},

		feedback: {
			correct: 'Oikein',
			incorrect: 'Väärin',
			partiallyCorrect: 'Osittain oikein',
			unanswered: 'Ei vastattu',
			score: 'Pisteet: {score} / {maxScore}',
			passed: 'Hyväksytty',
			failed: 'Hylätty',
		},

		completion: {
			title: 'Arviointi valmis',
			message: 'Olet suorittanut arvioinnin.',
			score: 'Pisteesi: {score} / {maxScore}',
			percentage: 'Prosentti: {percent}%',
			viewResults: 'Näytä tulokset',
			exit: 'Poistu',
		},

		errors: {
			navigationFailed: 'Siirtyminen epäonnistui. Yritä uudelleen.',
			submitFailed: 'Arvioinnin lähettäminen epäonnistui. Yritä uudelleen.',
			loadFailed: 'Kysymyksen lataaminen epäonnistui.',
			saveFailed: 'Vastauksen tallentaminen epäonnistui.',
		},
	},

	accessibility: {
		skipToContent: 'Siirry sisältöön',
		skipToNavigation: 'Siirry navigointiin',
		itemBody: 'Kysymyksen sisältö',
		navigationRegion: 'Arvioinnin navigointi',
		announcement: 'Ilmoitus',
		newQuestion: 'Uusi kysymys ladattu',
		answerRecorded: 'Vastaus tallennettu',
	},
} as const; // 'as const' for strict type inference
