#!/usr/bin/env node
// generer_maps.mjs — cartes Tiled de TEST d'Elsass Farm (Bloc A), régénérées
// en Node (remplace scripts/generer_maps_test.py, injouable ici : chemins
// Linux en dur, Python indisponible sur cette machine). Même algorithme
// d'alignement d'id que scripts/build-atlas.mjs (tri ORDINAL des noms du
// catalogue par (catégorie, px), vérifié contre les .tsx déjà générés).
//
// Fix visuel (demande John 12/08) : la ferme n'utilise plus le mur brique
// (batiment_16px) mais une clôture bois (decor_16px, famille "cloture", 14
// rôles posés par position réelle — coins/segments/bouts d'ouverture, plus
// une tuile unique répétée) ; sol de base = herbe (cohérent avec l'état
// "vide" de la machine à états du sol) ; dimensions 100×100 (au lieu de
// 28×18). La maison (RDC + étage) est inchangée dans son principe.
//
// Fix technique (audit du moteur vendored, cf. plan) : firstgid SÉQUENTIEL
// par tileset embarqué, au lieu de firstgid=1 partagé entre tilesets d'une
// même carte (les 3 cartes précédentes le faisaient). Le moteur
// (TilemapLayer.setTilesets) résout gid→tileset via un tableau gidMap rempli
// SANS CONDITION dans l'ordre des tilesets passés à createLayer() : avec un
// firstgid partagé, le DERNIER tileset de la liste écrase les précédents
// pour toute sa plage de gid, même celle qui appartient en réalité à un
// autre tileset — d'où le firstgid cumulé ici, obligatoire.
//
// Sorties (écrites uniquement ici) :
//   public/games/elsass-farm/v1/assets/maps/{ferme,maison-rdc,maison-etage}-test.json
//   public/games/elsass-farm/v1/zones.json
//
// Rejouable : node scripts/generer_maps.mjs
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const KENNEY = path.join(ROOT, 'public/games/assets/kenney');
const TILESETS = path.join(ROOT, 'public/games/assets/tilesets');
const V1 = path.join(ROOT, 'public/games/elsass-farm/v1');
const MAPS_DIR = path.join(V1, 'assets/maps');

// Tri ORDINAL strict (code points) — identique à scripts/build-atlas.mjs.
function cmpOrdinal(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

async function chargerCatalogue() {
  const raw = JSON.parse(await readFile(path.join(KENNEY, 'catalogue.json'), 'utf8'));
  const entries = [];
  for (const [key, meta] of Object.entries(raw)) {
    if (!key.endsWith('.png')) continue;
    const slash = key.indexOf('/');
    entries.push({ cat: key.slice(0, slash), name: key.slice(slash + 1, -4), meta });
  }
  return entries;
}

function idsParCategorie(entries, cat, px) {
  const noms = entries
    .filter((e) => e.cat === cat && e.meta.px === px)
    .map((e) => e.name)
    .sort(cmpOrdinal);
  const ids = {};
  noms.forEach((n, i) => {
    ids[n] = i;
  });
  return ids;
}

function trouverEntree(entries, cat, name) {
  const e = entries.find((x) => x.cat === cat && x.name === name);
  if (!e) throw new Error(`entrée catalogue introuvable : ${cat}/${name}.png`);
  return e;
}

// --- Lecture d'un .tsx déjà généré (props par tuile + dimensions) ----------
async function lireTsx(tsxFile) {
  const xml = await readFile(path.join(TILESETS, tsxFile), 'utf8');
  const props = {};
  const tileRe = /<tile id="(\d+)">([\s\S]*?)<\/tile>/g;
  let m;
  while ((m = tileRe.exec(xml))) {
    const id = Number(m[1]);
    const p = {};
    const propRe = /<property name="([^"]+)" value="([^"]*)"\/>/g;
    let pm;
    while ((pm = propRe.exec(m[2]))) p[pm[1]] = pm[2];
    props[id] = p;
  }
  const header = /tilecount="(\d+)" columns="(\d+)"/.exec(xml);
  const image = /<image source="[^"]+" width="(\d+)" height="(\d+)"\/>/.exec(xml);
  return {
    props,
    tilecount: Number(header[1]),
    columns: Number(header[2]),
    imagewidth: Number(image[1]),
    imageheight: Number(image[2]),
  };
}

// --- Vérification d'alignement id <-> .tsx (portage de verifier() Python) --
async function verifier(entries, cat, px, tsxFile) {
  const ids = idsParCategorie(entries, cat, px);
  const tsx = await lireTsx(tsxFile);
  const noms = Object.keys(ids).sort((a, b) => ids[a] - ids[b]);
  if (noms.length !== tsx.tilecount) {
    throw new Error(`${tsxFile}: ${noms.length} noms catalogue vs ${tsx.tilecount} tuiles tsx`);
  }
  let incoherents = 0;
  for (const nom of noms) {
    const id = ids[nom];
    const meta = trouverEntree(entries, cat, nom).meta;
    const passableTsx = tsx.props[id]?.passable;
    const passableMeta = meta.passable;
    if ((passableTsx === 'oui') !== (passableMeta === 'oui')) {
      incoherents++;
      if (incoherents < 4) {
        console.log(`!! ${tsxFile} id ${id} ${nom}: tsx=${passableTsx} catalogue=${passableMeta}`);
      }
    }
  }
  if (incoherents) {
    throw new Error(`${tsxFile}: ${incoherents} incohérences passable — alignement FAUX`);
  }
  console.log(`OK alignement ${tsxFile}: ${noms.length} tuiles`);
  return { ids, tsx };
}

// --- Tileset embarqué (image relative à la PAGE v1/) ------------------------
function tuilesetInline(cat, px, tsx, firstgid) {
  const tiles = [];
  for (const [id, p] of Object.entries(tsx.props)) {
    const list = [];
    for (const [name, value] of Object.entries(p)) {
      if (value === 'oui' || value === 'non') {
        list.push({ name, type: 'bool', value: value === 'oui' });
      } else {
        list.push({ name, type: 'string', value });
      }
    }
    if (list.length) tiles.push({ id: Number(id), properties: list });
  }
  return {
    firstgid,
    name: `${cat}_${px}px`,
    tilewidth: px,
    tileheight: px,
    tilecount: tsx.tilecount,
    columns: tsx.columns,
    image: `../../../assets/tilesets/${cat}_${px}px.png`,
    imagewidth: tsx.imagewidth,
    imageheight: tsx.imageheight,
    tiles,
  };
}

// Assemble N tilesets avec firstgid CUMULÉS séquentiels (fix moteur, cf. en-tête).
function assemblerTilesets(liste) {
  let curseur = 1;
  const embarques = [];
  const firstgids = {};
  for (const t of liste) {
    firstgids[t.cat] = curseur;
    embarques.push(tuilesetInline(t.cat, t.px, t.tsx, curseur));
    curseur += t.tsx.tilecount;
  }
  return { embarques, firstgids };
}

// --- Couches ------------------------------------------------------------
function coucheUniforme(nom, w, h, gid) {
  return {
    id: 1, name: nom, type: 'tilelayer',
    width: w, height: h, x: 0, y: 0,
    opacity: 1, visible: true,
    data: new Array(w * h).fill(gid),
  };
}

function coucheAvecExceptions(nom, w, h, remplissage, exceptions) {
  const data = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = exceptions[`${x},${y}`];
      data.push(v === undefined ? remplissage : v);
    }
  }
  return {
    id: 1, name: nom, type: 'tilelayer',
    width: w, height: h, x: 0, y: 0,
    opacity: 1, visible: true, data,
  };
}

function mapJson(w, h, couches, tilesets) {
  return {
    type: 'map', version: '1.10', tiledversion: '1.11.0',
    orientation: 'orthogonal', renderorder: 'right-down',
    width: w, height: h, tilewidth: 16, tileheight: 16,
    infinite: false, nextlayerid: couches.length + 1, nextobjectid: 1,
    layers: couches, tilesets,
    properties: [{ name: 'test', type: 'bool', value: true }],
  };
}

// --- Bordure MUR UNIQUE répétée (maison, inchangé — brique) ----------------
function bordureUniforme(w, h, gid, ouvertures) {
  const exc = {};
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      if (!(x === 0 || y === 0 || x === w - 1 || y === h - 1)) continue;
      if (ouvertures.has(`${x},${y}`)) continue;
      exc[`${x},${y}`] = gid;
    }
  }
  return exc;
}

// --- Bordure CLÔTURE par rôle (ferme — coins/segments/bouts d'ouverture) ---
function bordureCloture(w, h, resoudreGid, ouvertures) {
  const exc = {};
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      if (!(x === 0 || y === 0 || x === w - 1 || y === h - 1)) continue;
      const cle = `${x},${y}`;
      if (ouvertures.has(cle)) continue;
      let role;
      if (x === 0 && y === 0) role = 'coin_hg';
      else if (x === w - 1 && y === 0) role = 'coin_hd';
      else if (x === 0 && y === h - 1) role = 'coin_bg';
      else if (x === w - 1 && y === h - 1) role = 'coin_bd';
      else if (y === 0 || y === h - 1) {
        const gaucheOuverte = ouvertures.has(`${x - 1},${y}`);
        const droiteOuverte = ouvertures.has(`${x + 1},${y}`);
        role = gaucheOuverte ? 'bout_gauche' : droiteOuverte ? 'bout_droit' : 'horizontal';
      } else {
        const hautOuvert = ouvertures.has(`${x},${y - 1}`);
        const basOuvert = ouvertures.has(`${x},${y + 1}`);
        role = hautOuvert ? 'bout_haut' : basOuvert ? 'bout_bas' : 'vertical';
      }
      exc[cle] = resoudreGid(role);
    }
  }
  return exc;
}

// --- Maison (grange) posée DANS la ferme, avec porte praticable ------------
// Décision John 12/08 : la maison doit être une vraie petite bâtisse visible
// SUR la carte de la ferme (toit + murs + porte), pas une brèche invisible
// dans la clôture qui téléporte ailleurs. Gabarit dérivé des rôles du
// tileset batiment_16px (ensemble "grange" — le même jeu de tuiles que les
// murs intérieurs, déjà cohérent). Ancre (AX, AY) = coin haut-gauche de la
// ligne d'avant-toit (la ligne la plus large, 5 tuiles) ; le reste du
// gabarit est calé dessus. Toutes les tuiles sont non-passables SAUF les 2
// tuiles de porte (déjà passable "oui" au catalogue).
const GABARIT_MAISON = [
  { dx: 2, dy: 0, role: 'toit_apex' },
  { dx: 1, dy: 1, role: 'toit_haut_gauche' }, { dx: 2, dy: 1, role: 'toit_haut_centre' }, { dx: 3, dy: 1, role: 'toit_haut_droit' },
  { dx: 1, dy: 2, role: 'toit_milieu_gauche' }, { dx: 2, dy: 2, role: 'toit_milieu_centre' }, { dx: 3, dy: 2, role: 'toit_milieu_droit' },
  { dx: 0, dy: 3, role: 'avant_toit_gauche' }, { dx: 1, dy: 3, role: 'toit_bas_gauche' }, { dx: 2, dy: 3, role: 'toit_bas_centre' }, { dx: 3, dy: 3, role: 'toit_bas_droit' }, { dx: 4, dy: 3, role: 'avant_toit_droit' },
  { dx: 1, dy: 4, role: 'mur_haut_gauche' }, { dx: 2, dy: 4, role: 'mur_haut_centre' }, { dx: 3, dy: 4, role: 'mur_haut_droit' },
  { dx: 1, dy: 5, role: 'mur_brique1_gauche' }, { dx: 2, dy: 5, role: 'mur_brique1_centre' }, { dx: 3, dy: 5, role: 'fenetre' },
  { dx: 1, dy: 6, role: 'porte_gauche' }, { dx: 2, dy: 6, role: 'porte_droit' }, { dx: 3, dy: 6, role: 'mur_brique2_droit' },
];
// Tuile de porte retenue comme déclencheur du portail (_arrive() exige une
// correspondance exacte de tuile — cf. GameScene.js).
const MAISON_PORTE_DX = 1, MAISON_PORTE_DY = 6;

// Ancre de la maison dans la ferme 100×100 : bien à l'intérieur de la
// clôture, proche du point d'apparition (pas collée au bord).
const MAISON_AX = 48, MAISON_AY = 68;
const PORTE_X = MAISON_AX + MAISON_PORTE_DX, PORTE_Y = MAISON_AY + MAISON_PORTE_DY;

function poserMaison(ax, ay, resoudreGid) {
  const exc = {};
  for (const t of GABARIT_MAISON) {
    exc[`${ax + t.dx},${ay + t.dy}`] = resoudreGid(t.role);
  }
  return exc;
}

async function main() {
  const entries = await chargerCatalogue();

  const sol = await verifier(entries, 'sol', 16, 'sol_16px.tsx');
  const bat = await verifier(entries, 'batiment', 16, 'batiment_16px.tsx');
  const dec = await verifier(entries, 'decor', 16, 'decor_16px.tsx');

  const idSol = (nom) => sol.ids[nom];
  const idBat = (nom) => bat.ids[nom];
  const idDec = (nom) => dec.ids[nom];

  const TERRE = idSol('rogrpg_terre_v1');
  const HERBE = idSol('town_herbe_centre');
  const PARQUET = idSol('rogrpg_plancher_v1');
  const BOIS_CLAIR = idSol('rogrpg_plancher_v3');
  const MUR = idBat('farm_grange_mur_brique1_centre');
  const LIT = idDec('rogrpg_lit_vert_v1');
  console.log(
    `ids: terre=${TERRE} herbe=${HERBE} parquet=${PARQUET} bois_clair=${BOIS_CLAIR} ` +
    `mur=${MUR} lit=${LIT}`
  );

  // Résolution des 14 rôles de clôture par famille/role (pas d'id en dur).
  const roleClotureVersNom = {};
  for (const e of entries) {
    if (e.cat === 'decor' && e.meta.famille === 'cloture') roleClotureVersNom[e.meta.role] = e.name;
  }
  const rolesAttendus = [
    'horizontal', 'vertical', 'coin_hg', 'coin_hd', 'coin_bg', 'coin_bd',
    'bout_haut', 'bout_bas', 'bout_gauche', 'bout_droit',
  ];
  for (const r of rolesAttendus) {
    if (!roleClotureVersNom[r]) throw new Error(`rôle de clôture manquant au catalogue : ${r}`);
  }

  // Résolution des 24 rôles de la grange (ensemble "grange", batiment_16px).
  const roleGrangeVersNom = {};
  for (const e of entries) {
    if (e.cat === 'batiment' && e.meta.ensemble === 'grange') roleGrangeVersNom[e.meta.role] = e.name;
  }
  for (const t of GABARIT_MAISON) {
    if (!roleGrangeVersNom[t.role]) throw new Error(`rôle de grange manquant au catalogue : ${t.role}`);
  }

  // Le catalogue marque les tuiles de toit "passable":"haut" (nuance de
  // profondeur que ce moteur Bloc A ne gère pas — profondeurs statiques,
  // pas d'occlusion dynamique). Dans CE gabarit, le toit occupe des cases du
  // sol que le joueur ne doit pas traverser : on force "non" UNIQUEMENT pour
  // la copie du tileset batiment embarquée dans la carte ferme (la maison
  // n'y a pas de porte à cet endroit — le toit est un pur obstacle). Les
  // copies embarquées de maison-rdc/étage restent celles du .tsx d'origine.
  const rolesToit = new Set(
    GABARIT_MAISON.filter((t) => t.role.startsWith('toit') || t.role.startsWith('avant_toit')).map((t) => t.role)
  );
  const batPourFerme = {
    ...bat.tsx,
    props: { ...bat.tsx.props },
  };
  for (const role of rolesToit) {
    const id = idBat(roleGrangeVersNom[role]);
    batPourFerme.props[id] = { ...batPourFerme.props[id], passable: 'non' };
  }

  // --- ferme 100×100 (sol = HERBE, bordure = clôture bois, maison intérieure) -
  {
    const W = 100, H = 100;
    const { embarques, firstgids } = assemblerTilesets([
      { cat: 'sol', px: 16, tsx: sol.tsx },
      { cat: 'batiment', px: 16, tsx: batPourFerme },
      { cat: 'decor', px: 16, tsx: dec.tsx },
    ]);
    const gidSol = (id) => firstgids.sol + id;
    const gidBat = (id) => firstgids.batiment + id;
    const gidDec = (id) => firstgids.decor + id;
    const resoudreCloture = (role) => gidDec(idDec(roleClotureVersNom[role]));
    const resoudreGrange = (role) => gidBat(idBat(roleGrangeVersNom[role]));

    // Clôture : bordure ENTIÈRE, sans brèche — on ne « sort » plus de la
    // ferme par un trou dans la clôture, on entre par la porte de la maison
    // (décision John 12/08 : la maison doit être visible DANS la ferme).
    const solFerme = coucheUniforme('sol', W, H, gidSol(HERBE));
    const exceptions = {
      ...bordureCloture(W, H, resoudreCloture, new Set()),
      ...poserMaison(MAISON_AX, MAISON_AY, resoudreGrange),
    };
    const obstaclesFerme = coucheAvecExceptions('obstacles', W, H, 0, exceptions);
    const decorsFerme = coucheUniforme('decors', W, H, 0);
    const ferme = mapJson(W, H, [solFerme, obstaclesFerme, decorsFerme], embarques);

    await writeFile(path.join(MAPS_DIR, 'ferme-test.json'), JSON.stringify(ferme), 'utf8');
    console.log(
      `écrit ferme-test.json (100×100, sol herbe + clôture bois + maison en ` +
      `(${MAISON_AX},${MAISON_AY}), porte en (${PORTE_X},${PORTE_Y}))`
    );
  }

  // --- maison-rdc 12×10 (sol = PARQUET, murs = brique, inchangé) -----------
  {
    const W = 12, H = 10;
    const { embarques, firstgids } = assemblerTilesets([
      { cat: 'sol', px: 16, tsx: sol.tsx },
      { cat: 'batiment', px: 16, tsx: bat.tsx },
      { cat: 'decor', px: 16, tsx: dec.tsx },
    ]);
    const gidSol = (id) => firstgids.sol + id;
    const gidBat = (id) => firstgids.batiment + id;
    const gidDec = (id) => firstgids.decor + id;

    const solRdc = coucheUniforme('sol', W, H, gidSol(PARQUET));
    // ⭐ FIX lit traversable : le lit (passable "non" au catalogue) était
    // posé sur le calque "decors" (purement visuel, ignoré par la
    // collision — cf. GameScene._bfs/_action qui ne lisent que la couche
    // "obstacles"). Le joueur marchait dessus au lieu d'être bloqué devant.
    // Bug préexistant du générateur d'origine, reconduit sans le voir lors
    // du portage — corrigé en posant le lit sur "obstacles", comme les murs.
    const murRdc = coucheAvecExceptions(
      'obstacles', W, H, 0,
      {
        ...bordureUniforme(W, H, gidBat(MUR), new Set(['6,0', '11,2'])),
        '2,2': gidDec(LIT),
      }
    );
    const decorsRdc = coucheUniforme('decors', W, H, 0);
    const rdc = mapJson(W, H, [solRdc, murRdc, decorsRdc], embarques);

    await writeFile(path.join(MAPS_DIR, 'maison-rdc-test.json'), JSON.stringify(rdc), 'utf8');
    console.log('écrit maison-rdc-test.json (12×10, inchangé, firstgid séquentiel)');
  }

  // --- maison-etage 12×10 (sol = BOIS CLAIR, murs = brique, inchangé) ------
  {
    const W = 12, H = 10;
    const { embarques, firstgids } = assemblerTilesets([
      { cat: 'sol', px: 16, tsx: sol.tsx },
      { cat: 'batiment', px: 16, tsx: bat.tsx },
    ]);
    const gidSol = (id) => firstgids.sol + id;
    const gidBat = (id) => firstgids.batiment + id;

    const solEt = coucheUniforme('sol', W, H, gidSol(BOIS_CLAIR));
    const murEt = coucheAvecExceptions(
      'obstacles', W, H, 0,
      bordureUniforme(W, H, gidBat(MUR), new Set(['6,0']))
    );
    const decorsEt = coucheUniforme('decors', W, H, 0);
    const etage = mapJson(W, H, [solEt, murEt, decorsEt], embarques);

    await writeFile(path.join(MAPS_DIR, 'maison-etage-test.json'), JSON.stringify(etage), 'utf8');
    console.log('écrit maison-etage-test.json (12×10, inchangé, firstgid séquentiel)');
  }

  // --- zones.json : coordonnées mises à jour pour la ferme 100×100 ---------
  const zones = {
    zones: [
      {
        id: 'ferme',
        tiled: 'assets/maps/ferme-test.json',
        apparition: { x: PORTE_X, y: PORTE_Y + 3 },
        portails: [
          {
            id: 'ferme-vers-maison', type: 'simple',
            tuile: { x: PORTE_X, y: PORTE_Y },
            cible: { zone: 'maison-rdc', apparition: { x: 6, y: 8 } },
          },
        ],
      },
      {
        id: 'maison-rdc',
        tiled: 'assets/maps/maison-rdc-test.json',
        apparition: { x: 6, y: 8 },
        lit: { x: 2, y: 2 },
        portails: [
          {
            id: 'rdc-vers-etage', type: 'choix',
            tuile: { x: 11, y: 2 },
            choix: [
              { label: 'Monter à l\'étage', cible: { zone: 'maison-etage', apparition: { x: 6, y: 9 } } },
              { label: 'Rester ici', cible: null },
            ],
          },
          {
            id: 'maison-vers-ferme', type: 'simple',
            tuile: { x: 6, y: 0 },
            cible: { zone: 'ferme', apparition: { x: PORTE_X, y: PORTE_Y + 2 } },
          },
        ],
      },
      {
        id: 'maison-etage',
        tiled: 'assets/maps/maison-etage-test.json',
        apparition: { x: 6, y: 9 },
        portails: [
          {
            id: 'etage-vers-rdc', type: 'simple',
            tuile: { x: 6, y: 0 },
            cible: { zone: 'maison-rdc', apparition: { x: 11, y: 3 } },
          },
        ],
      },
    ],
  };
  await writeFile(path.join(V1, 'zones.json'), JSON.stringify(zones, null, 1), 'utf8');
  console.log('écrit zones.json');
}

main().catch((err) => {
  console.error(`ERREUR : ${err.message}`);
  process.exit(1);
});
