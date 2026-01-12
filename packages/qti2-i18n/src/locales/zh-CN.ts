/**
 * 中文(简体,中国)翻译
 *
 * 翻译指南:
 * - 保持消息简洁以适应界面约束
 * - 标签使用句子大小写,按钮使用标题大小写
 * - 在各交互中保持术语的一致性
 * - {花括号}中的变量将被替换为动态值
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
		clear: '清除',
		clearAll: '全部清除',
		submit: '提交',
		next: '下一个',
		previous: '上一个',
		back: '返回',
		continue: '继续',
		finish: '完成',
		complete: '完成',
		completed: '已完成',
		status: '状态',
		required: '必填',
		review: '复查',
		selected: '已选择',
		available: '可用',
		showDetails: '显示详情',
		hideDetails: '隐藏详情',
		details: '详情',
		deselected: '已取消选择 {item}',
		selectionCancelled: '已取消选择',
		question: '问题',
		of: '/',
		answered: '已回答',
		pleaseComplete: '请完成必填的交互内容',
		submitting: '提交中...',
		submitAnswer: '提交答案',
		tryAgain: '重试',
		errorNoData: '未提供交互数据',
	},

	units: {
		bytes: '{count} 字节',
		kilobytes: '{count} KB',
		megabytes: '{count} MB',
		seconds: '{count} 秒',
		minutes: '{count} 分钟',
		hours: '{count} 小时',
	},

	// 复数示例
	// 使用 i18n.plural('plurals.items', { count: n }) 访问这些内容
	plurals: {
		items: {
			one: '{count} 个项目',
			other: '{count} 个项目',
		},
		files: {
			one: '已选择 {count} 个文件',
			other: '已选择 {count} 个文件',
		},
		questions: {
			one: '{count} 个问题',
			other: '{count} 个问题',
		},
		answers: {
			one: '{count} 个答案',
			other: '{count} 个答案',
		},
		choices: {
			one: '{count} 个选项',
			other: '{count} 个选项',
		},
		attempts: {
			one: '剩余 {count} 次尝试',
			other: '剩余 {count} 次尝试',
		},
		minutesRemaining: {
			one: '剩余 {count} 分钟',
			other: '剩余 {count} 分钟',
		},
		secondsRemaining: {
			one: '剩余 {count} 秒',
			other: '剩余 {count} 秒',
		},
		submitAnswer: {
			one: '提交答案',
			other: '提交答案',
		},
	},

	validation: {
		required: '此字段为必填项',
		invalidFormat: '格式无效',
		tooShort: '太短(最少 {min} 个字符)',
		tooLong: '太长(最多 {max} 个字符)',
		outOfRange: '值必须在 {min} 和 {max} 之间',
	},

	interactions: {
		choice: {
			selectOption: '选择一个选项',
			selectMultiple: '选择所有适用项',
			selected: '已选择',
			notSelected: '未选择',
		},

		upload: {
			// 文件输入框上方显示的标签
			label: '上传文件',
			selectFile: '选择文件',
			dragDrop: '或拖放文件',

			// 在允许的文件类型列表之前显示
			allowedTypes: '允许的文件类型:',

			// 选择文件时显示
			selectedFile: '已选择:',

			// 文件大小显示 - {size} 将被替换为数值
			fileSize: '{size} 字节',
			fileSizeKb: '{size} KB',
			fileSizeMb: '{size} MB',

			removeFile: '移除文件',

			// 文件类型验证失败时显示的错误
			// {types} 将被替换为允许类型的逗号分隔列表
			errorInvalidType: '不允许的文件类型。允许的类型:{types}',
			errorReadFailed: '读取文件失败',

			// {max} 将被替换为最大大小(MB)
			errorTooLarge: '文件太大(最大 {max} MB)',
			unknownType: '未知文件类型',
		},

		drawing: {
			label: '绘制你的答案',
			clear: '清除绘图',
			undo: '撤销',
			redo: '重做',
			strokeColor: '线条颜色',
			strokeWidth: '线条宽度',
			tool: '工具',
			instructions: '使用鼠标或触摸进行绘制。使用清除按钮重置。',
			canvas: '绘图画布',
			updated: '绘图已更新。',
			cleared: '绘图已清除。',
			generated: '已生成:',
		},

		extendedText: {
			placeholder: '在此处输入你的答案...',
			characterCount: '{count} 个字符',
			characterLimit: '{count} / {max} 个字符',
			bold: '粗体',
			italic: '斜体',
			underline: '下划线',
			bulletList: '项目符号列表',
			numberedList: '编号列表',
			insertMath: '插入数学公式',
			insertInlineMath: '插入行内数学',
			insertBlockMath: '插入块级数学',
		},

		slider: {
			label: '滑块',
			selectedValue: '已选择的值:{value}',
			min: '最小值:{min}',
			max: '最大值:{max}',
			step: '步长:{step}',
			ariaLabel: '滑块值从 {lowerBound} 到 {upperBound}',
			statTitle: '已选择的值',
		},

		hottext: {
			selected: '已选择:',
			selectText: '从文章中选择文本',
			clearSelection: '清除选择',
			ariaLabel: '文本选择交互',
		},

		hotspot: {
			selected: '已选择:',
			selectArea: '在图像上选择区域',
			ariaLabel: '热点交互',
			altText: '热点交互',
		},

		selectPoint: {
			instruction: '点击图像以选择点',
			instructionAria: '点击以在图像上选择点',
			maxPointsReached: '已达到最大点数。移除一个点以添加新点。',
			point: '点 {index}',
			removePoint: '移除点 {index}',
			removePointTitle: '点击以移除此点',
			removePointAt: '移除坐标为 {x}, {y} 的点 {index}',
			removePointAtTitle: '点击以移除此点 ({x}, {y})',
			canvas: '选择画布',
			noImage: '未提供图像',
			pointsSelected: '已选择的点:',
			minimumMet: '✓ 已满足最小要求',
			selectAtLeast: '至少选择 {minChoices} 个',
		},

		match: {
			// 可访问拖放的键盘说明
			keyboardInstructions: '按空格键或回车键选择源项目。按 Tab 键导航到目标。在目标上按空格键或回车键创建匹配。按 Esc 键取消选择。',
			dragInstruction: '按空格键或回车键进行匹配',
			dropTarget: '将项目放在此处',
			matchedWith: '已与 {target} 匹配',
			selectedForMatching: '已选择以进行匹配',
			available: '可用',
			availableForMatching: '可用于匹配',
			removeMatch: '移除匹配',
			clearMatch: '清除 {source} 的匹配',
			sourceItemsLabel: '要匹配的源项目',
			targetItemsLabel: '用于匹配的目标项目',
			dragFromHere: '从此处拖动:',
			dropHere: '放在此处:',
			deselected: '已取消选择 {item}',
			selected: '已选择 {item}',
			navigateToTarget: '导航到目标并按空格键或回车键进行匹配',
			selectionCancelled: '已取消选择',
			matchCleared: '已清除 {item} 的匹配',
		},

		gapMatch: {
			instruction: '拖动单词填入空白处',
			available: '可用的单词',
			availableLabel: '可放置的可用单词',
			availableHeading: '可用的单词:',
			removeWord: '移除单词',
			// {word} 将被替换为正在移除的单词
			removeFromBlanks: '从空白处移除 {word}',
			selectPlaceholder: '选择...',
			gapAriaLabel: '空白 {gapId}',
			blankGapAriaLabel: '空白 {gapId}。在此处放置答案。',
			filledGapAriaLabel: 'Blank {gapId}, filled with {word}. Click to clear.',
		},

		graphicGapMatch: {
			instruction: '在图像热点上放置标签',
			keyboardInstructions: '按空格键或回车键选择标签。按 Tab 键导航到图像上的热点。在热点上按空格键或回车键放置标签。按 Esc 键取消选择。',
			available: '可用的标签',
			availableLabel: '可放置的可用标签',
			availableHeading: '可用的标签:',
			alreadyPlaced: '已放置在热点上',
			selectedForPlacement: '已选择以进行放置',
			pressSpaceToSelect: '按空格键选择',
			pressSpaceToPlace: '按空格键或回车键放置标签',
			removeLabel: '移除标签',
			removeFromHotspot: '从热点移除 {label}',
			labelPlaced: '{label} 已放置在热点 {hotspot} 上',
			hotspot: '热点 {number}',
			contains: '包含:{label}',
		},

		order: {
			instruction: '拖动项目以重新排序',
			keyboardInstructions: '按空格键或回车键抓取项目。使用方向键移动项目。再次按空格键或回车键放下。按 Esc 键取消。',
			grabbed: '已抓取。使用方向键移动。',
			moveUp: '向上移动',
			moveDown: '向下移动',
			position: '位置 {current} / {total}',
			listLabel: '可重新排序的选项列表',
			confirmOrder: '确认顺序',
			confirmOrderNoChanges: '确认顺序(无更改)',
			confirmAria: '将此顺序确认为你的答案',
			itemGrabbed: '{item} 已抓取。当前位置 {position} / {total}。使用方向键移动,按空格键或回车键放下。',
			itemDropped: '{item} 已放置在位置 {position} / {total}',
			itemMoved: '{item} 已移动到位置 {position} / {total}',
			selectionCancelled: '{item} 选择已取消',
		},

		associate: {
			instruction: '在项目之间创建关联',
			createPair: '创建配对',
			removePair: '移除配对',
			removeAssociation: '移除关联',
			diagramLabel: '关联图',
			altText: '关联图',
			hotspotConnections: '{label}({usageCount}/{matchMax} 个连接)',
			selectAnother: '已选择:<strong>{label}</strong>。点击另一个',
			minimumRequired: '最少需要:{minAssociations}',
			currentAssociations: '当前关联',
			clickToAssociate: '点击两个项目以在它们之间创建关联',
			clickAnotherOrDeselect: '点击另一个项目以创建关联(或再次点击以取消选择)',
			associations: '关联',
			associationsCount: '关联({count}/{max})',
			clickHotspotsToAssociate: '点击图像上的两个热点以创建关联。',
			clickAnotherHotspot: '已选择:<strong>{label}</strong>。点击另一个热点以创建关联。',
		},

		positionObject: {
			instruction: '将物体拖动到图像上',
			placeObject: '将 {object} 放在图像上',
			removeObject: '移除 {object}',
			objectAt: '{object} 在位置 ({x}, {y})',
			canvasLabel: '定位画布',
			backgroundAlt: '定位背景',
			positioned: '已将 {label} 放置在 ({x}, {y})',
			minimumRequired: '最少需要:{minChoices}',
			maximumAllowed: '最多:{maxChoices}',
			availableObjects: '可用的物体',
			objectUsage: '{label}(已使用 {usageCount}/{matchMax})',
			availableObjectsCount: '可用的物体({count}/{max})',
			dragObjectsInstruction: '将物体拖动到画布上进行定位。',
			used: '已使用 {usageCount}/{matchMax}',
		},

		endAttempt: {
			buttonLabel: '结束尝试',
			ended: '尝试已结束',
			requested: '已请求',
			warningMessage: '你的尝试已结束,无法再进行修改。',
			confirmMessage: '你确定要结束尝试吗?你将无法更改你的答案。',
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
			loading: '加载媒体中...',
			ariaLabel: '媒体内容',
			maxPlayLimitReached: '已达到最大播放次数',
			playCount: '播放次数:',
			remaining: '剩余:',
			requirementMet: '✓ 已满足要求',
			playAtLeast: '至少播放 {minPlays} 次',
			playAtLeastPlural: '至少播放 {minPlays} 次',
			browserNoSupport: '你的浏览器不支持此媒体类型。',
			audioNoSupport: '你的浏览器不支持音频元素。',
			videoNoSupport: '你的浏览器不支持视频元素。',
			objectDisabled: '此项目使用了出于安全原因默认禁用的嵌入式对象类型。',
		},

		graphicOrder: {
			instruction: '点击热点以对它们进行排序',
			diagramLabel: '排序图',
			altText: '排序图',
			orderHeading: '顺序(拖动以重新排序)',
			itemLabel: '项目 {index}:{label}',
			confirmOrder: '确认顺序',
			confirmOrderNoChanges: '确认顺序(无更改)',
			confirmAria: '将此顺序确认为你的答案',
		},

		custom: {
			unsupported: '不支持的自定义交互',
			description: '此项目包含供应商特定的交互。此播放器不执行自定义交互。',
			promptLabel: '提示',
			manualResponse: '手动响应(可选)',
			placeholder: '输入手动响应(备用)',
			attributes: '属性',
			xml: 'XML',
		},

		inline: {
			placeholder: '...',
			selectPlaceholder: '选择...',
		},
	},

	item: {
		loading: '加载项目中...',
		loadingError: '加载项目失败',
		loadError: '加载项目时出错:{error}',
		parsingError: '解析 QTI XML 失败',
		processingError: '处理响应失败',
		submit: '提交',
		complete: '完成',
		completed: '已完成',
		attempt: '尝试 {numAttempts}',
	},

	itemSession: {
		attempt: '尝试 {numAttempts}',
		attemptsRemaining: '剩余 {attemptsRemaining} 次尝试',
		maxAttempts: '最多尝试次数:{maxAttempts}',
	},

	feedback: {
		close: '关闭反馈',
		closeFeedback: '关闭反馈',
		testFeedback: '测试反馈',
	},

	assessment: {
		title: '评估',
		loading: '加载评估中...',
		loadingError: '加载评估超时。此评估可能无效或播放器初始化失败。',
		question: '问题 {current} / {total}',
		questionAnnouncement: '问题 {current} / {total}',
		section: '部分 {current} / {total}',
		sectionDefault: '部分 {number}',
		closeMenu: '关闭菜单',
		readingPassage: '阅读文章',
		expandPassage: '展开文章',
		collapsePassage: '折叠文章',

		attempts: {
			remaining: '剩余 {count} 次尝试',
			oneRemaining: '剩余 1 次尝试',
			noRemaining: '没有剩余尝试(已使用 {count} 次)',
			used: '尝试次数:{count}',
			maxReached: '已达到最大尝试次数',
			required: '必须在继续之前回答',
			reviewNotAllowed: '提交后不允许',
		},

		navigation: {
			previous: '上一个',
			next: '下一个',
			submit: '提交',
			jumpTo: '跳转到问题 {number}',
			sectionMenu: '部分菜单',
			progress: '进度:{percent}%',
		},

		sections: {
			title: '部分',
			selectSection: '选择部分',
		},

		timer: {
			remaining: '剩余时间',
			elapsed: '已用时间',
			expired: '时间已过',
			timeRemaining: '剩余时间:{time}',
			timeElapsed: '已用时间:{time}',
			timeUp: '时间到!',
		},

		feedback: {
			correct: '正确',
			incorrect: '错误',
			partiallyCorrect: '部分正确',
			unanswered: '未回答',
			score: '得分:{score} / {maxScore}',
			passed: '通过',
			failed: '未通过',
		},

		completion: {
			title: '评估完成',
			message: '你已完成评估。',
			score: '你的得分:{score} / {maxScore}',
			percentage: '百分比:{percent}%',
			viewResults: '查看结果',
			exit: '退出',
		},

		errors: {
			navigationFailed: '导航失败。请重试。',
			submitFailed: '提交评估失败。请重试。',
			loadFailed: '加载问题失败。',
			saveFailed: '保存响应失败。',
		},
	},

	i18n: {
		selectLanguage: '语言',
		selectLanguageAriaLabel: '选择显示语言',
	},

	accessibility: {
		skipToContent: '跳到内容',
		skipToNavigation: '跳到导航',
		itemBody: '问题内容',
		navigationRegion: '评估导航',
		announcement: '公告',
		newQuestion: '已加载新问题',
		answerRecorded: '答案已记录',
		resizer: '调整文章和问题面板大小',
	},

	demo: {
		selectSampleItem: '选择示例项目',
		configurationPanel: '配置面板',
		viewingAs: '查看身份',
		role: '角色',
		candidate: '考生',
		author: '作者',
		proctor: '监考员',
		scorer: '评分员',
		tutor: '辅导员',
		showCorrectAnswers: '显示正确答案',
		showFeedback: '显示反馈',
		xmlEditor: 'XML 编辑器',

		// 导航
		appName: 'PIE QTI 2.2 播放器',
		home: '主页',
		itemDemo: '项目演示',
		assessmentDemo: '评估演示',
		likertDemo: 'Likert 插件演示',
		iframeDemo: 'Iframe 演示',
		theme: '主题',

		// Home Page
		homeTitle: 'QTI 2.2 播放器',
		homeSubtitle: '一个现代的、与框架无关的 QTI 2.2 评估项目播放器。默认情况下 100% 在客户端运行，并提供可选的服务器端钩子用于生产环境。',
		homeMetaDescription: '具有可选后端集成的现代 QTI 2.2 播放器',
		tryItems: '尝试项目',
		tryAssessments: '尝试评估',
		pluginDemo: '插件演示',
		dropQtiFile: '将 QTI XML 文件拖放到此处',
		orClickToSelect: '或点击选择文件',
		selectFile: '选择文件',
		selectedFile: '已选择:',
		loadInPlayer: '在播放器中加载',
		footerTitle: 'QTI 2.2 播放器',
		footerLicense: 'MIT 许可 • 开源',

		// 设置面板
		settings: '设置',
		candidateStudent: '考生(学生)',
		testConstructor: '测试构建者',
		controlsRubricVisibility: '控制评分标准可见性和正确答案显示',
		useBackendScoring: '使用后端评分',
		scoreOnServer: '在服务器而非客户端评分响应',
		sessionManagement: '会话管理',
		saving: '保存中...',
		saveSession: '保存会话',
		loadSession: '加载会话',

		// 导出和模板
		exportResponses: '导出响应',
		json: 'JSON',
		csv: 'CSV',
		templateProcessing: '模板处理',
		rerunTemplateProcessing: '重新运行模板处理并重置项目会话',
		regenerateVariant: '重新生成变体',
		templateVariablesDebug: '模板变量(调试)',
		variable: '变量',
		value: '值',

		// 键盘快捷键
		keyboardShortcuts: '键盘快捷键',
		submitAnswersShortcut: '提交答案',
		tryAgainShortcut: '重试',
		exportJsonShortcut: '导出 JSON',
		saveSessionShortcut: '保存会话',
		useCmdOnMacOS: '在 macOS 上使用 <kbd class="kbd kbd-xs">Cmd</kbd>',

		// 结果面板
		results: '结果',
		score: '得分',
		outcomeVariables: '结果变量',

		// 其他
		format: '格式',
		selectItemOrPasteXml: '选择示例项目或粘贴自定义 XML 以开始。',
		pageTitle: '播放器演示 - PIE QTI 2.2 播放器',

		// 示例项目描述
		sampleItemDescriptions: {
			'simple-choice': '带有合理干扰项的基础减法应用题',
			'partial-credit': '使用 mapResponse 的部分得分多项选择题',
			'capital-cities': '带有随机选项的地理问题',
			'text-entry': '不区分大小写匹配的填空题',
			'extended-text': '多行文本响应问题',
			'inline-choice': '嵌入文本中的下拉菜单',
			'order-interaction': '按正确顺序排列项目',
			'match-interaction': '匹配两列中的项目',
			'associate-interaction': '在项目之间创建关联',
			'gap-match': '将单词拖入文本中的空白处',
			'graphic-gap-match-solar-system': '标记太阳系的四个内行星',
			'slider': '在数字滑块上选择一个值',
			'hotspot': '在这个天文问题中点击蓝色星球',
			'hotspot-partial-credit': '识别有液态水的行星(类地行星部分得分)',
			'template-variable-demo': 'templateProcessing 生成值;responseProcessing 根据它们评分',
			'upload-interaction': '上传文件作为响应(baseType=file)',
			'drawing-interaction': '在画布上绘制(baseType=file,PNG dataUrl)',
			'media-audio': '带有播放次数跟踪和最小播放次数要求的音频播放器',
			'media-video': '带有播放次数跟踪和最大播放次数限制的视频播放器',
			'hottext-single': '点击以在文本中选择单个单词(语法问题)',
			'hottext-multiple': '点击以选择多个文本片段(阅读理解)',
			'select-point': '点击图像以选择一个点的位置(地理问题)',
			'graphic-order': '拖动以重新排列图像上的项目(地质层)',
			'graphic-associate': '点击热点对以创建关联(器官匹配)',
			'position-object': '在房间布局上拖动和定位家具物体',
			'end-attempt': '结束评估尝试的按钮',
			'custom-interaction': '显示 customInteraction 的备用 UI 并允许手动响应',
			'choice-with-stimulus': '内嵌阅读文章的问题',
			'math-inline': '带有 MathML 行内数学渲染的多项选择题',
			'math-extended': '带有 MathML 和富文本编辑器的扩展响应,用于展示数学工作',
			'math-fractions': '带有 MathML 块级显示的分数算术',
			'adaptive-capitals': '带有渐进式反馈和提示的多次尝试自适应问题',
		},
	},
} as const; // 'as const' 用于严格的类型推断
