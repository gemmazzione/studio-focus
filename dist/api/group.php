<?php
// Gruppi di studio dell'utente collegato (header X-Auth-Token).
// Ogni membro vede degli altri solo nome utente, minuti e sessioni della settimana,
// calcolati dai dati già sincronizzati (tabella progress).
// GET  ?week=<inizio settimana in ms> -> {groups: [...]}
// POST {action: "create", name, goalMinutes} | {action: "join", code}
//      {action: "leave", groupId} | {action: "goal", groupId, goalMinutes}
//      {action: "presence", remaining, elapsed} (secondi; remaining 0 = non sto studiando)
require __DIR__ . '/_lib.php';

const MAX_MEMBERS = 20;
const MAX_GROUPS_PER_USER = 10;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // niente 0/O e 1/I

[$userId, $username] = require_user();
$pdo = db();
$suffix = is_mysql() ? ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4' : '';
$autoId = is_mysql() ? 'INT AUTO_INCREMENT PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
$G = table('groups');
$M = table('group_members');
$pdo->exec("CREATE TABLE IF NOT EXISTS $G (
    id $autoId,
    code CHAR(8) NOT NULL UNIQUE,
    name VARCHAR(60) NOT NULL,
    owner_id INTEGER NOT NULL,
    goal_minutes INTEGER NOT NULL,
    created_at VARCHAR(32) NOT NULL
)$suffix");
$pdo->exec("CREATE TABLE IF NOT EXISTS $M (
    group_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    joined_at VARCHAR(32) NOT NULL,
    PRIMARY KEY (group_id, user_id)
)$suffix");
// Chi sta studiando adesso: fine prevista della sessione (ms, ora del server)
$P = table('presence');
$O = table('online');
$pdo->exec("CREATE TABLE IF NOT EXISTS $O (user_id INTEGER PRIMARY KEY, last_seen BIGINT NOT NULL)$suffix");
$pdo->exec("CREATE TABLE IF NOT EXISTS $P (
    user_id INTEGER PRIMARY KEY,
    until_at BIGINT NOT NULL,
    started_at BIGINT NOT NULL
)$suffix");

function clean_name($value): string
{
    $name = is_string($value) ? trim(preg_replace('/\s+/u', ' ', $value)) : '';
    return function_exists('mb_substr') ? mb_substr($name, 0, 60) : substr($name, 0, 60);
}
function goal_minutes($value): int
{
    return is_int($value) && $value >= 0 && $value <= 100000 ? $value : -1;
}
function my_group_count(PDO $pdo, string $M, int $userId): int
{
    $s = $pdo->prepare("SELECT COUNT(*) AS n FROM $M WHERE user_id = ?");
    $s->execute([$userId]);
    return (int) $s->fetch()['n'];
}
function is_member(PDO $pdo, string $M, int $groupId, int $userId): bool
{
    $s = $pdo->prepare("SELECT 1 FROM $M WHERE group_id = ? AND user_id = ?");
    $s->execute([$groupId, $userId]);
    return (bool) $s->fetch();
}

/** Minuti e sessioni di un utente nella settimana [from, from + 7 giorni). */
function week_stats(PDO $pdo, int $userId, float $from): array
{
    static $cache = [];
    if (isset($cache[$userId])) return $cache[$userId];
    $s = $pdo->prepare('SELECT data FROM ' . table('progress') . ' WHERE id = ?');
    $s->execute([$userId]);
    $row = $s->fetch();
    $minutes = 0;
    $sessions = 0;
    $xp = 0;
    $avatar = null;
    if ($row) {
        $doc = json_decode($row['data'], true);
        $all = is_array($doc['data']['sessions'] ?? null) ? $doc['data']['sessions'] : [];
        foreach ($all as $session) {
            $at = $session['at'] ?? 0;
            if (is_numeric($at) && $at >= $from && $at < $from + 7 * 86400000) {
                $sessions++;
                $minutes += (int) round(($session['seconds'] ?? 0) / 60);
            }
        }
        $xp = xp_from($all, $doc['data']['study']['achievements'] ?? []);
        $avatar = avatar_from($doc['data']['study']['avatar'] ?? null);
    }
    return $cache[$userId] = ['minutes' => $minutes, 'sessions' => $sessions, 'xp' => $xp, 'avatar' => $avatar];
}

/** Minuti da cui l'utente sta studiando, oppure null se non è in sessione. */
function studying_for(PDO $pdo, string $P, int $userId): ?int
{
    $s = $pdo->prepare("SELECT until_at, started_at FROM $P WHERE user_id = ?");
    $s->execute([$userId]);
    $row = $s->fetch();
    $now = time() * 1000;
    if (!$row || (int) $row['until_at'] <= $now) return null;
    return max(0, (int) floor(($now - (int) $row['started_at']) / 60000));
}

/** Minuti che mancano alla fine della sessione in corso, oppure null. */
function studying_left(PDO $pdo, string $P, int $userId): ?int
{
    $s = $pdo->prepare("SELECT until_at FROM $P WHERE user_id = ?");
    $s->execute([$userId]);
    $until = (int) ($s->fetch()['until_at'] ?? 0);
    $now = time() * 1000;
    return $until > $now ? (int) ceil(($until - $now) / 60000) : null;
}

/** Online se l'app ha dato segni di vita negli ultimi 3 minuti (api/social.php, action ping). */
function is_online(PDO $pdo, string $O, int $userId): bool
{
    $s = $pdo->prepare("SELECT last_seen FROM $O WHERE user_id = ?");
    $s->execute([$userId]);
    return time() * 1000 - (int) ($s->fetch()['last_seen'] ?? 0) < 180000;
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $week = isset($_GET['week']) && is_numeric($_GET['week']) ? (float) $_GET['week'] : 0;
    $nowMs = time() * 1000;
    if (abs($week - $nowMs) > 14 * 86400000) respond(400, ['error' => 'invalid_week']);
    $s = $pdo->prepare("SELECT g.id, g.code, g.name, g.owner_id, g.goal_minutes FROM $G g JOIN $M m ON m.group_id = g.id WHERE m.user_id = ? ORDER BY g.id");
    $s->execute([$userId]);
    $groups = [];
    foreach ($s->fetchAll() as $g) {
        $ms = $pdo->prepare("SELECT u.id, u.username FROM $M m JOIN " . table('users') . " u ON u.id = m.user_id WHERE m.group_id = ? ORDER BY m.joined_at, u.id");
        $ms->execute([(int) $g['id']]);
        $members = [];
        foreach ($ms->fetchAll() as $u) {
            $members[] = ['username' => $u['username'], 'isMe' => (int) $u['id'] === $userId, 'isOwner' => (int) $u['id'] === (int) $g['owner_id']]
                + week_stats($pdo, (int) $u['id'], $week) + ['studyingFor' => studying_for($pdo, $P, (int) $u['id']), 'studyingLeft' => studying_left($pdo, $P, (int) $u['id']), 'online' => is_online($pdo, $O, (int) $u['id'])];
        }
        $groups[] = [
            'id' => (int) $g['id'],
            'name' => $g['name'],
            'code' => $g['code'],
            'goalMinutes' => (int) $g['goal_minutes'],
            'isOwner' => (int) $g['owner_id'] === $userId,
            'members' => $members,
        ];
    }
    respond(200, ['groups' => $groups]);
}

if ($method !== 'POST') respond(405, ['error' => 'method_not_allowed']);
$body = read_json_body(true);
$action = $body['action'] ?? '';

if ($action === 'create') {
    $name = clean_name($body['name'] ?? '');
    $goal = goal_minutes($body['goalMinutes'] ?? null);
    if ($name === '') respond(400, ['error' => 'name_missing']);
    if ($goal < 0) respond(400, ['error' => 'goal_invalid']);
    if (my_group_count($pdo, $M, $userId) >= MAX_GROUPS_PER_USER) respond(400, ['error' => 'too_many_groups']);
    for ($try = 0; $try < 5; $try++) {
        $code = '';
        for ($i = 0; $i < 8; $i++) $code .= CODE_CHARS[random_int(0, strlen(CODE_CHARS) - 1)];
        try {
            $pdo->beginTransaction();
            $pdo->prepare("INSERT INTO $G (code, name, owner_id, goal_minutes, created_at) VALUES (?, ?, ?, ?, ?)")
                ->execute([$code, $name, $userId, $goal, now_iso()]);
            $groupId = (int) $pdo->lastInsertId();
            $pdo->prepare("INSERT INTO $M (group_id, user_id, joined_at) VALUES (?, ?, ?)")->execute([$groupId, $userId, now_iso()]);
            $pdo->commit();
            respond(200, ['id' => $groupId, 'code' => $code]);
        } catch (PDOException $e) {
            if ($pdo->inTransaction()) $pdo->rollBack(); // codice già usato: riprova
        }
    }
    respond(500, ['error' => 'db_write']);
}

if ($action === 'join') {
    $code = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', (string) ($body['code'] ?? '')));
    $s = $pdo->prepare("SELECT id FROM $G WHERE code = ?");
    $s->execute([$code]);
    $group = $s->fetch();
    if (!$group) {
        sleep(1); // rallenta chi prova codici a caso
        respond(404, ['error' => 'group_not_found']);
    }
    $groupId = (int) $group['id'];
    if (is_member($pdo, $M, $groupId, $userId)) respond(200, ['id' => $groupId, 'already' => true]);
    if (my_group_count($pdo, $M, $userId) >= MAX_GROUPS_PER_USER) respond(400, ['error' => 'too_many_groups']);
    $n = $pdo->prepare("SELECT COUNT(*) AS n FROM $M WHERE group_id = ?");
    $n->execute([$groupId]);
    if ((int) $n->fetch()['n'] >= MAX_MEMBERS) respond(400, ['error' => 'group_full']);
    $pdo->prepare("INSERT INTO $M (group_id, user_id, joined_at) VALUES (?, ?, ?)")->execute([$groupId, $userId, now_iso()]);
    respond(200, ['id' => $groupId]);
}

if ($action === 'presence') {
    $remaining = $body['remaining'] ?? null;
    $elapsed = $body['elapsed'] ?? 0;
    if (!is_int($remaining) || $remaining < 0 || $remaining > 6 * 3600 || !is_int($elapsed) || $elapsed < 0 || $elapsed > 6 * 3600)
        respond(400, ['error' => 'invalid_presence']);
    $pdo->prepare("DELETE FROM $P WHERE user_id = ?")->execute([$userId]);
    if ($remaining > 0) {
        $now = time() * 1000;
        $pdo->prepare("INSERT INTO $P (user_id, until_at, started_at) VALUES (?, ?, ?)")
            ->execute([$userId, $now + $remaining * 1000, $now - $elapsed * 1000]);
    }
    respond(200, ['ok' => true]);
}

$groupId = isset($body['groupId']) && is_int($body['groupId']) ? $body['groupId'] : 0;
if (!is_member($pdo, $M, $groupId, $userId)) respond(404, ['error' => 'group_not_found']);

if ($action === 'goal') {
    $goal = goal_minutes($body['goalMinutes'] ?? null);
    if ($goal < 0) respond(400, ['error' => 'goal_invalid']);
    $s = $pdo->prepare("UPDATE $G SET goal_minutes = ? WHERE id = ? AND owner_id = ?");
    $s->execute([$goal, $groupId, $userId]);
    if ($s->rowCount() === 0) respond(403, ['error' => 'not_owner']);
    respond(200, ['ok' => true]);
}

if ($action === 'leave') {
    $pdo->beginTransaction();
    $pdo->prepare("DELETE FROM $M WHERE group_id = ? AND user_id = ?")->execute([$groupId, $userId]);
    $next = $pdo->prepare("SELECT user_id FROM $M WHERE group_id = ? ORDER BY joined_at, user_id LIMIT 1");
    $next->execute([$groupId]);
    $heir = $next->fetch();
    if (!$heir) {
        $pdo->prepare("DELETE FROM $G WHERE id = ?")->execute([$groupId]); // ultimo membro: il gruppo sparisce
    } else {
        // Se esce chi l'ha creato, il gruppo passa al membro più vecchio
        $pdo->prepare("UPDATE $G SET owner_id = ? WHERE id = ? AND owner_id = ?")->execute([(int) $heir['user_id'], $groupId, $userId]);
    }
    $pdo->commit();
    respond(200, ['ok' => true]);
}

respond(400, ['error' => 'unknown_action']);
