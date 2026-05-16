// 내 환율 계산 - Service Worker v6
// 강화 포인트: navigation 요청은 무조건 캐시된 index.html을 반환,
// 쿼리스트링 무시(ignoreSearch), 새 SW 즉시 활성화

const CACHE_VERSION = 'exchange-calc-v6';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
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

  // 1) 페이지(navigation) 요청 — 홈 화면에서 앱을 실행하거나 새로고침할 때 발생.
  //    항상 cached index.html을 반환해서 어떤 진입 경로(./, ./index.html, ?source=pwa 등)
  //    에서도 안정적으로 앱을 띄움.
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

// 새 SW 활성화 즉시 모든 클라이언트(홈 화면 앱 포함) 새로고침
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
