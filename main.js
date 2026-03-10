const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const db = require('./db/database');
const sync = require('./sync');

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    fullscreen: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile('renderer/index.html');
}

app.whenReady().then(() => {
  createWindow();
  sync.startHttpServer(db);
  sync.startDiscoveryListener();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('updates:getAll', () => db.getAllUpdates());
ipcMain.handle('updates:getByDate', (_, date) => db.getUpdatesByDate(date));
ipcMain.handle('updates:getDatesWithUpdates', () => db.getDatesWithUpdates());
ipcMain.handle('updates:create', (_, update) => db.createUpdate(update));
ipcMain.handle('updates:edit', (_, id, fields) => db.editUpdate(id, fields));
ipcMain.handle('updates:delete', (_, id) => db.deleteUpdate(id));

ipcMain.handle('export:json', async () => {
  const { filePath, canceled } = await dialog.showSaveDialog({
    title: 'Export updates',
    defaultPath: `daily-updates-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (canceled || !filePath) return { canceled: true };
  const data = { updates: db.getAllUpdates(), holidays: db.getAllHolidays(), people: db.getAllPeople() };
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  return { success: true, filePath };
});

ipcMain.handle('people:getAll', () => db.getAllPeople());
ipcMain.handle('people:create', (_, name) => db.createPerson(name));
ipcMain.handle('people:update', (_, id, name) => db.updatePerson(id, name));
ipcMain.handle('people:delete', (_, id) => db.deletePerson(id));

ipcMain.handle('repos:getAll', () => db.getAllRepos());
ipcMain.handle('repos:create', (_, name) => db.createRepo(name));

ipcMain.handle('holidays:get', (_, date) => db.getHoliday(date));
ipcMain.handle('holidays:getAllDates', () => db.getAllHolidayDates());
ipcMain.handle('holidays:set', (_, date, name) => db.setHoliday(date, name));
ipcMain.handle('holidays:remove', (_, date) => db.removeHoliday(date));

ipcMain.handle('sync:start', async () => {
  try {
    const peers = await sync.discoverPeers(2000);
    if (!peers.length) return { success: false, message: 'No peers found on the network.' };
    for (const ip of peers) await sync.syncWithPeer(ip);
    return { success: true, count: peers.length };
  } catch (e) {
    return { success: false, message: e.message };
  }
});
