<?php
// POST {username, password, code?, website?} -> {token, username}
// Se in config.php è impostato 'invite', serve il codice d'invito. 'website' è un campo trappola per i bot.
require __DIR__ . '/_lib.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') respond(405, ['error' => 'method_not_allowed']);

$body = read_json_body(true);
$username = normalize_username($body['username'] ?? '');
$password = is_string($body['password'] ?? null) ? $body['password'] : '';
$code = is_string($body['code'] ?? null) ? $body['code'] : '';

if (!empty($body['website'])) respond(400, ['error' => 'rejected']);
if (invite_code() !== '' && !hash_equals(invite_code(), $code)) {
    sleep(1);
    respond(403, ['error' => 'wrong_code']);
}
if (!preg_match('/^[a-z0-9._-]{3,40}$/', $username)) respond(400, ['error' => 'username_invalid']);
if (strlen($password) < 8) respond(400, ['error' => 'password_too_short']);

$pdo = db();
$signups = table('signups');
$ip = client_ip_hash();
$pdo->prepare("DELETE FROM $signups WHERE created_at < ?")->execute([time() - 3600]);
$recent = $pdo->prepare("SELECT COUNT(*) AS n FROM $signups WHERE ip_hash = ?");
$recent->execute([$ip]);
if ((int) $recent->fetch()['n'] >= MAX_SIGNUPS_PER_HOUR) respond(429, ['error' => 'too_many_signups']);

$users = table('users');
$exists = $pdo->prepare("SELECT 1 FROM $users WHERE username = ?");
$exists->execute([$username]);
if ($exists->fetch()) respond(400, ['error' => 'username_taken']);

try {
    $pdo->prepare("INSERT INTO $users (username, password_hash, created_at) VALUES (?, ?, ?)")
        ->execute([$username, password_hash($password, PASSWORD_DEFAULT), now_iso()]);
} catch (PDOException $e) {
    respond(400, ['error' => 'username_taken']); // registrazione contemporanea con lo stesso nome
}
$userId = (int) $pdo->lastInsertId();
$pdo->prepare("INSERT INTO $signups (ip_hash, created_at) VALUES (?, ?)")->execute([$ip, time()]);

respond(200, ['token' => create_session($userId), 'username' => $username]);
