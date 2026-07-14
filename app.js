/* 오늘의 명언 - 앱 로직
 * - 매일 날짜를 시드로 3개의 명언을 결정적으로 선택
 * - 오전 9시에 브라우저 알림 (탭/PWA가 실행 중일 때)
 * - Service Worker로 설치형 PWA 및 알림 표시
 */

const NOTIFY_HOUR = 9; // 오전 9시
const LS_ENABLED = "quote_notify_enabled";
const LS_LAST_NOTIFIED = "quote_notify_last_date";

/* ---------- 날짜 유틸 ---------- */
function dateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}
function daySeed(d = new Date()) {
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

/* mulberry32: 시드 기반 결정적 난수 생성기 */
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* 오늘의 명언 3개를 결정적으로 선택 (같은 날 = 항상 같은 3개) */
function pickDailyQuotes(count = 3, d = new Date()) {
  const rng = mulberry32(daySeed(d));
  const pool = QUOTES.map((_, i) => i);
  const chosen = [];
  const n = Math.min(count, pool.length);
  for (let i = 0; i < n; i++) {
    const idx = Math.floor(rng() * pool.length);
    chosen.push(pool.splice(idx, 1)[0]);
  }
  return chosen.map((i) => QUOTES[i]);
}

/* ---------- 렌더링 ---------- */
function renderDate() {
  const now = new Date();
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  document.getElementById("date").textContent =
    `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일 (${days[now.getDay()]})`;
}

function renderQuotes() {
  const quotes = pickDailyQuotes(3);
  const container = document.getElementById("quotes");
  container.innerHTML = "";
  quotes.forEach((q, i) => {
    const card = document.createElement("article");
    card.className = "quote";
    card.innerHTML = `
      <span class="num">${i + 1}</span>
      <span class="mark">“</span>
      <p>${escapeHtml(q.text)}</p>
      <p class="author">— ${escapeHtml(q.author)}</p>`;
    container.appendChild(card);
  });
  return quotes;
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

/* ---------- 알림 ---------- */
let swReg = null;

async function showQuoteNotification() {
  const quotes = pickDailyQuotes(3);
  const body = quotes.map((q, i) => `${i + 1}. ${q.text}`).join("\n");
  const options = {
    body,
    icon: "icon.svg",
    badge: "icon.svg",
    tag: "daily-quote",
    requireInteraction: false,
    data: { url: location.href },
  };
  try {
    if (swReg && swReg.showNotification) {
      await swReg.showNotification("📖 오늘의 명언 3개", options);
    } else {
      new Notification("📖 오늘의 명언 3개", options);
    }
    localStorage.setItem(LS_LAST_NOTIFIED, dateKey());
  } catch (e) {
    console.warn("알림 표시 실패:", e);
  }
}

function msUntilNext9() {
  const now = new Date();
  const next = new Date();
  next.setHours(NOTIFY_HOUR, 0, 0, 0);
  if (now >= next) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

let scheduleTimer = null;
function scheduleDailyNotification() {
  clearTimeout(scheduleTimer);
  if (localStorage.getItem(LS_ENABLED) !== "1") return;
  if (Notification.permission !== "granted") return;

  const delay = msUntilNext9();
  // setTimeout 최대 지연은 약 24.8일이라 하루(최대 24시간)는 안전
  scheduleTimer = setTimeout(async () => {
    if (localStorage.getItem(LS_LAST_NOTIFIED) !== dateKey()) {
      await showQuoteNotification();
    }
    scheduleDailyNotification(); // 다음 날 예약
  }, delay);
}

async function enableNotifications() {
  if (!("Notification" in window)) {
    alert("이 브라우저는 알림을 지원하지 않습니다.");
    return;
  }
  let perm = Notification.permission;
  if (perm !== "granted") perm = await Notification.requestPermission();

  if (perm === "granted") {
    localStorage.setItem(LS_ENABLED, "1");
    await registerPeriodicSync();
    scheduleDailyNotification();
  } else {
    localStorage.setItem(LS_ENABLED, "0");
    if (perm === "denied") {
      alert("알림이 차단되어 있습니다. 브라우저 사이트 설정에서 알림을 허용해주세요.");
    }
  }
  updateNotifyUI();
}

/* 설치형 PWA에서 백그라운드 주기 동기화 시도 (지원 시 best-effort) */
async function registerPeriodicSync() {
  try {
    if (swReg && "periodicSync" in swReg) {
      const status = await navigator.permissions.query({ name: "periodic-background-sync" });
      if (status.state === "granted") {
        await swReg.periodicSync.register("daily-quote", { minInterval: 12 * 60 * 60 * 1000 });
      }
    }
  } catch (_) {
    /* 지원하지 않는 브라우저는 무시 (페이지 타이머로 동작) */
  }
}

function updateNotifyUI() {
  const enabled = localStorage.getItem(LS_ENABLED) === "1";
  const granted = "Notification" in window && Notification.permission === "granted";
  const on = enabled && granted;

  const title = document.getElementById("notifyTitle");
  const desc = document.getElementById("notifyDesc");
  const enableBtn = document.getElementById("enableBtn");
  const testBtn = document.getElementById("testBtn");

  if (on) {
    title.textContent = "9시 알림 켜짐 ✅";
    desc.textContent = "매일 오전 9시에 오늘의 명언 알림을 보내드립니다.";
    enableBtn.textContent = "알림 끄기";
    testBtn.hidden = false;
  } else {
    title.textContent = "9시 알림 켜기";
    desc.textContent =
      "Notification" in window && Notification.permission === "denied"
        ? "브라우저에서 알림이 차단되었습니다. 사이트 설정에서 허용해주세요."
        : "매일 오전 9시에 오늘의 명언 알림을 받아보세요.";
    enableBtn.textContent = "알림 켜기";
    testBtn.hidden = true;
  }
}

function toggleNotifications() {
  const enabled = localStorage.getItem(LS_ENABLED) === "1";
  const granted = "Notification" in window && Notification.permission === "granted";
  if (enabled && granted) {
    localStorage.setItem(LS_ENABLED, "0");
    clearTimeout(scheduleTimer);
    updateNotifyUI();
  } else {
    enableNotifications();
  }
}

/* ---------- Service Worker ---------- */
async function registerSW() {
  const status = document.getElementById("swStatus");
  if (!("serviceWorker" in navigator)) {
    status.textContent = "";
    return;
  }
  try {
    swReg = await navigator.serviceWorker.register("sw.js");
    status.textContent = "오프라인에서도 사용할 수 있어요 · 홈 화면에 추가해보세요";
  } catch (e) {
    console.warn("SW 등록 실패:", e);
  }
}

/* ---------- 자정에 자동으로 명언 갱신 ---------- */
function scheduleMidnightRefresh() {
  const now = new Date();
  const next = new Date();
  next.setHours(24, 0, 5, 0);
  setTimeout(() => {
    renderDate();
    renderQuotes();
    scheduleMidnightRefresh();
  }, next.getTime() - now.getTime());
}

/* ---------- 초기화 ---------- */
function init() {
  renderDate();
  renderQuotes();
  updateNotifyUI();
  scheduleMidnightRefresh();

  document.getElementById("enableBtn").addEventListener("click", toggleNotifications);
  document.getElementById("testBtn").addEventListener("click", showQuoteNotification);

  registerSW().then(() => {
    if (localStorage.getItem(LS_ENABLED) === "1") scheduleDailyNotification();
  });

  // 탭이 다시 보이면 날짜/예약 상태를 재확인 (자정을 넘겼거나 절전에서 복귀한 경우)
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      renderDate();
      renderQuotes();
      updateNotifyUI();
      if (localStorage.getItem(LS_ENABLED) === "1") scheduleDailyNotification();
    }
  });
}

document.addEventListener("DOMContentLoaded", init);
