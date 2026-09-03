# PLAN — Arcade Elsass-Game (Phaser 4)

> Rédigé le 03/08/2026. Remplace l'arcade `game-4` (p5.js), qui est gelée.
> Repo **public** → jamais de domaine ni de base réels dans les fichiers versionnés
> (placeholders : `monsite.com`, `votre-instance`, tout le reste en variables d'env).
>
> **Note (30/08/2026)** : ce plan couvrait le lancement du socle + Cigogne v1
> (étapes 1-9 ci-dessous, §5). Il est **historique** — depuis, Waggis,
> Similitude, Elsass Farm Bloc A et plusieurs spikes (Schieweschlawe,
> Quilles Saint-Gall) ont été livrés par-dessus ce socle. Pour l'état courant
> du projet, se référer au `CLAUDE.md` du repo (non versionné) et à l'article
> Odoo 732 (passation), pas à ce fichier — gardé pour la trace des décisions
> fondatrices (§1, §2, §7) qui restent valables.

---

## 1. Décisions actées

| Sujet | Décision |
|---|---|
| Moteur | **Phaser 4** (4.2.1, dernière stable ; Phaser 4.0 sorti le 10/04/2026) |
| Repo | `Elsass-Game`, neuf, public, vide au départ |
| Socle Next.js | Repris de game-4 : login Odoo, session HMAC, Postgres, `/admin`, `/play/[gameId]` |
| Base de données | **La même** que game-4 (tables `game` / `score` / `save`) |
| Déploiement | Coolify, on **reprend** les sous-domaines `arcade.` et `arcade-dev.` |
| game-4 | Gelé, plus utilisé, plus déployé |
| 1er jeu | **Cigogne**, remake du jeu existant |
| Écriture du code | JavaScript simple, sans étape de build (comme game-4) |
| Socle partagé | Construit **dès le départ**, avant le jeu |
| Assets | Retriés et repackagés en atlas pour Phaser |
| Crons Hermes | Coupés |

---

## 2. Ce qu'on corrige par rapport à game-4

Trois leçons, à garder en tête tout au long :

1. **engine/v2 avait 14 modules, dont un déjà déprécié avant d'avoir servi.**
   → Règle : une brique n'entre dans le socle que si (a) deux jeux s'en servent
   réellement, ou (b) c'est un contrat de plateforme (score, save, chargement).
   Le reste vit dans le dossier du jeu, quitte à être remonté plus tard.

2. **Les données étaient « en avance sur le code »** (relationTiers, étages de mine
   déclarés sans logique). → Règle : pas de donnée dans les JSON tant que le code
   qui la lit n'existe pas.

3. **La lib était chargée depuis un CDN externe.** → On sert Phaser **en local**,
   version figée dans le repo. Si jsDelivr tombe ou est bloqué, les jeux tournent.

---

## 3. Architecture cible

```
Elsass-Game/
├── src/                          ← Next.js 15 (repris de game-4, nettoyé)
│   ├── app/login, /play/[gameId], /admin, /scores, /games
│   ├── app/api/scores, /api/storage, /api/auth/me
│   └── lib/odoo.ts, session.ts, db.ts
│
├── public/games/
│   ├── core/                     ← LE SOCLE (ex-system + ex-engine, fusionnés)
│   │   ├── vendor/phaser-4.2.1.min.js
│   │   ├── platform.js           ← lit ?gid=, parle aux API (score, save cloud)
│   │   ├── boot.js               ← crée le Phaser.Game, échelle, tactile, plein écran
│   │   ├── scenes/PreloadScene.js ← barre de chargement, charge les atlas
│   │   ├── save.js               ← save locale + cloud, version + migrations
│   │   ├── score.js
│   │   └── ui.js                 ← boutons tactiles, texte lisible sur mobile
│   │
│   ├── assets/                   ← atlas partagés (voir §6)
│   │
│   └── cigogne/v1/               ← le jeu (nouveau repo = on repart à v1)
│       ├── index.html
│       ├── config.js
│       └── scenes/MenuScene.js, GameScene.js, OverScene.js
│
├── CLAUDE.md                     ← contexte projet réécrit
└── PLAN.md                       ← ce fichier
```

**Pourquoi « core » et pas « system/engine/v2 »** : un seul dossier, un seul nom,
pas de confusion possible avec l'ancien socle p5.

---

## 4. Le socle — 6 briques, pas une de plus

Chaque brique a une raison d'exister aujourd'hui, pas « au cas où ».

| Brique | À quoi ça sert | Pourquoi dans le socle |
|---|---|---|
| `platform.js` | Lit `?gid=` dans l'URL, expose `Platform.score.submit()` et `Platform.save.read/write()` | Contrat plateforme : identique pour tous les jeux |
| `boot.js` | Crée le jeu Phaser avec la bonne config : plein écran, redimensionnement, **clic/tap uniquement** (zéro clavier, zéro manette) | Toute l'arcade a la même règle d'entrée |
| `PreloadScene` | Écran de chargement + chargement des atlas | Tous les jeux chargent des assets |
| `save.js` | Sauvegarde locale immédiate + cloud toutes les 5 min, avec **numéro de version et migrations** | Une save cassée = un client qui perd sa partie |
| `score.js` | Envoi du score, meilleur score local | Contrat plateforme |
| `ui.js` | Bouton tactile, texte à taille relative à l'écran | Sinon chaque jeu recode ses boutons |

Tout le reste (horloge de jeu, caméra, grille, cultures, PNJ…) attend Elsass Farm
et ne montera dans `core/` que si un deuxième jeu en a besoin.

---

## 5. Étapes et points de validation

| # | Étape | Qui | État |
|---|---|---|---|
| **1** | Squelette : Next.js repris de game-4, nettoyé de tout p5 | Claude | ✅ fait le 04/08 |
| **2** | Socle `core/` : Phaser 4.2.1 en local + les 6 briques | Claude | ✅ fait le 04/08 |
| **3** | **Cigogne v1 Phaser** (menu / jeu / game over, meilleur score) | Claude | ✅ fait le 04/08 |
| **4** | Push GitHub → pull Coolify → variables d'env → deploy `arcade-dev` | John | ✅ fait |
| **5** | Fiche du jeu créée dans `/admin`, puis test réel sur téléphone | John | ✅ fait |
| **6** | **GATE** : validation de Cigogne, puis bascule en production | John | ✅ fait |
| **7** | Assets : repackaging en atlas + tilesets Tiled (voir §6) | Claude | partiel — atlas Kenney empaquetés (10/08), pas encore consommés par un jeu |
| **8** | Réécriture de la doc Odoo (hub 403) pour Phaser | Claude | partiel — bannière d'avertissement posée le 10/08, contenu détaillé pas réécrit |
| **9** | Elsass Farm en Phaser | — | Bloc A livré et en prod (v0.7.1, 25/08) |

Rien ne part en production avant l'étape 6. **Depuis** : Waggis (v1) et
Similitude (v1+v2) livrés et en prod ; spikes Schieweschlawe (PRD Odoo 873)
et Quilles Saint-Gall (PRD Odoo 875) en cours d'itération directe sur `dev`.

**Vérifié le 04/08** : syntaxe de tous les fichiers JS (`node --check`) et
typage de l'application (`tsc --noEmit`) sans erreur. Le `next build` complet
n'a pas pu être joué dans le bac à sable de Claude, qui n'a pas accès à
fonts.googleapis.com (`next/font` dans `layout.tsx`) — sans effet sur Coolify,
game-4 se construisait déjà comme ça.

---

## 6. Assets — le repackaging

Aujourd'hui : ~5300 fichiers PNG isolés, triés en 8 catégories.
Problème avec Phaser : 5300 requêtes = chargement lent, surtout en 4G.

Solution : **atlas de textures**. On regroupe les images d'un même thème en une
seule grande image + un fichier JSON qui dit où est chaque sprite dedans.
Phaser sait lire ça nativement (`this.load.atlas(...)`).

- Le tri par catégories déjà fait **reste valable** — on ne rejoue pas le tri.
- On génère les atlas par thème (`ferme`, `village`, `ui`, `nature`…) avec un
  script, pas à la main.
- Le skill `tri-assets-game4` sera à mettre à jour (étape 6, pas avant).

---

## 7. Points tranchés le 04/08/2026

1. **Moteur physique : Arcade Physics.** Léger, collisions en rectangles et
   cercles, gravité. Couvre Cigogne comme la ferme. Matter écarté (trop lourd
   sur mobile pour ce qu'on en ferait).
2. **Cartes : éditeur Tiled**, export JSON lu nativement par Phaser
   (`this.load.tilemapTiledJSON`). John dessine ses cartes à la souris avec les
   tuiles Kenney et devient autonome sur le level design. Les atlas générés à
   l'étape 6 devront donc aussi produire des **tilesets compatibles Tiled**.
**Tranché le 04/08/2026 — base de données :** aucun client n'a encore eu accès à
l'arcade, donc aucune donnée n'a de valeur. On **garde le service Postgres de
Coolify** (même `DATABASE_URL`) et on repart de tables vides :

```sql
DROP TABLE IF EXISTS save, score, game CASCADE;
```

Les 3 tables sont recréées vides au premier chargement de page (`CREATE TABLE IF
NOT EXISTS` dans `db.ts`). Rien à migrer, catalogue republié via `/admin`.

---

## 8. Ce qui ne change pas

- Clic / tap uniquement, jamais de clavier ni de manette.
- Identique sur smartphone, tablette et PC.
- Gratuit, réservé aux clients connectés via Odoo.
- Claude commite **et pousse directement** sur `origin` (décision John,
  10/08/2026 — avant cette date Claude commitait en local et John poussait
  via GitHub Desktop ; jugé inutile comme étape manuelle). Toujours avec
  prudence : `node --check` / `tsc --noEmit` au minimum avant de pousser.
