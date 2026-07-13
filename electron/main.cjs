const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
	title: "Resto Calculateur", // <-- Ajoutez cette ligne
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      // Fixés explicitement plutôt que de dépendre des valeurs par défaut d'Electron
      // (qui sont sûres depuis Electron 12+, mais pourraient changer entre versions) :
      // pas d'accès Node.js dans le renderer, contexte isolé du script de préchargement,
      // renderer en bac à sable.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    }
  });

  // --- DURCISSEMENT ---
  // L'application est une SPA locale, sans aucun lien externe. On verrouille donc deux surfaces
  // d'attaque classiques d'Electron : l'ouverture de fenêtres et la navigation. Ainsi, même si du
  // contenu inattendu s'exécutait dans le renderer (ex. via un fichier importé), il ne pourrait ni
  // ouvrir une fenêtre native arbitraire, ni faire quitter l'app vers un site tiers.

  // Refuse toute tentative d'ouverture de nouvelle fenêtre (window.open, target=_blank, etc.).
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  // Bloque toute navigation vers une autre origine que celle de l'app (serveur Vite en dev,
  // fichier local en production). L'app étant une SPA, elle ne navigue jamais légitimement.
  win.webContents.on('will-navigate', (event, url) => {
    const isDev = !!process.env.VITE_DEV_SERVER_URL;
    let sameOrigin = false;
    try {
      const target = new URL(url);
      sameOrigin = isDev
        ? target.origin === new URL(process.env.VITE_DEV_SERVER_URL).origin
        : target.protocol === 'file:';
    } catch {
      sameOrigin = false;
    }
    if (!sameOrigin) {
      event.preventDefault();
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
