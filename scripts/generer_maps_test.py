#!/usr/bin/env python3
"""Générateur des cartes Tiled de TEST du Bloc A Elsass Farm (provisoires).

Cartes minimales : rectangle jouable + murs + point de portail par type.
Embarquent le(s) tileset(s) INLINE (Phaser ne lit pas les .tsx externes XML),
avec les propriétés passable/role/ensemble converties en booléens réels
(le .tsx stocke "oui"/"non" en chaînes — inutilisable pour
setCollisionByProperty({passable:false})).

L'id d'une tuile dans un .tsx = position de son nom dans le tri ORDINAL des
noms du catalogue pour (catégorie, px) — même règle que scripts/build-atlas.mjs
(cmpOrdinal = comparaison de code points, identique à sorted() Python sur ASCII).

À RÉGÉNÉRER si les tilesets changent (pnpm assets:atlas).
"""
import json, xml.etree.ElementTree as ET, os, sys

BASE = "/opt/data/elsass-game/public/games"
ASSETS = os.path.join(BASE, "assets")
MAPS_DIR = os.path.join(BASE, "elsass-farm", "v1", "assets", "maps")
V1 = os.path.join(BASE, "elsass-farm", "v1")

# --- Lecture catalogue + alignement ids -----------------------------------
cat = json.load(open(os.path.join(ASSETS, "kenney", "catalogue.json")))
entries = []  # {cat, name, meta}
for key, meta in cat.items():
    if not key.endswith(".png"):
        continue
    slash = key.index("/")
    entries.append({"cat": key[:slash], "name": key[slash + 1:-4], "meta": meta})

def ids_par_categorie(cat_, px):
    """{nom -> id} pour (catégorie, px), tri ordinal des noms."""
    noms = sorted(e["name"] for e in entries
                  if e["cat"] == cat_ and e["meta"].get("px") == px)
    return {n: i for i, n in enumerate(noms)}

def props_tsx(tsx_path):
    """{id -> {prop: valeur_str}} depuis le .tsx."""
    root = ET.parse(tsx_path).getroot()
    out = {}
    for t in root.findall("tile"):
        tid = int(t.get("id"))
        out[tid] = {p.get("name"): p.get("value")
                    for p in t.findall("./properties/property")}
    return out

# Vérification d'alignement ids <-> .tsx (ordre = tri des noms)
def verifier(cat_, px, tsx):
    ids = ids_par_categorie(cat_, px)
    props = props_tsx(os.path.join(ASSETS, "tilesets", tsx))
    noms_tries = sorted(e["name"] for e in entries
                        if e["cat"] == cat_ and e["meta"].get("px") == px)
    if len(noms_tries) != len(props):
        print(f"!! {tsx}: {len(noms_tries)} noms catalogue vs {len(props)} tuiles tsx")
    incoherents = 0
    for i, nom in enumerate(noms_tries):
        meta = next(e["meta"] for e in entries
                    if e["cat"] == cat_ and e["name"] == nom)
        p = props.get(i, {})
        passable_tsx = p.get("passable")
        passable_meta = meta.get("passable")
        if (passable_tsx == "oui") != (passable_meta == "oui"):
            incoherents += 1
            if incoherents < 4:
                print(f"!! {tsx} id {i} {nom}: tsx={passable_tsx} catalogue={passable_meta}")
    if incoherents:
        print(f"!! {tsx}: {incoherents} incohérences passable — alignement FAUX")
        sys.exit(1)
    print(f"OK alignement {tsx}: {len(noms_tries)} tuiles")
    return ids

sol_ids = verifier("sol", 16, "sol_16px.tsx")
bat_ids = verifier("batiment", 16, "batiment_16px.tsx")
dec_ids = verifier("decor", 16, "decor_16px.tsx")

# --- Tuiles choisies --------------------------------------------------------
HERBE = sol_ids["town_herbe_centre"]
BUTTE = sol_ids["farm_sol_butte_seul_v1"]
MUR = bat_ids["farm_grange_mur_brique1_centre"]
LIT = dec_ids["rogrpg_lit_vert_v1"]
SOL_INT = sol_ids["town_dalles_herbe"]  # dalles grises = sol intérieur (test)
print(f"ids: herbe={HERBE} butte={BUTTE} mur={MUR} lit={LIT} sol_int={SOL_INT}")

# --- Construction des maps ---------------------------------------------------
def tuiles_inline(cat, px, tsx):
    """Tileset inline complet (image relative à la PAGE v1/)."""
    img = f"{cat}_{px}px.png"
    root = ET.parse(os.path.join(ASSETS, "tilesets", tsx)).getroot()
    im = root.find("image")
    tiles = []
    for t in root.findall("tile"):
        tid = int(t.get("id"))
        props = []
        for p in t.findall("./properties/property"):
            name = p.get("name")
            val = p.get("value")
            if val in ("oui", "non"):
                props.append({"name": name, "type": "bool", "value": val == "oui"})
            else:
                props.append({"name": name, "type": "string", "value": val})
        if props:
            tiles.append({"id": tid, "properties": props})
    return {
        "firstgid": 1,
        "name": f"{cat}_{px}px",
        "tilewidth": px, "tileheight": px,
        "tilecount": int(root.get("tilecount")),
        "columns": int(root.get("columns")),
        "image": f"../../../assets/tilesets/{img}",
        "imagewidth": int(im.get("width")),
        "imageheight": int(im.get("height")),
        "tiles": tiles
    }

def couche(nom, w, h, remplissage, exceptions=None):
    """Couche tilelayer remplie de `remplissage` (gid) sauf exceptions {(x,y): gid}."""
    exceptions = exceptions or {}
    data = []
    for y in range(h):
        for x in range(w):
            data.append(exceptions.get((x, y), remplissage))
    return {
        "id": 1, "name": nom, "type": "tilelayer",
        "width": w, "height": h, "x": 0, "y": 0,
        "opacity": 1, "visible": True, "data": data
    }

def map_json(nom, w, h, couches, tilesets):
    return {
        "type": "map", "version": "1.10", "tiledversion": "1.11.0",
        "orientation": "orthogonal", "renderorder": "right-down",
        "width": w, "height": h, "tilewidth": 16, "tileheight": 16,
        "infinite": False, "nextlayerid": len(couches) + 1,
        "nextobjectid": 1, "layers": couches, "tilesets": tilesets
    }

def murs_bordure(w, h, gid_mur, ouvertures=None):
    """Couche obstacles : bordure de murs, avec ouvertures {(x,y)}."""
    ouvertures = ouvertures or set()
    exc = {}
    for x in range(w):
        for y in range(h):
            if x == 0 or y == 0 or x == w - 1 or y == h - 1:
                if (x, y) not in ouvertures:
                    exc[(x, y)] = gid_mur
    return exc

# --- ferme 28x18 ------------------------------------------------------------
W, H = 28, 18
sol_ferme = couche("sol", W, H, HERBE + 1)
mur_ferme = couche("obstacles", W, H, 0, murs_bordure(W, H, MUR + 1, {(5, 0)}))
dec_ferme = couche("decors", W, H, 0)
ferme = map_json("ferme-test", W, H,
                 [sol_ferme, mur_ferme, dec_ferme],
                 [tuiles_inline("sol", 16, "sol_16px.tsx"),
                  tuiles_inline("batiment", 16, "batiment_16px.tsx")])
ferme["properties"] = [{"name": "test", "type": "bool", "value": True}]

# --- maison-rdc 12x10 --------------------------------------------------------
W, H = 12, 10
sol_rdc = couche("sol", W, H, SOL_INT + 1)
mur_rdc = couche("obstacles", W, H, 0,
                 murs_bordure(W, H, MUR + 1, {(6, 0), (11, 2)}))
dec_rdc = couche("decors", W, H, 0, {(2, 2): LIT + 1})
rdc = map_json("maison-rdc-test", W, H,
               [sol_rdc, mur_rdc, dec_rdc],
               [tuiles_inline("sol", 16, "sol_16px.tsx"),
                tuiles_inline("batiment", 16, "batiment_16px.tsx"),
                tuiles_inline("decor", 16, "decor_16px.tsx")])
rdc["properties"] = [{"name": "test", "type": "bool", "value": True}]

# --- maison-etage 12x10 ------------------------------------------------------
W, H = 12, 10
sol_et = couche("sol", W, H, SOL_INT + 1)
mur_et = couche("obstacles", W, H, 0,
                murs_bordure(W, H, MUR + 1, {(6, 0)}))
dec_et = couche("decors", W, H, 0)
etage = map_json("maison-etage-test", W, H,
                 [sol_et, mur_et, dec_et],
                 [tuiles_inline("sol", 16, "sol_16px.tsx"),
                  tuiles_inline("batiment", 16, "batiment_16px.tsx"),
                  tuiles_inline("decor", 16, "decor_16px.tsx")])
etage["properties"] = [{"name": "test", "type": "bool", "value": True}]

os.makedirs(MAPS_DIR, exist_ok=True)
for nom, m in [("ferme-test.json", ferme), ("maison-rdc-test.json", rdc),
               ("maison-etage-test.json", etage)]:
    with open(os.path.join(MAPS_DIR, nom), "w", encoding="utf-8") as f:
        json.dump(m, f, ensure_ascii=False)
    print("écrit", os.path.join(MAPS_DIR, nom))

# --- zones.json --------------------------------------------------------------
zones = {
    "zones": [
        {
            "id": "ferme",
            "tiled": "assets/maps/ferme-test.json",
            "apparition": {"x": 14, "y": 16},
            "portails": [
                {"id": "ferme-vers-maison", "type": "simple",
                 "tuile": {"x": 5, "y": 0},
                 "cible": {"zone": "maison-rdc", "apparition": {"x": 6, "y": 8}}}
            ]
        },
        {
            "id": "maison-rdc",
            "tiled": "assets/maps/maison-rdc-test.json",
            "apparition": {"x": 6, "y": 8},
            "lit": {"x": 2, "y": 2},
            "portails": [
                {"id": "rdc-vers-etage", "type": "choix",
                 "tuile": {"x": 11, "y": 2},
                 "choix": [
                     {"label": "Monter à l'étage",
                      "cible": {"zone": "maison-etage", "apparition": {"x": 6, "y": 9}}},
                     {"label": "Rester ici", "cible": None}
                 ]},
                {"id": "maison-vers-ferme", "type": "simple",
                 "tuile": {"x": 6, "y": 0},
                 "cible": {"zone": "ferme", "apparition": {"x": 5, "y": 3}}}
            ]
        },
        {
            "id": "maison-etage",
            "tiled": "assets/maps/maison-etage-test.json",
            "apparition": {"x": 6, "y": 9},
            "portails": [
                {"id": "etage-vers-rdc", "type": "simple",
                 "tuile": {"x": 6, "y": 0},
                 "cible": {"zone": "maison-rdc", "apparition": {"x": 11, "y": 3}}}
            ]
        }
    ]
}
with open(os.path.join(V1, "zones.json"), "w", encoding="utf-8") as f:
    json.dump(zones, f, ensure_ascii=False, indent=1)
print("écrit", os.path.join(V1, "zones.json"))
