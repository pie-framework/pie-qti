/**
 * Japanese (Japan) translations
 *
 * Guidelines for translators:
 * - Keep messages concise for UI constraints
 * - Use sentence case for labels, title case for buttons
 * - Maintain consistent terminology across interactions
 * - Variables in {curlyBraces} will be replaced with dynamic values
 */
export default {
	common: {
		loading: '読み込み中...',
		error: 'エラー',
		success: '成功',
		cancel: 'キャンセル',
		confirm: '確認',
		close: '閉じる',
		save: '保存',
		delete: '削除',
		edit: '編集',
		remove: '削除',
		add: '追加',
		search: '検索',
		filter: 'フィルター',
		reset: 'リセット',
		submit: '送信',
		next: '次へ',
		previous: '前へ',
		back: '戻る',
		continue: '続ける',
		finish: '完了',
	},

	units: {
		bytes: '{count} バイト',
		kilobytes: '{count} KB',
		megabytes: '{count} MB',
		seconds: '{count} 秒',
		minutes: '{count} 分',
		hours: '{count} 時間',
	},

	validation: {
		required: 'この項目は必須です',
		invalidFormat: '無効な形式です',
		tooShort: '短すぎます（最小 {min} 文字）',
		tooLong: '長すぎます（最大 {max} 文字）',
		outOfRange: '値は {min} から {max} の範囲内である必要があります',
	},

	interactions: {
		choice: {
			selectOption: '選択肢を選んでください',
			selectMultiple: '該当するものをすべて選択してください',
			selected: '選択済み',
			notSelected: '未選択',
		},

		upload: {
			// Shown as label above file input
			label: 'ファイルをアップロード',
			selectFile: 'ファイルを選択',
			dragDrop: 'またはドラッグ＆ドロップ',

			// Displayed before list of allowed file types
			allowedTypes: '許可されているファイル形式:',

			// Displayed when file is selected
			selectedFile: '選択済み:',

			// File size display - {size} will be replaced with numeric value
			fileSize: '{size} バイト',
			fileSizeKb: '{size} KB',
			fileSizeMb: '{size} MB',

			removeFile: 'ファイルを削除',

			// Error shown when file type validation fails
			// {types} will be replaced with comma-separated list of allowed types
			errorInvalidType: 'ファイル形式が許可されていません。許可: {types}',
			errorReadFailed: 'ファイルの読み込みに失敗しました',

			// {max} will be replaced with maximum size in MB
			errorTooLarge: 'ファイルが大きすぎます（最大 {max} MB）',
			unknownType: '不明なファイル形式',
		},

		drawing: {
			label: '回答を描画してください',
			clear: '描画をクリア',
			undo: '元に戻す',
			redo: 'やり直す',
			strokeColor: '線の色',
			strokeWidth: '線の太さ',
			tool: 'ツール',
		},

		extendedText: {
			placeholder: 'ここに回答を入力してください...',
			characterCount: '{count} 文字',
			characterLimit: '{count} / {max} 文字',
			bold: '太字',
			italic: '斜体',
			underline: '下線',
			bulletList: '箇条書き',
			numberedList: '番号付きリスト',
			insertMath: '数式を挿入',
		},

		slider: {
			label: 'スライダー',
			selectedValue: '選択された値: {value}',
			min: '最小値: {min}',
			max: '最大値: {max}',
			step: 'ステップ: {step}',
		},

		hottext: {
			selected: '選択済み:',
			selectText: '本文からテキストを選択してください',
		},

		hotspot: {
			selected: '選択済み:',
			selectArea: '画像上の領域を選択してください',
		},

		selectPoint: {
			instruction: '画像をクリックしてポイントを選択してください',
			maxPointsReached: '最大ポイント数に達しました。新しいポイントを追加するには、既存のポイントを削除してください。',
			point: 'ポイント {index}',
			removePoint: 'ポイント {index} を削除',
		},

		match: {
			// Keyboard instruction for accessible drag-drop
			dragInstruction: 'スペースキーまたはEnterキーを押してマッチングしてください',
			dropTarget: 'ここにアイテムをドロップ',
			matchedWith: '{target} とマッチング済み',
			available: '利用可能',
			removeMatch: 'マッチングを解除',
		},

		gapMatch: {
			instruction: '単語をドラッグして空欄を埋めてください',
			available: '利用可能な単語',
			removeWord: '単語を削除',
			// {word} will be replaced with the word being removed
			removeFromBlanks: '空欄から {word} を削除',
		},

		graphicGapMatch: {
			instruction: '画像のホットスポットにラベルを配置してください',
			available: '利用可能なラベル',
			alreadyPlaced: 'ホットスポットに配置済み',
			selectedForPlacement: '配置用に選択済み',
			pressSpaceToSelect: 'スペースキーを押して選択',
			pressSpaceToPlace: 'スペースキーまたはEnterキーを押してラベルを配置',
			removeLabel: 'ラベルを削除',
			removeFromHotspot: 'ホットスポットから {label} を削除',
			hotspot: 'ホットスポット {number}',
			contains: '含まれるもの: {label}',
		},

		order: {
			instruction: 'アイテムをドラッグして並べ替えてください',
			moveUp: '上に移動',
			moveDown: '下に移動',
			position: '位置 {current} / {total}',
		},

		associate: {
			instruction: 'アイテム間の関連付けを作成してください',
			createPair: 'ペアを作成',
			removePair: 'ペアを解除',
		},

		positionObject: {
			instruction: 'オブジェクトを画像上にドラッグしてください',
			placeObject: '{object} を画像に配置',
			removeObject: '{object} を削除',
			objectAt: '{object} の位置 ({x}, {y})',
		},

		endAttempt: {
			buttonLabel: '解答を終了',
			ended: '解答終了',
			requested: 'リクエスト済み',
			warningMessage: '解答が終了されました。これ以上の変更はできません。',
			confirmMessage: '本当に解答を終了しますか？解答を終了すると、回答を変更できなくなります。',
		},

		media: {
			play: '再生',
			pause: '一時停止',
			volume: '音量',
			mute: 'ミュート',
			unmute: 'ミュート解除',
			fullscreen: '全画面表示',
			exitFullscreen: '全画面表示を終了',
			playbackSpeed: '再生速度',
			currentTime: '{current} / {duration}',
			loading: 'メディアを読み込み中...',
		},
	},

	assessment: {
		title: 'アセスメント',
		loading: 'アセスメントを読み込み中...',
		loadingError: 'アセスメントの読み込みがタイムアウトしました。このアセスメントは無効であるか、プレーヤーの初期化に失敗した可能性があります。',
		question: '問題 {current} / {total}',
		section: 'セクション {current} / {total}',

		navigation: {
			previous: '前へ',
			next: '次へ',
			submit: '送信',
			jumpTo: '問題 {number} へジャンプ',
			sectionMenu: 'セクションメニュー',
			progress: '進捗: {percent}%',
		},

		sections: {
			title: 'セクション',
			selectSection: 'セクションを選択',
		},

		timer: {
			timeRemaining: '残り時間: {time}',
			timeElapsed: '経過時間: {time}',
			timeUp: '時間切れです！',
		},

		feedback: {
			correct: '正解',
			incorrect: '不正解',
			partiallyCorrect: '部分正解',
			unanswered: '未回答',
			score: 'スコア: {score} / {maxScore}',
			passed: '合格',
			failed: '不合格',
		},

		completion: {
			title: 'アセスメント完了',
			message: 'アセスメントが完了しました。',
			score: 'あなたのスコア: {score} / {maxScore}',
			percentage: '正答率: {percent}%',
			viewResults: '結果を表示',
			exit: '終了',
		},

		errors: {
			navigationFailed: 'ナビゲーションに失敗しました。もう一度お試しください。',
			submitFailed: 'アセスメントの送信に失敗しました。もう一度お試しください。',
			loadFailed: '問題の読み込みに失敗しました。',
			saveFailed: '回答の保存に失敗しました。',
		},
	},

	accessibility: {
		skipToContent: 'コンテンツへスキップ',
		skipToNavigation: 'ナビゲーションへスキップ',
		itemBody: '問題内容',
		navigationRegion: 'アセスメントナビゲーション',
		announcement: 'お知らせ',
		newQuestion: '新しい問題が読み込まれました',
		answerRecorded: '回答が記録されました',
	},
} as const; // 'as const' for strict type inference
