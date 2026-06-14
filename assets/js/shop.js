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
     1. КОЛЛЕКЦИИ (разделы)
     ---------------------------------------------------------------------- */
  var COLLECTIONS = [
    { key: "home",    ln: "L · Home",          title: "Дом" },
    { key: "casual",  ln: "L · Mu",            title: "Повседневность" },
    { key: "riviera", ln: "L · Riviera",       title: "Ривьера" },
    { key: "travel",  ln: "L · Travel",        title: "Путешествия" },
    { key: "evening", ln: "L · Evening Soft",  title: "Мягкий вечер" },
    { key: "noir",    ln: "L · Noir / Aura",   title: "Нуар" },
    { key: "silk",    ln: "L · Silk / Mood",   title: "Шёлк" },
    { key: "linen",   ln: "L · Linen",         title: "Лён" },
    { key: "limited", ln: "L · Limited",       title: "Лимитированное" }
  ];
  var COLL_MAP = {};
  COLLECTIONS.forEach(function (c) { COLL_MAP[c.key] = c; });

  var S1 = "Size 1 · 50–56";
  var S2 = "Size 2 · 58–64";
  var BOTH = [S1, S2];

  /* ----------------------------------------------------------------------
     2. ТОВАРЫ
     Чтобы добавить фото товара — укажите поле img: "assets/img/файл.jpg".
     ---------------------------------------------------------------------- */
  var PRODUCTS = [
    // — Дом —
    { id: "home-utro",   coll: "home",    name: "Платье-флюид «Утро»",      price: 7900,  fabric: "Вискоза, модал", sizes: BOTH, desc: "Мягкое домашнее платье свободного силуэта для неспешных утренних часов." },
    { id: "home-terrasa",coll: "home",    name: "Комплект «Терраса»",       price: 8900,  fabric: "Трикотаж",       sizes: BOTH, desc: "Уютный комплект из туники и брюк для дома и тёплого вечера на террасе." },
    { id: "home-noteb",  coll: "home",    name: "Халат-кимоно «Ноктюрн»",   price: 9500,  fabric: "Вискоза",        sizes: BOTH, desc: "Струящийся халат-кимоно с поясом — обволакивающая мягкость и комфорт." },

    // — Повседневность —
    { id: "casual-ritm", coll: "casual",  name: "Платье «Ритм»",            price: 8400,  fabric: "Трикотаж, вискоза", sizes: BOTH, desc: "Базовое платье-флюид на каждый день: универсальный силуэт, ДНК бренда." },
    { id: "casual-blues",coll: "casual",  name: "Туника «Блюз»",            price: 6900,  fabric: "Модал",          sizes: BOTH, desc: "Удлинённая туника свободного кроя — основа для множества образов." },
    { id: "casual-swing",coll: "casual",  name: "Костюм «Свинг»",           price: 11900, fabric: "Трикотаж",       sizes: BOTH, desc: "Мягкий костюм: жакет-кардиган и брюки с эластичным поясом." },

    // — Ривьера —
    { id: "riv-bereg",   coll: "riviera", name: "Платье «Берег»",           price: 8900,  fabric: "Вискоза",        sizes: BOTH, desc: "Лёгкое платье в пол для прогулок у моря и тёплых городов." },
    { id: "riv-marina",  coll: "riviera", name: "Сарафан «Марина»",         price: 7900,  fabric: "Лён, вискоза",   sizes: BOTH, desc: "Дышащий сарафан с открытыми плечами — лёгкость южного лета." },
    { id: "riv-laguna",  coll: "riviera", name: "Платье-рубашка «Лагуна»",  price: 9400,  fabric: "Шифон",          sizes: BOTH, desc: "Воздушное платье-рубашка для жарких дней и вечернего бриза." },

    // — Путешествия —
    { id: "trv-doroga",  coll: "travel",  name: "Платье «Дорога»",          price: 8600,  fabric: "Трикотаж",       sizes: BOTH, desc: "Немнущееся платье для поездок: комфорт в пути без потери элегантности." },
    { id: "trv-vokzal",  coll: "travel",  name: "Комплект «Вокзал»",        price: 10900, fabric: "Модал, трикотаж",sizes: BOTH, desc: "Дорожный комплект: лёгкий кардиган, топ и брюки в одной палитре." },
    { id: "trv-gorod",   coll: "travel",  name: "Платье «Город»",           price: 8200,  fabric: "Вискоза",        sizes: BOTH, desc: "Универсальное платье для прогулок по новым городам." },

    // — Мягкий вечер —
    { id: "eve-vecher",  coll: "evening", name: "Платье «Вечер»",           price: 9900,  fabric: "Вискоза, шёлк",  sizes: BOTH, desc: "Спокойная вечерняя элегантность для ужина и встреч." },
    { id: "eve-akkord",  coll: "evening", name: "Платье «Аккорд»",          price: 10900, fabric: "Трикотаж люкс",  sizes: BOTH, desc: "Драпированный силуэт, который красиво струится при движении." },
    { id: "eve-saksofon",coll: "evening", name: "Платье «Саксофон»",        price: 9600,  fabric: "Шифон",          sizes: BOTH, desc: "Лёгкое многослойное платье для тёплого вечернего выхода." },

    // — Нуар —
    { id: "noir-aura",   coll: "noir",    name: "Платье «Аура»",            price: 12900, fabric: "Шёлк",           sizes: BOTH, desc: "Глубокий тон и благородная ткань — для особого случая." },
    { id: "noir-noch",   coll: "noir",    name: "Платье «Полночь»",         price: 13900, fabric: "Бархат, вискоза",sizes: BOTH, desc: "Вечернее платье насыщенного оттенка с мягкой драпировкой." },
    { id: "noir-ten",    coll: "noir",    name: "Костюм «Тень»",            price: 14900, fabric: "Шёлк, трикотаж", sizes: BOTH, desc: "Элегантный вечерний костюм глубоких тонов." },

    // — Шёлк —
    { id: "silk-mood",   coll: "silk",    name: "Платье «Mood»",            price: 13900, fabric: "Натуральный шёлк",sizes: BOTH, desc: "Премиальный шёлк для ужина, шоу и торжеств." },
    { id: "silk-shik",   coll: "silk",    name: "Платье «Шик»",             price: 15900, fabric: "Натуральный шёлк",sizes: BOTH, desc: "Роскошное шёлковое платье с тонким блеском." },
    { id: "silk-melodia",coll: "silk",    name: "Блуза «Мелодия»",          price: 8900,  fabric: "Шёлк",           sizes: BOTH, desc: "Шёлковая блуза свободного кроя — основа вечернего образа." },

    // — Лён —
    { id: "lin-leto",    coll: "linen",   name: "Платье «Лето»",            price: 8400,  fabric: "Натуральный лён", sizes: BOTH, desc: "Дышащее льняное платье для жарких дней — натуральный комфорт." },
    { id: "lin-veter",   coll: "linen",   name: "Костюм «Ветер»",           price: 10900, fabric: "Лён, вискоза",   sizes: BOTH, desc: "Льняной комплект: рубашка и широкие брюки." },
    { id: "lin-sad",     coll: "linen",   name: "Сарафан «Сад»",            price: 7600,  fabric: "Натуральный лён", sizes: BOTH, desc: "Лёгкий льняной сарафан для города и отдыха." },

    // — Лимитированное —
    { id: "lim-solo",    coll: "limited", name: "Платье «Соло» (лимит)",    price: 16900, fabric: "Шёлк, кружево",  sizes: BOTH, desc: "Капсульный выпуск: ограниченный тираж, особый крой." },
    { id: "lim-encore",  coll: "limited", name: "Платье «Encore» (лимит)",  price: 17900, fabric: "Премиум-шёлк",   sizes: BOTH, desc: "Премиальная лимитированная линия для самых особых случаев." }
  ];
  var PROD_MAP = {};
  PRODUCTS.forEach(function (p) { PROD_MAP[p.id] = p; });

  /* ----------------------------------------------------------------------
     3. УТИЛИТЫ
     ---------------------------------------------------------------------- */
  function money(n) { return Number(n).toLocaleString("ru-RU") + " " + CUR; }
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function emblem() { return '<img class="p-emblem" src="assets/img/ledijazz-logo.svg" alt="" />'; }

  /* ----------------------------------------------------------------------
     4. КОРЗИНА (состояние в localStorage)
     ---------------------------------------------------------------------- */
  function getCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
    catch (e) { return []; }
  }
  function saveCart(c) {
    localStorage.setItem(CART_KEY, JSON.stringify(c));
    updateCartButton();
    renderDrawer();
  }
  function cartCount() { return getCart().reduce(function (s, i) { return s + i.qty; }, 0); }
  function cartTotal() {
    return getCart().reduce(function (s, i) {
      var p = PROD_MAP[i.id]; return s + (p ? p.price * i.qty : 0);
    }, 0);
  }
  function addToCart(id, size) {
    var c = getCart();
    var found = c.find(function (i) { return i.id === id && i.size === size; });
    if (found) found.qty += 1;
    else c.push({ id: id, size: size, qty: 1 });
    saveCart(c);
  }
  function setQty(id, size, qty) {
    var c = getCart();
    var i = c.find(function (x) { return x.id === id && x.size === size; });
    if (!i) return;
    i.qty = qty;
    if (i.qty <= 0) c = c.filter(function (x) { return !(x.id === id && x.size === size); });
    saveCart(c);
  }
  function removeItem(id, size) {
    saveCart(getCart().filter(function (x) { return !(x.id === id && x.size === size); }));
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
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeCart(); });
    renderDrawer();
  }
  function openCart() { overlay.classList.add("open"); drawer.classList.add("open"); document.body.classList.add("cart-open"); }
  function closeCart() { overlay.classList.remove("open"); drawer.classList.remove("open"); document.body.classList.remove("cart-open"); }

  function renderDrawer() {
    if (!drawer) return;
    var items = getCart();
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
      var p = PROD_MAP[i.id]; if (!p) return;
      var line = el("div", "cart-line");
      line.innerHTML =
        '<div class="thumb">' + (p.img ? '' : emblem()) + '</div>' +
        '<div class="ci-info">' +
          '<div class="ci-name">' + p.name + '</div>' +
          '<div class="ci-meta">' + (COLL_MAP[p.coll] ? COLL_MAP[p.coll].title : "") + ' · ' + i.size + '</div>' +
          '<div class="ci-price">' + money(p.price) + '</div>' +
        '</div>' +
        '<div class="ci-right">' +
          '<div class="qty"><button data-act="dec" aria-label="Меньше">−</button><span>' + i.qty + '</span><button data-act="inc" aria-label="Больше">+</button></div>' +
          '<button class="ci-remove">Удалить</button>' +
        '</div>';
      if (p.img) line.querySelector(".thumb").style.backgroundImage = "url('" + p.img + "')";
      line.querySelector('[data-act="inc"]').addEventListener("click", function () { setQty(i.id, i.size, i.qty + 1); });
      line.querySelector('[data-act="dec"]').addEventListener("click", function () { setQty(i.id, i.size, i.qty - 1); });
      line.querySelector(".ci-remove").addEventListener("click", function () { removeItem(i.id, i.size); });
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
    toast.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>' + text;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove("show"); }, 2600);
  }

  /* ----------------------------------------------------------------------
     8. КАТАЛОG: фильтры + сетка товаров (shop.html)
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
    var chipWrap = el("div", "filter-scroll");
    var chips = [{ key: "all", title: "Все коллекции" }].concat(COLLECTIONS.map(function (c) { return { key: c.key, title: c.title }; }));
    chips.forEach(function (c) {
      var b = el("button", "filter-chip" + (c.key === state.coll ? " active" : ""), c.title);
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
        '<select id="f-size"><option value="all">Любой</option><option value="' + S1 + '">Size 1 · 50–56</option><option value="' + S2 + '">Size 2 · 58–64</option></select></span>' +
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
      var cnt = document.getElementById("shop-count");
      cnt.textContent = list.length + (list.length === 1 ? " модель" : (list.length >= 2 && list.length <= 4 ? " модели" : " моделей"));

      if (!list.length) {
        grid.classList.remove("product-grid");
        grid.appendChild(el("div", "shop-empty", "<p>Ничего не найдено</p><span>Попробуйте изменить фильтры.</span>"));
        return;
      }
      grid.classList.add("product-grid");
      list.forEach(function (p) { grid.appendChild(productCard(p)); });
    }
    render();
  }

  function productCard(p) {
    var c = COLL_MAP[p.coll] || {};
    var card = el("div", "product-card");
    var opts = p.sizes.map(function (s) { return '<option value="' + s + '">' + s + '</option>'; }).join("");
    card.innerHTML =
      '<div class="p-media">' +
        (p.coll === "limited" ? '<span class="p-badge">Лимит</span>' : '') +
        (p.img ? '<img class="p-photo" src="' + p.img + '" alt="' + p.name + '" loading="lazy" />' : emblem()) +
      '</div>' +
      '<div class="p-body">' +
        '<span class="p-ln">' + (c.ln || "") + '</span>' +
        '<h3 class="p-name">' + p.name + '</h3>' +
        '<p class="p-desc">' + p.desc + '</p>' +
        '<p class="p-fabric">Ткань: ' + p.fabric + '</p>' +
        '<p class="p-price">' + money(p.price) + '</p>' +
        '<div class="p-buy">' +
          '<select class="p-size" aria-label="Размер">' + opts + '</select>' +
          '<button class="btn btn-gold p-add" type="button" aria-label="В корзину">' +
            '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>' +
          '</button>' +
        '</div>' +
      '</div>';
    card.querySelector(".p-add").addEventListener("click", function () {
      var size = card.querySelector(".p-size").value;
      addToCart(p.id, size);
      showToast("«" + p.name + "» добавлено в корзину");
    });
    return card;
  }

  /* ----------------------------------------------------------------------
     9. ОФОРМЛЕНИЕ ЗАКАЗА (checkout.html)
     ---------------------------------------------------------------------- */
  function initCheckout() {
    var form = document.getElementById("checkout-form");
    var summary = document.getElementById("checkout-summary");
    if (!summary) return;

    var items = getCart();
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
        '<div class="co-line"><div class="thumb">' + emblem() + '</div>' +
        '<div><div class="nm">' + p.name + '</div><div class="mt">' + i.size + ' · ' + i.qty + ' шт.</div></div>' +
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
    var items = getCart();
    var lines = items.map(function (i) {
      var p = PROD_MAP[i.id]; if (!p) return "";
      return "• " + p.name + " (" + i.size + ") × " + i.qty + " — " + money(p.price * i.qty);
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
    injectDrawer();
    updateCartButton();
    initShop();
    initCheckout();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  // экспорт для возможного повторного использования
  window.LEDIJAZZ_SHOP = { COLLECTIONS: COLLECTIONS, PRODUCTS: PRODUCTS, addToCart: addToCart, openCart: openCart };
})();
