<?php
/**
 * LEDI JAZZ — API каталога товаров.
 *
 *  GET  api/catalog.php                 — публичный каталог (без скрытых товаров)
 *  GET  api/catalog.php?admin=1         — полный каталог для панели (нужен вход)
 *  POST api/catalog.php?action=login    — {pin}            → вход в панель (сессия)
 *  POST api/catalog.php?action=logout
 *  POST api/catalog.php?action=init     — {catalog}        → первичная загрузка каталога
 *  POST api/catalog.php?action=save     — {product, dicts?}→ создать / обновить товар
 *  POST api/catalog.php?action=delete   — {id}
 *  POST api/catalog.php?action=reorder  — {ids:[...]}
 *  POST api/catalog.php?action=dicts    — {dicts}          → коллекции, типы, размеры, ткани, цвета
 *  POST api/catalog.php?action=upload   — multipart file   → {url}
 *
 * Данные лежат в /data/catalog.json, фото — в /uploads/products/.
 * Обе папки НЕ входят в репозиторий и не затираются автодеплоем.
 */
declare(strict_types=1);

const PIN_SHA256   = '481f6cc0511143ccdd7e2d1b1b94faf0a700a8b49cd13922a70b5ae28acaa8c5'; // тот же PIN, что у панели
const MAX_FAILS    = 8;       // попыток ввода PIN
const FAIL_WINDOW  = 900;     // за 15 минут
const MAX_UPLOAD   = 12 * 1024 * 1024;
const MAX_PRODUCTS = 1000;

$ROOT     = dirname(__DIR__);
$DATA     = $ROOT . '/data';
$FILE     = $DATA . '/catalog.json';
$UPLOADS  = $ROOT . '/uploads/products';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, max-age=0');
header('X-Content-Type-Options: nosniff');

function respond($data, int $code = 200): void {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
function fail(string $msg, int $code = 400): void { respond(['ok' => false, 'error' => $msg], $code); }

function ensure_dirs(): void {
    global $DATA, $UPLOADS, $ROOT;
    if (!is_dir($DATA) && !@mkdir($DATA, 0755, true)) fail('Не удалось создать папку data на сервере', 500);
    if (!is_file($DATA . '/.htaccess')) @file_put_contents($DATA . '/.htaccess', "Require all denied\nDeny from all\n");
    if (!is_dir($DATA . '/backups')) @mkdir($DATA . '/backups', 0755, true);
    if (!is_dir($UPLOADS) && !@mkdir($UPLOADS, 0755, true)) fail('Не удалось создать папку uploads на сервере', 500);
    $ht = $ROOT . '/uploads/.htaccess';
    if (!is_file($ht)) @file_put_contents($ht,
        "# Только картинки, никаких скриптов\n" .
        "Options -Indexes -ExecCGI\n" .
        "RemoveHandler .php .phtml .php3 .php4 .php5 .php7 .php8 .phar .pl .py .cgi\n" .
        "<IfModule mod_php.c>\nphp_flag engine off\n</IfModule>\n" .
        "<IfModule mod_php7.c>\nphp_flag engine off\n</IfModule>\n" .
        "<FilesMatch \"(?i)\\.(php\\d?|phtml|phar|pl|py|cgi|sh|htaccess)$\">\nRequire all denied\n</FilesMatch>\n" .
        "<IfModule mod_expires.c>\nExpiresActive On\nExpiresByType image/jpeg \"access plus 1 year\"\nExpiresByType image/webp \"access plus 1 year\"\nExpiresByType image/png \"access plus 1 year\"\n</IfModule>\n");
}

function read_catalog(): ?array {
    global $FILE;
    if (!is_file($FILE)) return null;
    $j = json_decode((string)file_get_contents($FILE), true);
    return is_array($j) ? $j : null;
}

/** Атомарная запись с блокировкой и резервной копией. */
function write_catalog(array $cat): void {
    global $FILE, $DATA;
    ensure_dirs();
    $cat['updated'] = date('c');
    $json = json_encode($cat, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    if ($json === false) fail('Не удалось сохранить данные', 500);
    if (is_file($FILE)) {
        @copy($FILE, $DATA . '/backups/catalog-' . date('Ymd-His') . '.json');
        $b = glob($DATA . '/backups/catalog-*.json') ?: [];
        sort($b);
        while (count($b) > 40) @unlink(array_shift($b));
    }
    $tmp = $FILE . '.tmp' . getmypid();
    if (@file_put_contents($tmp, $json) === false || !@rename($tmp, $FILE)) { @unlink($tmp); fail('Ошибка записи на сервере', 500); }
}

/** Блокировка на всё время «прочитать → изменить → записать». */
function with_lock(callable $fn) {
    global $DATA;
    ensure_dirs();
    $h = fopen($DATA . '/.lock', 'c');
    flock($h, LOCK_EX);
    try { return $fn(); } finally { flock($h, LOCK_UN); fclose($h); }
}

/* ------------------------------ очистка данных ------------------------------ */
function s($v, int $max = 200): string {
    $v = is_scalar($v) ? (string)$v : '';
    $v = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $v) ?? '';
    $v = trim($v);
    return mb_substr($v, 0, $max);
}
function str_list($arr, int $max = 60, int $len = 80): array {
    $out = [];
    if (!is_array($arr)) return $out;
    foreach ($arr as $v) { $v = s($v, $len); if ($v !== '' && !in_array($v, $out, true)) $out[] = $v; if (count($out) >= $max) break; }
    return $out;
}
function clean_hex($v): string {
    $v = s($v, 160);
    if (preg_match('/^#[0-9a-fA-F]{3,8}$/', $v)) return $v;
    // разрешаем простой градиент для «принта»
    if (preg_match('/^linear-gradient\([0-9a-zA-Z#%.,\s]+\)$/', $v)) return $v;
    return '#CCCCCC';
}
function clean_colors($arr, int $max = 60): array {
    $out = []; $seen = [];
    if (!is_array($arr)) return $out;
    foreach ($arr as $c) {
        if (!is_array($c)) continue;
        $n = s($c['name'] ?? '', 40); if ($n === '' || isset($seen[mb_strtolower($n)])) continue;
        $seen[mb_strtolower($n)] = 1;
        $out[] = ['name' => $n, 'hex' => clean_hex($c['hex'] ?? '')];
        if (count($out) >= $max) break;
    }
    return $out;
}
function clean_key($v): string {
    $v = strtolower(s($v, 60));
    $v = preg_replace('/[^a-z0-9-]+/', '-', $v) ?? '';
    return trim($v, '-');
}
function clean_image($v): string {
    $v = s($v, 300);
    if (preg_match('#^(uploads/products|assets/img)/[A-Za-z0-9._-]+\.(jpe?g|png|webp)$#', $v)) return $v;
    return '';
}
function clean_dicts(array $d): array {
    $colls = []; $seen = [];
    foreach ((array)($d['collections'] ?? []) as $c) {
        if (!is_array($c)) continue;
        $k = clean_key($c['key'] ?? ''); $t = s($c['title'] ?? '', 60);
        if ($k === '' || $t === '' || isset($seen[$k])) continue;
        $seen[$k] = 1;
        $colls[] = ['key' => $k, 'title' => $t, 'ln' => s($c['ln'] ?? '', 60)];
    }
    return [
        'collections' => $colls,
        'types'   => str_list($d['types'] ?? []),
        'sizes'   => str_list($d['sizes'] ?? [], 40, 40),
        'fabrics' => str_list($d['fabrics'] ?? []),
        'colors'  => clean_colors($d['colors'] ?? []),
        'badges'  => str_list($d['badges'] ?? [], 12, 20),
    ];
}
function clean_product(array $p): array {
    $images = [];
    foreach ((array)($p['images'] ?? []) as $im) { $im = clean_image($im); if ($im !== '' && !in_array($im, $images, true)) $images[] = $im; if (count($images) >= 12) break; }
    $legacy = clean_image($p['img'] ?? '');
    if (!$images && $legacy !== '') $images[] = $legacy;
    $price = (int)round((float)($p['price'] ?? 0));
    $old   = (int)round((float)($p['oldPrice'] ?? 0));
    return [
        'id'       => clean_key($p['id'] ?? ''),
        'coll'     => clean_key($p['coll'] ?? ''),
        'type'     => s($p['type'] ?? '', 60),
        'name'     => s($p['name'] ?? '', 120),
        'sku'      => s($p['sku'] ?? '', 40),
        'price'    => max(0, min($price, 10000000)),
        'oldPrice' => ($old > $price) ? min($old, 10000000) : 0,
        'fabric'   => s($p['fabric'] ?? '', 200),
        'sizes'    => str_list($p['sizes'] ?? [], 40, 40),
        'colors'   => clean_colors($p['colors'] ?? [], 20),
        'desc'     => s($p['desc'] ?? '', 2000),
        'care'     => s($p['care'] ?? '', 1000),
        'images'   => $images,
        'badge'    => s($p['badge'] ?? '', 20),
        'hidden'   => !empty($p['hidden']),
        'soldOut'  => !empty($p['soldOut']),
    ];
}
function clean_catalog(array $c): array {
    $out = clean_dicts($c);
    $out['products'] = [];
    $ids = [];
    foreach ((array)($c['products'] ?? []) as $p) {
        if (!is_array($p)) continue;
        $p = clean_product($p);
        if ($p['id'] === '' || $p['name'] === '' || isset($ids[$p['id']])) continue;
        $ids[$p['id']] = 1;
        $out['products'][] = $p;
        if (count($out['products']) >= MAX_PRODUCTS) break;
    }
    return $out;
}

/* ------------------------------ авторизация ------------------------------ */
function start_session(): void {
    if (session_status() === PHP_SESSION_ACTIVE) return;
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    session_name('ljadmin');
    session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'secure' => $https, 'httponly' => true, 'samesite' => 'Strict']);
    session_start();
}
function is_admin(): bool { start_session(); return !empty($_SESSION['lj_admin']); }
function require_admin(): void { if (!is_admin()) fail('Требуется вход: введите PIN ещё раз', 401); }

function client_ip(): string { return (string)($_SERVER['REMOTE_ADDR'] ?? '0'); }
function fails_load(): array {
    global $DATA; $f = $DATA . '/.auth-fails.json';
    $j = is_file($f) ? json_decode((string)file_get_contents($f), true) : [];
    $j = is_array($j) ? $j : [];
    $now = time();
    foreach ($j as $ip => $r) if (($r['t'] ?? 0) < $now - FAIL_WINDOW) unset($j[$ip]);
    return $j;
}
function fails_save(array $j): void { global $DATA; ensure_dirs(); @file_put_contents($DATA . '/.auth-fails.json', json_encode($j)); }

/* ------------------------------ тело запроса ------------------------------ */
function body(): array {
    $raw = file_get_contents('php://input');
    $j = json_decode((string)$raw, true);
    return is_array($j) ? $j : [];
}

/* ================================ МАРШРУТЫ ================================ */
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = (string)($_GET['action'] ?? '');

if ($method === 'GET') {
    $cat = read_catalog();
    if (!empty($_GET['admin'])) {
        respond(['ok' => true, 'admin' => is_admin(), 'catalog' => $cat]);
    }
    if ($cat) {
        $cat['products'] = array_values(array_filter($cat['products'] ?? [], function ($p) { return empty($p['hidden']); }));
    }
    respond(['ok' => true, 'catalog' => $cat]);
}

if ($method !== 'POST') fail('Метод не поддерживается', 405);
// Защита от CSRF: нестандартный заголовок нельзя отправить с чужого сайта без CORS.
if (($_SERVER['HTTP_X_LJ_ADMIN'] ?? '') !== '1') fail('Неверный запрос', 403);

switch ($action) {

case 'login':
    ensure_dirs();
    $ip = client_ip();
    $fails = fails_load();
    if (($fails[$ip]['n'] ?? 0) >= MAX_FAILS) fail('Слишком много попыток. Подождите 15 минут.', 429);
    $pin = s(body()['pin'] ?? '', 20);
    if ($pin === '' || !hash_equals(PIN_SHA256, hash('sha256', $pin))) {
        $fails[$ip] = ['n' => ($fails[$ip]['n'] ?? 0) + 1, 't' => time()];
        fails_save($fails);
        fail('Неверный PIN', 403);
    }
    unset($fails[$ip]); fails_save($fails);
    start_session();
    session_regenerate_id(true);
    $_SESSION['lj_admin'] = 1;
    respond(['ok' => true, 'catalog' => read_catalog()]);

case 'logout':
    start_session();
    $_SESSION = [];
    session_destroy();
    respond(['ok' => true]);

case 'init':
    require_admin();
    $res = with_lock(function () {
        $cur = read_catalog();
        if ($cur) return $cur;               // уже создан — ничего не затираем
        $c = clean_catalog((array)(body()['catalog'] ?? []));
        write_catalog($c);
        return read_catalog();
    });
    respond(['ok' => true, 'catalog' => $res]);

case 'save':
    require_admin();
    $b = body();
    $res = with_lock(function () use ($b) {
        $cat = read_catalog();
        if (!$cat) fail('Каталог ещё не создан — обновите страницу панели', 409);
        if (isset($b['dicts']) && is_array($b['dicts'])) $cat = array_merge($cat, clean_dicts($b['dicts']));
        $p = clean_product((array)($b['product'] ?? []));
        if ($p['name'] === '') fail('Укажите название товара');
        if ($p['price'] <= 0)  fail('Укажите цену товара');
        $origId = clean_key($b['originalId'] ?? '');
        if ($p['id'] === '') $p['id'] = 'p-' . substr(bin2hex(random_bytes(4)), 0, 8);
        $list = $cat['products'] ?? [];
        // защита от совпадения id у разных товаров
        $idx = -1;   // новый товар (originalId пуст) никогда не затирает существующий
        if ($origId !== '') foreach ($list as $i => $x) if (($x['id'] ?? '') === $origId) { $idx = $i; break; }
        foreach ($list as $i => $x) if ($i !== $idx && ($x['id'] ?? '') === $p['id']) $p['id'] .= '-' . substr(bin2hex(random_bytes(2)), 0, 3);
        if ($idx >= 0) $list[$idx] = $p; else { if (count($list) >= MAX_PRODUCTS) fail('Слишком много товаров'); array_unshift($list, $p); }
        $cat['products'] = array_values($list);
        write_catalog($cat);
        return ['product' => $p, 'catalog' => read_catalog()];
    });
    respond(['ok' => true] + $res);

case 'delete':
    require_admin();
    $id = clean_key(body()['id'] ?? '');
    $res = with_lock(function () use ($id) {
        $cat = read_catalog(); if (!$cat) fail('Каталог не найден', 404);
        $cat['products'] = array_values(array_filter($cat['products'] ?? [], function ($p) use ($id) { return ($p['id'] ?? '') !== $id; }));
        write_catalog($cat);
        return read_catalog();
    });
    respond(['ok' => true, 'catalog' => $res]);

case 'reorder':
    require_admin();
    $ids = array_map('clean_key', (array)(body()['ids'] ?? []));
    $res = with_lock(function () use ($ids) {
        $cat = read_catalog(); if (!$cat) fail('Каталог не найден', 404);
        $pos = array_flip($ids);
        $list = $cat['products'] ?? [];
        $orig = array_flip(array_column($list, 'id'));
        usort($list, function ($a, $b) use ($pos, $orig) {
            $pa = $pos[$a['id']] ?? (100000 + $orig[$a['id']]);
            $pb = $pos[$b['id']] ?? (100000 + $orig[$b['id']]);
            return $pa <=> $pb;
        });
        $cat['products'] = $list;
        write_catalog($cat);
        return read_catalog();
    });
    respond(['ok' => true, 'catalog' => $res]);

case 'dicts':
    require_admin();
    $d = clean_dicts((array)(body()['dicts'] ?? []));
    if (!$d['collections']) fail('Нужна хотя бы одна коллекция');
    $res = with_lock(function () use ($d) {
        $cat = read_catalog(); if (!$cat) fail('Каталог не найден', 404);
        $cat = array_merge($cat, $d);
        write_catalog($cat);
        return read_catalog();
    });
    respond(['ok' => true, 'catalog' => $res]);

case 'upload':
    require_admin();
    ensure_dirs();
    $f = $_FILES['file'] ?? null;
    if (!$f || !is_array($f) || ($f['error'] ?? 1) !== UPLOAD_ERR_OK) {
        $e = (int)($f['error'] ?? 4);
        fail($e === UPLOAD_ERR_INI_SIZE || $e === UPLOAD_ERR_FORM_SIZE ? 'Файл слишком большой' : 'Файл не получен', 400);
    }
    if ($f['size'] > MAX_UPLOAD) fail('Файл слишком большой (макс. 12 МБ)');
    $info = @getimagesize($f['tmp_name']);
    $ext = [IMAGETYPE_JPEG => 'jpg', IMAGETYPE_PNG => 'png', IMAGETYPE_WEBP => 'webp'][$info[2] ?? 0] ?? '';
    if (!$info || $ext === '') fail('Поддерживаются только фото JPG, PNG или WEBP');
    $base = clean_key($_POST['name'] ?? '') ?: 'photo';
    $base = substr($base, 0, 40);
    $name = $base . '-' . date('ymd') . '-' . bin2hex(random_bytes(3)) . '.' . $ext;
    if (!move_uploaded_file($f['tmp_name'], $UPLOADS . '/' . $name)) fail('Не удалось сохранить фото', 500);
    @chmod($UPLOADS . '/' . $name, 0644);
    respond(['ok' => true, 'url' => 'uploads/products/' . $name, 'w' => $info[0], 'h' => $info[1]]);

default:
    fail('Неизвестное действие', 404);
}
