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

  copyFile(
    path.resolve(__dirname, '../node_modules/xlsx/dist/xlsx.full.min.js'),
    path.resolve(__dirname, '../public/libs/xlsx.full.min.js')
  );

} catch (e) {
  console.error("Erreur lors de la copie des libs (avez-vous fait npm install ?)", e);
  process.exit(1);
}
