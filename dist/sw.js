// Service worker: app usabile offline e promemoria dei ripassi.
// Strategia "prima la rete": online si ricevono sempre i file aggiornati,
// offline si usa l'ultima copia salvata. L'API (api/) non passa mai dalla cache.
const CACHE = "studio-v10";
const SHELL = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "style.css",
  "premium.css",
  "features.css",
  "agenda.css",
  "sync.css",
  "goals.css",
  "pwa.css",
  "extras.css",
  "study-core.js",
  "app.js",
  "experience.js",
  "features.js",
  "agenda-core.js",
  "agenda.js",
  "goals.js",
  "extras.js",
  "group.js",
  "lobby.js",
  "sync.js",
  "pwa.js",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/favicon.svg",
];
// Stato del promemoria scritto dalla pagina (vedi pwa.js): {enabled, time, dues, lastShown}.
// Sta in una cache a parte, che non viene cancellata quando cambia la versione.
const REMINDER_CACHE = "studio-reminder";
const REMINDER = "reminder-state.json";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k.startsWith("studio-v") && k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === location.origin;
  if (sameOrigin && (url.pathname.includes("/api/") || url.pathname.endsWith(".zip"))) return;
  const fonts = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (!sameOrigin && !fonts) return;
  // no-cache: chiede sempre al server se il file è cambiato, invece di usare la cache HTTP
  event.respondWith(
    fetch(req, sameOrigin ? { cache: "no-cache" } : {})
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches
          .match(req, { ignoreSearch: true })
          .then((hit) => hit || (req.mode === "navigate" ? caches.match("index.html") : Response.error())),
      ),
  );
});

// --- Promemoria ---------------------------------------------------------
async function readReminder() {
  const res = await (await caches.open(REMINDER_CACHE)).match(REMINDER);
  return res ? res.json() : null;
}
async function writeReminder(state) {
  const cache = await caches.open(REMINDER_CACHE);
  await cache.put(REMINDER, new Response(JSON.stringify(state), { headers: { "Content-Type": "application/json" } }));
}
const localDay = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Mostra la notifica se è passata l'ora scelta, ci sono ripassi scaduti e oggi non è già stata mostrata
async function maybeNotify() {
  const s = await readReminder();
  if (!s || !s.enabled || Notification.permission !== "granted") return false;
  const now = new Date(),
    [h, m] = s.time.split(":").map(Number),
    today = localDay(now);
  if (s.lastShown === today || now.getHours() * 60 + now.getMinutes() < h * 60 + m) return false;
  const due = (s.dues || []).filter((t) => t <= now.getTime()).length;
  // Obiettivo settimanale: da giovedì, sotto la quota prevista fino a oggi
  const w = s.weekly || {},
    weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const day = (now.getDay() + 6) % 7,
    doneMinutes = w.weekStart === weekStart.getTime() ? w.done || 0 : 0,
    expected = Math.round(((w.target || 0) * (day + 1)) / 7),
    late = w.target > 0 && day >= 3 && doneMinutes < expected;
  if (!due && !late) return false;
  s.lastShown = today;
  await writeReminder(s);
  const parts = [];
  if (due) parts.push(due === 1 ? "Hai 1 ripasso in scadenza." : `Hai ${due} ripassi in scadenza.`);
  if (late) parts.push(`Questa settimana: ${doneMinutes} di ${w.target} minuti. Una sessione oggi ti rimette in pari.`);
  await self.registration.showNotification(due ? "Ripassi da fare" : "Obiettivo della settimana", {
    body: parts.join(" "),
    icon: "icons/icon-192.png",
    badge: "icons/icon-192.png",
    tag: "studio-reminder",
    data: { url: "./#focus" },
  });
  return true;
}

// Chrome/Edge con l'app installata: controllo periodico deciso dal browser (non a orario preciso)
self.addEventListener("periodicsync", (event) => {
  if (event.tag === "studio-reminder") event.waitUntil(maybeNotify());
});
// La pagina aperta chiede un controllo ogni minuto
self.addEventListener("message", (event) => {
  if (event.data === "check-reminder") event.waitUntil(maybeNotify());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "./", self.registration.scope).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => c.url.startsWith(self.registration.scope));
      if (open) {
        open.navigate(target);
        return open.focus();
      }
      return self.clients.openWindow(target);
    }),
  );
});
