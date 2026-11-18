    document.addEventListener('DOMContentLoaded', () => {

        // ===== モバイル最適化: ビューポート高さの動的更新 =====
        function updateViewportHeight() {
            const vh = window.innerHeight * 0.01;
            document.documentElement.style.setProperty('--vh', `${vh}px`);
        }

        // 初期化とリサイズ時の更新
        updateViewportHeight();
        window.addEventListener('resize', updateViewportHeight);
        window.addEventListener('orientationchange', () => {
            setTimeout(updateViewportHeight, 100);
        });

        // ===== タッチ操作の最適化 =====
        // ダブルタップズーム防止（快適な操作感のため）
        let lastTouchEnd = 0;
        document.addEventListener('touchend', (event) => {
            const now = Date.now();
            if (now - lastTouchEnd <= 300) {
                event.preventDefault();
            }
            lastTouchEnd = now;
        }, { passive: false });

        // ===== ナビゲーションバーの視認性向上 =====
        // スクロール位置に応じてナビゲーションに影を追加
        let lastScrollY = window.scrollY;
        const updateNavShadow = () => {
            const bottomNav = document.getElementById('bottom-nav');
            if (!bottomNav) return;

            const currentScrollY = window.scrollY;

            // 上スクロール時は影を強く、下スクロール時は通常
            if (currentScrollY > lastScrollY && currentScrollY > 50) {
                bottomNav.style.boxShadow = '0 -4px 12px rgba(0,0,0,0.15)';
            } else {
                bottomNav.style.boxShadow = '0 -2px 8px rgba(0,0,0,0.1)';
            }

            lastScrollY = currentScrollY;
        };

        window.addEventListener('scroll', updateNavShadow, { passive: true });

        // ========== 状態管理 ==========
        const state = {
            currentPage: 'start',
            quiz: {
                currentQuestion: 0,
                answers: {}
            },
            properties: [],
            favorites: [],
            stars: [],
            dislikes: [],
            filters: {
                sort: 'match_desc',
                tags: [],
                tagMode: 'AND', // 'OR'
                maxPrice: 150000,
                maxAge: 100,
                prefecture: '',
                city: ''
            },
            // API接続状態の管理
            api: {
                dataLoaded: false,
                isLoading: false,
                lastError: null,
                municipalities: [], // 自治体データ
                lastFetchTime: null
            },
            currentMap: null,
            detailMap: null,
            mapMarkers: [],
            userLocation: null,
            mapMode: 'single', // 'single' or 'multiple'
            matching: {
                currentIndex: 0,
                properties: [],
                isAnimating: false
            }
        };

        // ========== ダミーデータ ==========
        // properties.jsonから読み込むため、初期値は空配列
        let dummyProperties = [];
        // ========== 診断データ ==========
        const quizData = [
            {
                question: "どんな場所で暮らしたい？",
                key: "location",
                options: [
                    { text: "🌿 自然に囲まれた静かな場所", value: "nature", tags: ["自然豊か", "古民家"] },
                    { text: "🏙️ 活気あふれる街の中心", value: "city", tags: ["駅近", "SOHO可"] }
                ]
            },
            {
                question: "休日はどう過ごすことが多い？",
                key: "hobby",
                options: [
                    { text: "🎨 創作活動やDIYに没頭", value: "creative", tags: ["DIY可", "SOHO可", "デザイナーズ"] },
                    { text: "🎉 仲間と集まってワイワイ", value: "social", tags: ["シェアハウス", "交流", "ファミリー向け"] },
                    { text: "🌱 庭いじりや家庭菜園", value: "garden", tags: ["家庭菜園", "自然豊か"] }
                ]
            },
            {
                question: "家づくり、どう関わりたい？",
                key: "diy",
                options: [
                    { text: "🛠️ 自分の手で空間を創りたい", value: "yes", tags: ["DIY可", "古民家"] },
                    { text: "✨ キレイで完成された家がいい", value: "no", tags: ["リノベーション", "デザイナーズ"] }
                ]
            },
            {
                question: "人との繋がりはどのくらい大事？",
                key: "community",
                options: [
                    { text: "🤝 地域や住人との交流を楽しみたい", value: "important", tags: ["交流", "シェアハウス", "ファミリー向け"] },
                    { text: "🏠 プライベートな時間を大切にしたい", value: "private", tags: ["SOHO可"] }
                ]
            }
        ];

        let resultTypes = {
            '🧑‍🎨 クリエイティブ隠れ家タイプ': {
                answers: ['nature', 'creative', 'diy', 'private', 'remote', 'retro'],
                tags: ['自然豊か', 'DIY可', 'SOHO可'],
                comment: '静かな空間で、あなたのアイデアが花開くよ！'
            },
            '🤝 まちの交流HUBタイプ': {
                answers: ['city', 'social', 'complete', 'social', 'station', 'soho'],
                tags: ['シェアハウス', '交流', '駅近'],
                comment: 'みんなでつながる家、きっと見つかる！'
            },
            '🌾 スローライフ家庭菜園タイプ': {
                answers: ['nature', 'garden', 'diy', 'social', 'car', 'family'],
                tags: ['家庭菜園', 'ペット可', '庭付き'],
                comment: '自然と一緒に、ゆったり育む暮らしを♪'
            },
            '💻 スマートワーカータイプ': {
                answers: ['city', 'creative', 'complete', 'private', 'station', 'soho'],
                tags: ['駅近', 'デザイナーズ', 'SOHO可'],
                comment: '集中できる空間で、仕事も暮らしも快適に！'
            },
            '🏡 ファミリーハーモニータイプ': {
                answers: ['water', 'social', 'complete', 'social', 'car', 'family'],
                tags: ['ファミリー向け', '庭付き', '駐車場'],
                comment: '家族の笑顔があふれる家を見つけよう！'
            },
            '🪴 ローカル・コミュニティクリエイタータイプ': {
                answers: ['nature', 'creative', 'diy', 'social', 'walk', 'community'],
                tags: ['交流', 'DIY可', '古民家'],
                comment: 'あなたの手でまちをもっと素敵に！'
            }
        };

        let quizQuestions = [
            {
                question: "どんな場所で暮らしたい？",
                key: "location",
                iepitaComment: "まずは住む場所から選んでいこう！",
                options: [
                    { text: "🌿 自然豊か", value: "nature", tags: ["自然豊か", "古民家", "家庭菜園"] },
                    { text: "🏙️ 都会派", value: "city", tags: ["駅近", "SOHO可", "デザイナーズ"] },
                    { text: "🌊 海・川のそば", value: "water", tags: ["自然豊か", "海・川近く"] }
                ]
            },
            {
                question: "休日はどんな過ごし方をしたい？",
                key: "hobby",
                iepitaComment: "あなたらしい休日の過ごし方を教えて！",
                options: [
                    { text: "🎨 創作", value: "creative", tags: ["DIY可", "SOHO可", "デザイナーズ"] },
                    { text: "🎉 友人交流", value: "social", tags: ["シェアハウス", "交流", "ファミリー向け"] },
                    { text: "🌳 家庭菜園", value: "garden", tags: ["家庭菜園", "自然豊か", "庭付き"] }
                ]
            },
            {
                question: "家づくりにどのくらい関わりたい？",
                key: "diy",
                iepitaComment: "自分好みに手を加えるのも楽しいよね！",
                options: [
                    { text: "🛠️ DIYしたい", value: "diy", tags: ["DIY可", "古民家"] },
                    { text: "✨ 完成された家がいい", value: "complete", tags: ["リノベーション", "デザイナーズ"] }
                ]
            },
            {
                question: "人との繋がりをどう感じる？",
                key: "community",
                iepitaComment: "コミュニティとの関わり方も大切だね！",
                options: [
                    { text: "🤝 交流重視", value: "social", tags: ["交流", "シェアハウス", "ファミリー向け"] },
                    { text: "🏠 静かに過ごしたい", value: "private", tags: ["SOHO可", "静寂"] }
                ]
            },
            {
                question: "移動のしやすさ、どのくらい大事？",
                key: "transport",
                iepitaComment: "日々の移動も暮らしの質に関わるよ！",
                options: [
                    { text: "🚉 駅近がいい", value: "station", tags: ["駅近", "SOHO可"] },
                    { text: "🚗 車が使える場所", value: "car", tags: ["駐車場", "郊外"] },
                    { text: "🚶 徒歩圏で完結したい", value: "walk", tags: ["徒歩圏", "近隣施設充実"] }
                ]
            },
            {
                question: "理想の広さは？",
                key: "size",
                iepitaComment: "最後の質問だよ！もう少しで完了！",
                options: [
                    { text: "🏠 広々ファミリー向け", value: "family", tags: ["ファミリー向け", "広々", "庭付き"] },
                    { text: "🛋️ 1人暮らしに十分", value: "single", tags: ["コンパクト", "1人暮らし向け"] },
                    { text: "🏢 コンパクトSOHO", value: "soho", tags: ["SOHO可", "デザイナーズ", "コンパクト"] }
                ]
            },
            {
                question: "動物や植物と暮らしたい？",
                key: "nature",
                options: [
                    { text: "🐶 ペットOK必須", value: "pet", tags: ["ペット可", "庭付き"] },
                    { text: "🌿 庭がほしい", value: "garden", tags: ["庭付き", "家庭菜園", "自然豊か"] },
                    { text: "🚫 特にこだわらない", value: "none", tags: ["シンプル"] }
                ]
            },
            {
                question: "働くスタイルに合う家は？",
                key: "work",
                options: [
                    { text: "💻 在宅中心", value: "remote", tags: ["SOHO可", "静寂", "デザイナーズ"] },
                    { text: "🏢 外出多め", value: "office", tags: ["駅近", "通勤便利"] },
                    { text: "🧑‍🎓 学生生活メイン", value: "student", tags: ["学生向け", "シェアハウス", "交流"] }
                ]
            },
            {
                question: "どんな雰囲気が落ち着く？",
                key: "atmosphere",
                options: [
                    { text: "🪵 レトロ", value: "retro", tags: ["古民家", "レトロ", "DIY可"] },
                    { text: "🧱 モダン", value: "modern", tags: ["デザイナーズ", "モダン"] },
                    { text: "🌈 ナチュラル", value: "natural", tags: ["自然豊か", "ナチュラル", "庭付き"] },
                    { text: "🧡 個性的", value: "unique", tags: ["個性的", "DIY可", "デザイナーズ"] }
                ]
            },
            {
                question: "あなたの暮らしの目的に近いのは？",
                key: "lifestyle",
                options: [
                    { text: "🎓 学びの場", value: "learning", tags: ["学生向け", "SOHO可", "静寂"] },
                    { text: "💼 仕事の拠点", value: "work", tags: ["SOHO可", "駅近", "デザイナーズ"] },
                    { text: "👨‍👩‍👧‍👦 家族との時間", value: "family", tags: ["ファミリー向け", "広々", "庭付き"] },
                    { text: "🌱 地域貢献", value: "community", tags: ["交流", "地域密着", "シェアハウス"] }
                ]
            }
        ];

        const amenityIcons = {
            wifi: '<i class="fas fa-wifi"></i>',
            kitchen: '<i class="fas fa-utensils"></i>',
            parking: '<i class="fas fa-car"></i>',
            ac: '<i class="fas fa-snowflake"></i>',
            bath: '<i class="fas fa-bath"></i>',
            desk: '<i class="fas fa-briefcase"></i>',
            garden: '<i class="fas fa-leaf"></i>',
            lounge: '<i class="fas fa-couch"></i>'
        };

        // ========== DOM要素 ==========
        const appContainer = document.getElementById('app-container');
        const pages = {
            start: document.getElementById('page-start'),
            quiz: document.getElementById('page-quiz'),
            list: document.getElementById('page-list'),
            details: document.getElementById('page-details'),
            favorites: document.getElementById('page-favorites'),
            stars: document.getElementById('page-stars'),
            dislikes: document.getElementById('page-dislikes'),
            matching: document.getElementById('page-matching'),
            seller: document.getElementById('page-seller'),
        };
        const bottomNav = document.getElementById('bottom-nav');
        const propertyListContainer = document.getElementById('property-list-container');
        const favoritesListContainer = document.getElementById('favorites-list-container');
        const starsListContainer = document.getElementById('stars-list-container');
        const dislikesListContainer = document.getElementById('dislikes-list-container');
        const matchingContainer = document.getElementById('matching-container');
        const matchingEmpty = document.getElementById('matching-empty');
        const filterModal = document.getElementById('filter-modal');
        const filterPanel = document.getElementById('filter-panel');
        const toast = document.getElementById('toast');
        const toastMessage = document.getElementById('toast-message');

        // ========== データ読み込み ==========
        const API_ENDPOINTS = {
            properties: 'properties.json',
            quiz: 'quiz.json',
            // 将来のAPI接続用
            // properties: 'https://api.yourapp.com/properties',
            // quiz: 'https://api.yourapp.com/quiz',
            // municipalities: 'https://api.yourapp.com/municipalities'
        };

        const MAX_RETRIES = 3;
        const RETRY_DELAY = 1000; // 1秒

        // ローディング状態の管理
        const setLoadingState = (isLoading = true, message = 'データを読み込み中...') => {
            const loadingIndicator = document.getElementById('loading-indicator') || createLoadingIndicator();
            if (isLoading) {
                loadingIndicator.classList.remove('hidden');
                loadingIndicator.querySelector('.loading-message').textContent = message;
            } else {
                loadingIndicator.classList.add('hidden');
            }
        };

        // ローディングインジケーターを作成
        const createLoadingIndicator = () => {
            const indicator = document.createElement('div');
            indicator.id = 'loading-indicator';
            indicator.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center';
            indicator.innerHTML = `
                <div class="bg-white rounded-lg p-6 text-center shadow-lg">
                    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500 mx-auto mb-4"></div>
                    <div class="loading-message text-sm text-slate-600">データを読み込み中...</div>
                </div>
            `;
            document.body.appendChild(indicator);
            return indicator;
        };

        // リトライ機能付きfetch
        const fetchWithRetry = async (url, options = {}, retries = MAX_RETRIES) => {
            for (let attempt = 1; attempt <= retries; attempt++) {
                try {
                    console.log(`データ取得を試行中... (${attempt}/${retries}): ${url}`);

                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒タイムアウト

                    const response = await fetch(url, {
                        ...options,
                        signal: controller.signal,
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json',
                            ...options.headers
                        }
                    });

                    clearTimeout(timeoutId);

                    if (!response.ok) {
                        const errorData = await response.json().catch(() => null);
                        throw new Error(`HTTP ${response.status}: ${response.statusText}${errorData ? ` - ${JSON.stringify(errorData)}` : ''}`);
                    }

                    const data = await response.json();
                    console.log(`✅ データ取得成功 (${url}):`, data);
                    return data;

                } catch (error) {
                    console.warn(`❌ データ取得失敗 (${attempt}/${retries}): ${error.message}`);

                    if (attempt === retries) {
                        throw error;
                    }

                    // 指数バックオフで待機
                    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt));
                }
            }
        };

        // Firebase風のAPI呼び出しを模擬（将来の拡張用）
        const fetchAPI = async (endpoint, options = {}) => {
            const url = typeof endpoint === 'string' ? endpoint : endpoint.url;
            const isExternalAPI = url.startsWith('http');

            if (isExternalAPI) {
                // 外部APIの場合は認証トークンなどを追加
                const token = localStorage.getItem('auth_token');
                return await fetchWithRetry(url, {
                    ...options,
                    headers: {
                        'Authorization': token ? `Bearer ${token}` : '',
                        'X-API-Key': localStorage.getItem('api_key') || '',
                        ...options.headers
                    }
                });
            } else {
                // ローカルファイルの場合は既存の処理
                return await fetchWithRetry(url, options);
            }
        };

        // 自治体データAPIとの連携（将来の自治体API用）
        const fetchMunicipalitiesData = async () => {
            if (state.api.municipalities.length > 0) {
                return state.api.municipalities; // キャッシュされたデータを返す
            }

            try {
                console.log('🌐 自治体データを取得中...');
                setLoadingState(true, '自治体データを読み込み中...');

                // 外部自治体API（例：e-Stat, リクナビNEXT等）の模擬
                const municipalitiesEndpoint = 'https://api.municipality.com/v1/municipalities';

                // 実際のAPI呼び出しフロー
                const municipalitiesData = await fetchAPI(municipalitiesEndpoint, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'User-Agent': 'IEpita-Property-Search/1.0'
                    }
                });

                // データのバリデーション
                if (Array.isArray(municipalitiesData)) {
                    state.api.municipalities = municipalitiesData;
                    state.api.lastFetchTime = new Date().toISOString();

                    console.log(`🏛️ 自治体データ取得成功: ${municipalitiesData.length}件`);
                    setLoadingState(false);

                    return municipalitiesData;
                } else {
                    throw new Error('自治体データの形式が不正です');
                }

            } catch (error) {
                console.warn('自治体データ取得失敗:', error);
                setLoadingState(false);

                // フォールバック：ローカルデータを使用
                console.log('🔄 ローカル自治体データにフォールバック...');
                return await loadLocalMunicipalities();
            }
        };

        // ローカル自治体データの読み込み（フォールバック用）
        const loadLocalMunicipalities = async () => {
            try {
                const localData = await fetchAPI('municipalities.json');
                state.api.municipalities = localData;
                console.log('📁 ローカル自治体データ読み込み完了');
                return localData;
            } catch (error) {
                console.warn('ローカル自治体データも読み込み失敗:', error);
                // 最後の手段：properties.jsonから抽出
                const { prefectures, cityData } = extractRegionData();
                const municipalities = prefectures.map(prefecture => ({
                    prefecture_code: generatePrefectureCode(prefecture),
                    prefecture_name: prefecture,
                    municipalities: cityData[prefecture] || []
                }));
                state.api.municipalities = municipalities;
                return municipalities;
            }
        };

        // 都道府県コードの生成（簡易版）
        const generatePrefectureCode = (prefecture) => {
            const codes = {
                '北海道': '01', '青森県': '02', '岩手県': '03', '宮城県': '04',
                '秋田県': '05', '山形県': '06', '福島県': '07', '茨城県': '08',
                '栃木県': '09', '群馬県': '10', '埼玉県': '11', '千葉県': '12',
                '東京都': '13', '神奈川県': '14', '新潟県': '15', '富山県': '16',
                '石川県': '17', '福井県': '18', '山梨県': '19', '長野県': '20',
                '岐阜県': '21', '静岡県': '22', '愛知県': '23', '三重県': '24',
                '滋賀県': '25', '京都府': '26', '大阪府': '27', '兵庫県': '28',
                '奈良県': '29', '和歌山県': '30', '鳥取県': '31', '島根県': '32',
                '岡山県': '33', '広島県': '34', '山口県': '35', '徳島県': '36',
                '香川県': '37', '愛媛県': '38', '高知県': '39', '福岡県': '40',
                '佐賀県': '41', '長崎県': '42', '熊本県': '43', '大分県': '44',
                '宮崎県': '45', '鹿児島県': '46', '沖縄県': '47'
            };
            return codes[prefecture] || '99';
        };

        // メインデータ読み込み関数
        const loadData = async () => {
            setLoadingState(true, 'データを読み込み中...');

            try {
                // 並列でデータを読み込み（パフォーマンス向上）
                const [propertiesData, quizData] = await Promise.all([
                    fetchAPI(API_ENDPOINTS.properties).catch(error => {
                        console.error('Properties取得エラー:', error);
                        throw new Error(`物件データの取得に失敗しました: ${error.message}`);
                    }),
                    fetchAPI(API_ENDPOINTS.quiz).catch(error => {
                        console.error('Quiz取得エラー:', error);
                        throw new Error(`診断データの取得に失敗しました: ${error.message}`);
                    })
                ]);

                // データの検証
                if (!Array.isArray(propertiesData) || propertiesData.length === 0) {
                    throw new Error('物件データが無効または空です');
                }

                if (!quizData.questions || !Array.isArray(quizData.questions)) {
                    throw new Error('診断データが無効です');
                }

                // データを設定
                dummyProperties = propertiesData;
                quizQuestions = quizData.questions;
                resultTypes = {};

                // resultTypesをセットアップ
                if (quizData.resultTypes) {
                    for (const [typeName, typeData] of Object.entries(quizData.resultTypes)) {
                        resultTypes[typeName] = {
                            tagWeights: typeData.tagWeights || {},
                            comment: typeData.iepitaComment || 'きっと素敵な住まいが見つかるよ♪',
                            description: typeData.description || ''
                        };
                    }
                }

                // 成功メッセージ
                console.log('🚀 データ読み込み完了:', {
                    properties: dummyProperties.length,
                    questions: quizQuestions.length,
                    resultTypes: Object.keys(resultTypes).length
                });

                setLoadingState(false);

                // API状態を更新
                state.api.dataLoaded = true;
                state.api.isLoading = false;
                state.api.lastError = null;
                state.api.lastFetchTime = new Date().toISOString();

                // 初回読み込みフラグのみ更新（トースト通知は表示しない）
                if (!state.dataLoaded) {
                    state.dataLoaded = true;
                }

            } catch (error) {
                console.error('💥 データ読み込みエラー:', error);
                setLoadingState(false);

                // API状態を更新
                state.api.isLoading = false;
                state.api.lastError = error.message;

                // エラー表示UIを更新（file://プロトコルの場合は非表示）
                const isFileProtocol = window.location.protocol === 'file:';
                if (!isFileProtocol) {
                    showDataLoadError(error.message);
                } else {
                    console.warn('📢 file://プロトコルで実行中 - JSONファイルが読み込めません');
                    console.warn('💡 ローカルサーバーを起動すると19件の物件データが利用できます');
                }

                // フォールバック: 最小限のサンプルデータを使用
                console.warn('🔄 フォールバックモードに切り替え - 最小限のサンプルデータを使用');

                // 物件データが空の場合、フォールバックデータを設定（19件）
                if (!dummyProperties || dummyProperties.length === 0) {
                    console.log('🆘 緊急フォールバックデータを使用（19件）');
                    dummyProperties = [
                        { id: 1, title: '緑に囲まれた静かな古民家', address: '東京都調布市深大寺元町', price: 85000, layout: '3DK', age: 60, station_distance: 20, tags: ['古民家', '自然豊か', 'DIY可', 'ペット可'], amenities: ['wifi', 'kitchen', 'parking', 'ac'], exterior_images: ['https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800&h=600&fit=crop', 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&h=600&fit=crop'], interior_images: ['https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&h=600&fit=crop', 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&h=600&fit=crop'], coordinates: [35.698, 139.553] },
                        { id: 2, title: '駅近！リノベーション済みアパート', address: '東京都調布市布田', price: 110000, layout: '1LDK', age: 15, station_distance: 5, tags: ['駅近', 'リノベーション', '都市ガス'], amenities: ['wifi', 'kitchen', 'ac', 'bath'], exterior_images: ['https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&h=600&fit=crop', 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&h=600&fit=crop'], interior_images: ['https://images.unsplash.com/photo-1560448204-61dc36dc98c8?w=800&h=600&fit=crop', 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&h=600&fit=crop'], coordinates: [35.652, 139.544] },
                        { id: 3, title: 'クリエイター向けSOHO可能物件', address: '東京都調布市仙川町', price: 130000, layout: '2DK', age: 25, station_distance: 8, tags: ['SOHO可', 'デザイナーズ', '日当たり良好'], amenities: ['wifi', 'kitchen', 'ac', 'desk'], exterior_images: ['https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&h=600&fit=crop', 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&h=600&fit=crop'], interior_images: ['https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&h=600&fit=crop', 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=800&h=600&fit=crop'], coordinates: [35.662, 139.585] },
                        { id: 4, title: 'ファミリー向け広々一戸建て', address: '東京都調布市国領町', price: 145000, layout: '4LDK', age: 18, station_distance: 10, tags: ['ファミリー向け', '庭付き', '駐車場2台', '収納充実'], amenities: ['wifi', 'kitchen', 'parking', 'ac', 'bath', 'desk'], exterior_images: ['https://images.unsplash.com/photo-1572120360610-d971b9d7767c?w=800&h=600&fit=crop', 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&h=600&fit=crop'], interior_images: ['https://images.unsplash.com/photo-1600210492493-0946911123ea?w=800&h=600&fit=crop', 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800&h=600&fit=crop'], coordinates: [35.655, 139.557] },
                        { id: 5, title: '札幌駅近！都会派マンション', address: '北海道札幌市中央区北3条', price: 75000, layout: '1LDK', age: 12, station_distance: 5, tags: ['駅近', 'リノベーション', '都市ガス', 'オートロック'], amenities: ['wifi', 'kitchen', 'ac', 'bath'], exterior_images: ['https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&h=600&fit=crop', 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&h=600&fit=crop'], interior_images: ['https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&h=600&fit=crop', 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&h=600&fit=crop'], coordinates: [43.068, 141.351] },
                        { id: 6, title: '函館の歴史的古民家', address: '北海道函館市元町', price: 68000, layout: '3DK', age: 80, station_distance: 15, tags: ['古民家', '歴史的建造物', 'DIY可', '海が見える'], amenities: ['wifi', 'kitchen', 'parking', 'ac'], exterior_images: ['https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800&h=600&fit=crop', 'https://images.unsplash.com/photo-1566908829550-e6551b00979b?w=800&h=600&fit=crop'], interior_images: ['https://images.unsplash.com/photo-1540979388789-6cee28a1cdc9?w=800&h=600&fit=crop', 'https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?w=800&h=600&fit=crop'], coordinates: [41.769, 140.729] },
                        { id: 7, title: '小樽運河沿い倉庫リノベ物件', address: '北海道小樽市色内', price: 82000, layout: '1SLDK', age: 45, station_distance: 12, tags: ['リノベーション', 'デザイナーズ', 'SOHO可', '倉庫改装'], amenities: ['wifi', 'kitchen', 'ac', 'desk'], exterior_images: ['https://images.unsplash.com/photo-1480074568708-e7b720bb3f09?w=800&h=600&fit=crop', 'https://images.unsplash.com/photo-1511452885600-a3d2c9148a31?w=800&h=600&fit=crop'], interior_images: ['https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&h=600&fit=crop', 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=800&h=600&fit=crop'], coordinates: [43.191, 140.995] },
                        { id: 8, title: '富良野ラベンダー畑近く田舎暮らし', address: '北海道富良野市北の峰町', price: 45000, layout: '2LDK', age: 35, station_distance: 25, tags: ['自然豊か', '家庭菜園可', 'ペット可', '格安'], amenities: ['wifi', 'kitchen', 'parking', 'ac'], exterior_images: ['https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&h=600&fit=crop', 'https://images.unsplash.com/photo-1599809275671-b5942cabc7a2?w=800&h=600&fit=crop'], interior_images: ['https://images.unsplash.com/photo-1600489000022-c2086d79f9d4?w=800&h=600&fit=crop', 'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=800&h=600&fit=crop'], coordinates: [43.355, 142.383] },
                        { id: 9, title: '旭川市中心部の広々3LDK', address: '北海道旭川市1条通', price: 62000, layout: '3LDK', age: 22, station_distance: 8, tags: ['ファミリー向け', '収納充実', '都市ガス', '日当たり良好'], amenities: ['wifi', 'kitchen', 'parking', 'ac', 'bath'], exterior_images: ['https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=800&h=600&fit=crop', 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&h=600&fit=crop'], interior_images: ['https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=800&h=600&fit=crop', 'https://images.unsplash.com/photo-1600573472591-ee6b68d14f8d?w=800&h=600&fit=crop'], coordinates: [43.771, 142.365] },
                        { id: 10, title: '帯広・十勝平野の農地付き物件', address: '北海道帯広市西帯広', price: 52000, layout: '3DK', age: 40, station_distance: 20, tags: ['家庭菜園可', '自然豊か', 'DIY可', '格安'], amenities: ['wifi', 'kitchen', 'parking', 'ac'], exterior_images: ['https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=800&h=600&fit=crop', 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=800&h=600&fit=crop'], interior_images: ['https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&h=600&fit=crop', 'https://images.unsplash.com/photo-1600489000022-c2086d79f9d4?w=800&h=600&fit=crop'], coordinates: [42.924, 143.195] },
                        { id: 11, title: '釧路・海の見える絶景物件', address: '北海道釧路市幸町', price: 58000, layout: '2LDK', age: 28, station_distance: 18, tags: ['海が見える', '自然豊か', 'ペット可', '格安'], amenities: ['wifi', 'kitchen', 'parking', 'ac', 'bath'], exterior_images: ['https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?w=800&h=600&fit=crop', 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&h=600&fit=crop'], interior_images: ['https://images.unsplash.com/photo-1560448204-61dc36dc98c8?w=800&h=600&fit=crop', 'https://images.unsplash.com/photo-1600489000022-c2086d79f9d4?w=800&h=600&fit=crop'], coordinates: [42.985, 144.382] },
                        { id: 12, title: '北見・格安シェアハウス', address: '北海道北見市北進町', price: 38000, layout: '個室8畳', age: 15, station_distance: 10, tags: ['シェアハウス', '格安', '共有スペース充実', '学生向け'], amenities: ['wifi', 'kitchen', 'ac', 'bath'], exterior_images: ['https://images.unsplash.com/photo-1600607687644-c7171b42498b?w=800&h=600&fit=crop', 'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=800&h=600&fit=crop'], interior_images: ['https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&h=600&fit=crop', 'https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?w=800&h=600&fit=crop'], coordinates: [43.804, 143.896] },
                        { id: 13, title: '苫小牧・港近く工業地帯アクセス良好', address: '北海道苫小牧市錦町', price: 48000, layout: '1K', age: 20, station_distance: 12, tags: ['格安', '駐車場付き', '工業地帯近く', '単身向け'], amenities: ['wifi', 'kitchen', 'parking', 'ac'], exterior_images: ['https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&h=600&fit=crop', 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&h=600&fit=crop'], interior_images: ['https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&h=600&fit=crop', 'https://images.unsplash.com/photo-1560448204-61dc36dc98c8?w=800&h=600&fit=crop'], coordinates: [42.634, 141.606] },
                        { id: 14, title: 'ニセコ・ペンション風一戸建て', address: '北海道虻田郡ニセコ町中央通', price: 95000, layout: '3LDK', age: 16, station_distance: 8, tags: ['リゾート', 'ペット可', '自然豊か', 'スキー場近く'], amenities: ['wifi', 'kitchen', 'parking', 'ac', 'bath'], exterior_images: ['https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&h=600&fit=crop', 'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=800&h=600&fit=crop'], interior_images: ['https://images.unsplash.com/photo-1600210492493-0946911123ea?w=800&h=600&fit=crop', 'https://images.unsplash.com/photo-1600573472605-af76c6c4a59d?w=800&h=600&fit=crop'], coordinates: [42.805, 140.687] },
                        { id: 15, title: '室蘭・海沿いのモダンアパート', address: '北海道室蘭市海岸町', price: 55000, layout: '2DK', age: 25, station_distance: 14, tags: ['海が見える', '格安', 'オーシャンビュー', '静か'], amenities: ['wifi', 'kitchen', 'ac', 'bath'], exterior_images: ['https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&h=600&fit=crop', 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&h=600&fit=crop'], interior_images: ['https://images.unsplash.com/photo-1560448204-61dc36dc98c8?w=800&h=600&fit=crop', 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&h=600&fit=crop'], coordinates: [42.315, 140.974] },
                        { id: 16, title: '札幌円山エリア・高級住宅地', address: '北海道札幌市中央区円山', price: 125000, layout: '3LDK', age: 8, station_distance: 7, tags: ['高級住宅地', 'リノベーション', 'デザイナーズ', '駅近'], amenities: ['wifi', 'kitchen', 'parking', 'ac', 'bath', 'desk'], exterior_images: ['https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&h=600&fit=crop', 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&h=600&fit=crop'], interior_images: ['https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=800&h=600&fit=crop', 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800&h=600&fit=crop'], coordinates: [43.043, 141.322] },
                        { id: 17, title: '美瑛の丘・農家住宅', address: '北海道上川郡美瑛町大町', price: 40000, layout: '4DK', age: 50, station_distance: 30, tags: ['農家住宅', '自然豊か', '家庭菜園可', 'DIY可'], amenities: ['kitchen', 'parking', 'ac'], exterior_images: ['https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800&h=600&fit=crop', 'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=800&h=600&fit=crop'], interior_images: ['https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&h=600&fit=crop', 'https://images.unsplash.com/photo-1600489000022-c2086d79f9d4?w=800&h=600&fit=crop'], coordinates: [43.589, 142.471] },
                        { id: 18, title: '登別温泉街・ペンション併用物件', address: '北海道登別市登別温泉町', price: 88000, layout: '2LDK+客室2室', age: 30, station_distance: 10, tags: ['温泉付き', '店舗併用', 'リゾート', 'ペンション'], amenities: ['wifi', 'kitchen', 'parking', 'ac', 'bath'], exterior_images: ['https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&h=600&fit=crop', 'https://images.unsplash.com/photo-1566908829550-e6551b00979b?w=800&h=600&fit=crop'], interior_images: ['https://images.unsplash.com/photo-1540979388789-6cee28a1cdc9?w=800&h=600&fit=crop', 'https://images.unsplash.com/photo-1600210492493-0946911123ea?w=800&h=600&fit=crop'], coordinates: [42.491, 141.163] },
                        { id: 19, title: '札幌すすきの徒歩圏内ワンルーム', address: '北海道札幌市中央区南5条', price: 52000, layout: '1R', age: 18, station_distance: 3, tags: ['駅近', '繁華街近く', '格安', '単身向け'], amenities: ['wifi', 'kitchen', 'ac'], exterior_images: ['https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&h=600&fit=crop', 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&h=600&fit=crop'], interior_images: ['https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?w=800&h=600&fit=crop', 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&h=600&fit=crop'], coordinates: [43.052, 141.353] }
                    ];
                    state.api.dataLoaded = true;
                    console.log('✅ フォールバックデータ設定完了:', dummyProperties.length, '件');
                }

                // 診断データも同様
                if (!quizQuestions || quizQuestions.length === 0) {
                    quizQuestions = quizData;  // index.html内の診断データを使用
                    console.log('✅ フォールバック診断データを使用');
                }

                if (!resultTypes || Object.keys(resultTypes).length === 0) {
                    // index.html内のresultTypesを使用
                    console.log('✅ フォールバック診断結果タイプを使用');
                }

                // フォールバックデータが設定されたので、APIデータとしてマーク
                state.api.dataLoaded = true;
                console.log('🟡 フォールバックモードで動作中 - 基本機能は利用可能');
            }
        };

        // データ読み込みエラーの表示
        const showDataLoadError = (message) => {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'fixed top-4 left-4 right-4 bg-red-50 border border-red-200 rounded-lg p-4 shadow-lg z-50';
            errorDiv.innerHTML = `
                <div class="flex items-start">
                    <div class="text-red-600">
                        <i class="fas fa-exclamation-triangle text-lg"></i>
                    </div>
                    <div class="ml-3 flex-1">
                        <h3 class="text-sm font-medium text-red-800">データ読み込みエラー</h3>
                        <p class="text-sm text-red-700 mt-1">${message}</p>
                        <button onclick="this.parentElement.parentElement.parentElement.remove(); loadData();"
                                class="mt-3 text-xs bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700">
                            <i class="fas fa-redo mr-1"></i>再試行
                        </button>
                    </div>
                    <button onclick="this.parentElement.parentElement.remove();"
                            class="ml-3 text-red-400 hover:text-red-600">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
            document.body.appendChild(errorDiv);

            // 5秒後に自動非表示
            setTimeout(() => {
                if (errorDiv.parentElement) {
                    errorDiv.remove();
                }
            }, 5000);
        };

        // ========== API状態チェック関数 ==========
        const isDataLoaded = () => state.api.dataLoaded && dummyProperties.length > 0;

        const checkDataAvailability = () => {
            if (!isDataLoaded()) {
                console.warn('⚠️ データが読み込まれていません');
                return false;
            }
            return true;
        };

        // ========== データ再読み込み機能 ==========
        const refreshData = async () => {
            console.log('🔄 データを再読み込み中...');
            await loadData();

            // 自治体データの更新も試行（オプション）
            try {
                await fetchMunicipalitiesData();
            } catch (error) {
                console.warn('自治体データ更新失敗:', error);
            }
        };

        // ========== データ保存の自動化 ==========
        const saveAllUserData = () => {
            console.log('💾 全ユーザーデータを保存中...');
            savedRatings.saveAll(state);
        };

        // データの整合性チェック
        const validateUserData = () => {
            const issues = [];

            // 配列の型チェック
            if (!Array.isArray(state.favorites)) {
                issues.push('favorites is not an array');
                state.favorites = [];
            }
            if (!Array.isArray(state.stars)) {
                issues.push('stars is not an array');
                state.stars = [];
            }
            if (!Array.isArray(state.dislikes)) {
                issues.push('dislikes is not an array');
                state.dislikes = [];
            }

            // 重複チェック
            const allIds = [...state.favorites, ...state.stars, ...state.dislikes];
            const uniqueIds = [...new Set(allIds)];
            if (allIds.length !== uniqueIds.length) {
                issues.push('duplicate IDs found in user data');
            }

            if (issues.length > 0) {
                console.warn('⚠️ データ整合性の問題を検出:', issues);
                // 問題がある場合は保存し直す
                saveAllUserData();
            } else {
                console.log('✅ データ整合性チェック完了');
            }
        };

        // 全データのリセット機能
        const resetAllUserData = () => {
            if (confirm('すべてのユーザーデータ（お気に入り、スターマーク、興味なし）を削除しますか？')) {
                state.favorites = [];
                state.stars = [];
                state.dislikes = [];

                savedRatings.clearAll();

                console.log('🗑️ 全ユーザーデータをリセットしました');
                showToast('すべてのデータをリセットしました');

                // 現在のページを再描画
                if (state.currentPage === 'favorites') renderFavorites();
                if (state.currentPage === 'stars') renderStars();
                if (state.currentPage === 'dislikes') renderDislikes();
            }
        };

        // 定期的な自動保存（30秒ごと）
        const startAutoSave = () => {
            setInterval(() => {
                saveAllUserData();
            }, 30000); // 30秒
        };

        // ページ離脱時の保存
        const setupPageUnloadSave = () => {
            window.addEventListener('beforeunload', (e) => {
                saveAllUserData();
                console.log('🚪 ページ離脱時にデータを保存しました');
            });

            // ページが非表示になった時も保存
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) {
                    saveAllUserData();
                    console.log('👁️ ページ非表示時にデータを保存しました');
                }
            });
        };


        // ========== チャットボット機能 ==========

        // === チャットボットの状態管理 ===
        const chatbotState = {
            propertyId: null,
            inquiryType: null,
            visitDate: null,
            message: null,
            userName: null,
            userEmail: null,
            userPhone: null
        };
        // === 段階1: モーダル開閉 ===
        // グローバルスコープに公開（HTMLのonclickから呼び出せるように）
        window.openChatbotModal = (propertyId) => {
            const property = dummyProperties.find(p => p.id === propertyId);
            chatbotState.propertyId = propertyId;

            const modal = document.getElementById('chatbot-modal');
            modal.classList.remove('hidden');

            // 初期メッセージ表示
            setTimeout(() => {
                addIepitaMessage(`こんにちは！「${property.title}」について質問があるんだね！`);
                setTimeout(() => {
                    const typing = showTypingIndicator();
                    setTimeout(() => {
                        typing.remove();
                        addIepitaMessage('どんなことが知りたい？');
                        setTimeout(() => showInquiryTypeOptions(), 500);
                    }, 1500);
                }, 1000);
            }, 300);
        };

        window.closeChatbotModal = () => {
            const modal = document.getElementById('chatbot-modal');
            modal.classList.add('hidden');
            document.getElementById('chat-messages').innerHTML = '';
            document.getElementById('chat-input-area').innerHTML = '';

            // 状態をリセット
            chatbotState.propertyId = null;
            chatbotState.inquiryType = null;
            chatbotState.visitDate = null;
            chatbotState.message = null;
            chatbotState.userName = null;
            chatbotState.userEmail = null;
            chatbotState.userPhone = null;
        };

        // === 段階2: メッセージ表示 ===

        // いえっぴのメッセージを追加（内部関数なのでconstのまま）
        const addIepitaMessage = (text) => {
            const messagesContainer = document.getElementById('chat-messages');
            const messageDiv = document.createElement('div');
            messageDiv.className = 'chat-message iepita';
            messageDiv.innerHTML = `
                <img src="iepita.png" class="w-8 h-8 flex-shrink-0" alt="いえっぴ">
                <div class="chat-bubble iepita">${text}</div>
            `;
            messagesContainer.appendChild(messageDiv);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        };

        // ユーザーのメッセージを追加
        const addUserMessage = (text) => {
            const messagesContainer = document.getElementById('chat-messages');
            const messageDiv = document.createElement('div');
            messageDiv.className = 'chat-message user';
            messageDiv.innerHTML = `
                <div class="chat-bubble user">${text}</div>
            `;
            messagesContainer.appendChild(messageDiv);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        };

        // タイピングインジケータ表示
        const showTypingIndicator = () => {
            const messagesContainer = document.getElementById('chat-messages');
            const typingDiv = document.createElement('div');
            typingDiv.className = 'chat-message iepita typing-message';
            typingDiv.innerHTML = `
                <img src="iepita.png" class="w-8 h-8 flex-shrink-0" alt="いえっぴ">
                <div class="typing-indicator">
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                </div>
            `;
            messagesContainer.appendChild(typingDiv);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
            return typingDiv;
        };

        // === 段階3: 選択肢機能 ===

        // ステップ1: 問い合わせタイプ選択
        window.showInquiryTypeOptions = () => {
            const inputArea = document.getElementById('chat-input-area');
            inputArea.innerHTML = `
                <div class="space-y-2">
                    <button onclick="selectInquiryType('details')" class="chat-option-btn w-full">
                        📝 物件の詳細を聞きたい
                    </button>
                    <button onclick="selectInquiryType('visit')" class="chat-option-btn w-full">
                        🏠 内見・見学をしたい
                    </button>
                    <button onclick="selectInquiryType('contract')" class="chat-option-btn w-full">
                        📋 契約条件について相談したい
                    </button>
                    <button onclick="selectInquiryType('other')" class="chat-option-btn w-full">
                        💬 その他の質問
                    </button>
                </div>
            `;
        };

        window.selectInquiryType = (type) => {
            const typeTexts = {
                'details': '📝 物件の詳細を聞きたい',
                'visit': '🏠 内見・見学をしたい',
                'contract': '📋 契約条件について相談したい',
                'other': '💬 その他の質問'
            };

            addUserMessage(typeTexts[type]);
            chatbotState.inquiryType = type;

            // 入力エリアをクリア
            document.getElementById('chat-input-area').innerHTML = '';

            // タイピング表示
            const typing = showTypingIndicator();
            setTimeout(() => {
                typing.remove();
                if (type === 'visit') {
                    addIepitaMessage('いいね！いつ頃見学できそう？');
                    setTimeout(() => showVisitDateOptions(), 500);
                } else {
                    addIepitaMessage('わかった！詳しく教えてもらえる？');
                    setTimeout(() => showMessageInput(), 500);
                }
            }, 1000);
        };

        // ステップ2: 見学日時選択（内見の場合のみ）
        window.showVisitDateOptions = () => {
            const inputArea = document.getElementById('chat-input-area');
            inputArea.innerHTML = `
                <div class="space-y-2">
                    <button onclick="selectVisitDate('this-week')" class="chat-option-btn w-full">
                        📅 今週中
                    </button>
                    <button onclick="selectVisitDate('next-week')" class="chat-option-btn w-full">
                        📅 来週
                    </button>
                    <button onclick="selectVisitDate('after-next')" class="chat-option-btn w-full">
                        📅 再来週以降
                    </button>
                    <button onclick="selectVisitDate('flexible')" class="chat-option-btn w-full">
                        🤔 調整したい
                    </button>
                </div>
            `;
        };

        window.selectVisitDate = (date) => {
            const dateTexts = {
                'this-week': '📅 今週中',
                'next-week': '📅 来週',
                'after-next': '📅 再来週以降',
                'flexible': '🤔 調整したい'
            };

            addUserMessage(dateTexts[date]);
            chatbotState.visitDate = date;

            document.getElementById('chat-input-area').innerHTML = '';

            const typing = showTypingIndicator();
            setTimeout(() => {
                typing.remove();
                addIepitaMessage('了解！何か特に伝えたいことはある？');
                // 段階4で実装するshowMessageInput()を呼ぶ
                setTimeout(() => {
                    showMessageInput();
                }, 500);
            }, 1000);
        };

        // === 段階4: フォーム入力 ===

        // ステップ3: メッセージ入力
        window.showMessageInput = () => {
            const inputArea = document.getElementById('chat-input-area');
            inputArea.innerHTML = `
                <div class="space-y-2">
                    <textarea id="chat-message-input"
                              class="chat-textarea"
                              rows="3"
                              placeholder="質問や要望があれば教えてね（スキップもOK）"></textarea>
                    <button onclick="submitMessage()" class="chat-submit-btn w-full">
                        次へ進む →
                    </button>
                </div>
            `;
            document.getElementById('chat-message-input').focus();
        };

        window.submitMessage = () => {
            const input = document.getElementById('chat-message-input');
            const message = input.value.trim();

            if (message) {
                addUserMessage(message);
                chatbotState.message = message;
            } else {
                addUserMessage('（特になし）');
            }

            document.getElementById('chat-input-area').innerHTML = '';

            const typing = showTypingIndicator();
            setTimeout(() => {
                typing.remove();
                addIepitaMessage('ありがとう！最後に連絡先を教えてね！');
                setTimeout(() => showContactForm(), 500);
            }, 1000);
        };

        // ステップ4: 連絡先フォーム
        window.showContactForm = () => {
            const inputArea = document.getElementById('chat-input-area');
            inputArea.innerHTML = `
                <div class="space-y-3">
                    <input type="text" id="chat-name"
                           class="chat-input"
                           placeholder="お名前 *" required>
                    <input type="email" id="chat-email"
                           class="chat-input"
                           placeholder="メールアドレス *" required>
                    <input type="tel" id="chat-phone"
                           class="chat-input"
                           placeholder="電話番号（任意）">
                    <button onclick="submitInquiry()" class="chat-submit-btn w-full">
                        📨 問い合わせを送信
                    </button>
                </div>
            `;
            document.getElementById('chat-name').focus();
        };

        window.submitInquiry = () => {
            const name = document.getElementById('chat-name').value.trim();
            const email = document.getElementById('chat-email').value.trim();
            const phone = document.getElementById('chat-phone').value.trim();

            if (!name || !email) {
                alert('お名前とメールアドレスは必須です');
                return;
            }

            // 簡易的なメールバリデーション
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                alert('正しいメールアドレスを入力してください');
                return;
            }

            chatbotState.userName = name;
            chatbotState.userEmail = email;
            chatbotState.userPhone = phone;

            // === 段階5: localStorageに保存 ===
            const property = dummyProperties.find(p => p.id === chatbotState.propertyId);
            const inquiry = {
                id: Date.now(),
                timestamp: new Date().toISOString(),
                property: {
                    id: property.id,
                    title: property.title,
                    address: property.address,
                    price: property.price
                },
                inquiryType: chatbotState.inquiryType,
                visitDate: chatbotState.visitDate,
                message: chatbotState.message,
                userName: name,
                userEmail: email,
                userPhone: phone,
                status: 'new' // new, contacted, completed
            };

            const inquiries = JSON.parse(localStorage.getItem('inquiries') || '[]');
            inquiries.push(inquiry);
            localStorage.setItem('inquiries', JSON.stringify(inquiries));

            console.log('✅ 問い合わせ保存完了:', inquiry);
            console.log('📊 保存された問い合わせ総数:', inquiries.length);

            // ユーザーメッセージとして表示
            addUserMessage(`${name} / ${email}${phone ? ' / ' + phone : ''}`);

            document.getElementById('chat-input-area').innerHTML = '';

            const typing = showTypingIndicator();
            setTimeout(() => {
                typing.remove();
                addIepitaMessage('問い合わせを受け付けたよ！✨');
                setTimeout(() => {
                    addIepitaMessage('担当者から2営業日以内に連絡するから、楽しみに待っててね！');
                    setTimeout(() => showCloseButton(), 500);
                }, 1000);
            }, 1000);
        };

        window.showCloseButton = () => {
            const inputArea = document.getElementById('chat-input-area');
            inputArea.innerHTML = `
                <button onclick="closeChatbotModal()" class="w-full bg-slate-800 text-white font-bold py-3 rounded-xl hover:bg-slate-700 transition">
                    閉じる
                </button>
            `;
        };

        // ========== オンボーディング機能 ==========

        // === オンボーディングステップの定義 ===
        const onboardingSteps = [
            {
                id: 'step1',
                target: '#start-quiz-btn',
                title: '診断をはじめよう！',
                description: '10個の質問に答えて、あなたにぴったりの物件を見つけます。所要時間は約1分です。',
                tooltipPosition: 'top',
                arrowDirection: 'down'
            },
            {
                id: 'step2',
                target: '.nav-btn[data-page="matching"]',
                title: 'マッチングモード',
                description: 'Tinder風のスワイプで楽しく物件を評価できます！左：お気に入り、右：スター、上：興味なし',
                tooltipPosition: 'top',
                arrowDirection: 'down',
                requirePage: 'list'
            },
            {
                id: 'step3',
                target: '.toggle-favorite-btn',
                title: 'お気に入りを保存しよう',
                description: 'ハートマークで物件を保存できます。スターマークや興味なしも使ってみてください！',
                tooltipPosition: 'bottom',
                arrowDirection: 'up',
                requirePage: 'list'
            },
            {
                id: 'step4',
                target: null,
                title: '準備完了！🎉',
                description: 'これで「いえぴた！」の使い方はバッチリです。さあ、あなたにぴったりの物件を見つけましょう！',
                tooltipPosition: 'center',
                arrowDirection: null
            }
        ];

        // === 段階2: ステップ管理 ===
        const onboardingState = {
            currentStep: 0,
            isActive: false,
            completed: false
        };

        // オンボーディングを開始
        window.startOnboarding = () => {
            console.log('📖 チュートリアル（オンボーディング）を開始します...');
            playTutorialSound(); // チュートリアル開始効果音を再生

            onboardingState.currentStep = 0;
            onboardingState.isActive = true;

            const modal = document.getElementById('onboarding-modal');
            modal.classList.remove('hidden');

            showOnboardingStep(0);
        };

        // オンボーディングを終了
        window.closeOnboarding = (saveCompleted = true) => {
            const modal = document.getElementById('onboarding-modal');
            modal.classList.add('hidden');

            onboardingState.isActive = false;

            if (saveCompleted) {
                localStorage.setItem('onboarding_completed', 'true');
                onboardingState.completed = true;
            }

            // ハイライトを解除
            document.querySelectorAll('.onboarding-highlight').forEach(el => {
                el.classList.remove('onboarding-highlight');
            });
        };

        // 次のステップへ
        window.nextOnboardingStep = () => {
            // チュートリアルのステップ移動音を再生
            playQuizSound(); // 軽快なクリック音

            if (onboardingState.currentStep < onboardingSteps.length - 1) {
                onboardingState.currentStep++;
                console.log(`📖 チュートリアル: ステップ ${onboardingState.currentStep + 1}/${onboardingSteps.length} へ移動`);
                showOnboardingStep(onboardingState.currentStep);
            } else {
                // 最後のステップ→完了
                console.log('🎉 チュートリアル完了！');
                closeOnboarding(true);
                // スタートページに戻る
                navigateTo('start');
            }
        };

        // プログレスドットを更新
        const updateOnboardingProgress = (currentStep) => {
            const progressContainer = document.getElementById('onboarding-progress');
            progressContainer.innerHTML = onboardingSteps.map((step, index) => `
                <div class="onboarding-dot ${index === currentStep ? 'active' : ''}"></div>
            `).join('');

            document.getElementById('onboarding-step-text').textContent =
                `${currentStep + 1} / ${onboardingSteps.length}`;
        };

        // === 段階3: ターゲットハイライト ===

        // ステップを表示
        const showOnboardingStep = (stepIndex) => {
            const step = onboardingSteps[stepIndex];

            // 必要なページに移動
            if (step.requirePage && state.currentPage !== step.requirePage) {
                navigateTo(step.requirePage);
                // ページ遷移アニメーション待機
                setTimeout(() => {
                    showOnboardingStep(stepIndex);
                }, 500);
                return;
            }

            // プログレス更新
            updateOnboardingProgress(stepIndex);

            // コンテンツ更新
            document.getElementById('onboarding-title').textContent = step.title;
            document.getElementById('onboarding-description').textContent = step.description;

            // ボタンテキスト更新
            const nextBtn = document.getElementById('onboarding-next');
            nextBtn.textContent = stepIndex === onboardingSteps.length - 1 ? '完了！' : '次へ →';

            if (step.target) {
                // ターゲット要素を取得
                const targetElement = document.querySelector(step.target);

                if (targetElement) {
                    // スポットライトとツールチップを配置
                    positionOnboardingElements(targetElement, step);
                } else {
                    console.warn('ターゲット要素が見つかりません:', step.target);
                    // フォールバック：センター表示
                    positionOnboardingCenter(step);
                }
            } else {
                // センター表示（ターゲットなし）
                positionOnboardingCenter(step);
            }

            console.log(`ステップ${stepIndex + 1}を表示:`, step.title);
        };

        // ターゲット要素をハイライトしてツールチップを配置
        const positionOnboardingElements = (targetElement, step) => {
            const spotlight = document.getElementById('onboarding-spotlight');
            const tooltip = document.getElementById('onboarding-tooltip');
            const arrow = document.getElementById('onboarding-arrow');

            // ターゲット要素をハイライト
            document.querySelectorAll('.onboarding-highlight').forEach(el => {
                el.classList.remove('onboarding-highlight');
            });
            targetElement.classList.add('onboarding-highlight');

            // まずスクロール（スムーズ）
            targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

            // スクロール完了を待ってから位置を取得・配置
            setTimeout(() => {
                // ターゲット要素の位置を取得
                const rect = targetElement.getBoundingClientRect();

                // スポットライトを配置
                spotlight.style.display = 'block';
                spotlight.style.top = `${rect.top - 8}px`;
                spotlight.style.left = `${rect.left - 8}px`;
                spotlight.style.width = `${rect.width + 16}px`;
                spotlight.style.height = `${rect.height + 16}px`;

                // ツールチップの位置を計算
                tooltip.style.transform = 'none';
                const tooltipRect = tooltip.getBoundingClientRect();

                // 矢印を表示
                arrow.style.display = 'block';

                if (step.tooltipPosition === 'top') {
                    // ツールチップを上に配置
                    const tooltipTop = Math.max(16, rect.top - tooltipRect.height - 60);
                    const tooltipLeft = Math.max(16, Math.min(
                        window.innerWidth - tooltipRect.width - 16,
                        rect.left + rect.width / 2 - tooltipRect.width / 2
                    ));

                    tooltip.style.top = `${tooltipTop}px`;
                    tooltip.style.left = `${tooltipLeft}px`;

                    // 矢印を配置（ツールチップの下、ターゲットの上）
                    arrow.style.top = `${rect.top - 50}px`;
                    arrow.style.left = `${rect.left + rect.width / 2 - 20}px`;
                    arrow.innerHTML = '<i class="fas fa-arrow-down"></i>';
                } else if (step.tooltipPosition === 'bottom') {
                    // ツールチップを下に配置
                    const tooltipTop = rect.bottom + 60;
                    const tooltipLeft = Math.max(16, Math.min(
                        window.innerWidth - tooltipRect.width - 16,
                        rect.left + rect.width / 2 - tooltipRect.width / 2
                    ));

                    tooltip.style.top = `${tooltipTop}px`;
                    tooltip.style.left = `${tooltipLeft}px`;

                    // 矢印を配置（ツールチップの上、ターゲットの下）
                    arrow.style.top = `${rect.bottom + 10}px`;
                    arrow.style.left = `${rect.left + rect.width / 2 - 20}px`;
                    arrow.innerHTML = '<i class="fas fa-arrow-up"></i>';
                }
            }, 600);  // スクーズスクロール完了を待つ
        };

        // センター表示（ターゲットなし）
        const positionOnboardingCenter = (step) => {
            const spotlight = document.getElementById('onboarding-spotlight');
            const tooltip = document.getElementById('onboarding-tooltip');
            const arrow = document.getElementById('onboarding-arrow');

            // スポットライトを非表示
            spotlight.style.display = 'none';

            // ツールチップを中央に配置
            tooltip.style.top = '50%';
            tooltip.style.left = '50%';
            tooltip.style.transform = 'translate(-50%, -50%)';

            // 矢印を非表示
            arrow.style.display = 'none';
        };

        // === 段階4: 完成とlocalStorage連携 ===

        // 初期化時にオンボーディングチェック
        const checkOnboarding = () => {
            const completed = localStorage.getItem('onboarding_completed');

            if (!completed) {
                // 初回訪問：すぐにオンボーディング開始
                console.log('初回訪問を検出。オンボーディングを開始します...');
                startOnboarding();
            } else {
                console.log('オンボーディング完了済み');
            }
        };

        // オンボーディングをリセット（設定から再度表示）
        window.resetOnboarding = () => {
            localStorage.removeItem('onboarding_completed');
            console.log('🔄 オンボーディングをリセットしました');
            console.log('💡 ヒント: ページをリロードすると、チュートリアルが自動的に開始されます');
        };

        // === チャットボット管理用関数 ===

        // 問い合わせ一覧を表示（開発者ツールで使用）
        window.showInquiries = () => {
            const inquiries = JSON.parse(localStorage.getItem('inquiries') || '[]');
            console.log('📋 問い合わせ一覧');
            console.table(inquiries);
            console.log(`総数: ${inquiries.length}件`);
            return inquiries;
        };

        // 問い合わせをクリア（開発者ツールで使用）
        window.clearInquiries = () => {
            if (confirm('すべての問い合わせを削除しますか？')) {
                localStorage.removeItem('inquiries');
                console.log('✅ 問い合わせをクリアしました');
            }
        };

        // 最新の問い合わせを表示（開発者ツールで使用）
        window.showLatestInquiry = () => {
            const inquiries = JSON.parse(localStorage.getItem('inquiries') || '[]');
            if (inquiries.length > 0) {
                const latest = inquiries[inquiries.length - 1];
                console.log('📨 最新の問い合わせ:', latest);
                return latest;
            } else {
                console.log('問い合わせがありません');
                return null;
            }
        };

        // ========== 初期化処理 ==========
        const init = async () => {
            // loadData()内でエラーハンドリングされるため、try-catchで囲まない
            await loadData();

            // 効果音を初期化
            initQuizSound();
            initQuizStartSound();
            initTutorialSound();
            initMenuSound();

            // ユーザーデータの読み込み
            Object.assign(state, savedRatings.loadAll());

            // データ整合性チェック
            validateUserData();

            // 自動保存機能の開始
            startAutoSave();
            setupPageUnloadSave();

            initRegionFilters(); // 地域フィルターを初期化
            setupEventListeners();
            navigateTo('start');

            // === 段階4: オンボーディング自動起動 ===
            checkOnboarding();

            console.log('✅ アプリケーション初期化完了 - 物件数:', dummyProperties.length);
        };
        // ========== ナビゲーション ==========
        const navigateTo = (pageKey, params = {}) => {
            const oldPage = pages[state.currentPage];
            const newPage = pages[pageKey];

            if (oldPage && newPage && oldPage !== newPage) {
                // 詳細ページから遷移する際は地図をクリーンアップ
                if (state.currentPage === 'details' && state.detailMap) {
                    state.detailMap.remove();
                    state.detailMap = null;
                }

                oldPage.classList.remove('page-active');
                oldPage.classList.add('page-exit');

                setTimeout(() => {
                    oldPage.classList.add('page-hidden');
                    oldPage.classList.remove('page-exit');
                }, 400);

                newPage.classList.remove('page-hidden');
                // DOMの更新を待つ
                requestAnimationFrame(() => {
                    newPage.classList.add('page-enter');
                    requestAnimationFrame(() => {
                        newPage.classList.remove('page-enter');
                        newPage.classList.add('page-active');
                    });
                });
            }

            state.currentPage = pageKey;

            // ページ特有の処理
            switch (pageKey) {
                case 'list':
                    if (params.fromQuiz) {
                        const diagnosis = quizScoring.evaluate(state.quiz.answers, quizQuestions, resultTypes);
                        updateMatchScores(diagnosis.matchTags);
                        renderResultType(diagnosis);
                    }
                    renderPropertyList();
                    bottomNav.classList.remove('hidden');
                    break;
                case 'details':
                    renderPropertyDetails(params.id);
                    bottomNav.classList.add('hidden');
                    break;
                case 'favorites':
                    renderFavorites();
                    bottomNav.classList.remove('hidden');
                    break;
                case 'stars':
                    renderStars();
                    bottomNav.classList.remove('hidden');
                    break;
                case 'dislikes':
                    renderDislikes();
                    bottomNav.classList.remove('hidden');
                    break;
                case 'matching':
                    initMatchingMode();
                    bottomNav.classList.remove('hidden');
                    break;
                case 'quiz':
                    startQuiz();
                    bottomNav.classList.add('hidden');
                    break;
                case 'start':
                    bottomNav.classList.add('hidden');
                    break;
            }

            updateBottomNav(pageKey);
        };

        // ========== レンダリング ==========

        // 診断結果タイプの表示
        const renderResultType = ({ typeName, type }) => {
            const display = document.getElementById('result-type-display');
            const bestMatch = typeName ?? 'あなたにぴったりのタイプ';

            // いえっぴの吹き出しで結果を表示
            display.innerHTML = `
                <div class="relative">
                    <!-- いえっぴキャラクター -->
                    <div class="flex justify-center mb-2">
                        <div class="relative iepita-bounce">
                            <img src="iepita.png" alt="いえっぴ" class="w-8 h-8 drop-shadow-lg object-contain">
                        </div>
                    </div>

                    <!-- 吹き出し -->
                    <div class="relative bg-white rounded-lg p-2 shadow-sm border border-brand-200 mx-1 speech-bubble">
                        <!-- 吹き出しのしっぽ -->
                        <div class="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-white border-r border-b border-brand-200 rotate-45"></div>

                        <div class="text-center">
                            <p class="font-bold text-brand-600 text-xs mb-1">${bestMatch}</p>
                            <div class="bg-brand-50 p-1.5 rounded">
                                <p class="text-xs text-brand-700 font-medium">
                                    いえっぴ「${type ? type.comment : 'きっと素敵な住まいが見つかるよ♪'}」
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        };

        // 物件リストのレンダリング
        const renderPropertyList = (showSkeleton = true) => {
            console.log('🏠 renderPropertyList() 実行', {
                dataLoaded: state.api.dataLoaded,
                propertiesCount: dummyProperties.length,
                showSkeleton
            });

            // データが全くない場合のみエラー表示
            if (dummyProperties.length === 0 && !state.api.dataLoaded) {
                propertyListContainer.innerHTML = `
                    <div class="text-center py-8 text-slate-500">
                        <i class="fas fa-home text-4xl mb-4"></i>
                        <p>データ読み込み中...</p>
                        <button onclick="refreshData();" class="mt-4 text-sm bg-brand-500 text-white px-4 py-2 rounded hover:bg-brand-600">
                            <i class="fas fa-redo mr-1"></i>再読み込み
                        </button>
                    </div>
                `;
                console.warn('⚠️ 物件データなし & データ未ロード');
                return;
            }

            // 物件データが0件の場合
            if (dummyProperties.length === 0) {
                propertyListContainer.innerHTML = createEmptyStateHTML(
                    '物件データがありません',
                    'properties.jsonの読み込みに失敗しました。ローカルサーバーを使用してください。'
                );
                console.error('❌ 物件データが空です');
                return;
            }

            if (showSkeleton) {
                propertyListContainer.innerHTML = Array(3).fill(0).map(createSkeletonCardHTML).join('');
            }

            setTimeout(() => {
                const filteredProperties = getFilteredProperties();

                console.log('📋 フィルター後の物件数:', filteredProperties.length);

                if (filteredProperties.length === 0) {
                    propertyListContainer.innerHTML = createEmptyStateHTML('物件が見つかりません', '絞り込み条件を変更してみてください。');
                    return;
                }

                propertyListContainer.innerHTML = filteredProperties.map(createPropertyCardHTML).join('');
                console.log('✅ 物件リスト表示完了:', filteredProperties.length, '件');
            }, showSkeleton ? 500 : 0);
        };

        // お気に入りリストのレンダリング
        const renderFavorites = () => {
            const favoriteProperties = dummyProperties.filter(p => state.favorites.includes(p.id));
            if (favoriteProperties.length === 0) {
                favoritesListContainer.innerHTML = createEmptyStateHTML('お気に入りはまだありません', '気になる物件のハートマークを押してみましょう！');
                return;
            }
            favoritesListContainer.innerHTML = favoriteProperties.map(createPropertyCardHTML).join('');
        };

        // スターマークリストのレンダリング
        const renderStars = () => {
            const starProperties = dummyProperties.filter(p => state.stars.includes(p.id));
            if (starProperties.length === 0) {
                starsListContainer.innerHTML = createEmptyStateHTML('スターマークはまだありません', '気になる物件のスターマークを押してみましょう！');
                return;
            }
            starsListContainer.innerHTML = starProperties.map(createPropertyCardHTML).join('');
        };

        // 興味なしリストのレンダリング
        const renderDislikes = () => {
            const dislikeProperties = dummyProperties.filter(p => state.dislikes.includes(p.id));
            if (dislikeProperties.length === 0) {
                dislikesListContainer.innerHTML = createEmptyStateHTML('興味なしはまだありません', '気になる物件の興味なしボタンを押してみましょう！');
                return;
            }
            dislikesListContainer.innerHTML = dislikeProperties.map(createPropertyCardHTML).join('');
        };

        // 物件詳細のレンダリング
        const renderPropertyDetails = (propertyId) => {
            const property = dummyProperties.find(p => p.id === propertyId);
            if (!property) {
                pages.details.innerHTML = createEmptyStateHTML('物件情報が見つかりません', 'リストページに戻ってお探しください。');
                return;
            }

            // 類似物件 (タグが2つ以上一致するもの)
            const similarProperties = dummyProperties.filter(p => {
                if (p.id === property.id) return false;
                const commonTags = p.tags.filter(tag => property.tags.includes(tag));
                return commonTags.length >= 2;
            }).slice(0, 3);

            pages.details.innerHTML = `
                <header class="relative">
                    <div class="gallery-container w-full h-64 overflow-x-auto flex snap-x snap-mandatory">
                        ${(() => {
                            let imagesToShow = [];

                            if (property.isUserAdded && property.uploadedPhotos && property.uploadedPhotos.length > 0) {
                                // ユーザーがアップロードした写真がある場合は、それを表示
                                imagesToShow = property.uploadedPhotos.map((photo, index) => ({
                                    src: photo.dataUrl,
                                    alt: `${property.title}の画像 ${index + 1}`
                                }));
                            } else {
                                // 既存の画像ファイルの処理
                                // 外観と内観の画像を分けて表示
const exteriorImages = property.exterior_images.map((img, index) => ({
    src: img,
    alt: `${property.title}の外観 ${index + 1}`,
    type: 'exterior'
}));

const interiorImages = property.interior_images.map((img, index) => ({
    src: img,
    alt: `${property.title}の内観 ${index + 1}`,
    type: 'interior'
}));

imagesToShow = [...exteriorImages, ...interiorImages];
                            }

                            return imagesToShow.map((imgData, index) => `
                                <div class="gallery-item w-full flex-shrink-0 snap-center">
                                    <img src="${imgData.src}"
                                         alt="${imgData.alt}" class="w-full h-full object-cover">
                                </div>
                            `).join('');
                        })()}
                    </div>
                    <button onclick="navigateTo('list')" class="absolute top-4 left-4 bg-white/70 backdrop-blur-sm w-10 h-10 rounded-full flex items-center justify-center shadow-md">
                        <i class="fas fa-arrow-left text-slate-700"></i>
                    </button>
                    <div class="absolute bottom-4 right-4 bg-black/50 text-white text-xs px-2 py-1 rounded-md">
                        <span class="gallery-indicator">1 / ${property.isUserAdded && property.uploadedPhotos ? property.uploadedPhotos.length : (property.exterior_images.length + property.interior_images.length)}</span>
                    </div>
                </header>

                <main class="p-4">
                    <div class="flex items-start justify-between">
                        <div>
                            <h1 class="text-2xl font-bold">${property.title}</h1>
                            <p class="text-sm text-slate-500 mt-1"><i class="fas fa-map-marker-alt mr-1"></i>${property.address}</p>
                        </div>
                        <div class="text-right flex-shrink-0 ml-4">
                            <p class="text-2xl font-bold text-red-500">${(property.price/10000).toLocaleString()}万円</p>
                            <p class="text-xs text-slate-500">（賃料）</p>
                        </div>
                    </div>

                    <div class="flex flex-wrap gap-2 mt-4">
                        ${property.tags.map(tag => `<span class="bg-brand-100 text-brand-600 text-xs font-semibold px-2.5 py-1 rounded-full">${tag}</span>`).join('')}
                    </div>

                    <div class="grid grid-cols-3 gap-4 text-center my-6 py-4 border-y">
                        <div>
                            <p class="text-sm text-slate-500">間取り</p>
                            <p class="font-bold text-lg">${property.layout}</p>
                        </div>
                        <div>
                            <p class="text-sm text-slate-500">築年数</p>
                            <p class="font-bold text-lg">${property.age}年</p>
                        </div>
                        <div>
                            <p class="text-sm text-slate-500">最寄駅から</p>
                            <p class="font-bold text-lg">徒歩${property.station_distance}分</p>
                        </div>
                    </div>

                    <section class="mb-6">
                        <h2 class="text-lg font-bold mb-3">設備</h2>
                        <div class="grid grid-cols-3 sm:grid-cols-4 gap-3 text-center">
                            ${Object.entries(amenityIcons).map(([key, icon]) => `
                                <div class="flex flex-col items-center p-2 rounded-lg ${property.amenities.includes(key) ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-400'}">
                                    <span class="text-2xl">${icon}</span>
                                    <span class="text-xs mt-1">${key.charAt(0).toUpperCase() + key.slice(1)}</span>
                                    <i class="fas ${property.amenities.includes(key) ? 'fa-check-circle text-green-500' : 'fa-times-circle text-slate-300'} text-sm absolute top-1 right-1"></i>
                                </div>
                            `).join('')}
                        </div>
                    </section>

                    <section class="mb-6">
                        <h2 class="text-lg font-bold mb-3">地図</h2>
                        <div id="detail-map" class="w-full h-64 z-0"></div>
                    </section>

                    <div class="cta-bar bg-white p-3 grid grid-cols-5 gap-2 mb-6">
                    <button class="toggle-favorite-btn-details flex flex-col items-center justify-center rounded-lg py-2 ${state.favorites.includes(property.id) ? 'bg-red-100 text-red-500' : 'bg-slate-100 text-slate-600'}" data-id="${property.id}">
                        ${state.favorites.includes(property.id) ? '<i class="fas fa-heart text-xl"></i><span class="text-xs mt-1">お気に入り済</span>' : '<i class="far fa-heart text-xl"></i><span class="text-xs mt-1">お気に入り</span>'}
                    </button>
                    <button class="toggle-star-btn-details flex flex-col items-center justify-center rounded-lg py-2 ${state.stars.includes(property.id) ? 'bg-yellow-100 text-yellow-500' : 'bg-slate-100 text-slate-600'}" data-id="${property.id}">
                        ${state.stars.includes(property.id) ? '<i class="fas fa-star text-xl"></i><span class="text-xs mt-1">スター済</span>' : '<i class="far fa-star text-xl"></i><span class="text-xs mt-1">スター</span>'}
                    </button>
                    <button class="toggle-dislike-btn-details flex flex-col items-center justify-center rounded-lg py-2 ${state.dislikes.includes(property.id) ? 'bg-slate-200 text-slate-500' : 'bg-slate-100 text-slate-600'}" data-id="${property.id}">
                        ${state.dislikes.includes(property.id) ? '<i class="fas fa-times text-xl"></i><span class="text-xs mt-1">興味なし済</span>' : '<i class="far fa-times text-xl"></i><span class="text-xs mt-1">興味なし</span>'}
                    </button>
                    <button class="bg-slate-800 text-white font-bold rounded-lg col-span-2 hover:bg-slate-700 transition-colors" onclick="openChatbotModal(${property.id})">
                        💬 問い合わせる
                    </button>
                    <!-- <button class="bg-blue-500 text-white rounded-lg flex items-center justify-center"><i class="fas fa-map-marked-alt mr-2"></i>地図を開く</button> -->
                </div>

                     <section>
                        <h2 class="text-lg font-bold mb-3">類似の物件</h2>
                        <div class="space-y-3">
                            ${similarProperties.length > 0 ? similarProperties.map(createPropertyCardHTML).join('') : '<p class="text-slate-500 text-sm">現在、類似の物件はありません。</p>'}
                        </div>
                    </section>
                </main>
            `;

            // DOM要素のレンダリング完了を待ってから地図を初期化
            requestAnimationFrame(() => {
                // さらに次のフレームで地図を初期化（CSSレイアウト完了を確実にする）
                requestAnimationFrame(() => {
                    initDetailMap(property);
                });
            });

            // ギャラリーのインジケータ更新
            const gallery = pages.details.querySelector('.gallery-container');
            const indicator = pages.details.querySelector('.gallery-indicator');
            const totalImages = property.isUserAdded && property.uploadedPhotos ?
    property.uploadedPhotos.length :
    (property.exterior_images.length + property.interior_images.length);
            gallery.addEventListener('scroll', () => {
                const page = Math.round(gallery.scrollLeft / gallery.clientWidth) + 1;
                indicator.textContent = `${page} / ${totalImages}`;
            });
        };


        // ========== HTML生成ヘルパー ==========
        const createPropertyCardHTML = (property) => {
            const isFavorited = state.favorites.includes(property.id);
            const isStarred = state.stars.includes(property.id);
            const isDisliked = state.dislikes.includes(property.id);

            // 画像の表示を決定（安全にチェック）
            const imgFile = Array.isArray(property.exterior_images) && property.exterior_images.length > 0
                ? property.exterior_images[0]
                : null;

            let imageSrc;

            if (property.isUserAdded && property.uploadedPhotos && property.uploadedPhotos.length > 0) {
                imageSrc = property.uploadedPhotos[0].dataUrl;
            } else if (imgFile) {
                // URLの場合はそのまま使用
                imageSrc = imgFile;
            } else {
                // 画像がない場合のフォールバック
                imageSrc = `https://placehold.co/800x600/e2e8f0/64748b?text=${encodeURIComponent(property.title || '物件画像')}`;
            }
            return `
                <div class="property-card bg-white rounded-xl overflow-hidden shadow-md cursor-pointer" onclick="navigateTo('details', { id: ${property.id} })">
                    <div class="relative">
                        <img src="${imageSrc}"
                             alt="${property.title}" class="w-full h-48 object-cover">
                        <div class="absolute top-2 left-2 bg-slate-800/60 text-white text-sm font-bold px-3 py-1.5 rounded-full flex items-center">
                            <i class="fas fa-bolt text-yellow-300 mr-2"></i> マッチ度 ${property.matchScore || '??'}%
                        </div>
                        <div class="absolute top-2 right-2 flex flex-col gap-1">
                            <button class="toggle-favorite-btn w-10 h-10 rounded-full flex items-center justify-center bg-white/70 backdrop-blur-sm" data-id="${property.id}">
                                 <i class="${isFavorited ? 'fas text-red-500' : 'far'} fa-heart text-xl"></i>
                            </button>
                            <button class="toggle-star-btn w-10 h-10 rounded-full flex items-center justify-center bg-white/70 backdrop-blur-sm" data-id="${property.id}">
                                 <i class="${isStarred ? 'fas text-yellow-500' : 'far'} fa-star text-xl"></i>
                            </button>
                            <button class="toggle-dislike-btn w-10 h-10 rounded-full flex items-center justify-center bg-white/70 backdrop-blur-sm" data-id="${property.id}">
                                 <i class="${isDisliked ? 'fas text-slate-500' : 'far'} fa-times text-xl"></i>
                            </button>
                        </div>
                    </div>
                    <div class="p-4">
                        <h3 class="font-bold text-lg truncate">${property.title}</h3>
                        <p class="text-sm text-slate-500 mt-1"><i class="fas fa-map-marker-alt fa-fw mr-1"></i>${property.address}</p>
                        <div class="flex items-baseline justify-between mt-3">
                            <div>
                                <span class="text-xl font-bold text-red-500">${(property.price/10000).toLocaleString()}</span>
                                <span class="text-sm font-medium">万円</span>
                            </div>
                            <div class="text-sm text-slate-600">
                                <span class="font-semibold">${property.layout}</span> / <span>${property.age}年</span>
                            </div>
                        </div>
                        <div class="flex flex-wrap gap-1.5 mt-3">
                            ${property.tags.slice(0, 3).map(tag => `<span class="bg-slate-100 text-slate-600 text-xs px-2 py-1 rounded-md">${tag}</span>`).join('')}
                        </div>
                    </div>
                </div>
            `;
        };

        const createSkeletonCardHTML = () => `
            <div class="bg-white rounded-xl overflow-hidden shadow-md">
                <div class="skeleton w-full h-48"></div>
                <div class="p-4">
                    <div class="skeleton h-6 w-3/4 mb-2"></div>
                    <div class="skeleton h-4 w-1/2 mb-4"></div>
                    <div class="skeleton h-5 w-1/3 mb-4"></div>
                    <div class="flex gap-2">
                        <div class="skeleton h-5 w-16"></div>
                        <div class="skeleton h-5 w-20"></div>
                        <div class="skeleton h-5 w-16"></div>
                    </div>
                </div>
            </div>
        `;

        const createEmptyStateHTML = (title, message) => `
            <div class="text-center py-16 px-6">
                <div class="text-6xl text-slate-300 mb-4">
                    <svg viewBox="0 0 100 100" class="w-24 h-24 mx-auto drop-shadow-lg">
                        <path d="M50 5 L95 40 V95 H5 V40 Z" fill="#e2e8f0" stroke="#94a3b8" stroke-width="4" />
                        <circle cx="38" cy="55" r="4" fill="#94a3b8" />
                        <circle cx="62" cy="55" r="4" fill="#94a3b8" />
                        <path d="M40 75 L60 75" fill="none" stroke="#94a3b8" stroke-width="4" stroke-linecap="round" />
                    </svg>
                </div>
                <h3 class="text-xl font-bold text-slate-600">${title}</h3>
                <p class="text-slate-500 mt-2">${message}</p>
            </div>
        `;

        // ========== 診断ロジック ==========
        const startQuiz = () => {
            console.log('📋 診断を開始します...');
            playQuizStartSound(); // 診断開始効果音を再生
            state.quiz.currentQuestion = 0;
            state.quiz.answers = {};
            renderQuizQuestion();
        };

        const renderQuizQuestion = () => {
            const index = state.quiz.currentQuestion;
            const q = quizQuestions[index];
            const quizContent = document.getElementById('quiz-content');
            const quizNav = document.getElementById('quiz-nav');

            // プログレスバー更新
            const progress = ((index + 1) / quizQuestions.length) * 100;
            document.getElementById('quiz-progress-bar').style.width = `${progress}%`;
            document.getElementById('quiz-progress-text').textContent = `質問 ${index + 1} / ${quizQuestions.length}`;

            // フェーズ3：カード型の質問デザイン
            const selectedValue = state.quiz.answers[q.key];
            let optionsHTML = q.options.map((opt, idx) => `
                <button class="quiz-option-btn w-full text-left p-5 rounded-xl border-2 ${selectedValue === opt.value ? 'border-brand-500 bg-brand-100 shadow-lg' : 'border-slate-200 bg-white hover:border-brand-400 hover:bg-brand-50'} transition-all duration-200 transform hover:scale-102 hover:shadow-md" data-key="${q.key}" data-value="${opt.value}">
                    <div class="flex items-center gap-3">
                        <div class="flex-shrink-0 w-8 h-8 rounded-full ${selectedValue === opt.value ? 'bg-brand-500' : 'bg-slate-200'} flex items-center justify-center text-white font-bold text-sm">
                            ${selectedValue === opt.value ? '✓' : idx + 1}
                        </div>
                        <span class="font-medium text-slate-700 flex-1 text-lg">${opt.text}</span>
                    </div>
                </button>
            `).join('');

            quizContent.innerHTML = `
                <div class="question-card bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl p-8 border border-slate-100 animate-slide-up">
                    <!-- いえっぴのコメント -->
                    <div class="flex items-start gap-3 mb-6 p-4 bg-brand-50 rounded-xl">
                        <img src="iepita.png" class="w-12 h-12 object-contain flex-shrink-0" alt="いえっぴ">
                        <div class="speech-bubble flex-1">
                            <p class="text-sm text-slate-700 font-medium">${q.iepitaComment || 'この質問に答えてね！'}</p>
                        </div>
                    </div>

                    <!-- 質問文 -->
                    <h2 class="text-2xl font-bold text-slate-800 mb-6 leading-relaxed">
                        ${q.question}
                    </h2>

                    <!-- 選択肢 -->
                    <div class="space-y-3">
                        ${optionsHTML}
                    </div>
                </div>
            `;

            // 戻るボタンの表示制御
            document.getElementById('quiz-back-btn').style.visibility = index > 0 ? 'visible' : 'hidden';
        };

        const handleQuizAnswer = (key, value) => {
            state.quiz.answers[key] = value;
            if (state.quiz.currentQuestion < quizQuestions.length - 1) {
                state.quiz.currentQuestion++;
                renderQuizQuestion();
            } else {
                navigateTo('list', { fromQuiz: true });
            }
        };

        const goBackQuizQuestion = () => {
            if (state.quiz.currentQuestion > 0) {
                state.quiz.currentQuestion--;
                renderQuizQuestion();
            }
        };

        const updateMatchScores = (tags) => {
            const { favorites, stars, dislikes } = state;
            const ratings = { favorites, stars, dislikes };
            dummyProperties.forEach(property => {
                property.matchScore = quizScoring.scoreProperty(property, tags, ratings);
            });
        };

        // ========== お気に入りロジック ==========
        const toggleFavorite = (propertyId) => {
            const index = state.favorites.indexOf(propertyId);
            if (index > -1) {
                state.favorites.splice(index, 1);
            } else {
                state.favorites.push(propertyId);
            }
            savedRatings.save('favorites', state.favorites);
            updateFavoriteIcons(propertyId);

            // お気に入りページが開いている場合は再描画
            if(state.currentPage === 'favorites') {
                renderFavorites();
            }
        };

        const updateFavoriteIcons = (propertyId) => {
            const isFavorited = state.favorites.includes(propertyId);
            const icons = document.querySelectorAll(`.toggle-favorite-btn[data-id='${propertyId}'] i, .toggle-favorite-btn-details[data-id='${propertyId}'] i`);
            icons.forEach(icon => {
                icon.className = `${isFavorited ? 'fas text-red-500' : 'far'} fa-heart text-xl`;
            });

            // 詳細ページのボタンテキストも更新
            const detailsBtn = document.querySelector(`.toggle-favorite-btn-details[data-id='${propertyId}']`);
            if (detailsBtn) {
                detailsBtn.className = `toggle-favorite-btn-details flex flex-col items-center justify-center rounded-lg py-2 ${isFavorited ? 'bg-red-100 text-red-500' : 'bg-slate-100 text-slate-600'}`;
                detailsBtn.querySelector('span').textContent = isFavorited ? 'お気に入り済' : 'お気に入り';
            }
        };

        // ========== スターマークロジック ==========
        const toggleStar = (propertyId) => {
            const index = state.stars.indexOf(propertyId);
            if (index > -1) {
                state.stars.splice(index, 1);
            } else {
                state.stars.push(propertyId);
            }
            savedRatings.save('stars', state.stars);
            updateStarIcons(propertyId);

            // スターマークページが開いている場合は再描画
            if(state.currentPage === 'stars') {
                renderStars();
            }
        };

        const updateStarIcons = (propertyId) => {
            const isStarred = state.stars.includes(propertyId);
            const icons = document.querySelectorAll(`.toggle-star-btn[data-id='${propertyId}'] i, .toggle-star-btn-details[data-id='${propertyId}'] i`);
            icons.forEach(icon => {
                icon.className = `${isStarred ? 'fas text-yellow-500' : 'far'} fa-star text-xl`;
            });

            // 詳細ページのボタンテキストも更新
            const detailsBtn = document.querySelector(`.toggle-star-btn-details[data-id='${propertyId}']`);
            if (detailsBtn) {
                detailsBtn.className = `toggle-star-btn-details flex flex-col items-center justify-center rounded-lg py-2 ${isStarred ? 'bg-yellow-100 text-yellow-500' : 'bg-slate-100 text-slate-600'}`;
                detailsBtn.querySelector('span').textContent = isStarred ? 'スター済' : 'スター';
            }
        };

        // ========== 興味なしロジック ==========
        const toggleDislike = (propertyId) => {
            const index = state.dislikes.indexOf(propertyId);
            if (index > -1) {
                state.dislikes.splice(index, 1);
            } else {
                state.dislikes.push(propertyId);
            }
            savedRatings.save('dislikes', state.dislikes);
            updateDislikeIcons(propertyId);

            // 興味なしページが開いている場合は再描画
            if(state.currentPage === 'dislikes') {
                renderDislikes();
            }
        };

        const updateDislikeIcons = (propertyId) => {
            const isDisliked = state.dislikes.includes(propertyId);
            const icons = document.querySelectorAll(`.toggle-dislike-btn[data-id='${propertyId}'] i, .toggle-dislike-btn-details[data-id='${propertyId}'] i`);
            icons.forEach(icon => {
                icon.className = `${isDisliked ? 'fas text-slate-500' : 'far'} fa-times text-xl`;
            });

            // 詳細ページのボタンテキストも更新
            const detailsBtn = document.querySelector(`.toggle-dislike-btn-details[data-id='${propertyId}']`);
            if (detailsBtn) {
                detailsBtn.className = `toggle-dislike-btn-details flex flex-col items-center justify-center rounded-lg py-2 ${isDisliked ? 'bg-slate-200 text-slate-500' : 'bg-slate-100 text-slate-600'}`;
                detailsBtn.querySelector('span').textContent = isDisliked ? '興味なし済' : '興味なし';
            }
        };

        // ========== 効果音システム ==========

        // マッチングモード効果音
        const swipeSounds = {
            favorite: null,  // お気に入り（左スワイプ）
            star: null,      // スター（右スワイプ）
            dislike: null    // 興味なし（上スワイプ）
        };

        // 診断（クイズ）効果音
        let quizSound = null;

        // 診断開始効果音
        let quizStartSound = null;

        // チュートリアル（オンボーディング）効果音
        let tutorialSound = null;

        // メニュー（ナビゲーション）効果音
        let menuSound = null;

        // マッチングモード効果音の初期化
        const initSwipeSounds = () => {
            // お気に入り: 明るい決定音
            // 推奨: 効果音ラボ > ボタン・システム音 > 「決定ボタンを押す」系
            swipeSounds.favorite = new Audio();
            swipeSounds.favorite.src = 'sounds/favorite.mp3';
            swipeSounds.favorite.volume = 0.5;

            // スター: キラキラした特別な音
            // 推奨: 効果音ラボ > 演出・アニメ > 「キラーン」「輝き」系
            swipeSounds.star = new Audio();
            swipeSounds.star.src = 'sounds/star.mp3';
            swipeSounds.star.volume = 0.5;

            // 興味なし: さっぱりしたキャンセル音
            // 推奨: 効果音ラボ > ボタン・システム音 > 「キャンセル」系
            swipeSounds.dislike = new Audio();
            swipeSounds.dislike.src = 'sounds/dislike.mp3';
            swipeSounds.dislike.volume = 0.4;
        };

        // 診断（クイズ）効果音の初期化
        const initQuizSound = () => {
            // 診断: 素朴で優しいクリック音
            // 推奨: 効果音ラボ > ボタン・システム音 > 「ボタン押下」系（決定音より軽やかな音）
            quizSound = new Audio();
            quizSound.src = 'sounds/quiz.mp3';
            quizSound.volume = 0.3; // 控えめの音量

            // 音声ファイルのロード確認
            quizSound.addEventListener('canplaythrough', () => {
                console.log('✅ 診断効果音 (quiz.mp3) の読み込み完了');
            });

            quizSound.addEventListener('error', (e) => {
                console.error('❌ 診断効果音の読み込み失敗:', e);
            });

            // プリロード
            quizSound.load();
            console.log('🔊 診断効果音を初期化しました (sounds/quiz.mp3)');
        };

        // 診断開始効果音の初期化
        const initQuizStartSound = () => {
            // 診断開始: ゲームスタートのような華やかな音
            // 推奨: 効果音ラボ > ボタン・システム音 > 「決定」「スタート」系
            quizStartSound = new Audio();
            quizStartSound.src = 'sounds/quizstart.mp3';
            quizStartSound.volume = 0.5; // やや大きめの音量

            // 音声ファイルのロード確認
            quizStartSound.addEventListener('canplaythrough', () => {
                console.log('✅ 診断開始効果音 (quizstart.mp3) の読み込み完了');
            });

            quizStartSound.addEventListener('error', (e) => {
                console.error('❌ 診断開始効果音の読み込み失敗:', e);
            });

            // プリロード
            quizStartSound.load();
            console.log('🔊 診断開始効果音を初期化しました (sounds/quizstart.mp3)');
        };

        // チュートリアル（オンボーディング）効果音の初期化
        const initTutorialSound = () => {
            // チュートリアル: ガイド開始を示す親しみやすい音
            // 推奨: 効果音ラボ > ボタン・システム音 > 「システム音」「通知音」系
            tutorialSound = new Audio();
            tutorialSound.src = 'sounds/chuto.mp3';
            tutorialSound.volume = 0.5; // やや大きめの音量

            // 音声ファイルのロード確認
            tutorialSound.addEventListener('canplaythrough', () => {
                console.log('✅ チュートリアル効果音 (chuto.mp3) の読み込み完了');
            });

            tutorialSound.addEventListener('error', (e) => {
                console.error('❌ チュートリアル効果音の読み込み失敗:', e);
            });

            // プリロード
            tutorialSound.load();
            console.log('🔊 チュートリアル効果音を初期化しました (sounds/chuto.mp3)');
        };

        // メニュー（ナビゲーション）効果音の初期化
        const initMenuSound = () => {
            // メニュー: ページ遷移時の軽快な音
            // 推奨: 効果音ラボ > ボタン・システム音 > 「カーソル移動」「選択」系
            menuSound = new Audio();
            menuSound.src = 'sounds/menu.mp3';
            menuSound.volume = 0.4; // 控えめの音量

            // 音声ファイルのロード確認
            menuSound.addEventListener('canplaythrough', () => {
                console.log('✅ メニュー効果音 (menu.mp3) の読み込み完了');
            });

            menuSound.addEventListener('error', (e) => {
                console.error('❌ メニュー効果音の読み込み失敗:', e);
            });

            // プリロード
            menuSound.load();
            console.log('🔊 メニュー効果音を初期化しました (sounds/menu.mp3)');
        };

        // マッチングモード効果音を再生（ハプティックフィードバック付き）
        const playSwipeSound = (type) => {
            try {
                // 効果音再生
                const sound = swipeSounds[type];
                if (sound) {
                    sound.currentTime = 0; // 最初から再生
                    sound.play().catch(e => console.log('🔇 音声再生:', e.message));
                }

                // ハプティックフィードバック（バイブレーション）
                if (navigator.vibrate) {
                    if (type === 'star') {
                        navigator.vibrate([30, 50, 30]); // スターは特別なパターン
                    } else if (type === 'favorite') {
                        navigator.vibrate(30); // お気に入りは短く
                    } else if (type === 'dislike') {
                        navigator.vibrate(20); // 興味なしは軽く
                    }
                }
            } catch (e) {
                console.log('🔇 効果音エラー:', e);
            }
        };

        // 診断（クイズ）効果音を再生
        const playQuizSound = () => {
            try {
                if (quizSound) {
                    quizSound.currentTime = 0; // 最初から再生
                    quizSound.play().catch(e => console.log('🔇 クイズ音声再生:', e.message));
                }

                // 軽いハプティックフィードバック
                if (navigator.vibrate) {
                    navigator.vibrate(10); // 短く軽い振動
                }
            } catch (e) {
                console.log('🔇 クイズ効果音エラー:', e);
            }
        };

        // 診断開始効果音を再生
        const playQuizStartSound = () => {
            try {
                if (quizStartSound) {
                    console.log('🎮 診断開始効果音を再生します...');
                    quizStartSound.currentTime = 0; // 最初から再生
                    quizStartSound.play()
                        .then(() => {
                            console.log('✅ 診断開始効果音の再生成功');
                        })
                        .catch(e => {
                            console.warn('⚠️ 診断開始音声再生エラー:', e.message);
                            // ブラウザのオートプレイポリシーの可能性を示唆
                            if (e.name === 'NotAllowedError') {
                                console.log('💡 ヒント: ブラウザのオートプレイポリシーにより、最初のクリックでは再生できない場合があります');
                            }
                        });
                } else {
                    console.warn('⚠️ 診断開始効果音が初期化されていません');
                }

                // やや強めのハプティックフィードバック
                if (navigator.vibrate) {
                    navigator.vibrate([50, 30, 50]); // スタート感のあるパターン
                    console.log('📳 ハプティックフィードバック: 50-30-50ms');
                }
            } catch (e) {
                console.error('❌ 診断開始効果音エラー:', e);
            }
        };
        // チュートリアル（オンボーディング）効果音を再生
        const playTutorialSound = () => {
            try {
                if (tutorialSound) {
                    console.log('📖 チュートリアル効果音を再生します...');
                    tutorialSound.currentTime = 0; // 最初から再生
                    tutorialSound.play()
                        .then(() => {
                            console.log('✅ チュートリアル効果音の再生成功');
                        })
                        .catch(e => {
                            console.warn('⚠️ チュートリアル音声再生エラー:', e.message);
                            // ブラウザのオートプレイポリシーの可能性を示唆
                            if (e.name === 'NotAllowedError') {
                                console.log('💡 ヒント: ブラウザのオートプレイポリシーにより、最初のクリックでは再生できない場合があります');
                            }
                        });
                } else {
                    console.warn('⚠️ チュートリアル効果音が初期化されていません');
                }

                // 軽いハプティックフィードバック
                if (navigator.vibrate) {
                    navigator.vibrate([30, 20, 30]); // ガイド開始を示すパターン
                    console.log('📳 ハプティックフィードバック: 30-20-30ms');
                }
            } catch (e) {
                console.error('❌ チュートリアル効果音エラー:', e);
            }
        };

        // メニュー（ナビゲーション）効果音を再生
        const playMenuSound = () => {
            try {
                if (menuSound) {
                    console.log('🔊 メニュー効果音を再生します...');
                    menuSound.currentTime = 0; // 最初から再生
                    menuSound.play()
                        .then(() => {
                            console.log('✅ メニュー効果音の再生成功');
                        })
                        .catch(e => {
                            console.warn('⚠️ メニュー音声再生エラー:', e.message);
                            // ブラウザのオートプレイポリシーの可能性を示唆
                            if (e.name === 'NotAllowedError') {
                                console.log('💡 ヒント: ブラウザのオートプレイポリシーにより、最初のクリックでは再生できない場合があります');
                            }
                        });
                } else {
                    console.warn('⚠️ メニュー効果音が初期化されていません');
                }

                // 軽いハプティックフィードバック
                if (navigator.vibrate) {
                    navigator.vibrate(15); // 短く軽い振動
                    console.log('📳 ハプティックフィードバック: 15ms');
                }
            } catch (e) {
                console.error('❌ メニュー効果音エラー:', e);
            }
        };

        // ========== マッチングモードロジック ==========
        const initMatchingMode = () => {
            // 効果音を初期化
            initSwipeSounds();

            // 診断結果に基づいて物件をフィルタリング
            const answerTags = Object.entries(state.quiz.answers).flatMap(([key, value]) => {
                const question = quizQuestions.find(q => q.key === key);
                const option = question.options.find(o => o.value === value);
                return option ? option.tags : [];
            });

            // マッチ度でソートして上位20件を取得
            const sortedProperties = [...dummyProperties].sort((a, b) => {
                const aScore = a.tags.filter(tag => answerTags.includes(tag)).length;
                const bScore = b.tags.filter(tag => answerTags.includes(tag)).length;
                return bScore - aScore;
            }).slice(0, 20);

            state.matching.properties = sortedProperties;
            state.matching.currentIndex = 0;
            state.matching.isAnimating = false;

            renderMatchingCards();
        };

        const renderMatchingCards = () => {
            if (state.matching.currentIndex >= state.matching.properties.length) {
                matchingContainer.innerHTML = '';
                matchingEmpty.classList.remove('hidden');
                return;
            }

            matchingEmpty.classList.add('hidden');

            // 現在のカードと次のカードを表示（重ね合わせ）
            const currentProperty = state.matching.properties[state.matching.currentIndex];
            const nextProperty = state.matching.properties[state.matching.currentIndex + 1];

            let html = '';

            // 次のカード（背景）
            if (nextProperty) {
                html += createSwipeCardHTML(nextProperty, 'next');
            }

            // 現在のカード（前面）
            html += createSwipeCardHTML(currentProperty, 'current');

            matchingContainer.innerHTML = html;

            // スワイプイベントを設定
            setupSwipeEvents();
        };

        const createSwipeCardHTML = (property, position) => {
            // 外観の最初の画像を安全に取得
            const imgFile = Array.isArray(property.exterior_images) && property.exterior_images.length > 0 ? property.exterior_images[0] : null;
            const isRealPhoto = imgFile && (String(imgFile).startsWith('http') || String(imgFile).startsWith('data:'));
            const imgSrc = isRealPhoto ? imgFile : `https://placehold.co/1200x800/e2e8f0/64748b?text=${encodeURIComponent(imgFile || property.title)}`;

            return `
                <div class="swipe-card ${position}" data-id="${property.id}">
                    <div class="relative h-full">
                        <img src="${imgSrc}"
                             alt="${property.title}" class="w-full h-2/3 object-cover">
                        <div class="absolute top-4 left-4 bg-slate-800/60 text-white text-sm font-bold px-3 py-1.5 rounded-full flex items-center">
                            <i class="fas fa-bolt text-yellow-300 mr-2"></i> マッチ度 ${property.matchScore || '??'}%
                        </div>
                        <div class="p-4 h-1/3 flex flex-col justify-between">
                            <div>
                                <h3 class="font-bold text-xl mb-2">${property.title}</h3>
                                <p class="text-sm text-slate-500 mb-2"><i class="fas fa-map-marker-alt fa-fw mr-1"></i>${property.address}</p>
                                <div class="flex items-baseline justify-between mb-3">
                                    <div>
                                        <span class="text-2xl font-bold text-red-500">${(property.price/10000).toLocaleString()}</span>
                                        <span class="text-sm font-medium">万円</span>
                                    </div>
                                    <div class="text-sm text-slate-600">
                                        <span class="font-semibold">${property.layout}</span> / <span>${property.age}年</span>
                                    </div>
                                </div>
                                <div class="flex flex-wrap gap-1.5">
                                    ${property.tags.slice(0, 4).map(tag => `<span class="bg-brand-100 text-brand-600 text-xs px-2 py-1 rounded-full">${tag}</span>`).join('')}
                                </div>
                            </div>
                        </div>
                        <div class="swipe-overlay like">
                            <i class="fas fa-heart"></i>
                        </div>
                        <div class="swipe-overlay star">
                            <i class="fas fa-star"></i>
                        </div>
                        <div class="swipe-overlay dislike">
                            <i class="fas fa-times"></i>
                        </div>
                    </div>
                </div>
            `;
        };

        const setupSwipeEvents = () => {
            const currentCard = matchingContainer.querySelector('.swipe-card.current');
            if (!currentCard) return;

            let startX = 0;
            let startY = 0;
            let currentX = 0;
            let currentY = 0;
            let isDragging = false;
            let lastClickTime = 0;

            const startDrag = (e) => {
                if (state.matching.isAnimating) return;

                isDragging = true;
                currentCard.classList.add('swiping');

                const clientX = e.type === 'mousedown' ? e.clientX : e.touches[0].clientX;
                const clientY = e.type === 'mousedown' ? e.clientY : e.touches[0].clientY;

                startX = clientX;
                startY = clientY;
                currentX = 0;
                currentY = 0;
            };

            const drag = (e) => {
                if (!isDragging || state.matching.isAnimating) return;

                e.preventDefault();

                const clientX = e.type === 'mousemove' ? e.clientX : e.touches[0].clientX;
                const clientY = e.type === 'mousemove' ? e.clientY : e.touches[0].clientY;

                currentX = clientX - startX;
                currentY = clientY - startY;

                const rotation = currentX * 0.1;
                currentCard.style.transform = `translateX(${currentX}px) translateY(${currentY}px) rotate(${rotation}deg)`;

                // スワイプ方向に応じてオーバーレイを表示
                const likeOverlay = currentCard.querySelector('.swipe-overlay.like');
                const starOverlay = currentCard.querySelector('.swipe-overlay.star');
                const dislikeOverlay = currentCard.querySelector('.swipe-overlay.dislike');

                // 上スワイプを優先的にチェック（Y方向の移動が大きく、上向きの場合）
                if (currentY < -50 && Math.abs(currentY) > Math.abs(currentX) * 1.5) {
                    // 上スワイプ = 興味なし
                    dislikeOverlay.classList.add('show');
                    likeOverlay.classList.remove('show');
                    starOverlay.classList.remove('show');
                } else if (Math.abs(currentX) > 50) {
                    // 横スワイプ
                    if (currentX > 0) {
                        // 右スワイプ = スター
                        starOverlay.classList.add('show');
                        likeOverlay.classList.remove('show');
                        dislikeOverlay.classList.remove('show');
                    } else {
                        // 左スワイプ = ハート
                        likeOverlay.classList.add('show');
                        starOverlay.classList.remove('show');
                        dislikeOverlay.classList.remove('show');
                    }
                } else {
                    // スワイプが不十分
                    likeOverlay.classList.remove('show');
                    starOverlay.classList.remove('show');
                    dislikeOverlay.classList.remove('show');
                }
            };

            const endDrag = () => {
                if (!isDragging || state.matching.isAnimating) return;

                isDragging = false;
                currentCard.classList.remove('swiping');

                const threshold = 100;

                // 上スワイプを優先的にチェック（Y方向の移動が大きく、上向きの場合）
                if (currentY < -threshold && Math.abs(currentY) > Math.abs(currentX) * 1.2) {
                    // 上スワイプ = 興味なし
                    state.matching.isAnimating = true;
                    currentCard.classList.add('swipe-up', 'swipe-success');
                    playSwipeSound('dislike'); // 効果音再生
                    toggleDislike(parseInt(currentCard.dataset.id));

                    // アニメーション完了後に次のカードを表示
                    setTimeout(() => {
                        state.matching.currentIndex++;
                        state.matching.isAnimating = false;
                        renderMatchingCards();
                    }, 300);
                } else if (Math.abs(currentX) > threshold) {
                    // 横スワイプが完了
                    state.matching.isAnimating = true;

                    if (currentX > 0) {
                        // 右スワイプ = スター
                        currentCard.classList.add('swipe-right', 'swipe-success');
                        playSwipeSound('star'); // 効果音再生
                        toggleStar(parseInt(currentCard.dataset.id));
                    } else {
                        // 左スワイプ = ハート
                        currentCard.classList.add('swipe-left', 'swipe-success');
                        playSwipeSound('favorite'); // 効果音再生
                        toggleFavorite(parseInt(currentCard.dataset.id));
                    }

                    // アニメーション完了後に次のカードを表示
                    setTimeout(() => {
                        state.matching.currentIndex++;
                        state.matching.isAnimating = false;
                        renderMatchingCards();
                    }, 300);
                } else {
                    // スワイプが不十分、元の位置に戻す
                    currentCard.style.transform = '';
                    currentCard.querySelectorAll('.swipe-overlay').forEach(overlay => {
                        overlay.classList.remove('show');
                    });
                }
            };

            // ダブルクリックで興味なし
            const handleDoubleClick = (e) => {
                if (state.matching.isAnimating) return;

                const currentTime = new Date().getTime();
                if (currentTime - lastClickTime < 300) {
                    // ダブルクリック検出
                    state.matching.isAnimating = true;
                    currentCard.classList.add('swipe-left', 'swipe-success');
                    playSwipeSound('dislike'); // 効果音再生
                    toggleDislike(parseInt(currentCard.dataset.id));

                    setTimeout(() => {
                        state.matching.currentIndex++;
                        state.matching.isAnimating = false;
                        renderMatchingCards();
                    }, 300);
                }
                lastClickTime = currentTime;
            };

            // マウスイベント
            currentCard.addEventListener('mousedown', startDrag);
            currentCard.addEventListener('click', handleDoubleClick);
            document.addEventListener('mousemove', drag);
            document.addEventListener('mouseup', endDrag);

            // タッチイベント
            currentCard.addEventListener('touchstart', startDrag, { passive: false });
            document.addEventListener('touchmove', drag, { passive: false });
            document.addEventListener('touchend', endDrag);
        };

        // プログラム的にスワイプを実行する関数
        const programmaticSwipe = (direction) => {
            // アニメーション中やカードがない場合はスキップ
            if (state.matching.isAnimating) {
                console.log('⏸️ スワイプアニメーション中です...');
                return;
            }

            const currentCard = matchingContainer.querySelector('.swipe-card.current');
            if (!currentCard) {
                console.log('⚠️ スワイプするカードがありません');
                return;
            }

            const propertyId = parseInt(currentCard.dataset.id);
            state.matching.isAnimating = true;

            console.log(`🎯 プログラム的スワイプを実行: ${direction}`);

            switch (direction) {
                case 'left':
                    // 左スワイプ = お気に入り
                    currentCard.classList.add('swipe-left', 'swipe-success');
                    playSwipeSound('favorite');
                    toggleFavorite(propertyId);
                    break;

                case 'right':
                    // 右スワイプ = スター
                    currentCard.classList.add('swipe-right', 'swipe-success');
                    playSwipeSound('star');
                    toggleStar(propertyId);
                    break;

                case 'up':
                    // 上スワイプ = 興味なし
                    currentCard.classList.add('swipe-up', 'swipe-success');
                    playSwipeSound('dislike');
                    toggleDislike(propertyId);
                    break;

                default:
                    console.warn(`⚠️ 未知のスワイプ方向: ${direction}`);
                    state.matching.isAnimating = false;
                    return;
            }

            // アニメーション完了後に次のカードを表示
            setTimeout(() => {
                state.matching.currentIndex++;
                state.matching.isAnimating = false;
                renderMatchingCards();
                console.log('✅ スワイプ完了、次のカードを表示');
            }, 450); // アニメーション時間(0.4s)より少し長めに設定
        };

        // ========== フィルター/ソートロジック ==========
        const getFilteredProperties = () =>
            propertyFilters.filterProperties(dummyProperties, state.filters, state.userLocation);

        const openFilterModal = () => {
            renderFilterTags();
            filterModal.classList.remove('hidden');
            requestAnimationFrame(() => {
                filterPanel.classList.remove('translate-x-full');
            });
        };

        const closeFilterModal = () => {
            filterPanel.classList.add('translate-x-full');
            setTimeout(() => {
                filterModal.classList.add('hidden');
            }, 300);
        };

        // 地域データを抽出する関数
        const extractRegionData = () => {
            const prefectures = [...new Set(dummyProperties.map(p => {
                // addressから都道府県を抽出「東京都○○市」パターン
                // より厳密な正規表現で都道府県のみを抽出
                const match = p.address.match(/^([^都道府県]{1,4}[都道府県])/);
                return match ? match[1] : p.address.split(' ')[0];
            }))].sort();

            // 都道府県ごとの市区町村をグループ化
            const cityData = {};
            prefectures.forEach(prefecture => {
                cityData[prefecture] = [...new Set(dummyProperties
                    .filter(p => {
                        const match = p.address.match(/^([^都道府県]{1,4}[都道府県])/);
                        const propPrefecture = match ? match[1] : p.address.split(' ')[0];
                        return propPrefecture === prefecture;
                    })
                    .map(p => {
                        // 住所から市区町村を抽出（都道府県の後の部分）
                        const prefectureMatch = p.address.match(/^([^都道府県]{1,4}[都道府県])/);
                        if (prefectureMatch) {
                            const remaining = p.address.substring(prefectureMatch[1].length);
                            // 残りの部分から最初の市区町村を取得
                            // まず「市」を探し、その後「区」がある場合は「市」までを取得
                            const cityMatch = remaining.match(/^([^区市町村]{1,10}市)([^区市町村]{1,10}区)?/);
                            if (cityMatch) {
                                console.log(`市区町村抽出 (${prefecture}):`, p.address, '→', cityMatch[1]);
                                return cityMatch[1]; // 「京都市」を返す
                            }
                            // 「市」がない場合は区町村を探す
                            const districtMatch = remaining.match(/^([^区市町村]{1,10}[区町村])/);
                            const result = districtMatch ? districtMatch[1] : remaining.split(' ')[0];
                            console.log(`市区町村抽出 (${prefecture}):`, p.address, '→', result);
                            return result;
                        }
                        return p.address.split(' ')[1] || p.address.split(' ')[0];
                    })
                )].sort();
            });

            console.log('抽出された地域データ:', { prefectures, cityData });
            return { prefectures, cityData };
        };

        // 人気地域データ
        const popularRegions = [
            { name: '東京', prefecture: '東京都', city: '' },
            { name: '大阪', prefecture: '大阪府', city: '' },
            { name: '名古屋', prefecture: '愛知県', city: '名古屋市' },
            { name: '福岡', prefecture: '福岡県', city: '' },
            { name: '横浜', prefecture: '神奈川県', city: '横浜市' },
            { name: '神戸', prefecture: '兵庫県', city: '神戸市' },
            { name: '札幌', prefecture: '北海道', city: '札幌市' }
        ];

        // 地域フィルターのUIを初期化
        const initRegionFilters = () => {
            const { prefectures, cityData } = extractRegionData();

            // 人気エリアボタンを生成
            const popularRegionsDiv = document.getElementById('popular-regions');
            popularRegionsDiv.innerHTML = popularRegions.map(region => `
                <button class="popular-region-btn px-2 py-1 text-xs bg-blue-50 text-blue-600 border border-blue-200 rounded-full hover:bg-blue-100"
                        data-prefecture="${region.prefecture}" data-city="${region.city}">
                    ${region.name}
                </button>
            `).join('');

            // 都道府県ドロップダウンを生成
            const prefectureSelect = document.getElementById('prefecture-select');
            prefectureSelect.innerHTML = '<option value="">すべて</option>' +
                prefectures.map(p => `<option value="${p}">${p}</option>`).join('');

            // 市区町村ドロップダウンを生成（初期状態はすべて）
            const citySelect = document.getElementById('city-select');
            cityData[''] = []; // 空の場合は全選択

            // 地域検索ボックスのイベントリスナー
            const regionSearch = document.getElementById('region-search');
            const regionSuggestions = document.getElementById('region-suggestions');
            let searchTimeout;

            regionSearch.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                const query = e.target.value.trim();

                if (query.length >= 2) {
                    searchTimeout = setTimeout(() => {
                        showRegionSuggestions(query, regionSuggestions);
                    }, 300);
                } else {
                    regionSuggestions.classList.add('hidden');
                }
            });

            // 検索候補クリック時の処理
            document.addEventListener('click', (e) => {
                if (e.target.classList.contains('suggestion-item')) {
                    const prefecture = e.target.dataset.prefecture;
                    const city = e.target.dataset.city;

                    // セレクトボックスを更新
                    prefectureSelect.value = prefecture || '';
                    citySelect.value = city || '';

                    // フィルター状態を更新
                    state.filters.prefecture = prefecture || '';
                    state.filters.city = city || '';

                    // 検索ボックスをクリア
                    regionSearch.value = '';
                    regionSuggestions.classList.add('hidden');

                    // 市区町村リストを更新
                    citySelect.innerHTML = '<option value="">すべて</option>';
                    if (prefecture && cityData[prefecture]) {
                        citySelect.innerHTML += cityData[prefecture]
                            .map(c => `<option value="${c}">${c}</option>`).join('');
                    }
                }

                if (e.target.classList.contains('popular-region-btn')) {
                    const prefecture = e.target.dataset.prefecture;
                    const city = e.target.dataset.city;
                    console.log('人気エリアタグクリック:', { prefecture, city, cityData: cityData[prefecture] });

                    prefectureSelect.value = prefecture;
                    state.filters.prefecture = prefecture;

                    // 市区町村リストを更新
                    citySelect.innerHTML = '<option value="">すべて</option>';
                    if (cityData[prefecture]) {
                        citySelect.innerHTML += cityData[prefecture]
                            .map(c => `<option value="${c}">${c}</option>`).join('');
                        console.log('市区町村リスト更新:', cityData[prefecture]);
                    }

                    // 市区町村も設定（指定されている場合）
                    if (city) {
                        citySelect.value = city;
                        state.filters.city = city;
                        console.log('市区町村設定:', city);
                    } else {
                        citySelect.value = '';
                        state.filters.city = '';
                        console.log('市区町村クリア');
                    }
                }
            });

            // 都道府県変更時のイベントリスナー
            prefectureSelect.addEventListener('change', (e) => {
                const selectedPrefecture = e.target.value;
                state.filters.prefecture = selectedPrefecture;
                state.filters.city = ''; // 市区町村をリセット

                // 市区町村ドロップダウンを更新
                citySelect.innerHTML = '<option value="">すべて</option>';
                if (selectedPrefecture && cityData[selectedPrefecture]) {
                    citySelect.innerHTML += cityData[selectedPrefecture]
                        .map(city => `<option value="${city}">${city}</option>`).join('');
                }

                // city選択をリセット
                citySelect.value = '';
            });

            // 市区町村変更時のイベントリスナー
            citySelect.addEventListener('change', (e) => {
                state.filters.city = e.target.value;
            });
        };
        // 地域検索候補を表示
        const showRegionSuggestions = (query, suggestionsContainer) => {
            const { prefectures, cityData } = extractRegionData();
            const matchingRegions = [];

            // 都道府県でマッチング
            prefectures.forEach(prefecture => {
                if (prefecture.includes(query)) {
                    matchingRegions.push({
                        text: prefecture,
                        prefecture,
                        city: '',
                        type: '都道府県'
                    });
                }
            });

            // 市区町村でマッチング
            Object.entries(cityData).forEach(([prefecture, cities]) => {
                cities.forEach(city => {
                    if (city.includes(query)) {
                        matchingRegions.push({
                            text: `${city} (${prefecture})`,
                            prefecture,
                            city,
                            type: '市区町村'
                        });
                    }
                });
            });

            // 候補を表示
            if (matchingRegions.length > 0) {
                suggestionsContainer.innerHTML = matchingRegions.slice(0, 10).map(region => `
                    <div class="suggestion-item p-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100"
                         data-prefecture="${region.prefecture}" data-city="${region.city}">
                        <div class="font-medium text-sm">${region.text}</div>
                        <div class="text-xs text-gray-500">${region.type}</div>
                    </div>
                `).join('');
                suggestionsContainer.classList.remove('hidden');
            } else {
                suggestionsContainer.classList.add('hidden');
            }
        };

        const renderFilterTags = () => {
            const allTags = [...new Set(dummyProperties.flatMap(p => p.tags))];
            const container = document.getElementById('filter-tags');
            container.innerHTML = allTags.map(tag => `
                <button class="filter-tag-btn px-3 py-1.5 text-sm rounded-full border ${state.filters.tags.includes(tag) ? 'bg-brand-500 border-brand-500 text-white' : 'bg-white border-slate-300 text-slate-700'}" data-tag="${tag}">
                    ${tag}
                </button>
            `).join('');
        };

        // ========== 地図ロジック ==========
        // ========== 強化されたマップ機能 ==========

        // ユーザーの現在地を取得
        const getUserLocation = () => {
            return new Promise((resolve, reject) => {
                if (!navigator.geolocation) {
                    reject(new Error('Geolocation is not supported'));
                    return;
                }

                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const location = {
                            lat: position.coords.latitude,
                            lng: position.coords.longitude
                        };
                        state.userLocation = location;
                        console.log('📍 現在地を取得しました:', location);
                        resolve(location);
                    },
                    (error) => {
                        console.error('❌ 現在地取得エラー:', error);
                        reject(error);
                    },
                    {
                        enableHighAccuracy: true,
                        timeout: 10000,
                        maximumAge: 300000 // 5分間キャッシュ
                    }
                );
            });
        };

        // 単一物件のマップ初期化
        const initSingleMap = (property) => {
            if (state.currentMap) {
                state.currentMap.remove();
                state.currentMap = null;
            }

            state.mapMode = 'single';
            state.currentMap = L.map('map').setView(property.coordinates, 15);

            // タイルレイヤー
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(state.currentMap);

            // 物件マーカー
            const marker = L.marker(property.coordinates).addTo(state.currentMap);
            marker.bindPopup(`
                <div class="p-2">
                    <h3 class="font-bold text-lg">${property.title}</h3>
                    <p class="text-sm text-gray-600">${property.address}</p>
                    <p class="text-sm font-semibold text-brand-600">¥${property.price.toLocaleString()}/月</p>
                    <button onclick="navigateTo('details', {id: ${property.id}})"
                            class="mt-2 w-full bg-brand-500 text-white px-3 py-1 rounded text-sm hover:bg-brand-600">
                        詳細を見る
                    </button>
                </div>
            `).openPopup();

            // 現在地ボタンを追加
            L.control.locate({
                position: 'topright',
                strings: {
                    title: '現在地を表示'
                }
            }).addTo(state.currentMap);
        };

        // 物件詳細ページ専用のマップ初期化
        const initDetailMap = (property) => {
            // 既存の詳細ページ地図を削除
            if (state.detailMap) {
                state.detailMap.remove();
                state.detailMap = null;
            }

            // DOM要素の存在とサイズを確認
            const mapContainer = document.getElementById('detail-map');
            if (!mapContainer) {
                console.warn('地図コンテナが見つかりません');
                return;
            }

            // コンテナのサイズを強制的に再計算
            mapContainer.style.height = '256px'; // h-64 = 16rem = 256px

            // 詳細ページ地図を初期化
            state.detailMap = L.map('detail-map').setView(property.coordinates, 15);

            // タイルレイヤー
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(state.detailMap);

            // 物件マーカー
            const marker = L.marker(property.coordinates).addTo(state.detailMap);
            marker.bindPopup(`
                <div class="p-2">
                    <h3 class="font-bold text-lg">${property.title}</h3>
                    <p class="text-sm text-gray-600">${property.address}</p>
                    <p class="text-sm font-semibold text-brand-600">¥${property.price.toLocaleString()}/月</p>
                </div>
            `);

            // 地図のサイズを強制的に再計算（念のため）
            setTimeout(() => {
                if (state.detailMap) {
                    state.detailMap.invalidateSize();
                }
            }, 100);
        };

        // 複数物件のマップ初期化
        const initMultipleMap = (properties) => {
            if (state.currentMap) {
                state.currentMap.remove();
                state.currentMap = null;
            }

            state.mapMode = 'multiple';

            // 全物件の中心点を計算
            const bounds = L.latLngBounds();
            properties.forEach(property => {
                bounds.extend(property.coordinates);
            });

            state.currentMap = L.map('map').fitBounds(bounds);

            // タイルレイヤー
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(state.currentMap);

            // マーカークラスター
            const markers = L.markerClusterGroup({
                chunkedLoading: true,
                maxClusterRadius: 50
            });

            // 各物件にマーカーを追加
            properties.forEach(property => {
                const marker = L.marker(property.coordinates);

                // カスタムアイコン（価格に応じて色分け）
                const priceColor = property.price < 100000 ? 'green' :
                                 property.price < 150000 ? 'orange' : 'red';

                const customIcon = L.divIcon({
                    className: 'custom-marker',
                    html: `<div class="w-6 h-6 bg-${priceColor}-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white text-xs font-bold">¥</div>`,
                    iconSize: [24, 24],
                    iconAnchor: [12, 12]
                });

                marker.setIcon(customIcon);

                marker.bindPopup(`
                    <div class="p-2 min-w-48">
                        <h3 class="font-bold text-lg">${property.title}</h3>
                        <p class="text-sm text-gray-600">${property.address}</p>
                        <p class="text-sm font-semibold text-brand-600">¥${property.price.toLocaleString()}/月</p>
                        <div class="flex gap-1 mt-2">
                            ${property.tags.slice(0, 3).map(tag =>
                                `<span class="text-xs bg-gray-100 px-2 py-1 rounded">${tag}</span>`
                            ).join('')}
                        </div>
                        <button onclick="navigateTo('details', {id: ${property.id}})"
                                class="mt-2 w-full bg-brand-500 text-white px-3 py-1 rounded text-sm hover:bg-brand-600">
                            詳細を見る
                        </button>
                    </div>
                `);

                markers.addLayer(marker);
            });

            state.currentMap.addLayer(markers);
            state.mapMarkers = markers;

            // 現在地ボタンを追加
            L.control.locate({
                position: 'topright',
                strings: {
                    title: '現在地を表示'
                },
                locateOptions: {
                    enableHighAccuracy: true,
                    maxZoom: 16, // 最大ズームレベル
                    timeout: 10000,
                    maximumAge: 300000 // 5分間キャッシュ
                },
                flyTo: true, // スムーズに現在地に移動
                keepCurrentZoomLevel: false, // ズームレベルを変更
                showPopup: false // ポップアップは手動で制御
            }).addTo(state.currentMap);

            // 現在地取得成功時の処理
            state.currentMap.on('locationfound', (e) => {
                state.userLocation = e.latlng;
                console.log('📍 現在地を取得しました:', e.latlng);

                // 現在地にズーム（ズームレベル15で詳細表示）
                state.currentMap.setView(e.latlng, 15);

                // 現在地マーカーを追加
                const userMarker = L.marker(e.latlng, {
                    icon: L.divIcon({
                        className: 'user-location-marker',
                        html: '<div class="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg"></div>',
                        iconSize: [16, 16],
                        iconAnchor: [8, 8]
                    })
                }).addTo(state.currentMap);

                userMarker.bindPopup('<div class="text-center"><strong>あなたの現在地</strong></div>').openPopup();

                // 物件の距離情報を更新（表示は変更しない）
                updatePropertyDistances();
            });
        };

        // 物件の距離情報を更新（表示は変更しない）
        const updatePropertyDistances = () => {
            if (!state.userLocation || !state.mapMarkers) return;

            // 既存のマーカーのポップアップを更新
            state.mapMarkers.eachLayer(marker => {
                if (marker.getLatLng) {
                    const distance = propertyFilters.calculateDistance(
                        state.userLocation.lat,
                        state.userLocation.lng,
                        marker.getLatLng().lat,
                        marker.getLatLng().lng
                    );

                    // ポップアップの内容を更新（距離情報を追加）
                    const property = dummyProperties.find(p =>
                        p.coordinates[0] === marker.getLatLng().lat &&
                        p.coordinates[1] === marker.getLatLng().lng
                    );

                    if (property) {
                        const distanceText = `<p class="text-xs text-gray-500 mt-1">📍 ${distance.toFixed(1)}km</p>`;
                        marker.setPopupContent(`
                            <div class="p-2 min-w-48">
                                <h3 class="font-bold text-lg">${property.title}</h3>
                                <p class="text-sm text-gray-600">${property.address}</p>
                                <p class="text-sm font-semibold text-brand-600">¥${property.price.toLocaleString()}/月</p>
                                ${distanceText}
                                <div class="flex gap-1 mt-2">
                                    ${property.tags.slice(0, 3).map(tag =>
                                        `<span class="text-xs bg-gray-100 px-2 py-1 rounded">${tag}</span>`
                                    ).join('')}
                                </div>
                                <button onclick="navigateTo('details', {id: ${property.id}})"
                                        class="mt-2 w-full bg-brand-500 text-white px-3 py-1 rounded text-sm hover:bg-brand-600">
                                    詳細を見る
                                </button>
                            </div>
                        `);
                    }
                }
            });
        };

        // 距離ソートでマップを更新
        const updateMapWithDistanceSort = () => {
            if (!state.userLocation) return;

            const properties = getFilteredProperties();
            const propertiesWithDistance = properties.map(property => ({
                ...property,
                distance: propertyFilters.calculateDistance(
                    state.userLocation.lat,
                    state.userLocation.lng,
                    property.coordinates[0],
                    property.coordinates[1]
                )
            })).sort((a, b) => a.distance - b.distance);

            // 日本全国の物件を表示（距離フィルターは適用しない）
            initMultipleMapWithUserLocation(propertiesWithDistance);
        };

        // 現在地を中心とした複数物件マップ初期化
        const initMultipleMapWithUserLocation = (properties) => {
            if (state.currentMap) {
                state.currentMap.remove();
                state.currentMap = null;
            }

            state.mapMode = 'multiple';

            // 現在地を中心にズームレベル15で初期化
            state.currentMap = L.map('map').setView(state.userLocation, 15);

            // タイルレイヤー
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(state.currentMap);

            // 現在地マーカーを追加
            const userMarker = L.marker(state.userLocation, {
                icon: L.divIcon({
                    className: 'user-location-marker',
                    html: '<div class="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg"></div>',
                    iconSize: [16, 16],
                    iconAnchor: [8, 8]
                })
            }).addTo(state.currentMap);

            userMarker.bindPopup('<div class="text-center"><strong>あなたの現在地</strong></div>');

            // マーカークラスター
            const markers = L.markerClusterGroup({
                chunkedLoading: true,
                maxClusterRadius: 50
            });

            // 各物件にマーカーを追加
            properties.forEach(property => {
                const marker = L.marker(property.coordinates);

                // カスタムアイコン（価格に応じて色分け）
                const priceColor = property.price < 100000 ? 'green' :
                                 property.price < 150000 ? 'orange' : 'red';

                const customIcon = L.divIcon({
                    className: 'custom-marker',
                    html: `<div class="w-6 h-6 bg-${priceColor}-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white text-xs font-bold">¥</div>`,
                    iconSize: [24, 24],
                    iconAnchor: [12, 12]
                });

                marker.setIcon(customIcon);

                // 距離情報をポップアップに追加
                const distanceText = property.distance ?
                    `<p class="text-xs text-gray-500 mt-1">📍 ${property.distance.toFixed(1)}km</p>` : '';

                marker.bindPopup(`
                    <div class="p-2 min-w-48">
                        <h3 class="font-bold text-lg">${property.title}</h3>
                        <p class="text-sm text-gray-600">${property.address}</p>
                        <p class="text-sm font-semibold text-brand-600">¥${property.price.toLocaleString()}/月</p>
                        ${distanceText}
                        <div class="flex gap-1 mt-2">
                            ${property.tags.slice(0, 3).map(tag =>
                                `<span class="text-xs bg-gray-100 px-2 py-1 rounded">${tag}</span>`
                            ).join('')}
                        </div>
                        <button onclick="navigateTo('details', {id: ${property.id}})"
                                class="mt-2 w-full bg-brand-500 text-white px-3 py-1 rounded text-sm hover:bg-brand-600">
                            詳細を見る
                        </button>
                    </div>
                `);

                markers.addLayer(marker);
            });

            state.currentMap.addLayer(markers);
            state.mapMarkers = markers;

            // 現在地ボタンを追加
            L.control.locate({
                position: 'topright',
                strings: {
                    title: '現在地を表示'
                },
                locateOptions: {
                    enableHighAccuracy: true,
                    maxZoom: 16,
                    timeout: 10000,
                    maximumAge: 300000
                },
                flyTo: true,
                keepCurrentZoomLevel: false,
                showPopup: false
            }).addTo(state.currentMap);
        };

        // マップの初期化（用途に応じて自動選択）
        const initMap = (propertyOrProperties) => {
            if (Array.isArray(propertyOrProperties)) {
                initMultipleMap(propertyOrProperties);
            } else {
                initSingleMap(propertyOrProperties);
            }
        };

        // ========== UIヘルパー ==========
        const updateBottomNav = (pageKey) => {
            document.querySelectorAll('.nav-btn').forEach(btn => {
                // activeクラスを削除
                btn.classList.remove('active');

                if (btn.dataset.page === pageKey) {
                    // 現在のページのボタンにactiveクラスを追加
                    btn.classList.add('active');
                }
            });
        };

        let toastTimeout;
        // いえっぴトースト通知の表示
        const showIepitaToast = (message, type = 'info', soundType = null) => {
            clearTimeout(toastTimeout);

            // いえっぴのメッセージを生成
            const iepitaMessages = {
                success: ['やったね！', '素晴らしい！', '完璧だよ！', 'いいね！'],
                error: ['あらら...', 'うーん...', '残念...', 'ごめんね...'],
                warning: ['ちょっと待って！', '気をつけて！', '注意してね！', '大丈夫？'],
                info: ['そうそう！', 'いい感じ！', 'そうだね！', 'わかった！']
            };

            const randomMessage = iepitaMessages[type][Math.floor(Math.random() * iepitaMessages[type].length)];

            toast.innerHTML = `
                <div class="iepita-toast flex items-center p-3">
                    <div class="iepita-bounce">
                        <img src="iepita.png" alt="いえっぴ" class="w-12 h-12 drop-shadow-lg object-contain">
                    </div>
                    <div class="iepita-speech-bubble">
                        <p class="text-sm font-medium text-gray-800">${randomMessage}</p>
                        <p class="text-xs text-gray-600 mt-1">${message}</p>
                    </div>
                </div>
            `;

            toast.classList.add('show', 'toast-show');

            // サウンド効果を再生
            if (soundType) {
                playSound(soundType);
            }

            // いえっぴを少し振らせる
            const iepitaImg = toast.querySelector('img');
            if (iepitaImg) {
                iepitaImg.classList.add('iepita-wiggle');
                setTimeout(() => {
                    iepitaImg.classList.remove('iepita-wiggle');
                }, 500);
            }

            toastTimeout = setTimeout(() => {
                toast.classList.remove('show', 'toast-show');
            }, 4000);
        };

        // 従来のトースト通知（後方互換性のため）
        const showToast = (message, soundType = null) => {
            // いえっぴトーストに統一
            showIepitaToast(message, 'info', soundType);
        };

        // サウンド効果の再生
        const playSound = (type) => {
            try {
                // Web Audio APIを使用してサウンドを生成
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);

                // 音の種類に応じて周波数を設定
                switch(type) {
                    case 'like':
                        oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
                        oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1); // E5
                        break;
                    case 'star':
                        oscillator.frequency.setValueAtTime(392.00, audioContext.currentTime); // G4
                        oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime + 0.1); // C5
                        oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.2); // E5
                        break;
                    case 'dislike':
                        oscillator.frequency.setValueAtTime(220.00, audioContext.currentTime); // A3
                        break;
                }

                // 音量設定
                gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.3);
            } catch (error) {
                console.log('サウンド再生に失敗しました:', error);
            }
        };

        // ========== 写真管理 ==========
        let uploadedPhotos = [];
        const MAX_PHOTOS = 4;
        const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

        const validatePhoto = (file) => {
            if (!file.type.startsWith('image/')) {
                showNotification('画像ファイルのみアップロード可能です', 'error');
                return false;
            }

            if (file.size > MAX_FILE_SIZE) {
                showNotification('ファイルサイズは5MB以下にしてください', 'error');
                return false;
            }

            return true;
        };

        const handlePhotoUpload = (files) => {
            const validFiles = Array.from(files).filter(validatePhoto);

            if (uploadedPhotos.length + validFiles.length > MAX_PHOTOS) {
                showNotification(`最大${MAX_PHOTOS}枚までアップロード可能です`, 'error');
                return;
            }

            validFiles.forEach(file => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    uploadedPhotos.push({
                        file: file,
                        dataUrl: e.target.result
                    });
                    updatePhotoPreview();
                };
                reader.readAsDataURL(file);
            });
        };

        const updatePhotoPreview = () => {
            const previewContainer = document.getElementById('photo-preview-container');
            const uploadArea = document.getElementById('photo-upload-area');

            if (uploadedPhotos.length === 0) {
                previewContainer.classList.add('hidden');
                uploadArea.classList.remove('hidden');
                return;
            }

            uploadArea.classList.add('hidden');
            previewContainer.classList.remove('hidden');

            const images = previewContainer.querySelectorAll('img');
            const removeButtons = previewContainer.querySelectorAll('button');

            images.forEach((img, index) => {
                if (index < uploadedPhotos.length) {
                    img.src = uploadedPhotos[index].dataUrl;
                    img.parentElement.classList.remove('hidden');
                } else {
                    img.parentElement.classList.add('hidden');
                }
            });

            removeButtons.forEach((btn, index) => {
                if (index < uploadedPhotos.length) {
                    btn.classList.remove('hidden');
                } else {
                    btn.classList.add('hidden');
                }
            });
        };

        const removePhoto = (index) => {
            uploadedPhotos.splice(index, 1);
            updatePhotoPreview();
        };
        // 写真アップロード関連のイベントリスナー
        const setupPhotoUploadListeners = () => {
            const photoInput = document.getElementById('photo-input');
            const uploadArea = document.getElementById('photo-upload-area');

            // クリックでファイル選択
            uploadArea.addEventListener('click', () => {
                photoInput.click();
            });

            // ファイル選択
            photoInput.addEventListener('change', (e) => {
                handlePhotoUpload(e.target.files);
                e.target.value = ''; // 同じファイルを選択できるようにリセット
            });

            // ドラッグ&ドロップ
            uploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadArea.classList.add('border-brand-500', 'bg-brand-50');
            });

            uploadArea.addEventListener('dragleave', (e) => {
                e.preventDefault();
                uploadArea.classList.remove('border-brand-500', 'bg-brand-50');
            });

            uploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadArea.classList.remove('border-brand-500', 'bg-brand-50');
                handlePhotoUpload(e.dataTransfer.files);
            });
        };

        // ========== 物件フォーム送信処理 ==========
        const handlePropertySubmit = (e) => {
            e.preventDefault();

            const formData = new FormData(e.target);
            const selectedFacilities = Array.from(document.querySelectorAll('input[name="facilities"]:checked')).map(cb => cb.value);

            // アップロードされた写真のデータURLを取得
            const photoDataUrls = uploadedPhotos.map(photo => photo.dataUrl);

            // デフォルト画像が1枚もない場合は、プレースホルダーを使用
            const exterior_images = photoDataUrls.length > 0
                ? photoDataUrls.slice(0, 2)  // 最初の2枚を外観写真として使用
                : ['https://placehold.co/800x600/e2e8f0/64748b?text=' + encodeURIComponent('外観写真')];

            const interior_images = photoDataUrls.length > 2
                ? photoDataUrls.slice(2, 4)  // 3枚目以降を内観写真として使用
                : ['https://placehold.co/800x600/e2e8f0/64748b?text=' + encodeURIComponent('内観写真')];

            // 新しい物件オブジェクトを作成（既存物件と同じ構造）
            const newProperty = {
                id: Date.now(), // 簡単なID生成
                title: formData.get('title'),
                address: formData.get('address'),
                price: parseInt(formData.get('price')) * 10000, // 万円を円に変換
                layout: formData.get('layout'),
                age: parseInt(formData.get('age')),
                station_distance: parseInt(formData.get('walkTime')),
                station_name: formData.get('station'),
                tags: [formData.get('age'), formData.get('layout')].filter(Boolean),
                amenities: selectedFacilities,
                exterior_images: exterior_images,  // ✅ 既存物件と同じ構造
                interior_images: interior_images,  // ✅ 既存物件と同じ構造
                coordinates: [35.652, 139.544], // デフォルト座標（調布市）
                description: formData.get('description') || '',
                isUserAdded: true, // ユーザーが追加した物件であることを示すフラグ
                uploadedPhotos: uploadedPhotos // 実際の写真データも保存（実際のアプリではサーバーにアップロード）
            };

            // ダミーデータに追加
            dummyProperties.unshift(newProperty);

            // 成功メッセージを表示
            showNotification('物件が正常に出品されました！', 'success');

            // フォームをリセット
            e.target.reset();
            uploadedPhotos = [];
            updatePhotoPreview();

            // 物件リストページに戻る
            navigateTo('list');

            // 物件リストを再レンダリング
            renderPropertyList();
        };

        // ========== 通知表示機能 ==========
        const showNotification = (message, type = 'info') => {
            const notification = document.createElement('div');
            notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
                type === 'success' ? 'bg-green-500 text-white' :
                type === 'error' ? 'bg-red-500 text-white' :
                'bg-blue-500 text-white'
            }`;
            notification.textContent = message;

            document.body.appendChild(notification);

            // 3秒後に削除
            setTimeout(() => {
                notification.remove();
            }, 3000);
        };

        // ========== イベントリスナー設定 ==========
        const setupEventListeners = () => {
            document.getElementById('start-quiz-btn').addEventListener('click', () => {
                console.log('🎯 診断をはじめるボタンがクリックされました');
                navigateTo('quiz');
            });

            // 診断ページ
            document.getElementById('quiz-content').addEventListener('click', e => {
                const btn = e.target.closest('.quiz-option-btn');
                if (btn) {
                    playQuizSound(); // 効果音再生
                    handleQuizAnswer(btn.dataset.key, btn.dataset.value);
                }
            });
            document.getElementById('quiz-back-btn').addEventListener('click', goBackQuizQuestion);

            // 売り手ページボタン
            document.getElementById('seller-page-btn').addEventListener('click', () => navigateTo('seller'));
            document.getElementById('back-to-list-btn').addEventListener('click', () => navigateTo('list'));

            // 物件フォーム送信
            document.getElementById('property-form').addEventListener('submit', handlePropertySubmit);

            // 写真アップロード機能
            setupPhotoUploadListeners();

            // ナビゲーション
            bottomNav.addEventListener('click', e => {
                const btn = e.target.closest('.nav-btn');
                if (btn) {
                    console.log(`🎯 下部ナビゲーションボタンがクリックされました: ${btn.dataset.page}`);
                    playMenuSound(); // メニュー効果音を再生
                    navigateTo(btn.dataset.page);
                }
            });

            // お気に入りボタン（リストと詳細）
            appContainer.addEventListener('click', e => {
                const btn = e.target.closest('.toggle-favorite-btn, .toggle-favorite-btn-details');
                if (btn) {
                    e.preventDefault();
                    e.stopPropagation();
                    // マッチングページでは左スワイプとして処理
                    const pageMatching = document.getElementById('page-matching');
                    if (pageMatching && !pageMatching.classList.contains('page-hidden') && btn.classList.contains('toggle-favorite-btn')) {
                        programmaticSwipe('left');
                        return;
                    }
                    toggleFavorite(parseInt(btn.dataset.id));
                }
            }, true);

            // スターマークボタン（リストと詳細）
            appContainer.addEventListener('click', e => {
                const btn = e.target.closest('.toggle-star-btn, .toggle-star-btn-details');
                if (btn) {
                    e.preventDefault();
                    e.stopPropagation();
                    // マッチングページでは右スワイプとして処理
                    const pageMatching = document.getElementById('page-matching');
                    if (pageMatching && !pageMatching.classList.contains('page-hidden') && btn.classList.contains('toggle-star-btn')) {
                        programmaticSwipe('right');
                        return;
                    }
                    toggleStar(parseInt(btn.dataset.id));
                }
            }, true);

            // 興味なしボタン（リストと詳細）
            appContainer.addEventListener('click', e => {
                const btn = e.target.closest('.toggle-dislike-btn, .toggle-dislike-btn-details');
                if (btn) {
                    e.preventDefault();
                    e.stopPropagation();
                    // マッチングページでは上スワイプとして処理
                    const pageMatching = document.getElementById('page-matching');
                    if (pageMatching && !pageMatching.classList.contains('page-hidden') && btn.classList.contains('toggle-dislike-btn')) {
                        programmaticSwipe('up');
                        return;
                    }
                    toggleDislike(parseInt(btn.dataset.id));
                }
            }, true);

            // フィルター
            document.getElementById('open-filter-btn').addEventListener('click', openFilterModal);
            document.getElementById('close-filter-btn').addEventListener('click', closeFilterModal);

            // マップ表示切り替え
            document.getElementById('toggle-map-btn').addEventListener('click', () => {
                const mapContainer = document.getElementById('map-container');
                const isHidden = mapContainer.classList.contains('hidden');

                if (isHidden) {
                    // マップを表示
                    mapContainer.classList.remove('hidden');
                    const properties = getFilteredProperties();

                    // マップを初期化（日本全国の物件を表示）
                    initMap(properties);

                    // 現在地を取得して距離情報を更新
                    getUserLocation().then(location => {
                        // 現在地が取得できた場合、距離情報を更新
                        updatePropertyDistances();
                    }).catch(error => {
                        console.warn('現在地取得に失敗しました:', error);
                    });
                } else {
                    // マップを非表示
                    mapContainer.classList.add('hidden');
                    if (state.currentMap) {
                        state.currentMap.remove();
                        state.currentMap = null;
                    }
                }
            });

            // マップを閉じる
            document.getElementById('close-map-btn').addEventListener('click', () => {
                document.getElementById('map-container').classList.add('hidden');
                if (state.currentMap) {
                    state.currentMap.remove();
                    state.currentMap = null;
                }
            });

            filterModal.addEventListener('click', (e) => {
                 if (e.target === filterModal) closeFilterModal();
            });

            document.getElementById('apply-filter-btn').addEventListener('click', () => {
                state.filters.sort = document.getElementById('sort-select').value;
                state.filters.maxPrice = parseInt(document.getElementById('price-range').value);
                state.filters.maxAge = parseInt(document.getElementById('age-range').value);
                state.filters.prefecture = document.getElementById('prefecture-select').value;
                state.filters.city = document.getElementById('city-select').value;

                // 地域検索ボックスをクリア
                document.getElementById('region-search').value = '';
                document.getElementById('region-suggestions').classList.add('hidden');

                renderPropertyList();
                closeFilterModal();
            });

            document.getElementById('reset-filter-btn').addEventListener('click', () => {
                state.filters = { sort: 'match_desc', tags: [], tagMode: 'AND', maxPrice: 150000, maxAge: 100, prefecture: '', city: '' };
                document.getElementById('sort-select').value = 'match_desc';
                document.getElementById('price-range').value = 150000;
                document.getElementById('price-range-value').textContent = '15';
                document.getElementById('age-range').value = 100;
                document.getElementById('age-range-value').textContent = '100';
                document.getElementById('prefecture-select').value = '';
                document.getElementById('city-select').value = '';
                document.getElementById('region-search').value = '';
                // 市区町村セレクトをリセット
                const citySelect = document.getElementById('city-select');
                citySelect.innerHTML = '<option value="">すべて</option>';
                renderFilterTags();
                renderPropertyList();
                closeFilterModal();
            });

            document.getElementById('filter-tags').addEventListener('click', e => {
                const btn = e.target.closest('.filter-tag-btn');
                if(btn) {
                    const tag = btn.dataset.tag;
                    const index = state.filters.tags.indexOf(tag);
                    if (index > -1) {
                        state.filters.tags.splice(index, 1);
                        btn.classList.remove('bg-brand-500', 'border-brand-500', 'text-white');
                        btn.classList.add('bg-white', 'border-slate-300', 'text-slate-700');
                    } else {
                        state.filters.tags.push(tag);
                        btn.classList.add('bg-brand-500', 'border-brand-500', 'text-white');
                        btn.classList.remove('bg-white', 'border-slate-300', 'text-slate-700');
                    }
                }
            });

            // === チャットボット：段階1 - イベントリスナー ===

            // 閉じるボタン
            document.getElementById('chatbot-close-btn').addEventListener('click', closeChatbotModal);

            // モーダル背景クリックで閉じる
            document.getElementById('chatbot-modal').addEventListener('click', (e) => {
                if (e.target.id === 'chatbot-modal') {
                    closeChatbotModal();
                }
            });

            // === マッチングモード：スワイプヒントボタン ===

            // スワイプヒントボタンのクリックイベント
            document.querySelectorAll('.swipe-hint-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const swipeDirection = btn.dataset.swipe;
                    console.log(`💡 スワイプヒントボタンがクリックされました: ${swipeDirection}`);
                    programmaticSwipe(swipeDirection);
                });
            });

            // === オンボーディング：段階2 - イベントリスナー ===

            // スキップボタン
            document.getElementById('onboarding-skip').addEventListener('click', () => {
                if (confirm('チュートリアルをスキップしますか？\n（設定からいつでも見られます）')) {
                    console.log('⏭️ チュートリアルをスキップしました');
                    playMenuSound(); // スキップ音
                    closeOnboarding(true);
                    navigateTo('start');
                }
            });

            // 次へボタン
            document.getElementById('onboarding-next').addEventListener('click', () => {
                nextOnboardingStep();
            });

            document.querySelector('.p-0\\.5.bg-slate-200').addEventListener('click', e => {
                const btn = e.target.closest('.filter-tag-mode-btn');
                if (btn) {
                    state.filters.tagMode = btn.dataset.type;
                    document.querySelectorAll('.filter-tag-mode-btn').forEach(b => {
                        if (b.dataset.type === state.filters.tagMode) {
                            b.classList.add('bg-white', 'shadow');
                            b.classList.remove('text-slate-500');
                        } else {
                            b.classList.remove('bg-white', 'shadow');
                            b.classList.add('text-slate-500');
                        }
                    });
                }
            });

            // レンジスライダー
            document.getElementById('price-range').addEventListener('input', e => {
                document.getElementById('price-range-value').textContent = (e.target.value / 10000).toLocaleString();
            });
            document.getElementById('age-range').addEventListener('input', e => {
                document.getElementById('age-range-value').textContent = e.target.value;
            });

            // ブラウザの戻るボタン対応
            window.addEventListener('popstate', (event) => {
                // history.back()で戻った場合に、SPA内でのナビゲーションが壊れないように
                // 簡易的な実装として、リストページに強制的に戻す
                // 本格的なSPAではルーティングライブラリが必要
                if(state.currentPage === 'details') {
                    navigateTo('list');
                }
            });

        };

        // window.navigateToをグローバルに公開して、インラインonclickから呼び出せるようにする
        window.navigateTo = navigateTo;
        window.removePhoto = removePhoto;

        // Service Workerの登録
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js')
                    .then((registration) => {
                        console.log('Service Worker: 登録成功', registration.scope);
                    })
                    .catch((error) => {
                        console.log('Service Worker: 登録失敗', error);
                    });
            });
        }

        // アプリケーション起動
        init();

    });
