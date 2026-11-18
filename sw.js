// Service Worker for いえぴた！
const appUrl = path => new URL(path, self.registration.scope).href;
const CACHE_PREFIX = 'iepita:' + self.registration.scope + ':';
const CACHE_VERSION = 'v2';
const CACHE_NAME = CACHE_PREFIX + CACHE_VERSION;

const entryUrls = new Set([appUrl('./'), appUrl('./index.html')]);
const appAssets = new Set([
  'index.html',
  'manifest.json',
  'styles/app.css',
  'src/main.js',
  'src/property-filters.js',
  'src/quiz-scoring.js',
  'src/saved-ratings.js',
  'src/property-map.js',
  'src/matching.js',
  'src/inquiry.js',
  'properties.json',
  'quiz.json',
  'iepita.png',
  'sounds/favorite.mp3',
  'sounds/star.mp3',
  'sounds/dislike.mp3',
  'sounds/quiz.mp3',
  'sounds/quizstart.mp3',
  'sounds/chuto.mp3',
  'sounds/menu.mp3'
].map(appUrl));

const cdnAssets = new Set([
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet.locatecontrol@0.78.0/dist/L.Control.Locate.min.css',
  'https://unpkg.com/leaflet.locatecontrol@0.78.0/dist/L.Control.Locate.min.js',
  'https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.css',
  'https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.Default.css',
  'https://unpkg.com/leaflet.markercluster@1.4.1/dist/leaflet.markercluster.js'
]);

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll([...appAssets].map(url => new Request(url, { cache: 'reload' })));

    // CDN に接続できない場合でも、アプリ本体のキャッシュを使えるようにする。
    await Promise.allSettled([...cdnAssets].map(async url => {
      const response = await fetch(url, { signal: AbortSignal.timeout(3000), cache: 'reload' });
      if (response.ok) await cache.put(url, response);
    }));
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames
      .filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

const fromAppCache = async (url, request) => {
  const cache = await caches.open(CACHE_NAME);
  return (await cache.match(url)) || fetch(request);
};

const fromCdnCache = async (request) => {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached && (request.mode === 'no-cors' || cached.type !== 'opaque')) return cached;

  const response = await fetch(request);
  if (response.ok || response.type === 'opaque') {
    try {
      await cache.put(request, response.clone());
    } catch (error) {
      console.warn('CDN リソースをキャッシュできませんでした:', request.url, error);
    }
  }
  return response;
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (request.mode === 'navigate' && entryUrls.has(url.origin + url.pathname)) {
    event.respondWith(fromAppCache(appUrl('./index.html'), request));
  } else if (appAssets.has(url.href)) {
    event.respondWith(fromAppCache(url.href, request));
  } else if (cdnAssets.has(url.href)) {
    event.respondWith(fromCdnCache(request));
  }
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
      clients.openWindow(appUrl('./?action=quiz'))
    );
  } else if (event.action === 'close') {
    // 何もしない
  } else {
    // デフォルトの動作
    event.waitUntil(
      clients.openWindow(appUrl('./'))
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


