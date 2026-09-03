/*
 * Harnais QA Elsass Game — helpers communs (injectés par qa/runner.py AVANT le
 * scénario, dans le MÊME module ES). Tout scénario qa/scenarios/*.js peut
 * utiliser ces fonctions directement.
 *
 * Conventions (article Odoo 703) :
 *  - module ES : `export default async ({ page }) => { ... }`
 *  - retour : `{ data: {...}, type: "application/json" }`
 *  - un scénario = UN script complet (naviguer → interagir → lire → capturer)
 *  - screenshots : champs `shot_<nom>` = PNG base64 (extraits en fichiers par
 *    le runner)
 *  - pas de waitForTimeout (Chrome 151) : sleep() ci-dessous.
 */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* Collecte des erreurs console + pageerror du scénario entier. */
const consoleErrors = [];
function armConsole(page) {
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push("pageerror: " + String(err)));
}

/* Connexion au compte test studio (arcade) si l'écran de login est présent. */
async function loginArcade(page, email, mdp) {
  await page.goto("https://elsass-game-dev.theelsassisch.com/login",
                  { waitUntil: "domcontentloaded", timeout: 45000 })
    .catch((e) => consoleErrors.push("goto-login: " + e.message));
  await sleep(2500);
  const hasLogin = await page.evaluate(() => !!document.getElementById("email"))
    .catch(() => false);
  if (!hasLogin) return false; // déjà connecté
  await page.type("#email", email, { delay: 10 });
  await page.type("#password", mdp, { delay: 10 });
  await page.click('button[type="submit"]')
    .catch((e) => consoleErrors.push("login-click: " + e.message));
  for (let i = 0; i < 60; i++) {
    const p = await page.evaluate(() => location.pathname).catch(() => "/login");
    if (p && p !== "/login") return true;
    await sleep(500);
  }
  return true;
}

/* Attend qu'une scène Phaser (par clé) soit active. Retourne true/false. */
async function attendScene(page, cle, maxSec = 25) {
  for (let i = 0; i < maxSec * 2; i++) {
    const ok = await page.evaluate((c) => {
      try {
        const a = Arcade.game.scene.getScenes(true);
        return a.length && a[0].scene.key === c;
      } catch (e) { return false; }
    }, cle).catch(() => false);
    if (ok) return true;
    await sleep(500);
  }
  return false;
}

/* Clique sur l'objet interactif le plus large de la scène active
 * (heuristique « bouton principal », utilisée pour « Jouer »). */
async function clickBoutonPrincipal(page) {
  const b = await page.evaluate(() => {
    try {
      const s = Arcade.game.scene.getScenes(true)[0];
      if (!s) return null;
      let z = null, best = 0;
      s.children.list.forEach((o) => {
        if (o.input && o.input.enabled && o.width > 50) {
          const w = o.width * (o.height || 10);
          if (w > best) { best = w; z = o; }
        }
      });
      return z ? { x: Math.round(z.x), y: Math.round(z.y) } : null;
    } catch (e) { return null; }
  });
  if (!b) return false;
  await page.mouse.click(b.x, b.y);
  return true;
}

/* Capture d'écran PNG en base64 (sans changer le viewport courant). */
async function shot(page, nom) {
  const b64 = await page.screenshot({ encoding: "base64" });
  return b64;
}

/* Retour standard attendu par le runner : data + type. */
function retour(data) {
  return { data: { ...data, consoleErrors }, type: "application/json" };
}
