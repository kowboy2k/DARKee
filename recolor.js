// DARKee – moteur « Recolorer » : au lieu d'inverser la page, on lit son CSS (feuilles, styles en ligne,
// variables) et on réécrit chaque couleur selon son rôle. Un fond clair devient sombre, un fond déjà sombre
// reste tel quel ; un texte sombre devient clair, un texte déjà clair reste clair. Les images ne sont pas touchées.
// Réinjecté (raccourci, menu) : on garde l'instance déjà en place, qui tient les feuilles appliquées.
var DGRecolor = globalThis.DGRecolor || (() => {
  const root = document.documentElement;
  const MARK = 'data-darkee'; // nos propres feuilles, jamais relues
  const INLINE = 'data-darkee-i';

  // ---- Couleurs ----

  const ctx = document.createElement('canvas').getContext('2d');
  const parsed = new Map();
  const SKIP_WORDS = /^(transparent|currentcolor|inherit|initial|unset|revert|none|auto|canvas|canvastext|field|fieldtext|buttonface|buttontext|buttonborder|linktext|visitedtext|activetext|graytext|highlight|highlighttext|mark|marktext|accentcolor|accentcolortext|selecteditem|selecteditemtext)$/i;
  const isNamed = new Map();

  function parse(str) {
    if (parsed.has(str)) return parsed.get(str);
    let out = null;
    ctx.fillStyle = '#010203';
    ctx.fillStyle = str;
    const v = ctx.fillStyle;
    if (v !== '#010203' || /^#010203$/i.test(str)) {
      if (v[0] === '#') out = [parseInt(v.slice(1, 3), 16), parseInt(v.slice(3, 5), 16), parseInt(v.slice(5, 7), 16), 1];
      else { const n = v.match(/[\d.]+/g).map(Number); out = [n[0], n[1], n[2], n[3] ?? 1]; }
    }
    parsed.set(str, out);
    return out;
  }

  function toHsl([r, g, b]) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
    if (max === min) return [0, 0, l];
    const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h * 60, s, l];
  }

  function toRgb(h, s, l) {
    h = ((h % 360) + 360) % 360 / 360;
    if (!s) return [l, l, l].map((v) => Math.round(v * 255));
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const f = (t) => {
      t = (t + 1) % 1;
      return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p;
    };
    return [f(h + 1 / 3), f(h), f(h - 1 / 3)].map((v) => Math.round(v * 255));
  }

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const hsl = ([h, s, l]) => `rgb(${toRgb(h, s, l).join(', ')})`;

  // ---- Palette du thème ----
  // Tirée du fond, du texte et de la saturation du thème : chaque thème a ses surfaces (teintées dans la
  // couleur de son fond), son texte, son texte secondaire, sa couleur de lien et son intensité de couleur.
  let P = null;
  function setParams(p) {
    const bg = toHsl(parse(p.bg) || [27, 28, 32]);
    const fg = toHsl(parse(p.fg) || [228, 228, 231]);
    const tint = bg[1] > 0.08; // fond teinté (Bleu nuit, Nuit chaude) : le neutre prend sa teinte
    P = {
      bg, fg,
      // Teinte et saturation du « neutre » du thème (gris de la page, des cartes, des bordures).
      nh: bg[0], ns: Math.min(bg[1], 0.45), fns: Math.min(fg[1], 0.3),
      // Écart de clarté entre le fond et le plus clair des fonds : de quoi garder la hiérarchie des blocs.
      span: clamp(0.3 - bg[2], 0.14, 0.3),
      // Plafond de saturation des couleurs du site : plus bas pour les thèmes feutrés.
      chroma: clamp(0.62 * (p.saturation ?? 100) / 100, 0.2, 0.75),
      link: tint ? [bg[0], 0.55, 0.74] : [215, 0.85, 0.76],
      bright: (p.brightness ?? 100) / 100,
      contrast: (p.contrast ?? 100) / 100,
      sat: (p.saturation ?? 100) / 100,
      hue: p.hue || 0,
      warm: (p.temperature || 0) / 100,
      variant: p.variant || 0,
      t: THRESHOLDS[p.variant || 0] || THRESHOLDS[0],
      dimImages: p.imageMode !== 'keep',
      images: (p.images ?? 90) / 100,
    };
    // Profond : fond de départ plus bas et surfaces resserrées vers lui.
    P.base = P.variant === 2 ? bg[2] * 0.6 : bg[2];
    if (P.variant === 2) P.span *= 0.5;
  }

  const cache = new Map();
  const NEUTRAL = 0.12; // en dessous de cette saturation, une couleur est un gris

  // Luminance perçue (WCAG) : ce que l'œil reçoit vraiment. Le jaune #FFD814 (0,71) éblouit autant qu'un gris
  // clair, alors que sa clarté HSL (54 %) le dit « moyen » : toutes les décisions clair / foncé se font sur elle.
  function lum([r, g, b]) {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  }
  // Clarté perçue (CIE L*, de 0 à 1) : une échelle régulière pour l'œil, où placer les tons d'arrivée.
  const perceived = (y) => (y > 0.008856 ? 1.16 * Math.cbrt(y) - 0.16 : y * 9.033);

  // Variantes, de plus en plus appuyées (le thème, lui, donne l'ambiance : neutre, chaude, froide…) :
  //  0 Classique : les fonds clairs passent au sombre, les couleurs du site gardent leur teinte (adoucie).
  //  1 Renforcé  : seuil bien plus bas (les tons moyens y passent aussi) et fonds colorés ramenés au neutre.
  //  2 Profond   : comme Renforcé, et tout plus foncé (surfaces, bordures, images) ; seul le texte garde son éclat.
  // Seuils : au-dessus de « bg », un fond est assez clair pour être assombri ; en dessous de « fg », un texte
  // est assez foncé pour être éclairci.
  const THRESHOLDS = [{ bg: 0.2, fg: 0.2 }, { bg: 0.06, fg: 0.35 }, { bg: 0.03, fg: 0.45 }];

  // Clarté d'arrivée d'un fond clair : le blanc devient le fond du thème ; plus un fond est proche du seuil, plus
  // il arrive haut dans les surfaces. Courbe en racine : les petits écarts entre gris très clairs (cartes,
  // en-têtes, encarts) sont agrandis, la hiérarchie des blocs reste lisible.
  const darkL = (y) => P.base + P.span * Math.sqrt(clamp((1 - perceived(y)) / (1 - perceived(P.t.bg))));

  // Rôle : 'bg' fond, 'fg' texte et icônes, 'border' bordures, 'shadow' ombres.
  function mapColor(rgba, role) {
    const key = role + rgba.join(',');
    if (cache.has(key)) return cache.get(key);
    const [h, s, l] = toHsl(rgba);
    const y = lum(rgba);
    const grey = s < NEUTRAL || (y > 0.8 && s < 0.4); // blancs cassés compris
    const vivid = s > 0.35 && l > 0.2 && l < 0.8;
    let out;
    if (role === 'fg') {
      const dark = y < P.t.fg;
      const k = clamp(perceived(y) / perceived(P.t.fg)); // 0 noir … 1 au seuil
      if (grey) {
        // Texte neutre : noir → texte du thème, gris → texte secondaire ; déjà clair : plafonné au texte du thème.
        out = [P.fg[0], P.fns, dark ? P.fg[2] - k * (P.fg[2] - 0.6) : Math.min(l, P.fg[2])];
      } else {
        // Texte coloré (liens, prix, alertes) : sa teinte reste, assez claire pour se lire sur le sombre.
        out = [h, Math.min(s, P.chroma + 0.1), dark ? 0.82 - k * 0.16 : Math.min(l, 0.86)];
      }
    } else if (role === 'border') {
      // Bordure claire : un cran au-dessus des surfaces ; bordure foncée : un gris moyen discret.
      const nl = y > P.t.bg ? darkL(y) + (P.variant === 2 ? 0.05 : 0.07) : clamp(0.5 - perceived(y) * 0.4, 0.3, 0.5) * (P.variant === 2 ? 0.7 : 1);
      out = grey || P.variant > 0 ? [P.nh, P.ns, nl] : [h, Math.min(s, P.chroma) * 0.6, nl];
    } else if (role === 'shadow') {
      out = y < 0.2 ? [h, s, l] : [P.nh, P.ns, P.base * 0.5]; // ombre claire (lueur) → ombre sombre
    } else if (y <= P.t.bg) {
      // Fond déjà assez sombre pour la variante : gardé (Profond : encore un peu baissé) ; criard : calmé.
      out = [h, s > 0.6 && l > 0.15 ? s * 0.75 : s, P.variant === 2 ? l * 0.8 : l];
    } else if (grey) {
      out = [P.nh, P.ns, darkL(y)];
    } else if (P.variant > 0) {
      // Renforcé, Profond : un fond coloré devient une surface du thème, juste teintée de sa couleur d'origine.
      out = [h, Math.min(s * 0.35, 0.18), darkL(y) + (vivid ? 0.03 : 0)];
    } else {
      // Classique : la teinte du site reste, assombrie et adoucie.
      out = [h, Math.min(s * 0.7, P.chroma), clamp(darkL(y) + (vivid ? 0.06 : 0), 0, 0.36)];
    }
    // Réglages du thème : teinte, saturation, luminosité, contraste, température.
    let [nh, ns, nl] = out;
    nh += P.hue; ns = clamp(ns * P.sat); nl = clamp((0.5 + (nl - 0.5) * P.contrast) * P.bright);
    let [r, g, b] = toRgb(nh, ns, nl);
    if (P.warm) { r = clamp(r * (1 + 0.12 * P.warm), 0, 255); b = clamp(b * (1 - 0.18 * P.warm), 0, 255); }
    const a = rgba[3];
    const res = a < 1 ? `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a})` : `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
    cache.set(key, res);
    return res;
  }

  // Remplace chaque couleur d'une valeur CSS (dégradés, ombres, bordures…), sans toucher aux url(…).
  const TOKEN = /#[0-9a-fA-F]{3,8}(?![\w-])|(?<![\w-])(?:rgba?|hsla?)\((?:[^()]|\([^()]*\))*\)|(?<![\w-])[a-zA-Z]+(?![\w(-])/g;
  const RGB_VAR = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*(?:[,/]\s*(.+))?\)$/is;

  function mapValue(value, role) {
    return value.split(/(url\([^)]*\))/).map((part, i) => (i % 2 ? part : part.replace(TOKEN, (tok) => {
      if (/^[a-z]/i.test(tok) && !/\(/.test(tok)) {
        if (SKIP_WORDS.test(tok)) return tok;
        if (!isNamed.has(tok)) isNamed.set(tok, CSS.supports('color', tok));
        if (!isNamed.get(tok)) return tok;
      }
      if (/var\(/i.test(tok)) {
        // rgb(255 255 255 / var(--opacite)) : canaux connus, opacité variable.
        const m = tok.match(RGB_VAR);
        if (!m) return tok;
        const c = mapColor([+m[1], +m[2], +m[3], 1], role).match(/[\d.]+/g);
        return m[4] ? `rgb(${c[0]} ${c[1]} ${c[2]} / ${m[4]})` : `rgb(${c[0]} ${c[1]} ${c[2]})`;
      }
      const c = parse(tok);
      if (!c || c[3] === 0) return tok;
      return mapColor(c, role);
    }))).join('');
  }

  // « 255, 255, 255 » ou « 255 255 255 » : variable de canaux (Bootstrap, Tailwind), utilisée dans rgb(var(--x)).
  const CHANNELS = /^\s*(\d{1,3})(\s*,\s*|\s+)(\d{1,3})\2(\d{1,3})\s*$/;
  function mapChannels(value, role) {
    const m = value.match(CHANNELS);
    if (!m) return null;
    const c = mapColor([+m[1], +m[3], +m[4], 1], role).match(/[\d.]+/g);
    return c.slice(0, 3).join(m[2]);
  }

  // ---- Propriétés ----

  const ROLE = {
    'background-color': 'bg', 'background-image': 'bg', background: 'bg',
    color: 'fg', 'caret-color': 'fg', 'text-decoration-color': 'fg', 'text-emphasis-color': 'fg',
    '-webkit-text-fill-color': 'fg', '-webkit-text-stroke-color': 'fg', fill: 'fg', stroke: 'fg',
    'border-color': 'border', 'border-top-color': 'border', 'border-right-color': 'border', 'border-bottom-color': 'border',
    'border-left-color': 'border', 'border-block-start-color': 'border', 'border-block-end-color': 'border',
    'border-inline-start-color': 'border', 'border-inline-end-color': 'border', 'outline-color': 'border',
    'column-rule-color': 'border', border: 'border', 'border-top': 'border', 'border-right': 'border',
    'border-bottom': 'border', 'border-left': 'border', outline: 'border',
    'box-shadow': 'shadow', 'text-shadow': 'shadow',
  };
  // Une longue main vide vient d'une forme courte avec var() : on garde la forme courte.
  const SHORTHAND = (prop) =>
    prop.startsWith('background-') ? ['background']
      : /^border-(top|right|bottom|left)-color$/.test(prop) ? ['border-color', 'border-' + prop.split('-')[1], 'border']
        : prop === 'outline-color' ? ['outline'] : [];

  // Les url(…) relatives le sont à la feuille d'origine : rendues absolues, elles restent justes dans la nôtre.
  const absolute = (value, base) => value.replace(/url\((['"]?)([^'")]+)\1\)/g, (m, q, u) => {
    try { return `url("${new URL(u, base).href}")`; } catch { return m; }
  });

  // Lit les déclarations utiles d'un bloc de style : [propriété, valeur, important].
  function readStyle(style, base = document.baseURI) {
    const out = [], done = new Set();
    for (let i = 0; i < style.length; i++) {
      const prop = style[i];
      if (prop.startsWith('--')) {
        const v = style.getPropertyValue(prop);
        out.push([prop, v.trim(), style.getPropertyPriority(prop)]);
        continue;
      }
      // Disposition des images de fond : utile pour placer le voile (calque à part, toujours plein cadre).
      if (/^background-(repeat|position|size)$/.test(prop)) { out.push([prop, style.getPropertyValue(prop), '']); continue; }
      if (!ROLE[prop]) continue;
      let p = prop, v = style.getPropertyValue(prop);
      if (!v) {
        p = SHORTHAND(prop).find((s) => style.getPropertyValue(s));
        if (!p || done.has(p)) continue;
        v = style.getPropertyValue(p);
      }
      if (done.has(p)) continue;
      done.add(p);
      if (p.startsWith('background') && /url\(/.test(v)) v = absolute(v, base);
      out.push([p, v, style.getPropertyPriority(p)]);
    }
    return out;
  }

  // ---- Variables CSS ----
  // Une variable peut servir de fond à un endroit et de texte à un autre : pour chaque rôle où elle sert, on
  // en fait une copie (--darkee-bg--x, --darkee-fg--x…) et chaque usage est redirigé vers la bonne copie.

  const varRoles = new Map(), colorVars = new Set(), varDeps = new Map();
  const VAR_USE = /var\(\s*(--[\w-]+)/g;
  const looksColor = (v) => CHANNELS.test(v) || v.replace(/url\([^)]*\)/g, '').match(TOKEN)?.some((t) => /^#|\(/.test(t) || (!SKIP_WORDS.test(t) && CSS.supports('color', t)));

  function learn(model) {
    for (const block of model) {
      for (const [prop, value] of block.decls) {
        if (prop.startsWith('--')) {
          if (looksColor(value)) colorVars.add(prop);
          for (const [, dep] of value.matchAll(VAR_USE)) {
            if (!varDeps.has(prop)) varDeps.set(prop, new Set());
            varDeps.get(prop).add(dep);
          }
          continue;
        }
        for (const [, name] of value.matchAll(VAR_USE)) {
          if (!varRoles.has(name)) varRoles.set(name, new Set());
          varRoles.get(name).add(ROLE[prop]);
        }
      }
    }
  }

  function propagateRoles() {
    // --a: var(--b) : les rôles de --a valent aussi pour --b ; une variable qui en désigne une autre de
    // couleur est elle-même une couleur.
    for (let pass = 0, changed = true; changed && pass < 8; pass++) {
      changed = false;
      for (const [name, deps] of varDeps) {
        for (const dep of deps) {
          if (colorVars.has(dep) && !colorVars.has(name)) { colorVars.add(name); changed = true; }
          const roles = varRoles.get(name);
          if (!roles) continue;
          if (!varRoles.has(dep)) varRoles.set(dep, new Set());
          for (const r of roles) if (!varRoles.get(dep).has(r)) { varRoles.get(dep).add(r); changed = true; }
        }
      }
    }
  }

  const redirect = (value, role) => value.replace(VAR_USE, (all, name) => (colorVars.has(name) ? all.replace(name, `--darkee-${role}${name}`) : all));

  // Déclarations de remplacement pour un bloc ; '' si rien ne change.
  // root : règle qui vise html ou body, dont le fond s'étend à toute la fenêtre.
  function overrides(decls, forceImportant, root) {
    let css = '';
    // Image répétée (motif, texture) : un fond, quelle que soit la taille du carreau.
    const repeat = decls.find(([p]) => p === 'background-repeat')?.[1] || '';
    let shadowDone = false;
    const tiled = !/no-repeat/.test(repeat) && (!!repeat || decls.some(([p, v]) => p === 'background-color' || /repeat/.test(v)));
    for (const [prop, value, prio] of decls) {
      if (/^background-(repeat|position|size)$/.test(prop)) continue;
      if (prop === 'box-shadow' && shadowDone) continue;
      const imp = forceImportant || prio ? ' !important' : '';
      if (prop.startsWith('--')) {
        if (!colorVars.has(prop)) continue;
        for (const role of varRoles.get(prop) || []) {
          const v = mapChannels(value, role) ?? redirect(mapValue(value, role), role);
          css += `${'--darkee-' + role + prop}: ${v}${imp};`;
        }
        continue;
      }
      const role = ROLE[prop];
      if (prop === 'background' && /url\(/.test(value)) {
        // Image de fond : on ne garde que la couleur.
        const color = value.replace(/url\([^)]*\)/g, '').match(TOKEN)?.reverse().find((t) => parse(t));
        if (color) css += `background-color: ${mapColor(parse(color), 'bg')}${imp};`;
        continue;
      }
      if (prop === 'background-image' && /url\(/.test(value)) {
        // Image de fond claire (texture, photo pâle derrière du texte) : un voile du fond du thème par-dessus,
        // si l'option « Assombrir » des images est choisie.
        const size = decls.find(([p]) => p === 'background-size')?.[1] || '';
        const veil = P.dimImages ? veilFor(value, tiled, root || /cover|contain|100%/.test(size)) : '';
        if (veil && root) {
          // Fond de html / body : étendu à toute la fenêtre, au-delà de la boîte de l'élément ; le voile est
          // un calque du fond lui-même pour le suivre partout.
          css += `background-image: linear-gradient(${veil}, ${veil}), ${value}${imp};`;
        } else if (veil) {
          // Voile peint par une ombre intérieure : au-dessus du fond, sous le contenu, sans toucher à la
          // position ni à la taille de l'image (planches d'icônes). Une ombre du site est gardée par-dessous.
          const own = decls.find(([p]) => p === 'box-shadow')?.[1];
          css += `box-shadow: inset 0 0 0 100vmax ${veil}${own && own !== 'none' ? ', ' + redirect(mapValue(own, 'shadow'), 'shadow') : ''}${imp};`;
          shadowDone = true;
        }
        continue;
      }
      if (prop === 'background-image' && !/gradient/.test(value)) continue;
      if ((prop === 'fill' || prop === 'stroke') && /url\(|none|context/.test(value)) continue;
      const v = redirect(mapValue(value, role), role);
      if (v !== value) css += `${prop}: ${v}${imp};`;
    }
    return css;
  }

  // ---- Images de fond ----
  // Leur clarté est mesurée par l'extension (l'image d'un autre domaine est illisible depuis la page) ;
  // en attendant la réponse, l'image reste telle quelle.

  const images = new Map(); // adresse → { l, a, w, h } | null (en cours ou illisible)
  let imageGen = 0; // change à chaque image claire mesurée : les règles concernées sont à refaire

  // Voile d'une image de fond (rgba, ou '' sans voile). Une image servant de fond, c'est-à-dire opaque (photo,
  // texture, fond d'écran) ou répétée en bande (motif, même tiré d'une planche en partie transparente), est au
  // moins assombrie autant que les photos ; ses zones les plus claires (90e centile) règlent le reste du voile,
  // pour qu'aucune ne reste éblouissante. Un logo ou une icône détourés (non répétés) restent tels quels.
  function veilFor(value, tiled, asBackground) {
    const k = P.variant === 2 ? 0.64 : 0.8;
    const dimAlpha = clamp(1 - k * P.images, 0, 0.9); // ce que perdent les photos (Lum. images)
    const target = P.variant === 2 ? 0.22 : 0.32; // clarté visée pour les zones claires une fois voilées
    let alpha = 0;
    for (const [, , u] of value.matchAll(/url\((['"]?)([^'")]+)\1\)/g)) {
      if (!/^(https?|data):/.test(u)) continue;
      if (!images.has(u)) measure(u);
      const info = images.get(u);
      // Pas encore mesurée : voile provisoire (partir du sombre n'éblouit jamais ; ajusté une fois mesurée).
      if (info === null) { alpha = Math.max(alpha, 0.6); continue; }
      // Illisible (autre domaine, format inconnu) mais clairement un fond : au moins assombrie comme les photos.
      if (!info) { if (asBackground) alpha = Math.max(alpha, dimAlpha); continue; }
      // Affichée en fond de page ou en « cover » / « contain » : un fond, quelle que soit sa forme.
      const isBackground = asBackground || (tiled ? info.a > 0.15 : info.a > 0.6 || (info.a > 0.35 && info.w * info.h >= 200 * 200));
      if (!isBackground) continue;
      const hi = Math.max(info.hi ?? info.l, info.l);
      const need = hi > target ? (hi - target) / Math.max(hi - P.base, 0.1) : 0;
      alpha = Math.max(alpha, dimAlpha, need);
    }
    if (alpha < 0.05) return '';
    const [r, g, b] = toRgb(P.bg[0], P.bg[1], P.base);
    return `rgba(${r}, ${g}, ${b}, ${Math.min(alpha, 0.92).toFixed(2)})`;
  }

  function measure(url) {
    images.set(url, null);
    const done = (info) => { images.set(url, info || false); imageGen++; schedule(50); }; // false : illisible
    // L'extension mesure d'abord (elle lit les images de tout domaine) ; ce qu'elle ne sait pas décoder (SVG)
    // est mesuré ici, dans la page, si l'image est du même site.
    const local = () => measureHere(url).then(done, () => done(false));
    try {
      chrome.runtime.sendMessage({ type: 'dark-google:img', url }).then((info) => (info ? done(info) : local()), local);
    } catch { local(); }
  }

  // Même calcul que l'extension : clarté moyenne, des zones claires (90e centile) et part opaque, sur 24 × 24.
  function measureHere(url) {
    return new Promise((resolve, reject) => {
      let same = false;
      try { same = url.startsWith('data:') || new URL(url, location.href).origin === location.origin; } catch {}
      if (!same) return reject();
      const img = new Image();
      img.onload = () => {
        try {
          const c = document.createElement('canvas');
          c.width = c.height = 24;
          const g = c.getContext('2d');
          g.drawImage(img, 0, 0, 24, 24);
          const d = g.getImageData(0, 0, 24, 24).data;
          let l = 0, a = 0;
          const lums = [];
          for (let i = 0; i < d.length; i += 4) {
            const w = d[i + 3] / 255;
            const y = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
            l += w * y; a += w;
            if (w > 0.5) lums.push(y);
          }
          lums.sort((x, y) => x - y);
          resolve({ l: a ? l / a : 0, hi: lums.length ? lums[Math.floor(lums.length * 0.9)] : 0, a: a / 576,
            w: img.naturalWidth || 300, h: img.naturalHeight || 300 });
        } catch { reject(); }
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  // ---- Feuilles de style ----

  const models = new WeakMap(); // feuille → { n: nombre de règles lu, model }
  const fetched = new Map(); // adresse → modèle (feuilles d'un autre domaine, lues par l'extension)

  function modelOf(rules, wrap, out, base) {
    for (const rule of rules) {
      if (rule instanceof CSSStyleRule) {
        const decls = readStyle(rule.style, base);
        if (decls.length) out.push({ wrap, sel: rule.selectorText, decls });
        if (rule.cssRules?.length) modelOf(rule.cssRules, wrap.concat(`${rule.selectorText}`), out, base); // CSS imbriqué
      } else if (rule instanceof CSSMediaRule) {
        modelOf(rule.cssRules, wrap.concat(`@media ${rule.conditionText}`), out, base);
      } else if (rule instanceof CSSSupportsRule) {
        modelOf(rule.cssRules, wrap.concat(`@supports ${rule.conditionText}`), out, base);
      } else if (typeof CSSLayerBlockRule !== 'undefined' && rule instanceof CSSLayerBlockRule) {
        modelOf(rule.cssRules, wrap.concat(`@layer ${rule.name}`), out, base);
      } else if (typeof CSSContainerRule !== 'undefined' && rule instanceof CSSContainerRule) {
        modelOf(rule.cssRules, wrap.concat(`@container ${rule.conditionText}`), out, base);
      } else if (rule instanceof CSSImportRule && rule.styleSheet) {
        const media = rule.media?.mediaText;
        readSheet(rule.styleSheet, media ? wrap.concat(`@media ${media}`) : wrap, out);
      }
    }
  }

  function readSheet(sheet, wrap, out) {
    let rules;
    try { rules = sheet.cssRules; } catch {
      // Feuille d'un autre domaine : illisible depuis la page, on la fait lire par l'extension.
      if (sheet.href) {
        const m = fetched.get(sheet.href);
        if (m) out.push(...m.map((b) => ({ ...b, wrap: wrap.concat(b.wrap) })));
        else if (m === undefined) fetchSheet(sheet.href);
      }
      return;
    }
    if (!rules) return;
    let entry = models.get(sheet);
    if (!entry || entry.n !== rules.length) {
      entry = { n: rules.length, model: [] };
      modelOf(rules, [], entry.model, sheet.href || document.baseURI);
      models.set(sheet, entry);
    }
    for (const b of entry.model) out.push(wrap.length ? { ...b, wrap: wrap.concat(b.wrap) } : b);
  }

  let pending = 0; // feuilles d'un autre domaine en cours de lecture
  function fetchSheet(href) {
    fetched.set(href, null);
    pending++;
    const done = () => { pending--; schedule(0); };
    try {
      chrome.runtime.sendMessage({ type: 'dark-google:css', url: href }).then((text) => {
        done();
        if (typeof text !== 'string') return;
        const sheet = new CSSStyleSheet({ baseURL: href });
        sheet.replaceSync(text.replace(/@import[^;]+;/g, ''));
        const model = [];
        modelOf(sheet.cssRules, [], model, href);
        fetched.set(href, model);
      }).catch(done);
    } catch { done(); }
  }

  function allSheets() {
    const list = [];
    for (const sheet of document.styleSheets) {
      if (sheet.ownerNode?.hasAttribute?.(MARK) || sheet.disabled) continue;
      list.push(sheet);
    }
    for (const sheet of document.adoptedStyleSheets || []) list.push(sheet);
    return list;
  }

  function wrapCss(wrap, body) {
    return wrap.reduceRight((inner, w) => `${w} { ${inner} }`, body);
  }

  // ---- Styles en ligne et attributs de couleur (fill="#000", bgcolor…) ----

  const ATTRS = ['style', 'fill', 'stroke', 'bgcolor', 'color'];
  const inlineCss = new Map(); // numéro → css
  let inlineId = 0;

  function inlineDecls(el) {
    const decls = el.style ? readStyle(el.style) : [];
    const fill = el.getAttribute('fill'), stroke = el.getAttribute('stroke');
    if (fill && el instanceof SVGElement) decls.push(['fill', fill, '']);
    if (stroke && el instanceof SVGElement) decls.push(['stroke', stroke, '']);
    const bgc = el.getAttribute('bgcolor');
    if (bgc) decls.push(['background-color', bgc, '']);
    const col = el.tagName === 'FONT' && el.getAttribute('color');
    if (col) decls.push(['color', col, '']);
    return decls;
  }

  function scanInline(el) {
    if (!(el instanceof Element) || el.hasAttribute(MARK)) return;
    const decls = inlineDecls(el);
    let id = el.getAttribute(INLINE);
    if (!decls.length) { if (id) { inlineCss.delete(id); dirtyInline = true; } return; }
    // Variables définies en ligne (style="--fond: #fff") : à connaître avant de les réécrire.
    learn([{ decls }]);
    const css = overrides(decls, true, el === document.body || el === root);
    if (!css) { if (id) { inlineCss.delete(id); dirtyInline = true; } return; }
    if (!id) { id = String(++inlineId); el.setAttribute(INLINE, id); }
    if (inlineCss.get(id) !== css) { inlineCss.set(id, css); dirtyInline = true; }
  }

  function scanTree(node) {
    if (!(node instanceof Element)) return;
    scanInline(node);
    for (const el of node.querySelectorAll('[style], [fill], [stroke], [bgcolor], font[color]')) scanInline(el);
  }

  // ---- Assemblage ----

  let cacheStyle = null, sheetStyle = null, inlineStyle = null, baseStyle = null, observer = null, classObserver = null, timer = null, poll = null;
  let rolesSig = -1, paramGen = 0;
  const blockCss = new WeakMap(); // déclarations d'un bloc → remplacement déjà calculé
  let active = false, dirtyInline = false, lastCounts = '', cacheKey = '', saveTimer = null;

  // Tant que la page n'est pas chargée et toutes ses feuilles lues, la page garde le fond sombre imposé et les
  // règles de la visite précédente (cacheStyle) : une relecture encore incomplète ne peut pas faire réapparaître
  // du blanc. Une fois tout lu, nos règles fraîches suffisent et ce filet est retiré.
  let settled = false, lastP = null, lastKey = '';
  function base(p) {
    // « Assombrir » : photos et vidéos nettement plus sombres (Lum. images 90 % → 72 %, Profond 58 %), jamais inversées.
    const k = P.variant === 2 ? 0.64 : 0.8;
    const dim = p.imageMode === 'dim' ? `img, video, picture, svg image, [role="img"] { filter: brightness(${(k * (p.images ?? 90) / 100).toFixed(2)}) !important; }` : '';
    const page = hsl([P.bg[0], P.bg[1], P.base]);
    const loading = settled ? '' : `html, body { background-color: ${page} !important; }`;
    return `html { color-scheme: dark !important; background-color: ${page}; color: ${p.fg}; }
      :where(a:link) { color: ${hsl(P.link)}; } :where(a:visited) { color: ${hsl([P.link[0] + 60, P.link[1], P.link[2]])}; }
      ${dim} ${loading}`;
  }

  function counts() {
    let s = '';
    for (const sheet of allSheets()) { try { s += sheet.cssRules.length + ','; } catch { s += 'x,'; } }
    return s + fetched.size;
  }

  function rebuild() {
    if (!active) return;
    // Une même feuille chargée plusieurs fois (Amazon : jusqu'à 6 fois) n'est lue qu'une fois, à sa dernière place.
    const sheets = allSheets();
    const lastAt = new Map();
    sheets.forEach((sheet, i) => sheet.href && lastAt.set(sheet.href, i));
    const blocks = [];
    for (const [i, sheet] of sheets.entries()) {
      if (sheet.href && lastAt.get(sheet.href) !== i) continue;
      const media = sheet.media?.mediaText;
      readSheet(sheet, media && media !== 'all' ? [`@media ${media}`] : [], blocks);
    }
    learn(blocks);
    propagateRoles();
    // Nouvelles variables de couleur apprises : les styles en ligne qui s'en servent sont à réécrire.
    // Signature des règles converties : variables apprises, images mesurées et réglages du thème. Si l'un change,
    // chaque bloc est reconverti (un changement de thème s'applique tout de suite, sans recharger la page).
    let sig = colorVars.size + imageGen * 100000 + paramGen * 100000000;
    for (const r of varRoles.values()) sig += r.size;
    if (sig !== rolesSig) { rolesSig = sig; if (document.body) scanTree(document.body); }
    let css = '';
    for (const b of blocks) {
      let done = blockCss.get(b.decls);
      if (!done || done.sig !== sig) {
        const isRoot = b.sel.split(',').some((x) => /^\s*(html|body|:root)\s*$/i.test(x));
        done = { sig, body: overrides(b.decls, false, isRoot) };
        blockCss.set(b.decls, done);
      }
      if (done.body) css += wrapCss(b.wrap, `${b.sel} { ${done.body} }`) + '\n';
    }
    if (sheetStyle.textContent !== css) {
      sheetStyle.textContent = css;
      saveCache(css);
    }
    lastCounts = counts();
    if (!settled && document.readyState === 'complete' && !pending) {
      settled = true;
      baseStyle.textContent = base(lastP);
      cacheStyle.textContent = '';
    }
    recheckAll(); // les couleurs ont pu changer : on revérifie tout ce qui est affiché
    flushInline();
  }

  // ---- Filet de sécurité ----
  // Ce que le CSS lu n'a pas couvert (feuille illisible, style posé par un script tiers, bandeau de cookies…)
  // est vérifié sur la page affichée : un fond resté clair passe en sombre, un texte resté sombre passe en clair.

  const FIX = 'data-darkee-f';
  // Préfixe qui donne à nos corrections la priorité de deux identifiants : un site qui pose ses couleurs avec
  // !important sur des classes (Amazon : .a-color-offset-background) ne peut plus les battre.
  const BOOST = ':root:not(#dk-a):not(#dk-b)';
  const fixIds = new Map(); // « bg|rgb(…) » ou « fg|rgb(…) » → jeton
  let fixStyle = null, fixQueue = [], fixTimer = null, fixCss = '';
  // Passages complets numérotés : un élément n'est vérifié qu'une fois par passage. Un passage en cours n'est
  // jamais interrompu (sur une page qui ajoute du CSS sans arrêt, il n'arriverait jamais en bas) : s'il faut
  // tout revoir entre-temps, un nouveau passage suit dès qu'il est fini.
  let fixGen = 0, fixRunning = false, fixAgain = false, fixDebounce = null;
  const fixSeen = new WeakMap(); // élément → numéro du passage qui l'a vérifié

  // kind : 'bg' couleur de fond, 'fg' texte, 'gr' dégradé de fond (valeur complète).
  function fixToken(kind, value) {
    const key = kind + '|' + value;
    let id = fixIds.get(key);
    if (!id) {
      id = kind[0] + kind[1] + fixIds.size;
      fixIds.set(key, id);
      fixCss += fixRule(key, id);
      fixStyle.textContent = fixCss;
    }
    return id;
  }

  // 'fc' : couleur de texte imposée telle quelle (correction de contraste).
  function fixRule(key, id) {
    const kind = key.slice(0, 2), value = key.slice(3);
    const decl = kind === 'gr' ? `background-image: ${mapValue(value, 'bg')}`
      : kind === 'bd' ? `border-color: ${mapValue(value, 'border')}`
        : kind === 'fc' ? `color: ${value}`
          : `${kind === 'bg' ? 'background-color' : 'color'}: ${mapColor(parse(value), kind)}`;
    return `${BOOST} [${FIX}~="${id}"] { ${decl} !important; }\n`;
  }

  // Dégradé dont une couleur au moins est claire et opaque.
  function lightGradient(value) {
    if (!/gradient/.test(value) || /url\(/.test(value)) return false;
    return (value.match(TOKEN) || []).some((t) => {
      const c = /^[a-z]+$/i.test(t) && !CSS.supports('color', t) ? null : parse(t);
      return c && c[3] > 0.5 && lum(c) > P.t.bg;
    });
  }

  const hasText = (el) => {
    for (const n of el.childNodes) if (n.nodeType === 3 && n.data.trim()) return true;
    return false;
  };

  // Contraste (WCAG).
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

  // Fond réellement derrière un élément : le premier ancêtre au fond plein (dégradé : sa première couleur).
  // Une image de fond non voilée avant ça : fond inconnu (null).
  const pageBg = () => toRgb(P.bg[0], P.bg[1], P.base);
  function backdrop(el) {
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      const cs = getComputedStyle(e);
      const c = parse(cs.backgroundColor);
      if (c && c[3] > 0.5) return c;
      const img = cs.backgroundImage;
      if (img !== 'none') {
        if (/inset 0px 0px 0px/.test(cs.boxShadow)) return pageBg(); // voilée par nous : sombre
        if (/url\(/.test(img)) return null;
        const t = img.match(TOKEN)?.map((x) => parse(x)).find((x) => x && x[3] > 0.5);
        if (t) return t;
      }
    }
    return pageBg(); // fond de la page
  }

  // Couleur de texte lisible sur un fond donné, dans les tons du thème (teinte du texte d'origine gardée).
  function readableOn(fg, back) {
    const [h, s] = toHsl(fg);
    const darkBack = lum(back) < 0.18;
    const sat = s < NEUTRAL ? P.fns : Math.min(s, P.chroma + 0.1);
    const hue = s < NEUTRAL ? P.fg[0] : h;
    for (let l = darkBack ? 0.7 : 0.25; darkBack ? l <= 0.97 : l >= 0.03; l += darkBack ? 0.05 : -0.05) {
      const c = toRgb(hue, sat, l);
      if (ratio(c, back) >= 4.5) return `rgb(${c.join(', ')})`;
    }
    return darkBack ? `rgb(${toRgb(P.fg[0], P.fns, P.fg[2]).join(', ')})` : 'rgb(20, 20, 22)';
  }

  function checkEl(el) {
    if (!el.isConnected || fixSeen.get(el) === fixGen || el.hasAttribute(MARK) || /^(IMG|VIDEO|CANVAS|PICTURE|IFRAME|SCRIPT|STYLE|LINK|META|svg|SVG|path)$/.test(el.tagName)) return;
    fixSeen.set(el, fixGen);
    const cs = getComputedStyle(el);
    if (cs.display === 'none') return;
    const old = el.getAttribute(FIX) || '';
    const tokens = new Set(old.split(' ').filter(Boolean));
    const bg = parse(cs.backgroundColor);
    if (bg && bg[3] > 0.5) {
      if (lum(bg) > P.t.bg) tokens.add(fixToken('bg', cs.backgroundColor));
    }
    if (lightGradient(cs.backgroundImage)) tokens.add(fixToken('gr', cs.backgroundImage));
    // Bordure claire (cadre de champ, de liste déroulante…) : passe au ton des bordures du thème.
    if (parseFloat(cs.borderTopWidth) || parseFloat(cs.borderLeftWidth) || parseFloat(cs.borderBottomWidth)) {
      const sides = [cs.borderTopColor, cs.borderRightColor, cs.borderBottomColor, cs.borderLeftColor];
      if (sides.some((c) => { const x = parse(c); return x && x[3] > 0.3 && lum(x) > Math.max(P.t.bg, 0.3); })) {
        tokens.add(fixToken('bd', sides.join(' ')));
      }
    }
    const now = [...tokens].join(' ');
    if (now !== old) el.setAttribute(FIX, now); // le fond corrigé compte pour le contrôle du texte, ici et dessous
    if (hasText(el)) {
      const fg = parse(getComputedStyle(el).color);
      if (fg && fg[3] > 0.3) {
        const back = backdrop(el);
        if (back ? ratio(fg, back) < 4.5 : lum(fg) < P.t.fg) {
          for (const t of [...tokens]) if (t.startsWith('fc')) tokens.delete(t);
          tokens.add(fixToken('fc', readableOn(fg, back || pageBg())));
          el.setAttribute(FIX, [...tokens].join(' '));
        }
      }
    }
  }

  function queueFix(node, all) {
    if (!active || !(node instanceof Element)) return;
    fixQueue.push(node);
    if (all) for (const el of node.getElementsByTagName('*')) fixQueue.push(el);
    if (!fixTimer) fixTimer = setTimeout(runFix, 60);
  }

  function runFix() {
    fixTimer = null;
    if (!active) { fixQueue = []; fixRunning = false; return; }
    const end = performance.now() + 14; // par petites tranches, sans bloquer la page
    let i = 0;
    while (i < fixQueue.length && performance.now() < end) checkEl(fixQueue[i++]);
    fixQueue = fixQueue.slice(i);
    if (fixQueue.length) { fixTimer = setTimeout(runFix, 16); return; }
    fixRunning = false;
    if (fixAgain) { fixAgain = false; startPass(); }
  }

  function startPass() {
    if (!active || !document.body) return;
    fixGen++;
    fixRunning = true;
    // Ce qui est à l'écran d'abord, puis le reste de la page.
    const all = [...document.body.getElementsByTagName('*')];
    const h = innerHeight;
    const near = [], far = [];
    for (const el of all) {
      const top = el.getBoundingClientRect?.().top ?? 0;
      (top < h * 1.5 ? near : far).push(el);
    }
    fixQueue.push(document.body, ...near, ...far);
    if (!fixTimer) fixTimer = setTimeout(runFix, 0);
  }

  // Après une relecture du CSS : un passage complet, une fois la page calmée (au plus un en attente).
  function recheckAll() {
    clearTimeout(fixDebounce);
    fixDebounce = setTimeout(() => (fixRunning ? (fixAgain = true) : startPass()), 250);
  }

  function flushInline() {
    if (!dirtyInline) return;
    dirtyInline = false;
    let css = '';
    for (const [id, body] of inlineCss) css += `${BOOST} [${INLINE}="${id}"] { ${body} }\n`;
    inlineStyle.textContent = css;
  }

  function schedule(delay) {
    if (timer) return;
    timer = setTimeout(() => { timer = null; rebuild(); }, delay);
  }

  // Les règles déduites sont gardées pour la visite suivante : appliquées dès le début du chargement, elles
  // évitent l'éclair blanc le temps de relire le CSS.
  function saveCache(css) {
    if (!cacheKey) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        if (pending) return; // copie incomplète : on garde la précédente
        if (css.length < 1500000) localStorage.setItem(cacheKey, css);
        else localStorage.removeItem(cacheKey);
      } catch {}
    }, 2000);
  }

  function append(el) {
    if (el.isConnected && el === root.lastElementChild) return;
    root.appendChild(el); // en dernier : passe après les feuilles du site
  }

  // Nos feuilles doivent venir après celles du site dans l'ordre du document : à sélecteur égal, c'est la dernière
  // qui gagne. Posées au tout début du chargement, avant que <head> n'existe, elles se retrouveraient devant ;
  // on les replace après <head> et <body> dès qu'ils apparaissent (ou si on nous a retirées).
  function keepLast() {
    if (!active) return;
    const ours = [baseStyle, cacheStyle, sheetStyle, inlineStyle, fixStyle];
    const after = (node) => !node || !!(node.compareDocumentPosition(baseStyle) & Node.DOCUMENT_POSITION_FOLLOWING);
    if (ours.every((el) => el.parentNode === root) && after(document.head) && after(document.body)) return;
    root.append(...ours);
  }

  function onMutations(list) {
    let sheetsChanged = false;
    for (const m of list) {
      if (m.type === 'attributes') { scanInline(m.target); fixSeen.delete(m.target); queueFix(m.target); continue; }
      for (const n of m.addedNodes) {
        if (n.nodeType !== 1) {
          if (n.parentNode?.nodeName === 'STYLE') sheetsChanged = true;
          continue;
        }
        if (n.hasAttribute(MARK)) continue;
        if (n.nodeName === 'STYLE') sheetsChanged = true;
        else if (n.nodeName === 'LINK') n.addEventListener('load', () => rebuild(), { once: true });
        scanTree(n);
        queueFix(n, true);
      }
      if (m.target.nodeName === 'STYLE') sheetsChanged = true;
    }
    // Une feuille <style> se lit tout de suite : on recolore avant l'affichage.
    if (sheetsChanged) rebuild();
    else flushInline();
    keepLast();
  }

  function apply(p, key) {
    // Mêmes réglages (le mode Auto réapplique chaque minute) : rien à refaire, rien ne doit bouger.
    const sig = JSON.stringify(p) + '|' + key;
    if (active && sig === lastKey) return;
    lastKey = sig;
    lastP = p;
    setParams(p);
    cache.clear();
    paramGen++;
    cacheKey = key || '';
    if (!baseStyle) {
      const make = () => { const el = document.createElement('style'); el.setAttribute(MARK, ''); return el; };
      [baseStyle, cacheStyle, sheetStyle, inlineStyle, fixStyle] = [make(), make(), make(), make(), make()];
    }
    baseStyle.textContent = base(p);
    if (!active) {
      active = true;
      settled = false;
      try { cacheStyle.textContent = (cacheKey && localStorage.getItem(cacheKey)) || ''; } catch {}
      root.append(baseStyle, cacheStyle, sheetStyle, inlineStyle, fixStyle);
      observer = new MutationObserver(onMutations);
      observer.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
      // Changement de classe (onglet ouvert, menu déplié) : l'élément et son contenu sont revérifiés.
      classObserver = new MutationObserver((list) => {
        for (const m of list) { if (m.target instanceof Element && !m.target.hasAttribute(MARK)) { fixSeen.delete(m.target); queueFix(m.target, true); } }
      });
      classObserver.observe(root, { subtree: true, attributes: true, attributeFilter: ['class', 'hidden', 'open'] });
      document.addEventListener('DOMContentLoaded', () => { keepLast(); scanTree(document.body); rebuild(); }, { once: true });
      addEventListener('load', () => { if (active) { baseStyle.textContent = base(p); rebuild(); } }, { once: true });
      // Feuilles remplies par du JavaScript (insertRule) : invisibles pour l'observateur, on compte leurs règles.
      poll = setInterval(() => { if (counts() !== lastCounts) rebuild(); }, 700);
    } else {
      // Autre thème ou réglage : les corrections déjà posées sont recalculées sur place, sans être retirées
      // (les retirer ferait réapparaître le clair un instant). Celles de contraste seront revues au passage.
      fixCss = '';
      for (const [k, id] of fixIds) fixCss += fixRule(k, id);
      fixStyle.textContent = fixCss;
      cacheStyle.textContent = '';
      // Les couleurs de texte imposées pour le contraste dépendaient de l'ancien thème : recalculées au passage.
      for (const el of document.querySelectorAll(`[${FIX}*="fc"]`)) {
        const kept = el.getAttribute(FIX).split(' ').filter((t) => !t.startsWith('fc')).join(' ');
        if (kept) el.setAttribute(FIX, kept); else el.removeAttribute(FIX);
      }
    }
    if (document.body) scanTree(document.body);
    dirtyInline = true;
    rebuild();
  }

  function clear() {
    if (!active) return;
    active = false;
    observer?.disconnect();
    classObserver?.disconnect();
    clearTimeout(fixDebounce); fixRunning = false; fixAgain = false;
    clearInterval(poll);
    clearTimeout(timer); timer = null;
    for (const el of [baseStyle, cacheStyle, sheetStyle, inlineStyle, fixStyle]) el?.remove();
    lastKey = '';
    clearTimeout(fixTimer); fixTimer = null; fixQueue = [];
    fixIds.clear(); fixCss = '';
    document.querySelectorAll(`[${FIX}]`).forEach((el) => el.removeAttribute(FIX));
    document.querySelectorAll(`[${INLINE}]`).forEach((el) => el.removeAttribute(INLINE));
    inlineCss.clear();
  }

  return { apply, clear, get active() { return active; } };
})();
