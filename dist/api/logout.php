<?php
// POST -> chiude la sessione del token inviato
require __DIR__ . '/_lib.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') respond(405, ['error' => 'method_not_allowed']);

$token = request_token();
if ($token !== '') {
    db()->prepare('DELETE FROM ' . table('sessions') . ' WHERE token_hash = ?')->execute([hash('sha256', $token)]);
}
respond(200, ['ok' => true]);
