/* =========================================================================
   LEDIJAZZ — единая конфигурация сайта.
   ЗАМЕНИТЕ значения ниже на реальные перед публикацией.
   Все плейсхолдеры помечены префиксом PLACEHOLDER / [ ... ].
   ========================================================================= */
window.LEDIJAZZ = {
  /* --- Музыка: ссылка на плейлист Яндекс.Музыки --- */
  // Полный URL плейлиста (для QR-кода и кнопки «Слушать»)
  yandexPlaylistUrl: "https://music.yandex.ru/users/ledijazz/playlists/PLACEHOLDER",
  // Embed-код плеера: вставьте src из «Поделиться → Вставить» на Яндекс.Музыке.
  // Формат: https://music.yandex.ru/iframe/playlist/USER/КОД
  yandexEmbedUrl: "https://music.yandex.ru/iframe/playlist/ledijazz/PLACEHOLDER",

  /* --- Ссылки на покупку (маркетплейсы и соцсети) --- */
  links: {
    wildberries: "#",   // напр. https://www.wildberries.ru/brands/ledijazz
    ozon:        "#",    // напр. https://www.ozon.ru/seller/ledijazz
    lamoda:      "#",    // напр. https://www.lamoda.ru/b/ledijazz
    telegram:    "#",    // напр. https://t.me/ledijazz
    vk:          "#"     // напр. https://vk.com/ledijazz
  },

  /* --- Контакты --- */
  contacts: {
    email: "hello@ledijazz.ru",        // PLACEHOLDER
    phone: "+7 (___) ___-__-__",       // PLACEHOLDER
    phoneHref: "+7"                     // PLACEHOLDER, напр. +79991234567
  },

  /* --- Реквизиты продавца (для подвала и юр. страниц) --- */
  requisites: {
    legalName: "ИП [Фамилия Имя Отчество]",   // или ООО «...»
    inn:  "[ИНН: __________]",
    ogrn: "[ОГРНИП/ОГРН: _______________]",
    address: "[Юридический адрес: ______________________]"
  }
};
