<?php
// GET -> {configured, database, accounts} per controllare la pubblicazione senza credenziali
require __DIR__ . '/_lib.php';

$file = getenv('STF_CONFIG') ?: __DIR__ . '/config.php';
if (!is_file($file)) respond(503, ['configured' => false, 'database' => false]);
$n = (int) db()->query('SELECT COUNT(*) AS n FROM ' . table('users'))->fetch()['n'];
respond(200, ['configured' => true, 'database' => true, 'invite' => invite_code() !== '', 'accounts' => $n]);
