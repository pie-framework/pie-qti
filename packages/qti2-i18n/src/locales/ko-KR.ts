/**
 * Korean (South Korea) translations
 *
 * Guidelines for translators:
 * - Keep messages concise for UI constraints
 * - Use sentence case for labels, title case for buttons
 * - Maintain consistent terminology across interactions
 * - Variables in {curlyBraces} will be replaced with dynamic values
 */
export default {
	common: {
		loading: '로딩 중...',
		error: '오류',
		success: '성공',
		cancel: '취소',
		confirm: '확인',
		close: '닫기',
		save: '저장',
		delete: '삭제',
		edit: '편집',
		remove: '제거',
		add: '추가',
		search: '검색',
		filter: '필터',
		reset: '초기화',
		submit: '제출',
		next: '다음',
		previous: '이전',
		back: '뒤로',
		continue: '계속',
		finish: '완료',
	},

	units: {
		bytes: '{count} 바이트',
		kilobytes: '{count} KB',
		megabytes: '{count} MB',
		seconds: '{count}초',
		minutes: '{count}분',
		hours: '{count}시간',
	},

	validation: {
		required: '이 항목은 필수입니다',
		invalidFormat: '잘못된 형식입니다',
		tooShort: '너무 짧습니다 (최소 {min}자)',
		tooLong: '너무 깁니다 (최대 {max}자)',
		outOfRange: '값은 {min}에서 {max} 사이여야 합니다',
	},

	interactions: {
		choice: {
			selectOption: '옵션을 선택하세요',
			selectMultiple: '해당하는 모든 항목을 선택하세요',
			selected: '선택됨',
			notSelected: '선택 안 됨',
		},

		upload: {
			// Shown as label above file input
			label: '파일 업로드',
			selectFile: '파일 선택',
			dragDrop: '또는 드래그 앤 드롭',

			// Displayed before list of allowed file types
			allowedTypes: '허용된 파일 형식:',

			// Displayed when file is selected
			selectedFile: '선택됨:',

			// File size display - {size} will be replaced with numeric value
			fileSize: '{size} 바이트',
			fileSizeKb: '{size} KB',
			fileSizeMb: '{size} MB',

			removeFile: '파일 제거',

			// Error shown when file type validation fails
			// {types} will be replaced with comma-separated list of allowed types
			errorInvalidType: '허용되지 않은 파일 형식입니다. 허용 형식: {types}',
			errorReadFailed: '파일을 읽지 못했습니다',

			// {max} will be replaced with maximum size in MB
			errorTooLarge: '파일이 너무 큽니다 (최대 {max} MB)',
			unknownType: '알 수 없는 파일 형식',
		},

		drawing: {
			label: '답변을 그리세요',
			clear: '그림 지우기',
			undo: '실행 취소',
			redo: '다시 실행',
			strokeColor: '선 색상',
			strokeWidth: '선 굵기',
			tool: '도구',
		},

		extendedText: {
			placeholder: '여기에 답변을 입력하세요...',
			characterCount: '{count}자',
			characterLimit: '{count} / {max}자',
			bold: '굵게',
			italic: '기울임꼴',
			underline: '밑줄',
			bulletList: '글머리 기호 목록',
			numberedList: '번호 매기기 목록',
			insertMath: '수식 삽입',
		},

		slider: {
			label: '슬라이더',
			selectedValue: '선택된 값: {value}',
			min: '최소값: {min}',
			max: '최대값: {max}',
			step: '단계: {step}',
		},

		hottext: {
			selected: '선택됨:',
			selectText: '본문에서 텍스트를 선택하세요',
		},

		hotspot: {
			selected: '선택됨:',
			selectArea: '이미지에서 영역을 선택하세요',
		},

		selectPoint: {
			instruction: '이미지를 클릭하여 점을 선택하세요',
			maxPointsReached: '최대 점 개수에 도달했습니다. 새 점을 추가하려면 기존 점을 제거하세요.',
			point: '점 {index}',
			removePoint: '점 {index} 제거',
		},

		match: {
			// Keyboard instruction for accessible drag-drop
			dragInstruction: '스페이스 또는 엔터를 눌러 일치시키세요',
			dropTarget: '여기에 항목을 놓으세요',
			matchedWith: '{target}과(와) 일치됨',
			available: '사용 가능',
			removeMatch: '일치 제거',
		},

		gapMatch: {
			instruction: '단어를 드래그하여 빈칸을 채우세요',
			available: '사용 가능한 단어',
			removeWord: '단어 제거',
			// {word} will be replaced with the word being removed
			removeFromBlanks: '빈칸에서 {word} 제거',
		},

		graphicGapMatch: {
			instruction: '이미지의 핫스팟에 라벨을 배치하세요',
			available: '사용 가능한 라벨',
			alreadyPlaced: '이미 핫스팟에 배치됨',
			selectedForPlacement: '배치를 위해 선택됨',
			pressSpaceToSelect: '스페이스를 눌러 선택하세요',
			pressSpaceToPlace: '스페이스 또는 엔터를 눌러 라벨을 배치하세요',
			removeLabel: '라벨 제거',
			removeFromHotspot: '핫스팟에서 {label} 제거',
			hotspot: '핫스팟 {number}',
			contains: '포함: {label}',
		},

		order: {
			instruction: '항목을 드래그하여 순서를 변경하세요',
			moveUp: '위로 이동',
			moveDown: '아래로 이동',
			position: '{total}개 중 {current}번째',
		},

		associate: {
			instruction: '항목 간의 연관성을 만드세요',
			createPair: '쌍 만들기',
			removePair: '쌍 제거',
		},

		positionObject: {
			instruction: '객체를 이미지 위로 드래그하세요',
			placeObject: '{object}을(를) 이미지에 배치',
			removeObject: '{object} 제거',
			objectAt: '{object} 위치: ({x}, {y})',
		},

		endAttempt: {
			buttonLabel: '시도 종료',
			ended: '시도 종료됨',
			requested: '요청됨',
			warningMessage: '시도가 종료되었으며 더 이상 수정할 수 없습니다.',
			confirmMessage: '시도를 종료하시겠습니까? 답변을 변경할 수 없게 됩니다.',
		},

		media: {
			play: '재생',
			pause: '일시정지',
			volume: '음량',
			mute: '음소거',
			unmute: '음소거 해제',
			fullscreen: '전체 화면',
			exitFullscreen: '전체 화면 종료',
			playbackSpeed: '재생 속도',
			currentTime: '{current} / {duration}',
			loading: '미디어 로딩 중...',
		},
	},

	assessment: {
		title: '평가',
		loading: '평가 로딩 중...',
		loadingError: '평가 로딩 시간이 초과되었습니다. 평가가 유효하지 않거나 플레이어 초기화에 실패했습니다.',
		question: '{total}개 중 {current}번째 문제',
		section: '{total}개 중 {current}번째 섹션',

		navigation: {
			previous: '이전',
			next: '다음',
			submit: '제출',
			jumpTo: '{number}번 문제로 이동',
			sectionMenu: '섹션 메뉴',
			progress: '진행률: {percent}%',
		},

		sections: {
			title: '섹션',
			selectSection: '섹션 선택',
		},

		timer: {
			timeRemaining: '남은 시간: {time}',
			timeElapsed: '경과 시간: {time}',
			timeUp: '시간 종료!',
		},

		feedback: {
			correct: '정답',
			incorrect: '오답',
			partiallyCorrect: '부분 정답',
			unanswered: '미답변',
			score: '점수: {score} / {maxScore}',
			passed: '합격',
			failed: '불합격',
		},

		completion: {
			title: '평가 완료',
			message: '평가를 완료했습니다.',
			score: '점수: {maxScore}점 만점에 {score}점',
			percentage: '백분율: {percent}%',
			viewResults: '결과 보기',
			exit: '나가기',
		},

		errors: {
			navigationFailed: '탐색에 실패했습니다. 다시 시도해 주세요.',
			submitFailed: '평가 제출에 실패했습니다. 다시 시도해 주세요.',
			loadFailed: '문제를 불러오지 못했습니다.',
			saveFailed: '답변을 저장하지 못했습니다.',
		},
	},

	accessibility: {
		skipToContent: '콘텐츠로 건너뛰기',
		skipToNavigation: '탐색으로 건너뛰기',
		itemBody: '문제 내용',
		navigationRegion: '평가 탐색',
		announcement: '알림',
		newQuestion: '새 문제가 로드되었습니다',
		answerRecorded: '답변이 기록되었습니다',
	},
} as const; // 'as const' for strict type inference
