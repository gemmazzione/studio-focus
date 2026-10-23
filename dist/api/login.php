<?php
// POST {username, password} -> {token, username}
require __DIR__ . '/_lib.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') respond(405, ['error' => 'method_not_allowed']);

$body = read_json_body(true);
$username = normalize_username($body['username'] ?? '');
$password = is_string($body['password'] ?? null) ? $body['password'] : '';

$stmt = db()->prepare('SELECT id, password_hash FROM ' . table('users') . ' WHERE username = ?');
$stmt->execute([$username]);
$user = $stmt->fetch();

if (!$user || !password_verify($password, $user['password_hash'])) {
    sleep(1); // rallenta i tentativi a forza bruta
    respond(401, ['error' => 'wrong_credentials']);
}

respond(200, ['token' => create_session((int) $user['id']), 'username' => $username]);
