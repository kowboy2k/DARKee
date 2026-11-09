// Rechargement automatique quand l'extension est chargée « non empaquetée » depuis un dossier git (synchro PC ↔ Mac
// de Linkee) : toutes les 30 s, le service relit son propre manifest.json sur le disque ; si la version a changé,
// il attend 3 s (fichiers en cours d'écriture), vérifie encore, puis recharge l'extension.
// Sans effet pour une extension installée depuis un store (update_url présent). Aucune requête réseau.
(() => {
  const courante = chrome.runtime.getManifest();
  if (courante.update_url) return;
  const versionSurDisque = async () => {
    try {
      const r = await fetch(chrome.runtime.getURL('manifest.json'), { cache: 'no-store' });
      return (await r.json()).version || null;
    } catch (e) {
      return null; // manifeste en cours d'écriture : au prochain tour
    }
  };
  let enCours = false;
  const verifier = async () => {
    if (enCours) return;
    enCours = true;
    try {
      const v = await versionSurDisque();
      if (!v || v === courante.version) return;
      await new Promise((ok) => setTimeout(ok, 3000));
      if ((await versionSurDisque()) === v) chrome.runtime.reload();
    } finally {
      enCours = false;
    }
  };
  setInterval(verifier, 30000);
  if (chrome.alarms) {
    chrome.alarms.create('rechargement-version', { periodInMinutes: 0.5 });
    chrome.alarms.onAlarm.addListener((a) => { if (a.name === 'rechargement-version') verifier(); });
  }
  verifier();
})();
