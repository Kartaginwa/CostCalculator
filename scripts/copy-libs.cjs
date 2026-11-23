const fs = require('fs');
const path = require('path');

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  console.log(`Copié: ${src} -> ${dest}`);
}

try {
  copyFile(
    path.resolve(__dirname, '../node_modules/jspdf/dist/jspdf.umd.min.js'),
    path.resolve(__dirname, '../public/libs/jspdf.umd.min.js')
  );

  copyFile(
    path.resolve(__dirname, '../node_modules/jspdf-autotable/dist/jspdf.plugin.autotable.js'),
    path.resolve(__dirname, '../public/libs/jspdf.plugin.autotable.js')
  );

  // xlsx-js-style (23/11) : copie de SheetJS 0.18.5 qui écrit aussi les styles (couleurs d'en-tête de l'export Excel). Même fichier
  // servi, même nom (/libs/xlsx.full.min.js, window.XLSX) : les tables de pages de code (cpexcel.js, nécessaires aux anciens .xls)
  // sont placées devant la bibliothèque, comme dans l'ancienne version « full ».
  const xlsxDist = path.resolve(__dirname, '../node_modules/xlsx-js-style/dist');
  const xlsxDest = path.resolve(__dirname, '../public/libs/xlsx.full.min.js');
  fs.mkdirSync(path.dirname(xlsxDest), { recursive: true });
  fs.writeFileSync(xlsxDest, fs.readFileSync(path.join(xlsxDist, 'cpexcel.js'), 'utf8') + '\n' + fs.readFileSync(path.join(xlsxDist, 'xlsx.bundle.js'), 'utf8').replace(/\n\/\/# sourceMappingURL=.*$/, ''));
  console.log(`Assemblé: xlsx-js-style (cpexcel.js + xlsx.bundle.js) -> ${xlsxDest}`);

} catch (e) {
  console.error("Erreur lors de la copie des libs (avez-vous fait npm install ?)", e);
  process.exit(1);
}
