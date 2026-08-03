/*
 * fonts.ts — polices de la marque The Elsassisch.
 *
 * Azimut (titres) : caractère créé par Benjamin Blaess, Julien Priez &
 * Mathieu Réguer, commandé par la Ville de Strasbourg (Capitale Mondiale du
 * Livre UNESCO 2024). Distribué sous licence Creative Commons CC BY-ND 4.0
 * (usage libre, y compris commercial ; ne pas modifier le dessin du
 * caractère). Fichiers fournis par John, voir public/fonts/azimut/.
 * → azimut.strasbourg.eu
 *
 * Montserrat (corps de texte) : Google Fonts, chargée à la construction du
 * site — nécessite un accès réseau au moment du build (sans effet sur
 * Coolify, qui a accès à internet).
 */
import localFont from "next/font/local";
import { Montserrat } from "next/font/google";

export const azimut = localFont({
    src: [
        { path: "../../public/fonts/azimut/Azimut-Regular.woff2", weight: "400", style: "normal" },
        { path: "../../public/fonts/azimut/Azimut-Italic.woff2", weight: "400", style: "italic" },
        { path: "../../public/fonts/azimut/Azimut-Bold.woff2", weight: "700", style: "normal" },
    ],
    variable: "--font-azimut",
    display: "swap",
});

export const montserrat = Montserrat({
    subsets: ["latin"],
    variable: "--font-montserrat",
    display: "swap",
});
