import { partie0 } from './content/partie0.js';
import { partie1 } from './content/partie1.js';
import { chapitreParametres } from './content/partie2a.js';
import { chapitreIngredients, chapitreEmballage, chapitreMainOeuvre } from './content/partie2b.js';
import { chapitreEtatResultats, chapitreProduction } from './content/partie2c.js';
import { partie3 } from './content/partie3.js';
import { partie4 } from './content/partie4.js';

// Le guide complet : quatre parties (+ la partie 0 « Bien utiliser ce guide »). Le sommaire, les
// ancres et la recherche sont tous dérivés de cette structure ; voir InstructionModal.jsx.
export const partie2 = {
    id: 'guide-partie-2',
    title: 'Partie 2 — Utiliser l\'application, onglet par onglet',
    lead: 'Un chapitre par onglet : à quoi il sert, comment le remplir, et ce que montrent les chiffres du projet démo.',
    chapters: [chapitreParametres, chapitreIngredients, chapitreEmballage, chapitreMainOeuvre, chapitreEtatResultats, chapitreProduction],
};

export const PARTS = [partie0, partie1, partie2, partie3, partie4];
