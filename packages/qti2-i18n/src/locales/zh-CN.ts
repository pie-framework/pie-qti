/**
 * Chinese Simplified (China) translations
 *
 * Guidelines for translators:
 * - Keep messages concise for UI constraints
 * - Use sentence case for labels, title case for buttons
 * - Maintain consistent terminology across interactions
 * - Variables in {curlyBraces} will be replaced with dynamic values
 */
export default {
	common: {
		loading: '加载中...',
		error: '错误',
		success: '成功',
		cancel: '取消',
		confirm: '确认',
		close: '关闭',
		save: '保存',
		delete: '删除',
		edit: '编辑',
		remove: '移除',
		add: '添加',
		search: '搜索',
		filter: '筛选',
		reset: '重置',
		submit: '提交',
		next: '下一个',
		previous: '上一个',
		back: '返回',
		continue: '继续',
		finish: '完成',
	},

	units: {
		bytes: '{count} 字节',
		kilobytes: '{count} KB',
		megabytes: '{count} MB',
		seconds: '{count} 秒',
		minutes: '{count} 分钟',
		hours: '{count} 小时',
	},

	validation: {
		required: '此字段为必填项',
		invalidFormat: '格式无效',
		tooShort: '太短（至少 {min} 个字符）',
		tooLong: '太长（最多 {max} 个字符）',
		outOfRange: '值必须在 {min} 和 {max} 之间',
	},

	interactions: {
		choice: {
			selectOption: '选择一个选项',
			selectMultiple: '选择所有适用的',
			selected: '已选择',
			notSelected: '未选择',
		},

		upload: {
			// Shown as label above file input
			label: '上传文件',
			selectFile: '选择文件',
			dragDrop: '或拖放',

			// Displayed before list of allowed file types
			allowedTypes: '允许的文件类型：',

			// Displayed when file is selected
			selectedFile: '已选择：',

			// File size display - {size} will be replaced with numeric value
			fileSize: '{size} 字节',
			fileSizeKb: '{size} KB',
			fileSizeMb: '{size} MB',

			removeFile: '删除文件',

			// Error shown when file type validation fails
			// {types} will be replaced with comma-separated list of allowed types
			errorInvalidType: '不允许的文件类型。允许的类型：{types}',
			errorReadFailed: '读取文件失败',

			// {max} will be replaced with maximum size in MB
			errorTooLarge: '文件太大（最大 {max} MB）',
			unknownType: '未知文件类型',
		},

		drawing: {
			label: '绘制您的答案',
			clear: '清除绘图',
			undo: '撤销',
			redo: '重做',
			strokeColor: '线条颜色',
			strokeWidth: '线条宽度',
			tool: '工具',
		},

		extendedText: {
			placeholder: '在此输入您的答案...',
			characterCount: '{count} 个字符',
			characterLimit: '{count} / {max} 个字符',
			bold: '粗体',
			italic: '斜体',
			underline: '下划线',
			bulletList: '项目符号列表',
			numberedList: '编号列表',
			insertMath: '插入数学公式',
		},

		slider: {
			label: '滑块',
			selectedValue: '选择的值：{value}',
			min: '最小值：{min}',
			max: '最大值：{max}',
			step: '步长：{step}',
		},

		hottext: {
			selected: '已选择：',
			selectText: '从段落中选择文本',
		},

		hotspot: {
			selected: '已选择：',
			selectArea: '在图像上选择区域',
		},

		selectPoint: {
			instruction: '单击图像以选择点',
			maxPointsReached: '已达到最大点数。删除一个点以添加新点。',
			point: '点 {index}',
			removePoint: '删除点 {index}',
		},

		match: {
			// Keyboard instruction for accessible drag-drop
			dragInstruction: '按空格键或回车键进行匹配',
			dropTarget: '在此处放置项目',
			matchedWith: '与 {target} 匹配',
			available: '可用',
			removeMatch: '删除匹配',
		},

		gapMatch: {
			instruction: '拖动单词以填空',
			available: '可用单词',
			removeWord: '删除单词',
			// {word} will be replaced with the word being removed
			removeFromBlanks: '从空白处删除 {word}',
		},

		graphicGapMatch: {
			instruction: '在图像热点上放置标签',
			available: '可用标签',
			alreadyPlaced: '已放置在热点上',
			selectedForPlacement: '已选择放置',
			pressSpaceToSelect: '按空格键选择',
			pressSpaceToPlace: '按空格键或回车键放置标签',
			removeLabel: '删除标签',
			removeFromHotspot: '从热点删除 {label}',
			hotspot: '热点 {number}',
			contains: '包含：{label}',
		},

		order: {
			instruction: '拖动项目以重新排序',
			moveUp: '上移',
			moveDown: '下移',
			position: '位置 {current}，共 {total}',
		},

		associate: {
			instruction: '在项目之间创建关联',
			createPair: '创建配对',
			removePair: '删除配对',
		},

		positionObject: {
			instruction: '将对象拖到图像上',
			placeObject: '将 {object} 放置在图像上',
			removeObject: '删除 {object}',
			objectAt: '{object} 位于 ({x}, {y})',
		},

		endAttempt: {
			buttonLabel: '结束尝试',
			ended: '尝试已结束',
			requested: '已请求',
			warningMessage: '您的尝试已结束，无法再进行修改。',
			confirmMessage: '您确定要结束尝试吗？您将无法更改您的答案。',
		},

		media: {
			play: '播放',
			pause: '暂停',
			volume: '音量',
			mute: '静音',
			unmute: '取消静音',
			fullscreen: '全屏',
			exitFullscreen: '退出全屏',
			playbackSpeed: '播放速度',
			currentTime: '{current} / {duration}',
			loading: '加载媒体...',
		},
	},

	assessment: {
		title: '评估',
		loading: '加载评估...',
		loadingError: '加载评估超时。此评估可能无效或播放器初始化失败。',
		question: '问题 {current}，共 {total}',
		section: '部分 {current}，共 {total}',

		navigation: {
			previous: '上一个',
			next: '下一个',
			submit: '提交',
			jumpTo: '跳转到问题 {number}',
			sectionMenu: '部分菜单',
			progress: '进度：{percent}%',
		},

		sections: {
			title: '部分',
			selectSection: '选择部分',
		},

		timer: {
			timeRemaining: '剩余时间：{time}',
			timeElapsed: '已用时间：{time}',
			timeUp: '时间到！',
		},

		feedback: {
			correct: '正确',
			incorrect: '不正确',
			partiallyCorrect: '部分正确',
			unanswered: '未回答',
			score: '分数：{score} / {maxScore}',
			passed: '通过',
			failed: '未通过',
		},

		completion: {
			title: '评估完成',
			message: '您已完成评估。',
			score: '您的分数：{score} / {maxScore}',
			percentage: '百分比：{percent}%',
			viewResults: '查看结果',
			exit: '退出',
		},

		errors: {
			navigationFailed: '导航失败。请重试。',
			submitFailed: '提交评估失败。请重试。',
			loadFailed: '加载问题失败。',
			saveFailed: '保存答案失败。',
		},
	},

	accessibility: {
		skipToContent: '跳到内容',
		skipToNavigation: '跳到导航',
		itemBody: '问题内容',
		navigationRegion: '评估导航',
		announcement: '公告',
		newQuestion: '已加载新问题',
		answerRecorded: '已记录答案',
	},
} as const; // 'as const' for strict type inference
