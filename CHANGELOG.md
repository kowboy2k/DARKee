# DARKee

Thème sombre réglable pour les services Google (Gmail, Agenda, Docs, Sheets, Slides, Forms, Drive,
Traduction, Keep, Contacts, Recherche, Maps, Photos, Meet, autres) et pour Wikipédia.

- Aucune requête réseau, aucune télémétrie. Permissions : `storage`, `scripting`, `activeTab`, `geolocation` (seulement si vous cliquez « Me localiser »), accès à Google et Wikipédia ;
  l'accès aux autres sites n'est demandé que si vous l'activez (un site à la fois, ou tous).
- Google : filtre de couleur SVG sur la page (fond, texte, luminosité, contraste, saturation, teinte),
  les photos et vidéos sont rétablies dans leurs vraies couleurs.
- Wikipédia : réactive le thème sombre officiel de Wikipédia à chaque visite (cookie `<wiki>mwclientpreferences`),
  ou le même filtre que Google au choix.
- Barre de titre des web apps (Gmail, Agenda…) assortie au fond, réglable site par site
  (petite icône de fenêtre dans la liste, ou case « Barre de titre sombre » pour le site ouvert).
- Menu : réglages par défaut, Sites (globe) et Plus (roue dentée) en haut ; bouton du site courant (choix mémorisé), mode général
  OFF / Actif + bouton Auto (thème macOS et/ou heure), préréglages, curseurs avec − / +.
- Images : Assombrir (par défaut : vraies couleurs, luminosité réglable) ou Normales (intactes).
- Raccourcis : Alt+Maj+D (ce site), Alt+Maj+A (partout), affichés dans le menu ; un clic ouvre
  `chrome://extensions/shortcuts` pour les changer.

## Installation
`chrome://extensions` → Mode développeur → « Charger l'extension non empaquetée » → ce dossier.
Ne pas garder en parallèle « gmail-titlebar-sombre » ni d'autres extensions de thème sombre sur les mêmes sites.

## Limites connues
- Docs, Sheets, Slides : les photos sont corrigées au moment où l'éditeur les dessine dans son canvas
  (script `canvas-images.js`, exécuté dans la page). Les photos déjà affichées sont repeintes dès que l'option change.
- Détection du thème sombre d'origine : si un site est déjà sombre (thème du service ou du système), il est laissé
  tel quel et la barre de titre prend sa propre couleur. Vérifié au chargement puis toutes les 2,5 s.
  Option « Laisser tel quel si le site est déjà sombre » par site (cochée par défaut).

## Versions
- **1.20.8** – « Inactif par défaut » : croissant bleuté sur le bouton.
- **1.20.7** – Interrupteur « Toujours ON » : sans étoile (piste jaune seule).
- **1.20.6** – Bouton « Actif / Inactif par défaut » : croissant seul, sans les étoiles.
- **1.20.5** – Interrupteur « Toujours ON » : étoile rentrée dans le bouton, lune recentrée.
- **1.20.4** – « Toujours ON » compte comme personnalisé (étoile sur l'icône, mention en jaune) ; petite étoile sur le bouton de l'interrupteur et piste jaune au 3ᵉ cran.
- **1.20.3** – Au-dessus des thèmes : « Réglages par défaut » seul, ou le nom du domaine + « Réinitialiser » quand il est personnalisé, sur une ligne.
- **1.20.2** – Interrupteur : « Toujours ON ».
- **1.20.1** – Réglages par défaut remis une fois à Graphite, variante 0 (Classique) : la référence fixe des sites non personnalisés.
- **1.20.0** – Nouvelles règles : les réglages par défaut (thème par défaut, variante 1) valent partout sans rien enregistrer ; changer thème, variante ou un réglage sur un site le personnalise (jaune), revenir aux défauts l'oublie. Un réglage par domaine, toujours. Interrupteur OFF · ON · Toujours (sombre même quand Auto rendrait la page claire). Étoile jaune sur l'icône d'un site personnalisé.
- **1.19.23** – Anti-cookies : bandeaux CookieYes sans bouton de refus (ko-fi.com) fermés par la croix, qui enregistre un refus.
- **1.19.22** – Légende de la barre de titre dans le dépliant Google, à gauche de Tout activer / Tout couper.
- **1.19.21** – Onglet Sites : recherche qui filtre les listes, Google et Wikipédia dans un dépliant, « Supprimer tous les sites » dans l'en-tête des sites enregistrés.
- **1.19.20** – Onglet Sites : « Effacer les préférences de tous les sites » (avec confirmation) ; thèmes et réglages communs gardés.
- **1.19.19** – Icône : contour bleuté = « Inactif par défaut », pas de contour = « Actif par défaut » ; croissant jaune = page (ou domaine) allumée, bleu = coupée ; OFF = fond #5972c6.
- **1.19.18** – Icône : état de la page en cours (OFF fond #5972c6 · pas allumée en « Inactif par défaut » : croissant #5972c6 · allumée : jaune).
- **1.19.17** – Icône : OFF sur fond #5972c6 ; « Inactif par défaut » (site pas allumé) avec un croissant #5972c6.
- **1.19.16** – Fond / Texte rangés dans le dépliant « Réglages ».
- **1.19.15** – Curseurs (luminosité, contraste, saturation, teinte, température) dans un dépliant « Réglages » ; « Ne pas teinter les images » sur la ligne Fond / Texte.
- **1.19.14** – « Ne pas teinter les images » sous les boutons Images.
- **1.19.13** – Section Images (Assombrir / Normales) placée sous Température, avant Lum. images.
- **1.19.12** – Rendu sur ce site : explications au survol des boutons seulement.
- **1.19.11** – Choix du rendu (Recolorer / Précis / Compatible) déplacé sous les thèmes, « Rendu sur ce site ».
- **1.19.10** – Fiche du site, cran Domaine : l'adresse devient « *.caf.fr » (joker estompé).
- **1.19.9** – Interrupteur du site : remplissage #8ab4f9 au cran Domaine.
- **1.19.8** – Interrupteur du site : remplissage #5b75cc au cran Site.
- **1.19.7** – Recolorer : un changement de thème ou de variante s'applique aussitôt, sans recharger la page.
- **1.19.6** – En OFF, la flèche du bouton Auto est grisée comme le reste.
- **1.19.5** – Plus d'espace entre l'interrupteur du site et sa légende.
- **1.19.4** – Boutons du haut harmonisés : actifs teintés de bleu (contour, icône, légende), inactifs neutres.
- **1.19.3** – Onglet Plus : Anti-cookies mis en avant tout en haut (carte avec icône et interrupteur).
- **1.19.2** – Menu : barre de défilement masquée au lieu d'une place réservée (le contenu débordait à droite sous Windows).
- **1.19.1** – Anti-cookies : ne clique jamais un refus payant (« Refuser et s'abonner », murs « accepter ou payer »).
- **1.19.0** – Anti-cookies (onglet Plus, activé par défaut) : rejette automatiquement les demandes de cookies — « Tout refuser » des gestionnaires connus (OneTrust, Didomi, Cookiebot, Axeptio, CookieScript, Usercentrics…), sinon un bouton de refus dans un bandeau qui parle de cookies ; jamais « Accepter ».
- **1.18.13** – Bouton Auto double : la flèche accolée déplie / replie le détail (choix retenu).
- **1.18.11** – Légende du bouton Auto : la plage horaire seule, sans « Auto ».
- **1.18.10** – Auto : sources indépendantes (décocher la dernière coupe Auto au lieu de cocher l'autre) ; « Selon plage » ; le menu ne se décale plus à l'ouverture d'Auto (place de la barre de défilement réservée, contenu centré).
- **1.18.9** – Interrupteur 3 crans : remplissage bleu arrondi au cran Site.
- **1.18.8** – Ligne du haut : trois boutons à icône sur une ligne (marche/arrêt · actif par défaut · Auto) avec légende dessous ; le détail Auto s'affiche dessous quand il est allumé (« Auto OFF » sinon).
- **1.18.7** – Fiche du site : interrupteur à 3 crans OFF · Site · Domaine (légende dessous) là où un domaine peut être partagé ; l'option « Appliquer à tout le domaine » de l'onglet Plus y est intégrée.
- **1.18.6** – Recolorer : nos feuilles sont replacées après celles du site (posées avant <head>, elles perdaient à sélecteur égal : fond d'écran de Freebox OS non voilé, entre autres).
- **1.18.5** – Images de fond SVG mesurées dans la page (l'extension ne sait pas les décoder) ; une image illisible mais servant de fond est au moins assombrie comme les photos.
- **1.18.4** – Images de fond : voile réglé sur leurs zones les plus claires (pas seulement la moyenne), au moins aussi assombries que les photos en mode « Assombrir » ; fonds d'écran posés sur html / body voilés sur toute la fenêtre (ex. Freebox OS). Points de la variante en cours toujours affichés sur le thème choisi.
- **1.18.3** – Auto : « Selon thème OS » au lieu de macOS.
- **1.18.2** – Variantes en intensité croissante : Classique (teintes gardées) · Renforcé (seuil bas, fonds colorés au ton du thème) · Profond (tout plus foncé sauf le texte). Thème et variante s'appliquent à tous les sites non personnalisés ; le réglage « Seuil » est fondu dans les variantes.
- **1.18.1** – Recolorer : décisions clair / foncé sur la luminance perçue (le jaune vif compte comme clair) ; réglage « Seuil » Normal · Fort (défaut) · Total, de plus en plus agressif.
- **1.18.0** – Recolorer refait : palette propre à chaque thème (surfaces teintées, texte, texte secondaire, liens, intensité des couleurs), hiérarchie des blocs clairs conservée ; trois variantes à logique différente (Classique : teintes gardées assombries · Couleurs gardées : couleurs vives intactes · Tout sombre : fonds neutres) ; filet de sécurité par contraste réel texte/fond (4,5:1), bordures claires, corrections prioritaires même face aux !important des sites ; feuilles en double lues une fois. Plus d'éclair clair : règles de la visite précédente gardées tant que toutes les feuilles ne sont pas lues, réglages réappliqués (mode Auto, chaque minute) sans rien retirer, voile provisoire sur les images de fond pas encore mesurées.
- **1.17.7** – Recolorer : le filet de sécurité va toujours au bout de la page (il repartait de zéro à chaque relecture du CSS, d'où des blocs blancs au rechargement sur Amazon) ; dégradés clairs et changements de classe (menus, onglets) vérifiés ; images nettement assombries en mode « Assombrir ».
- **1.17.6** – Le thème s'applique au chargement même si Chrome a perdu l'enregistrement du script de page (injection de secours).
- **1.17.5** – Recolorer : filet de sécurité sur la page affichée (fond resté clair → sombre, texte resté sombre → clair, ex. bandeaux de cookies) ; aussi appliqué dans les cadres (publicités).
- **1.17.4** – Plus d'erreur « Duplicate script ID » au réveil de l'extension.
- **1.17.3** – Recolorer : images de fond claires (motifs, textures, planches d'icônes, images intégrées) assombries par un voile, jamais inversées, selon l'option Images « Assombrir » ; scripts de page réenregistrés à chaque réveil de l'extension (plus besoin de OFF/ON).
- **1.17.2** – « Choisir un élément » tout en bas du menu.
- **1.17.1** – Recolorer : la bascule depuis le menu fonctionne (script manquant à l'injection, instance gardée si réinjecté).
- **1.17.0** – Nouveau moteur « Recolorer » (par défaut sur les autres sites) : lit le CSS de la page et réécrit chaque couleur selon son rôle ; ce qui est clair passe en sombre, ce qui est déjà sombre le reste, les images ne sont jamais inversées.
- **1.16.11** – Gmail : un grand e-mail blanc (CAF…) ne fait plus juger la page « claire » (plus de page ni de photo de fond inversées).
- **1.16.10** – Auto déplié : le menu défile pour montrer tout le panneau.
- **1.16.9** – Icône liste pour le bouton Sites.
- **1.16.8** – Nouvelle icône globe pour le bouton Sites.
- **1.16.7** – « Choisir un élément » centré dans la fiche du site.
- **1.16.6** – Résumé Auto replié : seulement la plage horaire (« 18:42–07:55 »).
- **1.16.5** – Résumé Auto replié : tranche horaire affichée (« Plage solaire 18:42–07:55 »).
- **1.16.4** – « Inactif par défaut » : croissant bleu.
- **1.16.3** – Fiche du site : plus de bouton Personnaliser ; au survol du nom, « Personnaliser <site> ? » (clic) ; mentions « Thème sombre activé », « Toujours désactivé ici », « Thème personnalisé ».
- **1.16.2** – Résumé Auto : « Plage solaire » / « Plage horaire » au lieu de « soleil » ; chevron pour déplier.
- **1.16.1** – Bouton marche/arrêt (power) à la place du curseur ; « Actif par défaut » bascule en « Inactif par défaut ».
- **1.16.0** – En haut : curseur OFF ⟷ ON + bouton « Actif par défaut » ; OFF grise tout le menu ; barre Auto avec horloge ;
  fiche du site avec interrupteur à croissant (jaune : sombre ici, bleu : coupé), Personnaliser dessous.
- **1.15.0** – Interrupteur DARKee dans le titre ; ligne « Tous les sites | Sites choisis » ; barre « Automatique »
  pleine largeur, dépliable, avec son interrupteur.
- **1.14.0** – En haut : OFF | ON (+ Auto) ; sous ON, « Actif par défaut » ou « Non actif par défaut » pour les sites jamais réglés.
- **1.13.6** – « Par site » retient le choix de chaque site (allumé ou coupé), le même qu'en « Par défaut » ;
  seuls les sites jamais réglés restent clairs en « Par site ».
- **1.13.5** – Indicateur rond placé à l'extérieur de la carte, à gauche.
- **1.13.4** – Indicateur de la carte du site : rond, aux couleurs de l'icône DARKee.
- **1.13.3** – Carte du site : icône DARKee de l'état du site (même code couleur que la barre d'outils) ; logo retiré du titre.
- **1.13.2** – Icône « Par site » : un petit croissant seul.
- **1.13.1** – Site déjà sombre (Gmail) : fond sombre pendant le chargement, plus de flash blanc avant que le site n'applique ses styles.
- **1.13.0** – Ce qui est déjà sombre reste sombre : e-mails au design sombre dans Gmail (ex. Steam), bandeaux sombres
  des pages inversées. Variantes : Classique (zones sombres gardées), Couleurs gardées, Tout sombre.
- **1.12.1** – Raccourci retiré du bouton « Par site ».
- **1.12.0** – En haut : OFF | Par défaut | Par site (+ Auto). OFF éteint tout, sites personnalisés compris ;
  Par défaut = tous les sites en sombre sauf ceux qu'on coupe ; Par site = seulement ceux qu'on allume (⌥⇧D, carte du site).
- **1.11.8** – Carte du site : croissant de lune à la place de la coche.
- **1.11.7** – Règles « Choisir un élément » enfin appliquées sur les sites déjà sombres (Gmail) ; « Actif par défaut » ;
  coche centrée ; jaune adouci ; sélecteur visible seulement en mode Personnalisé.
- **1.11.6** – Jamais de flash au chargement : thème appliqué tout de suite à la première visite d'un site,
  et décision rapide pour un site déjà sombre jamais vu ; infobulles blanches assombries aussi.
- **1.11.5** – Cartes, menus et fenêtres flottantes blancs (ex. carte de contact de Gmail) assombris dès leur apparition.
- **1.11.4** – Panneaux blancs ajoutés (e-mail qui s'ouvre…) assombris avant le premier affichage : plus de demi-seconde blanche.
- **1.11.3** – Plus de flash blanc ni de négatif au chargement : détection après chargement, confirmée deux fois ;
  panneaux blancs assombris dès le début.
- **1.11.2** – Site déjà sombre (ex. Gmail en thème photo) : la zone de lecture et la liste, grands panneaux blancs, passent en sombre.
- **1.11.1** – Icône OFF : croissant gris.
- **1.11.0** – Actif = thème sombre par défaut sur tous les sites (déjà sombres ou non) ; l'interrupteur
  « Activé par défaut sur les autres sites » disparaît. Accès à tous les sites demandé en passant sur Actif.
- **1.10.7** – Retour à la détection et au rendu d'avant ; seule correction gardée : les images de fond ne sont plus en négatif.
- **1.10.6** – Essai d'assombrissement des blocs blancs (annulé en 1.10.7).
- **1.10.5** – Option Images « Inverser » retirée (Assombrir · Normales).
- **1.10.4** – Images de fond (ex. thème photo de Gmail) gardées en vraies couleurs au lieu d'un négatif
  (le changement de détection de cette version a été annulé en 1.10.7).
- **1.10.3** – Champs creusés plus sobres : ombre intérieure discrète, sans liseré ni coins ajoutés.
- **1.10.2** – Variantes : flèche au survol du thème actif ; un clic passe le site en Personnalisé et change de variante.
- **1.10.1** – Variante 3 « Tout sombre » : dans les zones gardées, ce qui reste clair (ex. barres et champ de recherche
  d'Amazon) passe en sombre ; les champs de recherche et de saisie sont creusés.
- **1.10.0** – Sélecteur d'élément : « Choisir un élément » sous la carte du site, puis clic dans la page →
  Thème, Couleurs d'origine, Masquer ou Par défaut. Règles retenues par site.
- **1.9.41** – Variantes de thème (site personnalisé, clic sur le thème choisi) : Classique, Zones sombres gardées
  (ex. bandeau d'Amazon), Couleurs gardées (blocs de couleur vive). Remplace les variantes de couleurs de 1.9.40.
- **1.9.40** – Thèmes à 3 variantes de couleurs (remplacé en 1.9.41).
- **1.9.39** – Vues Sites et Plus : panneau Auto et carte du site masqués.
- **1.9.38** – Onglet Sites : réglages « Autres sites » en haut.
- **1.9.37** – Case raccourcie en « Appliquer à tout le domaine » (détail au survol).
- **1.9.36** – Titre, ligne d'état et OFF | Actif | Auto restent en place pendant le défilement.
- **1.9.35** – Un peu d'espace entre les vignettes de thème et leur nom.
- **1.9.34** – L'icône de la barre d'outils suit l'état de chaque onglet (dont le contour bleu des sites coupés), sans attendre la page.
- **1.9.33** – Site coupé alors que DARKee est actif : contour bleu (au lieu de jaune).
- **1.9.32** – Site coupé alors que DARKee est actif = exception personnalisée : icône contour jaune + croissant bleu.
- **1.9.31** – Icône à contour jaune réservée aux sites actifs et personnalisés ; croissant jaune = actif.
- **1.9.30** – Le menu entier défile (titre fixé en haut) : tous les réglages restent accessibles, panneau Auto ouvert compris.
- **1.9.29** – Ligne d'état tout en haut, sous le titre.
- **1.9.28** – Plus › Ce site : case « Appliquer à tout le domaine » (sous-domaines compris ; Docs, Sheets, Slides, Forms ensemble).
- **1.9.27** – Ligne d'état placée au-dessus de la carte du site.
- **1.9.26** – Plage solaire : les boutons affichent le décalage total (− 15, − 30, − 45 min…).
- **1.9.25** – Flèche d'actualisation du lieu en gris.
- **1.9.24** – Rendu : Compatible avant Précis.
- **1.9.23** – Site personnalisé : ligne d'état « Personnalisé… » et réglages en jaune.
- **1.9.22** – Lever/coucher en bleuté ; « Changer » remplacé par une flèche d'actualisation.
- **1.9.21** – « Rythme du soleil » renommé « Plage solaire ».
- **1.9.20** – Un site personnalisé garde son thème même en OFF ou quand le mode Auto est en pause.
- **1.9.19** – Rythme du soleil réordonné : lieu, lever/coucher, frise, puis boutons « − 15 min (heure) + 15 min ».
- **1.9.18** – Bouton « Personnaliser » sur la carte du site (remplace « Uniquement pour… ») : le site garde ses propres réglages.
- **1.9.17** – Panneau Auto repliable (résumé « macOS · soleil » une fois replié).
- **1.9.16** – Rythme du soleil : seulement les décalages entre − et + ; lever à gauche et coucher à droite sous la frise.
- **1.9.15** – Panneau Auto : ligne « En ce moment » retirée, réglages répartis sur toute la largeur.
- **1.9.14** – La ligne d'état sous le site reste toujours affichée (le menu ne saute plus).
- **1.9.13** – En haut : OFF | Actif, et à droite un bouton Auto (activé ou non).
- **1.9.12** – Mode Auto : « Rythme du soleil » avec un décalage réglable au coucher et au lever.
- **1.9.11** – En haut : Actif / OFF ; sous Actif, interrupteur Fixe ↔ Auto (le panneau Auto s'ouvre en mode Auto).
- **1.9.10** – « Avec macOS » renommé « Selon thème macOS ».
- **1.9.9** – Curseur « Images » renommé « Lum. images ».
- **1.9.8** – Curseur Température (froid ↔ chaud) et case « Ne pas teinter les images ».
  En rendu Compatible (Docs, Sheets, Slides), seul le côté chaud s'applique.
- **1.9.7** – Panneau Auto repensé (interrupteurs « Avec macOS » / « Selon l'heure », frise des 24 h, « En ce moment »).
  Sites et Plus de nouveau en haut, en plus gros. Images : Assombrir · Normales · Inverser.
  L'extension s'appelle désormais DARKee (anciennement Dark Google).
- **1.9.6** – Préréglage « Intense » retiré ; « Bleu nuit » plus bleu.
- **1.9.5** – Mode Auto : la position s'affiche en « Près de Lyon, France » (ou le pays), d'après une liste de villes intégrée.
- **1.9.4** – Préréglages en vignettes d'aperçu.
- **1.9.3** – Menu plus compact : tous les réglages visibles sans défiler ; Sites (globe) et Plus (roue dentée) sur une ligne en bas.
- **1.9.2** – Auto et Horaire réunis : le mode Auto se base sur l'apparence de macOS et/ou un horaire.
- **1.9.1** – Menu : icônes pour Actif / Auto / Horaire / OFF, onglets Réglages · Sites · Plus en bas.
- **1.9.0** – Mode Horaire : thème sombre X minutes avant le coucher du soleil (position arrondie à ~1 km,
  gardée dans le navigateur) ou à heures fixes.
- **1.8.0** – Docs, Sheets, Slides : les photos changent tout de suite en passant d'un mode Images à l'autre
  (plus besoin de bouger le curseur). Icône « coupé » : croissant bleu.
- **1.7.0** – Icône à 3 états : croissant bleu (coupé), jaune (actif), contour jaune et fond noir (appliqué sur ce site).
  Icônes régénérables avec `icons/generer-icones.py`.
- **1.6.0** – Docs, Sheets, Slides : les photos du document (dessinées dans un canvas) suivent enfin l'option Images.
  Correction des images plus exacte en rendu Compatible.
- **1.5.0** – N'importe quel site : le gros bouton ou le raccourci « Ce site » active le thème sombre sur le site ouvert
  et le mémorise (liste « Autres sites »). Autorisation Chrome demandée pour ce site ou pour tous les sites.
- **1.4.0** – Moteur de rendu « Compatible » (filtre CSS) : corrige Docs, Sheets et Slides qui s'affichaient brouillés.
  Choix Précis / Compatible par site dans l'onglet Plus.
- **1.3.0** – Menu refait en onglets (Réglages, Sites, Plus), mode Actif / Auto / Inactif, bouton du site courant,
  option Images (Inverser / Assombrir / Garder), curseurs − / +, raccourcis affichés dans le menu.
- **1.2.0** – Détection des sites déjà sombres : ils ne sont plus inversés en clair.
- **1.1.0** – Barre de titre sombre réglable site par site (ex. garder Keep en jaune).
- **1.0.0** – Première version : Google et Wikipédia en sombre, réglages, préréglages, raccourcis.
