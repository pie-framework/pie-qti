/**
 * Turkish (Turkey) translations
 *
 * Guidelines for translators:
 * - Keep messages concise for UI constraints
 * - Use sentence case for labels, title case for buttons
 * - Maintain consistent terminology across interactions
 * - Variables in {curlyBraces} will be replaced with dynamic values
 */
export default {
	common: {
		loading: 'Yükleniyor...',
		error: 'Hata',
		success: 'Başarılı',
		cancel: 'İptal',
		confirm: 'Onayla',
		close: 'Kapat',
		save: 'Kaydet',
		delete: 'Sil',
		edit: 'Düzenle',
		remove: 'Kaldır',
		add: 'Ekle',
		search: 'Ara',
		filter: 'Filtrele',
		reset: 'Sıfırla',
		submit: 'Gönder',
		next: 'İleri',
		previous: 'Geri',
		back: 'Geri',
		continue: 'Devam Et',
		finish: 'Bitir',
	},

	units: {
		bytes: '{count} bayt',
		kilobytes: '{count} KB',
		megabytes: '{count} MB',
		seconds: '{count} saniye',
		minutes: '{count} dakika',
		hours: '{count} saat',
	},

	validation: {
		required: 'Bu alan zorunludur',
		invalidFormat: 'Geçersiz format',
		tooShort: 'Çok kısa (minimum {min} karakter)',
		tooLong: 'Çok uzun (maksimum {max} karakter)',
		outOfRange: 'Değer {min} ile {max} arasında olmalıdır',
	},

	interactions: {
		choice: {
			selectOption: 'Bir seçenek seçin',
			selectMultiple: 'Uygun olanların tümünü seçin',
			selected: 'Seçildi',
			notSelected: 'Seçilmedi',
		},

		upload: {
			// Shown as label above file input
			label: 'Bir dosya yükleyin',
			selectFile: 'Dosya seçin',
			dragDrop: 'veya sürükleyip bırakın',

			// Displayed before list of allowed file types
			allowedTypes: 'İzin verilen dosya türleri:',

			// Displayed when file is selected
			selectedFile: 'Seçilen:',

			// File size display - {size} will be replaced with numeric value
			fileSize: '{size} bayt',
			fileSizeKb: '{size} KB',
			fileSizeMb: '{size} MB',

			removeFile: 'Dosyayı kaldır',

			// Error shown when file type validation fails
			// {types} will be replaced with comma-separated list of allowed types
			errorInvalidType: 'Dosya türüne izin verilmiyor. İzin verilenler: {types}',
			errorReadFailed: 'Dosya okunamadı',

			// {max} will be replaced with maximum size in MB
			errorTooLarge: 'Dosya çok büyük (maksimum {max} MB)',
			unknownType: 'Bilinmeyen dosya türü',
		},

		drawing: {
			label: 'Cevabınızı çizin',
			clear: 'Çizimi temizle',
			undo: 'Geri al',
			redo: 'Yinele',
			strokeColor: 'Çizgi rengi',
			strokeWidth: 'Çizgi kalınlığı',
			tool: 'Araç',
		},

		extendedText: {
			placeholder: 'Cevabınızı buraya yazın...',
			characterCount: '{count} karakter',
			characterLimit: '{count} / {max} karakter',
			bold: 'Kalın',
			italic: 'İtalik',
			underline: 'Altı çizili',
			bulletList: 'Madde işaretli liste',
			numberedList: 'Numaralı liste',
			insertMath: 'Matematik denklemi ekle',
		},

		slider: {
			label: 'Kaydırıcı',
			selectedValue: 'Seçilen değer: {value}',
			min: 'Minimum: {min}',
			max: 'Maksimum: {max}',
			step: 'Adım: {step}',
		},

		hottext: {
			selected: 'Seçilen:',
			selectText: 'Metinden metin seçin',
		},

		hotspot: {
			selected: 'Seçilen:',
			selectArea: 'Görsel üzerinde alanlar seçin',
		},

		selectPoint: {
			instruction: 'Nokta seçmek için görsele tıklayın',
			maxPointsReached: 'Maksimum nokta sayısına ulaşıldı. Yeni bir nokta eklemek için bir noktayı kaldırın.',
			point: 'Nokta {index}',
			removePoint: 'Noktayı kaldır {index}',
		},

		match: {
			// Keyboard instruction for accessible drag-drop
			dragInstruction: 'Eşleştirmek için Boşluk veya Enter tuşuna basın',
			dropTarget: 'Öğeyi buraya bırakın',
			matchedWith: '{target} ile eşleştirildi',
			available: 'Kullanılabilir',
			removeMatch: 'Eşleşmeyi kaldır',
		},

		gapMatch: {
			instruction: 'Boşlukları doldurmak için kelimeleri sürükleyin',
			available: 'Kullanılabilir kelimeler',
			removeWord: 'Kelimeyi kaldır',
			// {word} will be replaced with the word being removed
			removeFromBlanks: '{word} kelimesini boşluklardan kaldır',
		},

		graphicGapMatch: {
			instruction: 'Etiketleri görsel üzerindeki hotspotlara yerleştirin',
			available: 'Kullanılabilir etiketler',
			alreadyPlaced: 'Zaten hotspot üzerine yerleştirildi',
			selectedForPlacement: 'Yerleştirme için seçildi',
			pressSpaceToSelect: 'Seçmek için Boşluk tuşuna basın',
			pressSpaceToPlace: 'Etiketi yerleştirmek için Boşluk veya Enter tuşuna basın',
			removeLabel: 'Etiketi kaldır',
			removeFromHotspot: '{label} etiketini hotspottan kaldır',
			hotspot: 'Hotspot {number}',
			contains: 'İçerik: {label}',
		},

		order: {
			instruction: 'Öğeleri yeniden sıralamak için sürükleyin',
			moveUp: 'Yukarı taşı',
			moveDown: 'Aşağı taşı',
			position: '{total} içinden {current}. pozisyon',
		},

		associate: {
			instruction: 'Öğeler arasında ilişkilendirmeler oluşturun',
			createPair: 'Eşleştirme oluştur',
			removePair: 'Eşleştirmeyi kaldır',
		},

		positionObject: {
			instruction: 'Nesneleri görselin üzerine sürükleyin',
			placeObject: '{object} nesnesini görsele yerleştir',
			removeObject: '{object} nesnesini kaldır',
			objectAt: '{object} nesnesi ({x}, {y}) konumunda',
		},

		endAttempt: {
			buttonLabel: 'Denemyi Bitir',
			ended: 'Deneme Bitirildi',
			requested: 'İstendi',
			warningMessage: 'Denemeniz sonlandırılmıştır ve artık değiştirilemez.',
			confirmMessage: 'Denemenizi sonlandırmak istediğinizden emin misiniz? Cevaplarınızı değiştiremeyeceksiniz.',
		},

		media: {
			play: 'Oynat',
			pause: 'Duraklat',
			volume: 'Ses',
			mute: 'Sessiz',
			unmute: 'Sesi aç',
			fullscreen: 'Tam ekran',
			exitFullscreen: 'Tam ekrandan çık',
			playbackSpeed: 'Oynatma hızı',
			currentTime: '{current} / {duration}',
			loading: 'Medya yükleniyor...',
		},
	},

	assessment: {
		title: 'Değerlendirme',
		loading: 'Değerlendirme yükleniyor...',
		loadingError: 'Değerlendirme yüklenirken zaman aşımı. Bu değerlendirme geçersiz olabilir veya oynatıcı başlatılamadı.',
		question: '{total} sorudan {current}. soru',
		section: '{total} bölümden {current}. bölüm',

		navigation: {
			previous: 'Önceki',
			next: 'Sonraki',
			submit: 'Gönder',
			jumpTo: '{number}. soruya git',
			sectionMenu: 'Bölüm menüsü',
			progress: 'İlerleme: %{percent}',
		},

		sections: {
			title: 'Bölümler',
			selectSection: 'Bölüm seçin',
		},

		timer: {
			timeRemaining: 'Kalan süre: {time}',
			timeElapsed: 'Geçen süre: {time}',
			timeUp: 'Süre doldu!',
		},

		feedback: {
			correct: 'Doğru',
			incorrect: 'Yanlış',
			partiallyCorrect: 'Kısmen doğru',
			unanswered: 'Cevapsız',
			score: 'Puan: {score} / {maxScore}',
			passed: 'Geçti',
			failed: 'Kaldı',
		},

		completion: {
			title: 'Değerlendirme Tamamlandı',
			message: 'Değerlendirmeyi tamamladınız.',
			score: 'Puanınız: {maxScore} üzerinden {score}',
			percentage: 'Yüzde: %{percent}',
			viewResults: 'Sonuçları görüntüle',
			exit: 'Çıkış',
		},

		errors: {
			navigationFailed: 'Gezinme başarısız oldu. Lütfen tekrar deneyin.',
			submitFailed: 'Değerlendirme gönderilemedi. Lütfen tekrar deneyin.',
			loadFailed: 'Soru yüklenemedi.',
			saveFailed: 'Cevap kaydedilemedi.',
		},
	},

	accessibility: {
		skipToContent: 'İçeriğe atla',
		skipToNavigation: 'Gezinmeye atla',
		itemBody: 'Soru içeriği',
		navigationRegion: 'Değerlendirme gezinmesi',
		announcement: 'Duyuru',
		newQuestion: 'Yeni soru yüklendi',
		answerRecorded: 'Cevap kaydedildi',
	},
} as const; // 'as const' for strict type inference
