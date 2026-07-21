/* 오늘의 명언 - 앱 로직
 * - 매일 각 카테고리(성공·일 / 도전·인내 / 삶·철학)에서 1개씩, 총 3개를 결정적으로 선택
 * - 카테고리 필터로 특정 분야의 오늘 명언만 골라볼 수 있음
 * - 오전 9시에 브라우저 알림 (탭/PWA가 실행 중일 때)
 * - Service Worker로 설치형 PWA 및 알림 표시
 */

const NOTIFY_HOUR = 9; // 오전 9시
const LS_ENABLED = "quote_notify_enabled";
const LS_LAST_NOTIFIED = "quote_notify_last_date";

let selectedCat = null; // null = 오늘의 명언(카테고리별 1개), 그 외 = 특정 카테고리 id

/* ---------- 날짜 · 시드 유틸 ---------- */
function dateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}
function daySeed(d = new Date()) {
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}
function strHash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
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

function quotesOf(catId) {
  return QUOTES.filter((q) => q.cat === catId);
}
function catLabel(catId) {
  const c = CATEGORIES.find((x) => x.id === catId);
  return c ? c.label : "";
}

/* 주어진 목록에서 시드로 distinct하게 count개 선택 */
function seededPick(list, count, seed) {
  const rng = mulberry32(seed);
  const pool = list.map((_, i) => i);
  const chosen = [];
  const n = Math.min(count, pool.length);
  for (let i = 0; i < n; i++) {
    const idx = Math.floor(rng() * pool.length);
    chosen.push(pool.splice(idx, 1)[0]);
  }
  return chosen.map((i) => list[i]);
}

/* 오늘의 명언: 각 카테고리에서 1개씩 (표시 순서 = CATEGORIES 순서) */
function pickDailyOnePerCategory(d = new Date()) {
  return CATEGORIES.map((c) => {
    const list = quotesOf(c.id);
    return seededPick(list, 1, daySeed(d) + strHash(c.id))[0];
  }).filter(Boolean);
}

/* 특정 카테고리의 오늘 명언 count개 */
function pickDailyFromCategory(catId, count = 3, d = new Date()) {
  return seededPick(quotesOf(catId), count, daySeed(d) + strHash(catId));
}

/* 현재 선택 상태에 따라 표시할 명언 */
function currentQuotes() {
  return selectedCat ? pickDailyFromCategory(selectedCat, 3) : pickDailyOnePerCategory();
}

/* ---------- 렌더링 ---------- */
function renderDate() {
  const now = new Date();
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  document.getElementById("date").textContent =
    `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일 (${days[now.getDay()]})`;
}

function renderChips() {
  const bar = document.getElementById("chips");
  const items = [{ id: null, label: "오늘의 명언" }, ...CATEGORIES];
  bar.innerHTML = "";
  items.forEach((it) => {
    const btn = document.createElement("button");
    const active = selectedCat === it.id;
    btn.className = "chip" + (active ? " active" : "") + (it.id ? ` cat-${it.id}` : "");
    btn.textContent = it.label;
    btn.setAttribute("aria-pressed", active ? "true" : "false");
    btn.addEventListener("click", () => {
      selectedCat = it.id;
      renderChips();
      renderQuotes();
    });
    bar.appendChild(btn);
  });
}

function renderQuotes() {
  const quotes = currentQuotes();
  const container = document.getElementById("quotes");
  container.innerHTML = "";
  quotes.forEach((q, i) => {
    const card = document.createElement("article");
    card.className = "quote";
    card.innerHTML = `
      <span class="num">${i + 1}</span>
      <span class="badge cat-${q.cat}">${escapeHtml(catLabel(q.cat))}</span>
      <span class="mark">“</span>
      <p>${escapeHtml(q.text)}</p>
      <div class="quote-foot">
        <p class="author">— ${escapeHtml(q.author)}</p>
        <button class="copy-btn" type="button" aria-label="명언 복사">
          <span aria-hidden="true">📋</span> 복사
        </button>
      </div>`;
    const btn = card.querySelector(".copy-btn");
    btn.addEventListener("click", () => copyQuote(q, btn));
    container.appendChild(card);
  });
}

/* 명언을 클립보드에 복사 */
async function copyQuote(q, btn) {
  const text = `“${q.text}” — ${q.author}`;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    btn.classList.add("copied");
    btn.innerHTML = '<span aria-hidden="true">✅</span> 복사됨';
    showToast("명언을 복사했어요");
    setTimeout(() => {
      btn.classList.remove("copied");
      btn.innerHTML = '<span aria-hidden="true">📋</span> 복사';
    }, 1600);
  } catch (e) {
    showToast("복사에 실패했어요");
  }
}

/* 하단 토스트 알림 */
let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
  requestAnimationFrame(() => el.classList.add("show"));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => { el.hidden = true; }, 220);
  }, 1800);
}

/* 히어로 통계 렌더링 (명언 데이터에서 산출) */
function renderHeroStats() {
  const el = document.getElementById("heroStats");
  if (!el) return;
  const authors = new Set(QUOTES.map((q) => q.author)).size;
  const stats = [
    { num: QUOTES.length, lbl: "엄선한 명언" },
    { num: authors, lbl: "지은이" },
    { num: CATEGORIES.length, lbl: "카테고리" },
  ];
  el.innerHTML = stats
    .map((s) => `<li><span class="num">${s.num}</span><span class="lbl">${escapeHtml(s.lbl)}</span></li>`)
    .join("");
}

/* 자정까지 남은 시간 카운트다운 */
let countdownTimer = null;
function renderCountdown() {
  const el = document.getElementById("refreshCountdown");
  if (!el) return;
  const now = new Date();
  const mid = new Date();
  mid.setHours(24, 0, 0, 0);
  let s = Math.max(0, Math.floor((mid.getTime() - now.getTime()) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n) => String(n).padStart(2, "0");
  el.textContent = `다음 명언까지 ${pad(h)}:${pad(m)}:${pad(sec)}`;
}
function startCountdown() {
  clearInterval(countdownTimer);
  renderCountdown();
  countdownTimer = setInterval(renderCountdown, 1000);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

/* ---------- 알림 (항상 카테고리별 1개씩) ---------- */
let swReg = null;

async function showQuoteNotification() {
  const quotes = pickDailyOnePerCategory();
  const body = quotes.map((q) => `[${catLabel(q.cat)}] ${q.text}`).join("\n");
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
    desc.textContent = "매일 오전 9시에 카테고리별 명언 3개를 보내드립니다.";
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
  renderHeroStats();
  renderChips();
  renderQuotes();
  updateNotifyUI();
  startCountdown();
  scheduleMidnightRefresh();

  document.getElementById("enableBtn").addEventListener("click", toggleNotifications);
  document.getElementById("testBtn").addEventListener("click", showQuoteNotification);

  registerSW().then(() => {
    if (localStorage.getItem(LS_ENABLED) === "1") scheduleDailyNotification();
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      renderDate();
      renderQuotes();
      updateNotifyUI();
      startCountdown();
      if (localStorage.getItem(LS_ENABLED) === "1") scheduleDailyNotification();
    }
  });
}

document.addEventListener("DOMContentLoaded", init);
