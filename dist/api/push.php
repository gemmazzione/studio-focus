<?php
// Iscrizioni alle notifiche push e casella dei messaggi letta dal service worker.
// GET  ?action=key                                  -> {publicKey}  (chiave VAPID pubblica)
// GET  ?action=check                                -> raggiungibilità dei servizi push (diagnostica)
// POST {action: "subscribe", endpoint, studying, cheers}   (X-Auth-Token) -> {inboxKey}
// POST {action: "unsubscribe", endpoint}                   (X-Auth-Token)
// POST {action: "inbox", key}   -> {messages}: li legge il service worker, senza token
require __DIR__ . '/_lib.php';
require __DIR__ . '/_push.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

if ($method === 'GET' && $action === 'key') {
    [$public] = vapid_keys(db());
    respond(200, ['publicKey' => $public]);
}

if ($method === 'GET' && $action === 'check') {
    $out = ['curl' => function_exists('curl_init'), 'openssl' => function_exists('openssl_pkey_new'), 'php' => PHP_VERSION];
    foreach (['fcm' => 'https://fcm.googleapis.com/', 'mozilla' => 'https://updates.push.services.mozilla.com/', 'apple' => 'https://web.push.apple.com/'] as $k => $url) {
        if (!$out['curl']) break;
        $c = curl_init($url);
        curl_setopt_array($c, [CURLOPT_NOBODY => true, CURLOPT_TIMEOUT => 6, CURLOPT_RETURNTRANSFER => true]);
        curl_exec($c);
        $out[$k] = curl_errno($c) ? 'errore: ' . curl_error($c) : 'HTTP ' . curl_getinfo($c, CURLINFO_HTTP_CODE);
        curl_close($c);
    }
    respond(200, $out);
}

if ($method !== 'POST') respond(400, ['error' => 'unknown_action']);
$body = read_json_body(true);
$action = $body['action'] ?? '';
$pdo = db();
push_tables($pdo);
$S = table('push_subs');
$I = table('push_inbox');

/** Solo indirizzi https dei servizi push dei browser. */
function valid_endpoint($e): bool
{
    return is_string($e) && strlen($e) <= 600 && preg_match('#^https://[a-z0-9.-]+/#i', $e)
        && preg_match('#(googleapis\.com|mozilla\.com|mozaws\.net|push\.apple\.com|notify\.windows\.com|push\.services\.mozilla\.com)$#i', parse_url($e, PHP_URL_HOST));
}

if ($action === 'inbox') {
    $key = is_string($body['key'] ?? null) && preg_match('/^[a-f0-9]{64}$/', $body['key']) ? $body['key'] : '';
    $s = $pdo->prepare("SELECT id FROM $S WHERE inbox_key = ?");
    $s->execute([$key]);
    $sub = $s->fetch();
    if (!$sub) respond(404, ['error' => 'unknown_subscription']);
    $s = $pdo->prepare("SELECT title, body, url, tag FROM $I WHERE sub_id = ? ORDER BY id");
    $s->execute([(int) $sub['id']]);
    $messages = $s->fetchAll();
    $pdo->prepare("DELETE FROM $I WHERE sub_id = ?")->execute([(int) $sub['id']]);
    respond(200, ['messages' => $messages]);
}

[$userId] = require_user();

if ($action === 'subscribe') {
    $endpoint = $body['endpoint'] ?? '';
    if (!valid_endpoint($endpoint)) respond(400, ['error' => 'invalid_endpoint']);
    $key = bin2hex(random_bytes(32));
    // Lo stesso dispositivo può cambiare account: l'iscrizione passa all'ultimo utente
    $pdo->prepare("DELETE FROM $S WHERE endpoint = ?")->execute([$endpoint]);
    $pdo->prepare("INSERT INTO $S (user_id, endpoint, inbox_key, want_studying, want_cheers, created_at) VALUES (?, ?, ?, ?, ?, ?)")
        ->execute([$userId, $endpoint, $key, empty($body['studying']) ? 0 : 1, empty($body['cheers']) ? 0 : 1, time() * 1000]);
    respond(200, ['inboxKey' => $key]);
}

if ($action === 'unsubscribe') {
    $pdo->prepare("DELETE FROM $S WHERE endpoint = ? AND user_id = ?")->execute([(string) ($body['endpoint'] ?? ''), $userId]);
    respond(200, ['ok' => true]);
}

respond(400, ['error' => 'unknown_action']);
