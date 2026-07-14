/* Service Worker - 오프라인 캐시 + 알림 + 주기 동기화 */
const CACHE = "quotes-v1";
const ASSETS = [
  "./",
  "index.html",
  "styles.css",
  "app.js",
  "quotes.js",
  "icon.svg",
  "manifest.webmanifest",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});

/* 같은 quotes.js의 로직을 SW 안에서도 재사용 (주기 동기화 알림용) */
importScripts("quotes.js");

function daySeed(d) {
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function strHash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}
function catLabel(catId) {
  const c = (typeof CATEGORIES !== "undefined" ? CATEGORIES : []).find((x) => x.id === catId);
  return c ? c.label : "";
}

/* 오늘의 명언: 각 카테고리에서 1개씩 */
function pickDailyOnePerCategory(d) {
  return CATEGORIES.map((c) => {
    const list = QUOTES.filter((q) => q.cat === c.id);
    const rng = mulberry32(daySeed(d) + strHash(c.id));
    return list[Math.floor(rng() * list.length)];
  }).filter(Boolean);
}

async function showDailyNotification() {
  const quotes = pickDailyOnePerCategory(new Date());
  const body = quotes.map((q) => `[${catLabel(q.cat)}] ${q.text}`).join("\n");
  await self.registration.showNotification("📖 오늘의 명언 3개", {
    body,
    icon: "icon.svg",
    badge: "icon.svg",
    tag: "daily-quote",
    data: { url: "./" },
  });
}

/* 주기 동기화 - 지원 브라우저(설치형 PWA)에서 9시 근처에 발화 */
self.addEventListener("periodicsync", (e) => {
  if (e.tag === "daily-quote") {
    const hour = new Date().getHours();
    if (hour >= 9 && hour < 11) {
      e.waitUntil(showDailyNotification());
    }
  }
});

/* 알림 클릭 시 앱 열기/포커스 */
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow("./");
    })
  );
});
