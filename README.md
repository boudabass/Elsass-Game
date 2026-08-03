# Elsass Game — arcade The Elsassisch

Arcade de jeux **Phaser 4** gratuite, réservée aux clients, embarquée en iframe
dans le site de la boutique. Application **Next.js 15**, authentification via
Odoo, données dans PostgreSQL.

Remplace l'arcade précédente écrite en p5.js.

## Démarrer

```bash
pnpm install
cp .env.example .env.local   # puis remplir les valeurs
pnpm dev
```

Variables d'environnement (voir `.env.example`) :

| Variable | Rôle |
|---|---|
| `ODOO_URL` / `ODOO_DB` | vérification du mot de passe au login, rien d'autre |
| `DATABASE_URL` | PostgreSQL : catalogue, scores, sauvegardes |
| `SESSION_SECRET` | signature du cookie de session (7 jours) |
| `ADMIN_UID` | uid Odoo autorisé sur `/admin` |
| `COOKIE_DOMAIN` | ex. `.monsite.com`, pour partager la session avec le site |

## Structure

```
src/                       application Next.js (login, catalogue, scores, admin)
public/games/core/         socle commun à tous les jeux
public/games/<jeu>/<v>/    un jeu = un dossier autonome
```

Le socle `core/` est chargé par simples balises `<script>` :

| Fichier | Rôle |
|---|---|
| `vendor/phaser-4.2.1-arcade.min.js` | le moteur, version figée, servi en local |
| `platform.js` | seul point de contact avec l'API (score, sauvegarde cloud) |
| `save.js` | sauvegarde locale + serveur, avec version et migrations |
| `score.js` | meilleur score du joueur |
| `ui.js` | texte et boutons tactiles à taille relative |
| `scenes/PreloadScene.js` | écran de chargement |
| `boot.js` | crée le jeu Phaser avec les règles communes |

## Règles de l'arcade

- **Clic / tap uniquement** : ni clavier, ni manette. Le clavier est désactivé
  au niveau du moteur, pas seulement ignoré.
- **Même expérience partout** : toutes les tailles sont exprimées en pourcentage
  de l'écran, jamais en pixels.
- **Physique Arcade** (pas Matter), **cartes au format Tiled**.
- **Contrat de sauvegarde** : toute sauvegarde porte un numéro de version ; un
  changement de format impose une migration. On ne casse jamais une partie.

## Ajouter un jeu

1. Copier un dossier de jeu existant sous `public/games/<nom>/v1/`.
2. Décrire le jeu dans `main.js` via `Arcade.boot({...})`.
3. Publier la fiche du jeu depuis `/admin` (l'URL pointe vers `index.html`).
   L'identifiant numérique est injecté automatiquement dans l'URL (`?gid=`).

## Identité de marque

L'interface (connexion, catalogue, barre de navigation) reprend la charte
graphique de theelsassisch.com : noir / rouge alsacien / or, police **Azimut**
pour les titres (`public/fonts/azimut/`, licence CC BY-ND 4.0 — caractère créé
par Benjamin Blaess, Julien Priez & Mathieu Réguer pour la Ville de Strasbourg,
azimut.strasbourg.eu), **Montserrat** pour le corps de texte. Couleurs
définies dans `tailwind.config.ts` (`theme.colors.elsass`) et reprises en
variables CSS dans `globals.css`. Mobile-first : la nav bascule en menu ☰
sous le palier `sm`.

## Déploiement

Image Docker `standalone` construite par le `Dockerfile`, déployée sur Coolify.

> Dépôt public : aucune URL ni base réelle dans les fichiers versionnés.
> Toute la configuration passe par les variables d'environnement.
