// Genera extension/rules/adult.json (siti per adulti e SafeSearch obbligatoria)
// ed extension/rules/ads.json (pubblicità di YouTube).
// Per aggiungere un sito: mettilo in DOMAINS e lancia `npm run rules`, poi `npm run package:source`.
const fs = require("fs");
const path = require("path");

// Siti per adulti molto diffusi. requestDomains copre anche i sottodomini.
const DOMAINS = `
pornhub.com pornhub.org pornhubpremium.com xvideos.com xvideos2.com xvideos.red xnxx.com xnxx.tv
xhamster.com xhamster.desi xhamster2.com xhamster3.com xhamsterlive.com redtube.com youporn.com tube8.com
spankbang.com eporner.com tnaflix.com empflix.com beeg.com porn.com pornhd.com txxx.com hclips.com
hdzog.com upornia.com porntrex.com youjizz.com motherless.com sunporno.com drtuber.com nuvid.com
xtube.com keezmovies.com extremetube.com spankwire.com thumbzilla.com pornerbros.com ixxx.com fuq.com
porndig.com analdin.com hqporner.com daftsex.com porngo.com pornpics.com imagefap.com pornoxo.com
perfectgirls.net eroprofile.com heavy-r.com efukt.com 4tube.com porn300.com pornone.com pornhat.com
xxxbunker.com porntube.com fux.com pornxp.com tubegalore.com porndoe.com gotporn.com vporn.com
chaturbate.com stripchat.com bongacams.com livejasmin.com cam4.com camsoda.com myfreecams.com
flirt4free.com imlive.com xlovecam.com onlyfans.com fansly.com manyvids.com clips4sale.com
brazzers.com realitykings.com bangbros.com naughtyamerica.com mofos.com digitalplayground.com
vixen.com tushy.com blacked.com kink.com evilangel.com teamskeet.com nubiles.net
nhentai.net hanime.tv e-hentai.org exhentai.org hentai2read.com gelbooru.com rule34.paheal.net
redgifs.com erome.com fapello.com coomer.su kemono.su sex.com literotica.com adultfriendfinder.com
missav.com missav.ws jable.tv javlibrary.com javhd.com 91porn.com
`
  .split(/\s+/)
  .filter(Boolean);

const BLOCKED_TYPES = ["main_frame", "sub_frame", "media", "image", "xmlhttprequest"];
const rules = [
  {
    id: 1,
    priority: 2,
    action: { type: "block" },
    condition: { requestDomains: [...new Set(DOMAINS)], resourceTypes: BLOCKED_TYPES },
  },
  // Domini con estensione per adulti (.xxx, .porn, .sex, .adult)
  {
    id: 2,
    priority: 2,
    action: { type: "block" },
    condition: {
      regexFilter: "^https?://[^/]+\\.(xxx|porn|sex|adult)(:[0-9]+)?(/|$)",
      resourceTypes: ["main_frame", "sub_frame"],
    },
  },
  // Indirizzi con "porn" o "hentai" nel nome del sito
  {
    id: 3,
    priority: 2,
    action: { type: "block" },
    condition: {
      regexFilter: "^https?://[^/]*(porn|hentai)[^/]*(/|$)",
      resourceTypes: ["main_frame", "sub_frame"],
    },
  },
  // SafeSearch: Chrome ignora il reindirizzamento quando l'indirizzo è già uguale, quindi niente cicli
  {
    id: 10,
    priority: 1,
    action: { type: "redirect", redirect: { transform: { queryTransform: { addOrReplaceParams: [{ key: "safe", value: "active" }] } } } },
    condition: { regexFilter: "^https://(www\\.)?google\\.[a-z.]+/(search|images)", resourceTypes: ["main_frame", "sub_frame"] },
  },
  {
    id: 11,
    priority: 1,
    action: { type: "redirect", redirect: { transform: { queryTransform: { addOrReplaceParams: [{ key: "adlt", value: "strict" }] } } } },
    condition: { regexFilter: "^https://(www\\.)?bing\\.com/(search|images|videos)", resourceTypes: ["main_frame", "sub_frame"] },
  },
  {
    id: 12,
    priority: 1,
    action: { type: "redirect", redirect: { transform: { queryTransform: { addOrReplaceParams: [{ key: "kp", value: "1" }] } } } },
    condition: { regexFilter: "^https://(html\\.|lite\\.)?duckduckgo\\.com/", resourceTypes: ["main_frame", "sub_frame"] },
  },
  // YouTube in modalità con restrizioni
  {
    id: 13,
    priority: 1,
    action: { type: "modifyHeaders", requestHeaders: [{ header: "YouTube-Restrict", operation: "set", value: "Moderate" }] },
    condition: {
      requestDomains: ["youtube.com", "youtube-nocookie.com", "youtubei.googleapis.com"],
      resourceTypes: ["main_frame", "sub_frame", "xmlhttprequest"],
    },
  },
];

const out = path.join(__dirname, "..", "extension", "rules");
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, "adult.json"), JSON.stringify(rules, null, 2) + "\n");
console.log(`extension/rules/adult.json: ${DOMAINS.length} siti, ${rules.length} regole`);

// Pubblicità di YouTube: solo richieste partite da YouTube, per non rompere altri siti.
// Gli annunci dentro il video si tolgono con youtube-main.js e youtube-skip.js.
const YT = ["youtube.com", "youtube-nocookie.com"];
const ads = [
  {
    id: 1,
    priority: 1,
    action: { type: "block" },
    condition: {
      requestDomains: ["doubleclick.net", "googleadservices.com", "googlesyndication.com", "googletagservices.com", "adservice.google.com", "imasdk.googleapis.com"],
      initiatorDomains: YT,
    },
  },
  ...["||youtube.com/pagead/", "||youtube.com/api/stats/ads", "||youtube.com/get_midroll_", "||youtube.com/youtubei/v1/log_event?*adunit"].map((urlFilter, i) => ({
    id: 2 + i,
    priority: 1,
    action: { type: "block" },
    condition: { urlFilter, resourceTypes: ["xmlhttprequest", "image", "script", "sub_frame", "ping", "other"] },
  })),
];
fs.writeFileSync(path.join(out, "ads.json"), JSON.stringify(ads, null, 2) + "\n");
console.log(`extension/rules/ads.json: ${ads.length} regole`);
module.exports = { DOMAINS };
