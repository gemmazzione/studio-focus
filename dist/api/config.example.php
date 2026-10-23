<?php
// Esempio di configurazione. Il file reale (config.php) NON va nel repository:
// lo crea la GitHub Action a ogni pubblicazione dai secrets DB_NAME, DB_USER, DB_PASSWORD
// e, facoltativo, INVITE_CODE (vedi README).
// Per un caricamento manuale: copia questo file come config.php e compilalo.
// Le tabelle vengono create automaticamente al primo accesso.

return [
    // AlterVista: host localhost, database my_nomesito
    'dsn' => 'mysql:host=localhost;dbname=my_nomesito;charset=utf8mb4',
    'db_user' => 'nomesito',
    'db_pass' => '',
    // Codice d'invito per creare un account. Vuoto = registrazione libera.
    'invite' => '',
    'prefix' => 'stf_',
];
