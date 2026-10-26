<?php
// Web Push senza librerie: notifiche "vuote" firmate VAPID (ES256).
// Il testo non viaggia nella notifica: il service worker lo scarica da push.php (action inbox)
// con la chiave della propria iscrizione. Così non serve cifrare il contenuto (RFC 8291).
// Le chiavi VAPID si generano da sole la prima volta e restano nel database.

const PUSH_SUBJECT = 'https://samueleruggeri.altervista.org/studiofocus/';

function b64url(string $bin): string
{
    return rtrim(strtr(base64_encode($bin), '+/', '-_'), '=');
}

function push_tables(PDO $pdo): void
{
    static $done = false;
    if ($done) return;
    $done = true;
    $suffix = is_mysql() ? ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4' : '';
    $autoId = is_mysql() ? 'INT AUTO_INCREMENT PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
    $pdo->exec('CREATE TABLE IF NOT EXISTS ' . table('push_keys') . " (id INTEGER PRIMARY KEY, public_key VARCHAR(200) NOT NULL, private_pem TEXT NOT NULL)$suffix");
    // Un'iscrizione per dispositivo: endpoint del browser, utente, preferenze, chiave per leggere i messaggi
    $pdo->exec('CREATE TABLE IF NOT EXISTS ' . table('push_subs') . " (
        id $autoId,
        user_id INTEGER NOT NULL,
        endpoint VARCHAR(600) NOT NULL,
        inbox_key CHAR(64) NOT NULL,
        want_studying INTEGER NOT NULL,
        want_cheers INTEGER NOT NULL,
        created_at BIGINT NOT NULL
    )$suffix");
    $pdo->exec('CREATE TABLE IF NOT EXISTS ' . table('push_inbox') . " (
        id $autoId,
        sub_id INTEGER NOT NULL,
        title VARCHAR(200) NOT NULL,
        body VARCHAR(300) NOT NULL,
        url VARCHAR(100) NOT NULL,
        tag VARCHAR(80) NOT NULL,
        created_at BIGINT NOT NULL
    )$suffix");
    // Ultimo avviso "ha iniziato a studiare" per persona, per non mandarne troppi con pause e riprese
    $pdo->exec('CREATE TABLE IF NOT EXISTS ' . table('push_last') . " (user_id INTEGER PRIMARY KEY, studying_at BIGINT NOT NULL)$suffix");
}

/** [chiave pubblica base64url, chiave privata] — generate la prima volta. */
function vapid_keys(PDO $pdo): array
{
    push_tables($pdo);
    $t = table('push_keys');
    $row = $pdo->query("SELECT public_key, private_pem FROM $t WHERE id = 1")->fetch();
    if (!$row) {
        $key = openssl_pkey_new(['curve_name' => 'prime256v1', 'private_key_type' => OPENSSL_KEYTYPE_EC]);
        if (!$key) respond(500, ['error' => 'push_keys']);
        openssl_pkey_export($key, $pem);
        $ec = openssl_pkey_get_details($key)['ec'];
        $public = b64url("\x04" . str_pad($ec['x'], 32, "\0", STR_PAD_LEFT) . str_pad($ec['y'], 32, "\0", STR_PAD_LEFT));
        $pdo->prepare("INSERT INTO $t (id, public_key, private_pem) VALUES (1, ?, ?)")->execute([$public, $pem]);
        $row = ['public_key' => $public, 'private_pem' => $pem];
    }
    return [$row['public_key'], $row['private_pem']];
}

/** Firma DER (ECDSA) → R||S di 64 byte, come chiede JWT ES256. */
function der_to_raw(string $der): string
{
    $pos = 2;
    if (ord($der[1]) & 0x80) $pos += ord($der[1]) & 0x7f;
    $parts = [];
    for ($i = 0; $i < 2; $i++) {
        $len = ord($der[$pos + 1]);
        $int = ltrim(substr($der, $pos + 2, $len), "\0");
        $parts[] = str_pad($int, 32, "\0", STR_PAD_LEFT);
        $pos += 2 + $len;
    }
    return $parts[0] . $parts[1];
}

function vapid_header(string $endpoint, string $public, string $pem): string
{
    $u = parse_url($endpoint);
    $head = b64url(json_encode(['typ' => 'JWT', 'alg' => 'ES256']));
    $claims = b64url(json_encode(['aud' => $u['scheme'] . '://' . $u['host'], 'exp' => time() + 12 * 3600, 'sub' => PUSH_SUBJECT], JSON_UNESCAPED_SLASHES));
    openssl_sign("$head.$claims", $der, openssl_pkey_get_private($pem), OPENSSL_ALGO_SHA256);
    return "vapid t=$head.$claims." . b64url(der_to_raw($der)) . ", k=$public";
}

/**
 * Mette il messaggio nella casella di ogni dispositivo iscritto degli utenti indicati
 * e manda le notifiche vuote in parallelo. $kind: "studying" oppure "cheers".
 */
function push_notify(PDO $pdo, array $userIds, string $kind, string $title, string $body, string $url, string $tag, int $ttl): void
{
    if (!$userIds) return;
    push_tables($pdo);
    [$public, $pem] = vapid_keys($pdo);
    $S = table('push_subs');
    $I = table('push_inbox');
    $col = $kind === 'cheers' ? 'want_cheers' : 'want_studying';
    $in = implode(',', array_map('intval', $userIds));
    $subs = $pdo->query("SELECT id, endpoint FROM $S WHERE user_id IN ($in) AND $col = 1")->fetchAll();
    if (!$subs) return;
    $now = time() * 1000;
    $pdo->prepare("DELETE FROM $I WHERE created_at < ?")->execute([$now - 86400000]);
    $multi = curl_multi_init();
    $handles = [];
    foreach ($subs as $sub) {
        $pdo->prepare("INSERT INTO $I (sub_id, title, body, url, tag, created_at) VALUES (?, ?, ?, ?, ?, ?)")
            ->execute([(int) $sub['id'], push_cut($title, 200), push_cut($body, 300), $url, $tag, $now]);
        $c = curl_init($sub['endpoint']);
        curl_setopt_array($c, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => '',
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 6,
            CURLOPT_HTTPHEADER => [
                'Authorization: ' . vapid_header($sub['endpoint'], $public, $pem),
                'TTL: ' . $ttl,
                'Urgency: high',
                'Content-Length: 0',
            ],
        ]);
        curl_multi_add_handle($multi, $c);
        $handles[(int) $sub['id']] = $c;
    }
    do {
        $status = curl_multi_exec($multi, $running);
        if ($running) curl_multi_select($multi, 1);
    } while ($running && $status === CURLM_OK);
    foreach ($handles as $id => $c) {
        $code = curl_getinfo($c, CURLINFO_HTTP_CODE);
        // Iscrizione scaduta o revocata dal browser: si cancella
        if ($code === 404 || $code === 410) {
            $pdo->prepare("DELETE FROM $S WHERE id = ?")->execute([$id]);
            $pdo->prepare("DELETE FROM $I WHERE sub_id = ?")->execute([$id]);
        }
        curl_multi_remove_handle($multi, $c);
        curl_close($c);
    }
    curl_multi_close($multi);
}

function push_cut(string $s, int $n): string
{
    return function_exists('mb_substr') ? mb_substr($s, 0, $n) : substr($s, 0, $n);
}
