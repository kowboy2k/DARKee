// DARKee – définitions partagées par la page, le popup et l'arrière-plan.
// Aucune requête réseau ici ni ailleurs dans l'extension.
var DG = (() => {
  const onDocs = (kind) => (h, p) => h === 'docs.google.com' && p.includes('/' + kind);

  // engine 'css' : ces éditeurs dessinent la page dans des canvas superposés que Chrome n'arrive pas
  // à afficher sous le filtre SVG (page brouillée) ; le filtre CSS, lui, fonctionne.

  const SITES = [
    { id: 'gmail', label: 'Gmail', test: (h) => h === 'mail.google.com' },
    { id: 'calendar', label: 'Agenda', test: (h) => h === 'calendar.google.com' },
    { id: 'docs', label: 'Docs', engine: 'css', group: 'docs.google.com', test: onDocs('document') },
    { id: 'sheets', label: 'Sheets', engine: 'css', group: 'docs.google.com', test: onDocs('spreadsheets') },
    { id: 'slides', label: 'Slides', engine: 'css', group: 'docs.google.com', test: onDocs('presentation') },
    { id: 'forms', label: 'Forms', group: 'docs.google.com', test: onDocs('forms') },
    { id: 'drive', label: 'Drive', test: (h) => h === 'drive.google.com' },
    { id: 'translate', label: 'Traduction', test: (h) => h.startsWith('translate.google.') },
    { id: 'keep', label: 'Keep', test: (h) => h === 'keep.google.com' },
    { id: 'contacts', label: 'Contacts', test: (h) => h === 'contacts.google.com' },
    { id: 'maps', label: 'Maps', off: true,
      test: (h, p) => h.startsWith('maps.google.') || (/^www\.google\./.test(h) && p.startsWith('/maps')) },
    { id: 'search', label: 'Recherche', test: (h) => /^(www\.)?google\.(com|fr)$/.test(h) },
    { id: 'photos', label: 'Photos', off: true, test: (h) => h === 'photos.google.com' },
    { id: 'meet', label: 'Meet', off: true, test: (h) => h === 'meet.google.com' },
    { id: 'other', label: 'Autres services Google', test: (h) => /(^|\.)google\.(com|fr)$/.test(h) },
    { id: 'wikipedia', label: 'Wikipédia', test: (h) => /(^|\.)wikipedia\.org$/.test(h) },
  ];

  const DEFAULT_PARAMS = {
    brightness: 100,
    contrast: 100,
    saturation: 100,
    hue: 0,
    images: 90,
    temperature: 0, // −100 froid … +100 chaud
    tempSkipImages: false, // true : les images gardent leur teinte d'origine
    variant: 0, // voir VARIANTS
    imageMode: 'dim', // 'dim' : vraies couleurs assombries · 'keep' : intactes
    bg: '#1b1c20',
    fg: '#e4e4e7',
  };

  const PRESETS = [
    { id: 'graphite', label: 'Graphite', short: 'Graphite', values: { bg: '#1b1c20', fg: '#e4e4e7', brightness: 100, contrast: 100, saturation: 100, hue: 0 } },
    { id: 'oled', label: 'OLED', short: 'OLED', values: { bg: '#000000', fg: '#f5f5f5', brightness: 100, contrast: 105, saturation: 100, hue: 0 } },
    { id: 'doux', label: 'Doux', short: 'Doux', values: { bg: '#27282c', fg: '#cbccd0', brightness: 95, contrast: 90, saturation: 85, hue: 0 } },
    { id: 'chaud', label: 'Nuit chaude', short: 'Chaud', values: { bg: '#211c17', fg: '#eadcc6', brightness: 100, contrast: 95, saturation: 70, hue: 0 } },
    { id: 'bleu', label: 'Bleu nuit', short: 'Bleu nuit', values: { bg: '#0d1a33', fg: '#d3e2ff', brightness: 100, contrast: 100, saturation: 110, hue: 0 } },
  ];

  // Variantes d'un thème, de plus en plus appuyées (clic répété sur le thème choisi). Comme le thème, elles
  // valent pour tous les sites, sauf ceux qui ont leurs propres réglages (Personnaliser).
  const VARIANTS = [
    { name: 'Classique', hint: 'les fonds clairs passent au sombre, les couleurs du site gardent leur teinte' },
    { name: 'Renforcé', hint: 'plus d\'éléments recolorés : tons moyens et fonds colorés passent aussi aux tons du thème' },
    { name: 'Profond', hint: 'comme Renforcé, et tout plus foncé (surfaces, bordures, images) ; seul le texte garde son éclat' },
  ];

  function siteFor(host, path) {
    return SITES.find((s) => s.test(host, path)) || null;
  }

  function siteForUrl(url) {
    try {
      const u = new URL(url);
      return /^https?:$/.test(u.protocol) ? siteFor(u.hostname, u.pathname) || otherSite(u.hostname) : null;
    } catch {
      return null;
    }
  }

  // Tout autre site web : identifié par son nom de domaine (sans « www. »).
  function otherSite(hostname) {
    const host = hostname.replace(/^www\./, '');
    return { id: 'host:' + host, label: host, host, domain: baseDomain(host), other: true };
  }

  // Domaine principal : « mail.exemple.fr » → « exemple.fr », « shop.exemple.co.uk » → « exemple.co.uk ».
  function baseDomain(host) {
    const parts = host.split('.');
    const n = /^(co|com|org|net|gov|gouv|ac|edu)$/.test(parts[parts.length - 2] || '') && parts.length > 2 ? 3 : 2;
    return parts.slice(-n).join('.');
  }

  // « Appliquer à tout le domaine » : nom affiché de ce domaine, ou null s'il n'y a rien à partager
  // (Gmail, Agenda… occupent déjà seuls leur domaine).
  function domainOf(site) {
    if (site.other) return site.domain;
    return site.group || null;
  }

  function isDomainWide(state, site) {
    if (site.other) return !!state.hosts[site.domain]?.wholeDomain;
    return !!site.group && SITES.some((x) => x.group === site.group && state.sites[x.id].wholeDomain);
  }

  function setDomainWide(state, site, on) {
    if (site.other) {
      const current = conf(state, site, true);
      if (on) {
        state.hosts[site.domain] = { ...current, wholeDomain: true };
        if (site.host !== site.domain) delete state.hosts[site.host];
      } else {
        state.hosts[site.host] = { ...current, wholeDomain: false };
        if (site.host !== site.domain) delete state.hosts[site.domain];
      }
      return;
    }
    if (!site.group) return;
    const current = { ...conf(state, site) };
    for (const x of SITES) if (x.group === site.group) state.sites[x.id].wholeDomain = false;
    if (on) state.sites[site.id] = { ...current, wholeDomain: true };
    else state.sites[site.id] = { ...current, wholeDomain: false };
  }

  // Domaines gérés d'office (déclarés dans le manifeste) ; les autres demandent une autorisation.
  const BUILT_IN_MATCHES = ['*://*.google.com/*', '*://*.google.fr/*', '*://*.wikipedia.org/*'];

  const siteDefaults = (state, site) => ({
    // Site jamais réglé : sombre en « Par défaut », laissé tel quel en « Par site ».
    enabled: site.other ? state.scope !== 'site' : !site.off,
    rules: [],
    titleBar: true,
    detect: true,
    engine: site.engine || (site.other ? 'recolor' : 'svg'),
    custom: null,
  });

  // Réglages d'un site ; « create » les ajoute à l'état pour pouvoir les modifier.
  function conf(state, site, create = false) {
    if (!site.other) {
      // Docs, Sheets, Slides, Forms : un site réglé « pour tout docs.google.com » sert pour les autres.
      const leader = site.group && SITES.find((x) => x.group === site.group && state.sites[x.id].wholeDomain);
      return state.sites[(leader || site).id];
    }
    if (state.hosts[site.domain]?.wholeDomain) return state.hosts[site.domain];
    if (state.hosts[site.host]) return state.hosts[site.host];
    const d = siteDefaults(state, site);
    if (create) state.hosts[site.host] = d;
    return d;
  }

  // Règles par élément (choisies dans la page) : 'on' thème forcé, 'orig' couleurs d'origine, 'off' masqué.
  const RULE_MODES = ['on', 'orig', 'off'];
  function cleanRules(rules) {
    return Array.isArray(rules)
      ? rules.filter((r) => r && typeof r.sel === 'string' && r.sel.length < 500 && RULE_MODES.includes(r.mode)).slice(0, 100)
      : [];
  }

  // Le site est-il sombre (DARKee étant actif) ? Un même choix par site, quel que soit le mode : seuls les sites
  // jamais réglés dépendent de la portée (voir siteDefaults).
  function siteOn(state, site) {
    return conf(state, site).enabled;
  }

  function setSiteOn(state, site, on) {
    conf(state, site, true).enabled = on;
  }

  // Icône de la barre d'outils : le contour dit le mode (bleuté : « Inactif par défaut », aucun : « Actif par
  // défaut »), le croissant dit la page en cours (jaune : sombre ici, bleu : coupé) ; OFF : fond bleu.
  function iconKind(state, site) {
    if (state.mode === 'off') return 'off';
    const on = site ? siteOn(state, site) : state.scope === 'all';
    // Contour bleuté : « Inactif par défaut » ; croissant jaune : la page (ou son domaine) est sombre, bleu : coupée.
    if (state.scope === 'site') return on ? 'idleon' : 'idle';
    return on ? 'on' : 'siteoff';
  }

  // Complète un état enregistré (éventuellement ancien ou vide) avec les valeurs par défaut.
  function normalize(raw) {
    const state = raw && typeof raw === 'object' ? raw : {};
    const clean = (p) => {
      const { themeColor, ...rest } = p || {};
      const out = { ...DEFAULT_PARAMS, ...rest };
      if (!['dim', 'keep'].includes(out.imageMode)) out.imageMode = 'dim'; // l'ancienne option « Inverser » n'existe plus
      return out;
    };
    const out = {
      // 'on' : partout · 'auto' : selon l'apparence de macOS et/ou l'horaire · 'off' : nulle part
      mode: ['auto', 'schedule'].includes(state.mode) ? 'auto' : ['on', 'off'].includes(state.mode) ? state.mode : state.enabled === false ? 'off' : 'on',
      autoBy: normalizeAutoBy(state),
      // Portée quand DARKee est actif : 'all' (« Par défaut ») tous les sites sont sombres sauf ceux qu'on coupe ;
      // 'site' seuls les sites qu'on allume un par un (⌥⇧D, carte du site) le sont.
      scope: state.scope === 'site' ? 'site' : 'all',
      // Mode à retrouver en rallumant (OFF → Actif) : fixe ou auto.
      lastOn: state.lastOn === 'auto' || state.mode === 'auto' || state.mode === 'schedule' ? 'auto' : 'on',
      schedule: normalizeSchedule(state.schedule),
      wikiMode: state.wikiMode === 'filter' ? 'filter' : 'native',
      // Anti-cookies : refuser automatiquement les demandes de cookies (cookies.js).
      cookieReject: state.cookieReject !== false,
      global: clean(state.global),
      sites: {},
      hosts: {},
    };
    // Ancienne version : une seule case « barre de titre » pour tous les sites.
    const oldTitleBar = (state.global || {}).themeColor !== false;
    for (const s of SITES) {
      const saved = (state.sites || {})[s.id] || {};
      out.sites[s.id] = {
        enabled: saved.picked === true || (typeof saved.enabled === 'boolean' ? saved.enabled : !s.off),
        titleBar: typeof saved.titleBar === 'boolean' ? saved.titleBar : oldTitleBar,
        detect: saved.detect !== false,
        engine: ['svg', 'css', 'recolor'].includes(saved.engine) ? saved.engine : s.engine || 'svg',
        custom: saved.custom ? clean(saved.custom) : null,
        wholeDomain: saved.wholeDomain === true,
        rules: cleanRules(saved.rules),
      };
    }
    // Passage à 1.11 (Actif = tous les sites) : avant, un site ouvert dans le menu était enregistré « coupé »
    // par défaut. Ces entrées sans autre réglage ne sont pas des choix : on les oublie une fois.
    out.allSitesDefault = true;
    out.recolorDefault = true;
    for (const [host, saved] of Object.entries(state.hosts || {})) {
      if (!state.allSitesDefault && saved.enabled !== true && !saved.picked && !saved.custom && !saved.wholeDomain && !(saved.rules || []).length) continue;
      out.hosts[host] = {
        enabled: saved.picked === true || saved.enabled !== false, // « picked » : ancienne version de « Par site »
        titleBar: saved.titleBar !== false,
        detect: saved.detect !== false,
        // 1.17 : « Compatible », réglage par défaut jusque-là, passe une fois à « Recolorer ».
        engine: saved.engine === 'svg' ? 'svg' : saved.engine === 'recolor' || !state.recolorDefault ? 'recolor' : 'css',
        custom: saved.custom ? clean(saved.custom) : null,
        wholeDomain: saved.wholeDomain === true,
        rules: cleanRules(saved.rules),
      };
    }
    return out;
  }

  // Ce que la page doit appliquer pour un site donné.
  function effective(state, site) {
    const s = conf(state, site);
    return {
      // Site personnalisé : il garde son thème même en OFF ou quand le mode Auto est en pause.
      on: state.mode !== 'off' && siteOn(state, site), // OFF éteint tout, sites personnalisés compris
      auto: state.mode === 'auto' && !s.custom,
      custom: !!s.custom,
      rules: s.rules || [],
      siteOff: state.scope === 'all' && !s.enabled && state.mode !== 'off', // coupé ici alors que tout est sombre : une exception
      bySystem: state.autoBy.system,
      night: state.mode === 'auto' && state.autoBy.schedule ? isNight(state.schedule) : false,
      mode: site.id === 'wikipedia' ? state.wikiMode : 'filter',
      titleBar: s.titleBar,
      detect: s.detect,
      engine: s.engine,
      ...(s.custom || state.global),
    };
  }

  // ---- Horaire : coucher du soleil (selon la position) ou heures fixes ----

  // Mode Auto : sur quoi se baser (au moins un des deux). Anciennes versions : modes 'auto' et 'schedule' séparés.
  function normalizeAutoBy(state) {
    const by = state.autoBy && typeof state.autoBy === 'object'
      ? { system: state.autoBy.system === true, schedule: state.autoBy.schedule === true }
      : { system: state.mode !== 'schedule', schedule: state.mode === 'schedule' };
    return by; // aucune source : Auto ne rend rien sombre (le menu coupe alors Auto)
  }

  const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

  function normalizeSchedule(raw) {
    const s = raw && typeof raw === 'object' ? raw : {};
    const coord = (v, max) => (typeof v === 'number' && Math.abs(v) <= max ? v : null);
    return {
      type: s.type === 'hours' ? 'hours' : 'sun',
      // Décalages en minutes : avant le coucher (négatif = après) et après le lever (négatif = avant).
      offset: Number.isFinite(s.offset) ? Math.min(180, Math.max(-120, s.offset)) : 30,
      offsetRise: Number.isFinite(s.offsetRise) ? Math.min(180, Math.max(-120, s.offsetRise)) : 0,
      lat: coord(s.lat, 90),
      lon: coord(s.lon, 180),
      from: HHMM.test(s.from) ? s.from : '19:00',
      to: HHMM.test(s.to) ? s.to : '07:00',
    };
  }

  // Lever et coucher du soleil (algorithme astronomique classique, précis à une minute près environ).
  function sunTimes(date, lat, lon) {
    const rad = Math.PI / 180, day = 86400000, J1970 = 2440588, J2000 = 2451545, J0 = 0.0009;
    const days = date.valueOf() / day - 0.5 + J1970 - J2000;
    const lw = -lon * rad, phi = lat * rad;
    const n = Math.round(days - J0 - lw / (2 * Math.PI));
    const ds = J0 + lw / (2 * Math.PI) + n;
    const M = rad * (357.5291 + 0.98560028 * ds);
    const C = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
    const L = M + C + rad * 102.9372 + Math.PI;
    const dec = Math.asin(Math.sin(rad * 23.4397) * Math.sin(L));
    const noon = J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
    const w = Math.acos((Math.sin(rad * -0.833) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec)));
    if (Number.isNaN(w)) return null; // jour ou nuit polaire
    const set = noon + w / (2 * Math.PI);
    const toDate = (j) => new Date((j + 0.5 - J1970) * day);
    return { sunrise: toDate(noon - (set - noon)), sunset: toDate(set) };
  }

  const minutesOf = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));

  // Début et fin de la prochaine période sombre (ou de celle en cours), en Date.
  function nightWindow(schedule, now = new Date()) {
    if (schedule.type === 'sun' && schedule.lat !== null && schedule.lon !== null) {
      const today = sunTimes(now, schedule.lat, schedule.lon);
      if (today) {
        const start = new Date(today.sunset - schedule.offset * 60000);
        const end = new Date(today.sunrise.valueOf() + schedule.offsetRise * 60000);
        return { start, end, sunset: today.sunset, sunrise: today.sunrise };
      }
    }
    const at = (hhmm) => { const d = new Date(now); d.setHours(0, minutesOf(hhmm), 0, 0); return d; };
    return { start: at(schedule.from), end: at(schedule.to) };
  }

  function isNight(schedule, now = new Date()) {
    const { start, end } = nightWindow(schedule, now);
    const t = now.getHours() * 60 + now.getMinutes();
    const s = start.getHours() * 60 + start.getMinutes(), e = end.getHours() * 60 + end.getMinutes();
    return s <= e ? t >= s && t < e : t >= s || t < e; // la nuit passe généralement minuit
  }

  // ---- Matrices de couleur (RVB homogène 4×4, appliquées sur des valeurs 0–1) ----

  function mul(A, B) { // B s'applique d'abord, puis A
    const R = [[], [], [], []];
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        let s = 0;
        for (let k = 0; k < 4; k++) s += A[i][k] * B[k][j];
        R[i][j] = s;
      }
    }
    return R;
  }

  const affine = (m, o = [0, 0, 0]) => [
    [m[0][0], m[0][1], m[0][2], o[0]],
    [m[1][0], m[1][1], m[1][2], o[1]],
    [m[2][0], m[2][1], m[2][2], o[2]],
    [0, 0, 0, 1],
  ];
  const diag = (r, g, b, o) => affine([[r, 0, 0], [0, g, 0], [0, 0, b]], o);

  function hueRotate(deg) {
    const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
    return affine([
      [0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928],
      [0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283],
      [0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072],
    ]);
  }

  function saturate(v) {
    return affine([
      [0.213 + 0.787 * v, 0.715 - 0.715 * v, 0.072 - 0.072 * v],
      [0.213 - 0.213 * v, 0.715 + 0.285 * v, 0.072 - 0.072 * v],
      [0.213 - 0.213 * v, 0.715 - 0.715 * v, 0.072 + 0.928 * v],
    ]);
  }

  function inverse(M) {
    const [a, b, c] = M[0], [d, e, f] = M[1], [g, h, i] = M[2];
    const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
    if (Math.abs(det) < 1e-4) return null;
    const A = [
      [(e * i - f * h) / det, (c * h - b * i) / det, (b * f - c * e) / det],
      [(f * g - d * i) / det, (a * i - c * g) / det, (c * d - a * f) / det],
      [(d * h - e * g) / det, (b * g - a * h) / det, (a * e - b * d) / det],
    ];
    const t = [M[0][3], M[1][3], M[2][3]];
    const o = A.map((row) => -(row[0] * t[0] + row[1] * t[1] + row[2] * t[2]));
    return affine(A, o);
  }

  function rgb(hex) {
    const n = parseInt(String(hex).replace('#', ''), 16) || 0;
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }

  const toFe = (M) =>
    [0, 1, 2].map((i) => [M[i][0], M[i][1], M[i][2], 0, M[i][3]].map((v) => v.toFixed(5)).join(' ')).join('  ') +
    '  0 0 0 1 0';

  // main : la page entière (inversion + réglages + couleurs de fond et de texte).
  // revert : appliqué aux images pour annuler « main » et ne garder qu'un léger assombrissement.
  function matrices(p) {
    const bg = rgb(p.bg), fg = rgb(p.fg);
    const b = p.brightness / 100, k = p.contrast / 100, d = p.imageMode === 'dim' ? p.images / 100 : 1;
    const darken = mul(hueRotate(180), diag(-1, -1, -1, [1, 1, 1]));
    let M = darken;
    M = mul(saturate(p.saturation / 100), M);
    M = mul(hueRotate(p.hue), M);
    M = mul(diag(b, b, b), M);
    M = mul(diag(k, k, k, [0.5 - 0.5 * k, 0.5 - 0.5 * k, 0.5 - 0.5 * k]), M);
    M = mul(diag(fg[0] - bg[0], fg[1] - bg[1], fg[2] - bg[2], bg), M);
    const beforeTemp = M;
    M = mul(temperatureMatrix(p.temperature), M);
    // Images : on annule tout sauf la température, sauf si elle doit les épargner aussi.
    const back = inverse(p.tempSkipImages ? M : beforeTemp) || inverse(darken);
    return { main: toFe(M), revert: toFe(mul(back, diag(d, d, d))) };
  }

  // Température de couleur : chaud = moins de bleu (et un peu moins de vert), froid = moins de rouge.
  function temperatureMatrix(value) {
    const t = Math.max(-1, Math.min(1, (value || 0) / 100));
    return t >= 0 ? diag(1, 1 - 0.12 * t, 1 - 0.4 * t) : diag(1 + 0.3 * t, 1 + 0.1 * t, 1);
  }

  // Matrice des fonctions CSS utilisées par le moteur « Compatible » (pour en calculer l'inverse exacte).
  function sepia(a) {
    const r = 1 - a;
    return affine([
      [0.393 + 0.607 * r, 0.769 - 0.769 * r, 0.189 - 0.189 * r],
      [0.349 - 0.349 * r, 0.686 + 0.314 * r, 0.168 - 0.168 * r],
      [0.272 - 0.272 * r, 0.534 - 0.534 * r, 0.131 + 0.869 * r],
    ]);
  }

  // Moteur « Compatible » : uniquement des fonctions CSS. Fond et texte sont rendus par leur luminosité
  // (sans teinte de couleur), mais tous les sites s'affichent correctement.
  function cssFilters(p) {
    const lum = (hex) => { const [r, g, b] = rgb(hex); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const s = lum(p.fg) - lum(p.bg);
    const B = p.brightness / 100, K = p.contrast / 100;
    // Pente et décalage voulus après inversion, puis traduits en contrast(k) suivi de brightness(b).
    const slope = s * B * K, offset = lum(p.bg) + s * (0.5 - 0.5 * K);
    const b = 2 * offset + slope, k = b ? slope / b : 1;
    const d = p.imageMode === 'dim' ? p.images / 100 : 1;
    const sat = p.saturation / 100;
    // Inverse exacte de « main » (étapes inversées, dans l'ordre contraire) pour rendre aux images leurs vraies
    // couleurs ; si un réglage extrême la rend impossible, on se contente d'annuler l'inversion.
    const exact = Math.abs(k) > 0.05 && b > 0.05 && sat > 0.05;
    const revert = exact
      ? `brightness(${d}) brightness(${(1 / b).toFixed(4)}) contrast(${(1 / k).toFixed(4)}) hue-rotate(${-p.hue}deg) saturate(${(1 / sat).toFixed(4)}) hue-rotate(180deg) invert(1)`
      : `invert(1) hue-rotate(180deg) brightness(${d})`;
    // Température : seul le côté chaud existe en CSS (sepia) ; le froid n'a pas d'équivalent sans filtre SVG.
    const warm = Math.max(0, Math.min(1, (p.temperature || 0) / 100)) * 0.4;
    const main = `invert(1) hue-rotate(180deg) saturate(${sat}) hue-rotate(${p.hue}deg) contrast(${k.toFixed(4)}) brightness(${b.toFixed(4)})` +
      (warm ? ` sepia(${warm.toFixed(3)})` : '');
    // Images épargnées par la température : la sepia ne s'annule pas en CSS, on passe par une matrice SVG
    // (appliquée aux images seulement, ce que Docs supporte, contrairement à un filtre SVG sur toute la page).
    let revertMatrix = null;
    if (warm && p.tempSkipImages) {
      let M = mul(hueRotate(180), diag(-1, -1, -1, [1, 1, 1]));
      M = mul(saturate(sat), M);
      M = mul(hueRotate(p.hue), M);
      M = mul(diag(k, k, k, [0.5 - 0.5 * k, 0.5 - 0.5 * k, 0.5 - 0.5 * k]), M);
      M = mul(diag(b, b, b), M);
      M = mul(sepia(warm), M);
      const back = inverse(M);
      if (back) revertMatrix = toFe(mul(back, diag(d, d, d)));
    }
    return { main, revert, revertMatrix };
  }

  return {
    SITES, DEFAULT_PARAMS, PRESETS, VARIANTS, BUILT_IN_MATCHES,
    siteFor, siteForUrl, otherSite, conf, normalize, effective, matrices, cssFilters,
    domainOf, isDomainWide, setDomainWide, siteOn, setSiteOn, iconKind,
    nightWindow, isNight,
  };
})();
