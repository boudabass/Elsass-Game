/*
 * SMOKE TEST du harnais QA — navigation réelle sur elsass-game-dev (waggis v1).
 *
 * Preuve que le harnais fonctionne : chargement du jeu, attente de la scène
 * menu, lecture de l'état Phaser (clé de scène active, boutons), screenshot
 * desktop 1280x720 + mobile 390x844, 0 erreur console attendue.
 *
 * Usage : python3 qa/runner.py qa/scenarios/smoke_arcade.js --out <dir>
 */
export default async ({ page }) => {
  const GAME_URL = "https://elsass-game-dev.theelsassisch.fr/games/waggis/v1/index.html?gid=3";
  const EMAIL = "lacolleacervelle+admin@gmail.com";
  const MDP = "jonjon";

  armConsole(page);
  await loginArcade(page, EMAIL, MDP);

  // --- DESKTOP -----------------------------------------------------------
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto(GAME_URL, { waitUntil: "domcontentloaded", timeout: 45000 })
    .catch((e) => consoleErrors.push("goto-jeu: " + e.message));
  const menuDesktop = await attendScene(page, "menu", 30);
  await sleep(1000);

  const etatDesktop = await page.evaluate(() => {
    try {
      const s = Arcade.game.scene.getScenes(true)[0];
      const boutons = (s && s.children ? s.children.list : [])
        .filter((o) => o.input && o.input.enabled && o.width > 30)
        .map((o) => ({ x: Math.round(o.x), y: Math.round(o.y), w: Math.round(o.width), h: Math.round(o.height || 0) }));
      return {
        cleScene: s ? s.scene.key : null,
        nbBoutons: boutons.length,
        boutons: boutons.slice(0, 8),
      };
    } catch (e) { return { err: String(e) }; }
  });

  const shotDesktop = await shot(page, "desktop");

  // --- MOBILE ------------------------------------------------------------
  await page.setViewport({ width: 390, height: 844 });
  await sleep(800);
  const menuMobile = await attendScene(page, "menu", 10);
  const etatMobile = await page.evaluate(() => {
    try {
      const s = Arcade.game.scene.getScenes(true)[0];
      return { cleScene: s ? s.scene.key : null };
    } catch (e) { return { err: String(e) }; }
  });
  const shotMobile = await shot(page, "mobile");

  return retour({
    url: page.url(),
    titre: await page.title().catch(() => null),
    menuDesktop,
    menuMobile,
    etatDesktop,
    etatMobile,
    shot_desktop: shotDesktop,
    shot_mobile: shotMobile,
  });
};
