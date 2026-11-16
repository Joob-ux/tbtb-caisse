# Caisse T.B.T.L — fiche pour l'agent

Appli de reçus de transport pour le client **T.B.T.L** (Touba Bakhdaté Transport Logistique,
gérant : Djily Thiane), réalisée par Matar Diop (Xelkoom Valley).
Les demandes arrivent souvent depuis un téléphone : faire la modification complètement
(code, test, déploiement, vérification). Répondre en français, court et structuré.

## Appareils
- **TPE Q3Pro** (Android, imprimante 58 mm intégrée) : une appli Android enveloppe la page web
  en ligne et imprime via **RawBT**. Elle expose `window.Android.printRaw` (ticket en image
  ESC/POS, avec logo) et/ou `window.Android.printReceipt` (texte seul). Cette appli Android
  n'est **pas** dans ce dépôt.
- Téléphones : même page, reçu en PDF 58 mm (partage WhatsApp / téléchargement).
- Le dossier `android/` (pont `SunmiPrinter`, Sunmi V2s) est l'ancien projet : le client a
  finalement pris un Q3Pro. Ne pas s'en servir sans demande explicite.

## En production
- https://tbtb-caisse.vercel.app — Vercel publie le dossier `web/` (voir `vercel.json`),
  **déploiement automatique** à chaque push sur `main`.
- Reçus envoyés au suivi à distance (dépôt `Joob-ux/tbtb-suivi`,
  https://tbtb-suivi-g2vd.onrender.com) par `web/suivi-sync.js`. Si le format d'un reçu
  change, adapter aussi `tbtb-suivi`.

## Code (`web/`, sans build, JavaScript simple)
- `index.html` : formulaire (Date, N°, Nom, Destination, Tél., Colis, Somme) + Historique.
- `app.js` : logique, historique, recherche, filtres, impression.
- `ticket-pdf.js` : mise en page du ticket + **infos de l'entreprise** (objet `ENTREPRISE` :
  téléphones, lignes, adresse…).
- `ticket-escpos.js` : ticket image pour l'impression TPE.
- `suivi-sync.js` : envoi au suivi, réessai automatique.
- `sw.js` : cache hors ligne. **Augmenter `CACHE` (tbtb-vNN) à chaque modification**, sinon
  le TPE garde l'ancienne version.

## Règles de travail
1. Les reçus sont stockés dans le `localStorage` de l'appareil (`tbtb_recus_v1`) : ne jamais
   changer cette clé ni le format sans migration, sinon l'historique du client est perdu.
2. La numérotation des reçus doit rester continue (pas de numéro réutilisé).
3. Tester avant de pousser : servir `web/` (`python3 -m http.server`) et l'ouvrir avec
   Playwright, en simulant aussi le TPE (`window.Android = { printRaw(){}, printReceipt(){} }`),
   sans erreur JavaScript.
4. L'appli doit fonctionner hors ligne et rester rapide sur un réseau faible.
5. Montants en F CFA, séparateur de milliers par espace. Messages de commit en français.
