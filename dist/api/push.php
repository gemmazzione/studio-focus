<?php
// Notifiche push (Web Push). Per ora solo il controllo di raggiungibilità dei servizi.
require __DIR__ . '/_lib.php';

if (($_GET['action'] ?? '') === 'check') {
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
respond(400, ['error' => 'unknown_action']);
