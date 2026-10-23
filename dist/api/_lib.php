<?php
// Funzioni comuni dell'API. Compatibile con PHP 7.4+ e con MySQL (AlterVista) o SQLite (test locali).
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

const MAX_BODY_BYTES = 8 * 1024 * 1024;
const KEEP_VERSIONS = 20;
const MAX_SIGNUPS_PER_HOUR = 5;

function respond(int $status, $body): void
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
    exit;
}

function config(): array
{
    static $cfg = null;
    if ($cfg === null) {
        $file = getenv('STF_CONFIG') ?: __DIR__ . '/config.php';
        if (!is_file($file)) respond(503, ['error' => 'config_missing']);
        $cfg = require $file;
        if (!is_array($cfg) || empty($cfg['dsn'])) respond(500, ['error' => 'config_invalid']);
    }
    return $cfg;
}

/** Codice d'invito: se vuoto la registrazione è libera. */
function invite_code(): string
{
    return (string) (config()['invite'] ?? '');
}

function table(string $name): string
{
    $prefix = config()['prefix'] ?? 'stf_';
    return preg_replace('/[^a-zA-Z0-9_]/', '', $prefix . $name);
}

function is_mysql(): bool
{
    return stripos(config()['dsn'], 'mysql:') === 0;
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo !== null) return $pdo;
    $c = config();
    try {
        $pdo = new PDO($c['dsn'], $c['db_user'] ?? null, $c['db_pass'] ?? null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
    } catch (PDOException $e) {
        respond(500, ['error' => 'db_connection']);
    }

    $suffix = is_mysql() ? ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4' : '';
    $autoId = is_mysql() ? 'INT AUTO_INCREMENT PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';

    $pdo->exec('CREATE TABLE IF NOT EXISTS ' . table('users') . " (
        id $autoId,
        username VARCHAR(40) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        created_at VARCHAR(32) NOT NULL
    )$suffix");
    // Sessioni: nel database c'è solo l'hash del token, il token vero resta sul dispositivo
    $pdo->exec('CREATE TABLE IF NOT EXISTS ' . table('sessions') . " (
        token_hash CHAR(64) PRIMARY KEY,
        user_id INTEGER NOT NULL,
        created_at VARCHAR(32) NOT NULL
    )$suffix");
    // Un documento JSON con tutti i dati di studio per utente (id = id dell'utente)
    $pdo->exec('CREATE TABLE IF NOT EXISTS ' . table('progress') . " (
        id INTEGER PRIMARY KEY,
        revision INTEGER NOT NULL,
        data LONGTEXT NOT NULL,
        updated_at VARCHAR(32) NOT NULL
    )$suffix");
    // Ultime versioni di ogni utente, per recuperare progressi sovrascritti per errore
    $pdo->exec('CREATE TABLE IF NOT EXISTS ' . table('backups') . " (
        id $autoId,
        user_id INTEGER NOT NULL,
        revision INTEGER NOT NULL,
        data LONGTEXT NOT NULL,
        created_at VARCHAR(32) NOT NULL
    )$suffix");
    // Registrazioni recenti per indirizzo (solo hash), contro la creazione di account in massa
    $pdo->exec('CREATE TABLE IF NOT EXISTS ' . table('signups') . " (
        id $autoId,
        ip_hash CHAR(64) NOT NULL,
        created_at INTEGER NOT NULL
    )$suffix");
    return $pdo;
}

function create_session(int $userId): string
{
    $token = bin2hex(random_bytes(32));
    db()->prepare('INSERT INTO ' . table('sessions') . ' (token_hash, user_id, created_at) VALUES (?, ?, ?)')
        ->execute([hash('sha256', $token), $userId, now_iso()]);
    return $token;
}

function request_token(): string
{
    $given = $_SERVER['HTTP_X_AUTH_TOKEN'] ?? '';
    return is_string($given) && preg_match('/^[a-f0-9]{64}$/', $given) ? $given : '';
}

/** Restituisce [id, username] dell'utente collegato, oppure risponde 401. */
function require_user(): array
{
    $token = request_token();
    if ($token === '') respond(401, ['error' => 'unauthorized']);
    $stmt = db()->prepare('SELECT u.id, u.username FROM ' . table('sessions') . ' s JOIN ' . table('users') . ' u ON u.id = s.user_id WHERE s.token_hash = ?');
    $stmt->execute([hash('sha256', $token)]);
    $row = $stmt->fetch();
    if (!$row) respond(401, ['error' => 'unauthorized']);
    return [(int) $row['id'], $row['username']];
}

function normalize_username($value): string
{
    return is_string($value) ? strtolower(trim($value)) : '';
}

function client_ip_hash(): string
{
    return hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . '|stf');
}

/** @return mixed */
function read_json_body(bool $assoc)
{
    $raw = file_get_contents('php://input', false, null, 0, MAX_BODY_BYTES + 1);
    if ($raw === false || strlen($raw) > MAX_BODY_BYTES) respond(413, ['error' => 'too_large']);
    $body = json_decode($raw, $assoc);
    if ($body === null) respond(400, ['error' => 'invalid_json']);
    return $body;
}

function now_iso(): string
{
    return gmdate('Y-m-d\TH:i:s\Z');
}

/** Punti esperienza come in StudyCore.xpFor: 1 per minuto, 10 per sessione, 50 per traguardo. */
function xp_from(array $sessions, $achievements): int
{
    $xp = 0;
    foreach ($sessions as $s) {
        if (!is_array($s)) continue;
        $xp += (int) round(((float) ($s['seconds'] ?? 0)) / 60) + 10;
    }
    return $xp + (is_array($achievements) ? count($achievements) * 50 : 0);
}

/** Avatar (solo numeri piccoli) dal documento salvato, o null se non ce n'è uno. */
function avatar_from($avatar): ?array
{
    if (!is_array($avatar)) return null;
    $out = [];
    foreach (['bg', 'skin', 'hair', 'hairColor', 'eyes', 'mouth', 'extra'] as $k) {
        $v = $avatar[$k] ?? 0;
        $out[$k] = is_int($v) && $v >= 0 && $v < 20 ? $v : 0;
    }
    return $out;
}
