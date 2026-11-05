// DARKee – appliqué dans chaque page Google / Wikipédia, dès le début du chargement.
(() => {
  // Le script peut être injecté une seconde fois (raccourci sur un site déjà chargé) : une seule instance.
  if (window.__darkGoogle) return;
  window.__darkGoogle = true;

  const site = DG.siteForUrl(location.href);
  if (!site) return;

  const root = document.documentElement;
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const CACHE_KEY = 'darkGoogle:' + site.id;

  let lastEff = null, provisional = false;
  const systemDark = matchMedia('(prefers-color-scheme: dark)');

  let lastRaw = null;

  function update(raw) {
    lastRaw = raw;
    const eff = DG.effective(DG.normalize(raw), site);
    try {
      // Sur les autres sites, on n'écrit rien tant que le thème n'y a jamais servi ; mais après un affichage
      // provisoire (première visite), on retient même « coupé », pour ne plus assombrir ce site un instant.
      if (eff.on || provisional || localStorage.getItem(CACHE_KEY) !== null) localStorage.setItem(CACHE_KEY, JSON.stringify(eff));
    } catch {}
    render(eff);
  }

  // Indique à l'extension si le thème est appliqué ici, pour l'icône de la barre d'outils
  // (envoyé à chaque rendu : l'icône dépend aussi du mode général, qui a pu changer).
  function report(active) {
    const custom = active && !!lastEff?.custom;
    const siteOff = !active && !!lastEff?.siteOff;
    try { chrome.runtime.sendMessage({ type: 'dark-google:tab-state', active, custom, siteOff }).catch(() => {}); } catch {}
  }

  function render(eff) {
    lastEff = eff;
    // Mode Auto : sombre si macOS est en sombre et/ou si l'on est dans l'horaire (selon ce qui est coché).
    const autoDark = (eff.bySystem && systemDark.matches) || eff.night;
    if (!eff.on || (eff.auto && !autoDark)) {
      DGRecolor.clear();
      clearFilter();
      clearIslands();
      applyRules(null);
      if (site.id === 'wikipedia') releaseWikiTheme();
      clearThemeColor();
      report(false);
      return;
    }
    report(true);
    let barColor = eff.bg;
    if (eff.mode === 'native') {
      DGRecolor.clear();
      clearFilter();
      clearIslands();
      forceWikiTheme('night');
      barColor = '#101418';
    } else if (eff.engine === 'recolor') {
      // Recolorer : chaque couleur du CSS est réécrite selon son rôle ; ce qui est déjà sombre le reste,
      // la détection d'un site déjà sombre n'a donc pas lieu d'être.
      clearFilter();
      clearIslands();
      if (site.id === 'wikipedia') forceWikiTheme('day');
      DGRecolor.apply(eff, CACHE_KEY + ':recolor');
    } else if (eff.detect && native.dark) {
      DGRecolor.clear();
      // Le site est déjà sombre (thème du service ou du système) : on ne l'inverse pas, mais ses grands
      // panneaux blancs (zone de lecture et liste de Gmail en thème photo…) passent au thème.
      clearFilter();
      applyIslands(eff);
      barColor = native.bg;
    } else {
      DGRecolor.clear();
      clearIslands();
      if (site.id === 'wikipedia') forceWikiTheme('day'); // évite une double inversion
      applyFilter(eff);
    }
    applyRules(eff);
    if (eff.titleBar) setThemeColor(barColor);
    else clearThemeColor();
  }

  // ---- Site déjà sombre : panneaux blancs ----
  // Ex. Gmail avec un thème photo : les côtés sont sombres, mais la zone de lecture et la liste restent de grands
  // panneaux blancs qui éblouissent. On applique le thème à ces seuls panneaux (attribut ISLAND) ; leurs images
  // gardent leurs vraies couleurs, et la photo de fond n'est pas touchée.

  const ISLAND = 'data-dark-google-island';
  // Dans un panneau assombri, ce qui est déjà sombre (e-mail au design sombre, comme ceux de Steam) garde son aspect.
  const ISLAND_DARK = 'data-dark-google-island-dark';
  let islandStyle = null, islandObserver = null, islandTimer = null, islandSeen = new WeakSet();

  // Avant que le site n'ait appliqué ses propres styles, la page nue est blanche : pendant le chargement, son fond
  // prend la couleur sombre retenue pour ce site, et on la rend au site une fois la page prête.
  let earlyStyle = null;
  function coverDuringLoad() {
    if (document.readyState === 'complete' || earlyStyle) return;
    earlyStyle = document.createElement('style');
    earlyStyle.textContent = `html, body { background-color: ${native.bg || '#111111'} !important; }`;
    root.appendChild(earlyStyle);
    const lift = () => setTimeout(() => { earlyStyle?.remove(); earlyStyle = null; }, 250);
    document.readyState === 'complete' ? lift() : addEventListener('load', lift, { once: true });
  }

  function applyIslands(p) {
    coverDuringLoad();
    const f = DG.cssFilters(p); // filtre CSS : fonctionne partout, sans filtre SVG
    if (!islandStyle) islandStyle = document.createElement('style');
    islandStyle.textContent = `
      [${ISLAND}] { filter: ${f.main} !important; }
      [${ISLAND}] img:not([src*=".svg"]), [${ISLAND}] video, [${ISLAND}] picture img { filter: ${f.revert} !important; }
      [${ISLAND}] [${ISLAND}] { filter: none !important; }
      [${ISLAND}] [${ISLAND_DARK}] { filter: ${f.revert} !important; }
      [${ISLAND}] [${ISLAND_DARK}] img, [${ISLAND}] [${ISLAND_DARK}] video, [${ISLAND}] [${ISLAND_DARK}] [${ISLAND_DARK}] { filter: none !important; }`;
    if (!islandStyle.isConnected) root.appendChild(islandStyle);
    if (islandObserver) return;
    islandSeen = new WeakSet();
    // Les blocs ajoutés sont examinés tout de suite, dans le rappel de l'observateur : il passe avant que le
    // navigateur ne dessine, donc un e-mail qui s'ouvre apparaît directement sombre (aucune image blanche).
    islandObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'attributes') checkIslandTree(m.target); // bloc qui devient visible (fenêtre, carte, menu)
        else for (const node of m.addedNodes) if (node.nodeType === 1) checkIslandTree(node);
      }
    });
    // Dès le tout début du chargement (sur <html>, avant même <body>) : l'écran de chargement blanc est pris aussi.
    islandObserver.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class', 'hidden', 'aria-hidden', 'open'] });
    scheduleIslands();
  }

  // Au début du chargement on réagit vite (écran blanc provisoire), ensuite au plus toutes les 0,5 s.
  function scheduleIslands() {
    if (islandTimer) return;
    const early = performance.now() < 5000;
    islandTimer = setTimeout(() => {
      islandTimer = null;
      early ? markIslands() : (window.requestIdleCallback || setTimeout)(markIslands);
    }, early ? 60 : 500);
  }

  // Parcours d'un bloc ajouté, en ne descendant que dans les éléments assez grands (un enfant dépasse rarement
  // son parent) : rapide, même pour un gros e-mail.
  // Seuils : 4 % de l'écran pour un panneau ; pour un bloc flottant (carte de contact, menu, infobulle…),
  // 0,05 % suffit (une infobulle d'une ligne).
  // Blocs sombres d'un panneau assombri (ou d'un ajout à ce panneau) : on les garde tels quels.
  function markDarkIn(start) {
    for (const el of [start, ...start.querySelectorAll('*')]) {
      if (el.hasAttribute(ISLAND_DARK) || el.parentElement?.closest(`[${ISLAND_DARK}]`)) continue;
      if (/^(IMG|VIDEO|PICTURE|CANVAS|SVG|svg|IFRAME|SCRIPT|STYLE)$/.test(el.tagName)) continue;
      const c = getComputedStyle(el).backgroundColor.match(/[\d.]+/g);
      if (!c || (c[3] !== undefined && Number(c[3]) < 0.8)) continue;
      if (luminance(c.slice(0, 3).map(Number)) >= 0.1) continue;
      const box = el.getBoundingClientRect();
      if (box.width < 24 || box.height < 14) continue;
      el.setAttribute(ISLAND_DARK, '');
    }
  }

  function checkIslandTree(start) {
    if (start.closest?.(`[${ISLAND}]`) && !start.hasAttribute(ISLAND)) { markDarkIn(start); return; } // contenu ajouté dans un panneau
    const screen = innerWidth * innerHeight;
    const stack = [start];
    while (stack.length) {
      const el = stack.pop();
      if (/^(IMG|VIDEO|PICTURE|CANVAS|SVG|svg|IFRAME|SCRIPT|STYLE)$/.test(el.tagName)) continue;
      if (el.hasAttribute(ISLAND) || el.parentElement?.closest(`[${ISLAND}]`)) continue;
      const box = el.getBoundingClientRect();
      const area = box.width * box.height;
      if (area < screen * 0.0005) continue;
      const cs = getComputedStyle(el);
      const floating = /fixed|absolute/.test(cs.position) || el.getAttribute('role') === 'tooltip';
      if (area < screen * 0.04 && !floating) { if (area >= screen * 0.01) for (const child of el.children) stack.push(child); continue; }
      const c = cs.backgroundColor.match(/[\d.]+/g);
      const white = c && (c[3] === undefined || Number(c[3]) >= 0.8) && luminance(c.slice(0, 3).map(Number)) >= 0.6;
      if (white && islandAllowed(el, box)) {
        el.setAttribute(ISLAND, '');
        markDarkIn(el);
        continue;
      }
      for (const child of el.children) stack.push(child);
    }
  }

  // Jamais <body> ni un bloc de la taille de la page qui contient une photo de fond : la photo repasserait
  // en négatif.
  function islandAllowed(el, box) {
    if (el === document.body) return false;
    if (box.width * box.height < innerWidth * innerHeight * 0.85) return true;
    for (const child of el.querySelectorAll('*')) {
      if (!/url\(/.test(getComputedStyle(child).backgroundImage)) continue;
      const b = child.getBoundingClientRect();
      if (b.width * b.height >= innerWidth * innerHeight * 0.25) return false;
    }
    return true;
  }

  function markIslands() {
    if (!islandObserver || !document.body) return;
    const minArea = innerWidth * innerHeight * 0.04;
    for (const el of document.body.querySelectorAll('*')) {
      if (islandSeen.has(el)) continue;
      if (/^(IMG|VIDEO|PICTURE|CANVAS|SVG|svg|IFRAME|SCRIPT|STYLE)$/.test(el.tagName)) { islandSeen.add(el); continue; }
      if (el.hasAttribute(ISLAND) || el.parentElement?.closest(`[${ISLAND}]`)) { islandSeen.add(el); continue; }
      const area = el.getBoundingClientRect();
      if (!area.width || !area.height) continue; // pas encore affiché : on reverra plus tard
      islandSeen.add(el);
      if (area.width * area.height < minArea) continue;
      const c = getComputedStyle(el).backgroundColor.match(/[\d.]+/g);
      if (!c || (c[3] !== undefined && Number(c[3]) < 0.8)) continue;
      if (luminance(c.slice(0, 3).map(Number)) < 0.6) continue;
      if (!islandAllowed(el, area)) continue;
      el.setAttribute(ISLAND, '');
      markDarkIn(el);
    }
  }

  function clearIslands() {
    earlyStyle?.remove();
    earlyStyle = null;
    if (!islandObserver && !islandStyle?.isConnected) return;
    islandObserver?.disconnect();
    islandObserver = null;
    clearTimeout(islandTimer);
    islandTimer = null;
    islandStyle?.remove();
    document.querySelectorAll(`[${ISLAND}], [${ISLAND_DARK}]`).forEach((el) => { el.removeAttribute(ISLAND); el.removeAttribute(ISLAND_DARK); });
  }

  // ---- Détection d'un thème sombre d'origine ----
  // Les styles calculés ne sont pas touchés par notre filtre : on lit donc toujours les vraies couleurs du site,
  // qu'il soit filtré ou non. On échantillonne le fond à 9 endroits de l'écran et on garde la valeur médiane.

  const DARK_BELOW = 0.2, LIGHT_ABOVE = 0.4; // luminance relative ; l'écart évite de basculer sans arrêt
  const native = { dark: false, bg: '#000000' };

  // Un panneau déjà passé au thème (ISLAND) ne compte pas : son fond calculé reste blanc, et un grand e-mail
  // blanc (CAF…) faisait juger Gmail « clair », d'où la page entière inversée, photo de fond comprise.
  // On renvoie null : seul le cadre du site décide.
  function backgroundAt(x, y) {
    const hit = document.elementFromPoint(x, y);
    if (hit?.closest(`[${ISLAND}]`) && !hit.closest(`[${ISLAND_DARK}]`)) return null;
    for (let el = hit; el; el = el.parentElement) {
      if (el === root) break;
      const c = getComputedStyle(el).backgroundColor.match(/[\d.]+/g);
      if (c && (c[3] === undefined || Number(c[3]) > 0.5)) return c.slice(0, 3).map(Number);
    }
    // Rien d'opaque : c'est le fond de la page (ou du navigateur, blanc par défaut) qui se voit.
    for (const el of [document.body, root]) {
      if (!el) continue;
      const c = getComputedStyle(el).backgroundColor.match(/[\d.]+/g);
      if (c && (c[3] === undefined || Number(c[3]) > 0.5)) return c.slice(0, 3).map(Number);
    }
    return [255, 255, 255];
  }

  const luminance = ([r, g, b]) => {
    const lin = (v) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  };
  const toHex = (rgb) => '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

  // Pendant le chargement, la page montre souvent un écran provisoire (écran blanc de Gmail…) : décider à ce
  // moment-là faisait inverser la page, photos en négatif, puis tout remettre quelques secondes plus tard.
  // On attend donc la fin du chargement, et un changement d'avis doit se confirmer deux fois de suite ;
  // d'ici là, on garde ce qu'on avait appris à la visite précédente.
  let pendingDark = null, nativeKnown = false; // nativeKnown : thème du site déjà observé lors d'une visite
  const loadedAt = { t: 0 };
  addEventListener('load', () => (loadedAt.t = Date.now()), { once: true });

  function detectNativeTheme() {
    if (!lastEff?.on || lastEff.engine === 'recolor' || !document.body || document.hidden || !innerWidth || !innerHeight) return;
    // Première visite : rien de connu, on décide dès que la structure de la page est prête (sinon un site déjà
    // sombre resterait inversé, donc clair, plusieurs secondes). Ensuite : après chargement et confirmation.
    const firstLook = !nativeKnown;
    if (firstLook ? document.readyState === 'loading' : document.readyState !== 'complete' || !loadedAt.t || Date.now() - loadedAt.t < 1200) return;
    const samples = [];
    for (const fx of [0.15, 0.5, 0.85]) {
      for (const fy of [0.15, 0.5, 0.85]) {
        const rgb = backgroundAt(innerWidth * fx, innerHeight * fy);
        if (rgb) samples.push({ rgb, l: luminance(rgb) });
      }
    }
    if (!samples.length) return; // tout l'écran est fait de panneaux déjà au thème : on garde l'avis actuel
    samples.sort((a, b) => a.l - b.l);
    const median = samples[samples.length >> 1];
    let dark = median.l < DARK_BELOW ? true : median.l > LIGHT_ABOVE ? false : native.dark;
    nativeKnown = true;
    if (firstLook) {
      pendingDark = null;
    } else if (dark !== native.dark) {
      if (pendingDark !== dark) { pendingDark = dark; dark = native.dark; } // première fois : on attend confirmation
      else pendingDark = null;
    } else {
      pendingDark = null;
    }
    // La barre de titre prend la couleur du haut de la page (en-tête) si elle est sombre, sinon la médiane.
    const top = backgroundAt(innerWidth * 0.5, 4);
    const bg = toHex(top && luminance(top) < DARK_BELOW ? top : median.rgb);
    if (dark === native.dark && bg === native.bg) return;
    native.dark = dark;
    native.bg = bg;
    try { localStorage.setItem(CACHE_KEY + ':native', JSON.stringify(native)); } catch {}
    if (lastEff) render(lastEff);
  }

  // Le popup demande l'état réel de la page pour l'afficher.
  chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
    if (window !== top) return; // cadres : seule la page principale répond au menu
    if (msg?.type === 'dark-google:pick') {
      startPicker();
      reply(true);
      return;
    }
    if (msg?.type === 'dark-google:status') {
      detectNativeTheme();
      reply({ nativeDark: native.dark, filtered: filterOn });
    }
  });

  // ---- Filtre de couleur ----

  let svg, mainMatrix, revertMatrix, style, filterOn = false, svgWanted = false, currentRevert = '';

  function makeFilter(id) {
    const filter = document.createElementNS(SVG_NS, 'filter');
    filter.id = id;
    filter.setAttribute('color-interpolation-filters', 'sRGB');
    const matrix = document.createElementNS(SVG_NS, 'feColorMatrix');
    matrix.setAttribute('type', 'matrix');
    filter.appendChild(matrix);
    svg.appendChild(filter);
    return matrix;
  }

  function applyFilter(p) {
    if (!svg) {
      svg = document.createElementNS(SVG_NS, 'svg');
      svg.setAttribute('aria-hidden', 'true');
      svg.style.cssText = 'position:absolute!important;width:0!important;height:0!important;overflow:hidden!important;pointer-events:none!important';
      mainMatrix = makeFilter('dark-google-main');
      revertMatrix = makeFilter('dark-google-revert');
      style = document.createElement('style');
    }
    let revert;
    if (p.engine === 'css') {
      const f = DG.cssFilters(p);
      revert = f.revert;
      if (f.revertMatrix) {
        revertMatrix.setAttribute('values', f.revertMatrix);
        revert = 'url("#dark-google-revert")';
        svgWanted = true;
      } else {
        svgWanted = false;
      }
      style.textContent = filterCss(f.main, revert) + keepCss(f.main, revert, p.variant);
    } else {
      const m = DG.matrices(p);
      mainMatrix.setAttribute('values', m.main);
      revertMatrix.setAttribute('values', m.revert);
      revert = 'url("#dark-google-revert")';
      style.textContent = filterCss('url("#dark-google-main")', revert) + keepCss('url("#dark-google-main")', revert, p.variant);
      svgWanted = true;
    }
    if (svgWanted && !svg.isConnected) root.appendChild(svg);
    if (!svgWanted) svg.remove();
    currentRevert = revert;
    setCanvasFilter(revert);
    if (!style.isConnected) root.appendChild(style);
    filterOn = true;
    // Les zones déjà sombres sont toujours gardées (niveau 1) ; les variantes ajoutent les couleurs (2) puis le « tout sombre » (3).
    setKeepLevel((p.variant || 0) + 1);
  }

  // ---- Variantes : éléments qui gardent leur aspect d'origine ----
  // Inverser une page claire rend clairs ses éléments déjà sombres (bandeau d'Amazon…) et délave ses blocs
  // de couleur vive. Selon la variante, on repère ces éléments (attribut data-dark-google-keep) et on leur
  // applique la correction inverse : ils ressortent comme sur le site d'origine.

  const KEEP = 'data-dark-google-keep';
  // Variante 3 « tout sombre » : dans une zone gardée, ce qui est clair (champ de recherche, boutons blancs…)
  // reprend le thème sombre.
  const FLIP = 'data-dark-google-flip';
  // Papier peint (ex. thème photo de Gmail) : grande image de fond sans texte. L'inverser n'en fait qu'un
  // négatif ; on lui rend ses vraies couleurs, comme aux photos.
  const WALL = 'data-dark-google-wall';
  let keepLevel = 0, keepTimer = null, keepObserver = null, keepSeen = new WeakSet();

  function keepCss(main, revert, variant) {
    // « Tout sombre » : champs de recherche et de saisie légèrement creusés, sobrement (une simple ombre
    // intérieure en haut, sans liseré ; les coins restent ceux du site). Couleur donnée avant inversion.
    const sunken = variant >= 2 ? `
      input[type="search"], input[type="text"], input:not([type]), textarea, [role="searchbox"], [role="combobox"] {
        box-shadow: inset 0 2px 3px -1px rgba(0, 0, 0, .18) !important;
      }` : '';
    return sunken + `
      [${WALL}] { filter: ${revert} !important; }
      [${KEEP}] { filter: ${revert} !important; }
      [${KEEP}] img, [${KEEP}] video, [${KEEP}] picture img, [${KEEP}] [${KEEP}] { filter: none !important; }
      [${KEEP}] [${FLIP}] { filter: ${main} !important; }
      [${KEEP}] [${FLIP}] img, [${KEEP}] [${FLIP}] video { filter: ${revert} !important; }`;
  }

  // ---- Règles par élément, choisies avec le sélecteur ----

  // Feuille à part, valable que la page soit inversée ou non (site déjà sombre comme Gmail : la page n'est pas
  // inversée, seuls ses panneaux blancs le sont). « Thème » et « Couleurs d'origine » s'écrivent différemment
  // selon le cas ; « Masquer » cache l'élément dans tous les cas.
  let rulesStyle = null;
  function applyRules(eff) {
    const rules = eff?.rules || [];
    if (!rules.length) { rulesStyle?.remove(); return; }
    const f = DG.cssFilters(eff);
    const revert = filterOn ? currentRevert : f.revert;
    const css = rules.map(({ sel, mode }) => {
      try { if (!CSS.supports(`selector(${sel})`)) return ''; } catch { return ''; }
      if (mode === 'off') return `\nhtml ${sel} { display: none !important; }`;
      if (filterOn) {
        return mode === 'orig'
          ? `\nhtml ${sel} { filter: ${revert} !important; } html ${sel} img, html ${sel} video { filter: none !important; }`
          : `\nhtml ${sel}, html ${sel}[${KEEP}] { filter: none !important; }`;
      }
      // Page non inversée : un élément peut se trouver dans un panneau blanc déjà passé au thème (ISLAND).
      return mode === 'orig'
        ? `\nhtml ${sel}, html ${sel}[${ISLAND}] { filter: none !important; } html [${ISLAND}] ${sel} { filter: ${f.revert} !important; }`
        : `\nhtml ${sel} { filter: ${f.main} !important; } html ${sel} img:not([src*=".svg"]), html ${sel} video { filter: ${f.revert} !important; }` +
          ` html [${ISLAND}] ${sel} { filter: none !important; }`;
    }).join('');
    if (!rulesStyle) rulesStyle = document.createElement('style');
    rulesStyle.textContent = css;
    if (!rulesStyle.isConnected || rulesStyle !== root.lastElementChild) root.appendChild(rulesStyle); // en dernier : prioritaire
  }

  async function saveRule(sel, mode) {
    const { state: raw } = await chrome.storage.local.get('state');
    const state = DG.normalize(raw);
    const conf = DG.conf(state, site, true);
    conf.rules = conf.rules.filter((r) => r.sel !== sel);
    if (mode) conf.rules.push({ sel, mode });
    await chrome.storage.local.set({ state });
  }

  // Sélecteur CSS assez précis pour retrouver l'élément au prochain chargement (identifiants et classes
  // qui ressemblent à du généré automatiquement écartés).
  function selectorFor(el) {
    const parts = [];
    for (let e = el; e && e !== document.body && e !== root && parts.length < 6; e = e.parentElement) {
      if (e.id && !/\d{3,}|:/.test(e.id)) { parts.unshift('#' + CSS.escape(e.id)); break; }
      let part = e.tagName.toLowerCase();
      const cls = [...e.classList].filter((c) => !/\d{3,}|active|hover|selected|open|focus/i.test(c)).slice(0, 2);
      if (cls.length) part += '.' + cls.map((c) => CSS.escape(c)).join('.');
      else if (e.parentElement) {
        const same = [...e.parentElement.children].filter((x) => x.tagName === e.tagName);
        if (same.length > 1) part += `:nth-of-type(${same.indexOf(e) + 1})`;
      }
      parts.unshift(part);
    }
    return parts.join(' > ');
  }

  // Sélecteur dans la page : survol = cadre jaune, clic = petit menu Thème / Couleurs d'origine / Masquer.
  // Tout ce qui est affiché par DARKee porte KEEP : la page est filtrée, eux gardent leurs vraies couleurs.
  let picking = false;
  function startPicker() {
    if (picking) return;
    picking = true;
    const box = document.createElement('div');
    box.setAttribute(KEEP, '');
    box.style.cssText = 'position:fixed;z-index:2147483646;pointer-events:none;border:2px solid #fdd663;background:#fdd66326;border-radius:4px;display:none';
    const host = document.createElement('div');
    host.setAttribute(KEEP, '');
    host.style.cssText = 'position:fixed;z-index:2147483647;top:12px;left:50%;transform:translateX(-50%)';
    const ui = host.attachShadow({ mode: 'closed' });
    ui.innerHTML = `<style>
      .bar{font:13px system-ui,-apple-system,sans-serif;background:#1d1e22;color:#e6e6ea;border:1px solid #fdd66399;border-radius:10px;padding:8px 10px;box-shadow:0 6px 24px #0008;display:flex;gap:6px;align-items:center}
      b{color:#fdd663;font-weight:600;margin-right:4px}
      button{font:inherit;font-size:12px;border:1px solid #3a3b42;background:#26272c;color:#e6e6ea;border-radius:7px;padding:4px 9px;cursor:pointer}
      button:hover{border-color:#9a9ba3} .main{background:#fdd663;color:#3a2c00;border-color:#fdd663;font-weight:600}
      .hint{color:#9a9ba3}
    </style><div class="bar"><b>DARKee</b><span class="hint">Clique sur un élément de la page · Échap pour annuler</span></div>`;
    root.append(box, host);
    let target = null;

    const isOurs = (el) => el === box || el === host;
    const onMove = (e) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el || isOurs(el) || el === root || el === document.body) return;
      target = el;
      const r = el.getBoundingClientRect();
      Object.assign(box.style, { display: 'block', left: `${r.left - 2}px`, top: `${r.top - 2}px`, width: `${r.width}px`, height: `${r.height}px` });
    };
    const stop = () => {
      picking = false;
      removeEventListener('mousemove', onMove, true);
      removeEventListener('click', onClick, true);
      removeEventListener('keydown', onKey, true);
      box.remove();
      host.remove();
    };
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); stop(); } };
    const onClick = (e) => {
      if (isOurs(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      if (!target) return;
      removeEventListener('mousemove', onMove, true);
      removeEventListener('click', onClick, true);
      const sel = selectorFor(target);
      ui.querySelector('.bar').innerHTML = `<b>DARKee</b>
        <button data-mode="on" title="Le thème sombre s'applique à cet élément">Thème</button>
        <button data-mode="orig" class="main" title="L'élément garde ses vraies couleurs">Couleurs d'origine</button>
        <button data-mode="off" title="L'élément est caché">Masquer</button>
        <button data-mode="" title="Retire la règle de cet élément">Par défaut</button>
        <button data-cancel>Annuler</button>`;
      ui.querySelectorAll('button').forEach((b) => b.addEventListener('click', async (ev) => {
        ev.stopPropagation();
        if (!b.hasAttribute('data-cancel')) await saveRule(sel, b.dataset.mode || null);
        stop();
      }));
    };
    addEventListener('mousemove', onMove, true);
    addEventListener('click', onClick, true);
    addEventListener('keydown', onKey, true);
  }

  // Le repérage tourne dès que le filtre est actif (papiers peints) ; les variantes y ajoutent les zones gardées.
  function setKeepLevel(level) {
    if (level === keepLevel && keepObserver) return;
    keepLevel = level;
    document.querySelectorAll(`[${KEEP}], [${FLIP}], [${WALL}]`).forEach((el) => {
      el.removeAttribute(KEEP); el.removeAttribute(FLIP); el.removeAttribute(WALL);
    });
    keepSeen = new WeakSet();
    keepObserver?.disconnect();
    keepObserver = null;
    if (level < 0) return; // filtre coupé
    scheduleKeep(0);
    keepObserver = new MutationObserver(() => scheduleKeep(800));
    // Une fois tous les styles chargés, on réexamine tout (des fonds ont pu arriver après le premier passage).
    addEventListener('load', () => { keepSeen = new WeakSet(); scheduleKeep(0); }, { once: true });
    const watch = () => keepObserver?.observe(document.body, { childList: true, subtree: true });
    document.body ? watch() : document.addEventListener('DOMContentLoaded', watch, { once: true });
  }

  // Au plus un passage toutes les 0,8 s, même si la page bouge sans arrêt (carrousels…).
  function scheduleKeep(delay) {
    if (keepTimer) return;
    keepTimer = setTimeout(() => {
      keepTimer = null;
      (window.requestIdleCallback || setTimeout)(markKeepers);
    }, delay);
  }

  function isWallpaper(el, cs) {
    if (!/url\(/.test(cs.backgroundImage)) return false;
    const box = el.getBoundingClientRect();
    if (box.width * box.height < innerWidth * innerHeight * 0.25) return false;
    return !el.textContent.trim() && !el.querySelector('img, video, input, button, a'); // un simple calque d'image
  }

  function markKeepers() {
    if (!filterOn || !document.body) return;
    for (const el of document.body.querySelectorAll('*')) {
      if (keepSeen.has(el)) continue; // chaque élément n'est examiné qu'une fois
      keepSeen.add(el);
      if (el.hasAttribute(KEEP)) continue;
      if (/^(IMG|VIDEO|PICTURE|CANVAS|SVG|svg|IFRAME|SCRIPT|STYLE|LINK|META)$/.test(el.tagName)) continue;
      const cs = getComputedStyle(el);
      if (isWallpaper(el, cs)) { el.setAttribute(WALL, ''); continue; }
      if (!keepLevel) continue;
      const c = cs.backgroundColor.match(/[\d.]+/g);
      if (!c || (c[3] !== undefined && Number(c[3]) < 0.6)) continue;
      const rgb = c.slice(0, 3).map(Number);
      const l = luminance(rgb);
      const max = Math.max(...rgb), min = Math.min(...rgb);
      const sat = max ? (max - min) / max : 0;
      if (el.parentElement?.closest(`[${KEEP}]`)) {
        // Dans une zone gardée : en « tout sombre », le clair neutre (blancs, gris) repasse au thème ;
        // les couleurs vives (bouton orange de recherche…) restent telles quelles.
        if (keepLevel >= 3 && l > 0.5 && sat < 0.25 && !el.parentElement.closest(`[${FLIP}]`)) el.setAttribute(FLIP, '');
        continue;
      }
      const keep = l < 0.1 || (keepLevel >= 2 && sat > 0.4 && l < 0.65);
      if (!keep) continue;
      const box = el.getBoundingClientRect();
      if (box.width < 24 || box.height < 14) continue; // pastilles et icônes : on laisse
      el.setAttribute(KEEP, '');
    }
  }

  function filterCss(main, revert) {
    const images = `
      img:not([src*=".svg"]), video, embed, object,
      iframe[src*="youtube.com/embed"], iframe[src*="youtube-nocookie.com/embed"] {
        filter: ${revert} !important;
      }`;
    return `
      :where(html) { background-color: #fff; }
      html { min-height: 100% !important; filter: ${main} !important; }
      ${images}
      :fullscreen video, video:fullscreen, iframe:fullscreen { filter: none !important; }`;
  }

  // Docs, Sheets, Slides : les photos sont dessinées dans un canvas ; canvas-images.js (dans la page) lit
  // cette correction au moment de les dessiner et repeint aussitôt les photos déjà affichées quand elle change.
  function setCanvasFilter(value) {
    if ((root.dataset.darkGoogleCanvas || '') === value) return;
    if (value) root.dataset.darkGoogleCanvas = value;
    else delete root.dataset.darkGoogleCanvas;
  }

  function clearFilter() {
    setKeepLevel(-1);
    setCanvasFilter('');
    filterOn = false;
    svg?.remove();
    style?.remove();
  }

  // Le navigateur peut reconstruire <head>/<body> pendant le chargement : on vérifie que tout est encore là.
  document.addEventListener('DOMContentLoaded', () => {
    if (filterOn) {
      if (svgWanted && !svg.isConnected) root.appendChild(svg);
      if (!style.isConnected) root.appendChild(style);
    }
    enforceThemeColor();
  });

  // ---- Wikipédia : thème sombre natif mémorisé ----

  // Wikipédia garde ce choix dans un cookie « <wiki>mwclientpreferences » (ex. frwikimwclientpreferences),
  // perdu dès que les cookies sont effacés ou expirent : on le réécrit à chaque visite.
  const WIKI_COOKIE = location.hostname.split('.')[0].replace(/-/g, '_') + 'wikimwclientpreferences';
  const WIKI_CLASSES = ['skin-theme-clientpref-day', 'skin-theme-clientpref-night', 'skin-theme-clientpref-os'];
  let wikiTheme = null, wikiObserver = null;

  function setWikiPref(theme) {
    const match = document.cookie.match(new RegExp('(?:^|; )' + WIKI_COOKIE + '=([^;]*)'));
    const prefs = (match ? match[1] : '')
      .split('%2C')
      .filter((x) => x && !x.startsWith('skin-theme-clientpref-'));
    prefs.push('skin-theme-clientpref-' + theme);
    document.cookie = `${WIKI_COOKIE}=${prefs.join('%2C')}; path=/; max-age=31536000; secure; samesite=lax`;
  }

  function applyWikiClass() {
    const wanted = 'skin-theme-clientpref-' + wikiTheme;
    if (!wikiTheme || root.classList.contains(wanted)) return;
    root.classList.remove(...WIKI_CLASSES);
    root.classList.add(wanted);
  }

  function forceWikiTheme(theme) {
    if (site.id !== 'wikipedia') return;
    wikiTheme = theme;
    setWikiPref(theme);
    applyWikiClass();
    if (!wikiObserver) {
      wikiObserver = new MutationObserver(applyWikiClass);
      wikiObserver.observe(root, { attributes: true, attributeFilter: ['class'] });
    }
  }

  function releaseWikiTheme() {
    if (!wikiTheme) return;
    wikiObserver?.disconnect();
    wikiObserver = null;
    wikiTheme = null;
    setWikiPref('os');
    root.classList.remove(...WIKI_CLASSES);
    root.classList.add('skin-theme-clientpref-os');
  }

  // ---- Barre de titre des web apps (balise theme-color) ----

  let themeColor = null, themeObserver = null, fixes = 0, fixWindow = 0;
  const originals = new Map();

  function enforceThemeColor() {
    const head = document.head;
    if (!head || !themeColor) return;
    if (!themeObserver) {
      themeObserver = new MutationObserver(enforceThemeColor);
      themeObserver.observe(head, { childList: true, subtree: true, attributes: true, attributeFilter: ['content', 'media'] });
    }
    let metas = head.querySelectorAll('meta[name="theme-color"]');
    if (!metas.length) {
      const meta = document.createElement('meta');
      meta.name = 'theme-color';
      meta.dataset.darkGoogle = '';
      head.appendChild(meta);
      metas = [meta];
    }
    for (const meta of metas) {
      if (meta.content === themeColor && !meta.hasAttribute('media')) continue;
      // Garde-fou : si une autre extension réécrit la même balise en boucle, on abandonne plutôt que de figer la page.
      const now = Date.now();
      if (now - fixWindow > 1000) { fixWindow = now; fixes = 0; }
      if (++fixes > 30) return;
      if (!originals.has(meta)) originals.set(meta, { content: meta.content, media: meta.getAttribute('media') });
      meta.removeAttribute('media');
      meta.content = themeColor;
    }
  }

  function setThemeColor(color) {
    themeColor = color;
    enforceThemeColor();
  }

  function clearThemeColor() {
    if (!themeColor) return;
    themeColor = null;
    themeObserver?.disconnect();
    themeObserver = null;
    for (const [meta, orig] of originals) {
      if (meta.dataset.darkGoogle !== undefined) { meta.remove(); continue; }
      meta.content = orig.content;
      if (orig.media) meta.setAttribute('media', orig.media);
    }
    originals.clear();
    document.querySelectorAll('meta[data-dark-google]').forEach((m) => m.remove());
  }

  // ---- Démarrage (après les déclarations ci-dessus) ----

  // Copie locale des derniers réglages (et du thème détecté à la dernière visite) : lue de façon synchrone
  // pour éviter le flash blanc au chargement, et pour ne pas inverser un instant un site déjà sombre.
  // Première visite d'un site (rien en mémoire) : on applique tout de suite le thème avec les réglages par défaut,
  // sans attendre la lecture des réglages (quelques millisecondes pendant lesquelles la page pourrait s'afficher
  // en blanc) ; ils corrigent l'affichage dès qu'ils arrivent.
  try {
    const knownNative = JSON.parse(localStorage.getItem(CACHE_KEY + ':native'));
    if (knownNative) { Object.assign(native, knownNative); nativeKnown = true; }
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
    provisional = !cached;
    render(cached || DG.effective(DG.normalize(null), site));
  } catch {}

  // Vérifie le thème du site une fois chargé, puis régulièrement (le service ou le système peuvent en changer).
  document.addEventListener('DOMContentLoaded', detectNativeTheme);
  addEventListener('load', () => setTimeout(detectNativeTheme, 1300));
  document.addEventListener('visibilitychange', detectNativeTheme);
  systemDark.addEventListener('change', () => {
    if (lastEff) render(lastEff); // mode Auto
    setTimeout(detectNativeTheme, 300);
  });
  setInterval(detectNativeTheme, 2500);
  // Mode Horaire : on réévalue chaque minute (passage jour / nuit).
  setInterval(() => { if (lastRaw && DG.normalize(lastRaw).autoBy.schedule) update(lastRaw); }, 60000);

  chrome.storage.local.get('state', ({ state }) => update(state));
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.state) update(changes.state.newValue);
  });
})();
