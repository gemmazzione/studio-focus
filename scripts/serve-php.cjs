// Prova in locale app + API PHP con un database SQLite in .data/.
// Uso: node scripts/serve-php.cjs [porta]
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
fs.mkdirSync(path.join(root, ".data"), { recursive: true });
const port = process.argv[2] || "5188";
const cfg = path.join(root, ".data", "config.local.php");
fs.writeFileSync(
  cfg,
  "<?php return ['dsn' => 'sqlite:' . __DIR__ . '/studio.sqlite', 'invite' => '', 'prefix' => 'stf_'];\n",
);
const p = spawn("php", ["-d", "extension=pdo_sqlite", "-S", `localhost:${port}`, "-t", "dist"], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, STF_CONFIG: cfg },
});
console.log(`App + API: http://localhost:${port}/`);
p.on("exit", (c) => process.exit(c ?? 0));
