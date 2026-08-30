# Handoff: Elsass Game — Mobile App

## Overview
Full mobile-app design for **Elsass Game**, The Elsassisch's arcade of browser games (Cigogne, Waggis, Similitude, Elsass Farm). Covers every screen of the existing Next.js app (`Elsass-Game` repo) redesigned with a Play Store-style catalogue, a bottom tab bar (native-app pattern replacing the current top pill nav), and a unified in-game hub (pause/main-menu screen + persistent header) shared by all games.

## About the Design Files
The bundled file (`Elsass Game App.dc.html`) is a **design reference built in HTML** — a set of interactive phone-frame mockups showing intended look, content and behavior. It is not production code to copy directly. The task is to **recreate these screens inside the existing `Elsass-Game` Next.js 15 + Tailwind + shadcn/ui codebase**, following its existing patterns (`src/app/*/page.tsx` routes, `src/components/*`, Tailwind `elsass.*` color tokens, `next/font` for Azimut/Montserrat) — not to ship the HTML/inline-styles as-is.

## Fidelity
**High-fidelity.** Colors, type, spacing and copy are final and pulled directly from the live codebase's own tokens (`tailwind.config.ts`, `globals.css`). Recreate pixel-perfectly using the codebase's existing Tailwind classes and shadcn/ui components rather than raw inline styles.

## Design Tokens
Colors (from `tailwind.config.ts` → `theme.colors.elsass`, already in the codebase):
- `elsass.black` `#141210`
- `elsass.red` `#E31B23` (primary CTA)
- `elsass.gold` `#F2B93D` (accents, ratings, active states)
- `elsass.cream` `#FBF8F3` (app background)
- `elsass.ink` `#26221D` (body text)
- `elsass.line` `#E9E2D6` (borders/dividers)

Typography: **Azimut** (headings/display — `next/font/local`, Regular weight only, no bold — never fake-bold it, use uppercase for emphasis instead), **Montserrat** (body/UI — `next/font/google`).

Radii: buttons/pills fully rounded (`border-radius: 100px`), cards/tiles `10–16px`, inputs `10px`.

Icons: simple 2px stroke line icons (home, gamepad, trophy, user, chevron, arrow-left, maximize/corners, gear, mail, lock, logout) — recreate with `lucide-react` (already a dependency) rather than hand-drawn SVG.

## Screens / Views

### 1. Connexion (`/login`)
Existing route, mostly unchanged — email/password card, centered, red "Se connecter" button. No tricolor stripe (removed per user request in the design pass).

### 2. Accueil / Dashboard (`/dashboard`)
- Header row: "Bonjour, **{prénom}**" (prénom in red) + subtitle, avatar circle (initial, black bg / gold text) top-right.
- Full-width red pill button "Lancer un jeu" (play icon) → navigates to `/games`.
- "Nouveautés" section: vertical list of game rows (icon tile 44px rounded-10, name, star rating in gold, chevron) → tapping opens that game's detail.

### 3. Jeux — Catalogue (`/games`), Play Store style
- Dark gradient "À la une" banner (120–130px) with a featured game name.
- Horizontal scroll of category chips (Tous, Réflexes, Course & évitement, Mémoire, Gestion).
- Vertical list of game rows: 56–60px rounded icon tile (color-coded per game, initial letter in Azimut), name, category, star rating text + numeric rating, and either a red "Jouer" pill or a neutral "Bientôt" pill for unreleased games (Elsass Farm).

### 4. Fiche jeu — détail (`/play/[gameId]` catalogue entry / new detail view)
- Back chevron → "Catalogue".
- Header: 72px icon tile, name (Azimut), "The Elsassisch · {catégorie}", star rating + numeric rating + review count.
- Full-width CTA: red "Jouer" pill (or disabled grey "Bientôt disponible" for coming-soon games).
- Horizontal screenshot placeholders (130×90, tinted per game color).
- "À propos" description paragraph.
- "Votre score" row: label + best score in red Azimut numerals.

### 5. Scores (`/scores`)
- Title with trophy icon.
- 2-up stat cards: "Parties jouées" / "Meilleur score" (red Azimut number).
- "Détail par jeu": divided list, icon tile + name + best score (red).

### 6. Profil (`/profile`)
- Centered avatar (76px circle, black/gold initial), name, email.
- Bordered list: Mon profil / Mes scores / Panneau admin (admin-only) / Se déconnecter (red text).

### 7. Landing / Splash (`/`, pre-login)
- Centered: "ARCADE" gold label, "The Elsassisch" Azimut headline, one-line subtitle, red "Commencer maintenant" pill with arrow icon.

### 8. Admin — gestion du catalogue (`/admin`, admin-only, 404 for others)
- Mobile-adapted list of games with Publié/Masqué badge and Tester/Publier/Supprimer row of actions.
- "Ajouter un jeu" form: name, URL, description fields + red "Ajouter" submit.

### 9. Erreur critique (`error.tsx` boundary)
- Full-black screen, dark card with red border, error heading, monospace error message box (gold text), red "Tenter de recharger la page" button.

### 10. Hub in-game — menu + barre du haut unifiée (shared by every game, `public/games/core/ui.js`)
This is the **cross-game contract**, not a Next.js route — it lives in the Phaser games' shared `core/` bundle.
- **Menu principal** (each game's main-menu Scene): dark radial-gradient background, game icon + name, big red "Jouer" pill (52px), row of 3 secondary icon buttons (Réglages / Classement / Personnages — translucent white tiles, gold icon, label below).
- **Persistent HUD icons — visible ONLY on the main menu**, never during gameplay (existing decision in `core/ui.js`, `Arcade.UI.iconesPlateforme`): top-left red rounded pill "← Quitter" (returns parent page to `/games`), top-right red rounded pill "⛶ Plein écran" (toggles `requestFullscreen`/`exitFullscreen`, icon reflects real fullscreen state incl. Escape key).
- **During gameplay**: no overlay bar at all — just the game and its own score HUD text.
- Recreate this pair (menu screen + the two corner buttons) identically across all 4 games via the shared `core/ui.js`/`core/boot.js` bricks already in the repo — do not fork per-game styles.

## Interactions & Behavior (as prototyped in the HTML mock)
- Bottom tab bar (Accueil / Jeux / Scores / Profil) swaps the visible panel; active tab icon+label turn red.
- Tapping any game row/tile opens its detail view within the "Jeux" tab; the back chevron returns to the catalogue list.
- "Lancer un jeu" on Accueil jumps straight to the Jeux tab.
- "Mes scores" row on Profil jumps to the Scores tab.
- In-game hub mock has a 2-way preview toggle (Menu principal / En jeu) demonstrating that the HUD buttons disappear during gameplay — this toggle itself is a mock-only affordance, not a real product control.

## State Management (for the real app)
- Active bottom-tab (`accueil | jeux | scores | profil`).
- Selected game id (drives catalogue vs. detail view within the Jeux tab).
- Existing session/auth state (`getSessionUser`, `useAuth`) is unchanged — reuse as-is.
- Fullscreen state in-game already tracked via the native `fullscreenchange` event in `core/ui.js` — no change needed there beyond visual polish.

## Assets
- Azimut-Regular (OTF/WOFF2) and Montserrat: already present in the repo (`public/fonts/azimut/`, `next/font/google`) — no new font files needed.
- Game icon tiles, banner art, and screenshots are **placeholders** (solid-color tiles with an initial letter / simple line icon) — replace with real game art/icons and screenshots before shipping.
- No new icon set needed beyond `lucide-react`, already a dependency.

## Files
- `Elsass Game App.dc.html` — the full interactive HTML mock (all 10 screens/frames described above), included in this bundle for reference alongside this README.
