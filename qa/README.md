# Harnais QA Elsass Game (qa/)

Harnais de test navigateur RÉUTILISABLE pour eg-qa — déposé dans le repo pour
ne plus être réécrit à chaque carte. Pilotage d'un vrai Chrome headless via
browserless `/function` (article Odoo 703) : un scénario = un script complet,
browserless ouvre/ferme le navigateur lui-même.

## Fichiers

- `runner.py` — le runner générique : lit `BROWSERLESS_URL`/`BROWSERLESS_TOKEN`
  (env ou `./.env`), assemble `helpers.js` + le scénario, POST `/function`,
  sauvegarde la réponse JSON brute et extrait chaque `shot_<nom>` (PNG base64)
  en fichier. C'est le SEUL point d'entrée à connaître.
- `helpers.js` — bloc commun injecté avant le scénario : `sleep`, `armConsole`
  (collecte erreurs console/pageerror), `loginArcade` (connexion compte test),
  `attendScene(cle)` (attente scène Phaser), `clickBoutonPrincipal`,
  `shot(nom)`, `retour(data)`. Un scénario les utilise directement.
- `scenarios/` — scénarios par carte (voir conventions ci-dessous).

## Usage depuis une carte QA

```bash
# 1. Charger les credentials browserless (profil eg-qa)
cd /opt/data/profiles/eg-qa && set -a && . ./.env && set +a

# 2. Lancer un scénario existant
python3 /opt/data/elsass-game/qa/runner.py \
  /opt/data/elsass-game/qa/scenarios/smoke_arcade.js \
  --out /opt/data/kanban/boards/elsassgame/workspaces/<ma-carte>
```

Sorties dans `--out` : `<scenario>.json` (réponse brute) + un PNG par champ
`shot_*` du retour + résumé console/état sur stdout.

## Écrire un scénario (nouvelle carte)

Un fichier JS, module ES, dans `qa/scenarios/` (ou dans le workspace de la
carte, au choix — le runner prend n'importe quel chemin) :

```js
export default async ({ page }) => {
  armConsole(page);                                  // collecte erreurs console
  await loginArcade(page, "lacolleacervelle+admin@gmail.com", "jonjon");
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto("https://arcade-dev.theelsassisch.com/games/waggis/v1/index.html?gid=3",
                  { waitUntil: "domcontentloaded", timeout: 45000 });
  const ok = await attendScene(page, "menu", 30);    // attente scène Phaser
  // ... interactions, lectures d'état via page.evaluate ...
  return retour({ ok, shot_desktop: await shot(page, "desktop") });
};
```

Règles :
- retour obligatoire : `retour({ ...résultats..., shot_<nom>: <base64> })`
  (le runner extrait les `shot_*` en PNG, imprime le reste) ;
- **jamais** `waitForTimeout` / `waitUntil: "networkidle"` (Chrome 151, art. 703) ;
- **jamais** de token/credential sensible dans un scénario commité — le compte
  test ci-dessus est public studio, tout le reste passe par env.

## Vérification avant commit

```bash
node --check qa/helpers.js && node --check qa/scenarios/<scenario>.js
```

## Smoke test de référence

`qa/scenarios/smoke_arcade.js` : navigation réelle sur arcade-dev (waggis v1),
attente de la scène `menu`, lecture de l'état (clé de scène + boutons),
screenshots desktop 1280×720 + mobile 390×844. Résultat de référence du
08/08/2026 : `menu` atteint desktop+mobile, 7 boutons, 0 erreur console.
