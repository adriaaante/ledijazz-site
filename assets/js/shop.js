/* =========================================================================
   LEDI JAZZ — интернет-магазин (каталог, корзина, оформление заказа).
   Без онлайн-оплаты: заказ оформляется как гость и отправляется бренду
   (основной канал — Telegram, резерв — e-mail).
   Хранение корзины — localStorage, поэтому у каждого клиента своя корзина.
   ========================================================================= */
(function () {
  "use strict";

  var CFG  = window.LEDIJAZZ || {};
  var SHOP = CFG.shop || {};
  var CUR  = (SHOP.currency || "₽");
  var CART_KEY = "ledijazz_cart";

  /* ----------------------------------------------------------------------
     1–2. КАТАЛОГ: коллекции и товары.
     Редактируются в панели управления (crm.html) и приходят с сервера
     (api/catalog.php). Если сервер недоступен — используется стартовый
     каталог из assets/js/catalog-default.js.
     ---------------------------------------------------------------------- */
  var API = "api/catalog.php";
  var CATALOG_CACHE = "ledijazz_catalog_cache";
  var DEF = window.LEDIJAZZ_CATALOG_DEFAULT || { collections: [], products: [] };
  var CATALOG, COLLECTIONS = [], PRODUCTS = [], COLL_MAP = {}, PROD_MAP = {}, SIZES = [];

  function normProduct(p) {
    var q = {};
    for (var k in p) if (Object.prototype.hasOwnProperty.call(p, k)) q[k] = p[k];
    q.images = (p.images && p.images.length) ? p.images.slice() : (p.img ? [p.img] : []);
    q.img = q.images[0] || "";
    q.sizes = (p.sizes && p.sizes.length) ? p.sizes : [];
    q.colors = p.colors || [];
    q.price = Number(p.price) || 0;
    q.oldPrice = Number(p.oldPrice) > q.price ? Number(p.oldPrice) : 0;
    if (!q.badge && p.coll === "limited") q.badge = "Лимит";
    return q;
  }
  function applyCatalog(c) {
    CATALOG = c;
    COLLECTIONS = (c.collections && c.collections.length) ? c.collections : (DEF.collections || []);
    COLL_MAP = {}; COLLECTIONS.forEach(function (x) { COLL_MAP[x.key] = x; });
    PRODUCTS = (c.products || []).filter(function (p) { return !p.hidden; }).map(normProduct);
    PROD_MAP = {}; PRODUCTS.forEach(function (p) { PROD_MAP[p.id] = p; });
    // размеры для фильтра — в порядке справочника, только те, что есть у товаров
    var used = {}; PRODUCTS.forEach(function (p) { p.sizes.forEach(function (s) { used[s] = 1; }); });
    var order = (c.sizes && c.sizes.length) ? c.sizes : (DEF.sizes || []);
    SIZES = order.filter(function (s) { return used[s]; });
    Object.keys(used).forEach(function (s) { if (SIZES.indexOf(s) === -1) SIZES.push(s); });
  }
  applyCatalog(DEF);

  /** Загружает каталог с сервера; при ошибке остаётся стартовый. */
  function loadCatalog(done) {
    var finished = false;
    function finish(c) { if (finished) return; finished = true; if (c) applyCatalog(c); done(); }
    var timer = setTimeout(function () { finish(cachedCatalog()); }, 6000);
    try {
      fetch(API + "?t=" + Date.now(), { cache: "no-store", credentials: "same-origin" })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function (j) {
          clearTimeout(timer);
          if (j && j.catalog && j.catalog.products) {
            try { localStorage.setItem(CATALOG_CACHE, JSON.stringify(j.catalog)); } catch (e) {}
            finish(j.catalog);
          } else finish(null);
        })
        .catch(function () { clearTimeout(timer); finish(cachedCatalog()); });
    } catch (e) { clearTimeout(timer); finish(cachedCatalog()); }
  }
  function cachedCatalog() {
    try { var c = JSON.parse(localStorage.getItem(CATALOG_CACHE)); return c && c.products ? c : null; }
    catch (e) { return null; }
  }

  /* ----------------------------------------------------------------------
     3. УТИЛИТЫ
     ---------------------------------------------------------------------- */
  function money(n) { return Number(n).toLocaleString("ru-RU") + " " + CUR; }
  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function emblem() { return '<img class="p-emblem" src="assets/img/ledijazz-logo.svg" alt="" />'; }
  function swatchStyle(hex) { return /gradient/.test(hex || "") ? "background:" + hex : "background-color:" + (hex || "#ccc"); }
  function plural(n, a, b, c) { var m = n % 10, h = n % 100; return (m === 1 && h !== 11) ? a : (m >= 2 && m <= 4 && (h < 10 || h >= 20)) ? b : c; }

  /* ----------------------------------------------------------------------
     4. КОРЗИНА (состояние в localStorage)
     Позиция = товар + размер + цвет.
     ---------------------------------------------------------------------- */
  function same(i, id, size, color) { return i.id === id && i.size === size && (i.color || "") === (color || ""); }
  function getCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
    catch (e) { return []; }
  }
  function saveCart(c) {
    try { localStorage.setItem(CART_KEY, JSON.stringify(c)); } catch (e) {}
    updateCartButton();
    renderDrawer();
  }
  function cartItems() { return getCart().filter(function (i) { return PROD_MAP[i.id]; }); }
  function cartCount() { return cartItems().reduce(function (s, i) { return s + i.qty; }, 0); }
  function cartTotal() {
    return cartItems().reduce(function (s, i) { return s + PROD_MAP[i.id].price * i.qty; }, 0);
  }
  function addToCart(id, size, color) {
    var c = getCart();
    var found = c.find(function (i) { return same(i, id, size, color); });
    if (found) found.qty += 1;
    else c.push({ id: id, size: size, color: color || "", qty: 1 });
    saveCart(c);
  }
  function setQty(id, size, color, qty) {
    var c = getCart();
    var i = c.find(function (x) { return same(x, id, size, color); });
    if (!i) return;
    i.qty = qty;
    if (i.qty <= 0) c = c.filter(function (x) { return !same(x, id, size, color); });
    saveCart(c);
  }
  function removeItem(id, size, color) {
    saveCart(getCart().filter(function (x) { return !same(x, id, size, color); }));
  }
  function lineMeta(i) {
    var p = PROD_MAP[i.id];
    return [COLL_MAP[p.coll] ? COLL_MAP[p.coll].title : "", i.size, i.color].filter(Boolean).join(" · ");
  }

  /* ----------------------------------------------------------------------
     5. КНОПКА КОРЗИНЫ В ШАПКЕ (инжектируется на каждую страницу)
     ---------------------------------------------------------------------- */
  var cartBtn;
  function injectCartButton() {
    var cont = document.querySelector(".site-header .container");
    if (!cont || cont.querySelector(".cart-btn")) return;
    cartBtn = el("button", "cart-btn",
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M6 7h12l-1 13H7L6 7Z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg>' +
      '<span class="cart-count">0</span>');
    cartBtn.setAttribute("type", "button");
    cartBtn.setAttribute("aria-label", "Корзина");
    var toggle = cont.querySelector(".nav-toggle");
    if (toggle) cont.insertBefore(cartBtn, toggle);
    else cont.appendChild(cartBtn);
    cartBtn.addEventListener("click", openCart);
  }
  function updateCartButton() {
    if (!cartBtn) return;
    var n = cartCount();
    var span = cartBtn.querySelector(".cart-count");
    span.textContent = n;
    cartBtn.classList.toggle("has-items", n > 0);
    cartBtn.classList.remove("bump");
    if (n > 0) { void cartBtn.offsetWidth; cartBtn.classList.add("bump"); }
  }

  /* ----------------------------------------------------------------------
     6. ВЫДВИЖНАЯ КОРЗИНА (drawer)
     ---------------------------------------------------------------------- */
  var overlay, drawer;
  function injectDrawer() {
    overlay = el("div", "cart-overlay");
    drawer = el("div", "cart-drawer");
    drawer.innerHTML =
      '<div class="cart-head"><h3>Корзина</h3><button class="cart-close" aria-label="Закрыть">×</button></div>' +
      '<div class="cart-items"></div>' +
      '<div class="cart-foot"></div>';
    document.body.appendChild(overlay);
    document.body.appendChild(drawer);
    overlay.addEventListener("click", closeCart);
    drawer.querySelector(".cart-close").addEventListener("click", closeCart);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") { closeCart(); closeQuick(); } });
    renderDrawer();
  }
  function openCart() { if (!overlay) return; closeQuick(); overlay.classList.add("open"); drawer.classList.add("open"); document.body.classList.add("cart-open"); }
  function closeCart() { if (!overlay) return; overlay.classList.remove("open"); drawer.classList.remove("open"); document.body.classList.remove("cart-open"); }

  function renderDrawer() {
    if (!drawer) return;
    var items = cartItems();
    var box = drawer.querySelector(".cart-items");
    var foot = drawer.querySelector(".cart-foot");
    box.innerHTML = "";
    if (!items.length) {
      box.appendChild(el("div", "cart-empty",
        '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 7h12l-1 13H7L6 7Z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg>' +
        '<p>Корзина пуста</p><span>Выберите образ из коллекций — он появится здесь.</span>'));
      foot.innerHTML = '<a class="btn btn-gold" href="shop.html">Перейти в магазин</a>';
      return;
    }
    items.forEach(function (i) {
      var p = PROD_MAP[i.id];
      var line = el("div", "cart-line");
      line.innerHTML =
        '<div class="thumb">' + (p.img ? '' : emblem()) + '</div>' +
        '<div class="ci-info">' +
          '<div class="ci-name">' + esc(p.name) + '</div>' +
          '<div class="ci-meta">' + esc(lineMeta(i)) + '</div>' +
          '<div class="ci-price">' + money(p.price) + '</div>' +
        '</div>' +
        '<div class="ci-right">' +
          '<div class="qty"><button data-act="dec" aria-label="Меньше">−</button><span>' + i.qty + '</span><button data-act="inc" aria-label="Больше">+</button></div>' +
          '<button class="ci-remove">Удалить</button>' +
        '</div>';
      if (p.img) line.querySelector(".thumb").style.backgroundImage = "url('" + encodeURI(p.img) + "')";
      line.querySelector('[data-act="inc"]').addEventListener("click", function () { setQty(i.id, i.size, i.color, i.qty + 1); });
      line.querySelector('[data-act="dec"]').addEventListener("click", function () { setQty(i.id, i.size, i.color, i.qty - 1); });
      line.querySelector(".ci-remove").addEventListener("click", function () { removeItem(i.id, i.size, i.color); });
      box.appendChild(line);
    });
    foot.innerHTML =
      '<div class="row"><span class="lbl">Итого</span><span class="sum">' + money(cartTotal()) + '</span></div>' +
      '<a class="btn btn-gold" href="checkout.html">Оформить заказ</a>' +
      '<a class="cart-cont" href="shop.html">Продолжить покупки</a>';
  }

  /* ----------------------------------------------------------------------
     7. TOAST «добавлено в корзину»
     ---------------------------------------------------------------------- */
  var toast, toastTimer;
  function showToast(text) {
    if (!toast) {
      toast = el("div", "shop-toast");
      document.body.appendChild(toast);
    }
    toast.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>' + esc(text);
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove("show"); }, 2600);
  }

  /* ----------------------------------------------------------------------
     8. КАТАЛОГ: фильтры + сетка товаров (shop.html)
     ---------------------------------------------------------------------- */
  function initShop() {
    var grid = document.getElementById("shop-grid");
    if (!grid) return;

    var params = new URLSearchParams(location.search);
    var state = {
      coll: params.get("collection") || "all",
      size: "all",
      sort: "default"
    };
    if (state.coll !== "all" && !COLL_MAP[state.coll]) state.coll = "all";

    // --- toolbar ---
    var toolbar = document.getElementById("shop-toolbar");
    toolbar.innerHTML = "";
    var chipWrap = el("div", "filter-scroll");
    // показываем только коллекции, в которых есть товары
    var withItems = {}; PRODUCTS.forEach(function (p) { withItems[p.coll] = 1; });
    var chips = [{ key: "all", title: "Все коллекции" }].concat(
      COLLECTIONS.filter(function (c) { return withItems[c.key]; }).map(function (c) { return { key: c.key, title: c.title }; }));
    chips.forEach(function (c) {
      var b = el("button", "filter-chip" + (c.key === state.coll ? " active" : ""), esc(c.title));
      b.setAttribute("type", "button");
      b.addEventListener("click", function () {
        state.coll = c.key;
        chipWrap.querySelectorAll(".filter-chip").forEach(function (x) { x.classList.remove("active"); });
        b.classList.add("active");
        var u = new URL(location.href);
        if (c.key === "all") u.searchParams.delete("collection");
        else u.searchParams.set("collection", c.key);
        history.replaceState(null, "", u);
        render();
      });
      chipWrap.appendChild(b);
    });
    toolbar.appendChild(chipWrap);

    var sub = el("div", "shop-subbar");
    sub.innerHTML =
      '<span class="field-inline">Размер:&nbsp;' +
        '<select id="f-size"><option value="all">Любой</option>' +
        SIZES.map(function (s) { return '<option value="' + esc(s) + '">' + esc(s) + '</option>'; }).join("") +
        '</select></span>' +
      '<span class="field-inline">Сортировка:&nbsp;' +
        '<select id="f-sort"><option value="default">По умолчанию</option><option value="price-asc">Сначала дешевле</option><option value="price-desc">Сначала дороже</option></select></span>' +
      '<span class="count" id="shop-count"></span>';
    toolbar.appendChild(sub);
    sub.querySelector("#f-size").addEventListener("change", function () { state.size = this.value; render(); });
    sub.querySelector("#f-sort").addEventListener("change", function () { state.sort = this.value; render(); });

    function render() {
      var list = PRODUCTS.slice();
      if (state.coll !== "all") list = list.filter(function (p) { return p.coll === state.coll; });
      if (state.size !== "all") list = list.filter(function (p) { return p.sizes.indexOf(state.size) !== -1; });
      if (state.sort === "price-asc") list.sort(function (a, b) { return a.price - b.price; });
      if (state.sort === "price-desc") list.sort(function (a, b) { return b.price - a.price; });

      grid.innerHTML = "";
      grid.removeAttribute("aria-busy");
      var cnt = document.getElementById("shop-count");
      cnt.textContent = list.length + " " + plural(list.length, "модель", "модели", "моделей");

      if (!list.length) {
        grid.classList.remove("product-grid");
        grid.appendChild(el("div", "shop-empty", "<p>Ничего не найдено</p><span>Попробуйте изменить фильтры.</span>"));
        return;
      }
      grid.classList.add("product-grid");
      list.forEach(function (p) { grid.appendChild(productCard(p)); });
    }
    render();

    var deep = params.get("product");
    if (deep && PROD_MAP[deep]) openQuick(PROD_MAP[deep]);
  }

  function skeleton() {
    var grid = document.getElementById("shop-grid");
    if (!grid) return;
    grid.setAttribute("aria-busy", "true");
    var h = "";
    for (var i = 0; i < 6; i++) h += '<div class="product-card p-skel"><div class="p-media"></div><div class="p-body"><span></span><span></span><span></span></div></div>';
    grid.innerHTML = h;
  }

  function priceHtml(p) {
    return '<p class="p-price">' + money(p.price) +
      (p.oldPrice ? ' <s class="p-old">' + money(p.oldPrice) + '</s><span class="p-off">−' + Math.round((1 - p.price / p.oldPrice) * 100) + '%</span>' : '') +
      '</p>';
  }
  function dotsHtml(p) {
    if (!p.colors.length) return "";
    return '<div class="p-dots" aria-label="Цвета">' + p.colors.slice(0, 6).map(function (c) {
      return '<i title="' + esc(c.name) + '" style="' + esc(swatchStyle(c.hex)) + '"></i>';
    }).join("") + (p.colors.length > 6 ? '<em>+' + (p.colors.length - 6) + '</em>' : '') + '</div>';
  }

  function productCard(p) {
    var c = COLL_MAP[p.coll] || {};
    var card = el("div", "product-card" + (p.soldOut ? " sold-out" : ""));
    var opts = p.sizes.map(function (s) { return '<option value="' + esc(s) + '">' + esc(s) + '</option>'; }).join("");
    var needChoice = p.colors.length > 1 || !p.sizes.length;
    card.innerHTML =
      '<button class="p-media" type="button" aria-label="Подробнее: ' + esc(p.name) + '">' +
        (p.badge ? '<span class="p-badge">' + esc(p.badge) + '</span>' : '') +
        (p.soldOut ? '<span class="p-badge p-badge-out">Нет в наличии</span>' : '') +
        (p.img ? '<img class="p-photo" src="' + esc(p.img) + '" alt="' + esc(p.name) + '" loading="lazy" />' : emblem()) +
        (p.images.length > 1 ? '<img class="p-photo p-photo-2" src="' + esc(p.images[1]) + '" alt="" loading="lazy" />' : '') +
      '</button>' +
      '<div class="p-body">' +
        '<span class="p-ln">' + esc(c.ln || c.title || "") + '</span>' +
        '<h3 class="p-name"><a href="shop.html?product=' + encodeURIComponent(p.id) + '">' + esc(p.name) + '</a></h3>' +
        (p.desc ? '<p class="p-desc">' + esc(p.desc) + '</p>' : '') +
        (p.fabric ? '<p class="p-fabric">Ткань: ' + esc(p.fabric) + '</p>' : '') +
        dotsHtml(p) +
        priceHtml(p) +
        '<div class="p-buy">' +
          (p.soldOut ? '<button class="btn btn-ghost p-more" type="button">Подробнее</button>' :
            (needChoice ? '<button class="btn btn-gold p-more" type="button">Выбрать цвет и размер</button>' :
            '<select class="p-size" aria-label="Размер">' + opts + '</select>' +
            '<button class="btn btn-gold p-add" type="button" aria-label="В корзину">' +
              '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>' +
            '</button>')) +
        '</div>' +
      '</div>';
    function more(e) { if (e) e.preventDefault(); openQuick(p); }
    card.querySelector(".p-media").addEventListener("click", more);
    card.querySelector(".p-name a").addEventListener("click", more);
    var m = card.querySelector(".p-more"); if (m) m.addEventListener("click", more);
    var add = card.querySelector(".p-add");
    if (add) add.addEventListener("click", function () {
      var size = card.querySelector(".p-size").value;
      addToCart(p.id, size, p.colors[0] ? p.colors[0].name : "");
      showToast("«" + p.name + "» добавлено в корзину");
    });
    return card;
  }

  /* ----------------------------------------------------------------------
     8.1 КАРТОЧКА ТОВАРА (быстрый просмотр: галерея, цвет, размер)
     ---------------------------------------------------------------------- */
  var qv, qvOverlay;
  function closeQuick() {
    if (!qv || !qv.classList.contains("open")) return;
    qv.classList.remove("open"); qvOverlay.classList.remove("open");
    document.body.classList.remove("cart-open");
    var u = new URL(location.href);
    if (u.searchParams.has("product")) { u.searchParams.delete("product"); history.replaceState(null, "", u); }
  }
  function openQuick(p) {
    if (!qv) {
      qvOverlay = el("div", "cart-overlay qv-overlay");
      qv = el("div", "qv");
      qv.setAttribute("role", "dialog"); qv.setAttribute("aria-modal", "true");
      document.body.appendChild(qvOverlay); document.body.appendChild(qv);
      qvOverlay.addEventListener("click", closeQuick);
    }
    var c = COLL_MAP[p.coll] || {};
    var sel = { size: p.sizes.length === 1 ? p.sizes[0] : "", color: p.colors.length === 1 ? p.colors[0].name : "" };
    var imgs = p.images.length ? p.images : [""];
    qv.innerHTML =
      '<button class="qv-close" type="button" aria-label="Закрыть">×</button>' +
      '<div class="qv-gal">' +
        '<div class="qv-track">' + imgs.map(function (src, i) {
          return '<div class="qv-slide">' + (src ? '<img src="' + esc(src) + '" alt="' + esc(p.name) + (i ? ' — фото ' + (i + 1) : '') + '"' + (i ? ' loading="lazy"' : '') + ' />' : emblem()) + '</div>';
        }).join("") + '</div>' +
        (imgs.length > 1 ? '<div class="qv-thumbs">' + imgs.map(function (src, i) {
          return '<button type="button" data-i="' + i + '" class="' + (i ? '' : 'on') + '" style="background-image:url(\'' + encodeURI(src) + '\')" aria-label="Фото ' + (i + 1) + '"></button>';
        }).join("") + '</div>' : '') +
        (p.badge ? '<span class="p-badge">' + esc(p.badge) + '</span>' : '') +
      '</div>' +
      '<div class="qv-info">' +
        '<span class="p-ln">' + esc([c.ln || c.title, p.type].filter(Boolean).join(" · ")) + '</span>' +
        '<h2 class="qv-name">' + esc(p.name) + '</h2>' +
        priceHtml(p) +
        (p.colors.length ? '<div class="qv-opt"><div class="qv-lbl">Цвет: <b data-v="color">' + esc(sel.color || "выберите") + '</b></div><div class="qv-sw">' +
          p.colors.map(function (col) { return '<button type="button" data-color="' + esc(col.name) + '" title="' + esc(col.name) + '" class="' + (sel.color === col.name ? 'on' : '') + '"><i style="' + esc(swatchStyle(col.hex)) + '"></i></button>'; }).join("") +
        '</div></div>' : '') +
        (p.sizes.length ? '<div class="qv-opt"><div class="qv-lbl">Размер: <b data-v="size">' + esc(sel.size || "выберите") + '</b></div><div class="qv-sz">' +
          p.sizes.map(function (s) { return '<button type="button" data-size="' + esc(s) + '" class="' + (sel.size === s ? 'on' : '') + '">' + esc(s) + '</button>'; }).join("") +
        '</div></div>' : '') +
        '<div class="qv-msg" role="status"></div>' +
        (p.soldOut ? '<button class="btn btn-ghost qv-add" type="button" disabled>Нет в наличии</button>' :
          '<button class="btn btn-gold qv-add" type="button">Добавить в корзину</button>') +
        (p.desc ? '<p class="qv-desc">' + esc(p.desc).replace(/\n/g, "<br>") + '</p>' : '') +
        '<dl class="qv-spec">' +
          (p.fabric ? '<dt>Ткань</dt><dd>' + esc(p.fabric) + '</dd>' : '') +
          (p.care ? '<dt>Уход</dt><dd>' + esc(p.care).replace(/\n/g, "<br>") + '</dd>' : '') +
          (p.sku ? '<dt>Артикул</dt><dd>' + esc(p.sku) + '</dd>' : '') +
        '</dl>' +
      '</div>';

    var track = qv.querySelector(".qv-track");
    var thumbs = qv.querySelectorAll(".qv-thumbs button");
    thumbs.forEach(function (b) {
      b.addEventListener("click", function () { track.scrollTo({ left: track.clientWidth * +b.dataset.i, behavior: "smooth" }); });
    });
    track.addEventListener("scroll", function () {
      var i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
      thumbs.forEach(function (b, k) { b.classList.toggle("on", k === i); });
    }, { passive: true });
    qv.querySelector(".qv-close").addEventListener("click", closeQuick);
    var msg = qv.querySelector(".qv-msg");
    qv.querySelectorAll("[data-color]").forEach(function (b) {
      b.addEventListener("click", function () {
        sel.color = b.dataset.color; msg.textContent = "";
        qv.querySelectorAll("[data-color]").forEach(function (x) { x.classList.toggle("on", x === b); });
        qv.querySelector('[data-v="color"]').textContent = sel.color;
      });
    });
    qv.querySelectorAll("[data-size]").forEach(function (b) {
      b.addEventListener("click", function () {
        sel.size = b.dataset.size; msg.textContent = "";
        qv.querySelectorAll("[data-size]").forEach(function (x) { x.classList.toggle("on", x === b); });
        qv.querySelector('[data-v="size"]').textContent = sel.size;
      });
    });
    var add = qv.querySelector(".qv-add");
    if (add && !p.soldOut) add.addEventListener("click", function () {
      if (p.colors.length && !sel.color) { msg.textContent = "Выберите цвет"; return; }
      if (p.sizes.length && !sel.size) { msg.textContent = "Выберите размер"; return; }
      addToCart(p.id, sel.size, sel.color);
      closeQuick();
      showToast("«" + p.name + "» добавлено в корзину");
    });

    var u = new URL(location.href);
    if (/shop\.html$|\/$/.test(u.pathname) || document.getElementById("shop-grid")) { u.searchParams.set("product", p.id); history.replaceState(null, "", u); }
    qvOverlay.classList.add("open"); qv.classList.add("open");
    document.body.classList.add("cart-open");
    qv.scrollTop = 0;
  }

  /* ----------------------------------------------------------------------
     9. ОФОРМЛЕНИЕ ЗАКАЗА (checkout.html)
     ---------------------------------------------------------------------- */
  function initCheckout() {
    var form = document.getElementById("checkout-form");
    var summary = document.getElementById("checkout-summary");
    if (!summary) return;

    var items = cartItems();
    var emptyBox = document.getElementById("checkout-empty");
    var layout = document.getElementById("checkout-layout");

    if (!items.length) {
      if (layout) layout.style.display = "none";
      if (emptyBox) emptyBox.style.display = "block";
      return;
    }

    // --- summary ---
    var sumHtml = '<h3>Ваш заказ</h3>';
    items.forEach(function (i) {
      var p = PROD_MAP[i.id]; if (!p) return;
      sumHtml +=
        '<div class="co-line"><div class="thumb"' + (p.img ? ' style="background-image:url(\'' + encodeURI(p.img) + '\')"' : '') + '>' + (p.img ? '' : emblem()) + '</div>' +
        '<div><div class="nm">' + esc(p.name) + '</div><div class="mt">' + esc([i.size, i.color].filter(Boolean).join(" · ")) + ' · ' + i.qty + ' шт.</div></div>' +
        '<div class="pr">' + money(p.price * i.qty) + '</div></div>';
    });
    sumHtml += '<div class="co-total"><span class="lbl">Итого</span><span class="sum">' + money(cartTotal()) + '</span></div>';
    sumHtml += '<p class="co-note">Оплата онлайн не требуется. После оформления мы свяжемся с вами для подтверждения заказа, стоимости доставки и способа оплаты.</p>';
    summary.innerHTML = sumHtml;

    // --- fulfillment config ---
    var ful = (SHOP.fulfillment || {});
    var pickup = ful.pickup || {};
    var delivery = ful.delivery || {};

    var pickupInfo = document.getElementById("pickup-info");
    if (pickupInfo) {
      var addrs = (pickup.addresses && pickup.addresses.length) ? pickup.addresses : ["Адрес самовывоза уточняется"];
      pickupInfo.innerHTML = '<div class="info-box"><strong>Самовывоз</strong><br>' + addrs.join("<br>") + '</div>';
    }
    var delNote = document.getElementById("delivery-note");
    if (delNote && delivery.note) delNote.innerHTML = '<div class="info-box">' + delivery.note + '</div>';

    // toggle pickup/delivery
    var fields = document.getElementById("delivery-fields");
    function syncFulfillment() {
      var val = (form.querySelector('input[name="fulfillment"]:checked') || {}).value;
      var isDelivery = val === "delivery";
      if (fields) fields.classList.toggle("show", isDelivery);
      if (pickupInfo) pickupInfo.classList.toggle("show", val === "pickup");
      var addr = document.getElementById("f-address");
      if (addr) addr.required = isDelivery;
    }
    form.querySelectorAll('input[name="fulfillment"]').forEach(function (r) {
      r.addEventListener("change", syncFulfillment);
    });
    syncFulfillment();

    // --- submit ---
    var msg = form.querySelector(".form-msg");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      msg.className = "form-msg";

      var name = form.querySelector("#f-name");
      var phone = form.querySelector("#f-phone");
      var consent = form.querySelector("#consent");
      var method = (form.querySelector('input[name="fulfillment"]:checked') || {}).value;

      if (!name.value.trim() || !phone.value.trim()) {
        msg.classList.add("err"); msg.textContent = "Укажите имя и телефон для связи."; scrollTo(msg); return;
      }
      if (method === "delivery") {
        var addr = form.querySelector("#f-address");
        if (!addr.value.trim()) { msg.classList.add("err"); msg.textContent = "Укажите адрес доставки."; scrollTo(msg); return; }
      }
      if (consent && !consent.checked) {
        msg.classList.add("err"); msg.textContent = "Необходимо согласие на обработку персональных данных."; scrollTo(msg); return;
      }

      var order = buildOrder(form, method);
      sendOrder(order);
    });
  }

  function scrollTo(node) { try { node.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (e) {} }

  function buildOrder(form, method) {
    var get = function (id) { var n = form.querySelector(id); return n ? n.value.trim() : ""; };
    var num = "LJ-" + new Date().toISOString().slice(2, 10).replace(/-/g, "") + "-" + Math.floor(1000 + Math.random() * 9000);
    var items = cartItems();
    var lines = items.map(function (i) {
      var p = PROD_MAP[i.id]; if (!p) return "";
      var opt = [i.size, i.color].filter(Boolean).join(", ");
      return "• " + p.name + (p.sku ? " [" + p.sku + "]" : "") + (opt ? " (" + opt + ")" : "") + " × " + i.qty + " — " + money(p.price * i.qty);
    }).filter(Boolean);

    var methodTxt = method === "delivery" ? "Доставка" : "Самовывоз";
    var text =
      "🛍 Новый заказ LEDI JAZZ № " + num + "\n" +
      "—————————————\n" +
      lines.join("\n") + "\n" +
      "—————————————\n" +
      "Итого: " + money(cartTotal()) + "\n\n" +
      "Получатель: " + get("#f-name") + "\n" +
      "Телефон: " + get("#f-phone") + "\n" +
      (get("#f-email") ? "E-mail: " + get("#f-email") + "\n" : "") +
      "Способ получения: " + methodTxt + "\n";

    if (method === "delivery") {
      text += "Адрес доставки: " + get("#f-address") + "\n";
      if (get("#f-city")) text = text.replace("Адрес доставки: ", "Город: " + get("#f-city") + "\nАдрес доставки: ");
    }
    if (get("#f-note")) text += "Комментарий: " + get("#f-note") + "\n";

    return { num: num, text: text };
  }

  function sendOrder(order) {
    // сохраним на всякий случай
    try { localStorage.setItem("ledijazz_last_order", JSON.stringify(order)); } catch (e) {}

    var ord = (SHOP.order || {});
    var tg = ord.telegram || (CFG.links && CFG.links.telegram) || "";
    var hasTg = tg && tg !== "#";
    var email = ord.notifyEmail || (CFG.contacts && CFG.contacts.email) || "";
    var wa = ord.whatsapp || "";

    var siteUrl = location.origin + location.pathname.replace(/checkout\.html$/, "");
    var shareUrl = "https://t.me/share/url?url=" + encodeURIComponent(siteUrl) + "&text=" + encodeURIComponent(order.text);
    var mailtoUrl = "mailto:" + email + "?subject=" + encodeURIComponent("Заказ LEDI JAZZ № " + order.num) + "&body=" + encodeURIComponent(order.text);
    var waUrl = wa ? ("https://wa.me/" + wa.replace(/\D/g, "") + "?text=" + encodeURIComponent(order.text)) : "";

    // копируем текст заказа в буфер обмена (молча игнорируем отказ браузера)
    try {
      if (navigator.clipboard && navigator.clipboard.writeText)
        navigator.clipboard.writeText(order.text).catch(function () {});
    } catch (e) {}

    // очищаем корзину
    saveCart([]);

    // показываем экран успеха
    var layout = document.getElementById("checkout-layout");
    var done = document.getElementById("order-success");
    if (layout) layout.style.display = "none";

    var actions = '<a class="btn btn-gold" target="_blank" rel="noopener" href="' + shareUrl + '">Отправить заказ в Telegram</a>';
    if (hasTg) actions += '<a class="btn btn-ghost" target="_blank" rel="noopener" href="' + tg + '">Открыть наш Telegram</a>';
    if (waUrl) actions += '<a class="btn btn-ghost" target="_blank" rel="noopener" href="' + waUrl + '">WhatsApp</a>';
    if (email) actions += '<a class="btn btn-ghost" href="' + mailtoUrl + '">Отправить на e-mail</a>';

    done.innerHTML =
      '<div class="order-done">' +
        '<div class="seal"><svg viewBox="0 0 24 24" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></div>' +
        '<span class="kicker center" style="justify-content:center">Заказ № ' + order.num + '</span>' +
        '<h2 class="title">Заказ сформирован</h2>' +
        '<p class="lead" style="margin-inline:auto">Остался один шаг — отправьте заказ нам. Нажмите кнопку ниже: откроется Telegram с готовым текстом, выберите наш чат и отправьте. Текст заказа уже скопирован в буфер обмена.</p>' +
        '<div class="order-actions">' + actions + '</div>' +
        '<div class="order-textbox"><pre id="order-text"></pre>' +
          '<button class="btn btn-ghost" type="button" id="copy-order" style="margin-top:14px">Скопировать текст заказа</button>' +
        '</div>' +
        '<p style="margin-top:24px"><a href="shop.html" style="color:var(--bronze);text-decoration:underline">← Вернуться в магазин</a></p>' +
      '</div>';
    done.style.display = "block";
    document.getElementById("order-text").textContent = order.text;
    var copyBtn = document.getElementById("copy-order");
    if (copyBtn) copyBtn.addEventListener("click", function () {
      function legacyCopy() {
        var r = document.createRange(); r.selectNode(document.getElementById("order-text"));
        var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
        try { document.execCommand("copy"); copyBtn.textContent = "Скопировано ✓"; } catch (err) {}
        sel.removeAllRanges();
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(order.text)
          .then(function () { copyBtn.textContent = "Скопировано ✓"; })
          .catch(legacyCopy);
      } else { legacyCopy(); }
    });

    // автоматически открываем Telegram (основной канал)
    setTimeout(function () { try { window.open(shareUrl, "_blank", "noopener"); } catch (e) {} }, 350);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ----------------------------------------------------------------------
     10. ИНИЦИАЛИЗАЦИЯ
     ---------------------------------------------------------------------- */
  function init() {
    injectCartButton();
    skeleton();
    loadCatalog(function () {
      injectDrawer();
      updateCartButton();
      initShop();
      initCheckout();
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  // экспорт для возможного повторного использования
  window.LEDIJAZZ_SHOP = {
    get COLLECTIONS() { return COLLECTIONS; },
    get PRODUCTS() { return PRODUCTS; },
    addToCart: addToCart, openCart: openCart
  };
})();
