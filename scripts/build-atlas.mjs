#!/usr/bin/env node
// build-atlas.mjs — Chantier assets (consigne Odoo 704, proposition 713, t_42140348)
//
// Source (LECTURE SEULE) : public/games/assets/kenney/ (catalogue.json = source de
// verite des noms + champs d/passable/role/ensemble/px).
// Sorties (ecrites uniquement ici) :
//   public/games/assets/atlas/<categorie>.png + <categorie>.json
//     - atlas Phaser par categorie (batiment, decor, eau, objet, perso, sol, ui,
//       vehicule), JSON Hash TexturePacker lu par this.load.atlas
//     - noms de frame = nom de fichier catalogue.json SANS extension, aucun renommage
//   public/games/assets/tilesets/<categorie>_<taille>px.png + .tsx
//     - un tileset Tiled par (categorie x taille), grille uniforme, custom
//       properties passable / role / ensemble injectees depuis catalogue.json
//
// Rejouable : pnpm assets:atlas (vide les dossiers de sortie puis regenere tout).
import { readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { MaxRectsPacker } from 'maxrects-packer';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'public/games/assets/kenney');
const OUT_ATLAS = path.join(ROOT, 'public/games/assets/atlas');
const OUT_TILES = path.join(ROOT, 'public/games/assets/tilesets');

// Ordre canonique des 8 categories (consigne 704). 'son' (mp3) et '_references'
// sont hors perimetre (proposition 713 : planches, sons, polices — pas des tuiles).
const CATEGORIES = ['batiment', 'decor', 'eau', 'objet', 'perso', 'sol', 'ui', 'vehicule'];

// Taille de page atlas : POT carree, 2048 suffit pour la plus grosse categorie
// (decor ~757 Kpx^2). Padding 1px entre sprites (anti-bleeding sous filtrage).
const PAGE = 2048;
const PADDING = 1;

const log = (msg) => console.log(msg);

function xmlEscape(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

// Tri ORDINAL strict (code points UTF-16) — identique en Python et en Node,
// deterministe et verifiable (localeCompare est instable entre runtimes).
function cmpOrdinal(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

// --- Lecture du catalogue -------------------------------------------------
async function loadCatalogue() {
  const raw = JSON.parse(await readFile(path.join(SRC, 'catalogue.json'), 'utf8'));
  const entries = []; // {cat, name, file, meta}
  for (const [key, meta] of Object.entries(raw)) {
    if (!key.endsWith('.png')) continue; // mp3 (son/), etc.
    const slash = key.indexOf('/');
    const cat = key.slice(0, slash);
    const name = key.slice(slash + 1, -'.png'.length); // sans extension
    entries.push({ cat, name, file: path.join(SRC, key), meta });
  }
  return entries;
}

// --- Atlas : une page par categorie ---------------------------------------
async function buildAtlas(entries) {
  // Lire chaque PNG une seule fois (buffer + dimensions reelles).
  const loaded = [];
  for (const e of entries) {
    const buf = await readFile(e.file);
    const info = await sharp(buf).metadata();
    if (info.width !== info.height) {
      throw new Error(`image non carree (hors grille Tiled) : ${e.file} ${info.width}x${info.height}`);
    }
    loaded.push({ ...e, buf, w: info.width, h: info.height });
  }

  // Bin-packing dans une page POT carree de PAGE x PAGE, padding 1px.
  const packer = new MaxRectsPacker(PAGE, PAGE, PADDING, {
    smart: true,
    pot: true,
    square: true,
    allowRotation: false,
  });
  for (const l of loaded) packer.add(l.w, l.h, l);

  if (packer.bins.length !== 1) {
    throw new Error(
      `categorie ${entries[0]?.cat}: ${packer.bins.length} pages necessaires (contenu > ${PAGE}px)`
    );
  }
  const bin = packer.bins[0];
  const pageW = bin.width;
  const pageH = bin.height;

  // Assemblage PNG : base transparente + composite de chaque sprite.
  const composite = [];
  const frames = {};
  for (const rect of bin.rects) {
    const l = rect.data;
    const rw = rect.width;
    const rh = rect.height;
    composite.push({ input: l.buf, left: rect.x, top: rect.y });
    frames[l.name] = {
      frame: { x: rect.x, y: rect.y, w: rw, h: rh },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: rw, h: rh },
      sourceSize: { w: rw, h: rh },
    };
  }
  const base = sharp({
    create: { width: pageW, height: pageH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  });
  const png = await base.composite(composite).png().toBuffer();

  // JSON Hash TexturePacker (lu par this.load.atlas).
  const cat = entries[0].cat;
  const json = {
    frames,
    meta: {
      app: 'elsass-game scripts/build-atlas.mjs',
      version: '1.0',
      image: `${cat}.png`,
      format: 'RGBA8888',
      size: { w: pageW, h: pageH },
      scale: 1,
    },
  };

  await writeFile(path.join(OUT_ATLAS, `${cat}.png`), png);
  await writeFile(path.join(OUT_ATLAS, `${cat}.json`), JSON.stringify(json, null, 2));
  return { cat, frames: Object.keys(frames).length, pageW, pageH };
}

// --- Tilesets : un par (categorie x taille) --------------------------------
async function buildTilesets(entries) {
  // Grouper par (categorie, px declare). La coherence px <-> dimensions reelles
  // est garantie (verifiee sur la matiere premiere : 5226/5226).
  const groups = new Map(); // "cat|px" -> [{name, buf, meta, w}]
  for (const e of entries) {
    const px = e.meta.px;
    const key = `${e.cat}|${px}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }

  const written = [];
  for (const [key, list] of groups) {
    const [cat, pxStr] = key.split('|');
    const px = Number(pxStr);
    const sorted = [...list].sort((a, b) => cmpOrdinal(a.name, b.name));

    // Grille reguliere : colonnes = ceil(sqrt(n)), lignes = ceil(n/colonnes).
    const cols = Math.ceil(Math.sqrt(sorted.length));
    const rows = Math.ceil(sorted.length / cols);
    const imgW = cols * px;
    const imgH = rows * px;

    const composite = [];
    const tiles = [];
    for (let i = 0; i < sorted.length; i++) {
      const e = sorted[i];
      const buf = await readFile(e.file);
      const col = i % cols;
      const row = Math.floor(i / cols);
      composite.push({ input: buf, left: col * px, top: row * px });

      const props = [];
      for (const p of ['passable', 'role', 'ensemble']) {
        if (e.meta[p] !== undefined && e.meta[p] !== null && e.meta[p] !== '') {
          props.push(`     <property name="${p}" value="${xmlEscape(e.meta[p])}"/>`);
        }
      }
      if (props.length) {
        tiles.push(
          `  <tile id="${i}">\n   <properties>\n${props.join('\n')}\n   </properties>\n  </tile>`
        );
      }
    }

    const base = sharp({
      create: { width: imgW, height: imgH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    });
    const png = await base.composite(composite).png().toBuffer();

    const tsxName = `${cat}_${px}px`;
    const tsx = `<?xml version="1.0" encoding="UTF-8"?>
<tileset version="1.10" tiledversion="1.11.0" name="${tsxName}" tilewidth="${px}" tileheight="${px}" tilecount="${sorted.length}" columns="${cols}">
 <image source="${tsxName}.png" width="${imgW}" height="${imgH}"/>
${tiles.join('\n')}
</tileset>
`;

    await writeFile(path.join(OUT_TILES, `${tsxName}.png`), png);
    await writeFile(path.join(OUT_TILES, `${tsxName}.tsx`), tsx);
    written.push({ tsxName, tiles: sorted.length, px, imgW, imgH });
  }
  return written;
}

// --- Main ------------------------------------------------------------------
async function main() {
  // Nettoyage des sorties (rejouable) — n'ecrit QUE dans atlas/ et tilesets/.
  await rm(OUT_ATLAS, { recursive: true, force: true });
  await rm(OUT_TILES, { recursive: true, force: true });
  await mkdir(OUT_ATLAS, { recursive: true });
  await mkdir(OUT_TILES, { recursive: true });

  const catalogue = await loadCatalogue();
  const byCat = new Map();
  for (const e of catalogue) {
    if (!byCat.has(e.cat)) byCat.set(e.cat, []);
    byCat.get(e.cat).push(e);
  }

  const unknown = [...byCat.keys()].filter((c) => !CATEGORIES.includes(c));
  if (unknown.length) {
    console.warn(`[warn] categories hors perimetre ignorees : ${unknown.join(', ')}`);
  }

  let totalFrames = 0;
  let totalTiles = 0;
  for (const cat of CATEGORIES) {
    const entries = byCat.get(cat) || [];
    if (!entries.length) {
      console.warn(`[warn] categorie sans entree : ${cat}`);
      continue;
    }
    const atlas = await buildAtlas(entries);
    totalFrames += atlas.frames;
    log(
      `atlas  ${atlas.cat.padEnd(10)} ${String(atlas.frames).padStart(5)} frames  ` +
        `${atlas.pageW}x${atlas.pageH}px`
    );
  }

  for (const cat of CATEGORIES) {
    const entries = byCat.get(cat) || [];
    if (!entries.length) continue;
    const tiles = await buildTilesets(entries);
    for (const t of tiles) {
      totalTiles += t.tiles;
      log(
        `tsx    ${t.tsxName.padEnd(14)} ${String(t.tiles).padStart(5)} tuiles  ` +
          `${t.imgW}x${t.imgH}px (${t.px}px)`
      );
    }
  }

  // Integrite : chaque entree PNG du catalogue est dans l'atlas de sa categorie.
  const pngTotal = catalogue.length;
  if (totalFrames !== pngTotal) {
    throw new Error(
      `integrite : ${totalFrames} frames packees pour ${pngTotal} entrées catalogue`
    );
  }
  log(`\nOK : ${totalFrames}/${pngTotal} frames en atlas, ${totalTiles} tuiles en tilesets.`);
  log('Sorties : public/games/assets/atlas/ et public/games/assets/tilesets/');
}

main().catch((err) => {
  console.error(`ERREUR : ${err.message}`);
  process.exit(1);
});
