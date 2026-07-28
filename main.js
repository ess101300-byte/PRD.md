/* =========================================================
   GLOWLAB — shared interactions
   (홈 + 상세페이지 공용 스크립트, 순수 정적/localStorage)
   ========================================================= */
(function () {
  "use strict";

  const won = (n) => n.toLocaleString("ko-KR") + "원";
  const $ = (s, ctx = document) => ctx.querySelector(s);
  const $$ = (s, ctx = document) => Array.from(ctx.querySelectorAll(s));

  /* ---------- Toast ---------- */
  const toastEl = $("#toast");
  let toastTimer;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 1800);
  }

  /* ---------- Cart (localStorage) ---------- */
  const CART_KEY = "glowlab_cart_count";
  function getCart() { return parseInt(localStorage.getItem(CART_KEY) || "0", 10); }
  function setCart(n) {
    localStorage.setItem(CART_KEY, String(n));
    $$("#cartCount").forEach((el) => (el.textContent = n));
  }
  function addToCart(qty = 1) {
    setCart(getCart() + qty);
    toast(`장바구니에 ${qty}개 담았어요 🛒`);
  }
  setCart(getCart());

  $("#cartBtn") && ($("#cartBtn").onclick = () => toast(`장바구니에 ${getCart()}개 담겨 있어요`));

  /* ---------- Mobile drawer ---------- */
  const drawer = $("#drawer");
  const openDrawer = () => drawer && drawer.classList.add("open");
  const closeDrawer = () => drawer && drawer.classList.remove("open");
  $("#menuBtn") && ($("#menuBtn").onclick = openDrawer);
  $("#drawerClose") && ($("#drawerClose").onclick = closeDrawer);
  drawer && $$("[data-close]", drawer).forEach((el) => (el.onclick = closeDrawer));

  /* ---------- Newsletter ---------- */
  const newsForm = $("#newsForm");
  newsForm && newsForm.addEventListener("submit", (e) => {
    e.preventDefault();
    newsForm.reset();
    toast("가입 완료! 15% 쿠폰을 지급했어요 🎁");
  });

  /* =========================================================
     HOME — render product grids
     ========================================================= */
  const PRODUCTS = [
    { rank: 1, cls: "pink", img: "assets/ampoule-pink.svg", name: "PDRN 핑크 콜라겐 나이트 앰플 30ml", off: 34, now: 29000, was: 44000, rate: 4.9, cnt: "8,412", tag: "BEST" },
    { rank: 2, cls: "blue", img: "assets/pad-jar.svg", name: "제로 모공 토너 패드 70매", off: 30, now: 21000, was: 30000, rate: 4.8, cnt: "12,908", tag: "1+1" },
    { rank: 3, cls: "cream", img: "assets/serum-vitc.svg", name: "딥 비타C 브라이트닝 세럼 30ml", off: 25, now: 27000, was: 36000, rate: 4.8, cnt: "6,120", tag: null },
    { rank: 4, cls: "lav", img: "assets/cream-jar.svg", name: "레드 카밍 수분 크림 50ml", off: 20, now: 25600, was: 32000, rate: 4.7, cnt: "4,530", tag: null },
    { rank: null, cls: "mint", img: "assets/toner-cica.svg", name: "시카 진정 저자극 토너 200ml", off: 22, now: 17900, was: 23000, rate: 4.8, cnt: "3,201", tag: "NEW", tagBlue: true },
    { rank: null, cls: "blue", img: "assets/device.svg", name: "부스터 프로 홈 뷰티 디바이스", off: 15, now: 169000, was: 199000, rate: 4.9, cnt: "2,845", tag: "HOT" },
    { rank: null, cls: "cream", img: "assets/sun-tube.svg", name: "데일리 톤업 선에센스 SPF50+ 50ml", off: 18, now: 18800, was: 23000, rate: 4.7, cnt: "5,677", tag: null },
    { rank: null, cls: "pink", img: "assets/mask-pack.svg", name: "핑크 콜라겐 탄력 마스크팩 10매", off: 40, now: 14400, was: 24000, rate: 4.8, cnt: "9,014", tag: "40%", tagBlue: false },
  ];

  function heartSvg() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>';
  }

  function cardHtml(p) {
    const rank = p.rank ? `<span class="rank">${p.rank}</span>` : "";
    const tag = p.tag ? `<span class="tag ${p.tagBlue ? "blue" : ""}">${p.tag}</span>` : "";
    return `
      <article class="card">
        <a href="product.html" class="thumb t-${p.cls}">
          ${rank}${tag}
          <img src="${p.img}" alt="${p.name}" loading="lazy" width="600" height="600" />
        </a>
        <button class="wish" aria-label="위시리스트">${heartSvg()}</button>
        <div class="info">
          <div class="brand-line">GLOWLAB</div>
          <h3><a href="product.html">${p.name}</a></h3>
          <div class="price">
            <span class="off">${p.off}%</span>
            <span class="now">${won(p.now)}</span>
            <span class="was">${won(p.was)}</span>
          </div>
          <div class="rate"><span class="stars">★</span> ${p.rate} · 리뷰 ${p.cnt}</div>
        </div>
      </article>`;
  }

  function renderGrid(sel, items) {
    const el = $(sel);
    if (!el) return;
    el.innerHTML = items.map(cardHtml).join("");
  }

  renderGrid("#bestGrid", PRODUCTS.slice(0, 4));
  renderGrid("#skincareGrid", PRODUCTS.slice(4, 8));
  renderGrid("#relatedGrid", [PRODUCTS[1], PRODUCTS[2], PRODUCTS[3], PRODUCTS[7]]);

  // wishlist toggle (event delegation)
  document.addEventListener("click", (e) => {
    const w = e.target.closest(".wish");
    if (w) {
      e.preventDefault();
      w.classList.toggle("on");
      toast(w.classList.contains("on") ? "위시리스트에 추가했어요 💗" : "위시리스트에서 삭제했어요");
    }
  });

  /* =========================================================
     PRODUCT DETAIL — gallery, qty, options, buy, tabs
     ========================================================= */
  const pdMain = $("#pdMain");
  if (pdMain) {
    // gallery thumbnails
    const pdMainImg = pdMain.querySelector("img");
    $$("#pdThumbs button").forEach((btn) => {
      btn.addEventListener("click", () => {
        $$("#pdThumbs button").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        if (pdMainImg && btn.dataset.img) pdMainImg.src = btn.dataset.img;
      });
    });

    // price + qty + options
    const optSelect = $("#optSelect");
    const qtyEl = $("#qty");
    const lineTotalEl = $("#lineTotal");
    const barPrice = $("#barPrice");
    let qty = 1;

    function unitPrice() {
      const opt = optSelect.options[optSelect.selectedIndex];
      return parseInt(opt.dataset.price, 10);
    }
    function refresh() {
      const total = unitPrice() * qty;
      lineTotalEl.textContent = won(total);
      if (barPrice) barPrice.textContent = won(total);
    }
    $("#plus").onclick = () => { qty = Math.min(qty + 1, 20); qtyEl.textContent = qty; refresh(); };
    $("#minus").onclick = () => { qty = Math.max(qty - 1, 1); qtyEl.textContent = qty; refresh(); };
    optSelect.onchange = refresh;
    refresh();

    // buy / cart actions
    const doAdd = () => addToCart(qty);
    const doBuy = () => toast("주문 페이지로 이동합니다… (데모)");
    $("#addCart").onclick = doAdd;
    $("#buyNow").onclick = doBuy;
    $("#barCart") && ($("#barCart").onclick = doAdd);
    $("#barBuy") && ($("#barBuy").onclick = doBuy);

    // big wishlist
    const wishBig = $("#wishBig");
    wishBig.onclick = () => {
      wishBig.classList.toggle("on");
      toast(wishBig.classList.contains("on") ? "위시리스트에 추가했어요 💗" : "위시리스트에서 삭제했어요");
    };

    $("#moreReviews") && ($("#moreReviews").onclick = () => toast("리뷰를 더 불러왔어요 (데모)"));

    // sticky tab: scrollspy + active state
    const tabLinks = $$("#pdTabs a");
    const sections = tabLinks
      .map((a) => document.querySelector(a.getAttribute("href")))
      .filter(Boolean);

    const spy = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            const id = "#" + en.target.id;
            tabLinks.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === id));
          }
        });
      },
      { rootMargin: "-45% 0px -50% 0px", threshold: 0 }
    );
    sections.forEach((s) => spy.observe(s));
  }
})();
