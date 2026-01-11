/**
 * Thai (Thailand) translations
 *
 * Guidelines for translators:
 * - Keep messages concise for UI constraints
 * - Use sentence case for labels, title case for buttons
 * - Maintain consistent terminology across interactions
 * - Variables in {curlyBraces} will be replaced with dynamic values
 *
 * NOTE: Machine translated. Professional review recommended.
 */
export default {
	common: {
		loading: 'กำลังโหลด...',
		error: 'ข้อผิดพลาด',
		success: 'สำเร็จ',
		cancel: 'ยกเลิก',
		confirm: 'ยืนยัน',
		close: 'ปิด',
		save: 'บันทึก',
		delete: 'ลบ',
		edit: 'แก้ไข',
		remove: 'นำออก',
		add: 'เพิ่ม',
		search: 'ค้นหา',
		filter: 'กรอง',
		reset: 'รีเซ็ต',
		clear: 'ล้าง',
		clearAll: 'ล้างทั้งหมด',
		submit: 'ส่ง',
		next: 'ถัดไป',
		previous: 'ก่อนหน้า',
		back: 'ย้อนกลับ',
		continue: 'ดำเนินการต่อ',
		finish: 'เสร็จสิ้น',
		complete: 'เสร็จสมบูรณ์',
		completed: 'เสร็จสมบูรณ์แล้ว',
		status: 'สถานะ',
		required: 'จำเป็น',
		review: 'ตรวจสอบ',
		selected: 'เลือกแล้ว',
		available: 'พร้อมใช้งาน',
		showDetails: 'แสดงรายละเอียด',
		hideDetails: 'ซ่อนรายละเอียด',
		details: 'รายละเอียด',
		deselected: 'ยกเลิกการเลือก {item}',
		selectionCancelled: 'ยกเลิกการเลือก',
		question: 'คำถาม',
		of: 'จาก',
		answered: 'ตอบแล้ว',
		pleaseComplete: 'กรุณาทำการโต้ตอบที่จำเป็นให้เสร็จ',
		submitting: 'กำลังส่ง...',
		submitAnswer: 'ส่งคำตอบ',
		tryAgain: 'ลองอีกครั้ง',
	},

	units: {
		bytes: '{count} ไบต์',
		kilobytes: '{count} KB',
		megabytes: '{count} MB',
		seconds: '{count} วินาที',
		minutes: '{count} นาที',
		hours: '{count} ชั่วโมง',
	},

	// ตัวอย่างรูปแบบพหูพจน์
	// ใช้ i18n.plural('plurals.items', { count: n }) เพื่อเข้าถึงข้อความเหล่านี้
	// หมายเหตุ: ภาษาไทยไม่มีรูปพหูพจน์ แต่เราใช้รูปแบบเดียวกันสำหรับทั้ง one และ other
	plurals: {
		items: {
			one: '{count} รายการ',
			other: '{count} รายการ',
		},
		files: {
			one: 'เลือก {count} ไฟล์',
			other: 'เลือก {count} ไฟล์',
		},
		questions: {
			one: '{count} คำถาม',
			other: '{count} คำถาม',
		},
		answers: {
			one: '{count} คำตอบ',
			other: '{count} คำตอบ',
		},
		choices: {
			one: '{count} ตัวเลือก',
			other: '{count} ตัวเลือก',
		},
		attempts: {
			one: 'เหลือ {count} ครั้ง',
			other: 'เหลือ {count} ครั้ง',
		},
		minutesRemaining: {
			one: 'เหลือ {count} นาที',
			other: 'เหลือ {count} นาที',
		},
		secondsRemaining: {
			one: 'เหลือ {count} วินาที',
			other: 'เหลือ {count} วินาที',
		},
	},

	validation: {
		required: 'ฟิลด์นี้จำเป็นต้องกรอก',
		invalidFormat: 'รูปแบบไม่ถูกต้อง',
		tooShort: 'สั้นเกินไป (ขั้นต่ำ {min} ตัวอักษร)',
		tooLong: 'ยาวเกินไป (สูงสุด {max} ตัวอักษร)',
		outOfRange: 'ค่าต้องอยู่ระหว่าง {min} และ {max}',
	},

	interactions: {
		choice: {
			selectOption: 'เลือกตัวเลือก',
			selectMultiple: 'เลือกทั้งหมดที่ใช้ได้',
			selected: 'เลือกแล้ว',
			notSelected: 'ยังไม่ได้เลือก',
		},

		upload: {
			label: 'อัปโหลดไฟล์',
			selectFile: 'เลือกไฟล์',
			dragDrop: 'หรือลากและวาง',
			allowedTypes: 'ประเภทไฟล์ที่อนุญาต:',
			selectedFile: 'เลือกแล้ว:',
			fileSize: '{size} ไบต์',
			fileSizeKb: '{size} KB',
			fileSizeMb: '{size} MB',
			removeFile: 'ลบไฟล์',
			errorInvalidType: 'ประเภทไฟล์ไม่ได้รับอนุญาต อนุญาต: {types}',
			errorReadFailed: 'อ่านไฟล์ไม่สำเร็จ',
			errorTooLarge: 'ไฟล์ใหญ่เกินไป (สูงสุด {max} MB)',
			unknownType: 'ประเภทไฟล์ไม่รู้จัก',
		},

		drawing: {
			label: 'วาดคำตอบของคุณ',
			clear: 'ล้างภาพวาด',
			undo: 'เลิกทำ',
			redo: 'ทำซ้ำ',
			strokeColor: 'สีของเส้น',
			strokeWidth: 'ความหนาของเส้น',
			tool: 'เครื่องมือ',
			instructions: 'วาดด้วยเมาส์หรือสัมผัส ใช้ปุ่มล้างเพื่อรีเซ็ต',
			canvas: 'แคนวาสวาดภาพ',
			updated: 'อัปเดตภาพวาดแล้ว',
			cleared: 'ล้างภาพวาดแล้ว',
			generated: 'สร้างแล้ว:',
		},

		extendedText: {
			placeholder: 'พิมพ์คำตอบของคุณที่นี่...',
			characterCount: '{count} ตัวอักษร',
			characterLimit: '{count} / {max} ตัวอักษร',
			bold: 'ตัวหนา',
			italic: 'ตัวเอียง',
			underline: 'ขีดเส้นใต้',
			bulletList: 'รายการสัญลักษณ์แสดงหัวข้อย่อย',
			numberedList: 'รายการลำดับเลข',
			insertMath: 'แทรกสมการคณิตศาสตร์',
			insertInlineMath: 'แทรกสมการคณิตศาสตร์แบบอินไลน์',
			insertBlockMath: 'แทรกบล็อกคณิตศาสตร์',
		},

		slider: {
			label: 'แถบเลื่อน',
			selectedValue: 'ค่าที่เลือก: {value}',
			min: 'ต่ำสุด: {min}',
			max: 'สูงสุด: {max}',
			step: 'ขั้น: {step}',
			ariaLabel: 'ค่าแถบเลื่อนจาก {lowerBound} ถึง {upperBound}',
			statTitle: 'ค่าที่เลือก',
		},

		hottext: {
			selected: 'เลือกแล้ว:',
			selectText: 'เลือกข้อความจากข้อความ',
			clearSelection: 'ล้างการเลือก',
			ariaLabel: 'การโต้ตอบการเลือกข้อความ',
		},

		hotspot: {
			selected: 'เลือกแล้ว:',
			selectArea: 'เลือกพื้นที่บนภาพ',
			ariaLabel: 'การโต้ตอบฮอตสปอต',
			altText: 'การโต้ตอบฮอตสปอต',
		},

		selectPoint: {
			instruction: 'คลิกที่ภาพเพื่อเลือกจุด',
			instructionAria: 'คลิกเพื่อเลือกจุดบนภาพ',
			maxPointsReached: 'ถึงจำนวนจุดสูงสุดแล้ว ลบจุดเพื่อเพิ่มจุดใหม่',
			point: 'จุด {index}',
			removePoint: 'ลบจุด {index}',
			removePointTitle: 'คลิกเพื่อลบจุดนี้',
			removePointAt: 'ลบจุด {index} ที่พิกัด {x}, {y}',
			removePointAtTitle: 'คลิกเพื่อลบจุดนี้ ({x}, {y})',
			canvas: 'แคนวาสเลือก',
			noImage: 'ไม่มีภาพที่ให้',
			pointsSelected: 'จุดที่เลือก:',
			minimumMet: '✓ ถึงขั้นต่ำแล้ว',
			selectAtLeast: 'เลือกอย่างน้อย {minChoices}',
		},

		match: {
			keyboardInstructions: 'กด Space หรือ Enter เพื่อเลือกรายการต้นทาง กด Tab เพื่อนำทางไปยังเป้าหมาย กด Space หรือ Enter บนเป้าหมายเพื่อสร้างการจับคู่ กด Escape เพื่อยกเลิกการเลือก',
			dragInstruction: 'กด Space หรือ Enter เพื่อจับคู่',
			dropTarget: 'วางรายการที่นี่',
			matchedWith: 'จับคู่กับ {target}',
			selectedForMatching: 'เลือกเพื่อจับคู่',
			available: 'พร้อมใช้งาน',
			availableForMatching: 'พร้อมสำหรับการจับคู่',
			removeMatch: 'ลบการจับคู่',
			clearMatch: 'ล้างการจับคู่สำหรับ {source}',
			sourceItemsLabel: 'รายการต้นทางที่จะจับคู่',
			targetItemsLabel: 'รายการเป้าหมายสำหรับการจับคู่',
		},

		gapMatch: {
			instruction: 'ลากคำเพื่อเติมช่องว่าง',
			available: 'คำที่พร้อมใช้งาน',
			availableLabel: 'คำที่พร้อมวาง',
			availableHeading: 'คำที่พร้อมใช้งาน:',
			removeWord: 'ลบคำ',
			removeFromBlanks: 'ลบ {word} จากช่องว่าง',
		},

		graphicGapMatch: {
			instruction: 'วางป้ายกำกับบนฮอตสปอตของภาพ',
			keyboardInstructions: 'กด Space หรือ Enter เพื่อเลือกป้ายกำกับ กด Tab เพื่อนำทางไปยังฮอตสปอตบนภาพ กด Space หรือ Enter บนฮอตสปอตเพื่อวางป้ายกำกับ กด Escape เพื่อยกเลิกการเลือก',
			available: 'ป้ายกำกับที่พร้อมใช้งาน',
			availableLabel: 'ป้ายกำกับที่พร้อมวาง',
			availableHeading: 'ป้ายกำกับที่พร้อมใช้งาน:',
			alreadyPlaced: 'วางบนฮอตสปอตแล้ว',
			selectedForPlacement: 'เลือกเพื่อวาง',
			pressSpaceToSelect: 'กด Space เพื่อเลือก',
			pressSpaceToPlace: 'กด Space หรือ Enter เพื่อวางป้ายกำกับ',
			removeLabel: 'ลบป้ายกำกับ',
			removeFromHotspot: 'ลบ {label} จากฮอตสปอต',
			hotspot: 'ฮอตสปอต {number}',
			contains: 'มี: {label}',
		},

		order: {
			instruction: 'ลากรายการเพื่อจัดเรียงใหม่',
			keyboardInstructions: 'กด Space หรือ Enter เพื่อจับรายการ ใช้ปุ่มลูกศรเพื่อย้ายรายการ กด Space หรือ Enter อีกครั้งเพื่อวาง กด Escape เพื่อยกเลิก',
			grabbed: 'จับแล้ว ใช้ปุ่มลูกศรเพื่อย้าย',
			moveUp: 'เลื่อนขึ้น',
			moveDown: 'เลื่อนลง',
			position: 'ตำแหน่ง {current} จาก {total}',
			listLabel: 'รายการตัวเลือกที่จัดเรียงใหม่ได้',
			confirmOrder: 'ยืนยันลำดับ',
			confirmOrderNoChanges: 'ยืนยันลำดับ (ไม่มีการเปลี่ยนแปลง)',
			confirmAria: 'ยืนยันลำดับนี้เป็นคำตอบของคุณ',
		},

		associate: {
			instruction: 'สร้างความสัมพันธ์ระหว่างรายการ',
			createPair: 'สร้างคู่',
			removePair: 'ลบคู่',
			removeAssociation: 'ลบความสัมพันธ์',
			diagramLabel: 'แผนภาพความสัมพันธ์',
			altText: 'แผนภาพความสัมพันธ์',
			hotspotConnections: '{label} ({usageCount}/{matchMax} การเชื่อมต่อ)',
			selectAnother: 'เลือกแล้ว: <strong>{label}</strong> คลิกอันอื่น',
			minimumRequired: 'จำเป็นขั้นต่ำ: {minAssociations}',
		},

		positionObject: {
			instruction: 'ลากวัตถุบนภาพ',
			placeObject: 'วาง {object} บนภาพ',
			removeObject: 'ลบ {object}',
			objectAt: '{object} ที่ตำแหน่ง ({x}, {y})',
			canvasLabel: 'แคนวาสการวางตำแหน่ง',
			backgroundAlt: 'พื้นหลังการวางตำแหน่ง',
			positioned: 'วาง {label} ที่ ({x}, {y})',
			minimumRequired: 'จำเป็นขั้นต่ำ: {minChoices}',
			maximumAllowed: 'สูงสุด: {maxChoices}',
			availableObjects: 'วัตถุที่พร้อมใช้งาน',
			objectUsage: '{label} ({usageCount}/{matchMax} ใช้แล้ว)',
		},

		endAttempt: {
			buttonLabel: 'สิ้นสุดการพยายาม',
			ended: 'การพยายามสิ้นสุดแล้ว',
			requested: 'ร้องขอแล้ว',
			warningMessage: 'การพยายามของคุณสิ้นสุดแล้วและไม่สามารถแก้ไขได้อีก',
			confirmMessage: 'คุณแน่ใจหรือไม่ว่าต้องการสิ้นสุดการพยายาม? คุณจะไม่สามารถเปลี่ยนคำตอบได้',
		},

		media: {
			play: 'เล่น',
			pause: 'หยุดชั่วคราว',
			volume: 'ระดับเสียง',
			mute: 'ปิดเสียง',
			unmute: 'เปิดเสียง',
			fullscreen: 'เต็มหน้าจอ',
			exitFullscreen: 'ออกจากเต็มหน้าจอ',
			playbackSpeed: 'ความเร็วการเล่น',
			currentTime: '{current} / {duration}',
			loading: 'กำลังโหลดสื่อ...',
			ariaLabel: 'เนื้อหาสื่อ',
			maxPlayLimitReached: 'ถึงขีดจำกัดการเล่นสูงสุดแล้ว',
		},

		graphicOrder: {
			instruction: 'คลิกฮอตสปอตเพื่อจัดเรียง',
			diagramLabel: 'แผนภาพการจัดเรียง',
			altText: 'แผนภาพการจัดเรียง',
			itemLabel: 'รายการ {index}: {label}',
			confirmOrder: 'ยืนยันลำดับ',
			confirmOrderNoChanges: 'ยืนยันลำดับ (ไม่มีการเปลี่ยนแปลง)',
			confirmAria: 'ยืนยันลำดับนี้เป็นคำตอบของคุณ',
		},

		custom: {
			fallbackPlaceholder: 'ป้อนคำตอบด้วยตนเอง (สำรอง)',
		},

		inline: {
			placeholder: '...',
		},
	},

	item: {
		loading: 'กำลังโหลดรายการ...',
		loadingError: 'โหลดรายการไม่สำเร็จ',
		loadError: 'ข้อผิดพลาดในการโหลดรายการ: {error}',
		parsingError: 'แยกวิเคราะห์ QTI XML ไม่สำเร็จ',
		processingError: 'ประมวลผลคำตอบไม่สำเร็จ',
		submit: 'ส่ง',
		complete: 'เสร็จสมบูรณ์',
		completed: 'เสร็จสมบูรณ์แล้ว',
		attempt: 'ความพยายาม {numAttempts}',
	},

	itemSession: {
		attempt: 'ความพยายาม {numAttempts}',
		attemptsRemaining: 'เหลือ {attemptsRemaining} ความพยายาม',
		maxAttempts: 'ความพยายามสูงสุด: {maxAttempts}',
	},

	feedback: {
		close: 'ปิดคำติชม',
		closeFeedback: 'ละเว้นคำติชม',
		testFeedback: 'คำติชมการทดสอบ',
	},

	assessment: {
		title: 'การประเมิน',
		loading: 'กำลังโหลดการประเมิน...',
		loadingError: 'หมดเวลาการโหลดการประเมิน การประเมินนี้อาจไม่ถูกต้องหรือเครื่องเล่นไม่สามารถเริ่มต้นได้',
		question: 'คำถาม {current} จาก {total}',
		questionAnnouncement: 'คำถาม {current} จาก {total}',
		section: 'ส่วนที่ {current} จาก {total}',
		closeMenu: 'ปิดเมนู',

		attempts: {
			remaining: 'เหลือ {count} ความพยายาม',
			oneRemaining: 'เหลือ 1 ความพยายาม',
			noRemaining: 'ไม่เหลือความพยายาม (ใช้ไป {count})',
			used: 'ความพยายาม: {count}',
			maxReached: 'ถึงความพยายามสูงสุดแล้ว',
			required: 'ต้องตอบก่อนดำเนินการต่อ',
			reviewNotAllowed: 'ไม่อนุญาตเมื่อส่งแล้ว',
		},

		navigation: {
			previous: 'ก่อนหน้า',
			next: 'ถัดไป',
			submit: 'ส่ง',
			jumpTo: 'ข้ามไปที่คำถาม {number}',
			sectionMenu: 'เมนูส่วน',
			progress: 'ความคืบหน้า: {percent}%',
		},

		sections: {
			title: 'ส่วนต่างๆ',
			selectSection: 'เลือกส่วน',
		},

		timer: {
			timeRemaining: 'เวลาที่เหลือ: {time}',
			timeElapsed: 'เวลาที่ผ่านไป: {time}',
			timeUp: 'หมดเวลา!',
		},

		feedback: {
			correct: 'ถูกต้อง',
			incorrect: 'ไม่ถูกต้อง',
			partiallyCorrect: 'ถูกต้องบางส่วน',
			unanswered: 'ไม่ได้ตอบ',
			score: 'คะแนน: {score} / {maxScore}',
			passed: 'ผ่าน',
			failed: 'ไม่ผ่าน',
		},

		completion: {
			title: 'การประเมินเสร็จสมบูรณ์',
			message: 'คุณเสร็จสิ้นการประเมินแล้ว',
			score: 'คะแนนของคุณ: {score} จาก {maxScore}',
			percentage: 'เปอร์เซ็นต์: {percent}%',
			viewResults: 'ดูผลลัพธ์',
			exit: 'ออก',
		},

		errors: {
			navigationFailed: 'การนำทางล้มเหลว โปรดลองอีกครั้ง',
			submitFailed: 'ส่งการประเมินไม่สำเร็จ โปรดลองอีกครั้ง',
			loadFailed: 'โหลดคำถามไม่สำเร็จ',
			saveFailed: 'บันทึกคำตอบไม่สำเร็จ',
		},
	},

	i18n: {
		selectLanguage: 'ภาษา',
		selectLanguageAriaLabel: 'เลือกภาษาที่ใช้แสดง',
	},

	accessibility: {
		skipToContent: 'ข้ามไปยังเนื้อหา',
		skipToNavigation: 'ข้ามไปยังการนำทาง',
		itemBody: 'เนื้อหาคำถาม',
		navigationRegion: 'การนำทางการประเมิน',
		announcement: 'ประกาศ',
		newQuestion: 'โหลดคำถามใหม่แล้ว',
		answerRecorded: 'บันทึกคำตอบแล้ว',
		resizer: 'ปรับขนาดแผงข้อความและคำถาม',
	},
} as const; // 'as const' for strict type inference
