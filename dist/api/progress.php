<?php
// Dati di studio dell'utente collegato (backup studio.backup v4) (header X-Auth-Token).
// GET  -> {username, revision, data, updatedAt}
// POST {baseRevision, data} -> {revision, updatedAt}
//      409 {revision, data, updatedAt} se nel frattempo un altro dispositivo ha salvato
require __DIR__ . '/_lib.php';

[$userId, $username] = require_user();
$pdo = db();
$t = table('progress');

function current_row(PDO $pdo, string $t, int $userId, bool $lock): ?array
{
    $stmt = $pdo->prepare("SELECT revision, data, updated_at FROM $t WHERE id = ?" . ($lock && is_mysql() ? ' FOR UPDATE' : ''));
    $stmt->execute([$userId]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function row_payload(?array $row): array
{
    return [
        'revision' => $row ? (int) $row['revision'] : 0,
        'data' => $row ? json_decode($row['data']) : null,
        'updatedAt' => $row ? $row['updated_at'] : null,
    ];
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    respond(200, ['username' => $username] + row_payload(current_row($pdo, $t, $userId, false)));
}

if ($method !== 'POST') respond(405, ['error' => 'method_not_allowed']);

// Decodifica come oggetti per non trasformare {} in [] al salvataggio
$body = read_json_body(false);
if (!is_object($body) || !isset($body->baseRevision) || !is_int($body->baseRevision)
    || !isset($body->data) || !is_object($body->data) || ($body->data->format ?? '') !== 'studio.backup'
    || !isset($body->data->data) || !is_object($body->data->data) || !isset($body->data->data->sessions) || !is_array($body->data->data->sessions)) {
    respond(400, ['error' => 'invalid_data']);
}

$pdo->beginTransaction();
try {
    $row = current_row($pdo, $t, $userId, true);
    $current = $row ? (int) $row['revision'] : 0;
    if ($body->baseRevision !== $current) {
        $pdo->rollBack();
        respond(409, row_payload($row));
    }

    $json = json_encode($body->data, JSON_UNESCAPED_UNICODE);
    $revision = $current + 1;
    $now = now_iso();

    if ($row) {
        $stmt = $pdo->prepare("UPDATE $t SET revision = ?, data = ?, updated_at = ? WHERE id = ?");
    } else {
        $stmt = $pdo->prepare("INSERT INTO $t (revision, data, updated_at, id) VALUES (?, ?, ?, ?)");
    }
    $stmt->execute([$revision, $json, $now, $userId]);

    // Una copia ogni 10 revisioni basta per recuperare i dati senza riempire il database
    if ($revision % 10 === 1) {
        $b = table('backups');
        $pdo->prepare("INSERT INTO $b (user_id, revision, data, created_at) VALUES (?, ?, ?, ?)")
            ->execute([$userId, $revision, $json, $now]);
        $pdo->prepare("DELETE FROM $b WHERE user_id = ? AND id NOT IN (
            SELECT id FROM (SELECT id FROM $b WHERE user_id = ? ORDER BY id DESC LIMIT " . KEEP_VERSIONS . ") keep_rows)")
            ->execute([$userId, $userId]);
    }

    $pdo->commit();
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    respond(500, ['error' => 'db_write']);
}

respond(200, ['revision' => $revision, 'updatedAt' => $now]);
