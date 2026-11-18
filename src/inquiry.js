const setupInquiry = ({ detailsPage, findProperty }) => {
    const modal = document.getElementById('chatbot-modal');
    let pendingStep;
    const scheduleStep = (callback, delay) => {
        clearTimeout(pendingStep);
        pendingStep = setTimeout(callback, delay);
    };

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
    const openChatbotModal = (propertyId) => {
        const property = findProperty(propertyId);
        if (!property) return;
        chatbotState.propertyId = propertyId;

        modal.classList.remove('hidden');

        // 初期メッセージ表示
        scheduleStep(() => {
            addIepitaMessage(`こんにちは！「${property.title}」について質問があるんだね！`);
            scheduleStep(() => {
                const typing = showTypingIndicator();
                scheduleStep(() => {
                    typing.remove();
                    addIepitaMessage('どんなことが知りたい？');
                    scheduleStep(() => showInquiryTypeOptions(), 500);
                }, 1500);
            }, 1000);
        }, 300);
    };

    const closeChatbotModal = () => {
        clearTimeout(pendingStep);
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
    const showInquiryTypeOptions = () => {
        const inputArea = document.getElementById('chat-input-area');
        inputArea.innerHTML = `
            <div class="space-y-2">
                <button data-inquiry-type="details" class="chat-option-btn w-full">
                    📝 物件の詳細を聞きたい
                </button>
                <button data-inquiry-type="visit" class="chat-option-btn w-full">
                    🏠 内見・見学をしたい
                </button>
                <button data-inquiry-type="contract" class="chat-option-btn w-full">
                    📋 契約条件について相談したい
                </button>
                <button data-inquiry-type="other" class="chat-option-btn w-full">
                    💬 その他の質問
                </button>
            </div>
        `;
    };

    const selectInquiryType = (type) => {
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
        scheduleStep(() => {
            typing.remove();
            if (type === 'visit') {
                addIepitaMessage('いいね！いつ頃見学できそう？');
                scheduleStep(() => showVisitDateOptions(), 500);
            } else {
                addIepitaMessage('わかった！詳しく教えてもらえる？');
                scheduleStep(() => showMessageInput(), 500);
            }
        }, 1000);
    };

    // ステップ2: 見学日時選択（内見の場合のみ）
    const showVisitDateOptions = () => {
        const inputArea = document.getElementById('chat-input-area');
        inputArea.innerHTML = `
            <div class="space-y-2">
                <button data-visit-date="this-week" class="chat-option-btn w-full">
                    📅 今週中
                </button>
                <button data-visit-date="next-week" class="chat-option-btn w-full">
                    📅 来週
                </button>
                <button data-visit-date="after-next" class="chat-option-btn w-full">
                    📅 再来週以降
                </button>
                <button data-visit-date="flexible" class="chat-option-btn w-full">
                    🤔 調整したい
                </button>
            </div>
        `;
    };

    const selectVisitDate = (date) => {
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
        scheduleStep(() => {
            typing.remove();
            addIepitaMessage('了解！何か特に伝えたいことはある？');
            // 段階4で実装するshowMessageInput()を呼ぶ
            scheduleStep(() => {
                showMessageInput();
            }, 500);
        }, 1000);
    };

    // === 段階4: フォーム入力 ===

    // ステップ3: メッセージ入力
    const showMessageInput = () => {
        const inputArea = document.getElementById('chat-input-area');
        inputArea.innerHTML = `
            <div class="space-y-2">
                <textarea id="chat-message-input"
                          class="chat-textarea"
                          rows="3"
                          placeholder="質問や要望があれば教えてね（スキップもOK）"></textarea>
                <button data-chat-action="message" class="chat-submit-btn w-full">
                    次へ進む →
                </button>
            </div>
        `;
        document.getElementById('chat-message-input').focus();
    };

    const submitMessage = () => {
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
        scheduleStep(() => {
            typing.remove();
            addIepitaMessage('ありがとう！最後に連絡先を教えてね！');
            scheduleStep(() => showContactForm(), 500);
        }, 1000);
    };

    // ステップ4: 連絡先フォーム
    const showContactForm = () => {
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
                <button data-chat-action="submit" class="chat-submit-btn w-full">
                    📨 問い合わせを送信
                </button>
            </div>
        `;
        document.getElementById('chat-name').focus();
    };

    const submitInquiry = () => {
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
        const property = findProperty(chatbotState.propertyId);
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
        scheduleStep(() => {
            typing.remove();
            addIepitaMessage('問い合わせを受け付けたよ！✨');
            scheduleStep(() => {
                addIepitaMessage('担当者から2営業日以内に連絡するから、楽しみに待っててね！');
                scheduleStep(() => showCloseButton(), 500);
            }, 1000);
        }, 1000);
    };

    const showCloseButton = () => {
        const inputArea = document.getElementById('chat-input-area');
        inputArea.innerHTML = `
            <button data-chat-action="close" class="w-full bg-slate-800 text-white font-bold py-3 rounded-xl hover:bg-slate-700 transition">
                閉じる
            </button>
        `;
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

    detailsPage.addEventListener('click', event => {
        const button = event.target.closest('[data-inquiry-id]');
        if (button) openChatbotModal(Number(button.dataset.inquiryId));
    });

    modal.addEventListener('click', event => {
        if (event.target === modal || event.target.closest('#chatbot-close-btn')) {
            closeChatbotModal();
            return;
        }

        const button = event.target.closest('button');
        if (!button) return;

        const { inquiryType, visitDate, chatAction } = button.dataset;
        if (inquiryType) selectInquiryType(inquiryType);
        if (visitDate) selectVisitDate(visitDate);
        if (chatAction === 'message') submitMessage();
        if (chatAction === 'submit') submitInquiry();
        if (chatAction === 'close') closeChatbotModal();
    });

    return { close: closeChatbotModal };
};
