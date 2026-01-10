/**
 * Thai (Thailand) translations
 *
 * Guidelines for translators:
 * - Keep messages concise for UI constraints
 * - Use sentence case for labels, title case for buttons
 * - Maintain consistent terminology across interactions
 * - Variables in {curlyBraces} will be replaced with dynamic values
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
		submit: 'ส่ง',
		next: 'ถัดไป',
		previous: 'ก่อนหน้า',
		back: 'ย้อนกลับ',
		continue: 'ดำเนินการต่อ',
		finish: 'เสร็จสิ้น',
	},

	units: {
		bytes: '{count} ไบต์',
		kilobytes: '{count} KB',
		megabytes: '{count} MB',
		seconds: '{count} วินาที',
		minutes: '{count} นาที',
		hours: '{count} ชั่วโมง',
	},

	validation: {
		required: 'ฟิลด์นี้จำเป็นต้องกรอก',
		invalidFormat: 'รูปแบบไม่ถูกต้อง',
		tooShort: 'สั้นเกินไป (อย่างน้อย {min} ตัวอักษร)',
		tooLong: 'ยาวเกินไป (ไม่เกิน {max} ตัวอักษร)',
		outOfRange: 'ค่าต้องอยู่ระหว่าง {min} ถึง {max}',
	},

	interactions: {
		choice: {
			selectOption: 'เลือกตัวเลือก',
			selectMultiple: 'เลือกทั้งหมดที่ใช้ได้',
			selected: 'เลือกแล้ว',
			notSelected: 'ยังไม่ได้เลือก',
		},

		upload: {
			// Shown as label above file input
			label: 'อัปโหลดไฟล์',
			selectFile: 'เลือกไฟล์',
			dragDrop: 'หรือลากและวาง',

			// Displayed before list of allowed file types
			allowedTypes: 'ประเภทไฟล์ที่อนุญาต:',

			// Displayed when file is selected
			selectedFile: 'เลือกแล้ว:',

			// File size display - {size} will be replaced with numeric value
			fileSize: '{size} ไบต์',
			fileSizeKb: '{size} KB',
			fileSizeMb: '{size} MB',

			removeFile: 'ลบไฟล์',

			// Error shown when file type validation fails
			// {types} will be replaced with comma-separated list of allowed types
			errorInvalidType: 'ไม่อนุญาตประเภทไฟล์นี้ อนุญาต: {types}',
			errorReadFailed: 'ไม่สามารถอ่านไฟล์ได้',

			// {max} will be replaced with maximum size in MB
			errorTooLarge: 'ไฟล์ใหญ่เกินไป (ไม่เกิน {max} MB)',
			unknownType: 'ประเภทไฟล์ไม่ทราบ',
		},

		drawing: {
			label: 'วาดคำตอบของคุณ',
			clear: 'ล้างภาพวาด',
			undo: 'ยกเลิก',
			redo: 'ทำซ้ำ',
			strokeColor: 'สีเส้น',
			strokeWidth: 'ความหนาของเส้น',
			tool: 'เครื่องมือ',
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
		},

		slider: {
			label: 'แถบเลื่อน',
			selectedValue: 'ค่าที่เลือก: {value}',
			min: 'ค่าต่ำสุด: {min}',
			max: 'ค่าสูงสุด: {max}',
			step: 'ขั้น: {step}',
		},

		hottext: {
			selected: 'เลือกแล้ว:',
			selectText: 'เลือกข้อความจากข้อความ',
		},

		hotspot: {
			selected: 'เลือกแล้ว:',
			selectArea: 'เลือกพื้นที่บนภาพ',
		},

		selectPoint: {
			instruction: 'คลิกบนภาพเพื่อเลือกจุด',
			maxPointsReached: 'ถึงจำนวนจุดสูงสุดแล้ว ลบจุดเพื่อเพิ่มจุดใหม่',
			point: 'จุดที่ {index}',
			removePoint: 'ลบจุดที่ {index}',
		},

		match: {
			// Keyboard instruction for accessible drag-drop
			dragInstruction: 'กด Space หรือ Enter เพื่อจับคู่',
			dropTarget: 'วางรายการที่นี่',
			matchedWith: 'จับคู่กับ {target}',
			available: 'ที่มีอยู่',
			removeMatch: 'ลบการจับคู่',
		},

		gapMatch: {
			instruction: 'ลากคำเพื่อเติมในช่องว่าง',
			available: 'คำที่มีอยู่',
			removeWord: 'ลบคำ',
			// {word} will be replaced with the word being removed
			removeFromBlanks: 'ลบ {word} จากช่องว่าง',
		},

		graphicGapMatch: {
			instruction: 'วางป้ายกำกับบนจุดเด่นของภาพ',
			available: 'ป้ายกำกับที่มีอยู่',
			alreadyPlaced: 'วางบนจุดเด่นแล้ว',
			selectedForPlacement: 'เลือกสำหรับการวาง',
			pressSpaceToSelect: 'กด Space เพื่อเลือก',
			pressSpaceToPlace: 'กด Space หรือ Enter เพื่อวางป้ายกำกับ',
			removeLabel: 'ลบป้ายกำกับ',
			removeFromHotspot: 'ลบ {label} จากจุดเด่น',
			hotspot: 'จุดเด่น {number}',
			contains: 'ประกอบด้วย: {label}',
		},

		order: {
			instruction: 'ลากรายการเพื่อเรียงลำดับใหม่',
			moveUp: 'เลื่อนขึ้น',
			moveDown: 'เลื่อนลง',
			position: 'ตำแหน่ง {current} จาก {total}',
		},

		associate: {
			instruction: 'สร้างความสัมพันธ์ระหว่างรายการ',
			createPair: 'สร้างคู่',
			removePair: 'ลบคู่',
		},

		positionObject: {
			instruction: 'ลากวัตถุลงบนภาพ',
			placeObject: 'วาง {object} บนภาพ',
			removeObject: 'ลบ {object}',
			objectAt: '{object} ที่ตำแหน่ง ({x}, {y})',
		},

		endAttempt: {
			buttonLabel: 'สิ้นสุดการพยายาม',
			ended: 'สิ้นสุดการพยายามแล้ว',
			requested: 'ร้องขอแล้ว',
			warningMessage: 'การพยายามของคุณสิ้นสุดแล้วและไม่สามารถแก้ไขได้อีก',
			confirmMessage: 'คุณแน่ใจหรือไม่ว่าต้องการสิ้นสุดการพยายามของคุณ? คุณจะไม่สามารถเปลี่ยนคำตอบของคุณได้',
		},

		media: {
			play: 'เล่น',
			pause: 'หยุดชั่วคราว',
			volume: 'ระดับเสียง',
			mute: 'ปิดเสียง',
			unmute: 'เปิดเสียง',
			fullscreen: 'เต็มหน้าจอ',
			exitFullscreen: 'ออกจากเต็มหน้าจอ',
			playbackSpeed: 'ความเร็วในการเล่น',
			currentTime: '{current} / {duration}',
			loading: 'กำลังโหลดสื่อ...',
		},
	},

	assessment: {
		title: 'การประเมิน',
		loading: 'กำลังโหลดการประเมิน...',
		loadingError: 'หมดเวลาในการโหลดการประเมิน การประเมินนี้อาจไม่ถูกต้องหรือตัวเล่นล้มเหลวในการเริ่มต้น',
		question: 'คำถามที่ {current} จาก {total}',
		section: 'ส่วนที่ {current} จาก {total}',

		navigation: {
			previous: 'ก่อนหน้า',
			next: 'ถัดไป',
			submit: 'ส่ง',
			jumpTo: 'ข้ามไปยังคำถามที่ {number}',
			sectionMenu: 'เมนูส่วน',
			progress: 'ความคืบหน้า: {percent}%',
		},

		sections: {
			title: 'ส่วน',
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
			unanswered: 'ยังไม่ตอบ',
			score: 'คะแนน: {score} / {maxScore}',
			passed: 'ผ่าน',
			failed: 'ไม่ผ่าน',
		},

		completion: {
			title: 'การประเมินเสร็จสมบูรณ์',
			message: 'คุณทำการประเมินเสร็จสิ้นแล้ว',
			score: 'คะแนนของคุณ: {score} จาก {maxScore}',
			percentage: 'เปอร์เซ็นต์: {percent}%',
			viewResults: 'ดูผลลัพธ์',
			exit: 'ออก',
		},

		errors: {
			navigationFailed: 'การนำทางล้มเหลว โปรดลองอีกครั้ง',
			submitFailed: 'ไม่สามารถส่งการประเมินได้ โปรดลองอีกครั้ง',
			loadFailed: 'ไม่สามารถโหลดคำถามได้',
			saveFailed: 'ไม่สามารถบันทึกคำตอบได้',
		},
	},

	accessibility: {
		skipToContent: 'ข้ามไปยังเนื้อหา',
		skipToNavigation: 'ข้ามไปยังการนำทาง',
		itemBody: 'เนื้อหาคำถาม',
		navigationRegion: 'การนำทางการประเมิน',
		announcement: 'ประกาศ',
		newQuestion: 'โหลดคำถามใหม่แล้ว',
		answerRecorded: 'บันทึกคำตอบแล้ว',
	},
} as const; // 'as const' for strict type inference
