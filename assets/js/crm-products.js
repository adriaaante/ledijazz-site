/* =========================================================================
   LEDI JAZZ — панель управления: товары и справочники.
   Работает с api/catalog.php. Всё, что сохранено здесь, сразу видно на сайте.
   ========================================================================= */
(function () {
  "use strict";

  var API = "api/catalog.php";
  var DEF = window.LEDIJAZZ_CATALOG_DEFAULT || { collections: [], products: [] };
  var CUR = ((window.LEDIJAZZ || {}).shop || {}).currency || "₽";

  var cat = null;          // текущий каталог (с сервера)
  var online = false;      // сервер доступен и мы вошли
  var pinCache = "";       // PIN текущего входа (только в памяти, для повторного входа)
  var filt = { q: "", coll: "all", status: "all" };
  var sortMode = false;
  var offlineMsg = "";

  /* ------------------------------------------------------------ утилиты */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function h(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function money(n) { return (Number(n) || 0).toLocaleString("ru-RU") + " " + CUR; }
  function num(v) { return parseInt(String(v || "").replace(/[^\d]/g, ""), 10) || 0; }
  function fmtNum(n) { return n ? Number(n).toLocaleString("ru-RU") : ""; }
  function plural(n, a, b, c) { var m = n % 10, x = n % 100; return (m === 1 && x !== 11) ? a : (m >= 2 && m <= 4 && (x < 10 || x >= 20)) ? b : c; }
  function sw(hex) { return /gradient/.test(hex || "") ? "background:" + hex : "background-color:" + (hex || "#ccc"); }
  var TR = { "а":"a","б":"b","в":"v","г":"g","д":"d","е":"e","ё":"e","ж":"zh","з":"z","и":"i","й":"y","к":"k","л":"l","м":"m","н":"n","о":"o","п":"p","р":"r","с":"s","т":"t","у":"u","ф":"f","х":"h","ц":"c","ч":"ch","ш":"sh","щ":"sch","ъ":"","ы":"y","ь":"","э":"e","ю":"yu","я":"ya" };
  function slug(s) {
    return String(s || "").toLowerCase().split("").map(function (c) { return TR[c] != null ? TR[c] : c; }).join("")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
  }
  function lcFirst(s) { return s && !/^[A-ZА-ЯЁ]{2}/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s; }
  function splitFabric(s) { return String(s || "").split(/\s*,\s*/).filter(Boolean); }
  function joinFabric(a) { return a.map(function (x, i) { return i ? lcFirst(x) : x.charAt(0).toUpperCase() + x.slice(1); }).join(", "); }
  function eqi(a, b) { return String(a).toLowerCase() === String(b).toLowerCase(); }
  function collTitle(k) { var c = (cat.collections || []).find(function (x) { return x.key === k; }); return c ? c.title : "Без коллекции"; }

  var I = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="M3 3l18 18"/><path d="M10.6 5.1A10.4 10.4 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.9 8.4 2 12 2 12s3.6 7 10 7c1.8 0 3.3-.5 4.6-1.2"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
    dots: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
    up: '<path d="m6 15 6-6 6 6"/>', down: '<path d="m6 9 6 6 6-6"/>',
    left: '<path d="m15 6-6 6 6 6"/>', right: '<path d="m9 6 6 6-6 6"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>', check: '<path d="M20 6 9 17l-5-5"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/>',
    sort: '<path d="M7 4v16M7 4 4 7M7 4l3 3M17 20V4M17 20l-3-3M17 20l3-3"/>',
    star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    back: '<path d="M15 5 8 12l7 7"/>', edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>'
  };
  function ic(n, cls) { return '<svg class="ico ' + (cls || "") + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + I[n] + '</svg>'; }

  /* ------------------------------------------------------------ тост / диалоги */
  var toastEl, toastT;
  function toast(msg, kind) {
    if (!toastEl) { toastEl = h("div", "cx-toast"); document.body.appendChild(toastEl); }
    toastEl.className = "cx-toast show " + (kind || "");
    toastEl.innerHTML = ic(kind === "err" ? "x" : "check") + "<span>" + esc(msg) + "</span>";
    clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove("show"); }, kind === "err" ? 4200 : 2600);
  }
  function confirmBox(o) {
    return new Promise(function (resolve) {
      var ov = h("div", "cx-modal-ov"), m = h("div", "cx-modal");
      m.innerHTML = '<h3>' + esc(o.title) + '</h3>' + (o.text ? '<p>' + esc(o.text) + '</p>' : '') +
        '<div class="cx-modal-act"><button class="cx-btn ghost" data-r="0">' + esc(o.cancel || "Отмена") + '</button>' +
        '<button class="cx-btn ' + (o.danger ? "danger" : "primary") + '" data-r="1">' + esc(o.ok || "OK") + '</button></div>';
      ov.appendChild(m); document.body.appendChild(ov);
      requestAnimationFrame(function () { ov.classList.add("open"); });
      function close(r) { ov.classList.remove("open"); setTimeout(function () { ov.remove(); }, 250); resolve(r); }
      ov.addEventListener("click", function (e) { if (e.target === ov) close(false); var b = e.target.closest("[data-r]"); if (b) close(b.dataset.r === "1"); });
      setTimeout(function () { $('[data-r="1"]', m).focus(); }, 50);
    });
  }
  function promptBox(o) {
    return new Promise(function (resolve) {
      var ov = h("div", "cx-modal-ov"), m = h("form", "cx-modal");
      m.innerHTML = '<h3>' + esc(o.title) + '</h3>' + (o.text ? '<p>' + esc(o.text) + '</p>' : '') +
        (o.fields || [{ name: "v", label: "", value: o.value || "", placeholder: o.placeholder || "" }]).map(function (f) {
          return '<label class="cx-field">' + (f.label ? '<span>' + esc(f.label) + '</span>' : '') +
            (f.type === "color" ? '<span class="cx-colorrow"><input type="color" name="' + f.name + '" value="' + esc(f.value || "#c9ae84") + '"><b>Нажмите, чтобы выбрать оттенок</b></span>' :
            '<input name="' + f.name + '" value="' + esc(f.value || "") + '" placeholder="' + esc(f.placeholder || "") + '" ' + (f.inputmode ? 'inputmode="' + f.inputmode + '"' : '') + ' autocomplete="off">') + '</label>';
        }).join("") +
        '<div class="cx-modal-act"><button type="button" class="cx-btn ghost" data-r="0">Отмена</button><button class="cx-btn primary" type="submit">' + esc(o.ok || "Добавить") + '</button></div>';
      ov.appendChild(m); document.body.appendChild(ov);
      requestAnimationFrame(function () { ov.classList.add("open"); });
      var first = $("input:not([type=color])", m) || $("input", m); setTimeout(function () { first.focus(); first.select && first.select(); }, 60);
      function close(r) { ov.classList.remove("open"); setTimeout(function () { ov.remove(); }, 250); resolve(r); }
      ov.addEventListener("click", function (e) { if (e.target === ov || e.target.closest('[data-r="0"]')) close(null); });
      m.addEventListener("submit", function (e) {
        e.preventDefault(); var r = {};
        $$("input", m).forEach(function (i) { r[i.name] = i.value.trim(); });
        if (o.fields ? !r[o.fields[0].name] : !r.v) { first.focus(); return; }
        close(o.fields ? r : r.v);
      });
    });
  }
  function actionSheet(title, items) {
    var ov = h("div", "cx-modal-ov sheet"), m = h("div", "cx-modal cx-actions");
    m.innerHTML = '<h3>' + esc(title) + '</h3>' + items.map(function (it, i) {
      return '<button class="cx-act ' + (it.danger ? "danger" : "") + '" data-i="' + i + '">' + ic(it.icon) + '<span>' + esc(it.label) + '</span></button>';
    }).join("") + '<button class="cx-act cancel" data-i="-1"><span>Отмена</span></button>';
    ov.appendChild(m); document.body.appendChild(ov);
    requestAnimationFrame(function () { ov.classList.add("open"); });
    function close() { ov.classList.remove("open"); setTimeout(function () { ov.remove(); }, 250); }
    ov.addEventListener("click", function (e) {
      if (e.target === ov) return close();
      var b = e.target.closest("[data-i]"); if (!b) return;
      close(); var it = items[+b.dataset.i]; if (it) it.run();
    });
  }

  /* ------------------------------------------------------------ сервер */
  function api(action, data, form) {
    var opt = { method: "POST", credentials: "same-origin", headers: { "X-LJ-Admin": "1" } };
    if (form) opt.body = form; else { opt.headers["Content-Type"] = "application/json"; opt.body = JSON.stringify(data || {}); }
    return fetch(API + "?action=" + action, opt).then(function (r) {
      return r.json().catch(function () { throw new Error("Сервер вернул неожиданный ответ"); }).then(function (j) {
        if (r.status === 401 && action !== "login") {
          return relogin().then(function () { return api(action, data, form); });
        }
        if (!j.ok) throw new Error(j.error || ("Ошибка " + r.status));
        return j;
      });
    }, function () { throw new Error("Нет связи с сервером. Проверьте интернет."); });
  }
  function relogin() {
    if (pinCache) {
      var p = pinCache; pinCache = "";
      return api("login", { pin: p }).then(function (j) { pinCache = p; return j; }, function () { return askPin(); });
    }
    return askPin();
  }
  function askPin() {
    return promptBox({ title: "Подтвердите PIN", text: "Сессия истекла — введите PIN, чтобы сохранить изменения.", fields: [{ name: "pin", label: "PIN-код", inputmode: "numeric" }], ok: "Войти" })
      .then(function (r) {
        if (!r) throw new Error("Вход отменён — изменения не сохранены");
        return api("login", { pin: r.pin }).then(function (j) { pinCache = r.pin; online = true; renderBanner(); return j; });
      });
  }
  function setCat(c) { if (c) cat = normalize(c); }
  function normalize(c) {
    c = clone(c);
    ["collections", "types", "sizes", "fabrics", "colors", "badges", "products"].forEach(function (k) {
      if (!Array.isArray(c[k]) || (!c[k].length && k !== "products")) c[k] = clone(DEF[k] || []);
    });
    c.products = c.products.map(function (p) {
      p.images = (p.images && p.images.length) ? p.images : (p.img ? [p.img] : []);
      delete p.img;
      p.sizes = p.sizes || []; p.colors = p.colors || [];
      return p;
    });
    return c;
  }

  /* ------------------------------------------------------------ старт */
  var root;
  function start(pin) {
    root = $("#crm-products");
    if (!root || root.dataset.ready) return;
    root.dataset.ready = "1";
    pinCache = pin || "";
    renderShell();
    fetch(API + "?admin=1&t=" + Date.now(), { credentials: "same-origin", cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j.admin) return j;
        if (!pinCache) return askPin();
        return api("login", { pin: pinCache });
      })
      .then(function (j) {
        online = true;
        if (j.catalog) return j;
        return api("init", { catalog: normalize(DEF) });  // первый запуск — переносим стартовый каталог
      })
      .then(function (j) { setCat(j.catalog); renderAll(); })
      .catch(function (e) {
        online = false; offlineMsg = e && /PIN|Вход|попыток/i.test(e.message) ? e.message : ""; cat = normalize(DEF); renderAll();
        console.warn(e);
      });
  }

  /* ------------------------------------------------------------ каркас */
  function renderShell() {
    root.innerHTML =
      '<div class="cx-banner" id="cx-banner" hidden></div>' +
      '<div class="cx-head">' +
        '<div><h2>Товары</h2><p class="cx-sub" id="cx-stats">Загрузка…</p></div>' +
        '<button class="cx-btn primary cx-add-desk" id="cx-add">' + ic("plus") + '<span>Добавить товар</span></button>' +
      '</div>' +
      '<div class="cx-tools">' +
        '<label class="cx-search">' + ic("search") + '<input id="cx-q" type="search" placeholder="Поиск по названию, артикулу, ткани…" autocomplete="off"></label>' +
        '<div class="cx-seg" id="cx-status">' +
          '<button data-s="all" class="on">Все</button><button data-s="live">На сайте</button><button data-s="hidden">Скрытые</button><button data-s="out">Нет в наличии</button>' +
        '</div>' +
        '<button class="cx-btn ghost sm" id="cx-sort" title="Изменить порядок товаров на сайте">' + ic("sort") + '<span>Порядок</span></button>' +
      '</div>' +
      '<div class="cx-chips" id="cx-colls"></div>' +
      '<div class="cx-list" id="cx-list"><div class="cx-loading"><span></span><span></span><span></span></div></div>' +
      '<button class="cx-fab" id="cx-fab" aria-label="Добавить товар">' + ic("plus") + '</button>';

    $("#cx-add").addEventListener("click", function () { openEditor(null); });
    $("#cx-fab").addEventListener("click", function () { openEditor(null); });
    $("#cx-q").addEventListener("input", function () { filt.q = this.value.trim().toLowerCase(); renderList(); });
    $("#cx-status").addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      filt.status = b.dataset.s; $$("#cx-status button").forEach(function (x) { x.classList.toggle("on", x === b); }); renderList();
    });
    $("#cx-sort").addEventListener("click", function () {
      sortMode = !sortMode; this.classList.toggle("on", sortMode);
      $("span", this).textContent = sortMode ? "Готово" : "Порядок";
      if (sortMode) toast("Стрелками меняйте порядок — так товары будут стоять на сайте");
      renderList();
    });
  }
  function renderBanner() {
    var b = $("#cx-banner"); if (!b) return;
    b.hidden = online;
    b.innerHTML = offlineMsg ?
      '<b>Нет доступа к сохранению.</b> ' + esc(offlineMsg) + ' <button class="cx-btn ghost sm" id="cx-relog">Ввести PIN</button>' :
      '<b>Сервер недоступен.</b> Показан стартовый каталог, сохранение не работает. Откройте панель на сайте ledijazz.ru и обновите страницу.';
    var rl = $("#cx-relog");
    if (rl) rl.addEventListener("click", function () {
      askPin().then(function (j) { offlineMsg = ""; if (j.catalog) return j; return api("init", { catalog: normalize(DEF) }); })
        .then(function (j) { setCat(j.catalog); dd = null; renderAll(); toast("Вход выполнен"); })
        .catch(function (e) { toast(e.message, "err"); });
    });
  }
  function renderAll() { renderBanner(); renderColls(); renderList(); renderDicts(); }

  function renderColls() {
    var box = $("#cx-colls"); if (!box) return;
    var counts = {}; cat.products.forEach(function (p) { counts[p.coll] = (counts[p.coll] || 0) + 1; });
    var items = [{ key: "all", title: "Все коллекции", n: cat.products.length }].concat(cat.collections.map(function (c) { return { key: c.key, title: c.title, n: counts[c.key] || 0 }; }));
    var orphan = cat.products.filter(function (p) { return !cat.collections.some(function (c) { return c.key === p.coll; }); }).length;
    if (orphan) items.push({ key: "_none", title: "Без коллекции", n: orphan });
    box.innerHTML = items.map(function (c) {
      return '<button class="cx-chip ' + (filt.coll === c.key ? "on" : "") + '" data-k="' + esc(c.key) + '">' + esc(c.title) + ' <em>' + c.n + '</em></button>';
    }).join("");
    $$("button", box).forEach(function (b) { b.addEventListener("click", function () { filt.coll = b.dataset.k; renderColls(); renderList(); }); });
  }

  function visible() {
    return cat.products.filter(function (p) {
      if (filt.coll === "_none" && cat.collections.some(function (c) { return c.key === p.coll; })) return false;
      if (filt.coll !== "all" && filt.coll !== "_none" && p.coll !== filt.coll) return false;
      if (filt.status === "live" && (p.hidden || p.soldOut)) return false;
      if (filt.status === "hidden" && !p.hidden) return false;
      if (filt.status === "out" && !p.soldOut) return false;
      if (filt.q) {
        var hay = [p.name, p.sku, p.fabric, p.type, collTitle(p.coll), (p.colors || []).map(function (c) { return c.name; }).join(" ")].join(" ").toLowerCase();
        if (hay.indexOf(filt.q) === -1) return false;
      }
      return true;
    });
  }

  function renderList() {
    var box = $("#cx-list"); if (!box || !cat) return;
    var all = cat.products, list = visible();
    var hidden = all.filter(function (p) { return p.hidden; }).length, out = all.filter(function (p) { return p.soldOut; }).length;
    $("#cx-stats").textContent = all.length + " " + plural(all.length, "товар", "товара", "товаров") + " · на сайте " + (all.length - hidden) +
      (hidden ? " · скрыто " + hidden : "") + (out ? " · нет в наличии " + out : "");
    if (!list.length) {
      box.innerHTML = '<div class="cx-empty"><p>' + (all.length ? "Ничего не найдено" : "Пока нет товаров") + '</p><span>' +
        (all.length ? "Измените фильтр или поиск." : "Нажмите «Добавить товар», чтобы создать первый.") + '</span>' +
        '<button class="cx-btn primary" id="cx-empty-add">' + ic("plus") + '<span>Добавить товар</span></button></div>';
      $("#cx-empty-add").addEventListener("click", function () { openEditor(null); });
      return;
    }
    box.innerHTML = "";
    box.classList.toggle("sorting", sortMode);
    list.forEach(function (p, idx) {
      var row = h("div", "cx-row" + (p.hidden ? " is-hidden" : ""));
      var img = p.images && p.images[0];
      var pills = (p.hidden ? '<span class="pill gray">Скрыт</span>' : '<span class="pill green">На сайте</span>') +
        (p.soldOut ? '<span class="pill red">Нет в наличии</span>' : '') +
        (p.badge ? '<span class="pill gold">' + esc(p.badge) + '</span>' : '') +
        (!img ? '<span class="pill warn">Нет фото</span>' : '');
      row.innerHTML =
        '<button class="cx-thumb" data-a="edit" aria-label="Редактировать">' + (img ? '<img src="' + esc(img) + '" alt="" loading="lazy">' : '<img class="ph" src="assets/img/ledijazz-logo.svg" alt="">') +
          (p.images && p.images.length > 1 ? '<em>' + p.images.length + '</em>' : '') + '</button>' +
        '<button class="cx-info" data-a="edit">' +
          '<span class="cx-name">' + esc(p.name) + '</span>' +
          '<span class="cx-meta">' + esc([collTitle(p.coll), p.type, p.sku].filter(Boolean).join(" · ")) + '</span>' +
          '<span class="cx-price">' + money(p.price) + (p.oldPrice ? ' <s>' + money(p.oldPrice) + '</s>' : '') +
            ((p.colors || []).length ? '<span class="cx-dots">' + p.colors.slice(0, 5).map(function (c) { return '<i style="' + esc(sw(c.hex)) + '" title="' + esc(c.name) + '"></i>'; }).join("") + '</span>' : '') +
          '</span>' +
          '<span class="cx-pills">' + pills + '</span>' +
        '</button>' +
        (sortMode ?
          '<div class="cx-ord"><button data-a="up" ' + (idx === 0 ? "disabled" : "") + ' aria-label="Выше">' + ic("up") + '</button><button data-a="down" ' + (idx === list.length - 1 ? "disabled" : "") + ' aria-label="Ниже">' + ic("down") + '</button></div>' :
          '<div class="cx-acts">' +
            '<button class="cx-icon" data-a="toggle" title="' + (p.hidden ? "Показать на сайте" : "Скрыть с сайта") + '" aria-label="' + (p.hidden ? "Показать на сайте" : "Скрыть с сайта") + '">' + ic(p.hidden ? "eyeOff" : "eye") + '</button>' +
            '<button class="cx-icon" data-a="more" aria-label="Ещё">' + ic("dots") + '</button>' +
          '</div>');
      row.addEventListener("click", function (e) {
        var b = e.target.closest("[data-a]"); if (!b) return;
        var a = b.dataset.a;
        if (a === "edit") openEditor(p);
        else if (a === "toggle") quickToggle(p, "hidden");
        else if (a === "more") moreMenu(p);
        else if (a === "up" || a === "down") move(p, list, idx, a === "up" ? -1 : 1);
      });
      box.appendChild(row);
    });
  }

  function moreMenu(p) {
    actionSheet(p.name, [
      { icon: "edit", label: "Редактировать", run: function () { openEditor(p); } },
      { icon: "copy", label: "Дублировать", run: function () { duplicate(p); } },
      { icon: p.soldOut ? "check" : "x", label: p.soldOut ? "Снова в наличии" : "Нет в наличии", run: function () { quickToggle(p, "soldOut"); } },
      { icon: "ext", label: "Открыть на сайте", run: function () { window.open("shop.html?product=" + encodeURIComponent(p.id), "_blank"); } },
      { icon: "trash", label: "Удалить", danger: true, run: function () { removeProduct(p); } }
    ]);
  }

  function guardOnline() { if (!online) { toast("Сервер недоступен — сохранить не получится", "err"); return false; } return true; }

  function quickToggle(p, field) {
    if (!guardOnline()) return;
    var np = clone(p); np[field] = !np[field];
    api("save", { product: np, originalId: p.id }).then(function (j) {
      setCat(j.catalog); renderColls(); renderList();
      toast(field === "hidden" ? (np.hidden ? "Товар скрыт с сайта" : "Товар снова на сайте") : (np.soldOut ? "Отмечено: нет в наличии" : "Товар снова в наличии"));
    }).catch(function (e) { toast(e.message, "err"); });
  }
  function duplicate(p) {
    var np = clone(p); np.id = ""; np.name = p.name + " (копия)"; np.hidden = true;
    openEditor(np, true);
  }
  function removeProduct(p) {
    if (!guardOnline()) return Promise.resolve(false);
    return confirmBox({ title: "Удалить «" + p.name + "»?", text: "Товар исчезнет с сайта. Если нужно лишь временно убрать — лучше скрыть его.", ok: "Удалить", danger: true })
      .then(function (ok) {
        if (!ok) return false;
        return api("delete", { id: p.id }).then(function (j) { setCat(j.catalog); renderColls(); renderList(); toast("Товар удалён"); return true; });
      }).catch(function (e) { toast(e.message, "err"); return false; });
  }
  var ordT;
  function move(p, list, idx, dir) {
    var other = list[idx + dir]; if (!other) return;
    var a = cat.products.indexOf(p), b = cat.products.indexOf(other);
    cat.products[a] = other; cat.products[b] = p;
    renderList();
    if (!online) return;
    clearTimeout(ordT);
    ordT = setTimeout(function () {
      api("reorder", { ids: cat.products.map(function (x) { return x.id; }) })
        .then(function () { toast("Порядок сохранён"); })
        .catch(function (e) { toast(e.message, "err"); });
    }, 700);
  }

  /* ============================================================ РЕДАКТОР ТОВАРА */
  var ed = null, edOrig = "", edOrigId = "", dictsDirty = false, uploading = 0, sheet;

  function blankProduct() {
    var c = filt.coll !== "all" && filt.coll !== "_none" ? filt.coll : (cat.collections[0] || {}).key || "";
    return { id: "", coll: c, type: "", name: "", sku: "", price: 0, oldPrice: 0, fabric: "", sizes: cat.sizes.slice(0, 2), colors: [], desc: "", care: "", images: [], badge: "", hidden: false, soldOut: false };
  }

  function openEditor(p, isCopy) {
    var isNew = !p || isCopy;
    ed = p ? clone(p) : blankProduct();
    edOrigId = isNew ? "" : p.id;
    edOrig = isCopy ? "" : JSON.stringify(ed);
    dictsDirty = false;
    if (!sheet) {
      sheet = h("div", "cx-sheet-ov");
      sheet.innerHTML = '<div class="cx-sheet" role="dialog" aria-modal="true"></div>';
      document.body.appendChild(sheet);
      sheet.addEventListener("click", function (e) { if (e.target === sheet) closeEditor(); });
      document.addEventListener("keydown", function (e) { if (e.key === "Escape" && sheet.classList.contains("open") && !$(".cx-modal-ov")) closeEditor(); });
    }
    var s = $(".cx-sheet", sheet);
    s.innerHTML =
      '<header class="cx-sh-head">' +
        '<button class="cx-icon" data-x="close" aria-label="Закрыть">' + ic("back") + '</button>' +
        '<div class="cx-sh-title"><b>' + (isNew ? (isCopy ? "Копия товара" : "Новый товар") : "Редактирование") + '</b><span id="ed-sub">' + (isNew ? "заполните и сохраните" : esc(p.name)) + '</span></div>' +
        '<button class="cx-btn primary sm" data-x="save">' + ic("check") + '<span>Сохранить</span></button>' +
      '</header>' +
      '<div class="cx-sh-body">' +

        card("Фотографии", "Первое фото — обложка в каталоге. Можно выбрать сразу несколько.",
          '<div class="ph-grid" id="ed-photos"></div>' +
          '<input type="file" id="ed-file" accept="image/*" multiple hidden>') +

        card("Основное", "",
          field("Название *", '<input id="ed-name" maxlength="120" placeholder="Например: Платье «Утро»" autocomplete="off">') +
          '<div class="cx-2">' +
            field("Цена, ₽ *", '<input id="ed-price" inputmode="numeric" placeholder="7 900" autocomplete="off">') +
            field("Старая цена, ₽", '<input id="ed-old" inputmode="numeric" placeholder="для скидки" autocomplete="off">', '<span class="cx-hint" id="ed-off"></span>') +
          '</div>' +
          field("Артикул", '<input id="ed-sku" maxlength="40" placeholder="необязательно" autocomplete="off">')) +

        card("Коллекция *", "Раздел магазина, в котором будет товар.", '<div class="cx-pick" id="ed-coll"></div>') +
        card("Тип изделия", "", '<div class="cx-pick" id="ed-type"></div>') +
        card("Размеры", "Отметьте все доступные размеры.", '<div class="cx-pick" id="ed-sizes"></div>') +
        card("Цвета", "Если цветов несколько — покупатель выберет нужный.", '<div class="cx-pick swatches" id="ed-colors"></div>') +
        card("Ткань / состав", "Можно выбрать несколько.", '<div class="cx-pick" id="ed-fabric"></div>') +

        card("Описание", "",
          field("Описание для покупателя", '<textarea id="ed-desc" rows="4" maxlength="2000" placeholder="Силуэт, посадка, для какого случая…"></textarea>', '<span class="cx-hint right" id="ed-desc-n"></span>') +
          field("Уход", '<textarea id="ed-care" rows="2" maxlength="1000" placeholder="Например: деликатная стирка 30°, не отбеливать"></textarea>')) +

        card("Метка на фото", "", '<div class="cx-pick" id="ed-badge"></div>') +

        card("Публикация", "",
          toggle("ed-live", "Показывать на сайте", "Выключите, чтобы временно скрыть товар") +
          toggle("ed-stock", "В наличии", "Если выключить — товар виден, но купить нельзя")) +

        (isNew ? "" :
          '<div class="cx-danger">' +
            '<button class="cx-btn ghost" data-x="dup">' + ic("copy") + '<span>Дублировать</span></button>' +
            '<a class="cx-btn ghost" target="_blank" rel="noopener" href="shop.html?product=' + encodeURIComponent(p.id) + '">' + ic("ext") + '<span>На сайте</span></a>' +
            '<button class="cx-btn danger-ghost" data-x="del">' + ic("trash") + '<span>Удалить</span></button>' +
          '</div>') +
      '</div>' +
      '<footer class="cx-sh-foot"><button class="cx-btn ghost" data-x="close">Отмена</button><button class="cx-btn primary" data-x="save">' + ic("check") + '<span>Сохранить товар</span></button></footer>';

    // значения
    $("#ed-name").value = ed.name || "";
    $("#ed-price").value = fmtNum(ed.price);
    $("#ed-old").value = fmtNum(ed.oldPrice);
    $("#ed-sku").value = ed.sku || "";
    $("#ed-desc").value = ed.desc || "";
    $("#ed-care").value = ed.care || "";
    $("#ed-live").checked = !ed.hidden;
    $("#ed-stock").checked = !ed.soldOut;

    $("#ed-name").addEventListener("input", function () { ed.name = this.value; $("#ed-sub").textContent = this.value || "заполните и сохраните"; });
    ["ed-price", "ed-old"].forEach(function (id) {
      $("#" + id).addEventListener("input", function () {
        var n = num(this.value), pos = this.value.length - this.selectionStart;
        this.value = fmtNum(n);
        try { var np = Math.max(0, this.value.length - pos); this.setSelectionRange(np, np); } catch (e) {}
        if (id === "ed-price") ed.price = n; else ed.oldPrice = n;
        offHint();
      });
    });
    $("#ed-sku").addEventListener("input", function () { ed.sku = this.value; });
    $("#ed-desc").addEventListener("input", function () { ed.desc = this.value; descCount(); });
    $("#ed-care").addEventListener("input", function () { ed.care = this.value; });
    $("#ed-live").addEventListener("change", function () { ed.hidden = !this.checked; });
    $("#ed-stock").addEventListener("change", function () { ed.soldOut = !this.checked; });
    $("#ed-file").addEventListener("change", function () { addFiles(this.files); this.value = ""; });

    s.onclick = sheetClick;
    function sheetClick(e) {
      var b = e.target.closest("[data-x]"); if (!b) return;
      var x = b.dataset.x;
      if (x === "close") closeEditor();
      else if (x === "save") saveEditor();
      else if (x === "dup") duplicate(ed);
      else if (x === "del") { var target = cat.products.find(function (q) { return q.id === edOrigId; }); if (target) removeProduct(target).then(function (ok) { if (ok) hideSheet(); }); }
    }

    offHint(); descCount();
    renderPhotos(); renderColl(); renderType(); renderSizes(); renderColors(); renderFabric(); renderBadge();

    sheet.classList.add("open");
    document.body.classList.add("cx-lock");
    $(".cx-sh-body", s).scrollTop = 0;
    if (isNew && !isCopy) setTimeout(function () { if (window.matchMedia("(hover:hover)").matches) $("#ed-name").focus(); }, 300);
  }

  function card(title, hint, body) {
    return '<section class="cx-card"><div class="cx-card-h"><h4>' + esc(title) + '</h4>' + (hint ? '<p>' + esc(hint) + '</p>' : '') + '</div>' + body + '</section>';
  }
  function field(label, input, extra) { return '<label class="cx-field"><span>' + esc(label) + '</span>' + input + (extra || "") + '</label>'; }
  function toggle(id, label, hint) {
    return '<label class="cx-toggle"><span><b>' + esc(label) + '</b><em>' + esc(hint) + '</em></span><input type="checkbox" id="' + id + '"><i></i></label>';
  }
  function offHint() {
    var o = $("#ed-off"); if (!o) return;
    o.textContent = ed.oldPrice > ed.price && ed.price ? "Скидка −" + Math.round((1 - ed.price / ed.oldPrice) * 100) + "%" : (ed.oldPrice && ed.oldPrice <= ed.price ? "Должна быть больше цены" : "");
    o.classList.toggle("bad", !!(ed.oldPrice && ed.oldPrice <= ed.price));
  }
  function descCount() { var n = $("#ed-desc-n"); if (n) n.textContent = (ed.desc || "").length + " / 2000"; }

  /* ---- универсальный выбор из списка (чипы) ---- */
  function pick(box, opts) {
    // opts: items [{v, label, sw}], selected(v)→bool, onToggle(v), addLabel, onAdd()
    box.innerHTML = opts.items.map(function (it) {
      var on = opts.selected(it.v);
      return '<button type="button" class="cx-opt ' + (on ? "on" : "") + (it.sw != null ? " has-sw" : "") + '" data-v="' + esc(it.v) + '" aria-pressed="' + on + '">' +
        (it.sw != null ? '<i style="' + esc(sw(it.sw)) + '"></i>' : '') + '<span>' + esc(it.label) + '</span>' + (on && opts.multi ? ic("check", "ck") : '') + '</button>';
    }).join("") + (opts.addLabel ? '<button type="button" class="cx-opt add" data-add="1">' + ic("plus") + '<span>' + esc(opts.addLabel) + '</span></button>' : '') +
      (opts.extra || "");
    $$(".cx-opt", box).forEach(function (b) {
      b.addEventListener("click", function () {
        if (b.dataset.add) return opts.onAdd();
        if (b.dataset.all) return opts.onAll();
        opts.onToggle(b.dataset.v);
      });
    });
  }

  function renderColl() {
    pick($("#ed-coll"), {
      items: cat.collections.map(function (c) { return { v: c.key, label: c.title }; }),
      selected: function (v) { return ed.coll === v; },
      onToggle: function (v) { ed.coll = v; renderColl(); },
      addLabel: "Новая коллекция",
      onAdd: function () {
        promptBox({ title: "Новая коллекция", fields: [{ name: "title", label: "Название", placeholder: "Например: Осень" }, { name: "ln", label: "Подпись линейки (необязательно)", placeholder: "L · Autumn" }] }).then(function (r) {
          if (!r) return;
          var key = slug(r.title) || ("c" + Date.now().toString(36));
          while (cat.collections.some(function (c) { return c.key === key; })) key += "-2";
          cat.collections.push({ key: key, title: r.title, ln: r.ln || "" });
          dictsDirty = true; ed.coll = key; renderColl();
        });
      }
    });
  }
  function addToList(listName, title, placeholder, after) {
    promptBox({ title: title, placeholder: placeholder }).then(function (v) {
      if (!v) return;
      var ex = cat[listName].find(function (x) { return eqi(x, v); });
      if (!ex) { cat[listName].push(v); dictsDirty = true; ex = v; }
      after(ex);
    });
  }
  function renderType() {
    pick($("#ed-type"), {
      items: cat.types.map(function (t) { return { v: t, label: t }; }),
      selected: function (v) { return ed.type === v; },
      onToggle: function (v) { ed.type = ed.type === v ? "" : v; renderType(); },
      addLabel: "Свой тип",
      onAdd: function () { addToList("types", "Новый тип изделия", "Например: Жилет", function (v) { ed.type = v; renderType(); }); }
    });
  }
  function renderSizes() {
    var items = cat.sizes.slice();
    ed.sizes.forEach(function (s) { if (items.indexOf(s) === -1) items.push(s); });
    var allOn = items.every(function (s) { return ed.sizes.indexOf(s) !== -1; });
    pick($("#ed-sizes"), {
      multi: true,
      items: items.map(function (s) { return { v: s, label: s }; }),
      selected: function (v) { return ed.sizes.indexOf(v) !== -1; },
      onToggle: function (v) {
        var i = ed.sizes.indexOf(v);
        if (i === -1) ed.sizes.push(v); else ed.sizes.splice(i, 1);
        ed.sizes.sort(function (a, b) { return items.indexOf(a) - items.indexOf(b); });
        renderSizes();
      },
      addLabel: "Свой размер",
      onAdd: function () { addToList("sizes", "Новый размер", "Например: 66 или Size 3 · 66–70", function (v) { if (ed.sizes.indexOf(v) === -1) ed.sizes.push(v); renderSizes(); }); },
      extra: '<button type="button" class="cx-opt link" data-all="1"><span>' + (allOn ? "Снять все" : "Выбрать все") + '</span></button>',
      onAll: function () { ed.sizes = allOn ? [] : items.slice(); renderSizes(); }
    });
  }
  function renderColors() {
    var items = cat.colors.slice();
    ed.colors.forEach(function (c) { if (!items.some(function (x) { return eqi(x.name, c.name); })) items.push(c); });
    pick($("#ed-colors"), {
      multi: true,
      items: items.map(function (c) { return { v: c.name, label: c.name, sw: c.hex }; }),
      selected: function (v) { return ed.colors.some(function (c) { return eqi(c.name, v); }); },
      onToggle: function (v) {
        var i = ed.colors.findIndex(function (c) { return eqi(c.name, v); });
        if (i === -1) ed.colors.push(clone(items.find(function (c) { return c.name === v; }))); else ed.colors.splice(i, 1);
        renderColors();
      },
      addLabel: "Свой цвет",
      onAdd: function () {
        promptBox({ title: "Новый цвет", fields: [{ name: "name", label: "Название цвета", placeholder: "Например: Мокко" }, { name: "hex", label: "Оттенок", type: "color" }] }).then(function (r) {
          if (!r) return;
          var c = cat.colors.find(function (x) { return eqi(x.name, r.name); });
          if (!c) { c = { name: r.name, hex: r.hex || "#c9ae84" }; cat.colors.push(c); dictsDirty = true; }
          if (!ed.colors.some(function (x) { return eqi(x.name, c.name); })) ed.colors.push(clone(c));
          renderColors();
        });
      }
    });
  }
  function renderFabric() {
    var sel = splitFabric(ed.fabric);
    var items = cat.fabrics.slice();
    sel.forEach(function (f) { if (!items.some(function (x) { return eqi(x, f); })) items.push(f); });
    pick($("#ed-fabric"), {
      multi: true,
      items: items.map(function (f) { return { v: f, label: f }; }),
      selected: function (v) { return sel.some(function (x) { return eqi(x, v); }); },
      onToggle: function (v) {
        var i = sel.findIndex(function (x) { return eqi(x, v); });
        if (i === -1) sel.push(v); else sel.splice(i, 1);
        ed.fabric = joinFabric(sel); renderFabric();
      },
      addLabel: "Своя ткань",
      onAdd: function () { addToList("fabrics", "Новая ткань", "Например: Купра", function (v) { if (!sel.some(function (x) { return eqi(x, v); })) sel.push(v); ed.fabric = joinFabric(sel); renderFabric(); }); }
    });
  }
  function renderBadge() {
    pick($("#ed-badge"), {
      items: [{ v: "", label: "Без метки" }].concat(cat.badges.map(function (b) { return { v: b, label: b }; })),
      selected: function (v) { return (ed.badge || "") === v; },
      onToggle: function (v) { ed.badge = v; renderBadge(); },
      addLabel: "Своя метка",
      onAdd: function () { addToList("badges", "Новая метка", "Например: −20%", function (v) { ed.badge = v; renderBadge(); }); }
    });
  }

  /* ---- фотографии ---- */
  var dragFrom = -1;
  function renderPhotos() {
    var box = $("#ed-photos"); if (!box) return;
    box.innerHTML = "";
    ed.images.forEach(function (src, i) {
      var t = h("div", "ph-tile" + (i === 0 ? " main" : ""));
      t.draggable = true;
      t.innerHTML = '<img src="' + esc(src) + '" alt="">' +
        (i === 0 ? '<span class="ph-main">' + ic("star") + 'Обложка</span>' : '<button type="button" class="ph-btn ph-star" title="Сделать обложкой">' + ic("star") + '</button>') +
        '<button type="button" class="ph-btn ph-del" title="Удалить фото">' + ic("x") + '</button>' +
        '<div class="ph-move">' +
          '<button type="button" class="ph-btn" data-d="-1" ' + (i === 0 ? "disabled" : "") + ' aria-label="Левее">' + ic("left") + '</button>' +
          '<button type="button" class="ph-btn" data-d="1" ' + (i === ed.images.length - 1 ? "disabled" : "") + ' aria-label="Правее">' + ic("right") + '</button>' +
        '</div>';
      $(".ph-del", t).addEventListener("click", function () { ed.images.splice(i, 1); renderPhotos(); });
      var st = $(".ph-star", t); if (st) st.addEventListener("click", function () { ed.images.unshift(ed.images.splice(i, 1)[0]); renderPhotos(); });
      $$("[data-d]", t).forEach(function (b) { b.addEventListener("click", function () { var j = i + +b.dataset.d; var x = ed.images[i]; ed.images[i] = ed.images[j]; ed.images[j] = x; renderPhotos(); }); });
      t.addEventListener("dragstart", function (e) { dragFrom = i; t.classList.add("drag"); try { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(i)); } catch (er) {} });
      t.addEventListener("dragend", function () { t.classList.remove("drag"); });
      t.addEventListener("dragover", function (e) { if (dragFrom > -1) { e.preventDefault(); t.classList.add("over"); } });
      t.addEventListener("dragleave", function () { t.classList.remove("over"); });
      t.addEventListener("drop", function (e) {
        e.preventDefault(); t.classList.remove("over");
        if (dragFrom > -1 && dragFrom !== i) { ed.images.splice(i, 0, ed.images.splice(dragFrom, 1)[0]); renderPhotos(); }
        dragFrom = -1;
      });
      box.appendChild(t);
    });
    for (var k = 0; k < uploading; k++) box.appendChild(h("div", "ph-tile loading", '<span class="spin"></span><em>Загрузка…</em>'));
    var add = h("button", "ph-add", ic("camera") + '<b>' + (ed.images.length ? "Ещё фото" : "Добавить фото") + '</b><span>с телефона или компьютера</span>');
    add.type = "button";
    add.addEventListener("click", function () { if (!guardOnline()) return; $("#ed-file").click(); });
    box.appendChild(add);
    // перетаскивание файлов с компьютера
    box.ondragover = function (e) { if (dragFrom === -1 && e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], "Files") !== -1) { e.preventDefault(); box.classList.add("drop"); } };
    box.ondragleave = function () { box.classList.remove("drop"); };
    box.ondrop = function (e) { box.classList.remove("drop"); if (dragFrom === -1 && e.dataTransfer.files.length) { e.preventDefault(); if (guardOnline()) addFiles(e.dataTransfer.files); } };
  }

  function addFiles(files) {
    files = Array.prototype.slice.call(files || []).filter(function (f) { return /^image\//.test(f.type) || /\.(jpe?g|png|webp|heic|heif)$/i.test(f.name); });
    if (!files.length) return;
    var room = 12 - ed.images.length - uploading;
    if (files.length > room) { toast("Максимум 12 фото на товар", "err"); files = files.slice(0, Math.max(0, room)); }
    var target = ed;
    // загружаем по очереди — так сохраняется порядок выбранных фото
    uploading += files.length; renderPhotos();
    var chain = Promise.resolve();
    files.forEach(function (f) {
      chain = chain.then(function () {
        return resize(f).then(function (blob) {
          var fd = new FormData();
          fd.append("file", blob, (slug(target.name) || "photo") + ".jpg");
          fd.append("name", slug(target.name) || "photo");
          return api("upload", null, fd);
        }).then(function (j) {
          uploading--;
          target.images.push(j.url);
          if (ed === target) renderPhotos();
        }).catch(function (e) {
          uploading--; if (ed === target) renderPhotos(); toast(e.message || "Не удалось загрузить фото", "err");
        });
      });
    });
  }
  /** Уменьшаем фото прямо в браузере: 1800 px по длинной стороне, JPEG ~85%. */
  function resize(file) {
    return new Promise(function (resolve) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var max = 1800, w = img.naturalWidth, hh = img.naturalHeight, k = Math.min(1, max / Math.max(w, hh));
        if (k === 1 && /jpe?g|webp/.test(file.type) && file.size < 900 * 1024) { URL.revokeObjectURL(url); return resolve(file); }
        var c = document.createElement("canvas"); c.width = Math.round(w * k); c.height = Math.round(hh * k);
        var x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height);
        x.imageSmoothingQuality = "high"; x.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { resolve(b || file); }, "image/jpeg", 0.86);
      };
      img.onerror = function () { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }

  /* ---- сохранить / закрыть ---- */
  function saveEditor() {
    if (!guardOnline()) return;
    if (uploading) { toast("Дождитесь загрузки фото", "err"); return; }
    ed.name = (ed.name || "").trim();
    if (!ed.name) { toast("Укажите название товара", "err"); $("#ed-name").focus(); return; }
    if (!ed.price) { toast("Укажите цену", "err"); $("#ed-price").focus(); return; }
    if (!ed.coll) { toast("Выберите коллекцию", "err"); $("#ed-coll").scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    if (ed.oldPrice && ed.oldPrice <= ed.price) ed.oldPrice = 0;
    if (!edOrigId && !ed.id) ed.id = slug(ed.name) || "";
    var btns = $$('[data-x="save"]', sheet); btns.forEach(function (b) { b.disabled = true; b.classList.add("busy"); });
    var payload = { product: ed, originalId: edOrigId };
    if (dictsDirty) payload.dicts = dictsOf(cat);
    api("save", payload).then(function (j) {
      setCat(j.catalog);
      var wasNew = !edOrigId;
      hideSheet(); renderColls(); renderList(); renderDicts();
      toast(wasNew ? "Товар добавлен — он уже на сайте" + (j.product.hidden ? " (скрыт)" : "") : "Изменения сохранены и уже на сайте");
    }).catch(function (e) { toast(e.message, "err"); })
      .then(function () { btns.forEach(function (b) { b.disabled = false; b.classList.remove("busy"); }); });
  }
  function closeEditor() {
    var dirty = edOrig !== JSON.stringify(ed) || dictsDirty;
    if (!dirty) return hideSheet();
    confirmBox({ title: "Закрыть без сохранения?", text: "Внесённые изменения пропадут.", ok: "Закрыть", cancel: "Продолжить", danger: true })
      .then(function (ok) { if (ok) { if (dictsDirty) reloadCat(); hideSheet(); } });
  }
  function hideSheet() { sheet.classList.remove("open"); document.body.classList.remove("cx-lock"); ed = null; }
  function reloadCat() {
    fetch(API + "?admin=1&t=" + Date.now(), { credentials: "same-origin", cache: "no-store" }).then(function (r) { return r.json(); })
      .then(function (j) { if (j.catalog) { setCat(j.catalog); renderAll(); } }).catch(function () {});
  }
  function dictsOf(c) { return { collections: c.collections, types: c.types, sizes: c.sizes, fabrics: c.fabrics, colors: c.colors, badges: c.badges }; }

  /* ============================================================ СПРАВОЧНИКИ */
  var dd = null, ddOrig = "";
  function renderDicts(force) {
    var box = $("#crm-dicts"); if (!box || !cat) return;
    if (!force && dd && JSON.stringify(dd) !== ddOrig) return;   // не затираем несохранённые правки
    dd = clone(dictsOf(cat)); ddOrig = JSON.stringify(dd);
    drawDicts();
  }
  function drawDicts() {
    var box = $("#crm-dicts");
    var counts = {}; cat.products.forEach(function (p) { counts[p.coll] = (counts[p.coll] || 0) + 1; });
    box.innerHTML =
      '<div class="cx-head"><div><h2>Справочники</h2><p class="cx-sub">Списки, из которых выбираются параметры товара. Изменения применяются к сайту после сохранения.</p></div></div>' +
      '<section class="cx-card"><div class="cx-card-h"><h4>Коллекции</h4><p>Разделы магазина. Порядок — как в фильтре на сайте.</p></div><div class="d-colls" id="d-colls"></div>' +
        '<button class="cx-btn ghost sm" id="d-coll-add">' + ic("plus") + '<span>Добавить коллекцию</span></button></section>' +
      '<section class="cx-card"><div class="cx-card-h"><h4>Цвета</h4><p>Нажмите на кружок, чтобы изменить оттенок.</p></div><div class="d-colors" id="d-colors"></div>' +
        '<button class="cx-btn ghost sm" id="d-color-add">' + ic("plus") + '<span>Добавить цвет</span></button></section>' +
      tagCard("sizes", "Размеры", "Порядок важен — так размеры показываются покупателю.") +
      tagCard("types", "Типы изделий", "") +
      tagCard("fabrics", "Ткани", "") +
      tagCard("badges", "Метки на фото", "Например: Новинка, Хит, Скидка.") +
      '<div class="cx-dict-save" id="d-bar"><span>Есть несохранённые изменения</span><button class="cx-btn ghost sm" id="d-reset">Отменить</button><button class="cx-btn primary sm" id="d-save">' + ic("check") + '<span>Сохранить</span></button></div>';

    // коллекции
    var cb = $("#d-colls");
    dd.collections.forEach(function (c, i) {
      var r = h("div", "d-coll");
      r.innerHTML = '<div class="d-ord"><button ' + (i ? "" : "disabled") + ' data-d="-1" aria-label="Выше">' + ic("up") + '</button><button ' + (i < dd.collections.length - 1 ? "" : "disabled") + ' data-d="1" aria-label="Ниже">' + ic("down") + '</button></div>' +
        '<div class="d-coll-f"><input value="' + esc(c.title) + '" data-f="title" placeholder="Название" aria-label="Название коллекции"><input value="' + esc(c.ln || "") + '" data-f="ln" placeholder="Подпись линейки, напр. L · Home" aria-label="Подпись"></div>' +
        '<span class="d-n" title="Товаров в коллекции">' + (counts[c.key] || 0) + '</span>' +
        '<button class="cx-icon" data-del aria-label="Удалить">' + ic("trash") + '</button>';
      $$("input", r).forEach(function (inp) { inp.addEventListener("input", function () { c[inp.dataset.f] = inp.value; ddChanged(); }); });
      $$("[data-d]", r).forEach(function (b) { b.addEventListener("click", function () { var j = i + +b.dataset.d; dd.collections.splice(j, 0, dd.collections.splice(i, 1)[0]); drawDicts(); ddChanged(); }); });
      $("[data-del]", r).addEventListener("click", function () {
        if (counts[c.key]) { toast("В коллекции " + counts[c.key] + " " + plural(counts[c.key], "товар", "товара", "товаров") + " — сначала перенесите их в другую", "err"); return; }
        dd.collections.splice(i, 1); drawDicts(); ddChanged();
      });
      cb.appendChild(r);
    });
    $("#d-coll-add").addEventListener("click", function () {
      promptBox({ title: "Новая коллекция", fields: [{ name: "title", label: "Название", placeholder: "Например: Осень" }, { name: "ln", label: "Подпись линейки (необязательно)", placeholder: "L · Autumn" }] }).then(function (r) {
        if (!r) return;
        var key = slug(r.title) || ("c" + Date.now().toString(36));
        while (dd.collections.some(function (c) { return c.key === key; })) key += "-2";
        dd.collections.push({ key: key, title: r.title, ln: r.ln || "" }); drawDicts(); ddChanged();
      });
    });

    // цвета
    var colb = $("#d-colors");
    dd.colors.forEach(function (c, i) {
      var r = h("div", "d-color");
      var grad = /gradient/.test(c.hex);
      r.innerHTML = '<label class="d-sw" style="' + esc(sw(c.hex)) + '">' + (grad ? '' : '<input type="color" value="' + esc(c.hex) + '" aria-label="Оттенок">') + '</label>' +
        '<input class="d-cname" value="' + esc(c.name) + '" aria-label="Название цвета">' +
        '<button class="cx-icon" data-del aria-label="Удалить">' + ic("x") + '</button>';
      var ci = $("input[type=color]", r);
      if (ci) ci.addEventListener("input", function () { c.hex = ci.value; $(".d-sw", r).style.backgroundColor = ci.value; ddChanged(); });
      $(".d-cname", r).addEventListener("input", function () { c.name = this.value; ddChanged(); });
      $("[data-del]", r).addEventListener("click", function () { dd.colors.splice(i, 1); drawDicts(); ddChanged(); });
      colb.appendChild(r);
    });
    $("#d-color-add").addEventListener("click", function () {
      promptBox({ title: "Новый цвет", fields: [{ name: "name", label: "Название цвета", placeholder: "Например: Мокко" }, { name: "hex", label: "Оттенок", type: "color" }] }).then(function (r) {
        if (!r) return; dd.colors.push({ name: r.name, hex: r.hex || "#c9ae84" }); drawDicts(); ddChanged();
      });
    });

    ["sizes", "types", "fabrics", "badges"].forEach(function (k) {
      var b = $("#d-" + k);
      dd[k].forEach(function (v, i) {
        var t = h("span", "d-tag");
        t.innerHTML = (i ? '<button data-l aria-label="Левее">' + ic("left") + '</button>' : '') + '<b>' + esc(v) + '</b><button data-x aria-label="Удалить">' + ic("x") + '</button>';
        $("[data-x]", t).addEventListener("click", function () { dd[k].splice(i, 1); drawDicts(); ddChanged(); });
        var l = $("[data-l]", t); if (l) l.addEventListener("click", function () { dd[k].splice(i - 1, 0, dd[k].splice(i, 1)[0]); drawDicts(); ddChanged(); });
        b.appendChild(t);
      });
      var form = h("form", "d-tag-add", '<input placeholder="Добавить…" aria-label="Добавить значение"><button class="cx-icon" aria-label="Добавить">' + ic("plus") + '</button>');
      form.addEventListener("submit", function (e) {
        e.preventDefault(); var v = $("input", form).value.trim(); if (!v) return;
        if (!dd[k].some(function (x) { return eqi(x, v); })) dd[k].push(v);
        drawDicts(); ddChanged(); setTimeout(function () { $("#d-" + k + " .d-tag-add input").focus(); }, 0);
      });
      b.appendChild(form);
    });

    $("#d-reset").addEventListener("click", function () { renderDicts(true); });
    $("#d-save").addEventListener("click", saveDicts);
    ddChanged();
  }
  function tagCard(k, title, hint) {
    return '<section class="cx-card"><div class="cx-card-h"><h4>' + esc(title) + '</h4>' + (hint ? '<p>' + esc(hint) + '</p>' : '') + '</div><div class="d-tags" id="d-' + k + '"></div></section>';
  }
  function ddChanged() { var bar = $("#d-bar"); if (bar) bar.classList.toggle("show", JSON.stringify(dd) !== ddOrig); }
  function saveDicts() {
    if (!guardOnline()) return;
    dd.collections = dd.collections.filter(function (c) { return (c.title || "").trim(); });
    dd.colors = dd.colors.filter(function (c) { return (c.name || "").trim(); });
    if (!dd.collections.length) { toast("Нужна хотя бы одна коллекция", "err"); return; }
    var b = $("#d-save"); b.disabled = true;
    api("dicts", { dicts: dd }).then(function (j) { setCat(j.catalog); dd = null; renderAll(); toast("Справочники сохранены"); })
      .catch(function (e) { toast(e.message, "err"); }).then(function () { if (b) b.disabled = false; });
  }

  window.LJ_CRM = { start: start, logout: function () { return fetch(API + "?action=logout", { method: "POST", credentials: "same-origin", headers: { "X-LJ-Admin": "1" } }).catch(function () {}); } };
})();
