const createPropertyMap = ({ getFilteredProperties, openProperty, onUnavailable }) => {
    const container = document.getElementById('map-container');
    const propertyMarkers = new Map();
    let currentMap = null;
    let detailMap = null;
    let userLocation = null;

    const closeList = () => {
        currentMap?.remove();
        currentMap = null;
        propertyMarkers.clear();
    };

    const closeDetail = () => {
        detailMap?.remove();
        detailMap = null;
    };

    const createPropertyPopup = (property, distanceKm) => {
        const content = document.createElement('div');
        content.innerHTML = `
        <div class="p-2 min-w-48">
            <h3 class="font-bold text-lg">${property.title}</h3>
            <p class="text-sm text-gray-600">${property.address}</p>
            <p class="text-sm font-semibold text-brand-600">¥${property.price.toLocaleString()}/月</p>
            ${distanceKm == null ? '' : `<p class="text-xs text-gray-500 mt-1">📍 ${distanceKm.toFixed(1)}km</p>`}
            <div class="flex gap-1 mt-2">
                ${property.tags.slice(0, 3).map(tag =>
                    `<span class="text-xs bg-gray-100 px-2 py-1 rounded">${tag}</span>`
                ).join('')}
            </div>
            <button data-map-details
                    class="mt-2 w-full bg-brand-500 text-white px-3 py-1 rounded text-sm hover:bg-brand-600">
                詳細を見る
            </button>
        </div>
        `;
        content.querySelector('[data-map-details]').addEventListener('click', () => openProperty(property.id));
        return content;
    };

    const updatePropertyDistances = () => {
        if (!userLocation) return;

        for (const [marker, property] of propertyMarkers) {
            const { lat, lng } = marker.getLatLng();
            const distance = propertyFilters.calculateDistance(userLocation.lat, userLocation.lng, lat, lng);
            marker.setPopupContent(createPropertyPopup(property, distance));
        }
    };

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
                    userLocation = location;
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

    // 物件詳細ページ専用のマップ初期化
    const initDetailMap = (property) => {
        // 既存の詳細ページ地図を削除
        closeDetail();
        if (!window.L) return;

        // DOM要素の存在とサイズを確認
        const mapContainer = document.getElementById('detail-map');
        if (!mapContainer) {
            console.warn('地図コンテナが見つかりません');
            return;
        }

        // コンテナのサイズを強制的に再計算
        mapContainer.style.height = '256px'; // h-64 = 16rem = 256px

        // 詳細ページ地図を初期化
        detailMap = L.map('detail-map').setView(property.coordinates, 15);

        // タイルレイヤー
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(detailMap);

        // 物件マーカー
        const marker = L.marker(property.coordinates).addTo(detailMap);
        marker.bindPopup(`
            <div class="p-2">
                <h3 class="font-bold text-lg">${property.title}</h3>
                <p class="text-sm text-gray-600">${property.address}</p>
                <p class="text-sm font-semibold text-brand-600">¥${property.price.toLocaleString()}/月</p>
            </div>
        `);

        // 地図のサイズを強制的に再計算（念のため）
        setTimeout(() => {
            if (detailMap) {
                detailMap.invalidateSize();
            }
        }, 100);
    };

    // 複数物件のマップ初期化
    const initMultipleMap = (properties) => {
        closeList();

        // 全物件の中心点を計算
        const bounds = L.latLngBounds();
        properties.forEach(property => {
            bounds.extend(property.coordinates);
        });

        currentMap = L.map('map');
        if (bounds.isValid()) {
            currentMap.fitBounds(bounds);
        } else {
            currentMap.setView([35.65, 139.54], 12);
        }

        // タイルレイヤー
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(currentMap);

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

            marker.bindPopup(createPropertyPopup(property));
            propertyMarkers.set(marker, property);

            markers.addLayer(marker);
        });

        currentMap.addLayer(markers);

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
        }).addTo(currentMap);

        // 現在地取得成功時の処理
        currentMap.on('locationfound', (e) => {
            userLocation = e.latlng;
            console.log('📍 現在地を取得しました:', e.latlng);

            // 現在地にズーム（ズームレベル15で詳細表示）
            currentMap.setView(e.latlng, 15);

            // 現在地マーカーを追加
            const userMarker = L.marker(e.latlng, {
                icon: L.divIcon({
                    className: 'user-location-marker',
                    html: '<div class="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg"></div>',
                    iconSize: [16, 16],
                    iconAnchor: [8, 8]
                })
            }).addTo(currentMap);

            userMarker.bindPopup('<div class="text-center"><strong>あなたの現在地</strong></div>').openPopup();

            // 物件の距離情報を更新（表示は変更しない）
            updatePropertyDistances();
        });
    };

    const hideList = () => {
        container.classList.add('hidden');
        closeList();
    };

    document.getElementById('toggle-map-btn').addEventListener('click', () => {
        if (!container.classList.contains('hidden')) {
            hideList();
            return;
        }
        if (!window.L?.markerClusterGroup || !L.control.locate) {
            onUnavailable();
            return;
        }

        container.classList.remove('hidden');
        initMultipleMap(getFilteredProperties());
        getUserLocation().then(updatePropertyDistances).catch(error => {
            console.warn('現在地取得に失敗しました:', error);
        });
    });
    document.getElementById('close-map-btn').addEventListener('click', hideList);

    return { initDetailMap, closeDetail, getLocation: () => userLocation };
};
