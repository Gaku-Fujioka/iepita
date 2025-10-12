// Service Worker for いえぴた！
const CACHE_NAME = 'iepita-v1.1.0';
const urlsToCache = [
  '/',
  '/index.html',
  '/properties.json',
  '/quiz.json',
  '/iepita.png',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet.locatecontrol@0.78.0/dist/L.Control.Locate.min.css',
  'https://unpkg.com/leaflet.locatecontrol@0.78.0/dist/L.Control.Locate.min.js',
  'https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.css',
  'https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.Default.css',
  'https://unpkg.com/leaflet.markercluster@1.4.1/dist/leaflet.markercluster.js'
];

// インストール時の処理
self.addEventListener('install', (event) => {
  console.log('Service Worker: インストール中...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: キャッシュを開きました');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.error('Service Worker: キャッシュの追加に失敗しました', error);
      })
  );
});

// アクティベート時の処理
self.addEventListener('activate', (event) => {
  console.log('Service Worker: アクティベート中...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: 古いキャッシュを削除中...', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// フェッチ時の処理
self.addEventListener('fetch', (event) => {
  // 画像ファイル（p001.png等）は404を返すことが多いので、キャッシュしない
  if (event.request.url.includes('.png') && event.request.url.includes('p0')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // キャッシュに存在する場合はキャッシュを返す
        if (response) {
          console.log('Service Worker: キャッシュから取得', event.request.url);
          return response;
        }

        // キャッシュに存在しない場合はネットワークから取得
        console.log('Service Worker: ネットワークから取得', event.request.url);
        return fetch(event.request).catch(() => {
          // ネットワークエラーの場合は、オフライン用のページを返す
          if (event.request.destination === 'document') {
            return caches.match('/index.html');
          }
        });
      })
  );
});

// バックグラウンド同期
self.addEventListener('sync', (event) => {
  console.log('Service Worker: バックグラウンド同期', event.tag);
  
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // オフライン時のデータを同期する処理
      syncOfflineData()
    );
  }
});

// プッシュ通知
self.addEventListener('push', (event) => {
  console.log('Service Worker: プッシュ通知を受信', event);
  
  const options = {
    body: event.data ? event.data.text() : 'いえぴた！からのお知らせです',
    icon: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🏠</text></svg>',
    badge: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🏠</text></svg>',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: '診断をはじめる',
        icon: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🏠</text></svg>'
      },
      {
        action: 'close',
        title: '閉じる',
        icon: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🏠</text></svg>'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('いえぴた！', options)
  );
});

// 通知クリック時の処理
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: 通知がクリックされました', event);
  
  event.notification.close();

  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/?action=quiz')
    );
  } else if (event.action === 'close') {
    // 何もしない
  } else {
    // デフォルトの動作
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// オフライン時のデータ同期
async function syncOfflineData() {
  try {
    // オフライン時に保存されたデータを同期
    console.log('Service Worker: オフライン時のデータを同期中...');
    
    // ここでオフライン時のデータをサーバーに送信する処理を実装
    // 例：お気に入り、スター、興味なしのデータを同期
    
    console.log('Service Worker: データ同期完了');
  } catch (error) {
    console.error('Service Worker: データ同期に失敗しました', error);
  }
}


