// DARKee – Anti-cookies : refuse automatiquement les demandes de cookies (option de l'onglet Plus).
// On clique « Tout refuser » (ou l'équivalent) dans le bandeau : d'abord les gestionnaires de consentement
// connus, par leurs boutons de refus ; sinon un bouton dont le texte est un refus, placé dans un bloc qui parle
// de cookies. Jamais un bouton d'acceptation. Rien n'est envoyé nulle part.
(() => {
  if (window.__darkeeCookies) return;
  window.__darkeeCookies = true;

  // Boutons de refus des gestionnaires de consentement répandus.
  const KNOWN = [
    '#onetrust-reject-all-handler', // OneTrust
    '.ot-pc-refuse-all-handler',
    '#didomi-notice-disagree-button', // Didomi
    '.didomi-continue-without-agreeing',
    '#CybotCookiebotDialogBodyButtonDecline', // Cookiebot
    '#CybotCookiebotDialogBodyLevelButtonLevelOptinDeclineAll',
    '#axeptio_btn_dismiss', // Axeptio
    '#cookiescript_reject', // CookieScript
    '.cky-btn-reject', // CookieYes
    '.cky-banner-btn-close', // CookieYes sans bouton de refus (ko-fi.com) : la croix enregistre un refus
    '.cmplz-deny', // Complianz
    '.osano-cm-denyAll', // Osano
    '.iubenda-cs-reject-btn', // iubenda
    '#truste-consent-required', // TrustArc
    '.fc-cta-do-not-consent', // Google Funding Choices
    '#sp-cc-rejectall-link', // Amazon
    '[data-testid="uc-deny-all-button"]', // Usercentrics
    '#cmpbntnotxt', // consentmanager (« continuer sans accepter »)
    '.cmpboxbtnno',
    '#tarteaucitronAllDenied2', // tarteaucitron
    '.sd-cmp-JnaLO', // Sirdata
    'button[aria-label="Tout refuser"]',
    'button[aria-label="Reject all"]',
    'form[action*="consent.google"] button[aria-label*="refuser" i]',
    'form[action*="consent.google"] button[aria-label*="reject" i]',
  ];

  // Textes de refus (bouton entier, en minuscules, espaces réduits).
  const REFUSE = /^(tout refuser|refuser tout|tout rejeter|rejeter tout|refuser( et fermer| les cookies| tous les cookies)?|je refuse|non merci|pas d'accord|continuer sans accepter|continuer sans accepter →|reject all|reject|deny all|deny|decline all|decline|refuse all|necessary only|only necessary|only essential|essential only|use necessary cookies only|accept only necessary|accept necessary only|alle ablehnen|ablehnen|nur notwendige( cookies)?|nur erforderliche( cookies)?|rechazar( todo| todas)?|rifiuta( tutto)?|weigeren|alles weigeren)$/;
  // « Refuser et s'abonner » (mur « accepter ou payer », ex. 20 Minutes) : ce n'est pas un refus gratuit, c'est une
  // offre payante. Jamais cliqué, même sur un bouton de refus connu : on laisse la décision.
  const PAYWALL = /abonn|subscri|payer|paiement|premium|€|s'inscrire|sign ?up|connecter|log ?in/i;
  // Un bloc qui parle de cookies ou de consentement.
  const CONTEXT = /cookie|consent|traceur|vie privée|confidentialité|privacy|rgpd|gdpr|datenschutz|partenaires/i;

  const clicked = new WeakSet();
  let enabled = false, observer = null, timer = null, stopAt = 0;

  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05;
  };
  const label = (el) => (el.innerText || el.value || el.getAttribute('aria-label') || '')
    .replace(/\s+/g, ' ').replace(/[✕×✖→›]/g, '').trim().toLowerCase();

  function press(el) {
    if (clicked.has(el)) return false;
    clicked.add(el);
    if (PAYWALL.test(label(el))) return false;
    el.click();
    return true;
  }

  // Racines où chercher : la page et les « shadow roots » ouverts (Usercentrics et d'autres s'y cachent).
  function roots() {
    const list = [document];
    for (const host of document.querySelectorAll('body > *, #usercentrics-root, #usercentrics-cmp-ui')) {
      if (host.shadowRoot) list.push(host.shadowRoot);
    }
    return list;
  }

  function scan() {
    timer = null;
    if (!enabled || !document.body) return;
    for (const root of roots()) {
      // 1. Gestionnaires connus.
      for (const sel of KNOWN) {
        let el;
        try { el = root.querySelector(sel); } catch { continue; }
        if (el && visible(el) && press(el)) return;
      }
      // 2. Bouton de refus dans un bloc qui parle de cookies.
      for (const el of root.querySelectorAll('button, a, [role="button"], input[type="button"], input[type="submit"]')) {
        const text = label(el);
        if (!text || text.length > 45 || !REFUSE.test(text) || clicked.has(el) || !visible(el)) continue;
        let ctx = el.parentElement, ok = false;
        for (let i = 0; ctx && i < 8 && !ok; i++, ctx = ctx.parentElement) ok = CONTEXT.test((ctx.innerText || '').slice(0, 3000));
        if (ok && press(el)) return;
      }
    }
  }

  function schedule(delay) {
    if (timer || Date.now() > stopAt) return;
    timer = setTimeout(scan, delay);
  }

  // Les bandeaux arrivent souvent après le chargement : on surveille la page pendant 30 s, puis on s'arrête.
  function start() {
    stopAt = Date.now() + 30000;
    schedule(300);
    if (!observer) {
      observer = new MutationObserver(() => schedule(250));
      const watch = () => observer.observe(document.documentElement, { childList: true, subtree: true });
      document.documentElement ? watch() : document.addEventListener('DOMContentLoaded', watch, { once: true });
    }
    setTimeout(() => { observer?.disconnect(); observer = null; }, 30500);
    addEventListener('load', () => schedule(500), { once: true });
  }

  function update(raw) {
    const on = DG.normalize(raw).cookieReject;
    if (on && !enabled) { enabled = true; start(); }
    enabled = on;
  }

  chrome.storage.local.get('state', ({ state }) => update(state));
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.state) update(changes.state.newValue);
  });
})();
