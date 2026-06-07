/* =========================================================================
   LEDIJAZZ — интерактив сайта
   ========================================================================= */
(function () {
  "use strict";
  var CFG = window.LEDIJAZZ || {};

  /* ---------- Header scroll state ---------- */
  var header = document.querySelector(".site-header");
  function onScroll() {
    if (!header) return;
    if (window.scrollY > 40) header.classList.add("scrolled");
    else header.classList.remove("scrolled");
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- Mobile nav ---------- */
  var toggle = document.querySelector(".nav-toggle");
  var links = document.querySelector(".nav-links");
  if (toggle && links) {
    toggle.addEventListener("click", function () {
      var open = links.classList.toggle("open");
      toggle.classList.toggle("open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      document.body.style.overflow = open ? "hidden" : "";
    });
    links.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        links.classList.remove("open");
        toggle.classList.remove("open");
        document.body.style.overflow = "";
      });
    });
  }

  /* ---------- Reveal on scroll ---------- */
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && reveals.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
      });
    }, { threshold: 0.14, rootMargin: "0px 0px -8% 0px" });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("in"); });
  }

  /* ---------- Inject config-driven links ---------- */
  function setLinks(map, attr) {
    document.querySelectorAll("[" + attr + "]").forEach(function (el) {
      var key = el.getAttribute(attr);
      var val = map && map[key];
      if (val) { el.setAttribute("href", val); if (val === "#") el.setAttribute("data-pending", "1"); }
    });
  }
  setLinks(CFG.links, "data-link");

  // Music
  var embed = document.querySelector("[data-yandex-embed]");
  if (embed) {
    var em = CFG.yandexEmbedUrl || "";
    var isReady = em && em.indexOf("PLACEHOLDER") === -1 && em.indexOf("about:blank") === -1;
    if (isReady) {
      embed.setAttribute("src", em);
    } else {
      // Элегантная заглушка плеера, пока не задан реальный embed Яндекс.Музыки
      var ph = document.createElement("div");
      ph.className = "player-placeholder";
      ph.innerHTML =
        '<svg viewBox="0 0 24 24" width="46" height="46" fill="none" stroke="#EAD080" stroke-width="1.5">' +
        '<path d="M9 18V6l10-2v12"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/></svg>' +
        '<p class="pp-title">Плейлист LEDIJAZZ</p>' +
        '<p class="pp-sub">Плеер Яндекс.Музыки появится здесь после публикации</p>' +
        '<a class="btn btn-gold" data-yandex-url href="' + (CFG.yandexPlaylistUrl || "#") + '" target="_blank" rel="noopener">Открыть в Яндекс.Музыке</a>';
      embed.replaceWith(ph);
    }
  }
  document.querySelectorAll("[data-yandex-url]").forEach(function (el) {
    if (CFG.yandexPlaylistUrl) el.setAttribute("href", CFG.yandexPlaylistUrl);
  });

  // Contacts
  if (CFG.contacts) {
    document.querySelectorAll("[data-contact-email]").forEach(function (el) {
      el.textContent = CFG.contacts.email; el.setAttribute("href", "mailto:" + CFG.contacts.email);
    });
    document.querySelectorAll("[data-contact-phone]").forEach(function (el) {
      el.textContent = CFG.contacts.phone;
      if (CFG.contacts.phoneHref) el.setAttribute("href", "tel:" + CFG.contacts.phoneHref);
    });
  }

  // Requisites
  if (CFG.requisites) {
    var r = CFG.requisites;
    var rmap = { legalName: r.legalName, inn: r.inn, ogrn: r.ogrn, address: r.address };
    document.querySelectorAll("[data-req]").forEach(function (el) {
      var k = el.getAttribute("data-req");
      if (rmap[k]) el.textContent = rmap[k];
    });
  }

  /* ---------- Footer year ---------- */
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });

  /* ---------- Preorder form ---------- */
  var form = document.querySelector("#preorder-form");
  if (form) {
    var msg = form.querySelector(".form-msg");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      msg.className = "form-msg";
      var consent = form.querySelector("#consent");
      var name = form.querySelector("#f-name");
      var contact = form.querySelector("#f-contact");
      if (!name.value.trim() || !contact.value.trim()) {
        msg.classList.add("err"); msg.textContent = "Пожалуйста, заполните имя и контакт для связи.";
        return;
      }
      if (consent && !consent.checked) {
        msg.classList.add("err"); msg.textContent = "Необходимо согласие на обработку персональных данных.";
        return;
      }
      // Без бэкенда: формируем письмо на e-mail бренда (можно заменить на Formspree/CRM)
      var email = (CFG.contacts && CFG.contacts.email) || "hello@ledijazz.ru";
      var size = form.querySelector("#f-size");
      var note = form.querySelector("#f-note");
      var body = encodeURIComponent(
        "Имя: " + name.value + "\n" +
        "Контакт: " + contact.value + "\n" +
        "Размер: " + (size ? size.value : "") + "\n" +
        "Сообщение: " + (note ? note.value : "")
      );
      var subject = encodeURIComponent("Предзаказ LEDIJAZZ");
      msg.classList.add("ok");
      msg.textContent = "Спасибо! Открывается почтовое приложение для отправки заявки. Мы свяжемся с вами.";
      window.location.href = "mailto:" + email + "?subject=" + subject + "&body=" + body;
      form.reset();
    });
  }

  /* ---------- Cookie banner ---------- */
  var cookie = document.querySelector(".cookie");
  if (cookie) {
    var KEY = "ledijazz_cookie_ok";
    if (!localStorage.getItem(KEY)) {
      setTimeout(function () { cookie.classList.add("show"); }, 900);
    }
    var accept = cookie.querySelector("[data-cookie-accept]");
    if (accept) accept.addEventListener("click", function () {
      localStorage.setItem(KEY, "1"); cookie.classList.remove("show");
    });
  }

  /* ---------- Lightbox (for swapped-in photos) ---------- */
  var lb = document.querySelector(".lightbox");
  if (lb) {
    var lbImg = lb.querySelector("img");
    document.querySelectorAll("[data-zoom]").forEach(function (el) {
      el.addEventListener("click", function () {
        var src = el.getAttribute("data-zoom");
        if (!src) return;
        lbImg.setAttribute("src", src);
        lb.classList.add("show");
      });
    });
    lb.addEventListener("click", function () { lb.classList.remove("show"); });
  }
})();
