/**
 * Hindi (India) translations
 * हिन्दी (भारत) अनुवाद
 *
 * Guidelines for translators:
 * - Keep messages concise for UI constraints
 * - Use sentence case for labels, title case for buttons
 * - Maintain consistent terminology across interactions
 * - Variables in {curlyBraces} will be replaced with dynamic values
 */
export default {
	common: {
		loading: 'लोड हो रहा है...',
		error: 'त्रुटि',
		success: 'सफलता',
		cancel: 'रद्द करें',
		confirm: 'पुष्टि करें',
		close: 'बंद करें',
		save: 'सहेजें',
		delete: 'हटाएं',
		edit: 'संपादित करें',
		remove: 'हटाएं',
		add: 'जोड़ें',
		search: 'खोजें',
		filter: 'फ़िल्टर',
		reset: 'रीसेट',
		submit: 'सबमिट करें',
		next: 'आगे',
		previous: 'पिछला',
		back: 'वापस',
		continue: 'जारी रखें',
		finish: 'समाप्त करें',
	},

	units: {
		bytes: '{count} bytes',
		kilobytes: '{count} KB',
		megabytes: '{count} MB',
		seconds: '{count} सेकंड',
		minutes: '{count} मिनट',
		hours: '{count} घंटे',
	},

	validation: {
		required: 'यह फ़ील्ड आवश्यक है',
		invalidFormat: 'अमान्य प्रारूप',
		tooShort: 'बहुत छोटा (न्यूनतम {min} अक्षर)',
		tooLong: 'बहुत लंबा (अधिकतम {max} अक्षर)',
		outOfRange: 'मान {min} और {max} के बीच होना चाहिए',
	},

	interactions: {
		choice: {
			selectOption: 'एक विकल्प चुनें',
			selectMultiple: 'सभी लागू विकल्पों को चुनें',
			selected: 'चयनित',
			notSelected: 'चयनित नहीं',
		},

		upload: {
			// Shown as label above file input
			label: 'फ़ाइल अपलोड करें',
			selectFile: 'फ़ाइल चुनें',
			dragDrop: 'या ड्रैग एंड ड्रॉप करें',

			// Displayed before list of allowed file types
			allowedTypes: 'स्वीकृत फ़ाइल प्रकार:',

			// Displayed when file is selected
			selectedFile: 'चयनित:',

			// File size display - {size} will be replaced with numeric value
			fileSize: '{size} bytes',
			fileSizeKb: '{size} KB',
			fileSizeMb: '{size} MB',

			removeFile: 'फ़ाइल हटाएं',

			// Error shown when file type validation fails
			// {types} will be replaced with comma-separated list of allowed types
			errorInvalidType: 'फ़ाइल प्रकार अनुमत नहीं है। स्वीकृत: {types}',
			errorReadFailed: 'फ़ाइल पढ़ने में विफल',

			// {max} will be replaced with maximum size in MB
			errorTooLarge: 'फ़ाइल बहुत बड़ी है (अधिकतम {max} MB)',
			unknownType: 'अज्ञात फ़ाइल प्रकार',
		},

		drawing: {
			label: 'अपना उत्तर बनाएं',
			clear: 'ड्रॉइंग साफ़ करें',
			undo: 'पूर्ववत करें',
			redo: 'फिर से करें',
			strokeColor: 'स्ट्रोक रंग',
			strokeWidth: 'स्ट्रोक चौड़ाई',
			tool: 'उपकरण',
		},

		extendedText: {
			placeholder: 'अपना उत्तर यहां लिखें...',
			characterCount: '{count} अक्षर',
			characterLimit: '{count} / {max} अक्षर',
			bold: 'बोल्ड',
			italic: 'इटैलिक',
			underline: 'अंडरलाइन',
			bulletList: 'बुलेट लिस्ट',
			numberedList: 'क्रमांकित लिस्ट',
			insertMath: 'गणित समीकरण डालें',
		},

		slider: {
			label: 'स्लाइडर',
			selectedValue: 'चयनित मान: {value}',
			min: 'न्यूनतम: {min}',
			max: 'अधिकतम: {max}',
			step: 'चरण: {step}',
		},

		hottext: {
			selected: 'चयनित:',
			selectText: 'परिच्छेद से पाठ चुनें',
		},

		hotspot: {
			selected: 'चयनित:',
			selectArea: 'चित्र पर क्षेत्र चुनें',
		},

		selectPoint: {
			instruction: 'बिंदु चुनने के लिए चित्र पर क्लिक करें',
			maxPointsReached: 'अधिकतम बिंदु सीमा पूर्ण। नया बिंदु जोड़ने के लिए एक बिंदु हटाएं।',
			point: 'बिंदु {index}',
			removePoint: 'बिंदु {index} हटाएं',
		},

		match: {
			// Keyboard instruction for accessible drag-drop
			dragInstruction: 'मिलान करने के लिए Space या Enter दबाएं',
			dropTarget: 'आइटम यहां छोड़ें',
			matchedWith: '{target} के साथ मिलान किया गया',
			available: 'उपलब्ध',
			removeMatch: 'मिलान हटाएं',
		},

		gapMatch: {
			instruction: 'रिक्त स्थान भरने के लिए शब्दों को ड्रैग करें',
			available: 'उपलब्ध शब्द',
			removeWord: 'शब्द हटाएं',
			// {word} will be replaced with the word being removed
			removeFromBlanks: 'रिक्त स्थान से {word} हटाएं',
		},

		graphicGapMatch: {
			instruction: 'चित्र हॉटस्पॉट पर लेबल रखें',
			available: 'उपलब्ध लेबल',
			alreadyPlaced: 'हॉटस्पॉट पर पहले से रखा गया',
			selectedForPlacement: 'स्थापना के लिए चयनित',
			pressSpaceToSelect: 'चुनने के लिए Space दबाएं',
			pressSpaceToPlace: 'लेबल रखने के लिए Space या Enter दबाएं',
			removeLabel: 'लेबल हटाएं',
			removeFromHotspot: 'हॉटस्पॉट से {label} हटाएं',
			hotspot: 'हॉटस्पॉट {number}',
			contains: 'शामिल है: {label}',
		},

		order: {
			instruction: 'पुनः क्रमबद्ध करने के लिए आइटम ड्रैग करें',
			moveUp: 'ऊपर ले जाएं',
			moveDown: 'नीचे ले जाएं',
			position: 'स्थिति {current} में से {total}',
		},

		associate: {
			instruction: 'आइटम के बीच संबंध बनाएं',
			createPair: 'जोड़ी बनाएं',
			removePair: 'जोड़ी हटाएं',
		},

		positionObject: {
			instruction: 'चित्र पर ऑब्जेक्ट ड्रैग करें',
			placeObject: 'चित्र पर {object} रखें',
			removeObject: '{object} हटाएं',
			objectAt: '{object} स्थिति ({x}, {y}) पर',
		},

		endAttempt: {
			buttonLabel: 'प्रयास समाप्त करें',
			ended: 'प्रयास समाप्त',
			requested: 'अनुरोधित',
			warningMessage: 'आपका प्रयास समाप्त कर दिया गया है और अब इसे संशोधित नहीं किया जा सकता।',
			confirmMessage: 'क्या आप वाकई अपना प्रयास समाप्त करना चाहते हैं? आप अपने उत्तर बदलने में सक्षम नहीं होंगे।',
		},

		media: {
			play: 'प्ले करें',
			pause: 'पॉज़ करें',
			volume: 'वॉल्यूम',
			mute: 'म्यूट करें',
			unmute: 'अनम्यूट करें',
			fullscreen: 'फुलस्क्रीन',
			exitFullscreen: 'फुलस्क्रीन से बाहर निकलें',
			playbackSpeed: 'प्लेबैक स्पीड',
			currentTime: '{current} / {duration}',
			loading: 'मीडिया लोड हो रहा है...',
		},
	},

	assessment: {
		title: 'मूल्यांकन',
		loading: 'मूल्यांकन लोड हो रहा है...',
		loadingError: 'मूल्यांकन लोड करने में टाइमआउट। यह मूल्यांकन अमान्य हो सकता है या प्लेयर आरंभ करने में विफल रहा।',
		question: 'प्रश्न {current} में से {total}',
		section: 'खंड {current} में से {total}',

		navigation: {
			previous: 'पिछला',
			next: 'आगे',
			submit: 'सबमिट करें',
			jumpTo: 'प्रश्न {number} पर जाएं',
			sectionMenu: 'खंड मेन्यू',
			progress: 'प्रगति: {percent}%',
		},

		sections: {
			title: 'खंड',
			selectSection: 'खंड चुनें',
		},

		timer: {
			timeRemaining: 'शेष समय: {time}',
			timeElapsed: 'व्यतीत समय: {time}',
			timeUp: 'समय समाप्त!',
		},

		feedback: {
			correct: 'सही',
			incorrect: 'गलत',
			partiallyCorrect: 'आंशिक रूप से सही',
			unanswered: 'अनुत्तरित',
			score: 'स्कोर: {score} / {maxScore}',
			passed: 'उत्तीर्ण',
			failed: 'अनुत्तीर्ण',
		},

		completion: {
			title: 'मूल्यांकन पूर्ण',
			message: 'आपने मूल्यांकन पूर्ण कर लिया है।',
			score: 'आपका स्कोर: {maxScore} में से {score}',
			percentage: 'प्रतिशत: {percent}%',
			viewResults: 'परिणाम देखें',
			exit: 'बाहर निकलें',
		},

		errors: {
			navigationFailed: 'नेविगेशन विफल। कृपया पुनः प्रयास करें।',
			submitFailed: 'मूल्यांकन सबमिट करने में विफल। कृपया पुनः प्रयास करें।',
			loadFailed: 'प्रश्न लोड करने में विफल।',
			saveFailed: 'उत्तर सहेजने में विफल।',
		},
	},

	accessibility: {
		skipToContent: 'सामग्री पर जाएं',
		skipToNavigation: 'नेविगेशन पर जाएं',
		itemBody: 'प्रश्न सामग्री',
		navigationRegion: 'मूल्यांकन नेविगेशन',
		announcement: 'घोषणा',
		newQuestion: 'नया प्रश्न लोड किया गया',
		answerRecorded: 'उत्तर रिकॉर्ड किया गया',
	},
} as const; // 'as const' for strict type inference
