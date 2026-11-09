// DARKee – fenêtre de réglages.
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

const SLIDERS = [
  { key: 'brightness', label: 'Luminosité', min: 50, max: 150, step: 5, unit: ' %' },
  { key: 'contrast', label: 'Contraste', min: 50, max: 150, step: 5, unit: ' %' },
  { key: 'saturation', label: 'Saturation', title: 'Saturation des couleurs', min: 0, max: 200, step: 10, unit: ' %' },
  { key: 'hue', label: 'Teinte', title: 'Teinte des accents', min: -180, max: 180, step: 10, unit: '°' },
  { key: 'temperature', label: 'Température', title: 'Température : froid ← → chaud', min: -100, max: 100, step: 10, unit: '' },
  { key: 'images', label: 'Lum. images', title: 'Luminosité des images', min: 30, max: 100, step: 5, unit: ' %', onlyIf: (p) => p.imageMode === 'dim' },
];

const systemDark = matchMedia('(prefers-color-scheme: dark)');
let state, site = null, tabId = null, host = '', saveTimer, statusTimer;
let siteShortcut = ''; // raccourci « ce site » attribué dans Chrome (affiché dans la ligne d'état)
const access = { site: true, all: false }; // autorisations Chrome pour le site ouvert / pour tous les sites

init();

async function init() {
  const { state: raw } = await chrome.storage.local.get('state');
  state = DG.normalize(raw);
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    site = tab?.url ? DG.siteForUrl(tab.url) : null;
    tabId = tab?.id ?? null;
    host = tab?.url ? new URL(tab.url).hostname : '';
  } catch {}
  $('#version').textContent = 'v' + chrome.runtime.getManifest().version;
  await refreshAccess();
  build();
  showTab(readTab());
  render();
  refreshStatus();
  showShortcuts();
}

// ---- Variantes des thèmes (sites personnalisés) : traitement des éléments qui ressortent ----

const isCustom = () => !!(site && DG.conf(state, site).custom);
// Cran de l'interrupteur du site : 0 OFF · 1 ON · 2 Toujours.
const siteLevel = () => (site ? DG.siteLevel(state, site) : 0);
// Nom affiché d'un site : son domaine pour les autres sites (un réglage vaut pour tout le domaine).
const siteName = (x) => (x.other ? x.domain : x.label);
const sameValues = (v, p) => Object.keys(v).every((k) => String(v[k]).toLowerCase() === String(p[k]).toLowerCase());

// Réglages du site ouvert (créés au besoin pour un site hors Google).
function here() {
  return DG.conf(state, site, true);
}

// Les réglages affichés : ceux du site s'il en a, sinon les réglages par défaut.
function params() {
  return (site && here().custom) || state.global;
}

// Les réglages à modifier : toucher au thème, à la variante ou à un réglage sur un site en fait une préférence de
// ce site (personnalisé). Hors site (page non gérée), ce sont les réglages par défaut.
function edit() {
  if (!site) return state.global;
  const c = here();
  if (!c.custom) c.custom = { ...state.global };
  return c.custom;
}

// Revenu exactement aux réglages par défaut : plus rien à retenir pour ce site.
function dropDefaultCustom() {
  if (!site) return;
  const c = DG.conf(state, site);
  if (c.custom && Object.keys(DG.DEFAULT_PARAMS).every((k) => String(c.custom[k]).toLowerCase() === String(state.global[k]).toLowerCase())) {
    c.custom = null;
  }
}

// ---- Autorisations pour les sites hors Google / Wikipédia ----

const originOf = (h) => `*://*.${h}/*`;

async function refreshAccess() {
  try {
    access.all = await chrome.permissions.contains({ origins: ['<all_urls>'] });
    access.site = !site?.other || access.all || (await chrome.permissions.contains({ origins: [originOf(site.domain)] }));
  } catch {}
}

// Doit être appelé directement depuis un clic (Chrome l'exige pour afficher sa demande).
async function askAccess(all) {
  try {
    await chrome.permissions.request({ origins: [all ? '<all_urls>' : originOf(site.domain)] });
  } catch {}
  await refreshAccess();
  render();
  refreshStatus();
}

// Applique le thème tout de suite sur l'onglet ouvert (accès ponctuel donné par l'ouverture du menu).
async function injectHere() {
  if (tabId == null) return;
  try { await chrome.scripting.executeScript({ target: { tabId }, files: ['sites.js', 'recolor.js', 'content.js', 'cookies.js'] }); } catch {}
}

function save(delay = 60) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => chrome.storage.local.set({ state }), delay);
}

function change(fn, delay) {
  fn();
  dropDefaultCustom();
  render();
  save(delay);
  clearTimeout(statusTimer);
  statusTimer = setTimeout(refreshStatus, 300);
}

// ---- Onglets (le dernier ouvert est retenu) ----

function readTab() {
  try { return localStorage.getItem('tab') || 'settings'; } catch { return 'settings'; }
}

// Les réglages sont la vue par défaut ; le globe (Sites) et la roue dentée (Plus) s'ouvrent et se referment.
function showTab(name) {
  if (!['settings', 'sites', 'more'].includes(name)) name = 'settings';
  for (const view of ['settings', 'sites', 'more']) $('#tab-' + view).hidden = view !== name;
  document.body.classList.toggle('side-view', name !== 'settings'); // Sites / Plus : sans le panneau Auto ni la carte du site
  for (const btn of $$('.view')) {
    const on = btn.dataset.tab === name;
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-pressed', String(on));
  }
  try { localStorage.setItem('tab', name); } catch {}
}

// ---- Construction (une seule fois) ----

function build() {
  for (const btn of $$('.view')) {
    btn.addEventListener('click', () => showTab(btn.classList.contains('on') ? 'settings' : btn.dataset.tab));
  }

  // Interrupteur dans le titre : éteint, DARKee ne modifie rien ; allumé, il reprend le dernier mode (fixe ou auto).
  $('#powerBtn').addEventListener('click', () => {
    const on = state.mode === 'off';
    if (on && state.scope === 'all' && !access.all) askAccess(true); // tous les sites : autorisation Chrome
    change(() => (state.mode = on ? state.lastOn : 'off'), 0);
  });
  // « Actif par défaut » : allumé, tous les sites passent en sombre sauf ceux qu'on coupe ;
  // éteint, seulement ceux qu'on allume.
  $('#defaultBtn').addEventListener('click', () => {
    const all = state.scope !== 'all';
    if (all && !access.all) askAccess(true); // Chrome doit autoriser tous les sites
    change(() => (state.scope = all ? 'all' : 'site'), 0);
  });
  // Bouton Auto : allume ou coupe le mode automatique ; allumé, son détail (OS, heure) s'affiche dessous.
  $('#autoBtn').addEventListener('click', () => {
    const on = state.lastOn !== 'auto';
    change(() => {
      if (on && !state.autoBy.system && !state.autoBy.schedule) state.autoBy.system = true; // une source au moins
      state.lastOn = on ? 'auto' : 'on';
      if (state.mode !== 'off') state.mode = state.lastOn;
    }, 0);
    // Affiché : le panneau entier remonte dans la fenêtre (le menu ne dépasse pas 600 px de haut).
    if (on) requestAnimationFrame(() => {
      const box = $('#autoPanel').getBoundingClientRect();
      const top = $('.pinned').getBoundingClientRect().bottom;
      const over = box.bottom + 8 - window.innerHeight;
      if (over > 0) window.scrollBy({ top: Math.min(over, box.top - top), behavior: 'smooth' });
    });
  });

  // Détail Auto repliable ; le choix est retenu d'une ouverture du menu à l'autre.
  $('#autoFold').addEventListener('click', () => {
    const fold = $('#autoFold').getAttribute('aria-expanded') === 'true';
    try { localStorage.setItem('autoFolded', fold ? '1' : '0'); } catch {}
    renderSchedule();
    if (!fold) requestAnimationFrame(() => $('#autoPanel').scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  });

  // Mode Auto : apparence de macOS et/ou horaire (au moins un des deux reste coché)
  for (const [id, key] of [['#bySystem', 'system'], ['#bySchedule', 'schedule']]) {
    $(id).addEventListener('change', (e) => change(() => {
      // Cases indépendantes ; sans aucune source, plus rien ne pilote Auto : il se coupe.
      state.autoBy[key] = e.target.checked;
      if (!state.autoBy.system && !state.autoBy.schedule) {
        state.lastOn = 'on';
        if (state.mode !== 'off') state.mode = 'on';
      }
    }, 0));
  }

  // Horaire
  for (const btn of $$('#scheduleType button')) {
    btn.addEventListener('click', () => change(() => (state.schedule.type = btn.dataset.type), 0));
  }
  // Coucher et lever : « − » = plus tôt, « + » = plus tard (par pas de 15 min).
  for (const btn of $$('[data-field]')) {
    btn.addEventListener('click', () => change(() => {
      const f = btn.dataset.field;
      state.schedule[f] = Math.min(180, Math.max(-120, state.schedule[f] + Number(btn.dataset.delta)));
    }, 0));
  }
  for (const key of ['from', 'to']) {
    $('#' + key).addEventListener('change', (e) => { if (e.target.value) change(() => (state.schedule[key] = e.target.value), 0); });
  }
  $('#locate').addEventListener('click', () => {
    $('#position').textContent = 'Localisation…';
    $('#locate').classList.add('busy');
    const done = () => $('#locate').classList.remove('busy');
    navigator.geolocation.getCurrentPosition(
      // Arrondi à ~1 km : bien assez pour l'heure du coucher du soleil, et rien de plus précis n'est gardé.
      (pos) => { done(); change(() => {
        state.schedule.lat = Math.round(pos.coords.latitude * 100) / 100;
        state.schedule.lon = Math.round(pos.coords.longitude * 100) / 100;
      }, 0); },
      () => { done(); $('#position').textContent = 'Refusé : choisis une plage horaire'; },
      { timeout: 15000, maximumAge: 3600000 },
    );
  });
  // Interrupteur du site, 3 crans : OFF · ON · Toujours (sombre même quand le mode Auto rendrait la page claire).
  // Un clic avance d'un cran ; un clic sur un cran précis y va directement.
  $('#siteToggle').addEventListener('click', (e) => {
    if (!site) return;
    const now = siteLevel();
    let next = (now + 1) % 3;
    if (e.detail) { // vrai clic de souris : le cran visé
      const box = e.currentTarget.getBoundingClientRect();
      const aimed = Math.min(2, Math.floor(((e.clientX - box.left) / box.width) * 3));
      if (aimed !== now) next = aimed;
    }
    // Autorisation demandée pendant le clic (geste utilisateur) : tout le domaine.
    if (site.other && next && !access.all && !access.site) askAccess(false);
    change(() => DG.setSiteLevel(state, site, next), 0);
    if (site.other) injectHere();
  });
  $('#permSite').addEventListener('click', () => askAccess(false));
  $('#permAll').addEventListener('click', () => askAccess(true));
  $('#accessAll').addEventListener('click', async () => {
    if (access.all) {
      await chrome.permissions.remove({ origins: ['<all_urls>'] }).catch(() => {});
      await refreshAccess();
      render();
    } else {
      askAccess(true);
    }
  });

  // Sélecteur d'élément : la page prend la main, le menu se ferme pour laisser cliquer dedans.
  $('#pickBtn').addEventListener('click', async () => {
    if (tabId == null) return;
    try {
      await chrome.tabs.sendMessage(tabId, { type: 'dark-google:pick' });
    } catch {
      await injectHere();
      try { await chrome.tabs.sendMessage(tabId, { type: 'dark-google:pick' }); } catch { return; }
    }
    window.close();
  });
  $('#rulesClear').addEventListener('click', () => change(() => (here().rules = []), 0));

  // « Ne plus personnaliser ? » (au survol de la fiche) : le site revient aux réglages par défaut.
  $('#customBtn').addEventListener('click', () => {
    if (!site || !DG.conf(state, site).custom) return;
    change(() => (here().custom = null), 0);
  });
  // Réinitialiser : sur un site, il revient aux réglages par défaut ; hors site, les réglages par défaut d'origine.
  $('#reset').addEventListener('click', () => change(() => {
    if (site) here().custom = null;
    else Object.assign(state.global, DG.DEFAULT_PARAMS);
  }, 0));

  const presets = $('#presets');
  for (const preset of DG.PRESETS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.id = preset.id;
    btn.title = preset.label;
    // Vignette : aperçu d'une page dans ce thème (fond, titre « Aa », lignes de texte, pastille d'accent).
    const swatch = document.createElement('span');
    swatch.className = 'swatch';
    swatch.style.background = preset.values.bg;
    swatch.style.color = preset.values.fg;
    // Flèche en cercle (au survol, site personnalisé) et repère de la variante en cours (3 points).
    swatch.innerHTML = '<b>Aa</b><i></i><i></i><em></em>' +
      '<svg class="cycle" viewBox="0 0 20 20" aria-hidden="true"><path d="M15.5 10a5.5 5.5 0 1 1-1.7-4"/><path d="M14.2 2.8v3.4h-3.4"/></svg>' +
      '<span class="dots"><u></u><u></u><u></u></span>';
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = preset.short || preset.label;
    btn.append(swatch, name);
    btn.addEventListener('click', () => change(() => {
      // Un clic sur le thème déjà choisi passe à la variante suivante. Thème et variante s'appliquent aux réglages
      // en cours : ceux du site s'il est personnalisé, sinon ceux de tous les sites.
      if (sameValues(preset.values, params())) {
        const p = edit();
        p.variant = ((p.variant || 0) + 1) % DG.VARIANTS.length;
      } else {
        Object.assign(edit(), preset.values);
      }
    }, 0));
    presets.appendChild(btn);
  }

  for (const btn of $$('#imageMode button')) {
    btn.addEventListener('click', () => change(() => (edit().imageMode = btn.dataset.mode), 0));
  }

  const sliders = $('#sliders');
  for (const s of SLIDERS) {
    const wrap = document.createElement('div');
    wrap.className = 'slider';
    wrap.dataset.key = s.key;
    // Une seule ligne par réglage : libellé, −, curseur, +, valeur.
    wrap.title = s.title || s.label;
    wrap.innerHTML = `
      <label for="${s.key}">${s.label}</label>
      <button type="button" class="step" data-dir="-1" aria-label="${s.title || s.label} : moins">−</button>
      <input type="range" id="${s.key}" min="${s.min}" max="${s.max}" step="1">
      <button type="button" class="step" data-dir="1" aria-label="${s.title || s.label} : plus">+</button>
      <output></output>`;
    const input = wrap.querySelector('input');
    const set = (v) => (edit()[s.key] = Math.min(s.max, Math.max(s.min, v)));
    input.addEventListener('input', () => change(() => set(Number(input.value))));
    input.addEventListener('dblclick', () => change(() => set(DG.DEFAULT_PARAMS[s.key]), 0));
    for (const step of wrap.querySelectorAll('.step')) {
      step.addEventListener('click', () => change(() => set(params()[s.key] + s.step * Number(step.dataset.dir)), 0));
    }
    sliders.appendChild(wrap);
    if (s.key === 'temperature') {
      // Garder les images sans la teinte de température (sous les boutons Images).
      const row = document.createElement('label');
      row.className = 'check sub-check';
      row.innerHTML = '<input type="checkbox" id="tempSkipImages"> Ne pas teinter les images';
      row.querySelector('input').addEventListener('change', (e) => change(() => (edit().tempSkipImages = e.target.checked), 0));
      $('.colors').appendChild(row); // sur la ligne Fond / Texte, à droite
    }
  }
  // Curseurs fins et couleurs dans un dépliant « Réglages » (ouvert / replié retenu) ; ensuite Images et « Lum. images ».
  const fold = document.createElement('details');
  fold.className = 'fold';
  fold.innerHTML = '<summary>Réglages<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5l3 3 3-3"/></svg></summary>';
  for (const key of ['brightness', 'contrast', 'saturation', 'hue', 'temperature']) fold.appendChild(sliders.querySelector(`[data-key="${key}"]`));
  fold.appendChild($('.colors')); // Fond / Texte (et « Ne pas teinter les images ») en fin de dépliant
  try { fold.open = localStorage.getItem('fineOpen') === '1'; } catch {}
  fold.addEventListener('toggle', () => { try { localStorage.setItem('fineOpen', fold.open ? '1' : '0'); } catch {} });
  sliders.prepend(fold);
  sliders.insertBefore($('#imageField'), sliders.querySelector('[data-key="images"]'));

  for (const key of ['bg', 'fg']) {
    $('#' + key).addEventListener('input', (e) => change(() => (edit()[key] = e.target.value)));
  }

  const setAll = (on) => change(() => DG.SITES.forEach((s) => DG.setSiteOn(state, s, on)), 0);
  $('#allOn').addEventListener('click', () => setAll(true));
  $('#allOff').addEventListener('click', () => setAll(false));
  // « Supprimer tous les sites » : oublie les sites enregistrés (deux clics : le premier demande confirmation).
  let wipeTimer = null;
  const WIPE = 'Supprimer tous les sites';
  $('#wipeSites').addEventListener('click', (e) => {
    const btn = e.currentTarget;
    if (!btn.classList.contains('confirm')) {
      btn.classList.add('confirm');
      btn.textContent = 'Confirmer ?';
      wipeTimer = setTimeout(() => { btn.classList.remove('confirm'); btn.textContent = WIPE; }, 4000);
      return;
    }
    clearTimeout(wipeTimer);
    btn.classList.remove('confirm');
    btn.textContent = WIPE;
    change(() => (state.hosts = {}), 0);
  });
  // Dépliant Google et Wikipédia (ouvert / replié retenu) et recherche dans les deux listes.
  try { $('#googleFold').open = localStorage.getItem('googleOpen') === '1'; } catch {}
  $('#googleFold').addEventListener('toggle', () => {
    if ($('#siteSearch').value) return; // ouvert par la recherche : pas retenu
    try { localStorage.setItem('googleOpen', $('#googleFold').open ? '1' : '0'); } catch {}
  });
  $('#siteSearch').addEventListener('input', filterSites);

  $('#hereDetect').addEventListener('change', (e) => change(() => (here().detect = e.target.checked), 0));
  $('#hereTitleBar').addEventListener('change', (e) => change(() => (here().titleBar = e.target.checked), 0));
  $('#cookieReject').addEventListener('change', (e) => change(() => (state.cookieReject = e.target.checked), 0));
  for (const btn of $$('#wikiMode button')) {
    btn.addEventListener('click', () => change(() => (state.wikiMode = btn.dataset.mode), 0));
  }
  for (const btn of $$('#engine button')) {
    btn.addEventListener('click', () => change(() => (here().engine = btn.dataset.engine), 0));
  }

  // Chrome ne permet pas de changer un raccourci depuis l'extension : on ouvre sa page dédiée.
  for (const btn of $$('[data-command]')) {
    btn.addEventListener('click', () => chrome.tabs.create({ url: 'chrome://extensions/shortcuts' }));
  }
}

// ---- Affichage ----

function render() {
  const off = state.mode === 'off';
  document.body.classList.toggle('off', off);
  $('#powerBtn').classList.toggle('on', !off);
  $('#powerBtn').setAttribute('aria-pressed', String(!off));
  $('#powerLabel').textContent = off ? 'OFF' : 'ON';
  $('#defaultBtn').classList.toggle('on', state.scope === 'all');
  $('#defaultBtn').setAttribute('aria-pressed', String(state.scope === 'all'));
  $('#defaultLabel').textContent = state.scope === 'all' ? 'Actif par défaut' : 'Inactif par défaut';
  $('#autoBtn').classList.toggle('on', state.lastOn === 'auto');
  $('#autoBtn').setAttribute('aria-pressed', String(state.lastOn === 'auto'));
  renderSchedule();

  // Fiche du site : interrupteur dont le bouton porte un croissant (jaune : sombre ici, bleu : coupé)
  const s = site && DG.conf(state, site);
  const toggle = $('#siteToggle');
  toggle.disabled = !site;
  const here0 = !!site && DG.siteOn(state, site);
  const level = siteLevel();
  toggle.classList.toggle('on', here0);
  toggle.classList.add('three');
  toggle.classList.toggle('lvl1', level === 1);
  toggle.classList.toggle('lvl2', level === 2);
  toggle.setAttribute('aria-checked', String(here0));
  $('#siteLevel').hidden = !site;
  $('#siteLevel').textContent = ['OFF', 'ON', 'Toujours ON'][level];
  $('#siteName').textContent = site ? siteName(site) : 'Page non gérée';
  $('#siteName').title = host;
  $('#siteHost').textContent = !site ? host || '—'
    : s?.custom ? 'Thème personnalisé' : level === 2 ? 'Toujours ON' : here0 ? 'Thème sombre activé' : 'Toujours désactivé ici';
  $('#siteHost').classList.toggle('own', !!s?.custom || level === 2); // « Toujours ON » compte comme personnalisé
  // Personnaliser se fait en changeant un réglage ; la fiche ne propose que d'y renoncer.
  $('#customAsk').textContent = s?.custom ? 'Ne plus personnaliser ?' : '';
  $('#customBtn').disabled = !s?.custom;
  $('#customBtn').title = s?.custom ? 'Revenir aux réglages par défaut' : '';
  $('#pickBtn').hidden = !site;
  const nRules = s?.rules?.length || 0;
  $('#siteTools').hidden = !site;
  $('#rulesInfo').textContent = nRules ? `${nRules} règle${nRules > 1 ? 's' : ''}` : '';
  $('#rulesInfo').title = nRules ? `${nRules} élément(s) de cette page avec un aspect choisi` : '';
  $('#rulesClear').hidden = !nRules;
  document.body.classList.toggle('own', !!s?.custom); // en OFF, un site personnalisé reste actif : pas grisé
  $('#customBtn').setAttribute('aria-pressed', String(!!s?.custom));
  toggle.title = !site ? ''
    : `OFF · ON · Toujours ON (sombre même quand le mode Auto rendrait ${siteName(site)} clair). Clic : cran suivant`;

  // Onglet Réglages
  const isWiki = site?.id === 'wikipedia';
  const p = params();
  // Par défaut : « Réglages par défaut », rien à réinitialiser. Modifiés : le nom du domaine, puis « Réinitialiser ».
  const modified = site ? !!s?.custom
    : Object.keys(DG.DEFAULT_PARAMS).some((k) => String(state.global[k]).toLowerCase() !== String(DG.DEFAULT_PARAMS[k]).toLowerCase());
  $('#scopeLabel').textContent = s?.custom ? siteName(site) : 'Réglages par défaut';
  $('#scopeLabel').classList.toggle('own', !!s?.custom);
  $('#reset').hidden = !modified;
  $('#nativeNote').hidden = !(isWiki && state.wikiMode === 'native');
  for (const btn of $$('#imageMode button')) btn.classList.toggle('on', btn.dataset.mode === p.imageMode);
  for (const def of SLIDERS) {
    const wrap = $(`.slider[data-key="${def.key}"]`);
    wrap.hidden = def.onlyIf ? !def.onlyIf(p) : false;
    wrap.querySelector('input').value = p[def.key];
    const signed = (def.key === 'hue' || def.key === 'temperature') && p[def.key] > 0 ? '+' : '';
    wrap.querySelector('output').textContent = def.key === 'temperature' && !p.temperature ? 'neutre' : signed + p[def.key] + def.unit;
  }
  $('#tempSkipImages').checked = !!p.tempSkipImages;
  $('#bg').value = p.bg;
  $('#fg').value = p.fg;
  for (const btn of $('#presets').children) {
    const preset = DG.PRESETS.find((x) => x.id === btn.dataset.id);
    const selected = sameValues(preset.values, p);
    const variant = p.variant || 0;
    btn.classList.toggle('on', selected);
    btn.classList.toggle('variant', selected); // flèche au survol : seulement sur le thème choisi
    btn.querySelectorAll('.dots u').forEach((dot, i) => dot.classList.toggle('on', i === variant));
    const vInfo = DG.VARIANTS[variant];
    btn.title = selected
      ? `${preset.label} · ${vInfo.name} (${variant + 1}/${DG.VARIANTS.length}) : ${vInfo.hint}. Clic pour la variante suivante` +
        (isCustom() ? ' (ce site).' : ' (ce site passe en personnalisé).')
      : preset.label;
  }

  // Onglet Sites
  $('#googleCount').textContent = `${DG.SITES.filter((d) => DG.siteOn(state, d)).length}/${DG.SITES.length}`;
  const list = $('#sites');
  list.textContent = '';
  for (const def of DG.SITES) {
    const conf = state.sites[def.id];
    const li = document.createElement('li');
    if (site?.id === def.id) li.className = 'current';
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = def.label;
    li.appendChild(name);
    if (conf.custom) {
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = 'perso';
      li.appendChild(badge);
    }
    const bar = document.createElement('button');
    bar.type = 'button';
    bar.className = 'bar' + (conf.titleBar ? ' on' : '');
    bar.title = `Barre de titre sombre pour ${def.label} : ${conf.titleBar ? 'oui' : 'non'}`;
    bar.setAttribute('aria-pressed', String(conf.titleBar));
    bar.addEventListener('click', () => change(() => (conf.titleBar = !conf.titleBar), 0));
    li.appendChild(bar);
    const sw = document.createElement('label');
    sw.className = 'switch';
    sw.innerHTML = '<input type="checkbox"><span></span>';
    const input = sw.firstChild;
    input.setAttribute('aria-label', def.label);
    input.checked = DG.siteOn(state, def);
    input.addEventListener('change', () => change(() => DG.setSiteOn(state, def, input.checked), 0));
    li.appendChild(sw);
    list.appendChild(li);
  }

  // Autres sites
  $('#perm').hidden = !(site?.other && DG.siteOn(state, site) && !access.site);
  $('#accessText').textContent = 'Accès à tous les sites : ' + (access.all ? 'accordé' : 'non');
  $('#accessAll').textContent = access.all ? 'Retirer' : 'Autoriser';
  const hosts = $('#hosts');
  hosts.textContent = '';
  const names = Object.keys(state.hosts).sort();
  $('#hostsEmpty').hidden = names.length > 0;
  for (const name of names) {
    const conf = state.hosts[name];
    const li = document.createElement('li');
    if (site?.domain === name) li.className = 'current';
    const label = document.createElement('span');
    label.className = 'name';
    label.textContent = name;
    const sw = document.createElement('label');
    sw.className = 'switch';
    sw.innerHTML = '<input type="checkbox"><span></span>';
    const input = sw.firstChild;
    input.setAttribute('aria-label', name);
    const hostSite = DG.otherSite(name);
    input.checked = DG.siteOn(state, hostSite);
    input.addEventListener('change', () => change(() => DG.setSiteOn(state, hostSite, input.checked), 0));
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'remove';
    remove.textContent = '×';
    remove.title = `Oublier ${name}`;
    remove.addEventListener('click', () => change(() => delete state.hosts[name], 0));
    li.append(label, sw, remove);
    hosts.appendChild(li);
  }
  filterSites();

  // Onglet Plus
  $('#moreNoSite').hidden = !!site;
  $('#detectRow').hidden = !site || (isWiki && state.wikiMode === 'native');
  $('#hereDetect').checked = !!s?.detect;
  $('#titleBarRow').hidden = !site;
  $('#hereTitleBar').checked = !!s?.titleBar;
  $('#cookieReject').checked = state.cookieReject;
  $('#engineRow').hidden = !site || (isWiki && state.wikiMode === 'native');
  for (const btn of $$('#engine button')) btn.classList.toggle('on', btn.dataset.engine === s?.engine);
  for (const btn of $$('#wikiMode button')) btn.classList.toggle('on', btn.dataset.mode === state.wikiMode);
}

// Nom lisible d'une position : grande ville proche (≤ 60 km), sinon le pays, d'après villes.js (hors ligne).
function placeName(lat, lon) {
  const rad = Math.PI / 180;
  const km = ([, , la, lo]) => {
    const a = Math.sin(((la - lat) * rad) / 2) ** 2 +
      Math.cos(lat * rad) * Math.cos(la * rad) * Math.sin(((lo - lon) * rad) / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(a));
  };
  let best = null, dist = Infinity;
  for (const city of DG_CITIES) {
    const d = km(city);
    if (d < dist) { best = city; dist = d; }
  }
  if (best && dist <= 60) return `Près de ${best[0]}, ${best[1]}`;
  if (best && dist <= 500) return best[1];
  return 'Position enregistrée';
}

// Recherche de l'onglet Sites : filtre les deux listes ; le dépliant Google s'ouvre s'il contient un résultat.
function filterSites() {
  const q = $('#siteSearch').value.trim().toLowerCase();
  let shown = 0, googleHits = 0;
  for (const li of $$('#sites li, #hosts li')) {
    const hit = !q || li.querySelector('.name').textContent.toLowerCase().includes(q);
    li.hidden = !hit;
    if (hit) { shown++; if (li.parentElement.id === 'sites') googleHits++; }
  }
  if (q) $('#googleFold').open = googleHits > 0;
  else { try { $('#googleFold').open = localStorage.getItem('googleOpen') === '1'; } catch {} }
  $('#searchEmpty').hidden = !q || shown > 0;
  if (q) $('#hostsEmpty').hidden = true;
}

const hhmm = (d) => d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

function renderSchedule() {
  const sc = state.schedule, by = state.autoBy;
  const auto = state.lastOn === 'auto';
  // Détail du mode Auto : affiché quand il est allumé, sauf s'il a été replié avec la flèche du bouton.
  let folded = false;
  try { folded = localStorage.getItem('autoFolded') === '1'; } catch {}
  $('#autoPanel').hidden = !auto || folded;
  $('#autoFold').setAttribute('aria-expanded', String(auto && !folded));
  $('#autoFold').disabled = !auto;
  $('#autoSplit').classList.toggle('on', auto);
  // Légende du bouton : « Auto OFF », ou ce qui décide : « Auto · OS », et la plage seule quand elle s'affiche
  // (« 18:42–07:55 », « OS · 18:42–07:55 »), sans « Auto » qui ferait déborder.
  const win = DG.nightWindow(sc);
  const sources = [by.system && 'OS', by.schedule && `${hhmm(win.start)}–${hhmm(win.end)}`].filter(Boolean);
  $('#autoLabel').textContent = !auto ? 'Auto OFF' : (by.schedule ? sources : ['Auto', ...sources]).join(' · ');
  $('#bySystem').checked = by.system;
  $('#bySchedule').checked = by.schedule;
  $('#scheduleFields').hidden = !by.schedule;
  for (const btn of $$('#scheduleType button')) btn.classList.toggle('on', btn.dataset.type === sc.type);
  $('#sunFields').hidden = sc.type !== 'sun';
  $('#sunPlace').hidden = sc.type !== 'sun';
  $('#hourFields').hidden = sc.type !== 'hours';
  // Entre les boutons : l'heure obtenue (début et fin de la période sombre) ; le décalage s'affiche au survol.
  const shift = (minutes, before, after) =>
    !minutes ? "à l'heure" : minutes > 0 ? `${minutes} min ${before}` : `${-minutes} min ${after}`;
  $('#offsetOut').textContent = win.sunset ? `(${hhmm(win.start)})` : '—';
  $('#offsetOut').title = shift(sc.offset, 'avant le coucher', 'après le coucher');
  $('#offsetRiseOut').textContent = win.sunrise ? `(${hhmm(win.end)})` : '—';
  $('#offsetRiseOut').title = shift(sc.offsetRise, 'après le lever', 'avant le lever');
  // Dans les boutons : le décalage total par rapport au soleil, côté où il est appliqué (« − 45 min »),
  // et le pas de 15 min de l'autre côté ; à l'heure du soleil, les deux affichent ± 15 min.
  const label = (row, later) => {
    const [minus, plus] = $$(`#sunFields [data-field="${row}"]`).sort((a, b) =>
      (row === 'offset' ? -1 : 1) * (Number(a.dataset.delta) - Number(b.dataset.delta)));
    minus.textContent = later < 0 ? `− ${-later} min` : '− 15 min';
    plus.textContent = later > 0 ? `+ ${later} min` : '+ 15 min';
    minus.classList.toggle('set', later < 0);
    plus.classList.toggle('set', later > 0);
  };
  label('offsetRise', sc.offsetRise); // lever : positif = plus tard
  label('offset', -sc.offset); // coucher : « offset » positif = plus tôt
  $('#from').value = sc.from;
  $('#to').value = sc.to;

  const located = sc.lat !== null && sc.lon !== null;
  if ($('#position').textContent !== 'Localisation…' || located) {
    $('#position').textContent = located ? placeName(sc.lat, sc.lon) : 'Inconnu';
    $('#position').title = located ? `${sc.lat.toFixed(2)}, ${sc.lon.toFixed(2)}` : '';
  }
  const locateLabel = located ? 'Actualiser la position' : 'Me localiser';
  $('#locate').title = locateLabel;
  $('#locate').setAttribute('aria-label', locateLabel);

  // Frise : la période sombre sur 24 h (coupée en deux si elle passe minuit) et l'heure actuelle.
  const w = DG.nightWindow(sc);
  const min = (d) => d.getHours() * 60 + d.getMinutes();
  const s = min(w.start), e = min(w.end), now = min(new Date());
  const seg = (el, from, to) => { el.style.left = `${(from / 1440) * 100}%`; el.style.width = `${((to - from) / 1440) * 100}%`; };
  if (s <= e) { seg($('#tlA'), s, e); seg($('#tlB'), 0, 0); }
  else { seg($('#tlA'), s, 1440); seg($('#tlB'), 0, e); }
  $('#tlNow').style.left = `${(now / 1440) * 100}%`;
  // Sous la frise : lever à gauche (matin), coucher à droite (soir), comme sur la frise.
  const usesSun = sc.type === 'sun' && w.sunset;
  $('#infoLeft').textContent = usesSun ? `Lever ${hhmm(w.sunrise)}` : `Clair à ${hhmm(w.end)}`;
  $('#infoRight').textContent = usesSun ? `Coucher ${hhmm(w.sunset)}` : `Sombre à ${hhmm(w.start)}`;
}

// Demande à la page ce qu'elle applique réellement (thème sombre d'origine détecté ou non).
async function refreshStatus() {
  const el = $('#status');
  const s = site && DG.conf(state, site);
  // La ligne reste toujours affichée (avec un message neutre au besoin) pour que le menu ne saute pas.
  const show = (text, kind = '') => {
    el.className = 'status ' + kind;
    el.textContent = text;
  };
  if (!site) return show("DARKee n'agit pas sur cette page.", 'paused');
  if (state.mode === 'off') return show('DARKee est en OFF.', 'paused');
  if (!DG.siteOn(state, site)) {
    return state.scope === 'site'
      ? show(`Pas allumé sur ce site (${siteShortcut ? siteShortcut + ' ou ' : ''}clic sur la carte).`, 'paused')
      : show('Personnalisé : thème sombre coupé sur ce site.');
  }
  if (state.mode === 'auto' && !s.custom) {
    const by = state.autoBy;
    const dark = (by.system && systemDark.matches) || (by.schedule && DG.isNight(state.schedule));
    if (!dark) return show('Mode Auto : en pause pour le moment.', 'paused');
  }

  if (site.id === 'wikipedia' && state.wikiMode === 'native') return show('Thème sombre de Wikipédia activé et mémorisé.');
  if (tabId == null) return s.custom ? show(`Personnalisé : réglages propres à ${site.label}.`, 'own') : show('Thème sombre appliqué.');
  try {
    const res = await chrome.tabs.sendMessage(tabId, { type: 'dark-google:status' });
    if (res.nativeDark) {
      show(s.detect ? 'Site déjà sombre : laissé tel quel.' : 'Site déjà sombre, mais le filtre est forcé (il devient clair).', 'native');
    } else {
      if (s.custom) show(`Personnalisé : réglages propres à ${site.label} appliqués.`, 'own');
      else show('Site clair : thème sombre appliqué.');
    }
  } catch {
    show('Recharge la page pour activer DARKee ici.', 'paused');
  }
}

// Affiche les raccourcis réellement attribués dans Chrome.
async function showShortcuts() {
  let commands = [];
  try { commands = await chrome.commands.getAll(); } catch {}
  for (const btn of $$('[data-command]')) {
    const kbd = btn.querySelector('kbd');
    const key = commands.find((c) => c.name === btn.dataset.command)?.shortcut;
    kbd.textContent = key || 'Définir';
    kbd.classList.toggle('unset', !key);
  }
  siteShortcut = commands.find((c) => c.name === 'toggle-site')?.shortcut || '';
}
