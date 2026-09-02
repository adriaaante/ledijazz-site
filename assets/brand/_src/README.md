# Шаблон бренд-кита

`template.html` — исходник всех обложек, аватаров, сторис и иконок актуальных (артборды с точными размерами).
Фотографии: `photo-terrace.jpg` (терраса, бугенвиллея), `photo-interior.jpg` (интерьер, бирюзовый кафтан).

Как перерисовать после правок:
```bash
python3 -m http.server 8080          # из корня репозитория
# открыть http://localhost:8080/assets/brand/_src/template.html и снять скриншот
# нужного артборда (id: vk-cover, ok-cover, ok-mob, tg-post, story, ig-post, hl-1..4, ava-dark, ava-light)
```
Готовые файлы лежат в `assets/brand/<сервис>/`, страница выдачи — `kit.html` (вход по PIN).
