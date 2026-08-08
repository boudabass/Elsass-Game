#!/usr/bin/env python3
"""
Harnais QA Elsass Game — runner générique browserless /function.

Un seul script à connaître pour toute carte QA :
    python3 qa/runner.py qa/scenarios/<scenario>.js [--out DIR] [--timeout SECONDS]

Ce runner :
  1. lit BROWSERLESS_URL + BROWSERLESS_TOKEN dans l'environnement (ou ./.env) ;
  2. assemble helpers.js (bloc commun : login, attente scène, captures,
     collecte console) + le scénario choisi en un SEUL module ES ;
  3. l'envoie à l'endpoint /function de browserless (un appel = un navigateur
     ouvert/fermé, aucune session à gérer — article Odoo 703) ;
  4. sauvegarde la réponse brute (JSON) et extrait chaque champ `shot_*`
     (screenshot base64) en PNG dans le dossier de sortie ;
  5. imprime un résumé lisible (erreurs console, champs clés du retour).

Convention de sortie d'un scénario :
    return { data: { ...resultats..., shot_<nom>: "<base64 png>", consoleErrors: [...] },
             type: "application/json" };

Usage depuis une carte QA :
    cd /opt/data/profiles/eg-qa && set -a && . ./.env && set +a
    python3 /opt/data/elsass-game/qa/runner.py \
        /opt/data/elsass-game/qa/scenarios/smoke_arcade.js \
        --out /opt/data/kanban/boards/elsassgame/workspaces/<ma-carte>
"""
import argparse
import base64
import json
import os
import re
import ssl
import sys
import time
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
HELPERS = os.path.join(HERE, "helpers.js")


def load_credentials():
    """BROWSERLESS_URL/TOKEN depuis l'env, repli sur un ./.env local."""
    url = os.environ.get("BROWSERLESS_URL")
    token = os.environ.get("BROWSERLESS_TOKEN")
    if url and token:
        return url, token
    env_file = os.path.join(os.getcwd(), ".env")
    if os.path.exists(env_file):
        for line in open(env_file, encoding="utf-8"):
            line = line.strip()
            if line.startswith("BROWSERLESS_URL="):
                url = line.split("=", 1)[1].strip().strip('"').strip("'")
            elif line.startswith("BROWSERLESS_TOKEN="):
                token = line.split("=", 1)[1].strip().strip('"').strip("'")
    if not url or not token:
        sys.exit("STOP: BROWSERLESS_URL et BROWSERLESS_TOKEN introuvables "
                 "(env ou ./.env). Voir qa/README.md.")
    return url, token


def extraire_shots(data, out_dir):
    """Chaque champ shot_<nom> = PNG base64 -> fichier out/<nom>.png."""
    ecrits = []
    if isinstance(data, dict):
        for k, v in data.items():
            if k.startswith("shot_") and isinstance(v, str) and v:
                try:
                    png = base64.b64decode(v)
                    nom = k[len("shot_"):] + ".png"
                    path = os.path.join(out_dir, nom)
                    with open(path, "wb") as f:
                        f.write(png)
                    ecrits.append((nom, len(png)))
                except Exception as e:
                    print(f"  [warn] shot {k} non décodable: {e}")
    return ecrits


def resumer(data):
    """Affiche les champs utiles du retour (hors screenshots)."""
    if not isinstance(data, dict):
        print("  retour:", str(data)[:500])
        return
    ce = data.get("consoleErrors")
    if isinstance(ce, list) and ce:
        print(f"  ⚠ console errors ({len(ce)}):")
        for e in ce[:10]:
            print("    -", e[:200])
    elif ce is not None:
        print(f"  console errors: {ce}")
    for k, v in data.items():
        if k.startswith("shot_") or k == "consoleErrors":
            continue
        s = json.dumps(v, ensure_ascii=False) if not isinstance(v, str) else v
        print(f"  {k}: {s[:300]}")


def main():
    ap = argparse.ArgumentParser(description="Runner harnais QA browserless /function")
    ap.add_argument("scenario", help="chemin du scénario JS (qa/scenarios/*.js)")
    ap.add_argument("--out", default=".", help="dossier de sortie (JSON + PNG)")
    ap.add_argument("--timeout", type=int, default=300,
                    help="timeout browserless en secondes (défaut 300)")
    args = ap.parse_args()

    if not os.path.exists(args.scenario):
        sys.exit(f"STOP: scénario introuvable: {args.scenario}")
    if not os.path.exists(HELPERS):
        sys.exit(f"STOP: helpers introuvables: {HELPERS}")
    os.makedirs(args.out, exist_ok=True)

    url, token = load_credentials()
    code = open(HELPERS, encoding="utf-8").read() + "\n\n" + \
           open(args.scenario, encoding="utf-8").read()
    payload = json.dumps({"code": code}).encode()
    endpoint = f"{url}/function?token={token}&timeout={args.timeout * 1000}"

    print(f"[harness] POST {url}/function  scénario={os.path.basename(args.scenario)} "
          f"({len(code)} chars), timeout {args.timeout}s", flush=True)
    req = urllib.request.Request(endpoint, data=payload,
                                 headers={"Content-Type": "application/json"})
    ctx = ssl.create_default_context()
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=args.timeout + 30, context=ctx) as r:
            raw = r.read().decode()
    except Exception as e:
        sys.exit(f"BLOQUAGE OUTILLAGE: échec POST /function: {type(e).__name__}: {e}\n"
                 f"(script envoyé: {args.scenario} — relancer après vérif infra browserless)")
    print(f"[harness] réponse reçue en {time.time() - t0:.1f}s ({len(raw)} octets)", flush=True)

    base = os.path.splitext(os.path.basename(args.scenario))[0]
    json_path = os.path.join(args.out, base + ".json")
    with open(json_path, "w", encoding="utf-8") as f:
        f.write(raw)
    print(f"[harness] réponse brute: {json_path}")

    try:
        resp = json.loads(raw)
        data = resp.get("data", resp)
    except Exception:
        print("[harness] réponse non-JSON:")
        print(raw[:1000])
        return 1

    if isinstance(data, dict) and data.get("err"):
        print("[harness] ERREUR SCÉNARIO:", str(data["err"])[:500])

    shots = extraire_shots(data, args.out)
    for nom, taille in shots:
        print(f"[harness] screenshot: {os.path.join(args.out, nom)} ({taille} octets)")
    if not shots:
        print("[harness] aucun screenshot (champs shot_* absents du retour)")

    resumer(data)
    return 0


if __name__ == "__main__":
    sys.exit(main())
