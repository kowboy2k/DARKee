// DARKee – raccourcis clavier et injection sur les sites autorisés en plus de Google et Wikipédia.
importScripts('sites.js');

const OTHER_SCRIPTS = 'dark-google-other-sites';

// Enregistre le script de page pour tous les sites autorisés par l'utilisateur (un site, ou tous).
// Appels mis en file : au réveil et à l'installation, deux enregistrements simultanés se gêneraient
// (« Duplicate script ID »).
let syncing = Promise.resolve();
function syncRegistration() {
  syncing = syncing.then(doSync).catch(() => {});
  return syncing;
}

async function doSync() {
  const { origins = [] } = await chrome.permissions.getAll();
  const extra = origins.filter((o) => !DG.BUILT_IN_MATCHES.includes(o));
  const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [OTHER_SCRIPTS] });
  if (existing.length) await chrome.scripting.unregisterContentScripts({ ids: [OTHER_SCRIPTS] });
  if (!extra.length) return;
  const base = {
    id: OTHER_SCRIPTS,
    matches: extra,
    excludeMatches: DG.BUILT_IN_MATCHES,
    js: ['sites.js', 'recolor.js', 'content.js', 'cookies.js'],
    runAt: 'document_start',
  };
  try {
    // Cadres compris (publicités, bandeaux) : sinon ils restent blancs.
    await chrome.scripting.registerContentScripts([{ ...base, allFrames: true, matchOriginAsFallback: true }]);
  } catch {
    await chrome.scripting.registerContentScripts([base]);
  }
}

// Filet de sécurité : si Chrome n'a pas injecté le script au chargement (enregistrement perdu ou en cours),
// on l'injecte nous-mêmes dès que la page commence à charger, sur les sites autorisés.
chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (info.status !== 'loading' || !/^https?:/.test(tab.url || '')) return;
  const site = DG.siteForUrl(tab.url);
  if (!site?.other) return;
  try {
    if (!(await chrome.permissions.contains({ origins: [new URL(tab.url).origin + '/*'] }))) return;
    await chrome.scripting.executeScript({
      target: { tabId }, files: ['sites.js', 'recolor.js', 'content.js', 'cookies.js'], injectImmediately: true,
    });
  } catch {}
});

chrome.runtime.onInstalled.addListener(syncRegistration);
syncRegistration(); // à chaque réveil : la liste des scripts de page est toujours celle de cette version
chrome.runtime.onStartup.addListener(syncRegistration);
chrome.permissions.onAdded.addListener(syncRegistration);
chrome.permissions.onRemoved.addListener(syncRegistration);

// Le raccourci donne un accès ponctuel à l'onglet (activeTab) : de quoi appliquer le thème tout de suite,
// même sur un site pas encore autorisé.
async function injectNow(tabId) {
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['sites.js', 'recolor.js', 'content.js', 'cookies.js'] });
  } catch {}
}

chrome.commands.onCommand.addListener(async (command, tab) => {
  const { state: raw } = await chrome.storage.local.get('state');
  const state = DG.normalize(raw);
  if (command === 'toggle-all') {
    state.mode = state.mode === 'off' ? state.lastOn : 'off';
  } else if (command === 'toggle-site') {
    tab ||= (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0];
    const site = tab?.url && DG.siteForUrl(tab.url);
    if (!site) return;
    DG.setSiteOn(state, site, !DG.siteOn(state, site));
    if (site.other) await injectNow(tab.id);
  }
  await chrome.storage.local.set({ state });
});

// ---- Icône : off (croissant bleu) · on (croissant jaune) · site (contour jaune : actif et personnalisé ici)
//      · siteoff (contour et croissant bleus : DARKee actif mais coupé sur ce site) ----

const iconPath = (kind) => ({ 16: `icons/${kind}-16.png`, 32: `icons/${kind}-32.png` });

const loadState = async () => DG.normalize((await chrome.storage.local.get('state')).state);

// Icône d'un onglet, d'après les réglages et son adresse (sans attendre la page).
function kindFor(state, url) {
  return DG.iconKind(state, url ? DG.siteForUrl(url) : null);
}

async function refreshTab(tab, state) {
  if (tab?.id == null) return;
  try { await chrome.action.setIcon({ tabId: tab.id, path: iconPath(kindFor(state || (await loadState()), tab.url)) }); } catch {}
}

// Icône par défaut, puis celle de chaque onglet ouvert.
async function refreshAllIcons() {
  const state = await loadState();
  try { await chrome.action.setIcon({ path: iconPath(DG.iconKind(state, null)) }); } catch {}
  for (const tab of await chrome.tabs.query({})) refreshTab(tab, state);
}

chrome.runtime.onInstalled.addListener(refreshAllIcons);
chrome.runtime.onStartup.addListener(refreshAllIcons);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.state) refreshAllIcons();
});
// Chrome remet l'icône par défaut à chaque chargement de page : on la repose.
chrome.tabs.onUpdated.addListener((_id, info, tab) => { if (info.status || info.url) refreshTab(tab); });
chrome.tabs.onActivated.addListener(({ tabId }) => chrome.tabs.get(tabId).then((tab) => refreshTab(tab)).catch(() => {}));

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg?.type === 'dark-google:tab-state' && sender.tab?.id != null && sender.frameId === 0) {
    refreshTab(sender.tab);
    return false;
  }
  if (msg?.type !== 'dark-google:inject') return false;
  injectNow(msg.tabId).then(() => reply(true));
  return true;
});

// Moteur Recolorer : une feuille de style d'un autre domaine (CDN) est illisible depuis la page ; l'extension
// la lit pour elle. Seules les feuilles CSS demandées par nos scripts de page, sans cookies.
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg?.type !== 'dark-google:css' || !sender.tab || !/^https?:/.test(msg.url)) return;
  fetch(msg.url, { credentials: 'omit' })
    .then((r) => (r.ok && /css|text\/plain/.test(r.headers.get('content-type') || 'text/css') ? r.text() : null))
    .then(reply, () => reply(null));
  return true;
});

// Moteur Recolorer : clarté moyenne d'une image de fond (réduite à 24 × 24), pour savoir s'il faut la voiler.
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg?.type !== 'dark-google:img' || !sender.tab || !/^(https?|data):/.test(msg.url)) return;
  (async () => {
    const r = await fetch(msg.url, { credentials: 'omit' });
    if (!r.ok) return null;
    const bitmap = await createImageBitmap(await r.blob());
    const canvas = new OffscreenCanvas(24, 24);
    const c = canvas.getContext('2d');
    c.drawImage(bitmap, 0, 0, 24, 24);
    const d = c.getImageData(0, 0, 24, 24).data;
    let l = 0, a = 0;
    const lums = [];
    for (let i = 0; i < d.length; i += 4) {
      const w = d[i + 3] / 255;
      const y = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
      l += w * y;
      a += w;
      if (w > 0.5) lums.push(y);
    }
    // hi : clarté des zones les plus claires (90e centile), pour une image en partie sombre, en partie éclatante.
    lums.sort((x, y) => x - y);
    const hi = lums.length ? lums[Math.floor(lums.length * 0.9)] : 0;
    return { l: a ? l / a : 0, hi, a: a / 576, w: bitmap.width, h: bitmap.height };
  })().then(reply, () => reply(null));
  return true;
});
