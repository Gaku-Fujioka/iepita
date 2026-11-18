const createMatching = ({ page, initSwipeSounds, playSwipeSound, toggleFavorite, toggleStar, toggleDislike }) => {
    const matchingContainer = page.querySelector('#matching-container');
    const matchingEmpty = page.querySelector('#matching-empty');
    const matching = { currentIndex: 0, properties: [], isAnimating: false };
    let active = false;
    let swipeListeners;
    let animationTimer;

    const stop = () => {
        active = false;
        swipeListeners?.abort();
        clearTimeout(animationTimer);
        matching.isAnimating = false;
    };

    const start = (properties, answers, questions) => {
        stop();
        active = true;
        // 効果音を初期化
        initSwipeSounds();

        // 診断結果に基づいて物件をフィルタリング
        const answerTags = Object.entries(answers).flatMap(([key, value]) => {
            const question = questions.find(q => q.key === key);
            const option = question.options.find(o => o.value === value);
            return option ? option.tags : [];
        });

        // マッチ度でソートして上位20件を取得
        const sortedProperties = [...properties].sort((a, b) => {
            const aScore = a.tags.filter(tag => answerTags.includes(tag)).length;
            const bScore = b.tags.filter(tag => answerTags.includes(tag)).length;
            return bScore - aScore;
        }).slice(0, 20);

        matching.properties = sortedProperties;
        matching.currentIndex = 0;
        matching.isAnimating = false;

        renderMatchingCards();
    };

    const renderMatchingCards = () => {
        swipeListeners?.abort();
        if (matching.currentIndex >= matching.properties.length) {
            matchingContainer.innerHTML = '';
            matchingEmpty.classList.remove('hidden');
            return;
        }

        matchingEmpty.classList.add('hidden');

        // 現在のカードと次のカードを表示（重ね合わせ）
        const currentProperty = matching.properties[matching.currentIndex];
        const nextProperty = matching.properties[matching.currentIndex + 1];

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

        swipeListeners = new AbortController();
        const { signal } = swipeListeners;

        let startX = 0;
        let startY = 0;
        let currentX = 0;
        let currentY = 0;
        let isDragging = false;
        let lastClickTime = 0;

        const startDrag = (e) => {
            if (matching.isAnimating) return;

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
            if (!isDragging || matching.isAnimating) return;

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
            if (!isDragging || matching.isAnimating) return;

            isDragging = false;
            currentCard.classList.remove('swiping');

            const threshold = 100;

            // 上スワイプを優先的にチェック（Y方向の移動が大きく、上向きの場合）
            if (currentY < -threshold && Math.abs(currentY) > Math.abs(currentX) * 1.2) {
                // 上スワイプ = 興味なし
                matching.isAnimating = true;
                currentCard.classList.add('swipe-up', 'swipe-success');
                playSwipeSound('dislike'); // 効果音再生
                toggleDislike(parseInt(currentCard.dataset.id));

                // アニメーション完了後に次のカードを表示
                animationTimer = setTimeout(() => {
                    matching.currentIndex++;
                    matching.isAnimating = false;
                    renderMatchingCards();
                }, 300);
            } else if (Math.abs(currentX) > threshold) {
                // 横スワイプが完了
                matching.isAnimating = true;

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
                animationTimer = setTimeout(() => {
                    matching.currentIndex++;
                    matching.isAnimating = false;
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
            if (matching.isAnimating) return;

            const currentTime = new Date().getTime();
            if (currentTime - lastClickTime < 300) {
                // ダブルクリック検出
                matching.isAnimating = true;
                currentCard.classList.add('swipe-left', 'swipe-success');
                playSwipeSound('dislike'); // 効果音再生
                toggleDislike(parseInt(currentCard.dataset.id));

                animationTimer = setTimeout(() => {
                    matching.currentIndex++;
                    matching.isAnimating = false;
                    renderMatchingCards();
                }, 300);
            }
            lastClickTime = currentTime;
        };

        // マウスイベント
        currentCard.addEventListener('mousedown', startDrag, { signal });
        currentCard.addEventListener('click', handleDoubleClick, { signal });
        document.addEventListener('mousemove', drag, { signal });
        document.addEventListener('mouseup', endDrag, { signal });

        // タッチイベント
        currentCard.addEventListener('touchstart', startDrag, { passive: false, signal });
        document.addEventListener('touchmove', drag, { passive: false, signal });
        document.addEventListener('touchend', endDrag, { signal });
    };

    // プログラム的にスワイプを実行する関数
    const programmaticSwipe = (direction) => {
        if (!active) return;

        // アニメーション中やカードがない場合はスキップ
        if (matching.isAnimating) {
            console.log('⏸️ スワイプアニメーション中です...');
            return;
        }

        const currentCard = matchingContainer.querySelector('.swipe-card.current');
        if (!currentCard) {
            console.log('⚠️ スワイプするカードがありません');
            return;
        }

        const propertyId = parseInt(currentCard.dataset.id);
        matching.isAnimating = true;

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
                matching.isAnimating = false;
                return;
        }

        // アニメーション完了後に次のカードを表示
        animationTimer = setTimeout(() => {
            matching.currentIndex++;
            matching.isAnimating = false;
            renderMatchingCards();
            console.log('✅ スワイプ完了、次のカードを表示');
        }, 450); // アニメーション時間(0.4s)より少し長めに設定
    };

    page.addEventListener('click', event => {
        const button = event.target.closest('.swipe-hint-btn');
        if (button) programmaticSwipe(button.dataset.swipe);
    });

    return { start, stop, programmaticSwipe };
};
