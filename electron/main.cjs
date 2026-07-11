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
