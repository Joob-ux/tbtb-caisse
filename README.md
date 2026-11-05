# Caisse T.B.T.B — Touba Bakhdaté Transport Logistique

Application de reçus de transport (Date, Nom, Colis, Somme, Signature).
Le même code sert pour deux usages :

| Étape | Appareil | Sortie du reçu |
|---|---|---|
| 1. Maintenant | Téléphone Android du client | PDF 58 mm, partagé par WhatsApp ou téléchargé |
| 2. Après l'achat du TPE | Sunmi V2s | Impression directe sur l'imprimante intégrée |

L'appli détecte seule où elle tourne : sur le Sunmi, le bouton devient « Valider et imprimer ».

## Contenu

```
web/        Application (HTML/JS) : installable sur téléphone, fonctionne hors ligne
  ticket-pdf.js   Mise en page du ticket + infos de l'entreprise (à modifier ici)
  app.js          Formulaire, signature, historique, PDF / impression
android/    Projet Android Studio pour le Sunmi V2s (embarque le dossier web/)
```

Les infos de l'entreprise (téléphones, adresse, lignes…) sont dans `web/ticket-pdf.js`, objet `ENTREPRISE`.

## 1. Installer sur le téléphone (version PDF)

L'appli doit être en ligne en HTTPS pour s'installer et pour le bouton « Partager ».

1. Héberger le dossier `web/` en site statique : GitHub Pages, ou Render (Static Site, *Publish directory* = `web`).
2. Sur le téléphone, ouvrir l'adresse dans **Chrome**.
3. Menu ⋮ → **Ajouter à l'écran d'accueil** / **Installer l'application**.
4. L'icône « T.B.T.B » apparaît. L'appli marche ensuite **sans internet**.

Les reçus sont enregistrés **sur le téléphone** (pas de serveur). Si on vide les données de Chrome, l'historique est perdu.
La numérotation (TBTB-000001, 000002…) est propre à chaque appareil.

## 2. Générer l'APK pour le Sunmi V2s

Prérequis : Android Studio (JDK 17).

1. Ouvrir le dossier `android/` dans Android Studio (il crée le *Gradle wrapper* au besoin).
2. Laisser la synchronisation Gradle se terminer (télécharge le SDK Sunmi `com.sunmi:printerlibrary`).
3. **Build → Build APK(s)**. Le dossier `web/` est copié automatiquement dans l'APK.
4. Installer l'APK sur le Sunmi (câble USB ou clé USB, autoriser « sources inconnues »).

Le pont `PrinterBridge.java` expose `window.SunmiPrinter.print(json)` à l'interface web :
en-tête, détails en deux colonnes, montant en lettres, signature en image, sur papier 58 mm (384 points).

> Le projet Android n'a pas encore été compilé ni testé sur un vrai Sunmi : faire un premier essai d'impression et ajuster les tailles de police dans `PrinterBridge.java` si besoin.

## Pistes d'évolution

- Synchroniser plusieurs appareils / agences (backend Node.js + PostgreSQL)
- Export de la caisse du jour (PDF ou Excel)
- Destination du colis et téléphone du destinataire
- QR code de suivi sur le ticket
