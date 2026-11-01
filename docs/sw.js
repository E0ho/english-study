// 빨리 열기: 저장해 둔 것으로 바로 보여 주고, 새 버전은 뒤에서 받아 다음에 열 때 반영한다.
// 지하철처럼 신호가 약해도 서버 응답을 기다리지 않는다. 처음 한 번만 네트워크로 받는다.
const CACHE = 'eng-review-v19';
const SHELL = ['./', './index.html', './style.css', './app.js', './data.json', './grammar.json', './course.json', './firebase-config.js', './manifest.json', './icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 카드·문법·목차 데이터가 바뀌었으면 열려 있는 앱에 알린다 (앱이 "다음에 열 때 반영돼요" 알림을 띄운다)
const notify = () => self.clients.matchAll().then(cs => cs.forEach(c => c.postMessage({ type: 'updated' })));

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  const key = url.origin + url.pathname;   // ?v= 같은 꼬리는 떼고 저장한다
  e.respondWith(caches.open(CACHE).then(async cache => {
    const hit = await cache.match(key) || await cache.match(e.request, { ignoreSearch: true });
    const old = hit && /\.json$/.test(url.pathname) ? hit.clone() : null;   // 화면에 넘긴 뒤에는 읽을 수 없으니 미리 복사해 둔다
    const net = fetch(e.request, { cache: 'no-cache' }).then(async res => {
      if (res.ok) {
        if (old) {
          const [a, b] = await Promise.all([old.text(), res.clone().text()]);
          if (a !== b) notify();
        }
        await cache.put(key, res.clone());
      }
      return res;
    });
    if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
    return net.catch(() => cache.match('./index.html'));
  }));
});
