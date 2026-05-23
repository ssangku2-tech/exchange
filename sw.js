// 내 환율 계산 - Service Worker v14
// v13 → v14: 카드 높이 증가, 키패드 누름 효과 강화 (시각/햅틱)

const CACHE_VERSION = 'exchange-calc-v14';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './og-image.png',
  'https://unpkg.com/react@18.3.1/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone@7.24.7/babel.min.js',
  'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      cache.addAll(CORE_ASSETS).catch((err) => {
        console.warn('Some assets failed to cache:', err);
      })
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
        )
      ),
      self.clients.claim(),
    ])
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1) 페이지(navigation) 요청 — 홈 화면 실행 / 새로고침 시.
  //    어떤 진입 경로로 들어와도 안정적으로 앱을 띄움.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html', { ignoreSearch: true })
        .then((cached) => {
          if (cached) return cached;
          return caches.match('./', { ignoreSearch: true });
        })
        .then((cached) => {
          if (cached) return cached;
          return fetch(event.request).catch(() => new Response(
            '<!DOCTYPE html><meta charset="utf-8"><title>오프라인</title>' +
            '<p style="font-family:sans-serif;padding:24px;">오프라인 상태인데 캐시도 비어있습니다. ' +
            '인터넷에 연결한 뒤 한 번 새로고침해 주세요.</p>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          ));
        })
    );
    return;
  }

  // 2) 환율 API — 네트워크 우선 (성공 시 캐시 갱신, 실패 시 캐시 사용)
  if (url.hostname === 'open.er-api.com') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request, { ignoreSearch: true }))
    );
    return;
  }

  // 3) 그 외 리소스 — 캐시 우선, 없으면 네트워크에서 받아 캐시에 저장
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response && response.ok) {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
