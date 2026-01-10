/**
 * Arabic (Saudi Arabia) translations
 *
 * Guidelines for translators:
 * - Keep messages concise for UI constraints
 * - Use sentence case for labels, title case for buttons
 * - Maintain consistent terminology across interactions
 * - Variables in {curlyBraces} will be replaced with dynamic values
 * - Text is stored in LTR order; RTL rendering is handled by CSS
 */
export default {
	common: {
		loading: 'جارٍ التحميل...',
		error: 'خطأ',
		success: 'نجح',
		cancel: 'إلغاء',
		confirm: 'تأكيد',
		close: 'إغلاق',
		save: 'حفظ',
		delete: 'حذف',
		edit: 'تعديل',
		remove: 'إزالة',
		add: 'إضافة',
		search: 'بحث',
		filter: 'تصفية',
		reset: 'إعادة تعيين',
		submit: 'إرسال',
		next: 'التالي',
		previous: 'السابق',
		back: 'رجوع',
		continue: 'متابعة',
		finish: 'إنهاء',
	},

	units: {
		bytes: '{count} بايت',
		kilobytes: '{count} كيلوبايت',
		megabytes: '{count} ميجابايت',
		seconds: '{count} ثانية',
		minutes: '{count} دقيقة',
		hours: '{count} ساعة',
	},

	validation: {
		required: 'هذا الحقل مطلوب',
		invalidFormat: 'تنسيق غير صالح',
		tooShort: 'قصير جداً (الحد الأدنى {min} حرف)',
		tooLong: 'طويل جداً (الحد الأقصى {max} حرف)',
		outOfRange: 'يجب أن تكون القيمة بين {min} و {max}',
	},

	interactions: {
		choice: {
			selectOption: 'اختر خياراً',
			selectMultiple: 'اختر جميع ما ينطبق',
			selected: 'محدد',
			notSelected: 'غير محدد',
		},

		upload: {
			// Shown as label above file input
			label: 'رفع ملف',
			selectFile: 'اختيار ملف',
			dragDrop: 'أو السحب والإفلات',

			// Displayed before list of allowed file types
			allowedTypes: 'أنواع الملفات المسموح بها:',

			// Displayed when file is selected
			selectedFile: 'محدد:',

			// File size display - {size} will be replaced with numeric value
			fileSize: '{size} بايت',
			fileSizeKb: '{size} كيلوبايت',
			fileSizeMb: '{size} ميجابايت',

			removeFile: 'إزالة الملف',

			// Error shown when file type validation fails
			// {types} will be replaced with comma-separated list of allowed types
			errorInvalidType: 'نوع الملف غير مسموح به. المسموح: {types}',
			errorReadFailed: 'فشل في قراءة الملف',

			// {max} will be replaced with maximum size in MB
			errorTooLarge: 'الملف كبير جداً (الحد الأقصى {max} ميجابايت)',
			unknownType: 'نوع ملف غير معروف',
		},

		drawing: {
			label: 'ارسم إجابتك',
			clear: 'مسح الرسم',
			undo: 'تراجع',
			redo: 'إعادة',
			strokeColor: 'لون الخط',
			strokeWidth: 'عرض الخط',
			tool: 'أداة',
		},

		extendedText: {
			placeholder: 'اكتب إجابتك هنا...',
			characterCount: '{count} حرف',
			characterLimit: '{count} / {max} حرف',
			bold: 'عريض',
			italic: 'مائل',
			underline: 'تسطير',
			bulletList: 'قائمة نقطية',
			numberedList: 'قائمة مرقمة',
			insertMath: 'إدراج معادلة رياضية',
		},

		slider: {
			label: 'شريط التمرير',
			selectedValue: 'القيمة المحددة: {value}',
			min: 'الحد الأدنى: {min}',
			max: 'الحد الأقصى: {max}',
			step: 'الخطوة: {step}',
		},

		hottext: {
			selected: 'محدد:',
			selectText: 'اختر نصاً من المقطع',
		},

		hotspot: {
			selected: 'محدد:',
			selectArea: 'اختر مناطق على الصورة',
		},

		selectPoint: {
			instruction: 'انقر على الصورة لاختيار نقاط',
			maxPointsReached: 'تم الوصول إلى الحد الأقصى للنقاط. قم بإزالة نقطة لإضافة نقطة جديدة.',
			point: 'نقطة {index}',
			removePoint: 'إزالة نقطة {index}',
		},

		match: {
			// Keyboard instruction for accessible drag-drop
			dragInstruction: 'اضغط على مسافة أو Enter للمطابقة',
			dropTarget: 'ضع العنصر هنا',
			matchedWith: 'مطابق مع {target}',
			available: 'متاح',
			removeMatch: 'إزالة المطابقة',
		},

		gapMatch: {
			instruction: 'اسحب الكلمات لملء الفراغات',
			available: 'الكلمات المتاحة',
			removeWord: 'إزالة الكلمة',
			// {word} will be replaced with the word being removed
			removeFromBlanks: 'إزالة {word} من الفراغات',
		},

		graphicGapMatch: {
			instruction: 'ضع التسميات على النقاط الساخنة للصورة',
			available: 'التسميات المتاحة',
			alreadyPlaced: 'موضوعة بالفعل على نقطة ساخنة',
			selectedForPlacement: 'محددة للوضع',
			pressSpaceToSelect: 'اضغط على مسافة للاختيار',
			pressSpaceToPlace: 'اضغط على مسافة أو Enter لوضع التسمية',
			removeLabel: 'إزالة التسمية',
			removeFromHotspot: 'إزالة {label} من النقطة الساخنة',
			hotspot: 'نقطة ساخنة {number}',
			contains: 'يحتوي على: {label}',
		},

		order: {
			instruction: 'اسحب العناصر لإعادة ترتيبها',
			moveUp: 'نقل لأعلى',
			moveDown: 'نقل لأسفل',
			position: 'الموضع {current} من {total}',
		},

		associate: {
			instruction: 'إنشاء ارتباطات بين العناصر',
			createPair: 'إنشاء زوج',
			removePair: 'إزالة زوج',
		},

		positionObject: {
			instruction: 'اسحب الكائنات إلى الصورة',
			placeObject: 'ضع {object} على الصورة',
			removeObject: 'إزالة {object}',
			objectAt: '{object} في الموضع ({x}, {y})',
		},

		endAttempt: {
			buttonLabel: 'إنهاء المحاولة',
			ended: 'انتهت المحاولة',
			requested: 'مطلوب',
			warningMessage: 'انتهت محاولتك ولا يمكن تعديلها بعد الآن.',
			confirmMessage: 'هل أنت متأكد من أنك تريد إنهاء محاولتك؟ لن تتمكن من تغيير إجاباتك.',
		},

		media: {
			play: 'تشغيل',
			pause: 'إيقاف مؤقت',
			volume: 'مستوى الصوت',
			mute: 'كتم الصوت',
			unmute: 'إلغاء كتم الصوت',
			fullscreen: 'ملء الشاشة',
			exitFullscreen: 'الخروج من ملء الشاشة',
			playbackSpeed: 'سرعة التشغيل',
			currentTime: '{current} / {duration}',
			loading: 'جارٍ تحميل الوسائط...',
		},
	},

	assessment: {
		title: 'التقييم',
		loading: 'جارٍ تحميل التقييم...',
		loadingError: 'انتهت مهلة تحميل التقييم. قد يكون هذا التقييم غير صالح أو فشل المشغل في التهيئة.',
		question: 'السؤال {current} من {total}',
		section: 'القسم {current} من {total}',

		navigation: {
			previous: 'السابق',
			next: 'التالي',
			submit: 'إرسال',
			jumpTo: 'الانتقال إلى السؤال {number}',
			sectionMenu: 'قائمة الأقسام',
			progress: 'التقدم: {percent}%',
		},

		sections: {
			title: 'الأقسام',
			selectSection: 'اختر القسم',
		},

		timer: {
			timeRemaining: 'الوقت المتبقي: {time}',
			timeElapsed: 'الوقت المنقضي: {time}',
			timeUp: 'انتهى الوقت!',
		},

		feedback: {
			correct: 'صحيح',
			incorrect: 'غير صحيح',
			partiallyCorrect: 'صحيح جزئياً',
			unanswered: 'لم تتم الإجابة',
			score: 'النتيجة: {score} / {maxScore}',
			passed: 'نجح',
			failed: 'رسب',
		},

		completion: {
			title: 'اكتمل التقييم',
			message: 'لقد أكملت التقييم.',
			score: 'نتيجتك: {score} من {maxScore}',
			percentage: 'النسبة المئوية: {percent}%',
			viewResults: 'عرض النتائج',
			exit: 'خروج',
		},

		errors: {
			navigationFailed: 'فشل التنقل. حاول مرة أخرى.',
			submitFailed: 'فشل إرسال التقييم. حاول مرة أخرى.',
			loadFailed: 'فشل تحميل السؤال.',
			saveFailed: 'فشل حفظ الإجابة.',
		},
	},

	accessibility: {
		skipToContent: 'الانتقال إلى المحتوى',
		skipToNavigation: 'الانتقال إلى التنقل',
		itemBody: 'محتوى السؤال',
		navigationRegion: 'التنقل في التقييم',
		announcement: 'إعلان',
		newQuestion: 'تم تحميل سؤال جديد',
		answerRecorded: 'تم تسجيل الإجابة',
	},
} as const; // 'as const' for strict type inference
