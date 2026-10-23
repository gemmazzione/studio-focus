<?php
// Lobby e profili (header X-Auth-Token).
// Un utente è visibile agli altri se è entrato nella lobby (profilo pubblico)
// oppure se condivide con loro un gruppo di studio. Risposte e correzioni non escono mai.
// GET  ?action=lobby&week=<inizio settimana ms>  -> {public, publicCount, users: [...]}
// GET  ?action=profile&user=<nome>               -> {username, since, online, studyingFor, sessions, achievements}
// POST {action: "ping", remaining, elapsed}      -> sono online (e sto studiando se remaining > 0)
// POST {action: "visibility", public: true|false}
require __DIR__ . '/_lib.php';

const ONLINE_MS = 180000;      // online se l'app ha dato segni di vita negli ultimi 3 minuti
const PROFILE_SESSIONS = 3000; // sessioni più recenti mandate nel profilo

[$userId, $username] = require_user();
$pdo = db();
$suffix = is_mysql() ? ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4' : '';
$O = table('online');
$P = table('presence');
$V = table('profiles');
$M = table('group_members');
$U = table('users');
$pdo->exec("CREATE TABLE IF NOT EXISTS $O (user_id INTEGER PRIMARY KEY, last_seen BIGINT NOT NULL)$suffix");
$pdo->exec("CREATE TABLE IF NOT EXISTS $P (user_id INTEGER PRIMARY KEY, until_at BIGINT NOT NULL, started_at BIGINT NOT NULL)$suffix");
$pdo->exec("CREATE TABLE IF NOT EXISTS $V (user_id INTEGER PRIMARY KEY, is_public INTEGER NOT NULL)$suffix");
$pdo->exec("CREATE TABLE IF NOT EXISTS $M (group_id INTEGER NOT NULL, user_id INTEGER NOT NULL, joined_at VARCHAR(32) NOT NULL, PRIMARY KEY (group_id, user_id))$suffix");

$now = time() * 1000;

function is_public(PDO $pdo, string $V, int $id): bool
{
    $s = $pdo->prepare("SELECT is_public FROM $V WHERE user_id = ?");
    $s->execute([$id]);
    return (bool) ($s->fetch()['is_public'] ?? false);
}
/** ID degli utenti che posso vedere: pubblici, compagni di gruppo e me stesso. */
function visible_ids(PDO $pdo, string $V, string $M, int $me): array
{
    $ids = [$me => true];
    foreach ($pdo->query("SELECT user_id FROM $V WHERE is_public = 1")->fetchAll() as $r) $ids[(int) $r['user_id']] = true;
    $s = $pdo->prepare("SELECT DISTINCT b.user_id FROM $M a JOIN $M b ON a.group_id = b.group_id WHERE a.user_id = ?");
    $s->execute([$me]);
    foreach ($s->fetchAll() as $r) $ids[(int) $r['user_id']] = true;
    return $ids;
}
function status_of(PDO $pdo, string $O, string $P, int $id, int $now): array
{
    $s = $pdo->prepare("SELECT last_seen FROM $O WHERE user_id = ?");
    $s->execute([$id]);
    $seen = (int) ($s->fetch()['last_seen'] ?? 0);
    $s = $pdo->prepare("SELECT until_at, started_at FROM $P WHERE user_id = ?");
    $s->execute([$id]);
    $p = $s->fetch();
    $studying = $p && (int) $p['until_at'] > $now ? max(0, (int) floor(($now - (int) $p['started_at']) / 60000)) : null;
    return ['online' => $studying !== null || $now - $seen < ONLINE_MS, 'studyingFor' => $studying, 'lastSeen' => $seen ?: null];
}
function sessions_of(PDO $pdo, int $id): array
{
    $s = $pdo->prepare('SELECT data FROM ' . table('progress') . ' WHERE id = ?');
    $s->execute([$id]);
    $row = $s->fetch();
    $doc = $row ? json_decode($row['data'], true) : null;
    return [is_array($doc['data']['sessions'] ?? null) ? $doc['data']['sessions'] : [], $doc['data']['study']['achievements'] ?? []];
}

$method = $_SERVER['REQUEST_METHOD'];
$action = $method === 'GET' ? ($_GET['action'] ?? '') : '';

if ($method === 'GET' && $action === 'lobby') {
    $week = isset($_GET['week']) && is_numeric($_GET['week']) ? (float) $_GET['week'] : 0;
    if (abs($week - $now) > 14 * 86400000) respond(400, ['error' => 'invalid_week']);
    $visible = visible_ids($pdo, $V, $M, $userId);
    $users = [];
    $s = $pdo->prepare("SELECT id, username FROM $U WHERE id = ?");
    foreach (array_keys($visible) as $id) {
        $st = status_of($pdo, $O, $P, $id, $now);
        if (!$st['online'] && $id !== $userId) continue;
        $s->execute([$id]);
        $u = $s->fetch();
        if (!$u) continue;
        [$sessions] = sessions_of($pdo, $id);
        $minutes = 0;
        foreach ($sessions as $x)
            if (is_numeric($x['at'] ?? null) && $x['at'] >= $week && $x['at'] < $week + 7 * 86400000)
                $minutes += (int) round(($x['seconds'] ?? 0) / 60);
        $users[] = ['username' => $u['username'], 'isMe' => $id === $userId, 'weekMinutes' => $minutes] + $st;
    }
    $count = (int) $pdo->query("SELECT COUNT(*) AS n FROM $V WHERE is_public = 1")->fetch()['n'];
    respond(200, ['public' => is_public($pdo, $V, $userId), 'publicCount' => $count, 'users' => $users]);
}

if ($method === 'GET' && $action === 'profile') {
    $name = normalize_username($_GET['user'] ?? '');
    $s = $pdo->prepare("SELECT id, username, created_at FROM $U WHERE username = ?");
    $s->execute([$name]);
    $u = $s->fetch();
    $visible = visible_ids($pdo, $V, $M, $userId);
    if (!$u || !isset($visible[(int) $u['id']])) respond(404, ['error' => 'profile_not_found']);
    $id = (int) $u['id'];
    [$sessions, $achievements] = sessions_of($pdo, $id);
    usort($sessions, fn($a, $b) => ($b['at'] ?? 0) <=> ($a['at'] ?? 0));
    $list = [];
    foreach (array_slice($sessions, 0, PROFILE_SESSIONS) as $x) {
        if (!is_numeric($x['at'] ?? null)) continue;
        // Solo quando, quanto e cosa: mai risposte, correzioni o valutazioni
        $list[] = [
            'at' => (float) $x['at'],
            'minutes' => (int) round(($x['seconds'] ?? 0) / 60),
            'subject' => (string) ($x['subject'] ?? ''),
            'goal' => (string) ($x['goal'] ?? ''),
        ];
    }
    $got = [];
    if (is_array($achievements))
        foreach ($achievements as $key => $at)
            if (is_string($key) && is_numeric($at)) $got[$key] = (float) $at;
    respond(200, [
        'username' => $u['username'],
        'isMe' => $id === $userId,
        'public' => is_public($pdo, $V, $id),
        'since' => $u['created_at'],
        'sessions' => $list,
        'achievements' => (object) $got,
    ] + status_of($pdo, $O, $P, $id, $now));
}

if ($method !== 'POST') respond(400, ['error' => 'unknown_action']);
$body = read_json_body(true);
$action = $body['action'] ?? '';

if ($action === 'ping') {
    $remaining = $body['remaining'] ?? 0;
    $elapsed = $body['elapsed'] ?? 0;
    if (!is_int($remaining) || $remaining < 0 || $remaining > 6 * 3600 || !is_int($elapsed) || $elapsed < 0 || $elapsed > 6 * 3600)
        respond(400, ['error' => 'invalid_presence']);
    $pdo->prepare("DELETE FROM $O WHERE user_id = ?")->execute([$userId]);
    $pdo->prepare("INSERT INTO $O (user_id, last_seen) VALUES (?, ?)")->execute([$userId, $now]);
    $pdo->prepare("DELETE FROM $P WHERE user_id = ?")->execute([$userId]);
    if ($remaining > 0)
        $pdo->prepare("INSERT INTO $P (user_id, until_at, started_at) VALUES (?, ?, ?)")
            ->execute([$userId, $now + $remaining * 1000, $now - $elapsed * 1000]);
    respond(200, ['ok' => true]);
}

if ($action === 'visibility') {
    if (!is_bool($body['public'] ?? null)) respond(400, ['error' => 'invalid_visibility']);
    $pdo->prepare("DELETE FROM $V WHERE user_id = ?")->execute([$userId]);
    $pdo->prepare("INSERT INTO $V (user_id, is_public) VALUES (?, ?)")->execute([$userId, $body['public'] ? 1 : 0]);
    respond(200, ['public' => $body['public']]);
}

respond(400, ['error' => 'unknown_action']);
