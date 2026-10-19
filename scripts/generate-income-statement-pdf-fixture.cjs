// Génère e2e/fixtures/income-statement-sample.pdf (Phase 4.7, 15/10) : fixture de test pour
// l'assistant d'import PDF de l'état des résultats (e2e/income-statement-import-pdf.spec.js).
// Poste et montant sont écrits via deux appels .text() séparés (gauche/droite, même hauteur),
// pour reproduire fidèlement la mise en page d'un export comptable réel — pas une seule chaîne
// concatenée, qui masquerait un bug de regroupement par position Y dans extractLinesFromPdf.
// À régénérer avec : node scripts/generate-income-statement-pdf-fixture.cjs
const { jsPDF } = require('jspdf');
const path = require('path');

const doc = new jsPDF();
doc.setFontSize(12);
let y = 20;
const rows = [
    ['Ventes Chili con carne mijoté', '15 000,00 $'],
    ['Ventes diverses', '5 000,00 $'],
    ['Loyer entrepot', '9 000,00 $'],
    ['Assurances', '2 200,00 $'],
];
rows.forEach(([label, amount]) => {
    doc.text(label, 20, y);
    doc.text(amount, 150, y);
    y += 10;
});

const outPath = path.resolve(__dirname, '../e2e/fixtures/income-statement-sample.pdf');
doc.save(outPath);
console.log(`Fixture régénérée : ${outPath}`);
