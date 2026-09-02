<?php
/**
 * LEDI JAZZ — автодеплой «по запросу».
 * GitHub Actions после push в main вызывает этот файл, а он скачивает свежий
 * архив ветки main с GitHub и раскладывает файлы по сайту. Подключение идёт
 * ОТ хостинга К GitHub (исходящее HTTPS), поэтому блокировки FTP/SSH не мешают.
 *
 * Вызов: POST с заголовком X-Deploy-Token: <токен>  (так делает GitHub)
 *        или GET  ?token=<токен>                    (вручную из браузера)
 * Токен в открытом виде здесь не хранится — только его SHA-256.
 */
const REPO        = 'adriaaante/ledijazz-site';
const BRANCH      = 'main';
const TOKEN_SHA256 = 'bc27065a246ec0c2fc39b2da5eb20aeea05597f718e88e570c48a7492a02826d';
// Для ПРИВАТНОГО репозитория: положите рядом файл .github-token с fine-grained
// токеном GitHub (права: Contents → Read). Для публичного не нужен.
const GITHUB_TOKEN_FILE = __DIR__ . '/.github-token';
const EXCLUDE = ['.git', '.github', '.claude', 'README.md', 'ДАННЫЕ-ДЛЯ-ЗАПОЛНЕНИЯ.md', '.gitignore'];
// Устаревшие файлы, которые нужно удалить с сервера при деплое
const REMOVE  = ['kit.html'];

@set_time_limit(300);
header('Content-Type: text/plain; charset=utf-8');
header('Cache-Control: no-store');

function out(string $s): void { echo $s, "\n"; @flush(); }
function fail(int $code, string $msg): void { http_response_code($code); out("ОШИБКА: $msg"); log_line("FAIL $msg"); exit; }
function log_line(string $s): void { @file_put_contents(__DIR__.'/deploy.log', date('Y-m-d H:i:s')." $s\n", FILE_APPEND); }

// --- 1. авторизация ---
$given = $_SERVER['HTTP_X_DEPLOY_TOKEN'] ?? ($_GET['token'] ?? ($_POST['token'] ?? ''));
if ($given === '' || !hash_equals(TOKEN_SHA256, hash('sha256', $given))) fail(403, 'неверный или отсутствующий токен');

// --- 2. скачиваем архив ветки ---
$root = __DIR__;
$tmp  = $root . '/.deploy-tmp';
$zip  = $tmp . '/src.zip';
if (!is_dir($tmp) && !mkdir($tmp, 0755, true)) fail(500, "не могу создать $tmp");
$url = 'https://codeload.github.com/' . REPO . '/zip/refs/heads/' . BRANCH;
$headers = ['User-Agent: ledijazz-deploy'];
if (is_readable(GITHUB_TOKEN_FILE)) $headers[] = 'Authorization: Bearer ' . trim(file_get_contents(GITHUB_TOKEN_FILE));

$data = false;
if (function_exists('curl_init')) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_HTTPHEADER => $headers, CURLOPT_TIMEOUT => 120, CURLOPT_SSL_VERIFYPEER => true]);
    $data = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); $err = curl_error($ch); curl_close($ch);
    if ($data === false || $code !== 200) fail(502, "GitHub ответил $code $err");
} else {
    $ctx = stream_context_create(['http' => ['header' => implode("\r\n", $headers), 'timeout' => 120, 'follow_location' => 1]]);
    $data = @file_get_contents($url, false, $ctx);
    if ($data === false) fail(502, 'не удалось скачать архив (нет curl и allow_url_fopen)');
}
file_put_contents($zip, $data);
out('Скачано: ' . number_format(strlen($data)) . ' байт');

// --- 3. распаковываем ---
if (!class_exists('ZipArchive')) fail(500, 'на сервере нет ZipArchive');
$za = new ZipArchive();
if ($za->open($zip) !== true) fail(500, 'архив не открывается');
$extract = $tmp . '/x';
if (is_dir($extract)) rrmdir($extract);
mkdir($extract, 0755, true);
$za->extractTo($extract); $za->close();
$dirs = glob($extract . '/*', GLOB_ONLYDIR);
if (!$dirs) fail(500, 'в архиве нет папки');
$src = $dirs[0];

// --- 4. раскладываем файлы по сайту ---
$copied = 0;
$it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($src, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::SELF_FIRST);
foreach ($it as $item) {
    $rel = substr($item->getPathname(), strlen($src) + 1);
    $top = explode('/', $rel)[0];
    if (in_array($top, EXCLUDE, true) || in_array(basename($rel), EXCLUDE, true)) continue;
    $dest = $root . '/' . $rel;
    if ($item->isDir()) { if (!is_dir($dest)) mkdir($dest, 0755, true); continue; }
    if (!is_dir(dirname($dest))) mkdir(dirname($dest), 0755, true);
    if (!copy($item->getPathname(), $dest)) fail(500, "не удалось записать $rel");
    $copied++;
}
foreach (REMOVE as $old) { $f = $root . '/' . $old; if (is_file($f)) { unlink($f); out("Удалён устаревший файл: $old"); } }
rrmdir($tmp);
$sha = trim(@file_get_contents('https://api.github.com/repos/' . REPO . '/commits/' . BRANCH,
    false, stream_context_create(['http' => ['header' => "User-Agent: ledijazz-deploy\r\nAccept: application/vnd.github.sha", 'timeout' => 10]])) ?: '');
out("Готово: обновлено файлов — $copied" . ($sha ? ', коммит ' . substr($sha, 0, 7) : ''));
log_line("OK files=$copied sha=" . substr($sha, 0, 7));

function rrmdir(string $d): void {
    foreach (array_diff(scandir($d), ['.', '..']) as $f) { $p = "$d/$f"; is_dir($p) ? rrmdir($p) : unlink($p); }
    rmdir($d);
}
