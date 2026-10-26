# VERYZ MARKET

Marketplace locale (FCFA, Burkina) : annonces avec photos, recherche, comptes, administration, paiement Mobile Money (**simulation**).

## Démarrer
```bash
npm install     # une seule fois
npm run dev     # démarre sur http://localhost:3000
```
Pour l'ouvrir depuis un téléphone sur le même Wi-Fi : `http://IP-DE-TON-PC:3000`

## Comptes
- **Admin** : téléphone `77656404`, mot de passe `Veryz199@` (réglable dans `.env` — **change-le !**).
  Se connecter sur `/login.html`, puis menu **Admin** pour valider les annonces.
- **Utilisateurs** : s'inscrivent eux-mêmes (téléphone 8 chiffres + mot de passe).
- Les annonces des utilisateurs attendent la validation de l'admin ; celles de l'admin sont publiées directement.

## Où modifier quoi
| Je veux changer… | Fichier / dossier |
|---|---|
| Couleurs, tailles, apparence | `public/css/style.css` (variables en haut) |
| Page d'accueil | `public/index.html` + `public/js/home.js` |
| Fiche produit + paiement | `public/product.html` + `public/js/product.js` |
| Connexion / inscription | `public/login.html` + `public/js/auth.js` |
| Publier une annonce | `public/sell.html` + `public/js/sell.js` |
| Mon compte | `public/account.html` + `public/js/account.js` |
| Administration | `public/admin.html` + `public/js/admin.js` |
| Menu du haut et pied de page | `public/js/layout.js` |
| Outils communs (formats, cartes) | `public/js/ui.js` |
| Catégories de départ, tables | `src/db.js` |
| Réglages (taille photo, providers…) | `src/config.js` et `.env` |
| API comptes | `src/routes/auth.js` |
| API annonces / recherche | `src/routes/products.js` |
| API admin | `src/routes/admin.js` |
| Paiement Mobile Money | `src/routes/payments.js` + `src/services/mobileMoney.js` |
| Photos envoyées | `data/uploads/` (ne pas publier) |
| Base de données | `data/veryz-market.db` (ne pas publier) |

## Mobile Money
Actuellement en **simulation** (`MOBILE_MONEY_MODE=simulation`) : code de confirmation `1234`, aucun argent réel.
Pour accepter de vrais paiements : choisir un prestataire agréé (Orange Money, Moov Money, Coris Money ou un agrégateur),
obtenir ses identifiants API, puis remplacer la logique de `src/services/mobileMoney.js` (création du paiement chez le prestataire
+ confirmation par callback serveur vérifié, jamais par le navigateur).

## Avant de mettre en ligne
- Changer `ADMIN_PASSWORD`, mettre `NODE_ENV=production`, héberger en HTTPS.
- Ne jamais publier `.env` ni `data/` (déjà dans `.gitignore`).
